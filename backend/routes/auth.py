"""
Authentication routes
"""
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib

from config.env import settings
from db.db import get_db
from db.schema import Staff, StaffRole, StaffStatus

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ============================================================================
# SCHEMAS
# ============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    staff_id: int
    staff_name: str
    email: str
    role: StaffRole
    status: StaffStatus


# ============================================================================
# HELPERS
# ============================================================================

def hash_password(password: str) -> str:
    """Simple password hashing (use bcrypt in production)"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def create_token(staff_id: int) -> str:
    """Create a simple token (use JWT in production)"""
    import base64
    import json
    payload = {
        "staff_id": staff_id,
        "exp": (datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)).isoformat()
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> Staff:
    """Get current user from token"""
    import base64
    import json
    
    try:
        payload = json.loads(base64.b64decode(token))
        staff_id = payload.get("staff_id")
        exp = datetime.fromisoformat(payload.get("exp"))
        
        if datetime.utcnow() > exp:
            raise HTTPException(status_code=401, detail="Token expired")
        
        result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================================
# ROUTES
# ============================================================================

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password"""
    result = await db.execute(
        select(Staff).where(Staff.email == form_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    
    token = create_token(user.staff_id)
    
    return TokenResponse(
        access_token=token,
        user={
            "staff_id": user.staff_id,
            "staff_name": user.staff_name,
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
        }
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    # Check if email exists
    result = await db.execute(
        select(Staff).where(Staff.email == request.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています",
        )
    
    # Create user
    user = Staff(
        staff_name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
        role=StaffRole.BUYER,
        status=StaffStatus.OFF_DUTY,
        is_active=True,
    )
    
    db.add(user)
    await db.flush()
    await db.refresh(user)
    
    return UserResponse(
        staff_id=user.staff_id,
        staff_name=user.staff_name,
        email=user.email,
        role=user.role,
        status=user.status,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[Staff, Depends(get_current_user)]
):
    """Get current user info"""
    return UserResponse(
        staff_id=current_user.staff_id,
        staff_name=current_user.staff_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
    )
