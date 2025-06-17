from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
# Import the new Pydantic V2 decorators
from pydantic import BaseModel, Field, field_validator, model_validator
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

# --- Router and Auth (Left as is) ---
router_discounts = APIRouter(prefix="/discounts", tags=["discounts"])
oauth2_scheme_port4000 = OAuth2PasswordBearer(tokenUrl="http://localhost:4000/auth/token")

async def validate_token_and_roles_port4000(token: str, allowed_roles: List[str]):
    auth_url = "http://localhost:4000/auth/users/me"
    async with httpx.AsyncClient() as client:
        response = await client.get(auth_url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
    user_data = response.json()
    if user_data.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return user_data

async def get_admin_or_manager(token: str = Depends(oauth2_scheme_port4000)) -> dict:
    return await validate_token_and_roles_port4000(token=token, allowed_roles=["admin", "manager", "cashier"])

async def get_any_user(token: str = Depends(oauth2_scheme_port4000)) -> dict:
    return await validate_token_and_roles_port4000(token=token, allowed_roles=["admin", "manager", "cashier"])

# --- CORRECTED Pydantic Models for Discounts (Using Pydantic V2 Syntax) ---

class DiscountBase(BaseModel):
    DiscountName: str
    Description: Optional[str] = None
    ProductName: Optional[str] = None
    DiscountType: str # 'Percentage' or 'Fixed'
    PercentageValue: Optional[Decimal] = Field(None, gt=0, lt=100)
    FixedValue: Optional[Decimal] = Field(None, ge=0)
    MinimumSpend: Optional[Decimal] = Field(None, ge=0)
    ValidFrom: datetime
    ValidTo: datetime
    Status: str
    
    # Use the new @field_validator for single-field validation
    @field_validator('DiscountType')
    def discount_type_must_be_valid(cls, v: str) -> str:
        if v not in ['Percentage', 'Fixed']:
            raise ValueError("DiscountType must be either 'Percentage' or 'Fixed'")
        return v
        
    # Use the new @model_validator for cross-field validation
    @model_validator(mode='after')
    def check_dates_and_conditional_values(self) -> 'DiscountBase':
        # 1. Check date range
        if self.ValidFrom and self.ValidTo and self.ValidTo <= self.ValidFrom:
            raise ValueError('ValidTo date must be after ValidFrom date')

        # 2. Check conditional fields based on DiscountType
        if self.DiscountType == 'Percentage' and self.PercentageValue is None:
            raise ValueError('PercentageValue is required for Percentage type discounts')
        
        if self.DiscountType == 'Fixed' and self.FixedValue is None:
            raise ValueError('FixedValue is required for Fixed type discounts')
        
        return self

class DiscountCreate(DiscountBase):
    pass

class DiscountUpdate(DiscountBase):
    pass

class DiscountOut(BaseModel):
    DiscountID: int
    DiscountName: str
    Description: Optional[str]
    ProductName: Optional[str]
    DiscountType: str
    PercentageValue: Optional[Decimal]
    FixedValue: Optional[Decimal]
    MinimumSpend: Optional[Decimal]
    ValidFrom: datetime
    ValidTo: datetime
    Username: str 
    Status: str
    CreatedAt: datetime
    
    class Config:
        from_attributes = True # Pydantic V2 uses from_attributes instead of orm_mode

# --- CRUD Endpoints (Largely unchanged, but will now work with the corrected models) ---

@router_discounts.post("/", response_model=DiscountOut, status_code=status.HTTP_201_CREATED)
async def create_discount(discount_data: DiscountCreate, current_user: dict = Depends(get_admin_or_manager)):
    conn = None
    username = current_user.get("username", "unknown")
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM Discounts WHERE DiscountName = ?", discount_data.DiscountName)
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Discount name '{discount_data.DiscountName}' already exists.")

            sql = """
                INSERT INTO Discounts (
                    DiscountName, Description, ProductName, DiscountType, PercentageValue, FixedValue,
                    MinimumSpend, ValidFrom, ValidTo, Username, Status
                )
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            await cursor.execute(
                sql,
                discount_data.DiscountName, discount_data.Description, discount_data.ProductName,
                discount_data.DiscountType, discount_data.PercentageValue, discount_data.FixedValue,
                discount_data.MinimumSpend, discount_data.ValidFrom, discount_data.ValidTo,
                username, discount_data.Status
            )
            row = await cursor.fetchone()
            await conn.commit()
            return row
    except ValueError as ve: # Catch validation errors from the model
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        if conn: await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating discount: {e}")
    finally:
        if conn: await conn.close()

@router_discounts.get("/", response_model=List[DiscountOut])
async def get_all_discounts(active_only: bool = False, current_user: dict = Depends(get_any_user)):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            sql = "SELECT * FROM Discounts"
            if active_only:
                sql += " WHERE Status = 'Active' AND GETUTCDATE() BETWEEN ValidFrom AND ValidTo"
            sql += " ORDER BY DiscountID DESC"
            
            await cursor.execute(sql)
            rows = await cursor.fetchall()
            return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching discounts: {e}")
    finally:
        if conn: await conn.close()
        
@router_discounts.get("/{discount_id}", response_model=DiscountOut)
async def get_discount_by_id(discount_id: int, current_user: dict = Depends(get_any_user)):
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT * FROM Discounts WHERE DiscountID = ?", discount_id)
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Discount ID {discount_id} not found.")
            return row
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching discount: {e}")
    finally:
        if conn: await conn.close()

@router_discounts.put("/{discount_id}", response_model=DiscountOut)
async def update_discount(discount_id: int, discount_data: DiscountUpdate, current_user: dict = Depends(get_admin_or_manager)):
    conn = None
    username = current_user.get("username", "unknown")
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM Discounts WHERE DiscountID = ?", discount_id)
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Discount ID {discount_id} not found.")

            sql = """
                UPDATE Discounts SET
                    DiscountName = ?, Description = ?, ProductName = ?, DiscountType = ?,
                    PercentageValue = ?, FixedValue = ?, MinimumSpend = ?, ValidFrom = ?,
                    ValidTo = ?, Username = ?, Status = ?
                WHERE DiscountID = ?
            """
            await cursor.execute(
                sql,
                discount_data.DiscountName, discount_data.Description, discount_data.ProductName,
                discount_data.DiscountType, discount_data.PercentageValue, discount_data.FixedValue,
                discount_data.MinimumSpend, discount_data.ValidFrom, discount_data.ValidTo,
                username, discount_data.Status, discount_id
            )
            await conn.commit()
            
            # Fetch and return the updated row
            # We can reuse the get_discount_by_id function here
            return await get_discount_by_id(discount_id, current_user)
    except ValueError as ve: # Catch validation errors from the model
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        if conn: await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating discount: {e}")
    finally:
        if conn: await conn.close()