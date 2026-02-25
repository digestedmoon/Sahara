import { useEffect, useState } from 'react';
import { listReminders, createReminder, deleteReminder, type Reminder } from '../../api/reminders';
import { listElders, type ElderSummary } from '../../api/caregiver';

const INPUT_STYLE = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.85rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const,
};

export default function ReminderList() {
    const [elders, setElders] = useState<ElderSummary[]>([]);
    const [elderId, setElderId] = useState<number | null>(null);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    // Form state
    const [fTitle, setFTitle] = useState('');
    const [fBody, setFBody] = useState('');
    const [fTime, setFTime] = useState('08:00');
    const [fRepeat, setFRepeat] = useState('daily');
    const [fError, setFError] = useState('');

    useEffect(() => {
        listElders().then((list) => {
            setElders(list);
            if (list.length > 0) setElderId(list[0].id);
        });
    }, []);

    useEffect(() => {
        if (!elderId) return;
        setLoading(true);
        listReminders(elderId).then(setReminders).finally(() => setLoading(false));
    }, [elderId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!elderId || !fTitle.trim() || !fTime) { setFError('All fields required.'); return; }
        setSubmitting(true); setFError('');
        try {
            const r = await createReminder({ elder_id: elderId, title: fTitle, body: fBody, scheduled_time: fTime, repeat_pattern: fRepeat });
            setReminders((prev) => [r, ...prev]);
            setShowForm(false); setFTitle(''); setFBody(''); setFTime('08:00'); setFRepeat('daily');
        } catch {
            setFError('Failed to create reminder.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this reminder?')) return;
        setDeleting(id);
        try {
            await deleteReminder(id);
            setReminders((prev) => prev.filter((r) => r.id !== id));
        } finally {
            setDeleting(null);
        }
    };

    const REPEAT_LABELS: Record<string, string> = {
        daily: 'Daily', weekdays: 'Weekdays', once: 'Once', 'Mon,Wed,Fri': 'M/W/F'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>⏰ Reminders</h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Schedule daily reminders for your elders</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                        style={{ ...INPUT_STYLE, width: 'auto' }}
                        value={elderId ?? ''} onChange={(e) => setElderId(Number(e.target.value))}
                    >
                        {elders.map((el) => (
                            <option key={el.id} value={el.id} style={{ background: '#1a1f2c' }}>{el.name}</option>
                        ))}
                    </select>
                    <button className="btn btn-primary" style={{ padding: '0.6rem 1.3rem', fontWeight: 700 }}
                        onClick={() => setShowForm(!showForm)}>
                        {showForm ? '✕ Cancel' : '+ Add Reminder'}
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 700 }}>New Reminder</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Title *</label>
                            <input style={INPUT_STYLE} value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="e.g. Take Metformin" required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Time *</label>
                            <input type="time" style={INPUT_STYLE} value={fTime} onChange={(e) => setFTime(e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Body / Message (Nepali)</label>
                        <input style={INPUT_STYLE} value={fBody} onChange={(e) => setFBody(e.target.value)} placeholder="हजुर, औषधि खाने बेला भयो!" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Repeat</label>
                        <select style={{ ...INPUT_STYLE, width: 'auto' }} value={fRepeat} onChange={(e) => setFRepeat(e.target.value)}>
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays only</option>
                            <option value="Mon,Wed,Fri">Mon / Wed / Fri</option>
                            <option value="once">Once</option>
                        </select>
                    </div>
                    {fError && <p style={{ color: '#ef4444', fontSize: '0.82rem', margin: 0 }}>{fError}</p>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ fontWeight: 700, padding: '0.55rem 1.4rem' }}>
                            {submitting ? 'Saving…' : 'Save Reminder'}
                        </button>
                    </div>
                </form>
            )}

            {/* Reminder List */}
            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading…</div>
            ) : reminders.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⏰</div>
                    <p style={{ fontWeight: 600, margin: 0 }}>No reminders yet</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Create a reminder above to get started.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {reminders.map((r) => (
                        <div key={r.id} className="card" style={{
                            padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            borderLeft: `3px solid ${r.active ? 'var(--primary)' : '#6b7280'}`
                        }}>
                            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', background: r.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                ⏰
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{r.title}</p>
                                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    🕐 {r.scheduled_time} · {REPEAT_LABELS[r.repeat_pattern] ?? r.repeat_pattern}
                                    {r.body && ` · "${r.body.substring(0, 50)}"`}
                                </p>
                            </div>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.55rem',
                                borderRadius: 20, background: r.active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                                color: r.active ? '#22c55e' : '#6b7280'
                            }}>
                                {r.active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                className="btn btn-ghost"
                                style={{ color: '#ef4444', fontSize: '0.78rem', padding: '0.35rem 0.65rem', opacity: deleting === r.id ? 0.5 : 1 }}
                                onClick={() => handleDelete(r.id)}
                                disabled={deleting === r.id}
                            >
                                {deleting === r.id ? '…' : 'Delete'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
