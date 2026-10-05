"""Synthetic hotel demand data generator.

Produces 3 years of daily records for a single 200-room city hotel. Occupancy is
driven by seasonality, day-of-week, holidays, local events, weather, price and
competitor price, plus noise, so the signal is realistic but known.
"""
import numpy as np
import pandas as pd

N_ROOMS = 200


def generate(start="2022-01-01", end="2024-12-31", seed=42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, end, freq="D")
    n = len(dates)
    doy = dates.dayofyear.values
    dow = dates.dayofweek.values

    # Seasonality: summer peak + smaller December peak
    season = 0.12 * np.sin(2 * np.pi * (doy - 110) / 365) + 0.04 * np.sin(4 * np.pi * (doy - 20) / 365)
    # Weekly pattern: Fri/Sat (leisure) high, Sun low, midweek mild (business)
    weekly = np.array([0.00, 0.03, 0.04, 0.03, 0.07, 0.10, -0.06])[dow]

    # Public holidays (approximate fixed-date set) and school-holiday windows
    fixed = {(1, 1), (5, 1), (7, 4), (12, 24), (12, 25), (12, 31), (11, 11)}
    is_holiday = np.array([(d.month, d.day) in fixed for d in dates]).astype(int)
    is_school_hol = ((dates.month == 7) | (dates.month == 8) | ((dates.month == 12) & (dates.day > 18))).astype(int)

    # Local events: ~14 multi-day events per year (conference, concert, festival)
    event = np.zeros(n, dtype=int)
    for _ in range(14 * 3):
        s = rng.integers(0, n - 4)
        event[s:s + rng.integers(1, 4)] = 1

    # Weather: temperature (C) with annual cycle and noise; rain probability
    temp = 14 + 11 * np.sin(2 * np.pi * (doy - 110) / 365) + rng.normal(0, 3, n)
    rain = (rng.random(n) < 0.22).astype(int)

    # Pricing: ADR rises with expected demand; competitor price tracks market
    base_adr = 110 + 90 * (season + weekly) + 25 * event + 12 * is_holiday + rng.normal(0, 5, n)
    competitor_adr = base_adr + rng.normal(2, 8, n)
    price_gap = base_adr - competitor_adr

    # Slow upward trend (recovery / brand growth)
    trend = np.linspace(0, 0.05, n)

    occ = (0.62 + trend + season + weekly + 0.10 * event + 0.05 * is_holiday + 0.04 * is_school_hol
           + 0.004 * (temp - 18) - 0.03 * rain - 0.0009 * price_gap * 10
           + rng.normal(0, 0.03, n))
    occ = np.clip(occ, 0.15, 0.99)

    # Booking pace: share of final occupancy already on the books 7 days before stay
    otb_7 = np.clip(occ * rng.uniform(0.55, 0.75, n) + rng.normal(0, 0.015, n), 0, 1)

    return pd.DataFrame({
        "date": dates,
        "occupancy_rate": occ.round(4),
        "rooms_sold": (occ * N_ROOMS).round().astype(int),
        "adr": base_adr.round(2),
        "competitor_adr": competitor_adr.round(2),
        "is_holiday": is_holiday,
        "is_school_holiday": is_school_hol,
        "local_event": event,
        "temperature_c": temp.round(1),
        "rain": rain,
        "otb_occupancy_7d": otb_7.round(4),
    })


if __name__ == "__main__":
    df = generate()
    df.to_csv("data/hotel_daily.csv", index=False)
    print(f"Saved data/hotel_daily.csv with {len(df)} rows")
