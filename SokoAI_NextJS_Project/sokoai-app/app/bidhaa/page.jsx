'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch, getCommodityMeta, getAlert, fmtTZS, fmtShort, CATEGORY_COLOR } from '@/lib/utils';

export default function BidhaaListPage() {
  const [bidhaa, setBidhaa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]  = useState('');
  const [cat, setCat]        = useState('ZOTE');

  useEffect(() => {
    apiFetch('/api/v1/commodities')
      .then(d => { setBidhaa(d.bidhaa ?? []); setLoading(false); })
      .catch(() => { setBidhaa([]); setLoading(false); });
  }, []);

  const cats = ['ZOTE', ...new Set(bidhaa.map(b => b.kategoria).filter(Boolean))];
  const filtered = bidhaa
    .filter(b => cat === 'ZOTE' || b.kategoria === cat)
    .filter(b => b.jina.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>
      <div className="fade-up" style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.4px' }}>Bidhaa Zote</h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
          Chagua bidhaa uone historia ya bei na utabiri wa wiki 8
        </p>
      </div>

      {/* Search + filter */}
      <div className="fade-up-1" style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          placeholder="🔍 Tafuta bidhaa..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex:1, minWidth:200, background:'#0d1829', border:'1px solid #1e3a5f',
            borderRadius:10, padding:'9px 14px', color:'#f1f5f9', fontSize:13, outline:'none',
            fontFamily:'var(--font-display)' }}
        />
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            background: cat === c ? '#1d4ed8' : '#0d1829',
            border: `1px solid ${cat === c ? '#3b82f6' : '#1e3a5f'}`,
            borderRadius:10, padding:'9px 14px', color: cat === c ? '#fff' : '#94a3b8',
            fontSize:12, fontWeight: cat === c ? 600 : 400, cursor:'pointer', transition:'all .15s',
          }}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {[...Array(10)].map((_,i) => <div key={i} className="skeleton" style={{ height:90, borderRadius:14 }} />)}
        </div>
      ) : (
        <div className="fade-up-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {filtered.map(b => {
            const meta = getCommodityMeta(b.jina);
            const catColor = CATEGORY_COLOR[b.kategoria] ?? '#94a3b8';
            return (
              <Link key={b.jina} href={`/bidhaa/${encodeURIComponent(b.jina)}`} style={{ textDecoration:'none' }}>
                <div className="card" style={{ padding:'16px', cursor:'pointer', transition:'all .15s',
                  ':hover':{ borderColor:'#3b82f6' } }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{meta.icon}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:4 }}>{b.jina}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, background: catColor+'22', color:catColor,
                      borderRadius:4, padding:'1px 6px', fontWeight:600 }}>{b.kategoria}</span>
                    <span style={{ fontSize:10, color:'#475569' }}>/{b.kipimo}</span>
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:60, color:'#475569' }}>
              Hakuna bidhaa inayolingana na "{filter}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
