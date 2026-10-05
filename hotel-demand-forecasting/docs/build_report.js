const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, LevelFormat, ImageRun, PageBreak, Footer, PageNumber } = d;

const W = 9360; // content width (US Letter, 1" margins)
const P = (t, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: [new TextRun({ text: t, ...(o.run || {}) })] });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const B = (t, bold) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 },
  children: bold ? [new TextRun({ text: bold, bold: true }), new TextRun(t)] : [new TextRun(t)] });
const code = (txt) => txt.split('\n').map((l, i, a) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }, spacing: { after: i === a.length - 1 ? 160 : 0 },
  children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Courier New', size: 17 })] }));

const bd = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
function table(widths, header, rows) {
  const cell = (t, w, hdr) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: hdr ? { type: ShadingType.CLEAR, fill: '1F3A5F' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: hdr, size: 19, color: hdr ? 'FFFFFF' : '000000' })] })] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, widths[i], false)) }))] });
}
const img = (f, w, h, cap) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: w, height: h },
      altText: { title: cap, description: cap, name: cap } })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: cap, italics: true, size: 18 })] })];

const F = '../outputs/figures/';
const c = [];

// Title
c.push(new Paragraph({ spacing: { before: 1800, after: 200 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Predictive Modeling for Hospitality Demand Forecasting', bold: true, size: 44, color: '1F3A5F' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: '7-Day-Ahead Daily Hotel Occupancy Forecast', size: 28 })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Week 4 Internship Task: Modeling Plan and Implementation Report', size: 24, color: '555555' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Repository: hotel-demand-forecasting', size: 22, color: '555555' })] }));
c.push(new Paragraph({ children: [new PageBreak()] }));

// 1
c.push(H1('1. Problem Framing'));
c.push(P('Goal. Forecast the daily occupancy rate (rooms sold divided by rooms available) of a 200-room city hotel, 7 days before the stay date.'));
c.push(P('Why it matters. Occupancy is the central demand signal in hotel revenue management. A reliable one-week-ahead forecast supports:'));
c.push(B(' raise or lower room rates for dates that are tracking above or below expectation.', 'Dynamic pricing:'));
c.push(B(' schedule housekeeping, front desk and F&B staff to expected volume and avoid overtime or idle labour.', 'Staffing:'));
c.push(B(' order food, laundry and consumables in line with expected guests.', 'Procurement:'));
c.push(B(' decide when to open or close discount channels and overbooking limits.', 'Distribution:'));
c.push(P('Formulation. Supervised regression. Target y(t) = occupancy_rate on day t, predicted using only information available at day t-7 (forecast horizon h = 7). This constraint drives every feature decision and prevents data leakage.'));
c.push(P('Success criteria. Mean Absolute Error (MAE) in occupancy points, RMSE, and MAPE on a chronological hold-out window, benchmarked against a seasonal-naive baseline (occupancy on the same weekday one week earlier).'));

// 2
c.push(H1('2. Data'));
c.push(P('No private hotel data was available, so a synthetic dataset was generated (src/data_generator.py) with a fixed random seed for reproducibility. It covers 1,096 days (2022-01-01 to 2024-12-31). The generator embeds known real-world patterns so the model has genuine structure to learn:'));
c.push(B('annual seasonality (summer peak, smaller December peak) and a slow upward trend;'));
c.push(B('weekly pattern (Friday and Saturday highest, Sunday lowest);'));
c.push(B('public holidays, school-holiday windows and multi-day local events (conferences, concerts);'));
c.push(B('weather (temperature, rain), own ADR (average daily rate) and competitor ADR;'));
c.push(B('booking pace: share of the final occupancy already on the books 7 days before arrival.'));
c.push(P('The same pipeline accepts real data: replace data/hotel_daily.csv with a property management system (PMS) export using the same columns. Public alternatives include the Hotel Booking Demand dataset (Antonio et al., Kaggle) and city-level tourism statistics.'));

// 3
c.push(H1('3. Feature Selection and Rationale'));
c.push(P('Features fall into six groups. Everything is either known in advance (calendar, events, planned price, forecast weather) or shifted by 7 days (history), so no information from the forecast window leaks into training.'));
c.push(table([2100, 1500, 5760], ['Feature', 'Group', 'Rationale'], [
  ['dow, is_weekend', 'Calendar', 'Leisure and business travel follow a strong weekly cycle; Friday/Saturday behave differently from midweek.'],
  ['month, doy_sin, doy_cos', 'Calendar', 'Captures annual seasonality smoothly; sin/cos encoding keeps 31 Dec close to 1 Jan.'],
  ['is_holiday, is_school_holiday', 'Calendar', 'Holidays and school breaks shift leisure demand and length of stay.'],
  ['local_event', 'Event', 'Conferences, concerts and festivals cause demand spikes that history alone cannot explain.'],
  ['temperature_c, rain', 'Weather', 'Weather forecasts influence leisure bookings and last-minute demand.'],
  ['adr, price_gap', 'Price', 'Own rate and the gap to the competitor reflect price elasticity and market position.'],
  ['otb_occupancy_7d', 'Booking pace', 'Reservations already on the books 7 days out are the strongest early indicator of final occupancy.'],
  ['lag_7, lag_14, lag_21, lag_28', 'History', 'Recent same-weekday occupancy (all at least 7 days old, so available at forecast time).'],
  ['lag_364', 'History', 'Same weekday last year: anchors yearly seasonality and holiday effects.'],
  ['roll_mean_7, roll_mean_28, roll_std_7', 'History', 'Short- and medium-term level and volatility of demand, shifted by 7 days.'],
]));
c.push(P('', {}));
c.push(P('Leakage control. For lag and rolling features the code calls shift(7) before computing windows. Rows with missing values caused by lags (the first 364 days) are dropped, leaving 732 modeling rows.'));
c.push(P('Not used (extensions). Cancellation rate, length-of-stay mix, channel mix, search/web-traffic data, flight arrivals and macro indicators would likely improve a production model.'));

// 4
c.push(H1('4. Model Choice and Justification'));
c.push(P('Rather than committing to a single algorithm in advance, four approaches are compared on identical splits. Each one answers a different question.'));
c.push(table([2300, 3500, 3560], ['Model', 'Why it is considered', 'Trade-offs'], [
  ['Seasonal naive (baseline)', 'Predicts occupancy = same weekday last week. Any useful model must beat this cheap rule.', 'Ignores events, price, weather and trend.'],
  ['Ridge regression', 'Linear, regularised, fast, and interpretable (coefficients show direction and size of each driver). Handles correlated lag features through the L2 penalty.', 'Cannot capture non-linear effects or interactions unless engineered.'],
  ['Random Forest', 'Captures non-linearities and interactions (e.g. event x weekend) with little preprocessing; robust to outliers.', 'Cannot extrapolate beyond training range (a trend risk); larger and slower.'],
  ['Gradient Boosting (HistGradientBoosting)', 'State-of-the-art for tabular data; models complex interactions; fast on this size; usually the strongest on real demand data.', 'More hyperparameters, easier to overfit with small data.'],
]));
c.push(P('', {}));
c.push(P('Why feature-based machine learning instead of classical time-series models (ARIMA, SARIMA, Prophet)? Occupancy depends on many external regressors (events, price, weather, booking pace). A supervised regression formulation incorporates them naturally, supports a direct 7-day horizon without recursive error accumulation, and allows model comparison with standard tooling. Classical time-series models remain a good complement and baseline for future work.'));
c.push(P('Why not deep learning (LSTM, Temporal Fusion Transformer)? With about 730 usable daily rows, deep models are likely to overfit and add complexity without clear benefit. They become attractive with multi-property or room-night-level data.'));

// 5
c.push(H1('5. Validation Strategy'));
c.push(P('Time-series data must never be shuffled: random k-fold would train on the future and report over-optimistic scores. The strategy is:'));
c.push(B(' split the engineered dataset chronologically into train (first 372 rows), validation (next 180 rows) and test (final 180 rows). The test window is never used for tuning.', 'Chronological split:'));
c.push(B(' RandomizedSearchCV with TimeSeriesSplit(n_splits=5) on train + validation. Each fold trains on the past and validates on the following block (expanding window). Scoring metric is negative MAE.', 'Hyperparameter tuning:'));
c.push(B(' the tuned model is scored once on the held-out test window.', 'Final test:'));
c.push(B(' MAE (interpretable in occupancy points), RMSE (penalises large misses, important for overbooking risk) and MAPE (relative error).', 'Metrics:'));
c.push(B(' permutation importance on the test set, residual histogram and forecast-versus-actual plot.', 'Diagnostics:'));

// 6
c.push(H1('6. Implementation Plan'));
c.push(H2('6.1 Libraries'));
c.push(P('numpy, pandas (data and features), scikit-learn (models, pipelines, CV, metrics), matplotlib (figures), joblib (model persistence). Python 3.10 or newer.'));
c.push(H2('6.2 Pseudocode'));
c.push(...code(`LOAD daily data (date, occupancy, price, events, weather, bookings-on-the-books)
FOR each feature group:
    calendar  <- day-of-week, month, sin/cos of day-of-year, holiday flags
    known     <- event flag, temperature, rain, ADR, price gap, booking pace
    history   <- lags {7,14,21,28,364} and rolling mean/std, ALL shifted by horizon=7
DROP rows with missing values created by lags
SPLIT chronologically: train | validation | test (last 180 days)
FOR model IN {Ridge, RandomForest, GradientBoosting}:
    search <- RandomizedSearchCV(model, grid, cv=TimeSeriesSplit(5), scoring=MAE)
    fit search on train+validation
    predict test window
    record MAE, RMSE, MAPE
COMPARE against seasonal-naive baseline
SELECT lowest test MAE, SAVE model, PLOT forecasts, importance, residuals`));
c.push(H2('6.3 Key code snippets'));
c.push(P('Leakage-safe feature engineering (src/features.py):'));
c.push(...code(`s = df["occupancy_rate"]
for lag in (7, 14, 21, 28, 364):
    out[f"lag_{lag}"] = s.shift(lag)
out["roll_mean_7"]  = s.shift(7).rolling(7).mean()
out["roll_mean_28"] = s.shift(7).rolling(28).mean()
out["roll_std_7"]   = s.shift(7).rolling(7).std()`));
c.push(P('Chronological split and time-series cross-validated tuning (src/train.py):'));
c.push(...code(`test  = df.iloc[-180:]
val   = df.iloc[-360:-180]
train = df.iloc[:-360]
trainval = pd.concat([train, val])

tscv = TimeSeriesSplit(n_splits=5)
search = RandomizedSearchCV(
    HistGradientBoostingRegressor(random_state=42),
    {"learning_rate": [0.03, 0.05, 0.1], "max_depth": [3, 5, None],
     "max_iter": [200, 400], "l2_regularization": [0.0, 0.1, 1.0],
     "min_samples_leaf": [10, 20, 40]},
    n_iter=8, cv=tscv, scoring="neg_mean_absolute_error",
    random_state=42, n_jobs=-1)
search.fit(trainval[cols], trainval["occupancy_rate"])
pred = search.best_estimator_.predict(test[cols])`));
c.push(H2('6.4 Hyperparameters searched'));
c.push(table([2300, 7060], ['Model', 'Search space'], [
  ['Ridge (with StandardScaler)', 'alpha in {0.01, 0.1, 1, 10, 100}'],
  ['Random Forest', 'n_estimators {200, 400}; max_depth {6, 10, None}; min_samples_leaf {2, 5, 10}; max_features {0.5, 0.8, 1.0}'],
  ['Gradient Boosting', 'learning_rate {0.03, 0.05, 0.1}; max_depth {3, 5, None}; max_iter {200, 400}; l2_regularization {0, 0.1, 1}; min_samples_leaf {10, 20, 40}'],
]));
c.push(P('', {}));

// 7
c.push(H1('7. Results'));
c.push(P('Results on the held-out test window (last 180 days). Occupancy is expressed as a fraction, so MAE 0.031 means about 3.1 percentage points (roughly 6 rooms of 200).'));
c.push(table([3000, 1590, 1590, 1590, 1590], ['Model', 'MAE', 'RMSE', 'MAPE %', 'CV MAE'], [
  ['Ridge (selected)', '0.0306', '0.0381', '4.27', '0.0337'],
  ['Gradient Boosting', '0.0334', '0.0415', '4.76', '0.0455'],
  ['Random Forest', '0.0386', '0.0462', '5.33', '0.0480'],
  ['Seasonal naive (lag 7)', '0.0845', '0.1041', '12.34', 'n/a'],
]));
c.push(P('', {}));
c.push(P('All learned models cut the baseline error by roughly 55 to 64 percent. Ridge came out slightly ahead of the tree ensembles. This is expected here: the synthetic data was generated from largely additive effects, and with only 552 training rows a regularised linear model has low variance. On real data, with non-linear effects such as event-by-weekend interactions and sell-out capping near 100 percent, gradient boosting would typically be expected to match or beat Ridge. The pipeline lets that be checked simply by re-running it on real data.'));
c.push(...img(F + 'forecast_vs_actual.png', 600, 218, 'Figure 1. Forecast versus actual occupancy on the test window'));
c.push(...img(F + 'model_comparison.png', 400, 229, 'Figure 2. Test MAE by model'));
c.push(...img(F + 'feature_importance.png', 400, 286, 'Figure 3. Permutation importance of the selected model'));
c.push(P('Interpretation of importance. Price gap, booking pace (on-the-books occupancy) and temperature drive the largest accuracy loss when shuffled. Booking pace being near the top matches industry practice. The high rank of price gap partly reflects how the synthetic data was generated, and should not be read as a real-world finding.'));
c.push(...img(F + 'residuals.png', 330, 220, 'Figure 4. Residuals are centred near zero with no heavy tails'));

// 8
c.push(H1('8. Assumptions'));
c.push(B('The hotel is a single property with fixed capacity of 200 rooms; demand is not capped by sell-outs in the data.'));
c.push(B('The forecast is produced exactly 7 days before arrival, and booking pace, planned ADR, competitor ADR and weather forecasts are available at that time.'));
c.push(B('Weather forecasts are treated as accurate (the synthetic temperature is the actual value). Real forecast error would reduce accuracy.'));
c.push(B('Relationships between drivers and demand are stable over time (no structural break such as a pandemic).'));
c.push(B('Occupancy is the target; revenue-related targets (RevPAR) would need an additional price model.'));

// 9
c.push(H1('9. Strengths'));
c.push(B('Leakage-safe design: every feature respects the 7-day information cut-off.'));
c.push(B('Honest validation: chronological split, expanding-window CV and an untouched test set.'));
c.push(B('Benchmarked against a simple baseline, and multiple model families compared rather than assuming one winner.'));
c.push(B('Interpretable: linear coefficients and permutation importance explain what drives occupancy to revenue managers.'));
c.push(B('Reproducible and extensible: fixed seeds, modular code and a CSV interface that real PMS data can replace.'));

// 10
c.push(H1('10. Limitations and Challenges'));
c.push(B(' Results are illustrative. Real data contains noise, outliers, cancellations, no-shows, group blocks and data-entry errors, and will give lower accuracy.', 'Synthetic data:'));
c.push(B(' Only about two years of modeling rows remain after the 364-day lag, which limits how much complexity the models can use and makes the annual lag feature costly.', 'Small sample:'));
c.push(B(' When a hotel sells out, observed occupancy understates true demand. A production system should model unconstrained demand.', 'Censored demand:'));
c.push(B(' Unusual events (pandemics, strikes, extreme weather) are not predictable from history and cause large errors.', 'Structural breaks:'));
c.push(B(' Rates are partly set in reaction to expected demand, so price features can be correlated with the target in ways that do not imply causation.', 'Price endogeneity:'));
c.push(B(' Forecasts are point estimates only; revenue managers also need prediction intervals.', 'No uncertainty estimate:'));
c.push(B(' Models will degrade as behaviour shifts and need scheduled retraining and monitoring of MAE over time.', 'Concept drift:'));

// 11
c.push(H1('11. Future Improvements'));
c.push(B('Add prediction intervals (quantile gradient boosting or conformal prediction).'));
c.push(B('Test multiple horizons (1, 14, 30 days) and a SARIMAX or Prophet benchmark.'));
c.push(B('Use real PMS data with cancellation rate, channel and length-of-stay features, and model unconstrained demand.'));
c.push(B('Add external signals: flight arrivals, event calendars, search-engine and web-traffic trends.'));
c.push(B('Package as a scheduled job with MLflow tracking and drift monitoring.'));

// 12
c.push(H1('12. Reproducing the Results'));
c.push(...code(`git clone <repo-url> && cd hotel-demand-forecasting
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.data_generator
python -m src.train
python -m src.predict`));
c.push(P('Outputs are written to outputs/ (model_comparison.csv, feature_importance.csv, figures/) and models/best_model.joblib.'));

const doc = new Document({
  creator: 'Intern', title: 'Hotel Demand Forecasting Modeling Plan',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, color: '1F3A5F', font: 'Calibri' }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: '2F5D8C', font: 'Calibri' }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
    ] },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Page ', size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
    children: c }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync('Hotel_Demand_Forecasting_Report.docx', b); console.log('ok'); });
