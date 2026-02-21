import { type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type UserRole, useAuthStore } from './authStore';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';

// ── Mock credentials for auto-fill helper ───────────────
type MockUser = { id: string; name: string; email: string; role: UserRole; password: string };
const MOCK_USERS: MockUser[] = [
  { id: '1', name: 'Eleanor (Elder)', email: 'elder@test.com', role: 'elder', password: 'pass' },
  { id: '2', name: 'Sarah (Caregiver)', email: 'caregiver@test.com', role: 'caretaker', password: 'pass' },
];
// ──────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: '🤖', title: 'AI That Cares Like Family', desc: 'Guided conversations, memory recall, and emotional awareness — SaharaAI doesn’t wait for commands. It checks in, understands, and connects.' },
  { icon: '💊', title: 'Intelligent Routine & Medicine Guidance', desc: 'isual, voice-guided, and personalized reminders that ensure the right medicine, at the right time — every single day.' },
  { icon: '🔔', title: '24/7 Safety & Smart Monitoring', desc: 'Fall detection, inactivity alerts, visitor recognition, and instant caregiver notifications — because protection should never pause.' },
];

export default function LoginPage(): ReactElement {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });


  const onSubmit = async (data: FormData) => {
    try {
      const resp = await apiClient.post('/auth/login', {
        email: data.email,
        password: data.password,
      });
      const { access_token, user } = resp.data;

      // Update role mapping as backend sometimes uses 'caregiver' for 'caretaker'
      const role = user.role === 'caregiver' ? 'caretaker' : user.role;
      user.role = role;

      login(access_token, user);
      navigate(role === 'elder' ? '/elder/dashboard' : '/caretaker/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid email or password. Use demo accounts below.';
      setError('root', { message: msg });
    }
  };

  return (
    <>
      <div className="bg-mesh" />
      <div className="login-page">

        {/* ── Left: Form ── */}
        <div className="login-left">
          <div className="login-card fade-up">

            {/* Brand */}
            <div className="login-brand fade-up">
              <div className="brand-header">
                <div className="mark">🫀</div>
                <div className="brand-text">SaharaAI</div>
              </div>
              <span className="slogan">For the ones who once guided us - now guided by SaharaAI</span>
            </div>

            <h1 style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>Welcome back</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
              Sign in to access your personalised care dashboard.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={`form-input${errors.email ? ' error' : ''}`}
                  {...register('email')}
                />
                {errors.email && <span className="form-error">⚠ {errors.email.message}</span>}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`form-input${errors.password ? ' error' : ''}`}
                  {...register('password')}
                />
                {errors.password && <span className="form-error">⚠ {errors.password.message}</span>}
              </div>

              {/* Global error */}
              {errors.root && (
                <div style={{
                  padding: '0.65rem 0.9rem',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}>
                  🚫 {errors.root.message}
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-full"
                style={{ marginTop: '0.5rem', padding: '0.85rem' }}
              >
                {isSubmitting
                  ? <><span className="pulse">●</span> Signing in…</>
                  : '→ Sign In'}
              </button>

            </form>

            {/* Demo credentials */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem 1.1rem',
              background: 'rgba(99,102,241,0.07)',
              border: '1px solid rgba(99,102,241,0.20)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.65rem' }}>
                🔑 Demo Accounts
              </p>
              {MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setValue('email', u.email, { shouldValidate: true });
                    setValue('password', u.password, { shouldValidate: true });
                  }}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.65rem', marginBottom: '0.4rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background var(--dur) var(--ease)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {u.name} <span className="badge badge-indigo" style={{ fontSize: '0.6rem', verticalAlign: 'middle' }}>{u.role}</span>
                    </p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email} · {u.password}</p>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                    ↙ Fill
                  </span>
                </button>
              ))}
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Click a row to auto-fill credentials, then press Sign In.
              </p>
            </div>

            <div className="divider" style={{ margin: '1.25rem 0 0' }}>Secure · HIPAA-aware · Encrypted</div>
          </div>
        </div>

        {/* ── Right: Hero ── */}
        <div className="login-right">
          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '600px' }}>

            <div className="cursive-title fade-up">
              The World’s First Culturally-Aware Voice Companion for Elder Care
            </div>

            <p className="fade-up fade-up-1" style={{ color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: '3rem', marginTop: '1rem', fontSize: '1.05rem', maxWidth: '450px' }}>
              SaharaAI combines proactive conversation, real-time safety intelligence, and caregiver control — so no elder ever feels alone, lost, or unsafe again.
            </p>

            <div className="feature-container">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className={`feature-card fade-up fade-up-${i + 2}`}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 'var(--radius-md)',
                    background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', flexShrink: 0,
                    boxShadow: '0 4px 12px var(--primary-glow)',
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>{f.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
