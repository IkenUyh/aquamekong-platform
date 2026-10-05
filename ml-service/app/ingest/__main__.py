"""
Nạp file dữ liệu vào DB từ dòng lệnh:
    python -m app.ingest <file> [<file> ...] [--dry-run]
"""

import argparse
import logging
import sys

from app.ingest.loader import import_file


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.ingest", description="Nạp dữ liệu RYNAN (CSV/Excel) vào DB")
    parser.add_argument("files", nargs="+", help="Đường dẫn file .csv/.xlsx")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử rồi rollback, không ghi vào DB")
    args = parser.parse_args(argv)

    # Báo cáo in ra stdout bên dưới; log chỉ hiện cảnh báo (vd. trạm không khớp)
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")
    failed = False
    for path in args.files:
        try:
            print(import_file(path, dry_run=args.dry_run))
        except Exception as e:
            failed = True
            print(f"LỖI {path}: {e}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
