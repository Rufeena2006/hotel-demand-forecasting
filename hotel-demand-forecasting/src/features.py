"""Feature engineering for a 7-day-ahead occupancy forecast.

Every feature must be knowable HORIZON days before the stay date, so we avoid
data leakage. Lags/rolling windows are shifted by HORIZON; calendar, event,
holiday, price and weather-forecast features are known in advance.
"""
import numpy as np
import pandas as pd

HORIZON = 7
TARGET = "occupancy_rate"


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("date").reset_index(drop=True).copy()
    out = pd.DataFrame({"date": df["date"], TARGET: df[TARGET]})

    # Calendar
    out["dow"] = df["date"].dt.dayofweek
    out["is_weekend"] = (out["dow"] >= 4).astype(int)  # Fri/Sat nights
    out["month"] = df["date"].dt.month
    out["doy_sin"] = np.sin(2 * np.pi * df["date"].dt.dayofyear / 365.25)
    out["doy_cos"] = np.cos(2 * np.pi * df["date"].dt.dayofyear / 365.25)

    # Known-in-advance drivers
    for c in ["is_holiday", "is_school_holiday", "local_event", "temperature_c", "rain"]:
        out[c] = df[c]
    out["adr"] = df["adr"]
    out["price_gap"] = df["adr"] - df["competitor_adr"]

    # Booking pace (reservations on the books HORIZON days out)
    out["otb_occupancy_7d"] = df["otb_occupancy_7d"]

    # Lags and rolling stats, shifted by HORIZON to prevent leakage
    s = df[TARGET]
    for lag in (HORIZON, 14, 21, 28, 364):
        out[f"lag_{lag}"] = s.shift(lag)
    out["roll_mean_7"] = s.shift(HORIZON).rolling(7).mean()
    out["roll_mean_28"] = s.shift(HORIZON).rolling(28).mean()
    out["roll_std_7"] = s.shift(HORIZON).rolling(7).std()

    return out.dropna().reset_index(drop=True)


def feature_columns(df: pd.DataFrame):
    return [c for c in df.columns if c not in ("date", TARGET)]
