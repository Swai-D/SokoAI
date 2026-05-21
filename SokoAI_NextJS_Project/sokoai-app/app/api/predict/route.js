import { getModelResults, COMMODITY_LABELS, COMMODITY_UNITS } from '@/lib/data';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const commodity = searchParams.get('commodity') || 'mchele';
    const weeks     = parseInt(searchParams.get('weeks') || '8');

    const results = getModelResults();

    if (!results[commodity]) {
      return NextResponse.json(
        { error: `Commodity "${commodity}" haipatikani` },
        { status: 400 }
      );
    }

    const data = results[commodity];

    return NextResponse.json({
      commodity,
      label:        COMMODITY_LABELS[commodity],
      unit:         COMMODITY_UNITS[commodity],
      current_price: data.current_price,
      model: {
        r2:           data.r2,
        mae:          data.mae,
        mape:         data.mape,
        accuracy_pct: data.accuracy_pct,
      },
      forecast: data.forecast.slice(0, weeks).map(f => ({
        date:       f.date,
        predicted:  f.predicted,
        week_ahead: f.week_ahead,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
