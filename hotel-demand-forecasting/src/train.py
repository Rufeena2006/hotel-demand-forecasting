"""Train, validate and test occupancy forecasting models.

Run:  python -m src.train
Outputs: metrics CSV, figures, and the saved best model.
"""
import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.data_generator import generate
from src.features import TARGET, build_features, feature_columns

SEED = 42
OUT = Path("outputs")
FIG = OUT / "figures"
TEST_DAYS = 180   # final, untouched test window
VAL_DAYS = 180    # tuning/validation window before test


def metrics(y, p):
    mae = mean_absolute_error(y, p)
    rmse = np.sqrt(mean_squared_error(y, p))
    mape = np.mean(np.abs((y - p) / y)) * 100
    return {"MAE": mae, "RMSE": rmse, "MAPE_%": mape}


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    Path("models").mkdir(exist_ok=True)
    Path("data").mkdir(exist_ok=True)

    # 1. Data
    csv = Path("data/hotel_daily.csv")
    if csv.exists():
        raw = pd.read_csv(csv, parse_dates=["date"])
    else:
        raw = generate()
        raw.to_csv(csv, index=False)
    df = build_features(raw)
    cols = feature_columns(df)

    # 2. Chronological split: train | validation | test (no shuffling)
    test = df.iloc[-TEST_DAYS:]
    val = df.iloc[-(TEST_DAYS + VAL_DAYS):-TEST_DAYS]
    train = df.iloc[:-(TEST_DAYS + VAL_DAYS)]
    trainval = pd.concat([train, val])
    print(f"Rows  train={len(train)}  val={len(val)}  test={len(test)}  features={len(cols)}")

    # 3. Models
    tscv = TimeSeriesSplit(n_splits=5)
    candidates = {
        "Ridge": (
            Pipeline([("sc", StandardScaler()), ("m", Ridge())]),
            {"m__alpha": [0.01, 0.1, 1, 10, 100]},
        ),
        "RandomForest": (
            RandomForestRegressor(random_state=SEED, n_jobs=-1),
            {"n_estimators": [200, 400], "max_depth": [6, 10, None],
             "min_samples_leaf": [2, 5, 10], "max_features": [0.5, 0.8, 1.0]},
        ),
        "GradientBoosting": (
            HistGradientBoostingRegressor(random_state=SEED),
            {"learning_rate": [0.03, 0.05, 0.1], "max_depth": [3, 5, None],
             "max_iter": [200, 400], "l2_regularization": [0.0, 0.1, 1.0],
             "min_samples_leaf": [10, 20, 40]},
        ),
    }

    rows, fitted, preds = [], {}, {}

    # Baseline: seasonal naive (same weekday last week)
    base = test["lag_7"]
    rows.append({"model": "SeasonalNaive(lag7)", **metrics(test[TARGET], base), "cv_MAE": np.nan})
    preds["SeasonalNaive(lag7)"] = base.values

    for name, (est, grid) in candidates.items():
        n_iter = min(8, int(np.prod([len(v) for v in grid.values()])))
        search = RandomizedSearchCV(
            est, grid, n_iter=n_iter, cv=tscv, scoring="neg_mean_absolute_error",
            random_state=SEED, n_jobs=-1)
        search.fit(trainval[cols], trainval[TARGET])
        best = search.best_estimator_
        p = best.predict(test[cols])
        rows.append({"model": name, **metrics(test[TARGET], p), "cv_MAE": -search.best_score_})
        fitted[name], preds[name] = best, p
        print(f"{name:18s} best params: {search.best_params_}")

    res = pd.DataFrame(rows).sort_values("MAE")
    res.to_csv(OUT / "model_comparison.csv", index=False)
    print("\n", res.round(4).to_string(index=False))

    best_name = res[res["model"].isin(fitted)].iloc[0]["model"]
    best = fitted[best_name]
    joblib.dump({"model": best, "features": cols}, "models/best_model.joblib")
    with open(OUT / "best_model.json", "w") as f:
        json.dump({"best_model": best_name, "features": cols}, f, indent=2)
    print(f"\nBest model: {best_name}")

    # 4. Figures
    plt.figure(figsize=(11, 4))
    plt.plot(test["date"], test[TARGET], label="Actual", lw=1.8)
    plt.plot(test["date"], preds[best_name], label=f"Predicted ({best_name})", lw=1.4)
    plt.plot(test["date"], base, label="Seasonal naive", lw=0.9, alpha=0.6, ls="--")
    plt.title("7-day-ahead occupancy forecast on held-out test window")
    plt.ylabel("Occupancy rate"); plt.legend(); plt.tight_layout()
    plt.savefig(FIG / "forecast_vs_actual.png", dpi=150); plt.close()

    plt.figure(figsize=(7, 4))
    plt.barh(res["model"], res["MAE"], color="#3b6fb6")
    plt.xlabel("Test MAE (lower is better)"); plt.title("Model comparison")
    plt.gca().invert_yaxis(); plt.tight_layout()
    plt.savefig(FIG / "model_comparison.png", dpi=150); plt.close()

    imp = permutation_importance(best, test[cols], test[TARGET], n_repeats=10,
                                 random_state=SEED, scoring="neg_mean_absolute_error")
    imp_s = pd.Series(imp.importances_mean, index=cols).sort_values().tail(12)
    plt.figure(figsize=(7, 5))
    imp_s.plot.barh(color="#2a9d8f")
    plt.xlabel("Increase in MAE when feature is shuffled")
    plt.title(f"Permutation importance ({best_name})"); plt.tight_layout()
    plt.savefig(FIG / "feature_importance.png", dpi=150); plt.close()

    resid = test[TARGET].values - preds[best_name]
    plt.figure(figsize=(6, 4))
    plt.hist(resid, bins=25, color="#e76f51", edgecolor="white")
    plt.title("Residual distribution (test)"); plt.xlabel("Actual - predicted")
    plt.tight_layout(); plt.savefig(FIG / "residuals.png", dpi=150); plt.close()

    imp_s.sort_values(ascending=False).to_csv(OUT / "feature_importance.csv", header=["importance"])
    print("Artifacts written to outputs/ and models/")


if __name__ == "__main__":
    main()
