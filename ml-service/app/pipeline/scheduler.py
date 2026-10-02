import logging
import pandas as pd
from sqlalchemy import text
from apscheduler.schedulers.background import BackgroundScheduler
from app.db import get_engine
from app.pipeline.crawler import Crawler
from app.pipeline.preprocessor import DataPreprocessor

logger = logging.getLogger(__name__)

METRIC_COLUMNS = ['salinity', 'water_level', 'flow_rate']


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


def run_pipeline():
    """
    Main job that orchestrates crawling, preprocessing, and saving to DB.
    """
    logger.info("Starting Data Pipeline Job...")
    try:
        # 1. Crawl raw data
        crawler = Crawler()
        raw_data = crawler.fetch_data()

        if not raw_data:
            logger.info("No new data fetched. Pipeline job finished.")
            return

        # 2. Preprocess data (no scaling: the DB stores real-unit values)
        preprocessor = DataPreprocessor()
        clean_df = preprocessor.process(raw_data, scale=False)

        if clean_df.empty:
            logger.info("No data remained after preprocessing. Pipeline job finished.")
            return

        # 3. Wide (one column per metric) -> long (one row per metric), then attach sensor_id
        engine = get_engine()
        sensors = get_crawler_sensor_mapping(engine)

        long_df = clean_df.melt(
            id_vars=['station_code', 'recorded_at'],
            value_vars=METRIC_COLUMNS,
            var_name='metric_type',
            value_name='value',
        ).dropna(subset=['value'])
        db_df = long_df.merge(sensors, on=['station_code', 'metric_type'], how='inner')

        dropped = len(long_df) - len(db_df)
        if dropped:
            logger.warning(f"Dropped {dropped} records without a CRAWLER sensor (unknown station or metric).")
        if db_df.empty:
            logger.info("No records matched a CRAWLER sensor. Pipeline job finished.")
            crawler.mark_processed(raw_data)
            return

        # 4. Save to DB
        rows = db_df[['sensor_id', 'station_id', 'metric_type', 'value', 'unit', 'recorded_at']].to_dict('records')
        with engine.begin() as conn:
            # Unique (sensor_id, recorded_at) — Flyway V6: crawl lại cùng giờ không tạo bản ghi trùng
            conn.execute(
                text("""
                    INSERT INTO measurements (sensor_id, station_id, metric_type, value, unit, recorded_at)
                    VALUES (:sensor_id, :station_id, :metric_type, :value, :unit, :recorded_at)
                    ON CONFLICT (sensor_id, recorded_at) DO NOTHING
                """),
                rows,
            )
        logger.info(f"Saved {len(rows)} records into measurements table (duplicates skipped).")
        crawler.mark_processed(raw_data)

    except Exception as e:
        logger.error(f"Error in data pipeline job: {str(e)}", exc_info=True)

# Global scheduler instance
scheduler = BackgroundScheduler()

def start_scheduler():
    """Start the APScheduler for the data pipeline."""
    # Run every 15 minutes
    # max_instances=1 + coalesce: một lần chạy chậm không làm job chồng lên nhau
    scheduler.add_job(run_pipeline, 'interval', minutes=15, id='data_pipeline_job',
                      replace_existing=True, max_instances=1, coalesce=True)
    scheduler.start()
    logger.info("Data Pipeline Scheduler started. Job will run every 15 minutes.")

def stop_scheduler():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
    logger.info("Data Pipeline Scheduler stopped.")
