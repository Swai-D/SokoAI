'use client';
import { useState, useEffect } from 'react';
import { fmtTZS, fmtDate, getAlert } from '@/lib/utils';

function StatCard({ icon, label, value, color = '#3b82f6', sub }) {
  return (
    <div className="card" style={{ padding:'16px 18px' }}>
      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:800, color, fontFamily:'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
      background: active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      color: active ? '#22c55e' : '#ef4444' }}>
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}

const TABS = ['Overview','Submissions','API Keys','System'];

export default function AdminPage() {
  const [tab, setTab]         = useState('Overview');
  const [stats, setStats]     = useState(null);
  const [submissions, setSubs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed]   = useState(false);

  // Mock data for demo — replace with real API calls in production
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    setTimeout(() => {
      setStats({
        submissions_today: 24,
        records_total:     18420,
        api_keys_active:   37,
        commodities:       15,
        masoko:            8,
        last_retrain:      '2026-05-27 06:00',
        model_accuracy:    87.3,
        new_rows_pending:  12,
      });
      setSubs([
        { id:101, sender:'+255712345678', soko:'Kariakoo', records:14, received_at:'2026-05-28 06:12', hali:'Wastani' },
        { id:100, sender:'+255767890123', soko:'Tandale',  records:11, received_at:'2026-05-28 06:05', hali:'Nyingi' },
        { id:99,  sender:'+255754321098', soko:'Ilala',    records:9,  received_at:'2026-05-27 06:18', hali:'Chache' },
        { id:98,  sender:'+255789012345', soko:'Temeke',   records:12, received_at:'2026-05-27 06:10', hali:'Wastani' },
      ]);
      setApiKeys([
        { id:1, client:'Equity Bank TZ',   plan:'enterprise', requests_today:4821, rate_limit:100000, is_active:true, created:'2026-03-01' },
        { id:2, client:'FreshMart App',     plan:'pro',        requests_today:2341, rate_limit:10000,  is_active:true, created:'2026-04-10' },
        { id:3, client:'AgriTech Kenya',    plan:'basic',      requests_today:450,  rate_limit:1000,   is_active:true, created:'2026-05-01' },
        { id:4, client:'Dev Testing',       plan:'free',       requests_today:23,   rate_limit:100,    is_active:true, created:'2026-05-20' },
        { id:5, client:'Old Integration',   plan:'basic',      requests_today:0,    rate_limit:1000,   is_active:false,created:'2026-01-15' },
      ]);
      setLoading(false);
    }, 600);
  }, [authed]);

  // Auth gate
  if (!authed) return (
    <div style={{ padding:'60px 24px', maxWidth:440, margin:'0 auto' }}>
      <div className="card" style={{ padding:32, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔐</div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>Admin Access</h2>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:24 }}>
          Weka admin secret key kuingia kwenye dashboard ya admin
        </p>
        <input
          type="password" placeholder="Admin secret key..."
          value={adminKey} onChange={e => setAdminKey(e.target.value)}
          onKeyDown={e => e.key==='Enter' && setAuthed(true)}
          style={{ width:'100%', background:'#0f172a', border:'1px solid #1e3a5f',
            borderRadius:8, padding:'10px 12px', color:'#f1f5f9', fontSize:13,
            outline:'none', fontFamily:'var(--font-mono)', marginBottom:12 }}
        />
        <button onClick={() => setAuthed(true)} className="btn btn-primary"
          style={{ width:'100%', justifyContent:'center' }}>
          Ingia →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9' }}>Admin Dashboard</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Simamia SokoAI — data, API keys, na mfumo</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8,
          background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)',
          borderRadius:8, padding:'8px 14px' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e',
            animation:'pulse-dot 2s infinite', color:'#22c55e' }} />
          <span style={{ fontSize:12, color:'#22c55e', fontWeight:600 }}>System Online</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid #1e3a5f', paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'none', border:'none', padding:'8px 18px',
            color: tab===t ? '#3b82f6' : '#64748b',
            fontWeight: tab===t ? 700 : 400, fontSize:13,
            borderBottom: tab===t ? '2px solid #3b82f6' : '2px solid transparent',
            cursor:'pointer', transition:'all .15s', fontFamily:'var(--font-display)',
          }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[...Array(8)].map((_,i) => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
        </div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'Overview' && stats && (
            <div className="fade-up">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
                <StatCard icon="📨" label="Submissions Leo"    value={stats.submissions_today} color="#3b82f6" />
                <StatCard icon="📊" label="Records Zote"       value={stats.records_total.toLocaleString()} color="#22c55e" />
                <StatCard icon="🔑" label="API Keys Active"    value={stats.api_keys_active}  color="#a855f7" />
                <StatCard icon="🎯" label="Model Accuracy"     value={`${stats.model_accuracy}%`} color="#f59e0b" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
                <StatCard icon="📦" label="Bidhaa Zinazofuatwa" value={stats.commodities} color="#06b6d4" />
                <StatCard icon="🏪" label="Masoko"              value={stats.masoko}      color="#06b6d4" />
                <StatCard icon="⏰" label="Mafunzo ya Mwisho"  value={stats.last_retrain} color="#94a3b8" sub="Prophet+XGBoost" />
                <StatCard icon="🔄" label="Rows Mpya (Retrain)" value={`${stats.new_rows_pending}/50`} color={stats.new_rows_pending>=50?'#ef4444':'#64748b'} />
              </div>

              {/* Retraining trigger */}
              <div className="card" style={{ padding:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>Mafunzo ya Model (Retraining)</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
                    Rows mpya: {stats.new_rows_pending}/50 · Automatic trigger itafanyika kwa rows 50
                  </div>
                  <div style={{ background:'#0f172a', borderRadius:99, height:6, width:300, marginTop:10 }}>
                    <div style={{ background:'linear-gradient(90deg,#3b82f6,#6366f1)', height:'100%', borderRadius:99,
                      width:`${(stats.new_rows_pending/50)*100}%`, transition:'width .5s' }} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => alert('Kuanza retraining...')}>
                  🚀 Fanya Retrain Sasa
                </button>
              </div>
            </div>
          )}

          {/* ── Submissions ── */}
          {tab === 'Submissions' && (
            <div className="fade-up card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e3a5f', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>Ujumbe wa Madalali</div>
                <span style={{ fontSize:12, color:'#64748b' }}>{submissions.length} wa hivi karibuni</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ fontSize:11, color:'#475569', background:'#0f172a' }}>
                    {['ID','Mtumaji','Soko','Records','Wakati','Hali ya Soko'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s,i) => {
                    const haliColor = {Nyingi:'#22c55e',Wastani:'#f59e0b',Chache:'#ef4444'}[s.hali] ?? '#64748b';
                    return (
                      <tr key={s.id} style={{ borderTop:'1px solid #0f172a', fontSize:13,
                        background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding:'12px 16px', color:'#475569', fontFamily:'var(--font-mono)', fontSize:11 }}>#{s.id}</td>
                        <td style={{ padding:'12px 16px', color:'#94a3b8', fontFamily:'var(--font-mono)', fontSize:12 }}>{s.sender}</td>
                        <td style={{ padding:'12px 16px', color:'#f1f5f9', fontWeight:600 }}>🏪 {s.soko}</td>
                        <td style={{ padding:'12px 16px', color:'#3b82f6', fontWeight:700, fontFamily:'var(--font-mono)' }}>{s.records}</td>
                        <td style={{ padding:'12px 16px', color:'#64748b', fontSize:12 }}>{s.received_at}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ fontSize:11, fontWeight:700, color:haliColor,
                            background:haliColor+'15', padding:'2px 8px', borderRadius:4 }}>{s.hali}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── API Keys ── */}
          {tab === 'API Keys' && (
            <div className="fade-up">
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e3a5f', display:'flex', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>API Keys za Wateja</div>
                  <button className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px' }}>+ Key Mpya</button>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ fontSize:11, color:'#475569', background:'#0f172a' }}>
                      {['Mteja','Plan','Maombi Leo','Kiwango','Hali','Tarehe'].map(h => (
                        <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k,i) => {
                      const planColor = {enterprise:'#f59e0b',pro:'#a855f7',basic:'#3b82f6',free:'#64748b'}[k.plan]??'#64748b';
                      const pct = Math.min((k.requests_today/k.rate_limit)*100, 100);
                      return (
                        <tr key={k.id} style={{ borderTop:'1px solid #0f172a', fontSize:13,
                          background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding:'12px 16px', color:'#f1f5f9', fontWeight:600 }}>{k.client}</td>
                          <td style={{ padding:'12px 16px' }}>
                            <span style={{ fontSize:11, fontWeight:700, color:planColor,
                              background:planColor+'15', padding:'2px 8px', borderRadius:4,
                              textTransform:'uppercase' }}>{k.plan}</span>
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <div style={{ fontSize:12, color:'#f1f5f9', fontFamily:'var(--font-mono)', marginBottom:4 }}>
                              {k.requests_today.toLocaleString()} / {k.rate_limit.toLocaleString()}
                            </div>
                            <div style={{ background:'#0f172a', borderRadius:99, height:4, width:100 }}>
                              <div style={{ background: pct>90?'#ef4444':'#3b82f6', height:'100%', borderRadius:99, width:`${pct}%` }} />
                            </div>
                          </td>
                          <td style={{ padding:'12px 16px', color:'#64748b', fontSize:12, fontFamily:'var(--font-mono)' }}>
                            {k.rate_limit.toLocaleString()}/siku
                          </td>
                          <td style={{ padding:'12px 16px' }}><StatusBadge active={k.is_active} /></td>
                          <td style={{ padding:'12px 16px', color:'#475569', fontSize:11 }}>{k.created}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── System ── */}
          {tab === 'System' && (
            <div className="fade-up" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div className="card" style={{ padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:16 }}>🔧 Hali ya Mfumo</div>
                {[
                  ['FastAPI Server',   true,  'Port 8000'],
                  ['PostgreSQL',       true,  'Connected'],
                  ['WhatsApp Bot',     true,  'Poll mode'],
                  ['Daily Downloader', true,  'Cron 06:00'],
                  ['ML Model',         true,  'Prophet+XGBoost v2'],
                  ['OpenWeather API',  false, 'Key haijawekwa'],
                ].map(([service, ok, note]) => (
                  <div key={service} style={{ display:'flex', alignItems:'center', gap:10,
                    padding:'10px 0', borderBottom:'1px solid #0f172a' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                      background: ok?'#22c55e':'#ef4444',
                      boxShadow: ok?'0 0 6px #22c55e':'0 0 6px #ef4444' }} />
                    <span style={{ fontSize:13, color:'#f1f5f9', flex:1 }}>{service}</span>
                    <span style={{ fontSize:11, color:'#475569' }}>{note}</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:16 }}>⚡ Vitendo vya Haraka</div>
                {[
                  ['🔄 Anza Retraining',   '#3b82f6', () => alert('Starting retrain...')],
                  ['📥 Download PDF Mpya', '#22c55e', () => alert('Downloading...')],
                  ['🧹 Safisha Cache',     '#f59e0b', () => alert('Clearing cache...')],
                  ['📊 Export Data (CSV)', '#a855f7', () => alert('Exporting...')],
                ].map(([lbl, color, fn]) => (
                  <button key={lbl} onClick={fn} style={{
                    display:'block', width:'100%', background:color+'15',
                    border:`1px solid ${color}30`, borderRadius:8,
                    padding:'12px 16px', color, fontSize:13, fontWeight:600,
                    cursor:'pointer', textAlign:'left', marginBottom:8,
                    transition:'all .15s', fontFamily:'var(--font-display)',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
