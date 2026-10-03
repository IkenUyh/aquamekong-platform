import os
import sys
import pandas as pd
import numpy as np
from datetime import timedelta

# Add ml-service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.predictor import Predictor
from app.models.hybrid_salinity_model import HybridSalinityModel

def main():
    print("Loading final_data.csv...")
    final_data_path = os.path.join(os.path.dirname(__file__), '..', '..', 'final_data.csv')
    if not os.path.exists(final_data_path):
        print(f"Cannot find {final_data_path}")
        return
        
    df_final = pd.read_csv(final_data_path)
    # Ensure week_end is datetime
    df_final['week_end'] = pd.to_datetime(df_final['week_end'])
    
    print("Loading raw data to map station names to station IDs...")
    predictor = Predictor()
    df_raw = predictor.model.loader_service.load_raw_data()
    
    # Create mapping from station_name in raw data to station_id
    # Note: raw data station_name might be "KCVH - Xẻo Quao", final_data might be "Xẻo Quao"
    unique_stations_raw = df_raw[['station_id', 'station_name']].drop_duplicates()
    
    print("Generating predictions for all stations...")
    model = HybridSalinityModel()
    
    # We will just create a new DataFrame for future predictions and append to final_data
    # OR we can generate historical predictions.
    # To keep it simple and actionable: we'll generate 7-day future predictions for each station,
    # format them like final_data.csv, and append.
    
    future_rows = []
    
    for _, row in unique_stations_raw.iterrows():
        station_id = row['station_id']
        raw_station_name = row['station_name']
        
        # Try to find a match in final_data
        # simple substring match
        matched_province = ""
        matched_name = raw_station_name
        matched_lat = np.nan
        matched_lon = np.nan
        
        for f_name in df_final['station_name'].unique():
            if type(f_name) == str and (f_name in raw_station_name or raw_station_name in f_name):
                matched_name = f_name
                # get lat/lon
                sample = df_final[df_final['station_name'] == f_name].iloc[0]
                matched_province = sample['province']
                matched_lat = sample['latitude']
                matched_lon = sample['longitude']
                break
                
        print(f"Predicting for {station_id} ({matched_name})...")
        try:
            predictions = model.predict(station_id=station_id, days_ahead=7)
            for p in predictions:
                # Create a row matching final_data.csv structure
                new_row = {
                    'station_name': matched_name,
                    'province': matched_province,
                    'latitude': matched_lat,
                    'longitude': matched_lon,
                    'week_end': pd.to_datetime(p.date), # Use date as week_end
                    'week_start': pd.to_datetime(p.date) - timedelta(days=6),
                    'predicted_salinity': p.salinity,
                    'salinity_lower_bound': p.lower_bound,
                    'salinity_upper_bound': p.upper_bound,
                    'prediction_model': p.model_version
                }
                # Fill other columns with NaN automatically when converting to DataFrame
                future_rows.append(new_row)
        except Exception as e:
            print(f"Could not predict for {station_id}: {e}")
            
    df_future = pd.DataFrame(future_rows)
    
    # Merge existing final_data with new predictions structure
    # Since final_data doesn't have predicted_salinity, they will be NaN for historical,
    # and future rows will have NaN for B11, B12, etc.
    df_combined = pd.concat([df_final, df_future], ignore_index=True)
    
    output_path = os.path.join(os.path.dirname(__file__), '..', '..', 'final_data_with_predictions.csv')
    df_combined.to_csv(output_path, index=False)
    print(f"\n[+] Successfully created combined dataset with predictions: {output_path}")

if __name__ == '__main__':
    main()
