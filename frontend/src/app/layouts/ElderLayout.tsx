import { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

export default function ElderLayout(): ReactElement {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Dynamic Background Mesh */}
      <div className="bg-mesh" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
        background: 'radial-gradient(circle at 0% 0%, #FFCE99 0%, transparent 50%), radial-gradient(circle at 100% 100%, #FFB37C 0%, transparent 50%), var(--bg-base)'
      }} />
      
      {/* Native App Title Bar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '1.25rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 253, 241, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(86, 47, 0, 0.05)',
      }}>
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
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.1rem', 
            fontWeight: 900, 
            color: '#562F00',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Sahara <span style={{ color: '#FF9644' }}>सहारा</span>
          </h1>
        </div>
      </nav>

      <main style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex', 
        justifyContent: 'center', 
        minHeight: 'calc(100vh - 80px)',
        width: '100%', 
        padding: '1.5rem 1rem'
      }}>
        <div style={{
          width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column'
        }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
