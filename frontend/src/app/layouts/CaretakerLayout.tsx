import { type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/authStore';

const NAV = [
  { to: '/caretaker/dashboard', icon: '⊞', label: 'Overview' },
  { to: '/caretaker/elders', icon: '👴', label: 'My Elders', badge: '4' },
  { to: '/caretaker/alerts', icon: '🔔', label: 'Alerts', badge: '3' },
  { to: '/caretaker/schedule', icon: '📅', label: 'Schedule' },
  { to: '/caretaker/messages', icon: '💬', label: 'Messages', badge: '7' },
  { to: '/caretaker/reports', icon: '📊', label: 'Reports' },
];

export default function CaretakerLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CT';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <div className="bg-mesh" />
      <div className="layout">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">🫀</div>
            <div className="logo-text">
              ElderCare AI
              <span>Caretaker Portal</span>
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
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}

          <span className="sidebar-section-label">Settings</span>
          <div className="nav-item"><span className="nav-icon">⚙</span>Preferences</div>
          <div className="nav-item"><span className="nav-icon">🛡</span>Privacy &amp; Security</div>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Caretaker'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email ?? ''}
                </p>
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
              <input type="search" placeholder="Search elders, alerts, reports…" />
            </div>
            <div className="topbar-actions">
              <button className="btn btn-ghost btn-icon notif-dot" title="Notifications">🔔</button>
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
