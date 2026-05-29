'use client';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';

const PLANS = [
  { key:'free',       label:'Free',       price:'Bila malipo',       limit:'100 req/siku',    color:'#64748b',
    features:['Bei za leo','Historia siku 7','Masoko makuu 3'] },
  { key:'basic',      label:'Basic',      price:'TZS 50,000/mwezi',  limit:'1,000 req/siku',  color:'#3b82f6',
    features:['Bei za leo','Historia siku 90','Masoko yote','Utabiri wiki 4'] },
  { key:'pro',        label:'Pro',        price:'TZS 150,000/mwezi', limit:'10,000 req/siku', color:'#a855f7',
    features:['Kila kitu cha Basic','Utabiri wiki 8','Data kwa soko','Webhooks'], popular:true },
  { key:'enterprise', label:'Enterprise', price:'Wasiliana nasi',    limit:'Bila kikomo',     color:'#f59e0b',
    features:['Kila kitu cha Pro','SLA 99.9%','Custom endpoints','Dedicated support'] },
];

function Input({ label, name, type='text', placeholder, value, onChange, error }) {
  return (
    <div>
      <label style={{ fontSize:12, color:'#64748b', display:'block', marginBottom:6 }}>{label}</label>
      <input name={name} type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{ width:'100%', background:'#0f172a', border:`1px solid ${error?'#ef4444':'#1e3a5f'}`,
          borderRadius:8, padding:'10px 12px', color:'#f1f5f9', fontSize:13,
          outline:'none', fontFamily:'var(--font-display)', transition:'border-color .15s' }}
        onFocus={e => e.target.style.borderColor='#3b82f6'}
        onBlur={e => e.target.style.borderColor = error?'#ef4444':'#1e3a5f'}
      />
      {error && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{error}</div>}
    </div>
  );
}

