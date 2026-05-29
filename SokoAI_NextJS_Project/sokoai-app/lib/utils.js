// ── Alert config (maps backend Kiswahili → display) ────────────
export const ALERT_MAP = {
  NUNUA_SASA: { key: 'NUNUA_SASA', color: '#ef4444', bg: '#1a0505', border: '#7f1d1d', label: 'NUNUA SASA', en: 'BUY NOW',  icon: '🔴' },
  SUBIRI:     { key: 'SUBIRI',     color: '#22c55e', bg: '#051a0d', border: '#14532d', label: 'SUBIRI',     en: 'WAIT',     icon: '🟢' },
  IMARA:      { key: 'IMARA',      color: '#f59e0b', bg: '#1a1005', border: '#78350f', label: 'IMARA',      en: 'STABLE',   icon: '🟡' },
  // Legacy English keys (backward compat)
  BUY_NOW:    { key: 'NUNUA_SASA', color: '#ef4444', bg: '#1a0505', border: '#7f1d1d', label: 'NUNUA SASA', en: 'BUY NOW',  icon: '🔴' },
  WAIT:       { key: 'SUBIRI',     color: '#22c55e', bg: '#051a0d', border: '#14532d', label: 'SUBIRI',     en: 'WAIT',     icon: '🟢' },
  STABLE:     { key: 'IMARA',      color: '#f59e0b', bg: '#1a1005', border: '#78350f', label: 'IMARA',      en: 'STABLE',   icon: '🟡' },
};

export function getAlert(key) {
  return ALERT_MAP[key] ?? ALERT_MAP.IMARA;
}

// ── Commodity icons & labels ────────────────────────────────────
export const COMMODITY_META = {
  Maize:           { icon: '🌽', sw: 'Mahindi' },
  Mahindi:         { icon: '🌽', sw: 'Mahindi' },
  Rice:            { icon: '🍚', sw: 'Mchele' },
  Mchele:          { icon: '🍚', sw: 'Mchele' },
  Beans:           { icon: '🫘', sw: 'Maharage' },
  Maharage:        { icon: '🫘', sw: 'Maharage' },
  'Irish Potatoes':{ icon: '🥔', sw: 'Viazi' },
  Viazi:           { icon: '🥔', sw: 'Viazi' },
  Ngano:           { icon: '🌾', sw: 'Ngano' },
  Sukari:          { icon: '🧂', sw: 'Sukari' },
  'Mafuta ya Kupikia': { icon: '🫙', sw: 'Mafuta' },
  Nyanya:          { icon: '🍅', sw: 'Nyanya' },
  Vitunguu:        { icon: '🧅', sw: 'Vitunguu' },
  Hoho:            { icon: '🫑', sw: 'Hoho' },
  Karoti:          { icon: '🥕', sw: 'Karoti' },
  Bamia:           { icon: '🥬', sw: 'Bamia' },
};

export function getCommodityMeta(name) {
  return COMMODITY_META[name] ?? { icon: '📦', sw: name };
}

// ── Number formatting ───────────────────────────────────────────
export function fmtTZS(n) {
  if (!n && n !== 0) return '—';
  return `TZS ${Number(n).toLocaleString('en-TZ')}`;
}

export function fmtShort(n) {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toString();
}

// ── Date helpers ────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' });
}

// ── API fetcher with error handling ────────────────────────────
export async function apiFetch(path, opts = {}) {
  const apiKey = typeof window !== 'undefined'
    ? localStorage.getItem('sokoai_api_key') : null;

  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(opts.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message ?? err?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Category colors ─────────────────────────────────────────────
export const CATEGORY_COLOR = {
  NAFAKA:  '#3b82f6',
  MBOGA:   '#22c55e',
  MATUNDA: '#f59e0b',
  SAMAKI:  '#06b6d4',
  NYAMA:   '#ef4444',
  GENERAL: '#94a3b8',
};
