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
  subscriptionStatus: string | null;
  subscriptionNextBillingDate: string | null;
  isFreePlan: boolean;
  setSubscriptionData: (status: string | null, nextBillingDate?: string | null) => void;
  login: (user: User, token: string, rememberMe?: boolean, subscriptionStatus?: string | null, isFreePlan?: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

const TOKEN_KEY = 'talkion_token';
const USER_KEY = 'talkion_user';
const SUBSCRIPTION_STATUS_KEY = 'talkion_subscription_status';
const IS_FREE_PLAN_KEY = 'talkion_is_free_plan';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  subscriptionStatus: null,
  subscriptionNextBillingDate: null,
  isFreePlan: false,
  setSubscriptionData: (status, nextBillingDate) =>
    set({ subscriptionStatus: status, subscriptionNextBillingDate: nextBillingDate ?? null }),
  login: (user, token, rememberMe = true, subscriptionStatus?: string | null, isFreePlan = false) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
      localStorage.removeItem(IS_FREE_PLAN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
      sessionStorage.removeItem(IS_FREE_PLAN_KEY);

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(TOKEN_KEY, token);
      storage.setItem(USER_KEY, JSON.stringify(user));
      if (subscriptionStatus !== undefined) storage.setItem(SUBSCRIPTION_STATUS_KEY, subscriptionStatus ?? '');
      storage.setItem(IS_FREE_PLAN_KEY, String(isFreePlan));
    }
    set({ user, token, isAuthenticated: true, subscriptionStatus: subscriptionStatus ?? null, isFreePlan });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
      localStorage.removeItem(IS_FREE_PLAN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
      sessionStorage.removeItem(IS_FREE_PLAN_KEY);
    }
    set({ user: null, token: null, isAuthenticated: false, subscriptionStatus: null, subscriptionNextBillingDate: null, isFreePlan: false });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;

    const token =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const userRaw =
      localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    const parsedUser = userRaw ? JSON.parse(userRaw) : null;

    const subStatus =
      localStorage.getItem(SUBSCRIPTION_STATUS_KEY) || sessionStorage.getItem(SUBSCRIPTION_STATUS_KEY);
    const isFreeRaw =
      localStorage.getItem(IS_FREE_PLAN_KEY) || sessionStorage.getItem(IS_FREE_PLAN_KEY);

    set({
      user: parsedUser,
      token,
      isAuthenticated: !!token,
      subscriptionStatus: subStatus ?? null,
      isFreePlan: isFreeRaw === 'true',
      isHydrated: true,
    });
  },
}));
