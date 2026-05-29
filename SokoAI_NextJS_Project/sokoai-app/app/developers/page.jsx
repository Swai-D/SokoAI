'use client';
import { useState } from 'react';
import Link from 'next/link';

const ENDPOINTS = [
  {
    method:'GET', path:'/api/v1/prices',
    desc:'Bei za leo kwa bidhaa / soko / mkoa',
    params:[
      { name:'bidhaa', req:false, desc:'Jina la bidhaa (e.g. Nyanya)' },
      { name:'soko',   req:false, desc:'Jina la soko (e.g. Kariakoo)' },
      { name:'mkoa',   req:false, desc:'Mkoa (e.g. Dar es Salaam)' },
    ],
    example: `curl -H "X-API-Key: soko_xxx" \\
  "https://api.sokoai.tz/api/v1/prices?bidhaa=Nyanya&soko=Kariakoo"`,
    response: `{
  "status": "success",
  "count": 1,
  "tarehe": "2026-05-22",
  "data": [{
    "date": "2026-05-22",
    "soko": "Kariakoo",
    "commodity": "Nyanya",
    "price": 45000,
    "unit": "tenga",
    "hali_soko": "Wastani"
  }]
}`,
  },
  {
    method:'GET', path:'/api/v1/forecast',
    desc:'Utabiri wa bei kwa wiki 8 zijazo + smart alert',
    params:[
      { name:'bidhaa', req:true,  desc:'Jina la bidhaa (lazima)' },
      { name:'soko',   req:false, desc:'Soko maalum (optional)' },
    ],
    example: `curl -H "X-API-Key: soko_xxx" \\
  "https://api.sokoai.tz/api/v1/forecast?bidhaa=Sukari"`,
    response: `{
  "status": "success",
  "bidhaa": "Sukari",
  "bei_ya_sasa": 3200,
  "utabiri_wa_bei": {
    "wiki_1": 3200, "wiki_2": 3300,
    "wiki_3": 3500, "wiki_4": 3700,
    "wiki_5": 3800, "wiki_6": 3700,
    "wiki_7": 3500, "wiki_8": 3300
  },
  "alert": { "code": "NUNUA_SASA", "message": "Bei itapanda 15.6% wiki 4 zijazo" },
  "sababu": "Msimu wa mvua unatarajiwa kupunguza usafirishaji."
}`,
  },
  {
    method:'GET', path:'/api/v1/prices/history',
    desc:'Historia ya bei kwa siku 7–365',
    params:[
      { name:'bidhaa', req:true,  desc:'Jina la bidhaa (lazima)' },
      { name:'siku',   req:false, desc:'Idadi ya siku (7-365, default 90)' },
      { name:'soko',   req:false, desc:'Soko maalum (optional)' },
    ],
    example: `curl -H "X-API-Key: soko_xxx" \\
  "https://api.sokoai.tz/api/v1/prices/history?bidhaa=Mahindi&siku=30"`,
    response: `{
  "status": "success",
  "bidhaa": "Mahindi",
  "takwimu": { "bei_ya_chini": 750, "bei_ya_juu": 1100, "wastani": 920 },
  "historia": [
    { "date": "2026-04-22", "price": 850, "soko": "Kariakoo" },
    ...
  ]
}`,
  },
  {
    method:'POST', path:'/api/v1/webhook/sms',
    desc:'Ingiza data ya mdalali (hakuna API key)',
    params:[
      { name:'message',     req:true,  desc:'Ujumbe wa #DATA_SOKO (text)' },
      { name:'sender',      req:false, desc:'Nambari ya simu ya mdalali' },
      { name:'received_at', req:false, desc:'Wakati wa ujumbe (ISO 8601)' },
    ],
    example: `curl -X POST "https://api.sokoai.tz/api/v1/webhook/sms" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "#DATA_SOKO\\nSoko: Kariakoo\\nMkoa: Dar es Salaam\\n--- NAFAKA ---\\nMahindi (Kilo): 900\\nMchele (Kilo): 2400\\nHali ya Mzigo: Wastani",
    "sender": "+255712345678"
  }'`,
    response: `{
  "status": "success",
  "message": "Asante! Bei 2 za Kariakoo zimehifadhiwa.",
  "submission_id": 42,
  "records_saved": 2
}`,
  },
];

