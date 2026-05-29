'use client';
/**
 * SokoAI — PWA UI Components
 * - InstallBanner   : Popup ya "Weka SokoAI kwenye simu yako"
 * - OfflineBanner   : Bango la offline mode
 * - NotifySettings  : Mtumiaji achague alerts anazotaka
 */
import { useState } from 'react';
import { usePWA } from './usePWA';

const COMMODITY_LIST = [
  { id:'Mahindi',  icon:'🌽', label:'Mahindi' },
  { id:'Mchele',   icon:'🍚', label:'Mchele'  },
  { id:'Nyanya',   icon:'🍅', label:'Nyanya'  },
  { id:'Sukari',   icon:'🧂', label:'Sukari'  },
  { id:'Maharage', icon:'🫘', label:'Maharage'},
  { id:'Viazi',    icon:'🥔', label:'Viazi'   },
  { id:'Vitunguu', icon:'🧅', label:'Vitunguu'},
  { id:'Mafuta ya Kupikia', icon:'🫙', label:'Mafuta' },
];


// ── Install Banner ────────────────────────────────────────────────
export function InstallBanner() {
  const { canInstall, isInstalled, isIOS, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed || !canInstall) return null;

  return (
    <div style={{
      position:'fixed', bottom:16, left:16, right:16, zIndex:200,
      background:'linear-gradient(135deg, #1d4ed8, #4f46e5)',
      borderRadius:14, padding:'14px 16px',
      boxShadow:'0 8px 32px rgba(59,130,246,0.4)',
      display:'flex', alignItems:'center', gap:12,
      animation:'fade-up 0.4s ease',
    }}>
      <div style={{ fontSize:28, flexShrink:0 }}>📲</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:2 }}>
          Weka SokoAI kwenye simu yako
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)' }}>
          {isIOS
            ? 'Bonyeza Share → "Add to Home Screen"'
            : 'Pata bei za masoko hata bila internet'}
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        {!isIOS && (
          <button onClick={install} style={{
            background:'#fff', color:'#1d4ed8', border:'none',
            borderRadius:8, padding:'8px 14px', fontSize:12,
            fontWeight:700, cursor:'pointer',
          }}>
            Weka →
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={{
          background:'rgba(255,255,255,0.15)', color:'#fff', border:'none',
          borderRadius:8, padding:'8px 10px', fontSize:12, cursor:'pointer',
        }}>✕</button>
      </div>
    </div>
  );
}


// ── Offline Banner ────────────────────────────────────────────────
export function OfflineBanner() {
  const { isOnline } = usePWA();
  if (isOnline) return null;

  return (
    <div style={{
      position:'sticky', top:58, zIndex:99,
      background:'#1a0505', borderBottom:'1px solid #7f1d1d',
      padding:'8px 24px', display:'flex', alignItems:'center', gap:8,
    }}>
      <span style={{ fontSize:14 }}>📴</span>
      <span style={{ fontSize:12, color:'#fca5a5', fontWeight:500 }}>
        Uko offline — Unaonyesha bei za mwisho zilizohifadhiwa. Bei za sasa hazionekani.
      </span>
    </div>
  );
}


// ── Notification Settings ─────────────────────────────────────────
export function NotifySettings() {
  const { push } = usePWA();
  const [selected,  setSelected]  = useState(new Set(['Mahindi','Mchele','Nyanya']));
  const [saved,     setSaved]     = useState(false);

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function handleSubscribe() {
    const ok = await push.subscribe([...selected]);
    if (ok) setSaved(true);
  }

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:6 }}>
        🔔 Arifa za Bei
      </div>
      <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>
        Pata notification simu yako wakati bei ya bidhaa unayoipenda inabadilika sana.
      </div>

      {push.error && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:8, padding:'8px 12px', fontSize:12, color:'#fca5a5', marginBottom:12 }}>
          ⚠️ {push.error}
        </div>
      )}

      {saved && (
        <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)',
          borderRadius:8, padding:'8px 12px', fontSize:12, color:'#86efac', marginBottom:12 }}>
          ✅ Umewekwa — utapata arifa za bei!
        </div>
      )}

      {/* Commodity checkboxes */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
        {COMMODITY_LIST.map(c => {
          const active = selected.has(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{
              background: active ? 'rgba(59,130,246,0.15)' : '#0f172a',
              border: `1px solid ${active ? '#3b82f6' : '#1e3a5f'}`,
              borderRadius:8, padding:'8px 6px', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              transition:'all .15s',
            }}>
              <span style={{ fontSize:18 }}>{c.icon}</span>
              <span style={{ fontSize:10, color: active ? '#93c5fd' : '#475569', fontWeight: active?600:400 }}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert types info */}
      <div style={{ background:'#0f172a', borderRadius:8, padding:12, marginBottom:14, fontSize:11 }}>
        <div style={{ color:'#64748b', marginBottom:6, fontWeight:600 }}>Utapata arifa za:</div>
        {[
          ['💚', 'Price Drop', 'Bei inashuka >10%'],
          ['🔴', 'Spike',      'Bei inapanda ghafla >15%'],
          ['📈', 'Trend',      'Mwenendo wa wiki 8'],
        ].map(([icon, type, desc]) => (
          <div key={type} style={{ display:'flex', gap:8, marginBottom:4 }}>
            <span>{icon}</span>
            <span style={{ color:'#f1f5f9', fontWeight:600, width:80 }}>{type}</span>
            <span style={{ color:'#64748b' }}>{desc}</span>
          </div>
        ))}
      </div>

      <button
        onClick={push.subscribed ? push.unsubscribe : handleSubscribe}
        disabled={push.loading}
        className={push.subscribed ? 'btn btn-ghost' : 'btn btn-primary'}
        style={{ width:'100%', justifyContent:'center', opacity: push.loading ? 0.7 : 1 }}
      >
        {push.loading
          ? '⏳ Inasubscribe...'
          : push.subscribed
            ? '🔕 Zima Arifa'
            : `🔔 Washa Arifa (${selected.size} bidhaa)`}
      </button>
    </div>
  );
}
