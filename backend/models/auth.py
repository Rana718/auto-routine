from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class CreateAdminRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    secret_key: str

class UserResponse(BaseModel):
    staff_id: int
    staff_name: str
    email: str
    role: str
    status: str
