import { type ReactElement, useState, useEffect } from 'react';
import { useAuthStore } from '../auth/authStore';
import apiClient from '../../api/axios';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  // Selection & Tabs
  const [selectedElderId, setSelectedElderId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'knowledge' | 'profile'>('monitoring');

  // Real backend logs
  const [events, setEvents] = useState<any[]>([]);
  const [memory, setMemory] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ elder_id: '', type: 'MED', title: '', body: '' });
  const [submittingCard, setSubmittingCard] = useState(false);

  // Knowledge Form State
  const [kForm, setKForm] = useState({ title: '', content: '', type: 'GENERAL' });
  const [submittingK, setSubmittingK] = useState(false);

  // Intake Form State (Comprehensive)
  const [intakeForm, setIntakeForm] = useState({
    profile: { full_name: '', description: '', medical_summary: '' },
    contacts: [{ name: '', relationship: '', phone: '', priority: 1, notes: '' }],
    medications: [{ name: '', time: '', note: '' }],
    schedule: [{ time: '', event: '', icon: '📅', color: 'var(--primary)' }]
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    // Initial fetch for main dashboard data
    apiClient.get('/caregiver/dashboard')
      .then(res => {
        setData(res.data);
        if (res.data.elders && res.data.elders.length > 0) {
          const firstId = res.data.elders[0].id;
          setSelectedElderId(firstId);
          setCardForm(prev => ({ ...prev, elder_id: String(firstId) }));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setData({ stats: [], elders: [], activity: [] });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedElderId) return;

    const fetchEvents = async () => {
      try {
        const res = await apiClient.get(`/caregiver/events/${selectedElderId}?limit=30`);
        setEvents(res.data.events || []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchEvents();

    // Socket.IO for real-time alerts
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('new_event', (event) => {
      console.log('New event received:', event);
      // Only add if it belongs to the selected elder
      if (event.elder_id === selectedElderId) {
        setEvents(prev => [event, ...prev.slice(0, 29)]);
      }

      // Optionally refresh stats if it's a critical event
      if (event.event_type === 'HELP_REQUESTED') {
        apiClient.get('/caregiver/dashboard').then(res => setData(res.data)).catch(() => { });
      }
    });

    // Memory still needs occasional polling as it's not event-driven yet
    const pollInterval = setInterval(() => {
      apiClient.get('/memory').then(res => setMemory(res.data.memory)).catch(() => { });
    }, 10000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [selectedElderId]);


  const submitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.elder_id || !cardForm.title || !cardForm.body) return;

    setSubmittingCard(true);
    try {
      await apiClient.post('/caregiver/cards', {
        elder_id: parseInt(cardForm.elder_id),
        type: cardForm.type,
        title_nepali: cardForm.title,
        body_nepali: cardForm.body
      });
      setIsModalOpen(false);
      setCardForm({ ...cardForm, title: '', body: '' }); // reset
    } catch (err) {
      console.error("Failed to create card", err);
    } finally {
      setSubmittingCard(false);
    }
  };

  const fetchKnowledge = async () => {
    // ... logic if needed
  };

  const fetchElderFullProfile = async (id: number) => {
    setLoadingProfile(true);
    try {
      const res = await apiClient.get(`/caregiver/elder/${id}/full`);
      const { profile, contacts, medications, schedule } = res.data;
      setIntakeForm({
        profile: {
          full_name: profile.full_name || '',
          description: profile.description || '',
          medical_summary: profile.medical_summary || ''
        },
        contacts: contacts.length > 0 ? contacts : [{ name: '', relationship: '', phone: '', priority: 1, notes: '' }],
        medications: medications.length > 0 ? medications : [{ name: '', time: '', note: '' }],
        schedule: schedule.length > 0 ? schedule : [{ time: '', event: '', icon: '📅', color: 'var(--primary)' }]
      });
    } catch (err) {
      console.error("Failed to fetch full profile", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && selectedElderId) {
      fetchElderFullProfile(selectedElderId);
    }
  }, [activeTab, selectedElderId]);

  const submitKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElderId || !kForm.title || !kForm.content) return;
    setSubmittingK(true);
    try {
      await apiClient.post('/caregiver/knowledge', {
        elder_id: selectedElderId,
        title: kForm.title,
        content_nepali: kForm.content,
        doc_type: kForm.type
      });
      setKForm({ title: '', content: '', type: 'GENERAL' });
      alert("Knowledge added to AI memory!");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingK(false);
    }
  };

  const submitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElderId) return;
    setSubmittingIntake(true);
    try {
      await apiClient.post('/caregiver/intake', {
        elder_id: selectedElderId,
        ...intakeForm
      });
      alert("Elder profile and AI knowledge updated successfully!");
    } catch (err) {
      console.error("Intake failed", err);
      alert("Failed to update profile.");
    } finally {
      setSubmittingIntake(false);
    }
  };

  const addRow = (key: 'contacts' | 'medications' | 'schedule') => {
    setIntakeForm(prev => {
      const newItems = [...prev[key]];
      if (key === 'contacts') newItems.push({ name: '', relationship: '', phone: '', priority: 1, notes: '' });
      if (key === 'medications') newItems.push({ name: '', time: '', note: '' });
      if (key === 'schedule') newItems.push({ time: '', event: '', icon: '📅', color: 'var(--primary)' });
      return { ...prev, [key]: newItems };
    });
  };

  const removeRow = (key: 'contacts' | 'medications' | 'schedule', index: number) => {
    setIntakeForm(prev => {
      const newItems = prev[key].filter((_, i) => i !== index);
      // Ensure at least one row remains
      if (newItems.length === 0) {
        if (key === 'contacts') newItems.push({ name: '', relationship: '', phone: '', priority: 1, notes: '' });
        if (key === 'medications') newItems.push({ name: '', time: '', note: '' });
        if (key === 'schedule') newItems.push({ time: '', event: '', icon: '📅', color: 'var(--primary)' });
      }
      return { ...prev, [key]: newItems };
    });
  };

  if (loading || !data) {
    return (
      <div className="page-header fade-up" style={{ justifyContent: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="pulse" style={{ color: 'var(--primary)' }}>Loading Network...</h2>
        </div>
      </div>
    );
  }

  const { stats: STATS, elders: ELDERS } = data;

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
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ New Reminder</button>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="glass" style={{ display: 'inline-flex', padding: '0.4rem', gap: '0.5rem', marginBottom: '2rem' }}>
        <button
          className={`btn ${activeTab === 'monitoring' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('monitoring')}
          style={{ fontSize: '0.8rem', padding: '0.5rem 1.2rem' }}
        >
          📊 Monitoring
        </button>
        <button
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('profile')}
          style={{ fontSize: '0.8rem', padding: '0.5rem 1.2rem' }}
        >
          👴 Manage Elder
        </button>
        <button
          className={`btn ${activeTab === 'knowledge' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('knowledge')}
          style={{ fontSize: '0.8rem', padding: '0.5rem 1.2rem' }}
        >
          🧠 AI Knowledge Base
        </button>
      </div>

      {activeTab === 'monitoring' && (
        <>
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
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select an elder to view live logs</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {ELDERS.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedElderId(e.id)}
                          style={{ cursor: 'pointer', background: selectedElderId === e.id ? 'var(--primary-subtle)' : 'transparent' }}
                        >
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{e.name}</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Room {e.room}</div>
                          </td>
                          <td><span className={`badge ${STATUS_BADGE[e.status] ?? 'badge-indigo'}`}>● {e.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div className="progress-fill" style={{
                                  width: `${e.score}%`,
                                  background: e.score >= 85 ? 'var(--success)' : 'var(--warning)'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{e.score}</span>
                            </div>
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
                  <span className="section-title">🚨 {ELDERS.find(e => e.id === selectedElderId)?.name}'s Alerts</span>
                </div>

                {events.filter(e => ['HELP_REQUESTED', 'MED_TAKEN'].includes(e.event_type)).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent alerts for this elder.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                    {events.filter(e => ['HELP_REQUESTED', 'MED_TAKEN'].includes(e.event_type)).map((evt) => {
                      const isAlert = evt.event_type === 'HELP_REQUESTED' || evt.event_type === 'RAG_UNCERTAIN';
                      const isSuccess = evt.event_type === 'CARD_ACK' || evt.event_type === 'MED_TAKEN';
                      const color = isAlert ? 'var(--danger)' : isSuccess ? 'var(--success)' : 'var(--primary)';
                      const bg = isAlert ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)';

                      return (
                        <div key={evt.id} className="activity-item" style={{ background: bg, padding: '0.8rem', borderRadius: 'var(--radius-sm)' }}>
                          <div className="activity-dot" style={{ background: color }} />
                          <div style={{ flex: 1 }}>
                            <div className="activity-text" style={{ color: isAlert ? color : 'var(--text-primary)', fontWeight: isAlert ? 'bold' : 'normal' }}>
                              [{evt.event_type}] {
                                (() => {
                                  let p = evt.payload;
                                  for (let i = 0; i < 3; i++) {
                                    if (typeof p === 'string' && (p.trim().startsWith('{') || p.trim().startsWith('['))) {
                                      try { p = JSON.parse(p); } catch { break; }
                                    } else break;
                                  }
                                  if (p && typeof p === 'object') return p.text || p.message || JSON.stringify(p);
                                  return String(p);
                                })()
                              }
                            </div>
                            <div className="activity-time">{new Date(evt.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* AI Tracked Items Memory */}
              <div>
                <div className="section-header">
                  <span className="section-title">🔍 AI Object Tracking</span>
                </div>
                {Object.keys(memory).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No items currently tracked.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {Object.values(memory).map((item: any) => (
                      <div key={item.label} style={{ background: 'var(--bg-input)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{item.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Location: {item.location_phrase}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'profile' && (
        <div className="glass fade-up" style={{ padding: '2.5rem', maxWidth: '1000px' }}>
          <div className="section-header">
            <h2 className="section-title">👴 Manage Elder Profile</h2>
            <p style={{ color: 'var(--text-muted)' }}>Fill the forms below to update the elder's device and AI memory.</p>
          </div>

          {loadingProfile ? (
            <div className="pulse" style={{ padding: '2rem', textAlign: 'center', color: 'var(--primary)' }}>Fetching latest profile...</div>
          ) : (
            <form onSubmit={submitIntake} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

              {/* SECTION: BASIC PROFILE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>1. Basic Information</h3>
                <div className="grid-2" style={{ gap: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={intakeForm.profile.full_name} onChange={e => setIntakeForm({ ...intakeForm, profile: { ...intakeForm.profile, full_name: e.target.value } })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Language</label>
                    <input className="form-input" value="Nepali (Native)" disabled />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Medical Summary (Notes for AI)</label>
                  <textarea className="form-input" rows={3} placeholder="e.g. Type 2 Diabetes, High BP, needs gentle reminders." value={intakeForm.profile.medical_summary} onChange={e => setIntakeForm({ ...intakeForm, profile: { ...intakeForm.profile, medical_summary: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Personal Background / Description</label>
                  <textarea className="form-input" rows={2} placeholder="e.g. Former teacher, likes gardening, morning walks." value={intakeForm.profile.description} onChange={e => setIntakeForm({ ...intakeForm, profile: { ...intakeForm.profile, description: e.target.value } })} />
                </div>
              </div>

              {/* SECTION: EMERGENCY CONTACTS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>2. Emergency Contacts</h3>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => addRow('contacts')}>+ Add Contact</button>
                </div>
                {intakeForm.contacts.map((c, i) => (
                  <div key={i} className="glass" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '1rem', alignItems: 'end', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Name</label>
                      <input className="form-input" value={c.name} onChange={e => { const nc = [...intakeForm.contacts]; nc[i].name = e.target.value; setIntakeForm({ ...intakeForm, contacts: nc }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Relation</label>
                      <input className="form-input" value={c.relationship} onChange={e => { const nc = [...intakeForm.contacts]; nc[i].relationship = e.target.value; setIntakeForm({ ...intakeForm, contacts: nc }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Phone</label>
                      <input className="form-input" value={c.phone} onChange={e => { const nc = [...intakeForm.contacts]; nc[i].phone = e.target.value; setIntakeForm({ ...intakeForm, contacts: nc }) }} required />
                    </div>
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', padding: 0 }} onClick={() => removeRow('contacts', i)}>✕</button>
                  </div>
                ))}
              </div>

              {/* SECTION: MEDICATIONS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>3. Medication Schedule</h3>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => addRow('medications')}>+ Add Medication</button>
                </div>
                {intakeForm.medications.map((m, i) => (
                  <div key={i} className="glass" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 40px', gap: '1rem', alignItems: 'end', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Medicine Name</label>
                      <input className="form-input" value={m.name} onChange={e => { const nm = [...intakeForm.medications]; nm[i].name = e.target.value; setIntakeForm({ ...intakeForm, medications: nm }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Time</label>
                      <input className="form-input" type="time" value={m.time} onChange={e => { const nm = [...intakeForm.medications]; nm[i].time = e.target.value; setIntakeForm({ ...intakeForm, medications: nm }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Instruction (Optional)</label>
                      <input className="form-input" placeholder="e.g. After lunch" value={m.note} onChange={e => { const nm = [...intakeForm.medications]; nm[i].note = e.target.value; setIntakeForm({ ...intakeForm, medications: nm }) }} />
                    </div>
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', padding: 0 }} onClick={() => removeRow('medications', i)}>✕</button>
                  </div>
                ))}
              </div>

              {/* SECTION: DAILY ROUTINE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>4. Daily Routine</h3>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => addRow('schedule')}>+ Add Event</button>
                </div>
                {intakeForm.schedule.map((s, i) => (
                  <div key={i} className="glass" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 3fr 1fr 40px', gap: '1rem', alignItems: 'end', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Time</label>
                      <input className="form-input" type="time" value={s.time} onChange={e => { const ns = [...intakeForm.schedule]; ns[i].time = e.target.value; setIntakeForm({ ...intakeForm, schedule: ns }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Event / Activity</label>
                      <input className="form-input" placeholder="e.g. Morning Walk" value={s.event} onChange={e => { const ns = [...intakeForm.schedule]; ns[i].event = e.target.value; setIntakeForm({ ...intakeForm, schedule: ns }) }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Icon</label>
                      <input className="form-input" value={s.icon} onChange={e => { const ns = [...intakeForm.schedule]; ns[i].icon = e.target.value; setIntakeForm({ ...intakeForm, schedule: ns }) }} />
                    </div>
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', padding: 0 }} onClick={() => removeRow('schedule', i)}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submittingIntake} style={{ padding: '1rem 3rem' }}>
                  {submittingIntake ? 'Syncing Profile...' : 'Save & Sync Everything'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => fetchElderFullProfile(selectedElderId!)}>Reset Changes</button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="glass fade-up" style={{ padding: '2rem', maxWidth: '800px' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>🧠 Training AI Memory</h2>
          <p style={{ marginBottom: '2rem' }}>Upload facts, medical notes, or preferences to help the AI answer the elder's questions accurately.</p>

          <form onSubmit={submitKnowledge} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Select Elder</label>
              <select
                className="form-input"
                value={selectedElderId || ''}
                onChange={e => setSelectedElderId(Number(e.target.value))}
              >
                {ELDERS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Document Title</label>
              <input
                className="form-input"
                placeholder="e.g. Aama's Tea Preference"
                value={kForm.title}
                onChange={e => setKForm({ ...kForm, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={kForm.type}
                onChange={e => setKForm({ ...kForm, type: e.target.value })}
              >
                <option value="GENERAL">General/Personal</option>
                <option value="MED_PURPOSE">Medicine/Health</option>
                <option value="SCHEDULE">Routine</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Note Content (Nepali Preferred)</label>
              <textarea
                className="form-input"
                rows={5}
                placeholder="e.g. आमालाई दिउँसो ४ बजे चिया मनपर्छ। (Aama likes tea at 4pm)"
                value={kForm.content}
                onChange={e => setKForm({ ...kForm, content: e.target.value })}
                required
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Note: Writing in Nepali helps the AI answer the elder in their native language.</p>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submittingK} style={{ width: 'fit-content' }}>
              {submittingK ? 'Syncing...' : 'Add to AI Memory'}
            </button>
          </form>
        </div>
      )}

      {/* Create Card Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Create Elder Reminder Card</h2>

            <form onSubmit={submitCard} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Select Elder</label>
                <select
                  className="form-input"
                  value={cardForm.elder_id}
                  onChange={e => setCardForm({ ...cardForm, elder_id: e.target.value })}
                  required
                >
                  {ELDERS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={cardForm.type}
                  onChange={e => setCardForm({ ...cardForm, type: e.target.value })}
                >
                  <option value="MED">Medication</option>
                  <option value="ROUTINE">Routine Note</option>
                  <option value="HELP">Help Check</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Title (Auto-read to elder)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. दबाई खाने समय"
                  value={cardForm.title}
                  onChange={e => setCardForm({ ...cardForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Body Text Message</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Please take 1 Paracetamol pill"
                  rows={3}
                  value={cardForm.body}
                  onChange={e => setCardForm({ ...cardForm, body: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submittingCard} className="btn btn-primary" style={{ flex: 2 }}>
                  {submittingCard ? 'Creating...' : 'Send to Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
