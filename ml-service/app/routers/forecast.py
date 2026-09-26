"""
Forecast API Router — Endpoints for salinity prediction and model training.
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException
from app.schemas.forecast import (
    PredictionRequest,
    PredictionResponse,
    TrainRequest,
    TrainResponse,
    ModelInfo,
)
from app.services.predictor import predictor
from app.services.data_loader import load_station_metrics, load_station_info
from app.models.salinity_model import SalinityModel

logger = logging.getLogger(__name__)
router = APIRouter()
model = SalinityModel()


@router.post("/predict", response_model=PredictionResponse)
async def predict_salinity(request: PredictionRequest):
    """
    Predict salinity levels for a station.

    Uses trained Prophet model if available, otherwise falls back
    to statistical estimation or simulation.
    """
    try:
        predictions = predictor.predict(
            station_id=request.station_id,
            days_ahead=request.days_ahead,
        )

        return PredictionResponse(
            station_id=request.station_id,
            predictions=predictions,
            model_version=predictions[0].model_version if predictions else "unknown",
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest):
    """
    Train (or retrain) a Prophet model for a specific station.

    Loads historical data and fits a new Prophet model.
    """
    try:
        # Verify station exists
        station_info = load_station_info(request.station_id)

        # Load training data
        df = load_station_metrics(
            station_id=request.station_id,
            lookback_days=request.lookback_days,
        )

        if df.empty or len(df) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for training. Need at least 10 data points, got {len(df)}",
            )

        # Train model
        metrics = model.train(request.station_id, df)

        return TrainResponse(
            station_id=request.station_id,
            model_version="prophet-v1.0",
            metrics=metrics,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all trained models."""
    from pathlib import Path
    import os

    model_dir = Path(model.model_dir)
    models = []

    if model_dir.exists():
        for f in model_dir.glob("station_*_prophet.pkl"):
            station_id = int(f.stem.split("_")[1])
            stat = os.stat(f)
            models.append(
                ModelInfo(
                    station_id=station_id,
                    model_version="prophet-v1.0",
                    created_at=str(stat.st_mtime),
                )
            )

    return models
