'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { fmtTZS } from '@/lib/utils';

const PLAN_COLOR = { enterprise:'#f59e0b', pro:'#a855f7', basic:'#3b82f6', free:'#64748b' };

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding:24, marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', marginBottom:18, display:'flex',
        alignItems:'center', gap:8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'10px 0', borderBottom:'1px solid #0f172a' }}>
      <span style={{ fontSize:12, color:'#64748b' }}>{label}</span>
      <span style={{ fontSize:13, color:'#f1f5f9', fontWeight:600,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)' }}>{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const { user, apiKey, logout, changePassword } = useAuth();
  const router = useRouter();

  const [showKey, setShowKey]     = useState(false);
  const [copied,  setCopied]      = useState(false);
  const [pwForm,  setPwForm]      = useState({ current:'', next:'', confirm:'' });
  const [pwError, setPwError]     = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const storedKey = typeof window !== 'undefined'
    ? localStorage.getItem('sokoai_api_key') : null;

  const planColor = PLAN_COLOR[apiKey?.plan] ?? '#64748b';
  const usagePct  = apiKey
    ? Math.min(((apiKey.requests_today ?? 0) / (apiKey.rate_limit ?? 100)) * 100, 100)
    : 0;

  function copyKey() {
    if (storedKey) navigator.clipboard.writeText(storedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePwChange(e) {
    e.preventDefault();
    setPwError(null); setPwSuccess(false);
    if (pwForm.next.length < 8) { setPwError('Nenosiri lazima liwe na herufi 8+'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('Nenosiri hazifanani'); return; }
    setPwLoading(true);
    try {
      await changePassword({ currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwSuccess(true);
      setPwForm({ current:'', next:'', confirm:'' });
    } catch(err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  if (!user) return (
    <div style={{ padding:60, textAlign:'center' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🔐</div>
      <div style={{ color:'#f1f5f9', fontSize:15, marginBottom:16 }}>Ingia kwanza kuona akaunti yako</div>
      <button onClick={() => router.push('/auth')} className="btn btn-primary">Ingia →</button>
    </div>
  );

  return (
    <div style={{ padding:'20px 24px', maxWidth:760, margin:'0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9' }}>Akaunti Yangu</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Simamia taarifa zako na API key</p>
        </div>
        <button onClick={logout} className="btn btn-ghost" style={{ fontSize:12 }}>
          Toka →
        </button>
      </div>

      {/* Profile */}
      <Section title="👤 Taarifa za Mtumiaji">
        <Field label="Jina"        value={user.name} />
        <Field label="Barua pepe"  value={user.email} mono />
        {user.org && <Field label="Kampuni" value={user.org} />}
        <Field label="Wajibu"      value={user.role === 'admin' ? '🛡 Admin' : '👤 Client'} />
        <Field label="Mwanachama tangu" value={new Date(user.created_at ?? Date.now()).toLocaleDateString('sw-TZ')} />
      </Section>

      {/* API Key */}
      <Section title="🔑 API Key Yako">
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:planColor, background:planColor+'15',
              padding:'2px 10px', borderRadius:99, textTransform:'uppercase' }}>{apiKey?.plan ?? 'free'}</span>
            <span style={{ fontSize:11, color:'#64748b' }}>
              {(apiKey?.rate_limit ?? 100).toLocaleString()} maombi / siku
            </span>
          </div>

          {/* Key display */}
          <div style={{ background:'#0f172a', borderRadius:10, padding:'12px 14px',
            border:'1px solid #1e3a5f', display:'flex', alignItems:'center', gap:10 }}>
            <code style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'#a855f7',
              flex:1, wordBreak:'break-all' }}>
              {storedKey
                ? (showKey ? storedKey : storedKey.slice(0,12) + '•'.repeat(20))
                : 'Key haipo — ingia tena ili kuona'}
            </code>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button onClick={() => setShowKey(s=>!s)} className="btn btn-ghost"
                style={{ fontSize:11, padding:'4px 10px' }}>
                {showKey ? '🙈 Ficha' : '👁 Onyesha'}
              </button>
              <button onClick={copyKey} className="btn btn-ghost"
                style={{ fontSize:11, padding:'4px 10px', color:copied?'#22c55e':'inherit' }}>
                {copied ? '✓ Imenakiliwa' : '📋 Nakili'}
              </button>
            </div>
          </div>
        </div>

        {/* Usage bar */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginBottom:6 }}>
            <span>Matumizi leo</span>
            <span style={{ fontFamily:'var(--font-mono)' }}>
              {(apiKey?.requests_today ?? 0).toLocaleString()} / {(apiKey?.rate_limit ?? 100).toLocaleString()}
            </span>
          </div>
          <div style={{ background:'#0f172a', borderRadius:99, height:8 }}>
            <div style={{ background: usagePct > 90 ? '#ef4444' : usagePct > 70 ? '#f59e0b' : '#3b82f6',
              height:'100%', borderRadius:99, width:`${usagePct}%`, transition:'width .6s ease' }} />
          </div>
          <div style={{ fontSize:11, color:'#475569', marginTop:6 }}>
            {usagePct > 90
              ? '⚠️ Karibu na kikomo — fikiria ku-upgrade'
              : `Bado una maombi ${((apiKey?.rate_limit??100)-(apiKey?.requests_today??0)).toLocaleString()} leo`}
          </div>
        </div>

        {/* Upgrade CTA */}
        {apiKey?.plan !== 'enterprise' && (
          <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(168,85,247,0.08)',
            borderRadius:8, border:'1px solid rgba(168,85,247,0.15)',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#d8b4fe' }}>Unahitaji maombi zaidi?</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Upgrade hadi Pro — maombi 10,000/siku</div>
            </div>
            <button onClick={() => router.push('/auth?upgrade=1')}
              style={{ background:'#a855f7', border:'none', borderRadius:8, padding:'8px 16px',
                color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              Upgrade →
            </button>
          </div>
        )}
      </Section>

      {/* Change Password */}
      <Section title="🔒 Badilisha Nenosiri">
        {pwSuccess && (
          <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)',
            borderRadius:8, padding:'10px 14px', fontSize:13, color:'#86efac', marginBottom:16 }}>
            ✅ Nenosiri limebadilishwa. Ingia tena.
          </div>
        )}
        {pwError && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:8, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:16 }}>
            ⚠️ {pwError}
          </div>
        )}
        <form onSubmit={handlePwChange} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            ['current', 'Nenosiri la Sasa',     'Nenosiri lako la sasa'],
            ['next',    'Nenosiri Jipya',        'Herufi 8 au zaidi'],
            ['confirm', 'Thibitisha Nenosiri',   'Rudia nenosiri jipya'],
          ].map(([name, label, ph]) => (
            <div key={name}>
              <label style={{ fontSize:12, color:'#64748b', display:'block', marginBottom:6 }}>{label}</label>
              <input name={name} type="password" placeholder={ph} value={pwForm[name]}
                onChange={e => setPwForm(f => ({ ...f, [name]: e.target.value }))}
                style={{ width:'100%', background:'#0f172a', border:'1px solid #1e3a5f',
                  borderRadius:8, padding:'10px 12px', color:'#f1f5f9', fontSize:13,
                  outline:'none', fontFamily:'var(--font-display)' }}
              />
            </div>
          ))}
          <button type="submit" className="btn btn-primary"
            disabled={pwLoading}
            style={{ alignSelf:'flex-start', opacity:pwLoading?.7:1 }}>
            {pwLoading ? '⏳ Inabadilisha...' : '🔒 Badilisha Nenosiri'}
          </button>
        </form>
      </Section>

      {/* Danger zone */}
      <Section title="⚠️ Hatua za Hatari">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, color:'#f1f5f9', fontWeight:600 }}>Toka kwenye akaunti</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              Session yako itafutwa kwenye kifaa hiki
            </div>
          </div>
          <button onClick={logout}
            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
              borderRadius:8, padding:'8px 18px', color:'#ef4444', fontSize:13,
              fontWeight:600, cursor:'pointer' }}>
            Toka →
          </button>
        </div>
      </Section>
    </div>
  );
}
