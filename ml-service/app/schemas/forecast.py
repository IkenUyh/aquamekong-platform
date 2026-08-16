from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


class PredictionRequest(BaseModel):
    """Request body for salinity prediction."""
    station_id: int = Field(..., description="ID of the station to predict for")
    days_ahead: int = Field(default=7, ge=1, le=30, description="Number of days to forecast")


class PredictionItem(BaseModel):
    """Single prediction result."""
    date: date
    salinity: float = Field(..., description="Predicted salinity (‰)")
    confidence: Optional[float] = Field(None, description="Confidence level (0-1)")
    lower_bound: Optional[float] = Field(None, description="Lower bound of confidence interval")
    upper_bound: Optional[float] = Field(None, description="Upper bound of confidence interval")
    model_version: str = "prophet-v1.0"


class PredictionResponse(BaseModel):
    """Response containing predictions."""
    station_id: int
    predictions: List[PredictionItem]
    model_version: str = "prophet-v1.0"
    status: str = "success"


class TrainRequest(BaseModel):
    """Request body for model training."""
    station_id: int
    lookback_days: int = Field(default=90, ge=30, description="Number of historical days to use for training")


class TrainResponse(BaseModel):
    """Response after training a model."""
    station_id: int
    model_version: str
    metrics: dict
    status: str = "success"


class ModelInfo(BaseModel):
    """Information about a trained model."""
    station_id: int
    model_version: str
    accuracy: Optional[float] = None
    created_at: Optional[str] = None
