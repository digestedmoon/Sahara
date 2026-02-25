import { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

export default function ElderLayout(): ReactElement {
  return (
    <>
      <div className="bg-mesh" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
        background: 'linear-gradient(135deg, #0f1117 0%, #1a1f2e 50%, #0d1b2a 100%)'
      }} />
      <div style={{
        display: 'flex', justifyContent: 'center', minHeight: '100vh',
        width: '100%', padding: '1rem'
      }}>
        <div style={{
          width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column'
        }}>
          <Outlet />
        </div>
      </div>
    </>
  );
}
