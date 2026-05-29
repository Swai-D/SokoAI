'use client';
import { useState, useEffect } from 'react';
import { apiFetch, getAlert, getCommodityMeta, fmtTZS, fmtDate, CATEGORY_COLOR } from '@/lib/utils';

const MASOKO = ['Kariakoo','Tandale','Ilala','Tandika','Temeke','Mabibo','Ubungo'];

function HaliDot({ hali }) {
  const map = { Nyingi:'#22c55e', Wastani:'#f59e0b', Chache:'#ef4444' };
  const color = map[hali] ?? '#64748b';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }} />
      {hali ?? 'Haijulikani'}
    </span>
  );
}

function PriceCard({ item }) {
  const meta = getCommodityMeta(item.commodity);
  const catColor = CATEGORY_COLOR[item.category] ?? '#94a3b8';
  return (
    <div className="card-2" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ fontSize:24, flexShrink:0 }}>{meta.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#f1f5f9' }}>{item.commodity}</span>
          <span style={{ fontSize:10, background: catColor+'22', color:catColor,
            borderRadius:4, padding:'1px 6px', fontWeight:600 }}>{item.category}</span>
        </div>
        <div style={{ fontSize:11, color:'#64748b' }}>per {item.unit}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:800, color:'#f1f5f9', fontFamily:'var(--font-mono)' }}>
          {fmtTZS(item.price)}
        </div>
        <HaliDot hali={item.hali_soko} />
      </div>
    </div>
  );
}

export default function MasokoPage() {
  const [soko, setSoko]     = useState('Kariakoo');
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch(`/api/v1/prices?soko=${encodeURIComponent(soko)}&limit=100`, {
      headers: { 'X-API-Key': localStorage.getItem('sokoai_api_key') ?? 'dev' },
    })
      .then(d => {
        setData(d.data ?? []);
        setLastUpdate(d.tarehe);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [soko]);

  // Group by category
  const grouped = data.reduce((acc, item) => {
    const cat = item.category ?? 'GENERAL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const nafaka  = data.filter(d => d.category === 'NAFAKA').length;
  const mboga   = data.filter(d => d.category === 'MBOGA').length;
  const wastani = data.length
    ? Math.round(data.reduce((s,d) => s + Number(d.price), 0) / data.length)
    : 0;

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.4px' }}>
          Bei za Soko
        </h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
          Chagua soko uone bei zote za leo kutoka kwa madalali
        </p>
      </div>

      {/* Market tabs */}
      <div className="fade-up-1" style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {MASOKO.map(m => (
          <button key={m} onClick={() => setSoko(m)} style={{
            background: soko === m ? '#1d4ed8' : '#0d1829',
            border: `1px solid ${soko === m ? '#3b82f6' : '#1e3a5f'}`,
            borderRadius:10, padding:'8px 18px',
            color: soko === m ? '#fff' : '#94a3b8',
            fontSize:13, fontWeight: soko === m ? 600 : 400,
            cursor:'pointer', transition:'all .15s',
          }}>
            🏪 {m}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="fade-up-1" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
          {[
            ['Bidhaa Zote',  data.length,  '#3b82f6', '📦'],
            ['Nafaka',       nafaka,        '#f59e0b', '🌽'],
            ['Mbogamboga',   mboga,         '#22c55e', '🍅'],
            ['Bei ya Wastani', fmtTZS(wastani), '#a855f7', '📊'],
          ].map(([lbl, val, color, icon]) => (
            <div key={lbl} className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:18, marginBottom:6 }}>{icon}</div>
              <div style={{ fontSize:20, fontWeight:800, color, fontFamily:'var(--font-mono)' }}>{val}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
          {[...Array(8)].map((_,i) => <div key={i} className="skeleton" style={{ height:70, borderRadius:10 }} />)}
        </div>
      ) : error ? (
        <div className="card" style={{ padding:40, textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
          <div style={{ color:'#ef4444', fontSize:14 }}>{error}</div>
          <div style={{ color:'#64748b', fontSize:12, marginTop:6 }}>
            Hakikisha API inaendesha: <code style={{ color:'#3b82f6' }}>uvicorn api.main:app</code>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="card" style={{ padding:60, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ color:'#f1f5f9', fontSize:15, fontWeight:600 }}>Hakuna data kwa {soko}</div>
          <div style={{ color:'#64748b', fontSize:13, marginTop:6 }}>
            Mdalali bado hajatuma bei za leo. Jaribu tena baadaye.
          </div>
        </div>
      ) : (
        <div className="fade-up-2">
          {/* Header row */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>
              🏪 Soko la {soko}
            </div>
            {lastUpdate && (
              <div style={{ fontSize:11, color:'#64748b', fontFamily:'var(--font-mono)' }}>
                Imesasishwa: {lastUpdate}
              </div>
            )}
          </div>

          {/* Grouped by category */}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:3, height:14, background: CATEGORY_COLOR[cat] ?? '#64748b', borderRadius:2 }} />
                <span style={{ fontSize:12, fontWeight:700, color: CATEGORY_COLOR[cat] ?? '#64748b',
                  letterSpacing:'0.6px', textTransform:'uppercase' }}>{cat}</span>
                <span style={{ fontSize:11, color:'#475569' }}>({items.length})</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:8 }}>
                {items.map((item, i) => <PriceCard key={i} item={item} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Last updated */}
      {lastUpdate && (
        <div style={{ textAlign:'center', marginTop:24, fontSize:11, color:'#1e3a5f' }}>
          Data ya {soko} · Tarehe {lastUpdate} · Chanzo: Madalali wa WhatsApp
        </div>
      )}
    </div>
  );
}