const CODE_EXAMPLES = {
  python: `import requests

API_KEY = "soko_your_key_here"
BASE    = "https://api.sokoai.tz"

headers = {"X-API-Key": API_KEY}

# Bei za leo
r = requests.get(f"{BASE}/api/v1/prices", headers=headers,
                 params={"bidhaa": "Nyanya", "soko": "Kariakoo"})
data = r.json()
print(data["data"][0]["price"])  # 45000

# Utabiri wiki 8
r = requests.get(f"{BASE}/api/v1/forecast", headers=headers,
                 params={"bidhaa": "Sukari"})
fc = r.json()
print(fc["alert"]["code"])       # NUNUA_SASA
print(fc["utabiri_wa_bei"])      # {"wiki_1": 3200, ...}`,

  javascript: `const API_KEY = "soko_your_key_here";
const BASE    = "https://api.sokoai.tz";

const headers = { "X-API-Key": API_KEY };

// Bei za leo
const res = await fetch(\`\${BASE}/api/v1/prices?bidhaa=Nyanya&soko=Kariakoo\`, { headers });
const data = await res.json();
console.log(data.data[0].price); // 45000

// Utabiri wiki 8
const fc = await fetch(\`\${BASE}/api/v1/forecast?bidhaa=Sukari\`, { headers }).then(r=>r.json());
console.log(fc.alert.code);           // NUNUA_SASA
console.log(fc.utabiri_wa_bei.wiki_4); // 3700`,

  curl: `# Weka API key yako
export SOKO_KEY="soko_your_key_here"

# Bei za leo — Nyanya Kariakoo
curl -s -H "X-API-Key: $SOKO_KEY" \\
  "https://api.sokoai.tz/api/v1/prices?bidhaa=Nyanya&soko=Kariakoo" | python3 -m json.tool

# Utabiri — Sukari
curl -s -H "X-API-Key: $SOKO_KEY" \\
  "https://api.sokoai.tz/api/v1/forecast?bidhaa=Sukari" | python3 -m json.tool

# Masoko yote
curl -s -H "X-API-Key: $SOKO_KEY" \\
  "https://api.sokoai.tz/api/v1/masoko" | python3 -m json.tool`,
};

const METHOD_COLOR = { GET:'#22c55e', POST:'#3b82f6', DELETE:'#ef4444' };

