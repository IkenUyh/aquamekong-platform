"""
Đánh giá độ chính xác dự báo (backtest trên số đo đã có). Backend gọi qua GET /api/v1/forecasts/accuracy.
"""

from fastapi import APIRouter, Query

from app.evaluation.accuracy import accuracy

router = APIRouter()


@router.get("/evaluation/accuracy")
def forecast_accuracy(days: int = Query(180, ge=30, le=365, description="Số ngày phát hành dự báo gần nhất đem ra đánh giá")):
    """Sai số trung bình theo số ngày dự báo trước, so với 'giữ nguyên số mới nhất', toàn vùng và từng trạm"""
    return accuracy(days)
