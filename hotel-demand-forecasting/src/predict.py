"""Load the saved model and score the most recent rows of the dataset."""
import joblib
import pandas as pd

from src.features import build_features


def main():
    bundle = joblib.load("models/best_model.joblib")
    raw = pd.read_csv("data/hotel_daily.csv", parse_dates=["date"])
    df = build_features(raw).tail(14)
    df["predicted_occupancy"] = bundle["model"].predict(df[bundle["features"]])
    out = df[["date", "occupancy_rate", "predicted_occupancy"]].copy()
    out[["occupancy_rate", "predicted_occupancy"]] = out[["occupancy_rate", "predicted_occupancy"]].round(3)
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()
