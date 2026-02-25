import { type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/authStore';

const NAV = [
  { to: '/caretaker/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/caretaker/memories', icon: '🧠', label: 'Memories' },
  { to: '/caretaker/reminders', icon: '⏰', label: 'Reminders' },
  { to: '/caretaker/logs', icon: '📋', label: 'Activity Logs' },
];

export default function CaretakerLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CG';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <div className="bg-mesh" />
      <div className="layout">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">🧠</div>
            <div className="logo-text">
              SaharaAI
              <span>Caregiver Portal</span>
            </div>
          </div>

          <span className="sidebar-section-label">Main Menu</span>

          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/caretaker/dashboard'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Caregiver'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{user?.email ?? ''}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost btn-full" style={{ fontSize: '0.82rem' }}>
              ↩ Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main">
          <header className="topbar">
            <div className="topbar-search">
              <span className="search-icon">🔍</span>
              <input type="search" placeholder="Search memories, elders, logs…" />
            </div>
            <div className="topbar-actions">
              <div className="avatar">{initials}</div>
            </div>
          </header>

          <div className="page">
            <Outlet />
          </div>
        </div>

      </div>
    </>
  );
}
