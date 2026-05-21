'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ICONS   = { Maize: '🌽', Rice: '🍚', Beans: '🫘', 'Irish Potatoes': '🥔', Ngano: '🌾' };
const ALERT_CFG = {
  BUY_NOW: { color:'#ef4444', bg:'#450a0a', border:'#7f1d1d', label:'BUY NOW',  icon:'🔴' },
  WAIT:    { color:'#22c55e', bg:'#052e16', border:'#14532d', label:'WAIT',     icon:'🟢' },
  STABLE:  { color:'#f59e0b', bg:'#1c1403', border:'#78350f', label:'STABLE',   icon:'🟡' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
      <p style={{ color:'#94a3b8', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => p.value && (
        <p key={i} style={{ color:p.color, margin:0, fontWeight:600 }}>
          {p.name === 'actual' ? '📊 Actual' : '🤖 Forecast'}: TZS {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [alerts, setAlerts]     = useState([]);
  const [selected, setSelected] = useState('Rice');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [predData, setPredData] = useState(null);

  // Load all alerts on mount
  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts || []); setLoading(false); });
  }, []);

  // Load chart + prediction data when commodity changes
  useEffect(() => {
    if (!selected) return;
    Promise.all([
      fetch(`/api/prices?commodity=${selected}&weeks=20`).then(r => r.json()),
      fetch(`/api/predict?commodity=${selected}&weeks=8`).then(r => r.json()),
    ]).then(([hist, pred]) => {
      const histPoints = (hist.prices || []).map(p => ({
        date:   p.date.slice(5),   // MM-DD
        actual: p.price,
        forecast: null,
      }));
      const lastPrice = histPoints.at(-1)?.actual;
      const predPoints = (pred.forecast || []).map((f, i) => ({
        date:   f.date.slice(5),
        actual: i === 0 ? lastPrice : null,
        forecast: f.predicted,
      }));
      setChartData([...histPoints, ...predPoints]);
      setPredData(pred);
    });
  }, [selected]);

  const currentAlert = alerts.find(a => a.commodity === selected);
  const ac = currentAlert ? ALERT_CFG[currentAlert.alert] : ALERT_CFG.STABLE;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-main)' }}>

      {/* ── Header ── */}
      <header style={{ background:'linear-gradient(135deg,#1e3a5f,#1e293b)', borderBottom:'1px solid #1e3a5f', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'#3b82f6', borderRadius:10, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📈</div>
          <div>
            <div style={{ fontWeight:700, fontSize:20, color:'#f1f5f9', letterSpacing:'-0.3px' }}>SokoAI</div>
            <div style={{ fontSize:11, color:'#64748b', letterSpacing:'0.5px' }}>MARKET PRICE PREDICTION SYSTEM · DAR ES SALAAM</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#0f172a', borderRadius:8, padding:'6px 14px', border:'1px solid #1e3a5f' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e' }} />
          <span style={{ fontSize:12, color:'#64748b' }}>Model Active · Accuracy 86.7%</span>
        </div>
      </header>

      <main style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

        {/* ── Commodity Tabs ── */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {alerts.map(a => {
            const cfg = ALERT_CFG[a.alert] || ALERT_CFG.STABLE;
            const active = selected === a.commodity;
            return (
              <button key={a.commodity} onClick={() => setSelected(a.commodity)} style={{
                background: active ? '#3b82f6' : '#1e293b',
                border: active ? '1px solid #3b82f6' : '1px solid #334155',
                borderRadius:10, padding:'9px 16px',
                color: active ? '#fff' : '#94a3b8',
                fontSize:13, fontWeight: active ? 600 : 400,
                display:'flex', alignItems:'center', gap:8, transition:'all .15s',
              }}>
                {ICONS[a.commodity]} {a.label}
                <span style={{ background:cfg.color+'22', color:cfg.color, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:80, color:'#475569' }}>⏳ Loading data...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>

            {/* ── Chart ── */}
            <div style={{ background:'var(--bg-card)', borderRadius:14, padding:'20px 20px 12px', border:'1px solid #334155' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>
                    {ICONS[selected]} {currentAlert?.label}
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Historical prices + AI forecast for next 8 weeks</div>
                </div>
                {currentAlert && (
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:24, fontWeight:700, color:'#f1f5f9' }}>
                      TZS {Number(currentAlert.current_price).toLocaleString()}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b' }}>Current price / {currentAlert.unit}</div>
                  </div>
                )}
              </div>

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
                  <YAxis tick={{ fill:'#475569', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="actual" name="actual" stroke="#3b82f6" strokeWidth={2} fill="url(#gH)" dot={false} connectNulls={false} />
                  <Area type="monotone" dataKey="forecast" name="forecast" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 3" fill="url(#gP)" dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>

              <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:6 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
                  <span style={{ display:'inline-block', width:16, height:2, background:'#3b82f6', borderRadius:2 }} /> Actual price
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
                  <span style={{ display:'inline-block', width:16, height:2, background:'#a855f7', borderRadius:2, borderTop:'2px dashed #a855f7' }} /> AI Forecast
                </span>
              </div>
            </div>

            {/* ── Right Panel ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* Alert */}
              {currentAlert && (
                <div style={{ background:ac.bg, border:`1.5px solid ${ac.border}`, borderRadius:14, padding:18 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:ac.color, letterSpacing:'0.8px', marginBottom:10 }}>
                    {ac.icon} AI RECOMMENDATION
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, color:ac.color, marginBottom:6 }}>{ac.label}</div>
                  <div style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.5 }}>{currentAlert.message}</div>
                  <div style={{ marginTop:14, display:'flex', gap:8 }}>
                    <div style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Now</div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>TZS {Number(currentAlert.current_price).toLocaleString()}</div>
                    </div>
                    <div style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Week 4</div>
                      <div style={{ fontSize:14, fontWeight:700, color:ac.color }}>TZS {Number(currentAlert.pred_4w).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model stats */}
              {predData && (
                <div style={{ background:'var(--bg-card)', borderRadius:14, padding:16, border:'1px solid #334155' }}>
                  <div style={{ fontSize:11, color:'#64748b', letterSpacing:'0.5px', marginBottom:14 }}>MODEL STATISTICS</div>
                  {[
                    ['Accuracy (R²)', `${predData.model.accuracy_pct}%`, '#22c55e'],
                    ['Mean Absolute Error (MAE)', `TZS ${predData.model.mae}`, '#94a3b8'],
                    ['MAPE', `${predData.model.mape}%`, '#94a3b8'],
                  ].map(([k, v, c]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>{k}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ background:'#0f172a', borderRadius:6, height:5, marginTop:8 }}>
                    <div style={{ background:'linear-gradient(90deg,#22c55e,#86efac)', height:'100%', borderRadius:6, width:`${predData.model.accuracy_pct}%`, transition:'width .5s' }} />
                  </div>
                </div>
              )}

              {/* All commodities list */}
              <div style={{ background:'var(--bg-card)', borderRadius:14, padding:16, border:'1px solid #334155', flex:1 }}>
                <div style={{ fontSize:11, color:'#64748b', letterSpacing:'0.5px', marginBottom:12 }}>ALL COMMODITIES</div>
                {alerts.map(a => {
                  const cfg = ALERT_CFG[a.alert] || ALERT_CFG.STABLE;
                  return (
                    <div key={a.commodity} onClick={() => setSelected(a.commodity)} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'9px 0', borderBottom:'1px solid #0f172a', cursor:'pointer',
                      opacity: selected === a.commodity ? 1 : 0.65, transition:'opacity .15s',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>{ICONS[a.commodity]}</span>
                        <span style={{ fontSize:12, color:'#cbd5e1' }}>{a.label}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#f1f5f9' }}>
                          {Number(a.current_price).toLocaleString()}
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

        {/* ── Prediction Table ── */}
        {predData && (
          <div style={{ background:'var(--bg-card)', borderRadius:14, padding:20, border:'1px solid #334155', marginTop:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:14 }}>
              🤖 8-Week Price Forecast — {currentAlert?.label}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:8 }}>
              {predData.forecast.map((row, i) => {
                const prevPrice = i === 0 ? currentAlert?.current_price : predData.forecast[i - 1].predicted;
                const isUp = row.predicted > prevPrice;
                return (
                  <div key={i} style={{ background:'#0f172a', borderRadius:10, padding:'10px 8px', textAlign:'center', border:'1px solid #1e3a5f' }}>
                    <div style={{ fontSize:10, color:'#475569', marginBottom:3 }}>Week {i + 1}</div>
                    <div style={{ fontSize:10, color:'#64748b', marginBottom:5 }}>{row.date.slice(5)}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>{Number(row.predicted).toLocaleString()}</div>
                    <div style={{ fontSize:11, color: isUp ? '#ef4444' : '#22c55e', marginTop:3 }}>
                      {isUp ? '▲' : '▼'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <footer style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#334155', paddingBottom:20 }}>
          SokoAI v2.0 · Dar es Salaam Market Trends (Ilala, Tandale, Tandika, Temeke, Mabibo) · Terra Consultant Limited
        </footer>
      </main>
    </div>
  );
}
