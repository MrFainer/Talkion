import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  news_group_title?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User, token: string, rememberMe?: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

const TOKEN_KEY = 'talkion_token';
const USER_KEY = 'talkion_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  login: (user, token, rememberMe = true) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(TOKEN_KEY, token);
      storage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
    set({ user: null, token: null, isAuthenticated: false });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    
    const token =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const userRaw =
      localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);

    set({
      user: userRaw ? JSON.parse(userRaw) : null,
      token,
      isAuthenticated: !!token,
      isHydrated: true,
    });
  },
}));
