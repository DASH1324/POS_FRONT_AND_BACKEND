# port 9001 (e.g., in a file like routers/product_type_pos_router.py)
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import httpx
from pydantic import BaseModel
from database import get_db_connection 

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8000/auth/token")

router = APIRouter()

# --- Pydantic Model for Port 9001 ---
class ProductTypeCreateRequest(BaseModel):
    productTypeName: str
    SizeRequired: int

@router.post("/create")
async def create_product_type(
    request: ProductTypeCreateRequest,  
    token: str = Depends(oauth2_scheme)  
):
    print(f"Service 9001 received token (first 10 chars): {token[:10]}...")
    print(f"Service 9001 received request payload: {request.model_dump_json()}") 

    # --- Token Validation ---
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/auth/users/me", 
            headers={"Authorization": f"Bearer {token}"}
        )

    print(f"Service 9001 Auth Service Response Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Service 9001 Auth Service Response Body: {response.text}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token (checked by 9001)")

    user_data = response.json()
    print(f"Service 9001 Auth User Data: {user_data}")

    if user_data.get('userRole') != 'admin': 
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied (user role insufficient, checked by 9001)")

    # --- Database Operations for Service 9001 ---
    conn = await get_db_connection() 
    cursor = await conn.cursor()
    new_pos_product_type_id = None

    try:
        # Check if product type already exists in 9001's DB (by name)
        await cursor.execute(
            "SELECT 1 FROM ProductType WHERE productTypeName COLLATE Latin1_General_CI_AS = ?", 
            (request.productTypeName,)
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Product type '{request.productTypeName}' already exists in secondary service (9001)")

        
        sql_insert_9001 = """
        INSERT INTO ProductType (productTypeName, SizeRequired)
        OUTPUT INSERTED.productTypeID 
        VALUES (?, ?);
        """
        await cursor.execute(
            sql_insert_9001, 
            (request.productTypeName, request.SizeRequired) 
        )
        
        id_row = await cursor.fetchone() 
        if id_row and id_row[0] is not None:
            new_pos_product_type_id = int(id_row[0])
        else:
           
            await conn.rollback()
            print(f"Service 9001: Failed to retrieve ID after insert using OUTPUT. id_row: {id_row}")
            raise HTTPException(status_code=500, detail="Failed to retrieve ID after insert in secondary service (9001). Check ProductType table definition if ID retrieval is expected.")


        await conn.commit()
        print(f"Product type '{request.productTypeName}' (ID: {new_pos_product_type_id}, SizeRequired: {request.SizeRequired}) created successfully in secondary service (9001)")
    
    except HTTPException as http_exc: 
    
        raise http_exc
    except Exception as e:
        try:
            await conn.rollback() 
        except Exception as rb_exc:
            print(f"Service 9001: Rollback failed during general exception: {rb_exc}")
        print(f"Error saving to secondary service (9001) DB: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save to secondary DB (9001): {str(e)}")
    finally:
        if cursor:
            await cursor.close()
        if conn:
            await conn.close()

    return {"message": "Product type created successfully in secondary service (9001)"}
