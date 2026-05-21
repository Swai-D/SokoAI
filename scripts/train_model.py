import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from datetime import datetime, timedelta
from hijri_converter import Gregorian
import json, os

# Mock Historical Weather Baseline for Tanzania (Approximate)
WEATHER_BASELINE = {
    1: {"temp": 28, "rain": 150}, # Jan
    2: {"temp": 28, "rain": 140}, # Feb
    3: {"temp": 27, "rain": 250}, # Mar
    4: {"temp": 26, "rain": 400}, # Apr
    5: {"temp": 25, "rain": 200}, # May
    6: {"temp": 24, "rain": 50},  # Jun
    7: {"temp": 23, "rain": 30},  # Jul
    8: {"temp": 24, "rain": 30},  # Aug
    9: {"temp": 25, "rain": 50},  # Sep
    10: {"temp": 26, "rain": 100}, # Oct
    11: {"temp": 27, "rain": 180}, # Nov
    12: {"temp": 27, "rain": 200}, # Dec
}

def get_ramadhan_flag(date):
    """Check if a date is within Ramadhan using hijri-converter"""
    h = Gregorian(date.year, date.month, date.day).to_hijri()
    return 1 if h.month == 9 else 0

def get_weather_features(month):
    base = WEATHER_BASELINE.get(month, {"temp": 25, "rain": 100})
    return base["temp"], base["rain"]

# Load data
data_path = "data/bei_sokoni.csv"
if not os.path.exists(data_path):
    # Fallback to app data directory
    data_path = "SokoAI_NextJS_Project/sokoai-app/data/historical.json"
    # If it's JSON, we need to convert to CSV/DF format
    with open(data_path, 'r') as f:
        hist_data = json.load(f)
    records = []
    for comm, prices in hist_data.items():
        for p in prices:
            d = datetime.strptime(p['date'], "%Y-%m-%d")
            records.append({
                "date": p['date'],
                "commodity": comm,
                "price": p['price'],
                "month": d.month,
                "week": d.isocalendar()[1]
            })
    df = pd.DataFrame(records)
else:
    df = pd.read_csv(data_path)

df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.month
df["week"] = df["date"].dt.isocalendar().week
df = df.sort_values("date")

# ─── Feature Engineering ──────────────────────────────────────────
def build_features(df_sub):
    df_sub = df_sub.copy()
    df_sub["t"] = (df_sub["date"] - df_sub["date"].min()).dt.days
    df_sub["sin_month"] = np.sin(2 * np.pi * df_sub["month"] / 12)
    df_sub["cos_month"] = np.cos(2 * np.pi * df_sub["month"] / 12)
    df_sub["sin_week"]  = np.sin(2 * np.pi * df_sub["week"] / 52)
    df_sub["cos_week"]  = np.cos(2 * np.pi * df_sub["week"] / 52)
    
    # Dynamic Ramadhan
    df_sub["is_ramadhan"] = df_sub["date"].apply(lambda x: get_ramadhan_flag(x))
    
    df_sub["is_holiday_season"] = df_sub["month"].isin([11, 12]).astype(int)
    
    # Updated Harvest Season (May to August: 5, 6, 7, 8)
    df_sub["is_harvest"] = df_sub["month"].isin([5, 6, 7, 8]).astype(int)
    
    # Weather Integration
    weather = df_sub["month"].apply(lambda m: get_weather_features(m))
    df_sub["temperature_c"] = weather.apply(lambda x: x[0])
    df_sub["rainfall_mm"] = weather.apply(lambda x: x[1])
    
    return df_sub

FEATURES = ["t", "sin_month", "cos_month", "sin_week", "cos_week",
            "is_ramadhan", "is_holiday_season", "is_harvest",
            "temperature_c", "rainfall_mm"]

# ─── Train per commodity ───────────────────────────────────────────
results = {}
all_predictions = []
commodities = df["commodity"].unique()

print("=" * 55)
print(f"{'SokoAI — ML Training Report (Refactored)':^55}")
print("=" * 55)

