from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import pos_router  # Ensure this import is correct

app = FastAPI()

# Include routers
app.include_router(pos_router.router_sales, prefix='/auth', tags=['auth'])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4001",  # React frontend
        "http://192.168.100.32:4001",  # React frontend (local network)
        "http://localhost:4000",
        "http://127.0.0.1:4000", 
        "http://192.168.100.14:4002", # ums frontend
        "http://localhost:4002",
          "http://192.168.100.14:8002", # ums frontend
        "http://localhost:8002",  # ums frontend    
        "http://192.168.100.14:8003", # ums frontend
        "http://localhost:8003",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Run app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=9000, host="127.0.0.1", reload=True)
