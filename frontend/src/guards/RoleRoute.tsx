import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../features/auth/authStore';

interface Props {
  children: ReactElement;
  allowedRoles: UserRole[];
}

export default function RoleRoute({ children, allowedRoles }: Props): ReactElement {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
