from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import StoreCreate, StoreResponse, Staff
from models.stores import StoreStats, StoreWithOrders, StoreUpdate
from controllers.stores import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[StoreWithOrders])
async def get_stores(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    active_only: bool = True,
    category: Optional[str] = None,
    district: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return await get_all_stores(db, active_only, category, district, search, skip, limit)

@router.get("/stats", response_model=StoreStats)
async def get_stats(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_store_statistics(db)

@router.get("/categories")
async def get_categories(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_store_categories(db)

@router.get("/districts")
async def get_districts(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_store_districts(db)

@router.get("/{store_id}", response_model=StoreWithOrders)
async def get_store(
    store_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_store_by_id(db, store_id)

@router.post("", response_model=StoreResponse)
async def create_store(
    store_data: StoreCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await create_new_store(db, store_data)

@router.patch("/{store_id}", response_model=StoreResponse)
async def update_store(
    store_id: int,
    update: StoreUpdate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_store_controller(db, store_id, update)

@router.delete("/{store_id}")
async def delete_store(
    store_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await delete_store_controller(db, store_id)
