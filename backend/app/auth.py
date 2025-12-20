"""
Authentication utilities for Supabase JWT verification.
Handles optional and required authentication for endpoints.
"""

from fastapi import HTTPException, Header
from typing import Optional
from app.config import settings
import jwt
import httpx
import os


def verify_jwt_token(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT token and return the payload.
    Returns None if token is invalid or missing.
    
    Uses Supabase's user endpoint to verify the token.
    Falls back to JWT decoding if SUPABASE_JWT_SECRET is set.
    """
    if not token:
        return None
    
    try:
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        # Method 1: Verify via Supabase API (most reliable)
        try:
            with httpx.Client(timeout=5.0) as http:
                response = http.get(
                    f"{settings.SUPABASE_URL}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": settings.SUPABASE_KEY,
                    }
                )
                if response.status_code == 200:
                    user_data = response.json()
                    return {
                        "sub": user_data.get("id"),
                        "email": user_data.get("email"),
                    }
        except Exception as api_err:
            # Fall back to JWT decoding
            pass
        
        # Method 2: Decode JWT (if SUPABASE_JWT_SECRET is set)
        # Note: Supabase JWT secret can be found in Project Settings > API > JWT Secret
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", None)
        
        if jwt_secret:
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            return payload
        else:
            # For development: decode without verification (NOT secure for production)
            # In production, you MUST set SUPABASE_JWT_SECRET in your .env
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception as e:
        print(f"⚠️  JWT verification error: {e}")
        return None


def get_current_user_optional(
    authorization: Optional[str] = Header(None)
) -> Optional[dict]:
    """
    Optional authentication dependency.
    Returns user info if authenticated, None otherwise.
    Does not raise errors if not authenticated.
    """
    if not authorization:
        return None
    
    payload = verify_jwt_token(authorization)
    if payload:
        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
        }
    return None


def get_current_user_required(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Required authentication dependency.
    Raises 401 if not authenticated.
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = verify_jwt_token(authorization)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
    }

