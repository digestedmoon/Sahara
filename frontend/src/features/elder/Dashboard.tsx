import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Webcam from 'react-webcam';
import apiClient from '../../api/axios';



/**
 * SaharaAI — Elder Dashboard (React)
 * - Low-vision + dyslexia-friendly: big targets, high contrast, simple language
 * - Voice-first: built-in Web Speech TTS (can be replaced by your backend TTS)
 * - API-ready: /api/where?item=..., /api/alerts, /api/health
 */

function speak(text: string) {
    try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92; // slightly slower for clarity
        u.pitch = 1.0;
        u.volume = 1.0;
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
    color: string;
    icon: string;
    label: string;
    hint: string;
    footer: string;
    onClick: () => void;
}

function BigCardButton({ color, icon, label, hint, footer, onClick }: BigCardButtonProps) {
    const colorClass = useMemo(() => {
        switch (color) {
            case "blue":
                return "from-blue-300 to-blue-600 text-slate-950";
            case "green":
                return "from-emerald-200 to-emerald-600 text-slate-950";
            case "yellow":
                return "from-yellow-200 to-yellow-500 text-slate-950";
            case "purple":
                return "from-violet-200 to-violet-600 text-slate-950";
            case "teal":
                return "from-cyan-200 to-cyan-500 text-slate-950";
            case "red":
                return "from-rose-200 to-rose-600 text-slate-950";
            default:
                return "from-slate-200 to-slate-500 text-slate-950";
        }
    }, [color]);

    return (
        <button
            onClick={onClick}
            className={classNames(
                "relative w-full min-h-[170px] rounded-[28px] p-5 text-left shadow-2xl",
                "bg-gradient-to-br",
                colorClass,
                "focus:outline-none focus:ring-4 focus:ring-white/70",
                "active:scale-[0.99] transition"
            )}
            aria-label={label}
        >
            <div className="grid content-between h-full">
                <div>
                    <div className="text-[42px] leading-none" aria-hidden="true">
                        {icon}
                    </div>
                    <div className="mt-2 text-[30px] font-black tracking-[0.2px]">{label}</div>
                    <div className="mt-2 text-[18px] font-bold opacity-90 leading-snug">{hint}</div>
                </div>
                <div className="text-[17px] font-extrabold opacity-85">{footer}</div>
            </div>

            <div
                className="absolute -right-10 -bottom-14 w-[240px] h-[240px] rounded-full bg-white/25 blur-[1px]"
                aria-hidden="true"
            />
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
        <div className="fixed left-4 right-4 bottom-4 z-50 mx-auto max-w-5xl">
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border border-white/20 bg-black/70 p-4 shadow-2xl backdrop-blur">
                <div className="text-[22px]" aria-hidden="true">
                    {icon}
                </div>
                <div className="text-[18px] font-extrabold leading-snug text-white">{message}</div>
                <button
                    onClick={onClose}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[16px] font-black text-white focus:outline-none focus:ring-4 focus:ring-white/70"
                    aria-label="OK"
                >
                    OK
                </button>
            </div>
        </div>
    );
}

function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

