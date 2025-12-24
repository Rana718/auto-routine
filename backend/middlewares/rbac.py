from functools import wraps
from fastapi import HTTPException, status
from db.schema import Staff, StaffRole

def require_role(*allowed_roles: StaffRole):
    """Decorator to require specific roles for endpoints"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find current_user in kwargs
            current_user = kwargs.get('current_user')
            if not current_user or not isinstance(current_user, Staff):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="認証が必要です"
                )
            
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="この操作を実行する権限がありません"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
