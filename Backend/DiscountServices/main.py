# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os


from routers import discount


app = FastAPI(
    title="My POS System API",
    description="API for managing POS operations including discounts, products, etc.",
    version="1.0.0"
)





app.include_router(discount.router_discounts)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4001",     
        "http://192.168.100.32:4001", 
        "http://localhost:9000",      
        "http://localhost:9001",
        "http://localhost:4000",     
        "http://192.168.100.32:4000",       
  
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR_NAME = "uploads" 
os.makedirs(UPLOAD_DIR_NAME, exist_ok=True)
app.mount(f"/{UPLOAD_DIR_NAME}", StaticFiles(directory=UPLOAD_DIR_NAME), name=UPLOAD_DIR_NAME)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the POS System API. Visit /docs for API documentation."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=9002, host="127.0.0.1", reload=True)