"""
Mô phỏng cách app báo người theo dõi trạm (backend StationWatchService + StationWatchJob), để chấm cảnh báo sớm
đúng như người dùng nhận được, không chấm từng con số rời rạc.

Mỗi sáng ngày D (dự báo phát hành D, số mới nhất là của ngày D-1), trạng thái "vượt" của trạm với ngưỡng T là:
số mới nhất > T, hoặc còn ngày có thể vượt chưa qua. Ngày có thể vượt là ngày trong 7 ngày tới có mức có thể lên tới > T;
đã báo một ngày thì giữ tới hết ngày đó, dù dự báo sáng sau không còn thấy (nếu không, mức rủi ro lên xuống từng ngày
làm app báo "đã giảm" ngay trước khi mặn vượt thật). App chỉ báo khi trạng thái đổi.

- Đợt cảnh báo (Period): từ sáng trạng thái chuyển sang "vượt" tới sáng nó về "không vượt" (app báo "có thể lấy nước").
  Đợt bắt đầu khi số mới nhất còn dưới ngưỡng là cảnh báo sớm: đúng (HIT) nếu trong đợt số đo cho thấy đã vượt,
  nhầm (MISS) nếu đợt kết thúc mà chưa vượt.
- Lần bắt đầu vượt: ngày E có độ mặn > T, số đo trước đó (ngày gần nhất có số) <= T. Người dùng đã được cảnh báo nếu
  sáng E đang trong một đợt bắt đầu từ trước (sáng E-1 trở về trước): đợt cảnh báo sớm (báo trước E - start ngày),
  hoặc đợt từ lần vượt trước mà app chưa báo hết mặn. Giữ nguyên số mới nhất thì sáng E luôn "không vượt": 0 lần.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median
from typing import Dict, List, Optional, Sequence

WARNING_HORIZON = 7


@dataclass
class Period:
    start: date                              # sáng ngày app báo vượt / có nguy cơ vượt
    early: bool                              # bắt đầu khi số mới nhất còn dưới ngưỡng (cảnh báo sớm)
    first_risk_date: Optional[date] = None   # cảnh báo sớm: ngày đầu tiên có thể vượt
    peak: Optional[float] = None             # cảnh báo sớm: mức có thể lên tới cao nhất trong 7 ngày, lúc báo
    end: Optional[date] = None               # sáng ngày app báo hết mặn; None = còn mở ở cuối giai đoạn
    confirmed: Optional[date] = None         # sáng đầu tiên trong đợt có số đo vượt ngưỡng

    def covers(self, day: date) -> bool:
        """Sáng `day` đang trong đợt, và đợt bắt đầu từ hôm trước trở về trước"""
        return self.start < day and (self.end is None or self.end > day)

    @property
    def outcome(self) -> str:
        return "HIT" if self.confirmed else "MISS" if self.end else "OPEN"

    def to_json(self) -> dict:
        """Cảnh báo sớm cho trang Phát lại; end là sáng số đo xác nhận đã vượt (HIT) hoặc sáng báo hết nguy cơ (MISS)."""
        end = self.confirmed or self.end
        return {"start": self.start.isoformat(), "end": end.isoformat() if end else None, "outcome": self.outcome,
                "firstRiskDate": self.first_risk_date.isoformat(), "peak": round(self.peak, 2)}


def simulate(first_issue: date, latest: Sequence[Optional[float]], risk: Sequence[Optional[Sequence[Optional[float]]]],
             threshold: float) -> List[Period]:
    """
    latest[i], risk[i]: số mới nhất và mức có thể lên tới của ngày +1..+7, lúc phát hành ngày first_issue + i.
    Ngày không có dự báo (None) giữ nguyên trạng thái, như app khi số đo không về.
    """
    risk_until: Optional[date] = None
    current: Optional[Period] = None
    periods: List[Period] = []
    for i, (value, levels) in enumerate(zip(latest, risk)):
        if value is None or levels is None:
            continue
        day = first_issue + timedelta(days=i)
        risky = [(h, v) for h, v in enumerate(levels[:WARNING_HORIZON], start=1) if v is not None and v > threshold]
        if risky:
            last_risky = day + timedelta(days=risky[-1][0])
            risk_until = max(risk_until, last_risky) if risk_until else last_risky
        exceeding = value > threshold or (risk_until is not None and risk_until >= day)
        if current is None and exceeding:
            early = value <= threshold
            current = Period(start=day, early=early,
                             first_risk_date=day + timedelta(days=risky[0][0]) if early else None,
                             peak=max(v for _, v in risky) if early else None)
        elif current is not None and not exceeding:
            current.end = day
            periods.append(current)
            current = None
        if current is not None and value > threshold and current.confirmed is None:
            current.confirmed = day
    if current is not None:
        periods.append(current)
    return periods


def early_warnings(periods: List[Period]) -> List[Period]:
    return [p for p in periods if p.early]


def onsets(daily: Dict[date, float], threshold: float, start: date, end: date) -> List[date]:
    """Ngày bắt đầu vượt ngưỡng trong [start, end]: vượt, và số đo trước đó (ngày gần nhất có số) không vượt."""
    out, previous = [], None
    for day in sorted(daily):
        value = daily[day]
        if previous is not None and value > threshold >= previous and start <= day <= end:
            out.append(day)
        previous = value
    return out


def score(periods: List[Period], onset_days: List[date]) -> dict:
    covered, leads = 0, []
    for day in onset_days:
        period = next((p for p in periods if p.covers(day)), None)
        if period is None:
            continue
        covered += 1
        # Cảnh báo sớm nhắm đúng lần vượt này (chưa có lần vượt nào khác trong đợt)
        if period.early and (period.confirmed is None or period.confirmed > day):
            leads.append((day - period.start).days)
    warnings = early_warnings(periods)
    return {
        "onsets": len(onset_days),
        "covered": covered,
        "warnedAhead": len(leads),
        "leads": leads,
        "warnings": len(warnings),
        "hits": sum(p.outcome == "HIT" for p in warnings),
        "misses": sum(p.outcome == "MISS" for p in warnings),
    }


def merge_scores(scores: List[dict]) -> dict:
    """Cộng điểm của nhiều trạm; số ngày báo trước trả về dạng trung vị."""
    leads = [lead for s in scores for lead in s["leads"]]
    total = {k: sum(s[k] for s in scores) for k in ("onsets", "covered", "warnedAhead", "warnings", "hits", "misses")}
    total["medianLeadDays"] = median(leads) if leads else None
    return total
