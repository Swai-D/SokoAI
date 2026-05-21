import { getModelResults, COMMODITY_LABELS, COMMODITY_UNITS } from '@/lib/data';
import { NextResponse } from 'next/server';

function getAlertType(changePct) {
  if (changePct > 5)  return 'BUY_NOW';
  if (changePct < -5) return 'WAIT';
  return 'STABLE';
}

function getAlertMessage(changePct, commodity) {
  const label = COMMODITY_LABELS[commodity];
  if (changePct > 5)  return `${label} price will rise by ${changePct.toFixed(1)}% — buy now!`;
  if (changePct < -5) return `${label} price will drop by ${Math.abs(changePct).toFixed(1)}% — wait 4 weeks`;
  return `${label} price is stable — no significant change expected`;
}

export async function GET() {
  try {
    const results = getModelResults();
    const alerts = [];

    for (const [commodity, data] of Object.entries(results)) {
      const alertType = getAlertType(data.change_4w);
      alerts.push({
        commodity,
        label:         COMMODITY_LABELS[commodity],
        unit:          COMMODITY_UNITS[commodity],
        alert:         alertType,
        message:       getAlertMessage(data.change_4w, commodity),
        current_price: data.current_price,
        pred_4w:       data.pred_4w,
        pred_8w:       data.pred_8w,
        change_4w:     data.change_4w,
        change_8w:     data.change_8w,
        accuracy_pct:  data.accuracy_pct,
      });
    }

    // Priority sort: BUY_NOW first, then WAIT, then STABLE
    const priority = { BUY_NOW: 0, WAIT: 1, STABLE: 2 };
    alerts.sort((a, b) => priority[a.alert] - priority[b.alert]);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      total: alerts.length,
      alerts,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
