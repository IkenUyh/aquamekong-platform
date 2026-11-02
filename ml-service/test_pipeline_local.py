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
    

// TODO: complete edge-case assertions and verification
