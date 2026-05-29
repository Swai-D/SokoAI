export default function OfflinePage() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'80vh', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>📴</div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>
        Huna Intaneti
      </h1>
      <p style={{ fontSize:14, color:'#64748b', maxWidth:320, lineHeight:1.7, marginBottom:24 }}>
        Unaangalia toleo la mwisho lililohifadhiwa la SokoAI.
        Bei zinaonyeshwa ni za mwisho uliposoma ukiwa na intaneti.
      </p>

      <div style={{ background:'#0d1829', border:'1px solid #1e3a5f', borderRadius:14,
        padding:20, maxWidth:320, width:'100%', marginBottom:24 }}>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>
          🕐 Bei za mwisho zilizohifadhiwa:
        </div>
        <div style={{ fontSize:13, color:'#94a3b8' }}>
          Rudi kwenye ukurasa mkuu uone bei za mwisho.
        </div>
      </div>

      <button
        onClick={() => window.location.href = '/'}
        className="btn btn-primary"
        style={{ marginBottom:12 }}>
        ← Rudi Dashboard
      </button>
      <button
        onClick={() => window.location.reload()}
        className="btn btn-ghost">
        🔄 Jaribu tena
      </button>
    </div>
  );
}
