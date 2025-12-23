from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import chat
from app.routes import auth_guard

app = FastAPI(
    title="Jetayu",
    description="Luxury Private Jet Concierge API",
    version="1.0.0",
)

# Test Resend connection on startup
@app.on_event("startup")
async def startup_event():
    """Run startup checks including Resend API test."""
    from app.services.email_service import test_resend_connection, get_email_service
    
    print("\n" + "="*60)
    print("🔍 Testing Resend API connection...")
    print("="*60)
    
    # Initialize EmailService to trigger API key verification logging
    email_service = get_email_service()
    
    # Run connection test
    test_resend_connection()
    print("="*60 + "\n")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(chat.router, tags=["Chat"])
app.include_router(auth_guard.router, tags=["Auth"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "jetayu"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.HOST, port=settings.PORT)

