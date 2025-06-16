from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import List, Optional
import httpx
from decimal import Decimal
from datetime import datetime

# --- Database Connection Import ---
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from database import get_db_connection
except ImportError:
    print("ERROR: Could not import get_db_connection from database.py.")
    async def get_db_connection():
        raise NotImplementedError("Database connection not configured.")

# --- Scheme and Validation ---
oauth2_scheme_port4000 = OAuth2PasswordBearer(
    tokenUrl="http://localhost:4000/auth/token",
    scheme_name="OAuth2PasswordBearerPort4000"
)

async def validate_token_and_roles_port4000(
    token: str,
    allowed_roles: List[str]
):
    auth_url = "http://localhost:4000/auth/users/me"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(auth_url, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            error_detail = f"Auth service (4000) error: {e.response.text}"
            try:
                auth_error_json = e.response.json()
                if "detail" in auth_error_json:
                    error_detail = f"Auth service (4000) error: {auth_error_json['detail']}"
            except Exception:
                pass
            raise HTTPException(status_code=e.response.status_code, detail=error_detail)
        except httpx.RequestError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Could not connect to auth service (4000): {str(e)}")

    user_data = response.json()
    user_role = user_data.get("userRole")

    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied (4000). User does not have the required role."
        )
    return user_data

# --- Router for Discount Services ---
router_discounts = APIRouter(
    prefix="/discounts",
    tags=["discounts"]
)

# --- Models for Discounts ---
class DiscountBase(BaseModel):
    DiscountName: str
    ProductName: str
    PercentageValue: float = Field(gt=0, lt=100)
    MinimumSpend: Optional[float] = Field(None, ge=0)
    ValidFrom: datetime
    ValidTo: datetime
    Status: str = Field(..., min_length=1)
    username: str = Field(..., description="The username of the user associated with this discount.")

class DiscountCreate(DiscountBase):
    pass

class DiscountUpdate(DiscountBase):
    pass

class DiscountOut(BaseModel):
    DiscountID: int
    DiscountName: str
    ProductID: int
    ProductName: str
    PercentageValue: float
    MinimumSpend: Optional[float]
    ValidFrom: datetime
    ValidTo: datetime
    username: Optional[str] = None
    Status: str
    CreatedAt: datetime

class DiscountGet(DiscountOut):
    pass

# --- Simplified Dependency Functions ---
async def get_admin_or_manager(token: str = Depends(oauth2_scheme_port4000)) -> dict:
    return await validate_token_and_roles_port4000(token=token, allowed_roles=["admin", "manager"])

async def get_any_user(token: str = Depends(oauth2_scheme_port4000)) -> dict:
    return await validate_token_and_roles_port4000(token=token, allowed_roles=["admin", "manager", "staff"])

@router_discounts.post("/", response_model=DiscountOut, status_code=status.HTTP_201_CREATED)
async def create_discount(discount_data: DiscountCreate):
    conn = None
    try:
        conn = await get_db_connection()
        username_from_payload = discount_data.username

        async with conn.cursor() as cursor:
            # 1. Get ProductID based on ProductName
            await cursor.execute(
                "SELECT ProductID, ProductName FROM Products WHERE ProductName COLLATE Latin1_General_CI_AS = ?",
                discount_data.ProductName
            )
            product_row = await cursor.fetchone()
            if not product_row:
                raise HTTPException(status_code=404, detail=f"Product with name '{discount_data.ProductName}' not found.")

            found_product_id = product_row.ProductID
            actual_product_name = product_row.ProductName

            # 2. Check for duplicate DiscountName
            await cursor.execute(
                "SELECT 1 FROM Discounts WHERE DiscountName COLLATE Latin1_General_CI_AS = ?",
                discount_data.DiscountName
            )
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Discount name '{discount_data.DiscountName}' already exists.")

            # 3. Validate date range
            if discount_data.ValidFrom >= discount_data.ValidTo:
                raise HTTPException(status_code=400, detail="ValidFrom date must be before ValidTo date.")

            # 4. Insert the discount (with username instead of UserID)
            sql = """
                INSERT INTO Discounts (
                    DiscountName, ProductID, PercentageValue, MinimumSpend,
                    ValidFrom, ValidTo, username, Status, CreatedAt
                )
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETUTCDATE())
            """
            await cursor.execute(
                sql,
                discount_data.DiscountName,
                found_product_id,
                Decimal(str(discount_data.PercentageValue)),
                Decimal(str(discount_data.MinimumSpend)) if discount_data.MinimumSpend is not None else None,
                discount_data.ValidFrom,
                discount_data.ValidTo,
                username_from_payload,
                discount_data.Status
            )
            row = await cursor.fetchone()
            await conn.commit()

            return DiscountOut(
                DiscountID=row.DiscountID, DiscountName=row.DiscountName,
                ProductID=row.ProductID, ProductName=actual_product_name,
                PercentageValue=float(row.PercentageValue),
                MinimumSpend=float(row.MinimumSpend) if row.MinimumSpend is not None else None,
                ValidFrom=row.ValidFrom, ValidTo=row.ValidTo,
                username=row.username, Status=row.Status, CreatedAt=row.CreatedAt
            )
    except Exception as e:
        if conn:
            await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving discount: {e}")
    finally:
        if conn:
            await conn.close()


