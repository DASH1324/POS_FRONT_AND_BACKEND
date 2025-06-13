from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging
from pathlib import Path 


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


try:
    from routers import ProductType, products
except ImportError as e:
    logger.error(f"Could not import routers. Ensure 'routers' directory is in PYTHONPATH or structured correctly: {e}")
    ProductType = None 
    products = None


app = FastAPI(title="POS API", version="1.0.0")


BASE_DIR = Path(__file__).resolve().parent 


POS_SPECIFIC_STATIC_ROOT_DIR = BASE_DIR / "pos_static_files"


POS_DOWNLOADED_IMAGES_PHYSICAL_SUBDIR = POS_SPECIFIC_STATIC_ROOT_DIR / "pos_product_images"

# Ensure the directory for POS downloaded images exists.
if not POS_DOWNLOADED_IMAGES_PHYSICAL_SUBDIR.exists():
    try:
        POS_DOWNLOADED_IMAGES_PHYSICAL_SUBDIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created POS image directory: {POS_DOWNLOADED_IMAGES_PHYSICAL_SUBDIR}")
    except OSError as e:
        logger.error(f"Error creating POS image directory {POS_DOWNLOADED_IMAGES_PHYSICAL_SUBDIR}: {e}")
        
try:
    app.mount(
        "/static",  
        StaticFiles(directory=POS_SPECIFIC_STATIC_ROOT_DIR),
        name="pos_specific_static_assets"
    )
    logger.info(f"Mounted POS-specific static files from {POS_SPECIFIC_STATIC_ROOT_DIR} at /static")
except RuntimeError as e:
    logger.error(f"Failed to mount POS-specific static files: {e}. Check if directory '{POS_SPECIFIC_STATIC_ROOT_DIR}' exists and is accessible.")


# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",     
        "http://192.168.100.32:4000", 
        "http://127.0.0.1:9000",      
        "http://localhost:9000",       
        "http://localhost:8000",       
        "http://127.0.0.1:8000",  
             "http://127.0.0.1:8001",
                     "http://localhost:8001",       

                       
        "http://localhost:9001",      
        "http://127.0.0.1:9001"       
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if products:
    app.include_router(products.router)
    logger.info(f"Included 'products' router with its internal prefix: {products.router.prefix}")
else:
    logger.warning("'products' router not loaded.")

if ProductType:
    app.include_router(ProductType.router)
    logger.info(f"Included 'ProductType' router with its internal prefix: {ProductType.router.prefix}")
else:
    logger.warning("'ProductType' router not loaded.")

logger.info("FastAPI application configured and routers included.")

@app.get("/")
async def read_root():
    return {"message": "Welcome to the POS API. POS-specific static files are served from /static."}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server for POS API on http://127.0.0.1:9001")
    uvicorn.run("main:app", host="127.0.0.1", port=9001, reload=True)