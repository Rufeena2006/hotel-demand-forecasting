# Hotel Demand Forecasting

7-day-ahead **daily hotel occupancy forecasting** in Python (Week 4 internship task:
Predictive Modeling for Hospitality Demand Forecasting).

The pipeline generates a realistic synthetic dataset (3 years, 200-room city hotel),
engineers leakage-safe features, compares a seasonal-naive baseline against Ridge,
Random Forest and Gradient Boosting using time-series cross-validation, and evaluates
the winner on a chronological hold-out test window.

## Quick start
```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m src.data_generator    # creates data/hotel_daily.csv
python -m src.train             # trains, validates, tests, saves model + figures
python -m src.predict           # scores the latest 14 days with the saved model
```

## Structure
```
src/data_generator.py   synthetic data (seasonality, events, weather, pricing, booking pace)
src/features.py         feature engineering (lags shifted by the 7-day horizon, no leakage)
src/train.py            split, tuning (TimeSeriesSplit), evaluation, plots, model export
src/predict.py          inference with the saved model
docs/                   modeling plan report (DOCX)
outputs/                metrics CSV, feature importance, figures
```

## Results (hold-out test, last 180 days)
| Model | MAE | RMSE | MAPE % |
|---|---|---|---|
| Ridge | 0.031 | 0.038 | 4.3 |
| Gradient Boosting | 0.033 | 0.041 | 4.8 |
| Random Forest | 0.039 | 0.046 | 5.3 |
| Seasonal naive (lag 7) | 0.085 | 0.104 | 12.3 |

MAE of 0.031 means the forecast is off by about 3 percentage points of occupancy (about 6 rooms of 200).
The data is synthetic, so the absolute numbers are illustrative; swap in real PMS data to reproduce on a real hotel.
