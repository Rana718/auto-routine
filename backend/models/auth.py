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

class UpdateEmailRequest(BaseModel):
    new_email: EmailStr
    password: str  # Require password confirmation for security

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    staff_id: int
    staff_name: str
    email: str
    role: str
    status: str
