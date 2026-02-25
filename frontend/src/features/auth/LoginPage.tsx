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
    <div style={{ position: 'relative', minHeight: '100dvh', background: 'var(--bg-base)', overflowX: 'hidden' }}>
      <div className="bg-mesh" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
        background: 'radial-gradient(circle at 100% 0%, #FFCE99 0%, transparent 40%), radial-gradient(circle at 0% 100%, #FFB37C 0%, transparent 40%), var(--bg-base)'
      }} />

      <div className="login-page" style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Left: Form ── */}
        <div className="login-left">
          <div className="login-card fade-up">

            {/* Premium Logo Pill (Consistent across app) */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.2rem',
                background: '#fff',
                borderRadius: '100px',
                boxShadow: '0 4px 15px rgba(86, 47, 0, 0.05)',
                border: '1px solid rgba(86, 47, 0, 0.05)'
              }}>
                <span style={{ fontSize: '1.2rem' }}></span>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.1rem', 
                  fontWeight: 900, 
                  color: '#562F00',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  Sahara <span style={{ color: '#FF9644' }}>सहारा</span>
                </h2>
              </div>
            </div>

            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>Welcome Back</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', textAlign: 'center' }}>
              Log in to your personalized care companion.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@email.com"
                  className={`form-input${errors.email ? ' error' : ''}`}
                  {...register('email')}
                  style={{ borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}
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
                  style={{ borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}
                />
                {errors.password && <span className="form-error">⚠ {errors.password.message}</span>}
              </div>

              {/* Global error */}
              {errors.root && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
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
                style={{ 
                  marginTop: '0.5rem', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  boxShadow: '0 8px 25px var(--primary-glow)'
                }}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

            </form>

            {/* Demo credentials */}
            <div style={{
              marginTop: '2rem',
              padding: '1.25rem',
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              backdropFilter: 'blur(10px)'
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.8rem', textAlign: 'center' }}>
                Quick Demo Access
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {u.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.role}</p>
                    </div>
                    <span style={{ fontSize: '1.1rem' }}>➡️</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" style={{ margin: '1.5rem 0 0', opacity: 0.5 }}>Secure · Encrypted · HIPAA-ready</div>
          </div>
        </div>

        {/* ── Right: Hero ── */}
        <div className="login-right" style={{ background: 'transparent', borderLeft: 'none' }}>
          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '500px' }}>

            <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🏡</div>
            <h2 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: '1.5rem' }}>
              The First Culturally-Aware <span style={{ color: 'var(--primary)' }}>Companion</span>
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: 1.7, marginBottom: '3rem' }}>
              Sahara combines proactive conversations, safety intelligence, and caregiver control — so no elder ever feels alone again.
            </p>

            <div className="feature-container">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className={`feature-card fade-up fade-up-${i + 2}`}
                  style={{ background: 'rgba(255,255,255,0.4)', borderRadius: 'var(--radius-lg)' }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                    background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', flexShrink: 0,
                    boxShadow: '0 4px 12px var(--primary-glow)',
                    color: '#fff'
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.2rem' }}>{f.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
