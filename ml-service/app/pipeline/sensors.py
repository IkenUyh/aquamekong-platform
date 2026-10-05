import pandas as pd
from sqlalchemy import text


def get_crawler_sensor_mapping(engine) -> pd.DataFrame:
    """Returns station_code, station_id, metric_type, sensor_id, unit of the CRAWLER sensors (seeded by Flyway V3)."""
    query = text("""
        SELECT st.code AS station_code, st.id AS station_id,
               se.metric_type, se.id AS sensor_id, se.unit
        FROM sensors se
        JOIN devices d  ON d.id = se.device_id
        JOIN stations st ON st.id = d.station_id
        WHERE d.device_type = 'CRAWLER'
    """)
    return pd.read_sql(query, engine)
