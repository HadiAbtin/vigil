import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { AppShell } from "@/components/layout/AppShell";

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <AppShell>{children}</AppShell>;
}
