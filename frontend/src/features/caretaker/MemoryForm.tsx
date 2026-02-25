import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createMemory, updateMemory, listMemories, type Memory } from '../../api/memory';
import { listElders, type ElderSummary } from '../../api/caregiver';

const TYPES = [
    { value: 'person', label: '👤 Person', desc: 'Who someone is — name, relationship, phone' },
    { value: 'medicine', label: '💊 Medicine', desc: 'Medication info, dosage, reason' },
    { value: 'routine', label: '🗓️ Routine', desc: 'Daily schedule / times' },
    { value: 'event', label: '📍 Event Update', desc: "Where someone is today — caregiver's update" },
    { value: 'object', label: '🔍 Object', desc: 'Where a common item is kept' },
    { value: 'reassurance', label: '💛 Reassurance', desc: 'A calming message for anxious moments' },
];

const INPUT = {
    style: {
        width: '100%', boxSizing: 'border-box' as const,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)',
        padding: '0.55rem 0.85rem', fontSize: '0.9rem',
    }
};
const TEXTAREA = {
    style: { ...INPUT.style, minHeight: 90, resize: 'vertical' as const }
};
const LABEL = {
    style: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'block', marginBottom: '0.35rem' }
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label style={LABEL.style}>{label}</label>
            {children}
        </div>
    );
}

