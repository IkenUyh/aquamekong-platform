"""
Đánh giá độ chính xác dự báo (backtest trên số đo đã có). Backend gọi qua GET /api/v1/forecasts/accuracy,
/api/v1/forecasts/early-warning và trang Phát lại.
"""

from datetime import date
from typing import Dict

from fastapi import APIRouter, HTTPException, Query

from app.early_warning.service import early_warning
from app.evaluation.accuracy import accuracy

router = APIRouter()


@router.get("/evaluation/accuracy")
def forecast_accuracy(days: int = Query(180, ge=30, le=365, description="Số ngày phát hành dự báo gần nhất đem ra đánh giá")):
    """Sai số trung bình theo số ngày dự báo trước, so với 'giữ nguyên số mới nhất', toàn vùng và từng trạm"""
    return accuracy(days)


@router.get("/evaluation/early-warning")
def early_warning_evaluation():
    """Cảnh báo sớm trên từng mùa khô cũ: báo trước được bao nhiêu lần vượt ngưỡng, bao nhiêu lần báo nhầm"""
    result = early_warning.evaluation()
    if result is None:
        raise HTTPException(status_code=404, detail="Mô hình cảnh báo sớm chưa học xong lần đầu")
    return result


def _parse_thresholds(raw: str) -> Dict[int, float]:
    try:
        pairs = (item.split(":") for item in raw.split(",") if item.strip())
        return {int(sid): float(value) for sid, value in pairs}
    except ValueError:
        raise HTTPException(status_code=400, detail="thresholds có dạng <id trạm>:<ngưỡng>,...")


@router.get("/evaluation/early-warning/episodes")
def early_warning_episodes(
    from_: date = Query(..., alias="from"),
    to: date = Query(...),
    thresholds: str = Query(..., description="Ngưỡng của từng trạm, dạng 87:4,88:4.5"),
):
    """Cảnh báo sớm lẽ ra app đã gửi trong khoảng ngày (chạy lại trên mùa khô cũ), cho trang Phát lại"""
    if from_ > to:
        raise HTTPException(status_code=400, detail="Ngày bắt đầu phải trước ngày kết thúc")
    return early_warning.replay_episodes(from_, to, _parse_thresholds(thresholds))
