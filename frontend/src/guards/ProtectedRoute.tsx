import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

interface Props {
  children: ReactElement;
}

export default function ProtectedRoute({ children }: Props): ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}