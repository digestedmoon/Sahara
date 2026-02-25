import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../auth/authStore';
import apiClient from '../../api/axios';
import { io } from 'socket.io-client';

// ── Global Audio Player ──────────────────────────────────────────────────────
let globalAudio = new Audio();

function playBase64Audio(base64Str: string) {
    console.log(base64Str);
    if (!base64Str) return;
    try {
        globalAudio.pause();
        globalAudio.src = `data:audio/mp3;base64,${base64Str}`;
        globalAudio.play().catch(e => console.error("Audio play error:", e));
    } catch (e) {
        console.error("Audio decoding error:", e);
    }
}

// ── Types ──────────────────────────────────────────────────────────────────
type ReminderCard = { id: number; title: string; body?: string };
type EventCard = { id: number; title: string; message: string; type: string; photo_url?: string };

// ── Card Styles ────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-card)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflow: 'hidden',
    position: 'relative'
};

export default function ElderDashboard() {
    const user = useAuthStore((s) => s.user);
    const elderId = user?.id ? Number(user.id) : null;

    // AI State
    const [answer, setAnswer] = useState('');
    const [transcript, setTranscript] = useState('');
    const [listening, setListening] = useState(false);
    const [thinking, setThinking] = useState(false);

    // Data State
    const [reminders, setReminders] = useState<ReminderCard[]>([]);
    const [events, setEvents] = useState<EventCard[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);

    const recognitionRef = useRef<any>(null);
    const lastSpokenRef = useRef('');

    // ── Load data ──────────────────────────────────────────────────────────────
    const refreshReminders = useCallback(() => {
        if (!elderId) return;
        apiClient.get(`/reminders/${elderId}`, { params: { active: 'true' } })
            .then((r) => setReminders(r.data.reminders ?? []))
            .catch(() => { });
    }, [elderId]);

    useEffect(() => {
        if (!elderId) return;

        // 1. Initial Reminders
        refreshReminders();

        // 2. Contacts
        apiClient.get(`/emergency/contacts/${elderId}`)
            .then((r) => setContacts(r.data.contacts ?? []))
            .catch(() => { });

        // 3. Family Messages
        apiClient.get(`/memory/${elderId}`)
            .then((r) => {
                const mems = r.data.memories ?? [];
                const familyMessages = mems
                    .filter((m: any) => m.type === 'event' || m.type === 'reassurance')
                    .map((m: any) => ({
                        id: m.id,
                        title: m.title,
                        message: m.type === 'event' ? m.detail?.message : m.detail?.message || m.description || "",
                        type: m.type,
                        photo_url: m.detail?.photo_url
                    }));
                setEvents(familyMessages);
            })
            .catch(() => { });

        // Greeting
        setTimeout(() => {
            // Check local synthesis as fallback if ElevenLabs isn't ready on mount
            setTimeout(() => {
                const greeting = 'नमस्ते! म सहारा हुँ। के मद्दत गरौं?';
                setAnswer(greeting);
                // We do not call ElevenLabs on mount to save credits. We just show text.
            }, 800);
        }, 800);
    }, [elderId, refreshReminders]);

    // ── WebSocket Listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (!elderId) return;

        const socket = io('http://localhost:5000', {
            transports: ['websocket'],
            upgrade: false
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            socket.emit('join_room', { elder_id: elderId });
        });

        socket.on('reminder_due', (data: any) => {
            console.log('Reminder Due:', data);
            refreshReminders();

            if (data.voice_text) {
                setAnswer(data.voice_text);
            }
            if (data.audio_content) {
                playBase64Audio(data.audio_content);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [elderId, refreshReminders]);

    // ── Voice Query ───────────────────────────────────────────────────────────
    const submitQuery = useCallback(async (text: string) => {
        if (!text.trim() || !elderId) return;
        setThinking(true);
        try {
            const resp = await apiClient.post('/query', { text, elder_id: elderId });
            const ans = resp.data.answer_nepali ?? 'मलाई जानकारी छैन।';

            if (resp.data.intent === 'emergency') {
                setAnswer('🚨 मद्दत बोलाइँदैछ!');
                await apiClient.post('/emergency', { elder_id: elderId, trigger: 'voice' }).catch(() => { });
                if (resp.data.audio_content) playBase64Audio(resp.data.audio_content);
                return;
            }

            if (ans !== lastSpokenRef.current) {
                lastSpokenRef.current = ans;
                setAnswer(ans);
                if (resp.data.audio_content) {
                    playBase64Audio(resp.data.audio_content);
                }
            }
        } catch {
            const fallback = 'माफ गर्नुहोस्। फेरि प्रयास गर्नुहोस्।';
            setAnswer(fallback);
        } finally {
            setThinking(false);
        }
    }, [elderId]);

    // ── Voice recognition ─────────────────────────────────────────────────────
    const startListening = useCallback(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            alert('Speech recognition not supported. Please use Chrome.');
            return;
        }
        const rec = new SR();
        rec.lang = 'ne-NP';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        recognitionRef.current = rec;

        rec.onresult = (e: any) => {
            const t = e.results[0][0].transcript;
            setTranscript(t);
            setListening(false);
            submitQuery(t);
        };
        rec.onerror = () => setListening(false);
        rec.onend = () => setListening(false);

        rec.start();
        setListening(true);
    }, [submitQuery]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    const handleMicClick = useCallback(() => {
        if (listening) { stopListening(); } else { startListening(); }
    }, [listening, startListening, stopListening]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleEmergency = useCallback(async () => {
        setAnswer('🚨 मद्दत बोलाइँदैछ!');
        if (elderId) {
            await apiClient.post('/emergency', { elder_id: elderId, trigger: 'button' }).catch(() => { });
        }
    }, [elderId]);

    const dismissReminder = async (reminderId: number, action: 'taken' | 'later') => {
        await apiClient.post(`/reminders/${reminderId}/action`, { action }).catch(() => { });
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>

            {/* 1. Sahara AI Assistant Section */}
            <div style={{ ...cardStyle, border: '1px solid var(--primary-light)', background: 'rgba(255, 255, 255, 0.8)', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>✨</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>यस समयमा के मद्दत गरौं?</p>
                </div>

                <div style={{ flex: 1, minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0', background: 'var(--primary-subtle)', borderRadius: 'var(--radius-md)', margin: '1rem 0' }}>
                    {transcript && (
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600, opacity: 0.8 }}>
                             " {transcript} "
                        </p>
                    )}
                    <p style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.4, fontWeight: 700, padding: '0 1rem' }}>
                        {answer || 'म सुन्दैछु...'}
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button
                        onClick={handleMicClick}
                        disabled={thinking}
                        style={{
                            width: 110, height: 110, borderRadius: '50%',
                            background: listening
                                ? 'radial-gradient(circle, #ef4444 0%, #dc2626 100%)'
                                : thinking
                                    ? 'radial-gradient(circle, var(--primary) 0%, var(--primary-light) 100%)'
                                    : '#fff',
                            border: listening ? 'none' : '4px solid var(--primary)', cursor: thinking ? 'wait' : 'pointer',
                            boxShadow: listening
                                ? '0 0 0 12px rgba(239,68,68,0.15), 0 0 50px rgba(239,68,68,0.4)'
                                : '0 10px 30px rgba(255, 150, 68, 0.2)',
                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: listening ? 'pulse 1.5s infinite' : 'none',
                        }}
                    >
                        <span style={{ fontSize: '3rem', filter: thinking || listening ? 'none' : 'grayscale(0.2)' }}>
                            {thinking ? '🤔' : listening ? '🎙️' : '🎤'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 2. Family Messages Card */}
            {events.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(255, 240, 245, 0.6)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#831843', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💌</span> परिवारको सन्देश (Family Messages)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {events.map((e) => (
                            <div key={e.id} style={{ background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(236,72,153,0.1)' }}>
                                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.2rem', paddingBottom: e.photo_url ? '0.5rem' : '0' }}>{e.title}</p>
                                {e.photo_url && (
                                    <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                        <img src={e.photo_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                {e.message && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.5 }}>{e.message}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Reminders Card */}
            {reminders.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(254, 252, 232, 0.6)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⏰</span> सम्झौना (Reminders)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reminders.map((r) => (
                            <div key={r.id} style={{ background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.1)' }}>
                                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{r.title}</p>
                                {r.body && <p style={{ margin: '0.4rem 0 0.8rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.body}</p>}

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => dismissReminder(r.id, 'taken')} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
                                        ✓ लिएँ (Done)
                                    </button>
                                    <button onClick={() => dismissReminder(r.id, 'later')} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                                        पछि (Later)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Emergency Button (Simplified) */}
            <button
                onClick={handleEmergency}
                style={{ 
                    width: '100%', 
                    padding: '1.5rem', 
                    borderRadius: 'var(--radius-lg)', 
                    background: 'transparent', 
                    border: '2px solid var(--danger)', 
                    color: 'var(--danger)', 
                    fontSize: '1.4rem', 
                    fontWeight: 900, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.75rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.05)'
                }}
            >
                <span>🚨</span> SOS मद्दत चाहियो
            </button>

            {/* 5. Contacts Card */}
            {contacts.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(240, 253, 244, 0.6)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📞</span> मेरा सम्पर्क (Contacts)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {contacts.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.5)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.1)' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                                    👤
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{c.name}</p>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{c.relationship} • {c.phone}</p>
                                </div>
                                <a href={`tel:${c.phone}`} style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
                                    Call
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Animations */}
            <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(239,68,68,0.15), 0 0 40px rgba(239,68,68,0.3); }
          50%      { box-shadow: 0 0 0 16px rgba(239,68,68,0.08), 0 0 60px rgba(239,68,68,0.5); }
        }
      `}</style>
        </div>
    );
}
