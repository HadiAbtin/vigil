import axios from "axios";
import { useAuthStore } from "@/store/auth";
import type {
  AlertCategory,
  AlertEvent,
  AlertEventStatus,
  AlertRule,
  AlertRuleType,
  DashboardSummary,
  HttpMonitor,
  MetricRangeResponse,
  NodeExporterConfig,
  PortCheck,
  PortCheckWithServer,
  Server,
  ServerDetail,
  SSHKey,
  SSHKeyCreated,
  TelegramBot,
  User,
} from "@/lib/types";

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg ?? JSON.stringify(d)).join(", ");
  }
  return "Something went wrong. Please try again.";
}

// --- Auth --------------------------------------------------------------

export const authApi = {
  login: (username: string, password: string) =>
    api
      .post<{ access_token: string; must_change_password: boolean }>("/auth/login", { username, password })
      .then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post<User>("/auth/change-password", { current_password, new_password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

// --- SSH keys ------------------------------------------------------------

export const sshKeysApi = {
  list: () => api.get<SSHKey[]>("/ssh-keys").then((r) => r.data),
  create: (payload: { name: string; private_key?: string }) =>
    api.post<SSHKeyCreated>("/ssh-keys", payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/ssh-keys/${id}`),
};

// --- Servers -------------------------------------------------------------

export const serversApi = {
  list: () => api.get<Server[]>("/servers").then((r) => r.data),
  get: (id: number) => api.get<ServerDetail>(`/servers/${id}`).then((r) => r.data),
  create: (payload: Partial<Server>) => api.post<ServerDetail>("/servers", payload).then((r) => r.data),
  update: (id: number, payload: Partial<Server>) =>
    api.patch<ServerDetail>(`/servers/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/servers/${id}`),

  addPortCheck: (serverId: number, payload: Partial<PortCheck>) =>
    api.post<PortCheck>(`/servers/${serverId}/port-checks`, payload).then((r) => r.data),
  updatePortCheck: (serverId: number, portCheckId: number, payload: Partial<PortCheck>) =>
    api.patch<PortCheck>(`/servers/${serverId}/port-checks/${portCheckId}`, payload).then((r) => r.data),
  removePortCheck: (serverId: number, portCheckId: number) =>
    api.delete(`/servers/${serverId}/port-checks/${portCheckId}`),

  addNodeExporter: (serverId: number, payload: { ssh_key_id: number; ssh_user: string; ssh_port: number }) =>
    api.post<NodeExporterConfig>(`/servers/${serverId}/node-exporter`, payload).then((r) => r.data),
  retryNodeExporter: (serverId: number) =>
    api.post<NodeExporterConfig>(`/servers/${serverId}/node-exporter/retry`).then((r) => r.data),
  removeNodeExporter: (serverId: number) => api.delete(`/servers/${serverId}/node-exporter`),
};

// --- Port checks (flat, cross-server — used by the alert rule form) -------

export const portChecksApi = {
  list: () => api.get<PortCheckWithServer[]>("/port-checks").then((r) => r.data),
};

// --- HTTP monitors ---------------------------------------------------------

export const httpMonitorsApi = {
  list: (standaloneOnly = false) =>
    api.get<HttpMonitor[]>("/http-monitors", { params: { standalone_only: standaloneOnly } }).then((r) => r.data),
  create: (payload: Partial<HttpMonitor>) => api.post<HttpMonitor>("/http-monitors", payload).then((r) => r.data),
  update: (id: number, payload: Partial<HttpMonitor>) =>
    api.patch<HttpMonitor>(`/http-monitors/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/http-monitors/${id}`),
};

// --- Alert categories --------------------------------------------------

export const alertCategoriesApi = {
  list: () => api.get<AlertCategory[]>("/alert-categories").then((r) => r.data),
  create: (payload: { name: string; description?: string }) =>
    api.post<AlertCategory>("/alert-categories", payload).then((r) => r.data),
  update: (id: number, payload: Partial<AlertCategory>) =>
    api.patch<AlertCategory>(`/alert-categories/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/alert-categories/${id}`),
};

// --- Alert rules -----------------------------------------------------------

export const alertRulesApi = {
  list: () => api.get<AlertRule[]>("/alert-rules").then((r) => r.data),
  create: (payload: Partial<AlertRule>) => api.post<AlertRule>("/alert-rules", payload).then((r) => r.data),
  update: (id: number, payload: Partial<AlertRule>) =>
    api.patch<AlertRule>(`/alert-rules/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/alert-rules/${id}`),
};

// --- Telegram bots ---------------------------------------------------------

export const telegramBotsApi = {
  list: () => api.get<TelegramBot[]>("/telegram-bots").then((r) => r.data),
  create: (payload: { name: string; bot_token: string; chat_id: string; category_ids: number[]; enabled: boolean }) =>
    api.post<TelegramBot>("/telegram-bots", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.patch<TelegramBot>(`/telegram-bots/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/telegram-bots/${id}`),
  test: (id: number) => api.post(`/telegram-bots/${id}/test`),
};

// --- Alert events -----------------------------------------------------------

export const alertEventsApi = {
  list: (status?: AlertEventStatus) =>
    api.get<AlertEvent[]>("/alert-events", { params: status ? { status } : undefined }).then((r) => r.data),
};

// --- Metrics (historical graphs) --------------------------------------

export const metricsApi = {
  range: (
    ruleType: AlertRuleType,
    targetId: number,
    start: number,
    end: number,
    field?: "latency" | "status",
  ) =>
    api
      .get<MetricRangeResponse>("/metrics", {
        params: { rule_type: ruleType, target_id: targetId, start, end, field },
      })
      .then((r) => r.data),
};

// --- Dashboard ---------------------------------------------------------

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
};
