"""
Forecast API Router — Endpoints for salinity prediction and model training.
"""

import logging
from datetime import datetime, timezone
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

logger = logging.getLogger(__name__)
router = APIRouter()
model = predictor.prophet


@router.post("/predict", response_model=PredictionResponse)
def predict_salinity(request: PredictionRequest):
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
            data_end=predictions[0].data_end if predictions else None,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/train", response_model=TrainResponse)
def train_model(request: TrainRequest):
    """
    Train (or retrain) a Prophet model for a specific station.

    Loads historical data and fits a new Prophet model.
    """
    try:
        # Verify station exists
        try:
            load_station_info(request.station_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

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

        # Train model, rồi xoá cache để /predict dùng model mới ngay
        metrics = model.train(request.station_id, df)
        predictor.invalidate(request.station_id)

        return TrainResponse(
            station_id=request.station_id,
            model_version="prophet-v1.0",
            metrics=metrics,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.get("/models", response_model=List[ModelInfo])
def list_models():
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
                    created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                )
            )

    return models


@router.get("/models/stgnn")
def stgnn_model_info():
    """Thông tin ST-GNN đã cài: trạm, ngày dữ liệu cuối lúc train, điểm trên tập test (không kèm scaler)."""
    from app.stgnn.forecaster import forecaster as stgnn_forecaster

    meta = stgnn_forecaster.meta()
    if not meta:
        raise HTTPException(status_code=404, detail="Chưa cài ST-GNN (python -m app.stgnn.install <thư mục weights>)")
    evaluation = {
        key: {k: ev[k] for k in ("overall", "interval_coverage", "exceed_recall", "exceed_precision", "test_days")}
        for key, ev in meta["evaluation"].items()
    }
    return {
        "model_version": meta["model_version"],
        "installed_at": meta["installed_at"],
        "trained_until": meta["trained_until"],
        "horizons": meta["horizons"],
        "stations": [code for code in meta["stations"] if stgnn_forecaster.eligible(meta, code)],
        "all_stations": meta["stations"],
        "evaluation": evaluation,
    }
