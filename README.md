# SokoAI — Intelligent Commodity Price Forecasting for Dar es Salaam

SokoAI is a machine learning-driven platform designed to track, analyze, and forecast wholesale prices for major food commodities in Dar es Salaam, Tanzania. The system automates data collection from the Ministry of Industry and Trade (MIT), processes it using advanced ML algorithms, and provides actionable "Smart Buy" alerts via a modern web dashboard.

## 🚀 Key Features
- **Automated Data Pipeline**: Scrapes and parses official MIT PDF reports daily.
- **3-Year Historical Context**: Pre-loaded with actual market data from May 2023 to May 2026.
- **Precision Forecasting**: Predicts prices for the next 16 weeks with **95.1% average accuracy**.
- **Smart Buy Alerts**: Color-coded indicators (BUY NOW, WAIT, STABLE) based on predicted 4-week price shifts.
- **Dynamic Feature Engineering**: Accounts for Tanzania-specific variables:
  - **Harvest Seasons**: Integrated price drops during May–August.
  - **Weather Trends**: Correlation with rainfall (mm) and temperature (°C).
  - **Dynamic Ramadhan**: Hijri-adjusted tracking for accurate holiday supply-demand shifts.

## 📦 Project Structure
- `/data`: Contains the core dataset (`bei_sokoni.csv`) and 240+ raw PDF reports.
- `/scripts`: The backend engine:
  - `daily_bot.py`: Cron-ready script for daily data updates and model retraining.
  - `train_model.py`: Polynomial Ridge Regression training script.
  - `parser.py`: Advanced PDF extractor for Dar es Salaam market data.
  - `historical_downloader.py`: Bulk scraper for historical records.
- `/SokoAI_NextJS_Project`: Modern Next.js (React) web dashboard.
- `/docs`: Project reports, architecture diagrams, and presentations.

## 🛠️ Technology Stack
- **Backend**: Python 3.x (Pandas, Scikit-Learn, PDFPlumber, BeautifulSoup4)
- **Frontend**: Next.js 15, Tailwind CSS, Recharts
- **Database**: PostgreSQL / Local CSV Storage
- **ML Algorithm**: Polynomial Ridge Regression (Degree 2)

## 📋 Installation & Setup

### 1. Requirements
Ensure you have Python 3.10+ and Node.js installed.

### 2. Python Environment Setup
```bash
# Install dependencies
pip install pandas numpy scikit-learn pdfplumber beautifulsoup4 requests hijri-converter
```

### 3. Run the Data Pipeline
```bash
# Update dataset with latest MIT reports
python scripts/daily_bot.py

# Manually retrain the model
python scripts/train_model.py
```

### 4. Frontend Setup
```bash
cd SokoAI_NextJS_Project/sokoai-app
npm install
npm run dev
```
Open `http://localhost:3000` to view the dashboard.

## 📈 ML Model Performance
The model is trained on averaged data from 5 major DSM markets (**Ilala, Tandale, Tandika, Temeke, and Mabibo**) for the following commodities:
- **Maize (Mahindi)**: 95.0% Accuracy
- **Rice (Mchele)**: 97.2% Accuracy
- **Beans (Maharage)**: 98.4% Accuracy
- **Potatoes (Viazi Mviringo)**: 95.0% Accuracy
- **Wheat Grain (Ngano)**: 90.1% Accuracy

## 🤖 Automation (Cron Job)
To keep SokoAI updated automatically, add this to your server's crontab:
```bash
0 17 * * * /usr/bin/python3 /path/to/sokoai/scripts/daily_bot.py
```

---
**Developed by Terra Consultant Limited**
"Empowering Tanzanian Markets with Data."
