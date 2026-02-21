import { type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/authStore';

const NAV = [
  { to: '/elder/dashboard', icon: '⊞', label: 'My Dashboard' },
  { to: '/elder/health', icon: '❤', label: 'Health Vitals' },
  { to: '/elder/meds', icon: '💊', label: 'Medications', badge: '2' },
  { to: '/elder/schedule', icon: '📅', label: 'Daily Schedule' },
  { to: '/elder/messages', icon: '💬', label: 'Messages', badge: '1' },
  { to: '/elder/sos', icon: '🆘', label: 'Emergency SOS' },
];

export default function ElderLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EL';

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
              <span>Personal Health Hub</span>
            </div>
          </div>

          <span className="sidebar-section-label">Navigation</span>

          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/elder/dashboard'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}

          <span className="sidebar-section-label">Account</span>
          <div className="nav-item"><span className="nav-icon">👤</span>My Profile</div>
          <div className="nav-item"><span className="nav-icon">⚙</span>Settings</div>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Elder'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Elder Member</p>
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
              <input type="search" placeholder="Search my health records…" />
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
