import logging
import pandas as pd
import sys

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("LocalTest")

# Mocking Redis and DB to run without Docker
import redis
class MockRedis:
    def __init__(self):
        self.cache = {}
    def get(self, key):
        return self.cache.get(key)
    def set(self, key, value):
        self.cache[key] = value

# Patch the redis creation
redis.from_url = lambda *args, **kwargs: MockRedis()

from app.pipeline.crawler import Crawler
from app.pipeline.preprocessor import DataPreprocessor
from app.pipeline import scheduler

def run_local_test():
    logger.info("=== STARTING LOCAL PIPELINE TEST (NO DOCKER) ===")
    
    # 1. Test Crawler
    logger.info("1. Running Crawler...")
    crawler = Crawler()
    raw_data = crawler.fetch_data()
    
    if not raw_data:
        logger.info("No data fetched.")
        return
        
    logger.info(f"Fetched {len(raw_data)} raw records. Example: {raw_data[0]}")
    
    # 2. Test Preprocessor
    logger.info("2. Running Preprocessor...")
    preprocessor = DataPreprocessor()
    clean_df = preprocessor.process(raw_data, scale=False)
    
    if clean_df.empty:
        logger.info("Data empty after preprocessing.")
        return
        
    logger.info(f"Preprocessed {len(clean_df)} records.")
    logger.info("First 3 records of cleaned DataFrame (real units, not scaled):")
    logger.info("\n" + clean_df.head(3).to_string())
    
    # 3. Test DB Save logic (mocked)
    logger.info("3. Simulating Database Save...")
    
    # Mocking the CRAWLER sensor mapping that usually comes from DB (Flyway V3)
    codes = ["CT-001", "MT-001", "BT-001", "TV-001", "ST-001", "CM-001"]
    units = {"salinity": "‰", "water_level": "m", "flow_rate": "m³/s"}
    sensors = pd.DataFrame([
        {"station_code": c, "station_id": i + 1, "metric_type": m, "sensor_id": i * 3 + j + 1, "unit": u}
        for i, c in enumerate(codes)
        for j, (m, u) in enumerate(units.items())
    ])

    long_df = clean_df.melt(
        id_vars=['station_code', 'recorded_at'],
        value_vars=scheduler.METRIC_COLUMNS,
        var_name='metric_type',
        value_name='value',
    ).dropna(subset=['value'])
    db_df = long_df.merge(sensors, on=['station_code', 'metric_type'], how='inner')
    logger.info(f"Would insert {len(db_df)} records into PostgreSQL 'measurements' table.")
    logger.info("\n" + db_df.head(3).to_string())
    
    logger.info("=== TEST FINISHED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_local_test()
