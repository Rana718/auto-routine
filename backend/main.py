from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.env import settings
from routes import orders, staff, stores, routes as routes_router, settings as settings_router, auth, automation, admin, purchase, products, holidays, notifications
from middlewares.logging import log_requests

app = FastAPI(
    title="買付フロー - Procurement Management System",
    version="1.0.0",
    description="注文から店舗選定、スタッフ割当、ルート生成まで、大規模物理調達を迅速かつ正確に自動化",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(log_requests)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
    }

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(staff.router, prefix="/api/staff", tags=["Staff"])
app.include_router(stores.router, prefix="/api/stores", tags=["Stores"])
app.include_router(routes_router.router, prefix="/api/routes", tags=["Routes"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(automation.router, prefix="/api/automation", tags=["Automation"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(purchase.router, prefix="/api/purchase", tags=["Purchase"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(holidays.router, prefix="/api/holidays", tags=["Holidays"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
