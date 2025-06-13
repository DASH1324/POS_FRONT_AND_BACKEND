from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os


# Routers
from routers import auth, employee_accounts

app = FastAPI()


# Include routers
app.include_router(auth.router, prefix='/auth', tags=['auth'])
app.include_router(employee_accounts.router, prefix='/employee-accounts', tags=['employee-accounts'])


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",  # React frontend
        "http://192.168.100.32:4000",  # React frontend (local network)
        "http://127.0.0.1:9001",  
        "http://127.0.0.1:9002",  

    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_DIR_NAME = "uploads" 
os.makedirs(UPLOAD_DIR_NAME, exist_ok=True) 
app.mount(f"/{UPLOAD_DIR_NAME}", StaticFiles(directory=UPLOAD_DIR_NAME), name=UPLOAD_DIR_NAME)

# Run app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=9000, host="127.0.0.1", reload=True)