export default function ElderDashboard() {
    const now = useClock();

    const [toast, setToast] = useState({ open: false, icon: "💬", message: "" });
    const [coachText, setCoachText] = useState(
        "Hello Aama. Would you like to check today’s medicines now?"
    );

    const [status, setStatus] = useState({
        safeReady: true,
        lastCheck: "Just now",
    });

    // “Find my things” UI
    const [findItem, setFindItem] = useState("sunglasses");
    const [findResult, setFindResult] = useState<any>(null);

    // caretaker alerts (optional to surface to elder)
    const [latestAlert, setLatestAlert] = useState<any>(null);

    // Webcam details
    const [isDetecting, setIsDetecting] = useState(false);
    const webcamRef = useRef<Webcam>(null);

    const firstRunRef = useRef(true);

    function showToast(message: string, icon = "💬", speakIt = true) {
        setToast({ open: true, icon, message });
        if (speakIt) speak(message);
    }

    function closeToast() {
        setToast((t) => ({ ...t, open: false }));
    }

    const captureAndDetect = useCallback(async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        try {
            const blob = dataURLtoBlob(imageSrc);
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');

            const response = await apiClient.post('/detect', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const announcements = response.data.announcements || [];
            if (announcements.length > 0) {
                announcements.forEach((text: string) => {
                    showToast(text, "🚨", true);
                });
            }
        } catch (error) {
            console.error('Detection error:', error);
        }
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isDetecting) {
            interval = window.setInterval(() => {
                captureAndDetect();
            }, 6000); // Check every 6s
        }
        return () => {
            if (interval) window.clearInterval(interval);
        };
    }, [isDetecting, captureAndDetect]);

    async function checkHealth() {
        try {
            const r = await apiClient.get(`/health`);
            setStatus((s) => ({ ...s, safeReady: true }));
        } catch {
            setStatus((s) => ({ ...s, safeReady: false }));
        }
    }

    async function fetchAlerts() {
        try {
            const r = await apiClient.get(`/alerts?limit=1`);
            const a = r.data?.alerts?.[0];
            if (a && (!latestAlert || a.id !== latestAlert.id)) {
                setLatestAlert(a);
                // Keep it gentle for elders; don’t scare unless necessary
                showToast("I have informed your caretaker. You are safe.", "✅", true);
            }
        } catch { }
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
        checkHealth();
        const t = setInterval(() => {
            checkHealth();
            fetchAlerts();
        }, 15000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!firstRunRef.current) return;
        firstRunRef.current = false;
        setTimeout(() => {
            showToast("Hello. I am SaharaAI. Press the big blue button to talk to me.", "💙", true);
        }, 700);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_20%_10%,#1a2450_0%,#0b1020_55%)] text-white">
            {/* Optional: set a dyslexia-friendly font if available in your app */}
            <div className="mx-auto max-w-6xl p-4 pb-10">
                {/* TOP BAR */}
                <header className="grid gap-3 rounded-2xl border border-white/10 bg-[#121a33]/70 p-4 shadow-2xl backdrop-blur md:grid-cols-[1fr_auto] md:items-center">
                    <div className="grid gap-1">
                        <div className="text-[26px] font-extrabold tracking-[0.2px]">SaharaAI</div>
                        <div className="text-[16px] font-semibold text-white/75 leading-snug">
                            Your friendly voice companion — safety, memory, and family in one place.
                        </div>
                    </div>

                    <div className="grid gap-2 justify-items-start md:justify-items-end">
                        <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[16px] font-semibold text-white/80">
                            <span
                                className={classNames(
                                    "h-3 w-3 rounded-full",
                                    status.safeReady ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(31,191,117,.20)]" : "bg-rose-400"
                                )}
                                aria-hidden="true"
                            />
                            <span>
                                <span className="font-extrabold text-white">
                                    {status.safeReady ? "Safe & Ready" : "Offline"}
                                </span>{" "}
                                • Voice is on
                            </span>
                        </div>

                        <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[16px] font-semibold text-white/80">
                            <span aria-hidden="true">🗓️</span>
                            <span className="font-extrabold text-white">Today</span>
                            <span>•</span>
                            <span className="font-extrabold text-white">
                                {hh}:{mm}
                            </span>
                        </div>
                    </div>
                </header>

                {/* MAIN ACTION GRID */}
                <main className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <BigCardButton
                        color="blue"
                        icon="🔵"
                        label="Talk to Me"
                        hint="Say anything. I will guide you."
                        footer="Voice-first • Gentle replies"
                        onClick={() => showToast("I’m listening. You can speak now.", "🔵", true)}
                    />

                    <BigCardButton
                        color="green"
                        icon="🟢"
                        label="What’s Today?"
                        hint="Plan, reminders, and routine."
                        footer="Simple • One screen"
                        onClick={() => showToast("Today: medicines, meals, and any appointments.", "🟢", true)}
                    />

                    <BigCardButton
                        color="yellow"
                        icon="🟡"
                        label="My Medicines"
                        hint="What to take — step by step."
                        footer="Big images • Clear timing"
                        onClick={() => showToast("Let’s do medicines together. I will guide you step by step.", "🟡", true)}
                    />

                    <BigCardButton
                        color="teal"
                        icon="🧿"
                        label="Find My Things"
                        hint="“Where are my glasses?”"
                        footer="Camera help • Gentle guidance"
                        onClick={() => whereIsItem(findItem)}
                    />

                    <BigCardButton
                        color="purple"
                        icon="🟣"
                        label="Family Updates"
                        hint="Photos and voice messages."
                        footer="Warm • Comforting"
                        onClick={() => showToast("Family updates: photos and voice messages from loved ones.", "🟣", true)}
                    />

                    <BigCardButton
                        color="red"
                        icon="🔴"
                        label="Emergency"
                        hint="Get help right now."
                        footer="One tap • Loud confirmation"
                        onClick={() => showToast("Emergency pressed. Calling caretaker now.", "🔴", true)}
                    />
                </main>

                {/* FIND ITEM PANEL (optional, helps reduce confusion) */}
                <section className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-[#121a33]/70 p-4 shadow-2xl backdrop-blur">
                    <div className="text-[22px] font-extrabold">Find My Things</div>
                    <div className="text-[16px] font-semibold text-white/75">
                        Choose an item. SaharaAI will tell you the last known location.
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <select
                            value={findItem}
                            onChange={(e) => setFindItem(e.target.value)}
                            className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-[20px] font-extrabold text-white focus:outline-none focus:ring-4 focus:ring-white/70"
                            aria-label="Select an item to find"
                        >
                            <option value="sunglasses">Sunglasses</option>
                            <option value="glasses">Glasses</option>
                            <option value="phone">Phone</option>
                            <option value="keys">Keys</option>
                            <option value="wallet">Wallet</option>
                            <option value="remote">Remote</option>
                        </select>

                        <button
                            onClick={() => whereIsItem(findItem)}
                            className="rounded-2xl bg-white text-slate-950 px-5 py-4 text-[20px] font-black shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/70"
                            aria-label="Find item now"
                        >
                            🧿 Find
                        </button>
                    </div>

                    {findResult?.found && (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="text-[18px] font-extrabold">
                                {findResult.announcement}
                            </div>
                            <div className="mt-2 text-[16px] font-semibold text-white/75">
                                Last seen: <span className="font-black text-white">{findResult.last_seen_ts}</span>
                            </div>
                        </div>
                    )}
                </section>

                {/* AI VISION CAMERA PANEL */}
                <section className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-[#121a33]/70 p-4 shadow-2xl backdrop-blur">
                    <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                        <div>
                            <div className="text-[22px] font-extrabold">AI Vision Assistant</div>
                            <div className="mt-2 text-[16px] font-semibold text-white/75 leading-snug">
                                Always-on AI tracking helps remember item locations and detect unknown persons automatically.
                            </div>
                        </div>

                        <button
                            onClick={() => setIsDetecting(!isDetecting)}
                            className={`rounded-2xl border border-white/15 px-4 py-4 text-[18px] font-black shadow-lg focus:outline-none focus:ring-4 focus:ring-white/70 ${isDetecting ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white'}`}
                            aria-label="Toggle Camera"
                        >
                            {isDetecting ? '⏹️ Stop Camera' : '▶️ Start Camera'}
                        </button>
                    </div>
                    {isDetecting ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/50">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user" }}
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    ) : (
                        <div className="mt-4 rounded-2xl border border-white/15 bg-black/30 p-8 text-center text-white/50 font-semibold" style={{ fontSize: '0.9rem' }}>
                            Camera is currently off.<br />Enable to let AI track your items and assist you.
                        </div>
                    )}
                </section>

                {/* COACH PANEL */}
                <section className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-[#121a33]/70 p-4 shadow-2xl backdrop-blur">
                    <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                        <div>
                            <div className="text-[22px] font-extrabold">Gentle Guidance</div>
                            <div className="mt-2 text-[22px] font-bold leading-snug">{coachText}</div>
                            <div className="mt-2 text-[16px] font-semibold text-white/75 leading-snug">
                                Big buttons. Minimal words. High contrast. Voice prompts. Designed for low vision and memory support.
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <button
                                onClick={() => {
                                    speak(coachText);
                                    showToast("Reading out loud.", "🔊", false);
                                }}
                                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-[18px] font-black shadow-lg focus:outline-none focus:ring-4 focus:ring-white/70"
                                aria-label="Read out loud"
                            >
                                🔊 Read Aloud
                            </button>

                            <button
                                onClick={() => {
                                    setStatus((s) => ({ ...s, lastCheck: "Just now" }));
                                    showToast("Safety check done. You are safe.", "✅", true);
                                }}
                                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-[18px] font-black shadow-lg focus:outline-none focus:ring-4 focus:ring-white/70"
                                aria-label="Check now"
                            >
                                ✅ Check Now
                            </button>
                        </div>
                    </div>
                </section>

                {/* Optional: show latest alert gently */}
                {latestAlert && (
                    <section className="mt-4 rounded-3xl border border-white/10 bg-[#121a33]/70 p-4 shadow-2xl backdrop-blur">
                        <div className="text-[22px] font-extrabold">Care Update</div>
                        <div className="mt-2 text-[18px] font-bold text-white/90 leading-snug">
                            Your caretaker has been notified.
                        </div>
                        <div className="mt-2 text-[16px] font-semibold text-white/75">
                            {latestAlert.message} • {latestAlert.ts}
                        </div>
                    </section>
                )}
            </div>

            <Toast open={toast.open} icon={toast.icon} message={toast.message} onClose={closeToast} />
        </div>
    );
}