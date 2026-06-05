import { create } from 'zustand';
import api from '@/lib/api';

interface SettingsState {
  admin_lessons_confirmation_enabled: boolean;
  loaded: boolean;
  fetch: (teacherId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  admin_lessons_confirmation_enabled: true,
  loaded: false,
  fetch: async (teacherId: string) => {
    try {
      const res = await api.get(`/message-settings/${teacherId}`);
      set({
        admin_lessons_confirmation_enabled: res.data?.admin_lessons_confirmation_enabled !== false,
        loaded: true,
      });
    } catch {
      set({ admin_lessons_confirmation_enabled: true, loaded: true });
    }
  },
}));
