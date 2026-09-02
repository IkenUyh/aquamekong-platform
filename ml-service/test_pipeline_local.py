import logging
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
    clean_df = preprocessor.process(raw_data)
    
    if clean_df.empty:
        logger.info("Data empty after preprocessing.")
        return
        
    logger.info(f"Preprocessed {len(clean_df)} records.")
    logger.info("First 3 records of cleaned DataFrame (Notice the values are scaled 0-1):")
    logger.info("\n" + clean_df.head(3).to_string())
    
    # 3. Test DB Save logic (mocked)
    logger.info("3. Simulating Database Save...")
    
    # Mocking the station mapping that usually comes from DB
    mapping = {"CT-001": 1, "MT-001": 2, "BT-001": 3, "TV-001": 4, "ST-001": 5, "CM-001": 6}
    
    clean_df = clean_df[clean_df['station_code'].isin(mapping.keys())].copy()
    clean_df['station_id'] = clean_df['station_code'].map(mapping)
    
    db_df = clean_df[['station_id', 'salinity', 'water_level', 'flow_rate', 'recorded_at']].copy()
    logger.info(f"Would insert {len(db_df)} records into PostgreSQL 'water_metrics' table.")
    
    logger.info("=== TEST FINISHED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_local_test()
