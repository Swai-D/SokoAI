'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { getAlert, getCommodityMeta, fmtTZS, fmtShort, fmtDate } from '@/lib/utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
      <p style={{ color:'#94a3b8', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => p.value && (
        <p key={i} style={{ color:p.color, margin:0, fontWeight:600 }}>
          {p.name === 'actual' ? '📊 Actual' : '🤖 Forecast'}: {fmtTZS(p.value)}
        </p>
      ))}
    </div>
  );
};

function SkeletonCard({ h = 80 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 14 }} />;
}

export default function Dashboard() {
  const [alerts, setAlerts]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [predData, setPredData] = useState(null);
  const [error, setError]       = useState(null);

  // Load all alerts on mount
  useEffect(() => {
    fetch('/api/alerts')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        const list = d.alerts || [];
        setAlerts(list);
        if (list.length) setSelected(list[0].commodity);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Load chart + prediction when commodity changes
  useEffect(() => {
    if (!selected) return;
    setChartLoading(true);
    Promise.all([
      fetch(`/api/prices?commodity=${selected}&weeks=20`).then(r => r.json()),
      fetch(`/api/predict?commodity=${selected}&weeks=8`).then(r => r.json()),
    ])
      .then(([hist, pred]) => {
        const histPoints = (hist.prices || []).map(p => ({
          date: fmtDate(p.date),
          actual: p.price,
          forecast: null,
        }));
        const lastPrice = histPoints.at(-1)?.actual;
        const predPoints = (pred.forecast || []).map((f, i) => ({
          date: fmtDate(f.date),
          actual: i === 0 ? lastPrice : null,
          forecast: f.predicted,
        }));
        setChartData([...histPoints, ...predPoints]);
        setPredData(pred);
        setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [selected]);

  const currentAlert = alerts.find(a => a.commodity === selected);
  const ac = getAlert(currentAlert?.alert);
  const meta = getCommodityMeta(selected);

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div style={{ fontSize:36 }}>⚠️</div>
      <div style={{ color:'#ef4444', fontSize:15, fontWeight:600 }}>API haipo au kuna tatizo la connection</div>
      <div style={{ color:'#64748b', fontSize:13 }}>{error}</div>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Jaribu tena</button>
    </div>
  );

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

      {/* ── Page title ── */}
      <div className="fade-up" style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.4px' }}>
          Bei za Masoko <span style={{ color:'#3b82f6' }}>Dar es Salaam</span>
        </h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
          Bei za bidhaa za chakula na utabiri wa wiki 8 zijazo
        </p>
      </div>

      {/* ── Commodity Tabs ── */}
      <div className="fade-up-1" style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {loading
          ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ width:120, height:40, borderRadius:10 }} />)
          : alerts.map(a => {
              const cfg = getAlert(a.alert);
              const active = selected === a.commodity;
              const m = getCommodityMeta(a.commodity);
              return (
                <button key={a.commodity} onClick={() => setSelected(a.commodity)} style={{
                  background: active ? '#1d4ed8' : '#0d1829',
                  border: active ? '1px solid #3b82f6' : '1px solid #1e3a5f',
                  borderRadius:10, padding:'9px 16px',
                  color: active ? '#fff' : '#94a3b8',
                  fontSize:13, fontWeight: active ? 600 : 400,
                  display:'flex', alignItems:'center', gap:8,
                  transition:'all .15s', cursor:'pointer',
                }}>
                  {m.icon} {a.label ?? m.sw}
                  <span style={{ background: cfg.color + '22', color: cfg.color, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })
        }
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
          <SkeletonCard h={360} />
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <SkeletonCard h={160} /><SkeletonCard h={130} /><SkeletonCard h={160} />
          </div>
        </div>
      ) : (
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>

          {/* ── Chart ── */}
          <div className="card" style={{ padding:'20px 20px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>
                  {meta.icon} {meta.sw} — Bei na Utabiri
                </div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                  Historia ya wiki 20 + AI forecast wiki 8
                </div>
              </div>
              {currentAlert && (
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'#f1f5f9', fontFamily:'var(--font-mono)' }}>
                    {fmtTZS(currentAlert.current_price)}
                  </div>
                  <div style={{ fontSize:11, color:'#64748b' }}>Bei ya sasa / {currentAlert.unit ?? 'kg'}</div>
                </div>
              )}
            </div>

            {chartLoading ? (
              <div className="skeleton" style={{ height:260, borderRadius:8 }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <defs>
                    <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="actual"   name="actual"   stroke="#3b82f6" strokeWidth={2} fill="url(#gH)" dot={false} connectNulls={false} />
                  <Area type="monotone" dataKey="forecast" name="forecast" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 3" fill="url(#gP)" dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            <div style={{ display:'flex', gap:20, justifyContent:'center', marginTop:10 }}>
              {[['#3b82f6','Bei halisi'],['#a855f7','AI Forecast']].map(([c,l]) => (
                <span key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
                  <span style={{ display:'inline-block', width:16, height:2, background:c, borderRadius:2 }} /> {l}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Alert card */}
            {currentAlert && (
              <div style={{ background:ac.bg, border:`1.5px solid ${ac.border}`, borderRadius:14, padding:18 }}>
                <div style={{ fontSize:10, fontWeight:700, color:ac.color, letterSpacing:'0.8px', marginBottom:10 }}>
                  {ac.icon} MAPENDEKEZO YA AI
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:ac.color, marginBottom:6 }}>{ac.label}</div>
                <div style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.6 }}>{currentAlert.message}</div>
                <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['Sasa', currentAlert.current_price, '#f1f5f9'],['Wiki 4', currentAlert.pred_4w, ac.color]].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'9px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>{lbl}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:col, fontFamily:'var(--font-mono)' }}>
                        {fmtTZS(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model stats */}
            {predData && (
              <div className="card" style={{ padding:16 }}>
                <div className="label" style={{ marginBottom:14 }}>Model Statistics</div>
                {[
                  ['Usahihi (R²)',  `${predData.model?.accuracy_pct ?? '—'}%`, '#22c55e'],
                  ['MAE',          `TZS ${predData.model?.mae ?? '—'}`,        '#94a3b8'],
                  ['MAPE',         `${predData.model?.mape ?? '—'}%`,          '#94a3b8'],
                ].map(([k,v,c]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:9, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#64748b' }}>{k}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c, fontFamily:'var(--font-mono)' }}>{v}</span>
                  </div>
                ))}
                <div style={{ background:'#0f172a', borderRadius:6, height:5, marginTop:10 }}>
                  <div style={{ background:'linear-gradient(90deg,#22c55e,#86efac)', height:'100%', borderRadius:6,
                    width:`${predData.model?.accuracy_pct ?? 0}%`, transition:'width .8s ease' }} />
                </div>
              </div>
            )}

            {/* All commodities list */}
            <div className="card" style={{ padding:16, flex:1 }}>
              <div className="label" style={{ marginBottom:12 }}>Bidhaa Zote</div>
              {alerts.map((a, i) => {
                const cfg = getAlert(a.alert);
                const m   = getCommodityMeta(a.commodity);
                return (
                  <div key={a.commodity} onClick={() => setSelected(a.commodity)} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'9px 0', borderBottom: i < alerts.length-1 ? '1px solid #0f172a' : 'none',
                    cursor:'pointer', opacity: selected === a.commodity ? 1 : 0.6,
                    transition:'opacity .15s',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16 }}>{m.icon}</span>
                      <span style={{ fontSize:12, color:'#cbd5e1' }}>{a.label ?? m.sw}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#f1f5f9', fontFamily:'var(--font-mono)' }}>
                        {fmtShort(a.current_price)}
                      </div>
                      <div style={{ fontSize:10, color:cfg.color, fontWeight:700 }}>{cfg.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 8-Week Forecast Table ── */}
      {predData && !chartLoading && (
        <div className="card fade-up-3" style={{ padding:20, marginTop:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:14 }}>
            🤖 Utabiri wa Wiki 8 — {meta.icon} {meta.sw}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:8 }}>
            {predData.forecast?.map((row, i) => {
              const prev = i === 0 ? currentAlert?.current_price : predData.forecast[i-1].predicted;
              const isUp = row.predicted > prev;
              return (
                <div key={i} style={{ background:'#0f172a', borderRadius:10, padding:'10px 8px', textAlign:'center', border:'1px solid #1e3a5f' }}>
                  <div style={{ fontSize:10, color:'#475569', marginBottom:2 }}>Wiki {i+1}</div>
                  <div style={{ fontSize:10, color:'#64748b', marginBottom:6 }}>{fmtDate(row.date)}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', fontFamily:'var(--font-mono)' }}>
                    {fmtShort(row.predicted)}
                  </div>
                  <div style={{ fontSize:12, color: isUp ? '#ef4444' : '#22c55e', marginTop:3 }}>
                    {isUp ? '▲' : '▼'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer style={{ textAlign:'center', marginTop:24, fontSize:11, color:'#1e3a5f', paddingBottom:24 }}>
        SokoAI v2.0 · Masoko ya DSM (Ilala, Tandale, Tandika, Temeke, Kariakoo) · Powered by Prophet + XGBoost
      </footer>
    </div>
  );
}
