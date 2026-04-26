from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.security import get_current_user, require_role

router = APIRouter(prefix="/users", tags=["users"])


# ── Request / Response models ──────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(default="viewer", pattern=r"^(admin|editor|viewer)$")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern=r"^(admin|editor|viewer)$")


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PagedUsers(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


# ── Dependencies ───────────────────────────────────────────────────────────────

CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_role("admin"))]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=PagedUsers)
async def list_users(
    db: DB,
    _current: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=100),
):
    """Return a paginated list of users. Optionally filter by name or email."""
    from app.services.user_service import UserService

    service = UserService(db)
    result = await service.list_users(page=page, page_size=page_size, search=search)
    return result


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: DB, _current: CurrentUser):
    """Fetch a single user by ID."""
    from app.services.user_service import UserService

    user = await UserService(db).get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: DB, _admin: AdminUser):
    """Create a new user. Requires admin role."""
    from app.services.user_service import UserService

    service = UserService(db)
    existing = await service.get_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email already exists",
        )
    return await service.create_user(body)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, body: UserUpdate, db: DB, current: CurrentUser):
    """Update user fields. Users can update themselves; admins can update anyone."""
    from app.services.user_service import UserService

    if current.id != user_id and current.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    service = UserService(db)
    updated = await service.update_user(user_id, body)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: DB, _admin: AdminUser):
    """Delete a user. Requires admin role."""
    from app.services.user_service import UserService

    deleted = await UserService(db).delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
