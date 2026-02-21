import { type ReactElement, useState, useEffect } from 'react';
import { useAuthStore } from '../auth/authStore';
import apiClient from '../../api/axios';

const STATUS_BADGE: Record<string, string> = {
  Stable: 'badge-indigo',
  Good: 'badge-green',
  Critical: 'badge-red',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CaretakerDashboard(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<{ stats: any[], elders: any[], activity: any[] } | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [memory, setMemory] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch for main dashboard data
    apiClient.get('/caregiver/dashboard')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setData({ stats: [], elders: [], activity: [] });
        setLoading(false);
      });

    // Polling for live AI alerts and memory
    const pollInterval = setInterval(() => {
      apiClient.get('/alerts?limit=5').then(res => setAlerts(res.data.alerts)).catch(console.error);
      apiClient.get('/memory').then(res => setMemory(res.data.memory)).catch(console.error);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  if (loading || !data) {
    return (
      <div className="page-header fade-up" style={{ justifyContent: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="pulse" style={{ color: 'var(--primary)' }}>Loading Network...</h2>
        </div>
      </div>
    );
  }

  const { stats: STATS, elders: ELDERS, activity: ACTIVITY } = data;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header fade-up">
        <div>
          <h1 className="page-title">
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'Caretaker'} 👋
          </h1>
          <p className="page-subtitle">Here's what's happening across your care network today.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="badge badge-green pulse">● Live Monitoring</div>
          <button className="btn btn-primary">+ Add Elder</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {STATS.length > 0 && (
        <div className="grid-4 section fade-up fade-up-1">
          {STATS.map((s) => (
            <div key={s.label} className="glass stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <span className={`stat-change ${s.dir}`}>{s.change}</span>
              </div>
              <div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content Row ── */}
      <div className="grid-2 section fade-up fade-up-2" style={{ alignItems: 'start' }}>

        {/* Elders Table */}
        <div className="glass" style={{ padding: '1.5rem', gridColumn: 'span 1' }}>
          <div className="section-header">
            <span className="section-title">👥 Elder Status Overview</span>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>View All</button>
          </div>

          {ELDERS.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No elders under care at the moment.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Medication</th>
                  </tr>
                </thead>
                <tbody>
                  {ELDERS.map((e) => (
                    <tr key={e.id || e.name}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{e.name}</div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Age {e.age} · Room {e.room}</div>
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[e.status] ?? 'badge-indigo'}`}>● {e.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{
                              width: `${e.score}%`,
                              background: e.score >= 85 ? 'var(--success)'
                                : e.score >= 70 ? 'var(--warning)'
                                  : 'var(--danger)'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>{e.score}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: e.med === 'Overdue' ? 'var(--danger)' : e.med === 'Given' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                          {e.med === 'Overdue' ? '⚠ ' : e.med === 'Given' ? '✓ ' : '🕐 '}{e.med}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity & Alerts */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div>
            <div className="section-header">
              <span className="section-title">🚨 System Alerts & Activity</span>
              <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>All Logs</button>
            </div>

            {alerts.length === 0 && ACTIVITY.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent alerts to show.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {alerts.map((a) => (
                  <div key={a.id} className="activity-item" style={{ background: 'rgba(239,68,68,0.05)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.1)' }}>
                    <div className="activity-dot" style={{ background: 'var(--danger)' }} />
                    <div style={{ flex: 1 }}>
                      <div className="activity-text" style={{ color: 'var(--danger)' }}>{a.message}</div>
                      <div className="activity-time">{new Date(a.ts).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
                {ACTIVITY.map((a, i) => (
                  <div key={`act-${i}`} className="activity-item" style={{ padding: '0.5rem 0' }}>
                    <div className="activity-dot" style={{ background: a.color }} />
                    <div>
                      <div className="activity-text">{a.text}</div>
                      <div className="activity-time">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Tracked Items Memory */}
          <div>
            <div className="section-header">
              <span className="section-title">🔍 AI Object Tracking</span>
            </div>
            {Object.keys(memory).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No items currently tracked by AI vision.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {Object.values(memory).map((item: any) => (
                  <div key={item.label} style={{ background: 'var(--bg-input)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{item.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Found: {item.location_phrase.replace('-', ' ')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                      {new Date(item.last_seen_ts).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: '📞 Call Elder', color: 'var(--primary)' },
                { label: '🆘 Send Alert', color: 'var(--danger)' },
                { label: '💊 Log Meds', color: 'var(--success)' },
                { label: '📝 Add Note', color: 'var(--warning)' },
              ].map((q) => (
                <button
                  key={q.label}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', justifyContent: 'flex-start' }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
