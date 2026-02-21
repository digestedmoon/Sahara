import { create } from 'zustand';
import { getToken, setToken, clearToken } from '../../utils/storage';

export type UserRole = 'elder' | 'caretaker' | 'admin';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getToken(),
  user: null,
  isAuthenticated: !!getToken(),

  login: (token: string, user: User) => {
    setToken(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