for commodity in commodities:
    sub = df[df["commodity"] == commodity].copy()
    sub = build_features(sub)
    
    X = sub[FEATURES].values
    y = sub["price"].values
    
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("poly",   PolynomialFeatures(degree=2, include_bias=False)),
        ("ridge",  Ridge(alpha=2.5)), # Tuned Alpha
    ])
    
    # Cross-validation accuracy
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="r2")
    model.fit(X, y)
    y_pred = model.predict(X)
    mae  = mean_absolute_error(y, y_pred)
    r2   = r2_score(y, y_pred)
    mape = np.mean(np.abs((y - y_pred) / y)) * 100
    
    print(f"\n📦 {commodity.upper()}")
    print(f"   R² Score  : {r2:.4f} ({r2*100:.1f}% accuracy)")
    print(f"   MAE       : TZS {mae:,.0f}")
    print(f"   MAPE      : {mape:.1f}%")
    print(f"   CV R²     : {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # ─── Forecast next 16 weeks ───────────────────────────────────
    last_date = sub["date"].max()
    last_t    = sub["t"].max()
    forecast_rows = []
    
    for w in range(1, 17):
        future_date = last_date + timedelta(weeks=w)
        t_val       = last_t + (w * 7)
        month       = future_date.month
        week        = future_date.isocalendar()[1]
        
        is_ram      = get_ramadhan_flag(future_date)
        is_holiday  = 1 if month in [11, 12] else 0
        is_harvest  = 1 if month in [5, 6, 7, 8] else 0
        temp, rain  = get_weather_features(month)

        row = [t_val,
               np.sin(2*np.pi*month/12), np.cos(2*np.pi*month/12),
               np.sin(2*np.pi*week/52),  np.cos(2*np.pi*week/52),
               is_ram, is_holiday, is_harvest,
               temp, rain]
        
        pred_price = model.predict([row])[0]
        # Ensure non-negative price
        pred_price = max(0, pred_price)
        
        forecast_rows.append({
            "date":       future_date.strftime("%Y-%m-%d"),
            "commodity":  commodity,
            "predicted":  round(pred_price, 0),
            "week_ahead": w,
        })

    # Smart buy alert
    current   = float(y[-1])
    pred_4w   = forecast_rows[3]["predicted"]
    pred_8w   = forecast_rows[7]["predicted"]
    change_4w = ((pred_4w - current) / current) * 100 if current != 0 else 0
    change_8w = ((pred_8w - current) / current) * 100 if current != 0 else 0

    if change_4w > 5:
        alert = "NUNUA_SASA"
        msg   = f"Bei itapanda {change_4w:.1f}% wiki 4 zijazo"
    elif change_4w < -5:
        alert = "SUBIRI"
        msg   = f"Bei itashuka {abs(change_4w):.1f}% wiki 4 zijazo"
    else:
        alert = "IMARA"
        msg   = "Bei iko imara — hakuna mabadiliko makubwa"

    results[commodity] = {
        "r2":          round(r2, 4),
        "mae":         round(mae, 2),
        "mape":        round(mape, 2),
        "accuracy_pct": round(r2 * 100, 1),
        "current_price": round(current, 0),
        "pred_4w":     round(pred_4w, 0),
        "pred_8w":     round(pred_8w, 0),
        "change_4w":   round(change_4w, 1),
        "change_8w":   round(change_8w, 1),
        "alert":       alert,
        "alert_msg":   msg,
        "forecast":    forecast_rows,
    }
    all_predictions.extend(forecast_rows)

# ─── Save outputs ─────────────────────────────────────────────────
output_dir = "SokoAI_NextJS_Project/sokoai-app/data"
os.makedirs(output_dir, exist_ok=True)

with open(os.path.join(output_dir, "model_results.json"), "w") as f:
    json.dump(results, f, indent=2)

pd.DataFrame(all_predictions).to_csv(
    os.path.join(output_dir, "predictions.csv"), index=False)

# Build historical data JSON for frontend charts
historical = {}
for commodity in commodities:
    sub = df[df["commodity"] == commodity][["date", "price"]].copy()
    sub["date"] = sub["date"].dt.strftime("%Y-%m-%d")
    historical[commodity] = sub.to_dict("records")

with open(os.path.join(output_dir, "historical.json"), "w") as f:
    json.dump(historical, f)

print("\n" + "=" * 55)
print("✅ Model training complete!")
print(f"   Predictions saved: {len(all_predictions)} rows")
avg_acc = np.mean([v["accuracy_pct"] for v in results.values()])
print(f"   Average accuracy : {avg_acc:.1f}%")