@router_discounts.get("/", response_model=List[DiscountGet])
async def get_all_discounts(current_user: dict = Depends(get_any_user)):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("""
                SELECT
                    d.DiscountID, d.DiscountName, d.ProductID, p.ProductName,
                    d.PercentageValue, d.MinimumSpend, d.ValidFrom, d.ValidTo,
                    d.username, d.Status, d.CreatedAt
                FROM Discounts d
                LEFT JOIN Products p ON d.ProductID = p.ProductID
                ORDER BY d.DiscountID DESC
            """)
            rows = await cursor.fetchall()
            return [
                DiscountGet(
                    DiscountID=row.DiscountID, DiscountName=row.DiscountName,
                    ProductID=row.ProductID, ProductName=row.ProductName,
                    PercentageValue=float(row.PercentageValue),
                    MinimumSpend=float(row.MinimumSpend) if row.MinimumSpend is not None else None,
                    ValidFrom=row.ValidFrom, ValidTo=row.ValidTo,
                    username=row.username, Status=row.Status, CreatedAt=row.CreatedAt
                ) for row in rows
            ]
    except Exception as e:
        print(f"ERROR in get_all_discounts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            await conn.close()

@router_discounts.get("/{discount_id}", response_model=DiscountGet)
async def get_discount_by_id(discount_id: int, current_user: dict = Depends(get_any_user)):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("""
                SELECT
                    d.DiscountID, d.DiscountName, d.ProductID, p.ProductName,
                    d.PercentageValue, d.MinimumSpend, d.ValidFrom, d.ValidTo,
                    d.username, d.Status, d.CreatedAt
                FROM Discounts d
                LEFT JOIN Products p ON d.ProductID = p.ProductID
                WHERE d.DiscountID = ?
            """, discount_id)
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Discount ID {discount_id} not found.")
            return DiscountGet(
                DiscountID=row.DiscountID, DiscountName=row.DiscountName,
                ProductID=row.ProductID, ProductName=row.ProductName,
                PercentageValue=float(row.PercentageValue),
                MinimumSpend=float(row.MinimumSpend) if row.MinimumSpend is not None else None,
                ValidFrom=row.ValidFrom, ValidTo=row.ValidTo,
                username=row.username, Status=row.Status, CreatedAt=row.CreatedAt
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in get_discount_by_id: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            await conn.close()

@router_discounts.put("/{discount_id}", response_model=DiscountOut)
async def update_discount(
    discount_id: int,
    discount_data: DiscountUpdate,
    current_user_from_token: dict = Depends(get_admin_or_manager)
):
    conn = None
    try:
        conn = await get_db_connection()
        username_from_payload = discount_data.username

        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM Discounts WHERE DiscountID = ?", discount_id)
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Discount ID {discount_id} not found for update.")
            
            await cursor.execute("SELECT ProductID, ProductName FROM Products WHERE ProductName COLLATE Latin1_General_CI_AS = ?", discount_data.ProductName)
            product_row = await cursor.fetchone()
            if not product_row:
                raise HTTPException(status_code=404, detail=f"Product with name '{discount_data.ProductName}' not found for update.")
            found_product_id = product_row.ProductID

            await cursor.execute("SELECT 1 FROM Discounts WHERE DiscountName COLLATE Latin1_General_CI_AS = ? AND DiscountID != ?", discount_data.DiscountName, discount_id)
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Discount name '{discount_data.DiscountName}' already exists for another discount.")

            if discount_data.ValidFrom >= discount_data.ValidTo:
                raise HTTPException(status_code=400, detail="ValidFrom date must be before ValidTo date.")

            sql = """
                UPDATE Discounts SET DiscountName = ?, ProductID = ?, PercentageValue = ?, MinimumSpend = ?, ValidFrom = ?, ValidTo = ?, username = ?, Status = ?
                WHERE DiscountID = ?
            """
            await cursor.execute(
                sql,
                discount_data.DiscountName, found_product_id,
                Decimal(str(discount_data.PercentageValue)),
                Decimal(str(discount_data.MinimumSpend)) if discount_data.MinimumSpend is not None else None,
                discount_data.ValidFrom, discount_data.ValidTo,
                username_from_payload, discount_data.Status,
                discount_id
            )
            await conn.commit()
            return await get_discount_by_id(discount_id, current_user_from_token)
    except HTTPException:
        raise
    except Exception as e:
        if conn: await conn.rollback()
        print(f"ERROR in update_discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            await conn.close()

@router_discounts.delete("/{discount_id}", status_code=status.HTTP_200_OK)
async def delete_discount(discount_id: int, current_user: dict = Depends(get_admin_or_manager)):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM Discounts WHERE DiscountID = ?", discount_id)
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Discount ID {discount_id} not found.")

            await cursor.execute("DELETE FROM Discounts WHERE DiscountID = ?", discount_id)
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Discount could not be deleted.")
            await conn.commit()
            return {"message": f"Discount ID {discount_id} deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        if conn: await conn.rollback()
        print(f"ERROR in delete_discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            await conn.close()
