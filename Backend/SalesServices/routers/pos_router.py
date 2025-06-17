from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List
from decimal import Decimal
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- Import dependencies ---
from database import get_db_connection

ADDON_PRICES = {
    'espressoShots': Decimal('25.00'),
    'seaSaltCream': Decimal('30.00'),
    'syrupSauces': Decimal('20.00'),
}
AVAILABLE_DISCOUNTS = [
    {'id': 'SENIOR_CITIZEN', 'type': 'percentage', 'value': 20},
    {'id': 'PWD', 'type': 'percentage', 'value': 20},
    {'id': 'PROMO_10_OFF', 'type': 'percentage', 'value': 10, 'minAmount': 500.00},
]


router_sales = APIRouter(prefix="/sales", tags=["sales"])

# --- Models ---
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

def calculate_totals_and_discount(sale_data: Sale):
    """Securely calculates subtotal and discount on the server."""
    subtotal = Decimal('0.0')
    for item in sale_data.cartItems:
        item_price = Decimal(str(item.price))
        addons_price = Decimal('0.0')
        if item.addons:
            for addon_name, quantity in item.addons.items():
                addons_price += ADDON_PRICES.get(addon_name, Decimal('0.0')) * quantity
        subtotal += (item_price + addons_price) * item.quantity

    total_discount = Decimal('0.0')
    for discount_id in sale_data.appliedDiscounts:
        discount = next((d for d in AVAILABLE_DISCOUNTS if d['id'] == discount_id), None)
        if discount:
            min_amount = Decimal(str(discount.get('minAmount', '0')))
            if subtotal >= min_amount:
                if discount['type'] == 'percentage':
                    total_discount += (subtotal * Decimal(str(discount['value']))) / 100
                else:
                    total_discount += Decimal(str(discount['value']))

    final_discount = min(total_discount, subtotal)
    return subtotal, final_discount

# --- API Endpoint ---
@router_sales.post("/", status_code=status.HTTP_201_CREATED)
async def create_sale(sale: Sale):
    conn = None
    try:
        subtotal, discount_amount = calculate_totals_and_discount(sale)
        cashier_name = "Unknown" 

        discounts_json = json.dumps(sale.appliedDiscounts)

        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            sql = """
                INSERT INTO Sales (OrderType, PaymentMethod, CashierName, DiscountAmount, AppliedDiscounts, CreatedAt)
                OUTPUT INSERTED.SaleID
                VALUES (?, ?, ?, ?, ?, GETUTCDATE())
            """
            await cursor.execute(
                sql,
                sale.orderType,
                sale.paymentMethod,
                cashier_name,
                discount_amount,
                discounts_json
            )
            sale_id_row = await cursor.fetchone()

            if not sale_id_row or not sale_id_row[0]:
                await conn.rollback()
                raise HTTPException(status_code=500, detail="Failed to create sale record.")

            sale_id = sale_id_row[0]

            for item in sale.cartItems:
                sql_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, Price, Category, Addons)
                    VALUES (?, ?, ?, ?, ?, ?)
                """
                addons_str = json.dumps(item.addons)
                await cursor.execute(
                    sql_item,
                    sale_id,
                    item.name,
                    item.quantity,
                    Decimal(str(item.price)),
                    item.category,
                    addons_str
                )

            await conn.commit()
            return {"saleId": sale_id}

    except Exception as e:
        if conn:
            await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing sale: {str(e)}")
    finally:
        if conn:
            await conn.close()
