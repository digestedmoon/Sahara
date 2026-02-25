import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, type DashboardData } from '../../api/caregiver';

const STAT_ICONS: Record<string, string> = {
  elder_count: '👴',
  memory_count: '🧠',
  reminder_count: '⏰',
  emergency_count: '🚨',
};

function timeAgo(iso: string) {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const INTENT_COLOR: Record<string, string> = {
  person_query: '#6366f1',
  event_query: '#22c55e',
  medicine_query: '#f59e0b',
  object_query: '#a855f7',
  routine_query: '#38bdf8',
  reassurance_query: '#f472b6',
  emergency: '#ef4444',
  unknown: '#6b7280',
};

export default function CaretakerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
        <span className="pulse">●</span>&nbsp; Loading dashboard…
      </div>
    );
  }

  const stats = data?.stats;
  const statCards = [
    { key: 'elder_count', label: 'Elders Under Care', value: stats?.elder_count ?? 0, color: '#6366f1' },
    { key: 'memory_count', label: 'Total Memories', value: stats?.memory_count ?? 0, color: '#22c55e' },
    { key: 'reminder_count', label: 'Active Reminders', value: stats?.reminder_count ?? 0, color: '#f59e0b' },
    { key: 'emergency_count', label: 'Emergency Events', value: stats?.emergency_count ?? 0, color: '#ef4444' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Caregiver Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', margin: 0 }}>
            Overview of all elders and memory activity
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/caretaker/memories/new')}
          style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
        >
          + Add Memory
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        {statCards.map((s) => (
          <div
            key={s.key}
            className="card"
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${s.color}30`,
              background: `${s.color}08`,
              display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>{STAT_ICONS[s.key]}</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
          </div>
        ))}
        {/* Compliance */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #10b98130',
            background: '#10b98108',
            display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}
        >
          <span style={{ fontSize: '1.8rem' }}>✅</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>{stats?.compliance_pct ?? 0}%</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reminder Compliance</span>
        </div>
      </div>

      {/* Main Grid: Elder list + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Elder List */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Elders</h2>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/caretaker/memories')}>
              View Memories →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(data?.elders ?? []).length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                No elders found. <a href="/api/auth/seed" style={{ color: 'var(--primary)' }}>Seed demo data</a>.
              </p>
            )}
            {(data?.elders ?? []).map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onClick={() => navigate('/caretaker/memories')}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              >
                <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.75rem', flexShrink: 0 }}>
                  {e.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{e.name}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {e.memories} memories · {e.reminders} reminders · {e.last_active ? timeAgo(e.last_active) : 'No activity yet'}
                  </p>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>→</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', marginTop: 0 }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(data?.activity ?? []).length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                No activity yet. Elders haven't asked questions yet.
              </p>
            )}
            {(data?.activity ?? []).map((a, i) => {
              const color = a.type === 'emergency' ? '#ef4444' : INTENT_COLOR[a.intent ?? 'unknown'] ?? '#6b7280';
              return (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: '0.35rem' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.text || a.intent}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Elder {a.elder_id} · {timeAgo(a.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
