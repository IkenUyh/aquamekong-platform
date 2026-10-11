"""
Học lại mô hình rủi ro mặn ngay (không chờ job định kỳ) và in điểm cảnh báo sớm trên từng mùa khô:

    docker compose exec ml-service python -m app.early_warning

Chỉ in số tổng hợp, không in số đo (repo công khai).
"""

import logging
import sys

from app.early_warning.service import early_warning


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    early_warning.refresh(force=True)
    result = early_warning.evaluation()
    if result is None:
        print("Chưa có số đo độ mặn để học.")
        return 1
    print(f"Mô hình {result['modelVersion']}, dữ liệu tới {result['trainedUntil']}, "
          f"mức có thể lên tới = phân vị {result['upperQuantile']:g}")
    for season in result["seasons"]:
        print(f"\n{season['label']} (học số đo tới {season['trainedUntil']}, {season['stations']} trạm): "
              f"khoảng dự báo chứa {season['coverage']:.0%} số thật, số thật vượt mức có thể lên tới {season['aboveUpper']:.0%}")
        for t in season["thresholds"]:
            lead = f", thường sớm {t['medianLeadDays']:g} ngày" if t["medianLeadDays"] is not None else ""
            print(f"  Ngưỡng {t['threshold']:g}‰: {t['onsets']} lần bắt đầu vượt, {t['covered']} lần app đang cảnh báo từ trước "
                  f"(cảnh báo sớm nhắm đúng lần vượt: {t['warnedAhead']}{lead}); "
                  f"{t['warnings']} lần báo sớm: {t['hits']} đúng, {t['misses']} nhầm")
    return 0


if __name__ == "__main__":
    sys.exit(main())
