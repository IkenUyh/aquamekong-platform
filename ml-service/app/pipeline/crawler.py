import logging
import random
from datetime import datetime, timezone, timedelta
import redis
import requests
import json
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class Crawler:
    """
    Data ingestion crawler for hydrology and salinity data.
    Implements Incremental Polling and Redis caching to prevent duplicates.
    """
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        # Mock station codes from database
        self.station_codes = ["CT-001", "MT-001", "BT-001", "TV-001", "ST-001", "CM-001"]
        
    def _is_new_data(self, station_code: str, timestamp_str: str) -> bool:
        """Check if this timestamp was already processed for this station."""
        cache_key = f"last_updated_at:{station_code}"
        last_timestamp = self.redis_client.get(cache_key)
        
        if last_timestamp == timestamp_str:
            return False
            
        return True
        
    def _update_cache(self, station_code: str, timestamp_str: str):
        """Update the last processed timestamp for a station."""
        cache_key = f"last_updated_at:{station_code}"
        self.redis_client.set(cache_key, timestamp_str)

    def fetch_data(self):
        """
        Mock implementation of the data fetching logic from MRC and SIWRP portals.
        Returns raw data ready for preprocessing.
        """
        logger.info("Starting data ingestion cycle...")
        raw_data = []
        
        # Simulate crawling data for each station
        # In a real scenario, this would use requests.get() and BeautifulSoup to parse HTML/JSON from portals
        now = datetime.now(timezone.utc)
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        
        for code in self.station_codes:
            # Simulate timestamp (data might be delayed by an hour or so)
            timestamp_str = current_hour.isoformat()
            
            if not self._is_new_data(code, timestamp_str):
                logger.debug(f"Data for {code} at {timestamp_str} already processed. Skipping.")
                continue
                
            # Simulate data gaps and random values
            if random.random() > 0.1:  # 10% chance of missing data to test interpolation
                base_salinity = 1.0 if "CT" in code else (5.0 if "ST" in code or "CM" in code else 2.5)
                
                raw_record = {
                    "station_code": code,
                    "recorded_at": timestamp_str,
                    "salinity": base_salinity + random.uniform(-0.5, 0.5),
                    "water_level": 1.0 + random.uniform(-0.2, 0.2),
                    "flow_rate": 3000 + random.uniform(-200, 200)
                }
                raw_data.append(raw_record)
                self._update_cache(code, timestamp_str)
                
        logger.info(f"Ingestion complete. Fetched {len(raw_data)} new records.")
        return raw_data
