import { getHistorical, COMMODITY_LABELS } from '@/lib/data';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const commodity = searchParams.get('commodity') || 'mchele';
    const weeks     = parseInt(searchParams.get('weeks') || '20');

    const all = getHistorical();

    if (!all[commodity]) {
      return NextResponse.json(
        { error: `Commodity "${commodity}" haipatikani` },
        { status: 400 }
      );
    }

    const prices = all[commodity].slice(-weeks).map(row => ({
      date:  row.date,
      price: row.price,
      type:  'halisi',
    }));

    return NextResponse.json({
      commodity,
      label:  COMMODITY_LABELS[commodity],
      prices,
      count:  prices.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