function AuthContent() {
  const { register, login, user } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab]     = useState('login');
  const [plan, setPlan]   = useState('free');
  const [form, setForm]   = useState({ name:'', email:'', password:'', org:'', confirmPassword:'' });
  const [errors, setErrors] = useState({});
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const redirect   = searchParams.get('redirect') ?? '/';
  const expired    = searchParams.get('expired');
  const forbidden  = searchParams.get('error') === 'forbidden';

  // Already logged in
  useEffect(() => { if (user) router.replace(redirect); }, [user]);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: null }));
    setServerError(null);
  }

  function validateRegister() {
    const errs = {};
    if (!form.name.trim())       errs.name     = 'Jina linahitajika';
    if (!form.email.includes('@')) errs.email   = 'Barua pepe si sahihi';
    if (form.password.length < 8) errs.password = 'Herufi 8 au zaidi';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Nenosiri hazifanani';
    return errs;
  }

  async function handleRegister(e) {
    e.preventDefault();
    const errs = validateRegister();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true); setServerError(null);
    try {
      const data = await register({ name:form.name, email:form.email, password:form.password, org:form.org, plan });
      setApiKey(data.api_key);
    } catch(err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setErrors({ email:!form.email?'Inahitajika':null, password:!form.password?'Inahitajika':null });
      return;
    }
    setLoading(true); setServerError(null);
    try {
      await login({ email:form.email, password:form.password });
      router.replace(redirect);
    } catch(err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyKey() { navigator.clipboard.writeText(apiKey); }

  // ── API Key success screen ────────────────────────────────────
  if (apiKey) return (
    <div style={{ padding:'60px 24px', maxWidth:560, margin:'0 auto' }}>
      <div className="card fade-up" style={{ padding:36, textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#22c55e', marginBottom:8 }}>Umefanikiwa!</div>
        <div style={{ fontSize:14, color:'#64748b', marginBottom:24 }}>
          API key yako ipo tayari. Hifadhi vizuri — haitaonyeshwa tena.
        </div>
        <div style={{ background:'#0f172a', borderRadius:10, padding:'14px 16px', marginBottom:16,
          fontFamily:'var(--font-mono)', fontSize:12, color:'#a855f7',
          wordBreak:'break-all', border:'1px solid #1e3a5f', textAlign:'left' }}>
          {apiKey}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:20 }}>
          <button onClick={copyKey} className="btn btn-primary">📋 Nakili Key</button>
          <button onClick={() => router.push('/')} className="btn btn-ghost">Nenda Dashboard →</button>
        </div>
        <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.08)',
          borderRadius:8, border:'1px solid rgba(239,68,68,0.15)', fontSize:12, color:'#fca5a5' }}>
          ⚠️ Usiishiriki key hii. Kila ombi linahesabiwa kwenye akaunti yako.
        </div>
        {/* Quick start */}
        <div style={{ marginTop:20, textAlign:'left' }}>
          <div className="label" style={{ marginBottom:8 }}>Mfano wa kwanza</div>
          <pre style={{ background:'#0f172a', borderRadius:8, padding:14, fontSize:11,
            color:'#94a3b8', fontFamily:'var(--font-mono)', border:'1px solid #1e3a5f',
            lineHeight:1.7, overflow:'auto', margin:0 }}>
{`curl -H "X-API-Key: ${apiKey.slice(0,24)}..." \\
  "https://api.sokoai.tz/api/v1/prices\\
?bidhaa=Nyanya&soko=Kariakoo"`}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:'40px 24px', maxWidth:980, margin:'0 auto' }}>

      {/* Alerts */}
      {expired && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:8, padding:'10px 16px', fontSize:13, color:'#fca5a5', marginBottom:20, textAlign:'center' }}>
          ⚠️ Session yako imeisha. Tafadhali ingia tena.
        </div>
      )}
      {forbidden && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:8, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:20, textAlign:'center' }}>
          🔐 Huna ruhusa ya kufikia ukurasa ule.
        </div>
      )}

      {/* Header */}
      <div className="fade-up" style={{ textAlign:'center', marginBottom:36 }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.5px' }}>
          {tab==='login' ? 'Karibu tena 👋' : 'Jiunge na SokoAI 🚀'}
        </h1>
        <p style={{ fontSize:14, color:'#64748b', marginTop:8 }}>
          {tab==='login'
            ? 'Ingia kwenye akaunti yako kupata data za bei na utabiri wa AI'
            : 'Pata API key na uanze kutumia data za masoko Tanzania dakika chache'}
        </p>
        {/* Tab switcher */}
        <div style={{ display:'inline-flex', gap:4, marginTop:20, background:'#0d1829',
          borderRadius:10, padding:4, border:'1px solid #1e3a5f' }}>
          {[['login','Ingia'],['register','Jiunge']].map(([t,l]) => (
            <button key={t} onClick={() => { setTab(t); setServerError(null); setErrors({}); }} style={{
              background: tab===t ? '#1d4ed8' : 'transparent',
              border: 'none', borderRadius:8, padding:'8px 24px',
              color: tab===t ? '#fff' : '#64748b', fontSize:13,
              fontWeight: tab===t ? 700 : 400, cursor:'pointer',
              transition:'all .15s', fontFamily:'var(--font-display)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Login Form ── */}
      {tab === 'login' && (
        <div className="fade-up card" style={{ maxWidth:440, margin:'0 auto', padding:32 }}>
          {serverError && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
              borderRadius:8, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:20 }}>
              ⚠️ {serverError}
            </div>
          )}
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <Input label="Barua pepe" name="email" type="email" placeholder="jina@kampuni.tz"
              value={form.email} onChange={handleChange} error={errors.email} />
            <Input label="Nenosiri" name="password" type="password" placeholder="••••••••"
              value={form.password} onChange={handleChange} error={errors.password} />
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width:'100%', justifyContent:'center', padding:'12px', fontSize:14, opacity:loading?.7:1 }}>
              {loading ? '⏳ Inaingia...' : '→ Ingia'}
            </button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#475569' }}>
            Huna akaunti?{' '}
            <button onClick={() => setTab('register')}
              style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:12 }}>
              Jiunge bure
            </button>
          </div>
        </div>
      )}

      {/* ── Register Form ── */}
      {tab === 'register' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28, alignItems:'start' }}>

          {/* Plans */}
          <div className="fade-up-1">
            <div className="label" style={{ marginBottom:14 }}>Chagua Mpango</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {PLANS.map(p => (
                <div key={p.key} onClick={() => setPlan(p.key)} style={{
                  background: plan===p.key ? '#0d1829' : 'transparent',
                  border:`1.5px solid ${plan===p.key ? p.color : '#1e3a5f'}`,
                  borderRadius:12, padding:'14px 16px', cursor:'pointer',
                  transition:'all .15s', position:'relative',
                }}>
                  {p.popular && (
                    <div style={{ position:'absolute', top:-8, right:12, background:'#a855f7',
                      color:'#fff', fontSize:9, fontWeight:700, padding:'2px 10px', borderRadius:99 }}>
                      MAARUFU
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%',
                        background:plan===p.key ? p.color : '#334155', transition:'background .15s' }} />
                      <span style={{ fontSize:14, fontWeight:700, color:plan===p.key?'#f1f5f9':'#94a3b8' }}>
                        {p.label}
                      </span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:p.color }}>{p.price}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#475569', marginBottom: plan===p.key ? 8 : 0 }}>
                    📊 {p.limit}
                  </div>
                  {plan===p.key && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {p.features.map(f => (
                        <span key={f} style={{ fontSize:10, color:'#94a3b8', background:'#0f172a',
                          padding:'2px 8px', borderRadius:4 }}>✓ {f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="fade-up-2 card" style={{ padding:28 }}>
            <div className="label" style={{ marginBottom:20 }}>Taarifa Zako</div>
            {serverError && (
              <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                borderRadius:8, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:16 }}>
                ⚠️ {serverError}
              </div>
            )}
            <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Input label="Jina lako *" name="name" placeholder="Jina kamili"
                value={form.name} onChange={handleChange} error={errors.name} />
              <Input label="Barua pepe *" name="email" type="email" placeholder="jina@kampuni.tz"
                value={form.email} onChange={handleChange} error={errors.email} />
              <Input label="Kampuni (optional)" name="org" placeholder="Jina la kampuni"
                value={form.org} onChange={handleChange} />
              <Input label="Nenosiri *" name="password" type="password" placeholder="Herufi 8+"
                value={form.password} onChange={handleChange} error={errors.password} />
              <Input label="Thibitisha Nenosiri *" name="confirmPassword" type="password" placeholder="Rudia nenosiri"
                value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />

              {/* Selected plan summary */}
              <div style={{ padding:'10px 14px', background:'rgba(59,130,246,0.08)',
                borderRadius:8, border:'1px solid rgba(59,130,246,0.15)', fontSize:12, color:'#93c5fd' }}>
                Mpango: <strong>{PLANS.find(p=>p.key===plan)?.label}</strong> —{' '}
                {PLANS.find(p=>p.key===plan)?.limit}
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width:'100%', justifyContent:'center', padding:'12px', fontSize:14,
                  opacity:loading?.7:1 }}>
                {loading ? '⏳ Inaunda akaunti...' : '🚀 Pata API Key Bure'}
              </button>

              <p style={{ fontSize:11, color:'#334155', textAlign:'center', lineHeight:1.6, margin:0 }}>
                Kwa kuendelea unakubali masharti ya matumizi. Data yako haitashirikishwa.
              </p>
            </form>
            <div style={{ textAlign:'center', marginTop:14, fontSize:12, color:'#475569' }}>
              Una akaunti tayari?{' '}
              <button onClick={() => setTab('login')}
                style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:12 }}>
                Ingia hapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ padding:100, textAlign:'center', color:'#64748b' }}>Inapakia...</div>}>
      <AuthContent />
    </Suspense>
  );
}
