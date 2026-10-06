"""
Tạo 2 lớp bản đồ trong src/data/ (đã đơn giản hoá cho web):

- mekong-provinces.json: ranh giới 6 tỉnh/thành ĐBSCL sau sáp nhập 2025 (Tây Ninh, Đồng Tháp,
  Vĩnh Long, An Giang, Cần Thơ, Cà Mau). Nguồn: github.com/ThangLeQuoc/vietnamese-provinces-database
  (MIT), dữ liệu từ Bản đồ đơn vị hành chính Việt Nam - NXB Tài nguyên Môi trường và Bản đồ Việt Nam.
- mekong-rivers.json: sông và kênh có tên từ OpenStreetMap (ODbL, © OpenStreetMap contributors),
  gộp các đoạn cùng tên, bỏ sông < 5 km và kênh < 20 km.

Cách chạy (cần shapely):
  git clone --depth 1 --filter=blob:none --sparse https://github.com/ThangLeQuoc/vietnamese-provinces-database.git vpd
  (cd vpd && git sparse-checkout set --no-cone \
     $(for p in 80_tay_ninh 82_dong_thap 86_vinh_long 91_an_giang 92_can_tho 96_ca_mau; do echo /json/geojson/$p/$p.geojson; done))
  curl -s -A "AquaMekong-map-build" --data-urlencode data@scripts/overpass_waterways.overpassql \
       https://overpass-api.de/api/interpreter -o osm_water.json
  python scripts/build_map_layers.py vpd osm_water.json src/data
"""

import glob
import json
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import LineString, mapping, shape
from shapely.ops import linemerge, unary_union

# Sai số đơn giản hoá (độ): ~110 m cho ranh giới, ~90 m cho sông kênh
PROVINCE_TOLERANCE = 0.001
WATER_TOLERANCE = 0.0008
MIN_RIVER_KM = 5
MIN_CANAL_KM = 20


def rounded(geom, nd=4):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    g = mapping(geom)
    g["coordinates"] = r(g["coordinates"])
    return g


def provinces(vpd_dir):
    features = []
    for f in sorted(glob.glob(f"{vpd_dir}/json/geojson/*/*.geojson")):
        ft = json.load(open(f, encoding="utf-8"))["features"][0]
        p = ft["properties"]
        geom = shape(ft["geometry"]).simplify(PROVINCE_TOLERANCE, preserve_topology=True)
        features.append({"type": "Feature",
                         "properties": {"code": p["code"], "name": p["name"], "fullName": p["fullName"]},
                         "geometry": rounded(geom)})
    return {"type": "FeatureCollection", "features": features}


def waterways(osm_json):
    groups = defaultdict(list)
    for e in json.load(open(osm_json, encoding="utf-8"))["elements"]:
        pts = [(p["lon"], p["lat"]) for p in e.get("geometry", [])]
        if len(pts) >= 2:
            groups[(e["tags"]["name"].strip(), e["tags"]["waterway"])].append(LineString(pts))

    features = []
    for (name, kind), lines in groups.items():
        u = unary_union(lines)
        merged = linemerge(u) if u.geom_type == "MultiLineString" else u
        km = merged.length * 111  # độ -> km (xấp xỉ, đủ để lọc)
        if km < (MIN_CANAL_KM if kind == "canal" else MIN_RIVER_KM):
            continue
        geom = merged.simplify(WATER_TOLERANCE, preserve_topology=False)
        features.append({"type": "Feature",
                         "properties": {"name": name, "kind": kind, "lengthKm": round(km)},
                         "geometry": rounded(geom)})
    features.sort(key=lambda f: -f["properties"]["lengthKm"])
    return {"type": "FeatureCollection", "features": features}


def main(vpd_dir, osm_json, out_dir):
    out = Path(out_dir)
    for name, fc in [("mekong-provinces.json", provinces(vpd_dir)), ("mekong-rivers.json", waterways(osm_json))]:
        s = json.dumps(fc, ensure_ascii=False, separators=(",", ":"))
        (out / name).write_text(s, encoding="utf-8")
        print(f"{name}: {len(fc['features'])} features, {len(s) // 1024} KB")


if __name__ == "__main__":
    main(*sys.argv[1:4])
