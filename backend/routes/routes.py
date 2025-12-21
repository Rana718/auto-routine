from datetime import date
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import RouteStatus, Staff
from models.routes import RouteWithDetails, RouteGenerate, StopUpdate
from controllers.routes import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[RouteWithDetails])
async def get_routes(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    route_date: Optional[date] = None,
    staff_id: Optional[int] = None,
    status: Optional[RouteStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    return await get_all_routes(db, route_date, staff_id, status, skip, limit)

@router.get("/{route_id}")
async def get_route(
    route_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_route_by_id(db, route_id)

@router.post("/generate")
async def generate_route(
    data: RouteGenerate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await generate_route_controller(db, data)

@router.post("/regenerate-all")
async def regenerate_all_routes(
    route_date: date = None,
    current_user: Annotated[Staff, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    return await regenerate_all_routes_controller(db, route_date)

@router.patch("/{route_id}/status")
async def update_route_status(
    route_id: int,
    status: RouteStatus,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_route_status_controller(db, route_id, status)

@router.patch("/{route_id}/stops/{stop_id}")
async def update_stop(
    route_id: int,
    stop_id: int,
    update: StopUpdate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_stop_controller(db, route_id, stop_id, update)

@router.post("/start-all")
async def start_all_routes(
    route_date: date = None,
    current_user: Annotated[Staff, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    return await start_all_routes_controller(db, route_date)
