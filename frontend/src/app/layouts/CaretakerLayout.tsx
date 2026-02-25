import { type ReactElement, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/authStore';

const NAV = [
  { to: '/caretaker/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/caretaker/logs', icon: '📋', label: 'Activity' },
  { to: '/caretaker/memories', icon: '🧠', label: 'Memories' },
  { to: '/caretaker/memories/new', icon: '➕', label: 'Memory' },
];

export default function CaretakerLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CG';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="layout">

        {/* ── Desktop Sidebar ── */}
        <aside className="sidebar" style={{ background: '#fff', borderRight: '1px solid var(--border)' }}>
          <div className="sidebar-logo">
            <div className="logo-mark" style={{ background: 'var(--primary)' }}>✨</div>
            <div className="logo-text" style={{ color: 'var(--text-primary)' }}>
              Sahara <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>CARE</span>
              <span>Caregiver Portal</span>
            </div>
          </div>

          <span className="sidebar-section-label" style={{ color: 'var(--text-muted)' }}>Main Menu</span>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.5rem' }}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/caretaker/dashboard'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                style={({ isActive }) => ({
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-subtle)' : 'transparent',
                })}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem', background: 'var(--primary)' }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Caregiver'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{user?.email ?? ''}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost btn-full" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
              ↩ Sign Out
            </button>
          </div>
        </aside>

        {/* ── Mobile Nav Overlay ── */}
        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(86, 47, 0, 0.2)', 
              backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' 
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                width: '280px', height: '100%', background: '#fff', padding: '1.5rem',
                boxShadow: '20px 0 50px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span style={{ fontSize: '1.5rem' }}>✨</span>
                   <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Sahara</h2>
                 </div>
                 <button onClick={() => setIsMobileMenuOpen(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/caretaker/dashboard'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    style={({ isActive }) => ({
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--primary-subtle)' : 'transparent',
                      padding: '1rem',
                      fontSize: '1rem'
                    })}
                  >
                    <span className="nav-icon" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '2rem', position: 'absolute', bottom: '1.5rem', width: 'calc(280px - 3rem)' }}>
                 <button onClick={handleLogout} className="btn btn-primary btn-full">Sign Out</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main ── */}
        <div className="main">
          <header className="topbar" style={{ background: 'rgba(255, 253, 241, 0.8)', padding: '1rem' }}>
            <button 
              className="mobile-only"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ 
                border: 'none', background: '#fff', width: 40, height: 40, 
                borderRadius: '10px', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginRight: '0.5rem'
              }}
            >
              ☰
            </button>

            <div className="topbar-search">
              <span className="search-icon">🔍</span>
              <input type="search" placeholder="Search memories, elders, logs…" style={{ background: '#fff', border: '1px solid var(--border)' }} />
            </div>
            <div className="topbar-actions">
              <div className="avatar" style={{ background: 'var(--primary)' }}>{initials}</div>
            </div>
          </header>

          <main className="page">
            <Outlet />
          </main>
        </div>

        <style>{`
          @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
          @media (min-width: 641px) { .mobile-only { display: none !important; } }
        `}</style>
      </div>
    </div>
  );
}
