import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../auth/authStore';
import apiClient from '../../api/axios';
import { io } from 'socket.io-client';

// ── Global Audio Player ──────────────────────────────────────────────────────
let globalAudio = new Audio();

function playBase64Audio(base64Str: string) {
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
    background: 'rgba(30, 35, 50, 0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '1.5rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
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
            const transcript = e.results[0][0].transcript;
            setListening(false);
            submitQuery(transcript);
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

            {/* 1. Sahara AI Conversation Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(20,25,45,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>✨</div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 800 }}>सहारा (Sahara)</h2>
                        <p style={{ margin: 0, color: '#a5b4fc', fontSize: '0.9rem' }}>तपाईंको डिजिटल साथी</p>
                    </div>
                </div>

                <div style={{ flex: 1, minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
                    <p style={{ margin: 0, fontSize: '1.25rem', color: '#fff', textAlign: 'center', lineHeight: 1.5, fontWeight: 500 }}>
                        {answer || 'म सुन्दैछु...'}
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button
                        onClick={handleMicClick}
                        disabled={thinking}
                        style={{
                            width: 100, height: 100, borderRadius: '50%',
                            background: listening
                                ? 'radial-gradient(circle, #ef4444 0%, #dc2626 100%)'
                                : thinking
                                    ? 'radial-gradient(circle, #6366f1 0%, #4f46e5 100%)'
                                    : 'radial-gradient(circle, #4f46e5 0%, #6366f1 80%, #818cf8 100%)',
                            border: 'none', cursor: thinking ? 'wait' : 'pointer',
                            boxShadow: listening
                                ? '0 0 0 10px rgba(239,68,68,0.15), 0 0 40px rgba(239,68,68,0.4)'
                                : '0 0 0 8px rgba(99,102,241,0.15), 0 0 30px rgba(99,102,241,0.3)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: listening ? 'pulse 1.5s infinite' : 'none',
                        }}
                    >
                        <span style={{ fontSize: '2.5rem' }}>
                            {thinking ? '🤔' : listening ? '🔴' : '🎤'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 2. Family Messages Card */}
            {events.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(35,20,35,0.7)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fbcfe8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💌</span> परिवारको सन्देश (Family Messages)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {events.map((e) => (
                            <div key={e.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '16px' }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.2rem', paddingBottom: e.photo_url ? '0.5rem' : '0' }}>{e.title}</p>
                                {e.photo_url && (
                                    <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                        <img src={e.photo_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                {e.message && <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', lineHeight: 1.5 }}>{e.message}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Reminders Card */}
            {reminders.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(40,30,15,0.7)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fde68a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⏰</span> सम्झौना (Reminders)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reminders.map((r) => (
                            <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '16px' }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>{r.title}</p>
                                {r.body && <p style={{ margin: '0.4rem 0 0.8rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>{r.body}</p>}

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => dismissReminder(r.id, 'taken')} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
                                        ✓ लिएँ (Done)
                                    </button>
                                    <button onClick={() => dismissReminder(r.id, 'later')} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                                        पछि (Later)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Emergency Card */}
            <div style={{ ...cardStyle, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(45,15,15,0.7)', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <button
                    onClick={handleEmergency}
                    style={{ width: '100%', padding: '1.25rem', borderRadius: '16px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'none', color: '#fff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                >
                    <span>🚨</span> मद्दत चाहियो (Help / SOS)
                </button>
            </div>

            {/* 5. Contacts Card */}
            {contacts.length > 0 && (
                <div style={{ ...cardStyle, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(15,35,20,0.7)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📞</span> मेरा सम्पर्क (Contacts)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {contacts.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.8rem 1rem', borderRadius: '16px' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                                    👤
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{c.name}</p>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{c.relationship} • {c.phone}</p>
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
