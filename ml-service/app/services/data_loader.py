"""
Data loader service — Loads hydrology data from PostgreSQL.
"""

import pandas as pd
from sqlalchemy import create_engine, text
from app.config import get_settings
from typing import Optional
from datetime import datetime, timedelta

settings = get_settings()


def get_db_engine():
    """Create SQLAlchemy engine for PostgreSQL connection."""
    return create_engine(settings.database_url)


def load_station_metrics(
    station_id: int,
    lookback_days: int = 90,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Load water metrics for a specific station from PostgreSQL.

    Args:
        station_id: The station ID to load data for.
        lookback_days: Number of days of historical data to load.
        end_date: End date for the data range (default: now).

    Returns:
        DataFrame with columns: recorded_at, salinity, water_level, flow_rate
    """
    if end_date is None:
        end_date = datetime.utcnow()

    start_date = end_date - timedelta(days=lookback_days)
    engine = get_db_engine()

    query = text("""
        SELECT recorded_at, salinity, water_level, flow_rate
        FROM water_metrics
        WHERE station_id = :station_id
          AND recorded_at BETWEEN :start_date AND :end_date
        ORDER BY recorded_at ASC
    """)

    df = pd.read_sql(
        query,
        engine,
        params={
            "station_id": station_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    if not df.empty:
        df["recorded_at"] = pd.to_datetime(df["recorded_at"])
        df = df.set_index("recorded_at")

    return df


def load_station_info(station_id: int) -> dict:
    """Load station metadata."""
    engine = get_db_engine()
    query = text("SELECT id, code, name, province FROM stations WHERE id = :id")
    result = pd.read_sql(query, engine, params={"id": station_id})

    if result.empty:
        raise ValueError(f"Station {station_id} not found")

    return result.iloc[0].to_dict()
