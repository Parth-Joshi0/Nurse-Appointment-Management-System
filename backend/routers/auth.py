"""
Authentication router.

Handles user authentication for nurse login.
Uses JWT tokens and bcrypt password hashing.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

from models.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from services.supabase_client import get_supabase_client

router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Data to encode in the token (user_id, email, role)
        expires_delta: Optional custom expiration time

    Returns:
        JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user_from_token(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Decode JWT token and get current user.

    Args:
        token: JWT token from Authorization header

    Returns:
        User dict from database

    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_supabase_client()
    from uuid import UUID
    user = await db.get_user(UUID(user_id))

    if user is None:
        raise credentials_exception

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate):
    """
    Register a new user (nurse/coordinator/admin).

    Hashes password and stores user in database.
    """
    db = get_supabase_client()

    # Check if user already exists
    existing = await db.get_user_by_email(user.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    password_hash = get_password_hash(user.password)

    # Create user record
    user_data = {
        "email": user.email,
        "password_hash": password_hash,
        "role": user.role.value,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": True
    }

    created_user = await db.create_user(user_data)

    if not created_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

    return created_user


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate user and return JWT token.

    Uses OAuth2 password flow (username/password in form data).
    Username field should contain the email address.
    """
    db = get_supabase_client()

    # Get user by email (username field contains email)
    user = await db.get_user_by_email(form_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Update last login
    from uuid import UUID
    await db.update_user_last_login(UUID(user["id"]))

    # Create access token
    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={
            "sub": user["id"],
            "email": user["email"],
            "role": user["role"]
        },
        expires_delta=access_token_expires
    )

    # Return token with user info
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600,  # in seconds
        "user": user
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: dict = Depends(get_current_user_from_token)):
    """
    Get current authenticated user.

    Requires valid JWT token in Authorization header.
    """
    return current_user


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user_from_token)):
    """
    Logout user.

    With JWT tokens, logout is handled client-side by removing the token.
    This endpoint is here for compatibility but doesn't need to do anything.
    """
    return {"message": "Logged out successfully"}


# Helper function for route dependencies
def get_current_active_user(current_user: dict = Depends(get_current_user_from_token)) -> dict:
    """
    Dependency to get current authenticated and active user.

    Usage in protected routes:
        @router.get("/protected")
        async def protected_route(user: dict = Depends(get_current_active_user)):
            return {"user_id": user["id"]}
    """
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user
