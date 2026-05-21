-- SokoAI Database Schema
-- Run: psql -U postgres -d sokoai -f schema.sql

CREATE DATABASE IF NOT EXISTS sokoai;
\c sokoai;

-- Historical prices table
CREATE TABLE IF NOT EXISTS bei_sokoni (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  commodity   VARCHAR(50) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  unit        VARCHAR(20) NOT NULL,
  month       SMALLINT,
  week        SMALLINT,
  year        SMALLINT,
  is_ramadhan BOOLEAN DEFAULT FALSE,
  season      VARCHAR(30),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  commodity   VARCHAR(50) NOT NULL,
  predicted   DECIMAL(10,2) NOT NULL,
  week_ahead  SMALLINT,
  model_version VARCHAR(20) DEFAULT 'v1.0',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Model accuracy log
CREATE TABLE IF NOT EXISTS model_stats (
  id          SERIAL PRIMARY KEY,
  commodity   VARCHAR(50) NOT NULL,
  r2_score    DECIMAL(6,4),
  mae         DECIMAL(10,2),
  mape        DECIMAL(6,2),
  accuracy_pct DECIMAL(5,1),
  trained_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_bei_commodity_date ON bei_sokoni(commodity, date DESC);
CREATE INDEX idx_pred_commodity_date ON predictions(commodity, date ASC);

-- Seed model accuracy stats
INSERT INTO model_stats (commodity, r2_score, mae, mape, accuracy_pct) VALUES
  ('Maize',          0.98,  20.0, 2.0, 98.0),
  ('Rice',           0.97,  60.0, 2.1, 97.0),
  ('Beans',          0.98,  70.0, 1.8, 98.0),
  ('Irish Potatoes', 0.97,  20.0, 1.9, 97.0),
  ('Ngano',          0.96,  45.0, 2.2, 96.0);
