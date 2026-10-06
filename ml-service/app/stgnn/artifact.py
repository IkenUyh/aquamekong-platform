"""
File model đã cài trong `model_dir/stgnn/`:
- h{n}.pth: state_dict của STGNN cho horizon n ngày (load với weights_only=True)
- meta.json: trạm, feature, tham số scaler, điểm đánh giá trên tập test

Lúc chạy chỉ đọc 2 loại file trên, không bao giờ mở pickle.
"""

import json
import pickletools
from pathlib import Path

from app.config import get_settings

META_FILE = "meta.json"

# Pickle của joblib.dump(MinMaxScaler): chỉ được tham chiếu đúng các lớp này
ALLOWED_PICKLE_GLOBALS = {
    "sklearn.preprocessing._data MinMaxScaler",
    "joblib.numpy_pickle NumpyArrayWrapper",
    "numpy ndarray",
    "numpy dtype",
    "numpy.core.multiarray _reconstruct",
    "numpy._core.multiarray _reconstruct",
}


def artifact_dir(model_dir=None) -> Path:
    return Path(model_dir or get_settings().model_dir) / "stgnn"


def weights_path(horizon: int, model_dir=None) -> Path:
    return artifact_dir(model_dir) / f"h{horizon}.pth"


def read_meta(model_dir=None):
    path = artifact_dir(model_dir) / META_FILE
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def write_meta(meta: dict, model_dir=None) -> Path:
    path = artifact_dir(model_dir) / META_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def pickle_globals(path) -> set:
    """Các lớp mà file pickle tham chiếu, đọc opcode chứ không chạy pickle.
    joblib ghi mảng numpy thô ngay sau opcode BUILD nên dừng ở byte đầu tiên không đọc được."""
    found, pushed, memo = set(), [], {}
    with open(path, "rb") as f:
        try:
            for op, arg, _ in pickletools.genops(f):
                if op.name in ("SHORT_BINUNICODE", "BINUNICODE", "UNICODE", "BINUNICODE8"):
                    pushed.append(arg)
                elif op.name == "MEMOIZE" and pushed:
                    memo[len(memo)] = pushed[-1]
                elif op.name in ("BINPUT", "LONG_BINPUT", "PUT") and pushed:
                    memo[int(arg)] = pushed[-1]
                elif op.name in ("BINGET", "LONG_BINGET", "GET"):
                    pushed.append(memo.get(int(arg), "?"))
                elif op.name == "GLOBAL":
                    found.add(arg)
                elif op.name == "STACK_GLOBAL":
                    found.add(f"{pushed[-2]} {pushed[-1]}" if len(pushed) >= 2 else "?")
        except ValueError:
            pass
    return found


def check_scaler_pickle(path) -> None:
    unexpected = pickle_globals(path) - ALLOWED_PICKLE_GLOBALS
    if unexpected:
        raise ValueError(f"File scaler tham chiếu lớp không được phép, không mở: {sorted(unexpected)}")
