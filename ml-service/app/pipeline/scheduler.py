import logging
import pandas as pd
from sqlalchemy import create_engine, text
from apscheduler.schedulers.background import BackgroundScheduler
from app.config import get_settings
from app.pipeline.crawler import Crawler
from app.pipeline.preprocessor import DataPreprocessor
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
settings = get_settings()

def get_db_engine():
    return create_engine(settings.database_url)

def get_station_mapping(engine) -> dict:
    """Returns a dict mapping station_code -> station_id"""
    query = text("SELECT id, code FROM stations")
    df = pd.read_sql(query, engine)
    return dict(zip(df['code'], df['id']))

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
            
        # 2. Preprocess data
        preprocessor = DataPreprocessor()
        clean_df = preprocessor.process(raw_data)
        
        if clean_df.empty:
            logger.info("No data remained after preprocessing. Pipeline job finished.")
            return
            
        # 3. Map station_code to station_id
        engine = get_db_engine()
        mapping = get_station_mapping(engine)
        
        # Keep only records where station_code exists in our mapping
        clean_df = clean_df[clean_df['station_code'].isin(mapping.keys())].copy()
        clean_df['station_id'] = clean_df['station_code'].map(mapping)
        
        # Prepare for DB insertion
        # We need to drop station_code as it's not in water_metrics
        db_df = clean_df[['station_id', 'salinity', 'water_level', 'flow_rate', 'recorded_at']].copy()
        
        # Ensure recorded_at is properly tz-aware or tz-naive UTC based on postgres config
        # We'll just pass it as datetime objects
        
        # 4. Save to DB
        # We use 'append' to add to existing water_metrics table
        db_df.to_sql('water_metrics', con=engine, if_exists='append', index=False)
        logger.info(f"Successfully inserted {len(db_df)} records into water_metrics table.")
        
    except Exception as e:
        logger.error(f"Error in data pipeline job: {str(e)}", exc_info=True)

# Global scheduler instance
scheduler = BackgroundScheduler()

def start_scheduler():
    """Start the APScheduler for the data pipeline."""
    # Run every 15 minutes
    scheduler.add_job(run_pipeline, 'interval', minutes=15, id='data_pipeline_job', replace_existing=True)
    scheduler.start()
    logger.info("Data Pipeline Scheduler started. Job will run every 15 minutes.")

def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown()
    logger.info("Data Pipeline Scheduler stopped.")
