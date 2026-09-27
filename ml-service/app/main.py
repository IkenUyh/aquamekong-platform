from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import forecast
from app.config import get_settings
from app.pipeline.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="AquaMekong ML Service",
    description="AI/ML Salinity Forecasting Service for Mekong Delta Hydrology",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(forecast.router, prefix="/api/v1", tags=["Forecast"])


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "aquamekong-ml-service",
        "version": "1.0.0",
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "service": "AquaMekong ML Service",
        "docs": "/docs",
        "health": "/health",
    }
