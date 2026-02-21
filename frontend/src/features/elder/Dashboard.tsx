import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import apiClient from "../../api/axios";

/**
 * SaharaAI — Elder Dashboard (React)
 * - Low-vision + dyslexia-friendly: big targets, high contrast, simple language
 * - Voice-first: built-in Web Speech TTS (can be replaced by your backend TTS)
 * - API-ready: /api/where?item=..., /api/elder/feed, /api/rag/query, /api/elder/guidance
 */

function speak(text: string) {
    try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92;
        u.pitch = 1.0;
        u.volume = 1.0;

        // Try Nepali voice if available
        const voices = window.speechSynthesis.getVoices?.() || [];
        const nepali = voices.find((v) => (v.lang || "").toLowerCase().startsWith("ne"));
        if (nepali) u.voice = nepali;

        window.speechSynthesis.speak(u);
    } catch { }
}

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(t);
    }, []);
    return now;
}

function regionFromPhrase(phrase?: string) {
    return phrase?.replace("-", " ") || "somewhere nearby";
}

function classNames(...xs: (string | boolean | undefined | null)[]) {
    return xs.filter(Boolean).join(" ");
}

interface BigCardButtonProps {
    color: "primary" | "danger" | "neutral";
    icon: string;
    label: string;
    hint: string;
    footer: string;
    onClick: () => void;
}

function BigCardButton({ color, icon, label, hint, footer, onClick }: BigCardButtonProps) {
    const styleClass = useMemo(() => {
        switch (color) {
            case "danger":
                return "border-rose-500/30 bg-rose-500/10 hover:border-rose-500/60 shadow-rose-500/5";
            case "primary":
                return "border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-500/60 shadow-indigo-500/5";
            default:
                return "border-white/10 bg-white/5 hover:border-white/30 shadow-white/5";
        }
    }, [color]);

    const iconColor = color === "danger" ? "text-rose-400" : color === "primary" ? "text-indigo-400" : "text-white/80";

    return (
        <button
            onClick={onClick}
            className={classNames(
                "relative w-full min-h-[200px] rounded-[40px] p-8 text-left border backdrop-blur-2xl transition-all duration-300",
                styleClass,
                "hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-[0.96] focus:outline-none focus:ring-4 focus:ring-white/10 group"
            )}
            aria-label={label}
        >
            <div className="flex flex-col h-full justify-between gap-6 z-10 relative">
                <div>
                    <div className={classNames("text-5xl mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", iconColor)} aria-hidden="true">
                        {icon}
                    </div>
                    <div className="text-[2.5rem] font-black tracking-tight text-white mb-2 leading-tight">{label}</div>
                    <div className="text-xl font-medium text-white/50 leading-tight group-hover:text-white/70 transition-colors">{hint}</div>
                </div>
                <div className="text-sm font-black uppercaseW tracking-[0.25em] text-white/30 group-hover:text-indigo-400/50 transition-colors">{footer}</div>
            </div>

            {/* Premium Radial Glow */}
            <div className={classNames(
                "absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none",
                color === "danger" ? "bg-rose-500" : color === "primary" ? "bg-indigo-500" : "bg-white"
            )} />
        </button>
    );
}

interface ToastProps {
    open: boolean;
    icon: string;
    message: string;
    onClose: () => void;
}

function Toast({ open, icon, message, onClose }: ToastProps) {
    if (!open) return null;
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-2xl">
            <div className="flex items-center gap-4 rounded-2xl border border-white/20 bg-black/80 p-4 shadow-2xl backdrop-blur-lg">
                <div className="text-2xl" aria-hidden="true">
                    {icon}
                </div>
                <div className="flex-1 text-lg font-bold text-white">{message}</div>
                <button
                    onClick={onClose}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-black text-white hover:bg-white/20 transition"
                    aria-label="OK"
                >
                    OK
                </button>
            </div>
        </div>
    );
}

function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

