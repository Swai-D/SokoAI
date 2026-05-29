'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href:'/',           label:'Dashboard' },
  { href:'/masoko',     label:'Masoko'    },
  { href:'/bidhaa',     label:'Bidhaa'    },
  { href:'/developers', label:'API Docs'  },
  { href:'/admin',      label:'Admin', adminOnly: true },
];

const PLAN_COLOR = { enterprise:'#f59e0b', pro:'#a855f7', basic:'#3b82f6', free:'#64748b' };

export default function NavbarWithAuth() {
  const path          = usePathname();
  const { user, apiKey, logout, loading } = useAuth();

  return (
    <header style={{
      background:'linear-gradient(135deg,#0d1829 0%,#060d1a 100%)',
      borderBottom:'1px solid #1e3a5f',
      padding:'0 24px', display:'flex', alignItems:'center',
      justifyContent:'space-between', height:58,
      position:'sticky', top:0, zIndex:100,
      backdropFilter:'blur(12px)',
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', borderRadius:9,
          width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
          📈
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:17, color:'#f1f5f9', letterSpacing:'-0.4px', lineHeight:1 }}>
            SokoAI
          </div>
          <div style={{ fontSize:9, color:'#334155', letterSpacing:'0.8px', textTransform:'uppercase' }}>
            Tanzania Market Intelligence
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav style={{ display:'flex', gap:2 }}>
        {NAV
          .filter(n => !n.adminOnly || user?.role === 'admin')
          .map(n => (
            <Link key={n.href} href={n.href}
              className={`nav-link ${path===n.href||(n.href!=='/'&&path.startsWith(n.href))?'active':''}`}>
              {n.label}
            </Link>
          ))
        }
      </nav>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>

        {/* Live indicator */}
        <div style={{ background:'#0f172a', borderRadius:8, padding:'5px 12px',
          border:'1px solid #1e3a5f', display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e',
            animation:'pulse-dot 2s infinite', color:'#22c55e' }} />
          <span style={{ fontSize:11, color:'#64748b', fontFamily:'var(--font-mono)' }}>LIVE</span>
        </div>

        {/* Auth state */}
        {loading ? (
          <div className="skeleton" style={{ width:80, height:32, borderRadius:8 }} />
        ) : user ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Plan badge */}
            {apiKey?.plan && (
              <span style={{ fontSize:10, fontWeight:700,
                color:PLAN_COLOR[apiKey.plan], background:PLAN_COLOR[apiKey.plan]+'15',
                padding:'3px 10px', borderRadius:99, textTransform:'uppercase' }}>
                {apiKey.plan}
              </span>
            )}
            {/* User menu */}
            <Link href="/account" style={{ display:'flex', alignItems:'center', gap:8,
              background:'#0d1829', border:'1px solid #1e3a5f', borderRadius:8,
              padding:'6px 12px', textDecoration:'none' }}>
              <div style={{ width:24, height:24, borderRadius:'50%',
                background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                {user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span style={{ fontSize:12, color:'#94a3b8', maxWidth:100,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user.name?.split(' ')[0]}
              </span>
            </Link>
            <button onClick={logout} className="btn btn-ghost"
              style={{ padding:'6px 12px', fontSize:12 }}>
              Toka
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <Link href="/auth" className="btn btn-ghost" style={{ padding:'6px 14px', fontSize:12 }}>
              Ingia
            </Link>
            <Link href="/auth?tab=register" className="btn btn-primary" style={{ padding:'6px 14px', fontSize:12 }}>
              Jiunge Bure
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
