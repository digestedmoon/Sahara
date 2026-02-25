import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMemories, deleteMemory, type Memory } from '../../api/memory';
import { listElders, type ElderSummary } from '../../api/caregiver';

const TYPE_ICONS: Record<string, string> = {
    person: '👤',
    medicine: '💊',
    routine: '🗓️',
    event: '📍',
    object: '🔍',
    reassurance: '💛',
};

const TYPE_LABELS: Record<string, string> = {
    person: 'Person',
    medicine: 'Medicine',
    routine: 'Routine',
    event: 'Event Update',
    object: 'Object',
    reassurance: 'Reassurance',
};

const TYPE_COLORS: Record<string, string> = {
    person: '#6366f1',
    medicine: '#f59e0b',
    routine: '#38bdf8',
    event: '#22c55e',
    object: '#a855f7',
    reassurance: '#f472b6',
};

function DetailSnippet({ mem }: { mem: Memory }) {
    const d = mem.detail;
    switch (mem.type) {
        case 'person':
            return <span>{d.relationship ? `${d.relationship} · ` : ''}{d.phone ?? ''}</span>;
        case 'medicine':
            return <span>{d.dosage ? `${d.dosage} · ` : ''}{d.reason?.substring(0, 60) ?? ''}</span>;
        case 'routine':
            return <span>{d.time_of_day ?? 'Daily'} · {d.repeat_pattern ?? ''}</span>;
        case 'event':
            return <span>{d.related_person ? `${d.related_person}: ` : ''}{(d.message ?? '').substring(0, 80)}</span>;
        case 'object':
            return <span>📍 {d.usual_location ?? ''}</span>;
        case 'reassurance':
            return <span>{(d.message ?? '').substring(0, 80)}</span>;
        default:
            return null;
    }
}

export default function MemoryList() {
    const navigate = useNavigate();
    const [elders, setElders] = useState<ElderSummary[]>([]);
    const [selectedElder, setSelectedElder] = useState<number | null>(null);
    const [filterType, setFilterType] = useState<string>('');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        listElders().then((list) => {
            setElders(list);
            if (list.length > 0) setSelectedElder(list[0].id);
        });
    }, []);

    const load = useCallback(() => {
        if (!selectedElder) return;
        setLoading(true);
        listMemories(selectedElder, filterType || undefined)
            .then(setMemories)
            .finally(() => setLoading(false));
    }, [selectedElder, filterType]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this memory? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await deleteMemory(id);
            setMemories((prev) => prev.filter((m) => m.id !== id));
        } finally {
            setDeleting(null);
        }
    };

    const ALL_TYPES = ['person', 'medicine', 'routine', 'event', 'object', 'reassurance'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>🧠 Memory Bank</h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>All memories stored for your elders</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{ padding: '0.65rem 1.4rem', fontWeight: 700 }}
                    onClick={() => navigate('/caretaker/memories/new')}
                >
                    + Add Memory
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Elder Selector */}
                <select
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.9rem',
                        fontSize: '0.875rem', cursor: 'pointer'
                    }}
                    value={selectedElder ?? ''}
                    onChange={(e) => setSelectedElder(Number(e.target.value))}
                >
                    {elders.map((el) => (
                        <option key={el.id} value={el.id} style={{ background: '#1a1f2c' }}>{el.name}</option>
                    ))}
                </select>

                {/* Type filters */}
                <button
                    onClick={() => setFilterType('')}
                    className={`btn btn-ghost${filterType === '' ? ' active' : ''}`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', opacity: filterType === '' ? 1 : 0.6 }}
                >
                    All
                </button>
                {ALL_TYPES.map((t) => (
                    <button
                        key={t}
                        onClick={() => setFilterType(filterType === t ? '' : t)}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem',
                            cursor: 'pointer', fontWeight: 600, border: 'none',
                            background: filterType === t ? `${TYPE_COLORS[t]}30` : 'rgba(255,255,255,0.06)',
                            color: filterType === t ? TYPE_COLORS[t] : 'var(--text-muted)',
                            transition: 'all 0.15s'
                        }}
                    >
                        {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </button>
                ))}
            </div>

            {/* Memory List */}
            {loading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem', fontSize: '1rem' }}>
                    Loading memories…
                </div>
            ) : memories.length === 0 ? (
                <div
                    className="card"
                    style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}
                >
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🧠</div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>No memories yet</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                        Click "+ Add Memory" to store the first memory for this elder.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {memories.map((m) => {
                        const color = TYPE_COLORS[m.type] ?? '#6b7280';
                        return (
                            <div
                                key={m.id}
                                className="card"
                                style={{
                                    padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    borderLeft: `3px solid ${color}`
                                }}
                            >
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{TYPE_ICONS[m.type]}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{m.title}</span>
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem',
                                            borderRadius: 20, background: `${color}20`, color
                                        }}>
                                            {TYPE_LABELS[m.type]}
                                        </span>
                                    </div>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <DetailSnippet mem={m} />
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                        onClick={() => navigate(`/caretaker/memories/${m.id}/edit`)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#ef4444', opacity: deleting === m.id ? 0.5 : 1 }}
                                        onClick={() => handleDelete(m.id)}
                                        disabled={deleting === m.id}
                                    >
                                        {deleting === m.id ? '…' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
