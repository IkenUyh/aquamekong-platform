import os
import sys

# Add ml-service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.predictor import Predictor

def main():
    predictor = Predictor()
    
    # We will pick station_id = 1 (if available in CSV) or the first available station
    print("Initialize Predictor...")
    try:
        # First let's find a valid station ID from the loaded CSV data
        df_all = predictor.model.loader_service.load_raw_data()
        stations = df_all['station_id'].unique()
        if len(stations) == 0:
            print("No stations found in the data.")
            return
            
        test_station = stations[0]
        print(f"\nRunning Hybrid Salinity Model Prediction for Station ID {test_station} (7 days ahead)...")
        
        from app.models.hybrid_salinity_model import HybridSalinityModel
        model = HybridSalinityModel()
        predictions = model.predict(station_id=test_station, days_ahead=7)
        
        print("\n" + "="*60)
        print(f"FORECAST RESULTS FOR STATION {test_station}")
        print("="*60)
        for p in predictions:
            print(f"Date: {p.date} | Predicted Salinity: {p.salinity:>5.2f} ‰ | "
                  f"Range: [{p.lower_bound:>5.2f}, {p.upper_bound:>5.2f}] | Model: {p.model_version}")
        print("="*60)
    except Exception as e:
        print(f"Error during prediction: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
