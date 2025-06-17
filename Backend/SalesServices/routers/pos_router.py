from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List
from decimal import Decimal
import json
import sys
import os
import httpx # Required for making HTTP requests to the auth service

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth Configuration ---
# This scheme expects a Bearer token in the Authorization header.
# The tokenUrl points to the endpoint that provides the token (in your auth service).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

router_sales = APIRouter(prefix="/sales", tags=["sales"])

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
    """
    Dependency to validate the token with the auth service and return the current user's data.
    This function will be called automatically by FastAPI for endpoints that depend on it.
    """
    async with httpx.AsyncClient() as client:
        try:
            # Call the auth service's /users/me endpoint with the provided token
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()  # Raises an exception for 4xx or 5xx status codes
        except httpx.HTTPStatusError as e:
            # If the auth service returns an error (e.g., 401 Unauthorized), re-raise it as an HTTPException
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Invalid token or user not found: {e.response.text}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except httpx.RequestError:
            # If the auth service is unreachable
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to the authentication service."
            )
    
    user_data = response.json()
    # You could add a check here if your user model has an "is_active" flag
    # if not user_data.get("is_active"):
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return user_data


async def calculate_totals_and_discounts(sale_data: Sale, cursor):
    # This function is correct and does not need changes.
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
        WHERE DiscountName IN ({placeholders})
          AND Status = 'Active'
          AND GETUTCDATE() BETWEEN ValidFrom AND ValidTo
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

# --- API Endpoint with Authorization ---
@router_sales.post("/", status_code=status.HTTP_201_CREATED)
async def create_sale(sale: Sale, current_user: dict = Depends(get_current_active_user)):
    """
    Creates a new sale record.

    This endpoint is protected and requires a valid Bearer token.
    - **Authorization**: The user's role is checked.
    - **Transaction**: All database operations are wrapped in a transaction.
    - **Cashier Name**: The cashier's name is automatically retrieved from the user token.
    """
    # 1. Role-based access control
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
            # A transaction is implicitly started on the first execute.
            
            # 2. Calculate totals
            subtotal, total_discount, discount_details = await calculate_totals_and_discounts(sale, cursor)
            
            # 3. Get cashier name from the validated token payload
            cashier_name = current_user.get("username", "SystemUser") # Safely get username

            # 4. Insert into the main `Sales` table
            sql_sale = """
                INSERT INTO Sales (OrderType, PaymentMethod, CashierName, TotalDiscountAmount)
                OUTPUT INSERTED.SaleID
                VALUES (?, ?, ?, ?)
            """
            await cursor.execute(
                sql_sale,
                sale.orderType, sale.paymentMethod, cashier_name, total_discount
            )
            sale_id_row = await cursor.fetchone()
            if not sale_id_row or not sale_id_row[0]:
                raise HTTPException(status_code=500, detail="Failed to create sale record.")
            sale_id = sale_id_row[0]

            # 5. Insert each item into the `SaleItems` table
            for item in sale.cartItems:
                sql_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category, Addons)
                    VALUES (?, ?, ?, ?, ?, ?)
                """
                addons_str = json.dumps(item.addons) if item.addons else None
                await cursor.execute(
                    sql_item,
                    sale_id, item.name, item.quantity, Decimal(str(item.price)), 
                    item.category, addons_str
                )

            # 6. Insert into the `SaleDiscounts` junction table
            for discount in discount_details:
                sql_sale_discount = """
                    INSERT INTO SaleDiscounts (SaleID, DiscountID, DiscountAppliedAmount)
                    VALUES (?, ?, ?)
                """
                await cursor.execute(
                    sql_sale_discount,
                    sale_id, discount['id'], discount['amount']
                )

            # If all steps succeed, commit the changes to the database.
            await conn.commit()
            
            final_total = subtotal - total_discount
            return {
                "saleId": sale_id,
                "subtotal": float(subtotal),
                "discountAmount": float(total_discount),
                "finalTotal": float(final_total)
            }

    except Exception as e:
        if conn:
            await conn.rollback()
        # Avoid raising the original exception directly to prevent leaking implementation details
        if not isinstance(e, HTTPException):
             raise HTTPException(status_code=500, detail=f"An unexpected error occurred while processing the sale.")
        raise e # Re-raise known HTTPExceptions
    
    finally:
        if conn:
            await conn.close()