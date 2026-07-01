import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  mustChangePassword: boolean;
  setSession: (token: string, mustChangePassword: boolean) => void;
  setMustChangePassword: (value: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      mustChangePassword: false,
      setSession: (token, mustChangePassword) => set({ token, mustChangePassword }),
      setMustChangePassword: (value) => set({ mustChangePassword: value }),
      clearSession: () => set({ token: null, mustChangePassword: false }),
    }),
    { name: "vigil-auth" },
  ),
);
