import { useEffect, useState } from 'react';
import { getQueryLogs } from '../../api/caregiver';
import { listElders, type ElderSummary } from '../../api/caregiver';

const INTENT_ICONS: Record<string, string> = {
    person_query: '👤',
    medicine_query: '💊',
    routine_query: '🗓️',
    event_query: '📍',
    object_query: '🔍',
    reassurance_query: '💛',
    emergency: '🚨',
    unknown: '❓',
};
const INTENT_COLORS: Record<string, string> = {
    person_query: '#6366f1',
    medicine_query: '#f59e0b',
    routine_query: '#38bdf8',
    event_query: '#22c55e',
    object_query: '#a855f7',
    reassurance_query: '#f472b6',
    emergency: '#ef4444',
    unknown: '#6b7280',
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

export default function ActivityLogs() {
    const [elders, setElders] = useState<ElderSummary[]>([]);
    const [elderId, setElderId] = useState<number | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        listElders().then((list) => {
            setElders(list);
            if (list.length > 0) setElderId(list[0].id);
        });
    }, []);

    useEffect(() => {
        if (!elderId) return;
        setLoading(true);
        getQueryLogs(elderId).then((d: any) => setLogs(d.logs ?? [])).finally(() => setLoading(false));
    }, [elderId]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>📋 Activity Logs</h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Every question the elder has asked the system</p>
                </div>
                <select
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)',
                        padding: '0.45rem 0.85rem', fontSize: '0.875rem'
                    }}
                    value={elderId ?? ''} onChange={(e) => setElderId(Number(e.target.value))}
                >
                    {elders.map((el) => (
                        <option key={el.id} value={el.id} style={{ background: '#1a1f2c' }}>{el.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading…</div>
            ) : logs.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
                    <p style={{ fontWeight: 600, margin: 0 }}>No activity yet</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        Activity will appear here once the elder starts asking questions.
                    </p>
                </div>
            ) : (
                <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Intent', 'Query', 'Response Type', 'Confidence', 'When'].map((h) => (
                                    <th key={h} style={{ padding: '0.75rem 1.1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => {
                                const color = INTENT_COLORS[log.intent ?? 'unknown'] ?? '#6b7280';
                                return (
                                    <tr key={log.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '0.8rem 1.1rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                                                <span>{INTENT_ICONS[log.intent ?? 'unknown']}</span>
                                                <span style={{ color, fontWeight: 600 }}>{log.intent ?? 'unknown'}</span>
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 1.1rem', fontSize: '0.85rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.raw_query || '—'}
                                        </td>
                                        <td style={{ padding: '0.8rem 1.1rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 20,
                                                background: log.response_type === 'memory' ? 'rgba(34,197,94,0.15)' : log.response_type === 'emergency' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
                                                color: log.response_type === 'memory' ? '#22c55e' : log.response_type === 'emergency' ? '#ef4444' : '#6b7280',
                                            }}>
                                                {log.response_type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : '—'}
                                        </td>
                                        <td style={{ padding: '0.8rem 1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {timeAgo(log.timestamp)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
