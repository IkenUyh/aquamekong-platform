"""
Data loader service — Loads hydrology data & persists forecast results to PostgreSQL.
"""

import pandas as pd
from sqlalchemy import create_engine, text
from app.config import get_settings
from typing import Optional, List
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
    Load water measurements for a specific station from PostgreSQL V2 measurements table.

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
        SELECT 
            recorded_at,
            metric_type,
            value
        FROM measurements
        WHERE station_id = :station_id
          AND recorded_at BETWEEN :start_date AND :end_date
        ORDER BY recorded_at ASC
    """)

    raw_df = pd.read_sql(
        query,
        engine,
        params={
            "station_id": station_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    if raw_df.empty:
        return pd.DataFrame(columns=["salinity", "water_level", "flow_rate"])

    raw_df["recorded_at"] = pd.to_datetime(raw_df["recorded_at"])
    raw_df["metric_type"] = raw_df["metric_type"].str.lower()

    # Pivot metric_type to columns (salinity, water_level, flow_rate)
    df = raw_df.pivot_table(
        index="recorded_at",
        columns="metric_type",
        values="value",
        aggfunc="mean"
    ).reset_index()

    df = df.set_index("recorded_at")

    # Ensure required columns exist
    for col in ["salinity", "water_level", "flow_rate"]:
        if col not in df.columns:
            df[col] = None

    return df


def load_station_info(station_id: int) -> dict:
    """Load station metadata from PostgreSQL."""
    engine = get_db_engine()
    query = text("SELECT id, code, name, province FROM stations WHERE id = :id")
    result = pd.read_sql(query, engine, params={"id": station_id})

    if result.empty:
        raise ValueError(f"Station {station_id} not found")

    return result.iloc[0].to_dict()


def save_forecast_run(
    station_id: int,
    model_version: str,
    predictions: List[dict],
    input_from: Optional[datetime] = None,
    input_to: Optional[datetime] = None,
) -> int:
    """
    Save a forecast run and its salinity predictions into forecast_runs & salinity_forecasts tables.
    """
    engine = get_db_engine()
    with engine.begin() as conn:
        # Insert into forecast_runs
        run_res = conn.execute(
            text("""
                INSERT INTO forecast_runs (model_version, run_at, input_from, input_to, status, created_at)
                VALUES (:model_version, NOW(), :input_from, :input_to, 'SUCCESS', NOW())
                RETURNING id;
            """),
            {
                "model_version": model_version,
                "input_from": input_from,
                "input_to": input_to,
            }
        )
        run_id = run_res.scalar()

        # Insert predictions into salinity_forecasts
        for p in predictions:
            conn.execute(
                text("""
                    INSERT INTO salinity_forecasts (
                        run_id, station_id, forecast_date, predicted_salinity, 
                        lower_bound, upper_bound, confidence_level, created_at
                    )
                    VALUES (
                        :run_id, :station_id, :forecast_date, :predicted_salinity, 
                        :lower_bound, :upper_bound, :confidence_level, NOW()
                    );
                """),
                {
                    "run_id": run_id,
                    "station_id": station_id,
                    "forecast_date": p["date"],
                    "predicted_salinity": p["salinity"],
                    "lower_bound": p.get("lower_bound"),
                    "upper_bound": p.get("upper_bound"),
                    "confidence_level": p.get("confidence", 0.95),
                }
            )

        return run_id