export default function DevelopersPage() {
  const [lang, setLang]         = useState('python');
  const [openEndpoint, setOpen] = useState(0);

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom:32 }}>
        <h1 style={{ fontSize:26, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.5px' }}>
          🛠 Developer Portal
        </h1>
        <p style={{ fontSize:14, color:'#64748b', marginTop:6, maxWidth:600 }}>
          Unganisha app yako na data za bei za masoko Tanzania. REST API rahisi, JSON responses, na utabiri wa AI.
        </p>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <Link href="/auth" className="btn btn-primary">🚀 Pata API Key</Link>
          <a href="https://api.sokoai.tz/docs" target="_blank" className="btn btn-ghost">
            📄 Interactive Docs (Swagger)
          </a>
        </div>
      </div>

      {/* Base URL */}
      <div className="fade-up-1 card" style={{ padding:'14px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'#64748b', fontWeight:700, letterSpacing:'0.5px' }}>BASE URL</span>
        <code style={{ fontFamily:'var(--font-mono)', fontSize:14, color:'#3b82f6' }}>
          https://api.sokoai.tz
        </code>
        <span style={{ fontSize:11, color:'#475569', marginLeft:'auto' }}>
          Header ya lazima: <code style={{ color:'#a855f7', fontFamily:'var(--font-mono)' }}>X-API-Key: soko_xxx</code>
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20 }}>

        {/* Endpoints */}
        <div className="fade-up-2">
          <div className="label" style={{ marginBottom:14 }}>Endpoints</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ENDPOINTS.map((ep, i) => {
              const isOpen = openEndpoint === i;
              return (
                <div key={i} className="card" style={{ overflow:'hidden' }}>
                  {/* Header */}
                  <div onClick={() => setOpen(isOpen ? -1 : i)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
                      color: METHOD_COLOR[ep.method] ?? '#94a3b8',
                      background: (METHOD_COLOR[ep.method]??'#94a3b8')+'15',
                      padding:'3px 8px', borderRadius:4 }}>{ep.method}</span>
                    <code style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'#f1f5f9', flex:1 }}>{ep.path}</code>
                    <span style={{ fontSize:11, color:'#475569' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', padding:'0 16px 10px' }}>{ep.desc}</div>

                  {/* Expanded */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid #1e3a5f', padding:'16px' }}>
                      {/* Params */}
                      <div className="label" style={{ marginBottom:8 }}>Parameters</div>
                      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16 }}>
                        <thead>
                          <tr style={{ fontSize:10, color:'#475569' }}>
                            <th style={{ textAlign:'left', padding:'4px 8px' }}>Param</th>
                            <th style={{ textAlign:'left', padding:'4px 8px' }}>Hali</th>
                            <th style={{ textAlign:'left', padding:'4px 8px' }}>Maelezo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.params.map(p => (
                            <tr key={p.name} style={{ borderTop:'1px solid #0f172a' }}>
                              <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', fontSize:12, color:'#a855f7' }}>{p.name}</td>
                              <td style={{ padding:'6px 8px', fontSize:10, color: p.req?'#ef4444':'#22c55e' }}>{p.req?'Lazima':'Optional'}</td>
                              <td style={{ padding:'6px 8px', fontSize:12, color:'#94a3b8' }}>{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Example */}
                      <div className="label" style={{ marginBottom:8 }}>Mfano</div>
                      <pre style={{ background:'#0f172a', borderRadius:8, padding:14, fontSize:11,
                        color:'#94a3b8', fontFamily:'var(--font-mono)', overflow:'auto',
                        border:'1px solid #1e3a5f', marginBottom:14, lineHeight:1.7 }}>
                        {ep.example}
                      </pre>

                      {/* Response */}
                      <div className="label" style={{ marginBottom:8 }}>Response</div>
                      <pre style={{ background:'#0f172a', borderRadius:8, padding:14, fontSize:11,
                        color:'#22c55e', fontFamily:'var(--font-mono)', overflow:'auto',
                        border:'1px solid #1e3a5f', lineHeight:1.7 }}>
                        {ep.response}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: code examples + error codes */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Code examples */}
          <div className="card fade-up-1" style={{ padding:16 }}>
            <div className="label" style={{ marginBottom:12 }}>Mifano ya Code</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {Object.keys(CODE_EXAMPLES).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  background: lang===l ? '#1d4ed8' : '#0f172a',
                  border: `1px solid ${lang===l ? '#3b82f6' : '#1e3a5f'}`,
                  borderRadius:6, padding:'4px 12px', color: lang===l?'#fff':'#64748b',
                  fontSize:12, cursor:'pointer', transition:'all .15s',
                }}>{l}</button>
              ))}
            </div>
            <pre style={{ background:'#0f172a', borderRadius:8, padding:14, fontSize:11,
              color:'#94a3b8', fontFamily:'var(--font-mono)', overflow:'auto',
              border:'1px solid #1e3a5f', lineHeight:1.8, margin:0, maxHeight:320 }}>
              {CODE_EXAMPLES[lang]}
            </pre>
          </div>

          {/* Error codes */}
          <div className="card fade-up-2" style={{ padding:16 }}>
            <div className="label" style={{ marginBottom:12 }}>Error Codes</div>
            {[
              ['401', 'API key batili au kikomo kimefikiwa',  '#ef4444'],
              ['404', 'Bidhaa/soko haikupatikana',           '#f59e0b'],
              ['400', 'Muundo wa ombi si sahihi',             '#f59e0b'],
              ['429', 'Maombi mengi sana — punguza kasi',    '#ef4444'],
              ['500', 'Hitilafu ya seva — wasiliana nasi',   '#94a3b8'],
            ].map(([code, msg, color]) => (
              <div key={code} style={{ display:'flex', gap:10, alignItems:'center',
                padding:'7px 0', borderBottom:'1px solid #0f172a' }}>
                <code style={{ fontFamily:'var(--font-mono)', fontSize:12, color, width:35, flexShrink:0 }}>{code}</code>
                <span style={{ fontSize:12, color:'#64748b' }}>{msg}</span>
              </div>
            ))}
          </div>

          {/* Rate limits */}
          <div className="card fade-up-3" style={{ padding:16 }}>
            <div className="label" style={{ marginBottom:12 }}>Vikomo vya Maombi</div>
            {[
              ['Free','100/siku','#64748b'],
              ['Basic','1,000/siku','#3b82f6'],
              ['Pro','10,000/siku','#a855f7'],
              ['Enterprise','Bila kikomo','#f59e0b'],
            ].map(([plan, limit, color]) => (
              <div key={plan} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0', borderBottom:'1px solid #0f172a' }}>
                <span style={{ fontSize:12, color:'#94a3b8' }}>{plan}</span>
                <span style={{ fontSize:12, fontWeight:700, color, fontFamily:'var(--font-mono)' }}>{limit}</span>
              </div>
            ))}
            <Link href="/auth" className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', marginTop:14, fontSize:12 }}>
              Pata API Key →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
