from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import List
from decimal import Decimal
import json
import sys
import os
import httpx
import logging 

# --- Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# Auth Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# URL for the Inventory Management System's deduction endpoint
IMS_DEDUCT_URL = "http://127.0.0.1:8002/ingredients/ingredients/deduct-from-sale"

router_sales = APIRouter(prefix="/auth/sales", tags=["sales"])

ADDON_PRICES = {
    'espressoShots': Decimal('25.00'),
    'seaSaltCream': Decimal('30.00'),
    'syrupSauces': Decimal('20.00'),
}

class SaleItem(BaseModel):
    name: str
    quantity: int
    price: float
    category: str
    addons: dict

class Sale(BaseModel):
    cartItems: List[SaleItem]
    orderType: str
    paymentMethod: str
    appliedDiscounts: List[str]

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Invalid token or user not found: {e.response.text}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to the authentication service."
            )
    return response.json()

# --- Helper function to call the IMS and deduct inventory ---
async def trigger_inventory_deduction(cart_items: List[SaleItem], token: str):
    """
    Calls the IMS to deduct ingredients for the sold items.
    This is a "fire-and-forget" call with critical logging on failure.
    """
    logger.info("Triggering inventory deduction in IMS.")
    
    
    payload = {
        "cartItems": [{"name": item.name, "quantity": item.quantity} for item in cart_items]
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(IMS_DEDUCT_URL, json=payload, headers=headers)
            response.raise_for_status()
            logger.info("Successfully requested inventory deduction from IMS.")
    except httpx.HTTPStatusError as e:
        
        logger.critical(
            f"INVENTORY-SYNC-FAILURE: Sale processed, but failed to deduct inventory in IMS. "
            f"Status: {e.response.status_code}, Response: {e.response.text}"
        )
    except Exception as e:
        logger.critical(f"INVENTORY-SYNC-FAILURE: An unexpected error occurred while contacting IMS: {e}")


async def calculate_totals_and_discounts(sale_data: Sale, cursor):
    subtotal = Decimal('0.0')
    for item in sale_data.cartItems:
        item_price = Decimal(str(item.price))
        addons_price = Decimal('0.0')
        if item.addons:
            for addon_name, quantity in item.addons.items():
                addons_price += ADDON_PRICES.get(addon_name, Decimal('0.0')) * quantity
        subtotal += (item_price + addons_price) * item.quantity

    total_discount_amount = Decimal('0.0')
    applied_discounts_details = []

    if not sale_data.appliedDiscounts:
        return subtotal, total_discount_amount, applied_discounts_details

    placeholders = ','.join(['?' for _ in sale_data.appliedDiscounts])
    sql_fetch_discounts = f"""
        SELECT DiscountID, DiscountName, DiscountType, PercentageValue, FixedValue, MinimumSpend
        FROM Discounts
        WHERE DiscountName IN ({placeholders}) AND Status = 'Active' AND GETUTCDATE() BETWEEN ValidFrom AND ValidTo
    """
    await cursor.execute(sql_fetch_discounts, sale_data.appliedDiscounts)
    valid_discounts = await cursor.fetchall()

    for discount in valid_discounts:
        min_spend = discount.MinimumSpend or Decimal('0.0')
        if subtotal >= min_spend:
            discount_value = Decimal('0.0')
            if discount.DiscountType == 'Percentage' and discount.PercentageValue is not None:
                discount_value = (subtotal * discount.PercentageValue) / Decimal('100')
            elif discount.DiscountType == 'Fixed' and discount.FixedValue is not None:
                discount_value = discount.FixedValue
            total_discount_amount += discount_value
            applied_discounts_details.append({"id": discount.DiscountID, "amount": discount_value})

    final_discount = min(total_discount_amount, subtotal)
    return subtotal, final_discount, applied_discounts_details

# --- API Endpoint with Authorization AND Inventory Deduction ---
@router_sales.post("/", status_code=status.HTTP_201_CREATED)
# --- NEW --- We now depend on the raw token string in addition to the validated user data.
async def create_sale(
    sale: Sale, 
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Creates a new sale record and triggers inventory deduction.
    """
    allowed_roles = ["admin", "manager", "staff", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create a sale."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            subtotal, total_discount, discount_details = await calculate_totals_and_discounts(sale, cursor)
            cashier_name = current_user.get("username", "SystemUser")

            sql_sale = "INSERT INTO Sales (OrderType, PaymentMethod, CashierName, TotalDiscountAmount) OUTPUT INSERTED.SaleID VALUES (?, ?, ?, ?)"
            await cursor.execute(sql_sale, sale.orderType, sale.paymentMethod, cashier_name, total_discount)
            sale_id_row = await cursor.fetchone()
            if not sale_id_row or not sale_id_row[0]:
                raise HTTPException(status_code=500, detail="Failed to create sale record.")
            sale_id = sale_id_row[0]

            for item in sale.cartItems:
                sql_item = "INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category, Addons) VALUES (?, ?, ?, ?, ?, ?)"
                addons_str = json.dumps(item.addons) if item.addons else None
                await cursor.execute(sql_item, sale_id, item.name, item.quantity, Decimal(str(item.price)), item.category, addons_str)

            for discount in discount_details:
                sql_sale_discount = "INSERT INTO SaleDiscounts (SaleID, DiscountID, DiscountAppliedAmount) VALUES (?, ?, ?)"
                await cursor.execute(sql_sale_discount, sale_id, discount['id'], discount['amount'])

            # If all DB steps succeed, commit the changes.
            await conn.commit()
            
            await trigger_inventory_deduction(cart_items=sale.cartItems, token=token)
            
            final_total = subtotal - total_discount
            return {
                "saleId": sale_id,
                "subtotal": float(subtotal),
                "discountAmount": float(total_discount),
                "finalTotal": float(final_total)
            }
    except Exception as e:
        if conn: await conn.rollback()
        if not isinstance(e, HTTPException):
             raise HTTPException(status_code=500, detail=f"An unexpected error occurred while processing the sale.")
        raise e
    finally:
        if conn: await conn.close()