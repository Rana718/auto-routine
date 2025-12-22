from datetime import datetime, timedelta
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib
import base64
import json

from config.env import settings
from db.db import get_db
from db.schema import Staff

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_token(staff_id: int) -> str:
    payload = {
        "staff_id": staff_id,
        "exp": (datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)).isoformat()
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> Staff:
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
