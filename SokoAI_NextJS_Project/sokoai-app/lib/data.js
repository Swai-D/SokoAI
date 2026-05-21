import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export function getHistorical() {
  const raw = fs.readFileSync(path.join(dataDir, 'historical.json'), 'utf-8');
  return JSON.parse(raw);
}

export function getModelResults() {
  const raw = fs.readFileSync(path.join(dataDir, 'model_results.json'), 'utf-8');
  return JSON.parse(raw);
}

export const COMMODITY_LABELS = {
  Maize: 'Mahindi (Maize)',
  Rice: 'Mchele (Rice)',
  Beans: 'Maharage (Beans)',
  'Irish Potatoes': 'Viazi Mviringo (Potatoes)',
  Ngano: 'Ngano (Wheat Grain)',
};

export const COMMODITY_UNITS = {
  Maize: 'kg', 
  Rice: 'kg',
  Beans: 'kg', 
  'Irish Potatoes': 'kg', 
  Ngano: 'kg',
};