function DetailFields({ type, detail, onChange }: {
    type: string;
    detail: Record<string, any>;
    onChange: (k: string, v: string) => void;
}) {
    const inp = (key: string, placeholder = '') => (
        <input {...INPUT} value={detail[key] ?? ''} placeholder={placeholder} onChange={(e) => onChange(key, e.target.value)} />
    );
    const area = (key: string, placeholder = '') => (
        <textarea {...TEXTAREA} value={detail[key] ?? ''} placeholder={placeholder} onChange={(e) => onChange(key, e.target.value)} />
    );

    if (type === 'person') return (
        <>
            <Field label="Full Name">{inp('name', 'e.g. Ram Sharma')}</Field>
            <Field label="Relationship">{inp('relationship', 'e.g. son, daughter, doctor')}</Field>
            <Field label="Phone Number">{inp('phone', '+977 9800000000')}</Field>
        </>
    );

    if (type === 'medicine') return (
        <>
            <Field label="Medicine Name">{inp('name', 'e.g. Metformin 500mg')}</Field>
            <Field label="Dosage">{inp('dosage', 'e.g. 1 tablet after meals')}</Field>
            <Field label="Reason (plain language)">{area('reason', 'e.g. रगतमा चिनी नियन्त्रण गर्न — to control blood sugar')}</Field>
        </>
    );

    if (type === 'routine') return (
        <>
            <Field label="Time of Day (HH:MM)">{inp('time_of_day', '08:00')}</Field>
            <Field label="Description">{area('description', 'e.g. बिहान उठेपछि पानी पिउनुहोस्')}</Field>
            <Field label="Repeat Pattern">
                <select {...INPUT} value={detail['repeat_pattern'] ?? 'daily'} onChange={(e) => onChange('repeat_pattern', e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="once">Once</option>
                    <option value="Mon,Wed,Fri">Mon / Wed / Fri</option>
                </select>
            </Field>
        </>
    );

    if (type === 'event') return (
        <>
            <Field label="Related Person (name)">{inp('related_person', 'e.g. Ram')}</Field>
            <Field label="Message (Nepali encouraged)">{area('message', 'e.g. राम आज काठमाडौंमा अफिसमा छ। बेलुका ५ बजे घर आउने छ।')}</Field>
            <Field label="Valid From">
                <input type="datetime-local" {...INPUT} value={detail['effective_from'] ?? ''} onChange={(e) => onChange('effective_from', e.target.value)} />
            </Field>
            <Field label="Valid Until (leave blank = open-ended)">
                <input type="datetime-local" {...INPUT} value={detail['effective_to'] ?? ''} onChange={(e) => onChange('effective_to', e.target.value)} />
            </Field>
        </>
    );

    if (type === 'object') return (
        <>
            <Field label="Object Name">{inp('object_name', 'e.g. चश्मा')}</Field>
            <Field label="Usual Location">{area('usual_location', 'e.g. बेडसाइड टेबलमा, दराजको माथि')}</Field>
        </>
    );

    if (type === 'reassurance') return (
        <>
            <Field label="Message (Nepali)">{area('message', 'e.g. हजुर, सब ठीकठाक छ। चिन्ता नगर्नुहोस्।')}</Field>
            <Field label="Trigger Keywords (comma-separated)">{inp('trigger_keywords', 'डर,चिन्ता,एक्लो,भ्रम')}</Field>
        </>
    );

    return null;
}

export default function MemoryForm() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const [elders, setElders] = useState<ElderSummary[]>([]);
    const [elderId, setElderId] = useState<number | null>(null);
    const [memType, setMemType] = useState('person');
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [detail, setDetail] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Load elders
    useEffect(() => {
        listElders().then((list) => {
            setElders(list);
            if (list.length > 0 && !elderId) setElderId(list[0].id);
        });
    }, []);

    // Load existing memory for edit
    useEffect(() => {
        if (!isEdit || !id) return;
        const numId = Number(id);
        // We need to find the memory — load all for any elder
        listElders().then(async (list) => {
            for (const el of list) {
                const mems = await listMemories(el.id);
                const found = mems.find((m) => m.id === numId);
                if (found) {
                    setElderId(el.id);
                    setMemType(found.type);
                    setTitle(found.title);
                    setDesc(found.description ?? '');
                    setDetail(found.detail ?? {});
                    break;
                }
            }
        });
    }, [isEdit, id]);

    const setDetailKey = (k: string, v: string) => setDetail((prev) => ({ ...prev, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!elderId || !title.trim()) { setError('Elder and title are required.'); return; }
        setLoading(true); setError('');
        try {
            if (isEdit && id) {
                await updateMemory(Number(id), { title, description: desc, detail });
            } else {
                await createMemory({ elder_id: elderId, type: memType, title, description: desc, detail });
            }
            navigate('/caretaker/memories');
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to save memory.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ marginBottom: '1.75rem' }}>
                <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}
                    onClick={() => navigate('/caretaker/memories')}
                >
                    ← Back to Memories
                </button>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>
                    {isEdit ? '✏️ Edit Memory' : '+ New Memory'}
                </h1>
                <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                    {isEdit ? 'Update the stored information.' : 'Add a new piece of information for this elder.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

                {/* Elder Selector */}
                {!isEdit && (
                    <Field label="Elder">
                        <select {...INPUT as any} value={elderId ?? ''} onChange={(e) => setElderId(Number(e.target.value))}>
                            {elders.map((el) => (
                                <option key={el.id} value={el.id} style={{ background: '#1a1f2c' }}>{el.name}</option>
                            ))}
                        </select>
                    </Field>
                )}

                {/* Type Picker */}
                {!isEdit && (
                    <div>
                        <label style={LABEL.style}>Memory Type</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.5rem' }}>
                            {TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => { setMemType(t.value); setDetail({}); }}
                                    style={{
                                        border: `2px solid ${memType === t.value ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem',
                                        textAlign: 'left', background: memType === t.value ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                                        cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                >
                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t.label}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Title */}
                <Field label="Title / Summary">
                    <input {...INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title for this memory" required />
                </Field>

                {/* Description (optional) */}
                <Field label="Notes (optional)">
                    <textarea {...TEXTAREA} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Any additional caregiver notes…" />
                </Field>

                {/* Dynamic type-specific fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                        <p style={{ ...LABEL.style, marginBottom: '1rem', color: 'var(--primary)', borderBottom: 'none' }}>
                            {TYPES.find((t) => t.value === memType)?.label} Details
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <DetailFields type={memType} detail={detail} onChange={setDetailKey} />
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', color: '#ef4444', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => navigate('/caretaker/memories')}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.65rem 1.75rem', fontWeight: 700 }}>
                        {loading ? 'Saving…' : isEdit ? 'Update Memory' : 'Save Memory'}
                    </button>
                </div>
            </form>
        </div>
    );
}