export default function ElderDashboard() {
    const now = useClock();

    const [toast, setToast] = useState({ open: false, icon: "💬", message: "" });

    // ✅ Guidance dynamic (starts as loading)
    const [coachText, setCoachText] = useState("मार्गदर्शन लोड हुँदैछ... (Loading guidance...)");
    const lastSpokenGuidanceRef = useRef<string>("");

    const [status, setStatus] = useState({ safeReady: true, lastCheck: "Just now" });

    // Feed
    const [cards, setCards] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>(null);

    // elderId used for /rag/query
    const [elderId, setElderId] = useState<number | null>(null);

    // Chat
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [isChatting, setIsChatting] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Modals
    const [isHealthOpen, setIsHealthOpen] = useState(false);
    const [isContactsOpen, setIsContactsOpen] = useState(false);

    // Find my things
    const [findItem, setFindItem] = useState("sunglasses");
    const [findResult, setFindResult] = useState<any>(null);

    // Camera
    const [isDetecting, setIsDetecting] = useState(false);
    const webcamRef = useRef<Webcam>(null);

    const firstRunRef = useRef(true);
    const recognitionRef = useRef<any>(null);

    function showToast(message: string, icon = "💬", speakIt = true) {
        setToast({ open: true, icon, message });
        if (speakIt) speak(message);
    }
    function closeToast() {
        setToast((t) => ({ ...t, open: false }));
    }

    // ✅ Guidance fetch (requires backend route /api/elder/guidance)
    const fetchGuidance = useCallback(
        async (opts?: { speakIfNew?: boolean }) => {
            // Avoid calling too early (often causes 401 before token is set)
            if (!elderId) return;

            try {
                const resp = await apiClient.get("/elder/guidance");
                const text = (resp.data?.guidance_nepali || "").trim();

                if (text) {
                    setCoachText(text);

                    // Optional: speak only if it changed
                    if (opts?.speakIfNew && text !== lastSpokenGuidanceRef.current) {
                        lastSpokenGuidanceRef.current = text;
                        speak(text);
                    }
                    return;
                }

                // If API returns empty guidance
                setCoachText("हजुर, केही चाहियो भने ‘Talk to Me’ थिच्नुहोस्।");
            } catch (error: any) {
                console.error("Guidance error:", error?.response?.data || error);

                // Show fallback so user sees something
                setCoachText("हजुर, केही चाहियो भने ‘Talk to Me’ थिच्नुहोस्।");
            }
        },
        [elderId]
    );

    const fetchFeed = useCallback(async () => {
        try {
            const resp = await apiClient.get("/elder/feed");
            setCards(resp.data.active_cards || []);
            if (resp.data?.elder_id) setElderId(Number(resp.data.elder_id));
        } catch (error: any) {
            console.error("Feed error:", error?.response?.data || error);
        }
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            const resp = await apiClient.get("/elder/dashboard");
            setDashboardData(resp.data);

            // recommended: backend returns elder_id
            if (resp.data?.elder_id) setElderId(Number(resp.data.elder_id));
            else if (resp.data?.id) setElderId(Number(resp.data.id));
        } catch (error: any) {
            console.error("Dashboard error:", error?.response?.data || error);
        }
    }, []);

    const captureAndDetect = useCallback(async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        try {
            const blob = dataURLtoBlob(imageSrc);
            const formData = new FormData();
            formData.append("image", blob, "frame.jpg");

            const response = await apiClient.post("/detect", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const announcements = response.data.announcements || [];
            if (announcements.length > 0) {
                announcements.forEach((text: string) => showToast(text, "🚨", true));
            }
        } catch (error: any) {
            console.error("Detection error:", error?.response?.data || error);
        }
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isDetecting) {
            interval = window.setInterval(() => captureAndDetect(), 6000);
        }
        return () => {
            if (interval) window.clearInterval(interval);
        };
    }, [isDetecting, captureAndDetect]);

    async function checkHealth() {
        try {
            await apiClient.get(`/health`);
            setStatus((s) => ({ ...s, safeReady: true }));
        } catch {
            setStatus((s) => ({ ...s, safeReady: false }));
        }
    }

    const startListening = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("Voice input is not supported on this browser.", "⚠️", true);
            return;
        }

        try {
            window.speechSynthesis?.cancel?.();
        } catch { }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.lang = "ne-NP";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = (e: any) => {
            console.error("STT error:", e);
            setIsListening(false);
            showToast("Mic error. Please try again.", "⚠️", true);
        };
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
            setChatInput(transcript.trim());
        };

        recognition.start();
    }, []);

    const stopListening = useCallback(() => {
        try {
            recognitionRef.current?.stop();
        } catch { }
    }, []);

    async function submitRagQuery(e?: React.FormEvent) {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        if (!elderId) {
            showToast("Profile is still loading. Please try again.", "⚠️", true);
            return;
        }

        setIsChatting(true);
        try {
            const r = await apiClient.post(`/rag/query`, { text: chatInput, elder_id: elderId });
            const data = r.data;

            showToast(data.answer_nepali || "ठीक छ।", "🤖", true);
            setChatInput("");
            setIsChatOpen(false);

            if (data.auto_card?.created) fetchFeed();

            // Guidance could change after conversation too
            fetchGuidance();
        } catch (error: any) {
            console.error("RAG query error:", error?.response?.data || error);
            showToast("Sorry, I could not understand right now.", "⚠️", true);
        } finally {
            setIsChatting(false);
        }
    }

    async function cardAction(cardId: number, actionPath: string) {
        // optimistic remove
        setCards((prev) => prev.filter((c) => c.id !== cardId));

        try {
            await apiClient.post(`/elder/cards/${cardId}/${actionPath}`);
            fetchFeed();
            fetchGuidance({ speakIfNew: true });
            showToast("Done.", "✅", true);
        } catch (err: any) {
            console.error("Card action error:", err?.response?.data || err);
            fetchFeed(); // restore
            showToast("Action failed. Try again.", "⚠️", true);
        }
    }

    async function whereIsItem(item: string) {
        try {
            const r = await apiClient.get(`/where?item=${encodeURIComponent(item)}`);
            const data = r.data;
            setFindResult(data);

            if (data?.found) {
                const msg = data.announcement || `Your ${item} is in the ${regionFromPhrase(data.location_phrase)} area.`;
                showToast(msg, "🧿", true);
            } else {
                showToast(`I haven’t seen ${item} yet. Please try again after a camera check.`, "🧿", true);
            }
        } catch {
            showToast("I couldn’t reach the camera service. Please ask your caretaker for help.", "⚠️", true);
        }
    }

    useEffect(() => {
        try {
            window.speechSynthesis?.getVoices?.();
        } catch { }

        fetchFeed();
        fetchDashboardData();
        checkHealth();

        const t = setInterval(() => {
            fetchFeed();
            fetchDashboardData();
            checkHealth();
        }, 15000);

        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ fetch guidance only after elderId becomes available
    useEffect(() => {
        if (!elderId) return;
        fetchGuidance();

        // Guidance can update slower than feed; 60 seconds is enough
        const g = setInterval(() => fetchGuidance(), 60000);
        return () => clearInterval(g);
    }, [elderId, fetchGuidance]);

    useEffect(() => {
        if (!firstRunRef.current) return;
        firstRunRef.current = false;
        setTimeout(() => {
            showToast(
                "नमस्ते आमा! म सहारा एआई हुँ। (Hello Aama, I am SaharaAI). Press the big blue button to talk to me.",
                "💙",
                true
            );
        }, 700);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    return (
        <div className="flex flex-col gap-10 p-2 md:p-6 lg:p-8">
            {/* COMPACT HUB HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 p-8 rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white flex items-center gap-3">
                        SaharaAI <span className="text-indigo-400">Hub</span>
                    </h1>
                    <p className="text-white/60 font-medium text-lg md:text-xl">
                        नमस्ते आमा! — Your safety & memory companion.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-base font-bold text-white/90">
                        <span
                            className={classNames(
                                "h-3 w-3 rounded-full shadow-[0_0_12px]",
                                status.safeReady ? "bg-emerald-400 shadow-emerald-400/50" : "bg-rose-400 shadow-rose-400/50"
                            )}
                            aria-hidden="true"
                        />
                        {status.safeReady ? "Safe & Ready" : "System Offline"}
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg md:text-xl font-bold text-white/90">
                        <span className="text-2xl">🗓️</span>
                        <span>{hh}:{mm}</span>
                    </div>
                </div>
            </header>

            {/* MAIN GRID */}
            <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <BigCardButton
                    color="primary"
                    icon="🗣️"
                    label="Talk to Me"
                    hint="मसंग कुरा गर्नुहोस्। (Ask me anything)."
                    footer="AI Voice Assistant"
                    onClick={() => setIsChatOpen(true)}
                />

                {/* DYNAMIC CARDS (MEDS/HELP) */}
                {cards.map((c) => (
                    <div
                        key={c.id}
                        className="relative w-full rounded-[32px] p-10 border border-amber-400/20 bg-amber-400/5 backdrop-blur-xl shadow-2xl flex flex-col justify-between group transition hover:border-amber-400/40"
                    >
                        <div>
                            <div className="text-2xl mb-6 flex items-center gap-4" aria-hidden="true">
                                {c.type === "HELP" ? <span className="text-rose-400 anim-pulse">🚨</span> : <span className="text-emerald-400">💊</span>}
                                <span className="text-sm font-black uppercase tracking-[0.2em] text-white/30">{c.type}</span>
                            </div>
                            <div className="text-xl font-black tracking-tight text-white mb-2">{c.title_nepali}</div>
                            <p className="text-base font-medium text-white/70 leading-relaxed whitespace-pre-wrap">{c.body_nepali}</p>
                        </div>

                        <div className="mt-10 flex items-stretch gap-4">
                            <button
                                onClick={() => cardAction(c.id, c.type === "HELP" ? "ack" : "taken")}
                                className="flex-[2] rounded-2xl bg-white text-black font-black py-2 px-2 text-base hover:bg-white/90 active:scale-[0.98] transition shadow-xl"
                            >
                                {c.type === "HELP" ? "ठीक छ (OK)" : "खाएँ (Taken)"}
                            </button>
                            <button
                                onClick={() => cardAction(c.id, "help")}
                                className="flex-1 rounded-2xl bg-white/10 text-white font-black py-2 text-base hover:bg-white/20 active:scale-[0.98] transition border border-white/20 flex items-center justify-center gap-3 px-2"
                            >
                                <span >❓</span>
                                <span>Help</span>
                            </button>
                        </div>
                    </div>
                ))}

                <BigCardButton
                    color="neutral"
                    icon="🫀"
                    label="My Health"
                    hint="स्वास्थ्य र दबाई चेक गर्नुहोस्। (Check vitals & meds)."
                    footer="Vitals & Pharmacy"
                    onClick={() => setIsHealthOpen(true)}
                />

                <BigCardButton
                    color="neutral"
                    icon="👥"
                    label="Contacts"
                    hint="परिवारलाई फोन गर्नुहोस्। (Call family)."
                    footer="Emergency Contacts"
                    onClick={() => setIsContactsOpen(true)}
                />

                <BigCardButton
                    color="neutral"
                    icon="📍"
                    label="Find Things"
                    hint="“मेरो चस्मा कहाँ छ?” (Where is my...)"
                    footer="AI Visual Memory"
                    onClick={() => whereIsItem(findItem)}
                />

                <BigCardButton
                    color="danger"
                    icon="🆘"
                    label="Emergency"
                    hint="मलाई मद्दत चाहियो! (I need help now!)"
                    footer="Alert All Caretakers"
                    onClick={() => setIsContactsOpen(true)}
                />
            </main>

            {/* GENTLE GUIDANCE SECTION */}
            <section className="p-10 rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="h-3 w-3 rounded-full bg-indigo-400 animate-pulse" />
                            <h2 className="text-base font-black uppercase tracking-[0.3em] text-indigo-400">Proactive Guidance</h2>
                        </div>
                        <p className="text-3xl md:text-4xl lg:text-2xl font-bold leading-[1.3] text-white">
                            {coachText}
                        </p>
                    </div>

                    <div className="flex gap-4 w-full lg:w-auto">
                        <button
                            onClick={() => {
                                speak(coachText);
                                showToast("पढेर सुनाउँदै...", "🔊", false);
                            }}
                            className="flex-1 lg:flex-none rounded-2xl bg-white/10 px-8 py-5 font-black text-xl hover:bg-white/20 transition border border-white/10"
                        >
                            🔊 Speak
                        </button>
                        <button
                            onClick={() => fetchGuidance({ speakIfNew: true })}
                            className="flex-1 lg:flex-none rounded-2xl bg-white text-black px-8 py-5 font-black text-xl hover:bg-white/90 transition shadow-xl"
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </section>

            {/* HEALTH MODAL */}
            {isHealthOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0f1a]/90 backdrop-blur-xl p-4">
                    <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/5 p-8 lg:p-12 shadow-2xl relative">
                        <button onClick={() => setIsHealthOpen(false)} className="absolute top-8 right-8 text-white/40 hover:text-white transition text-3xl">✖</button>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <span className="text-emerald-400"> मेरो स्वास्थ्य</span> (My Health)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            {dashboardData?.vitals?.map((v: any) => (
                                <div key={v.label} className="p-6 rounded-3xl border border-white/10 bg-white/5 flex flex-col gap-2">
                                    <div className="text-lg font-bold text-white/50 uppercase tracking-widest">{v.icon} {v.label}</div>
                                    <div className="text-4xl font-black text-white">{v.value} <span className="text-xl opacity-40 font-medium">{v.unit}</span></div>
                                    <div className="text-base font-bold text-emerald-400 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400" /> {v.status}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 rounded-3xl border border-white/10 bg-white/5">
                            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest text-white/40">Medicine Today</h3>
                            <div className="space-y-4">
                                {dashboardData?.medications?.map((m: any) => (
                                    <div key={m.name} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 transition hover:bg-white/10">
                                        <div>
                                            <div className="text-xl font-bold text-white">{m.name}</div>
                                            <div className="text-base text-white/40 font-medium">{m.time}</div>
                                        </div>
                                        {m.taken ? (
                                            <span className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-sm font-black tracking-widest">TAKEN ✓</span>
                                        ) : (
                                            <span className="bg-amber-500/10 text-amber-400 px-4 py-2 rounded-xl text-sm font-black tracking-widest">PENDING</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTACTS MODAL */}
            {isContactsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0f1a]/90 backdrop-blur-xl p-4">
                    <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 lg:p-12 shadow-2xl relative">
                        <button onClick={() => setIsContactsOpen(false)} className="absolute top-8 right-8 text-white/40 hover:text-white transition text-3xl">✖</button>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <span className="text-rose-400">सम्पर्क</span> (Family)
                        </h2>

                        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-8">
                            <div className="text-lg font-bold text-rose-400 mb-1 flex items-center gap-2">
                                <span>🚨</span> Emergency Alert
                            </div>
                            <div className="text-white/60 font-medium">Click a name to alert them immediately.</div>
                        </div>

                        <div className="space-y-4">
                            {dashboardData?.contacts?.length > 0 ? (
                                dashboardData.contacts.map((c: any) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            speak(`${c.name} लाई फोन गर्दै।`);
                                            showToast(`${c.name} notified! They are coming.`, "📞", false);
                                        }}
                                        className="w-full p-6 rounded-3xl border border-white/10 bg-white/5 text-left hover:border-indigo-500/50 hover:bg-white/10 transition flex items-center justify-between group"
                                    >
                                        <div>
                                            <div className="text-2xl font-black text-white group-hover:text-indigo-400 transition">{c.name}</div>
                                            <div className="text-lg text-white/40 font-medium">{c.relationship}</div>
                                        </div>
                                        <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-2xl group-hover:bg-indigo-500 group-hover:text-white transition">📞</div>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center p-12 text-white/20 font-bold italic">No family contacts saved yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI RAG CHAT OVERLAY */}
            {isChatOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0f1a]/95 backdrop-blur-xl p-4">
                    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl relative">
                        <button
                            onClick={() => setIsChatOpen(false)}
                            className="absolute top-6 right-6 text-white/40 hover:text-white transition text-2xl"
                        >
                            ✖
                        </button>

                        <h2 className="text-3xl font-black text-white mb-2">Speak to SaharaAI</h2>
                        <p className="text-lg text-white/60 mb-8 font-medium">तपाईंलाई के सहयोग चाहिएको छ? (How can I help you?)</p>

                        <form onSubmit={submitRagQuery} className="flex flex-col gap-6">
                            <div className="relative group">
                                <textarea
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="यहाँ लेख्नुहोस्... (Type here...)"
                                    className="w-full rounded-2xl bg-white/5 border border-white/10 p-6 pr-20 text-2xl text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none min-h-[160px] font-medium transition"
                                    autoFocus
                                />

                                <button
                                    type="button"
                                    onClick={() => (isListening ? stopListening() : startListening())}
                                    className={classNames(
                                        "absolute right-4 top-4 h-14 w-14 rounded-2xl transition flex items-center justify-center text-3xl shadow-2xl",
                                        isListening ? "bg-rose-500 text-white animate-pulse" : "bg-indigo-500 text-white hover:bg-indigo-600"
                                    )}
                                    aria-label={isListening ? "Stop listening" : "Speak"}
                                >
                                    {isListening ? "⏹️" : "🎙️"}
                                </button>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsChatOpen(false)}
                                    className="flex-1 rounded-2xl bg-white/5 px-6 py-5 text-xl font-black text-white hover:bg-white/10 transition border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isChatting}
                                    className="flex-[2] rounded-2xl bg-indigo-500 px-6 py-5 text-xl font-black text-white hover:bg-indigo-600 transition shadow-2xl shadow-indigo-500/20 disabled:opacity-50"
                                >
                                    {isChatting ? "Thinking..." : "Send Request ➜"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Toast open={toast.open} icon={toast.icon} message={toast.message} onClose={closeToast} />
        </div>
    );
}
