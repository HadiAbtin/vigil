import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import LoginPage from "@/pages/LoginPage";
import ForcePasswordChangePage from "@/pages/ForcePasswordChangePage";
import DashboardPage from "@/pages/DashboardPage";
import ServersPage from "@/pages/ServersPage";
import ServerDetailPage from "@/pages/ServerDetailPage";
import HttpMonitorsPage from "@/pages/HttpMonitorsPage";
import SSHKeysPage from "@/pages/SSHKeysPage";
import AlertCategoriesPage from "@/pages/AlertCategoriesPage";
import AlertRulesPage from "@/pages/AlertRulesPage";
import TelegramBotsPage from "@/pages/TelegramBotsPage";
import AlertEventsPage from "@/pages/AlertEventsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ForcePasswordChangePage />} />

      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/servers" element={<RequireAuth><ServersPage /></RequireAuth>} />
      <Route path="/servers/:id" element={<RequireAuth><ServerDetailPage /></RequireAuth>} />
      <Route path="/http-monitors" element={<RequireAuth><HttpMonitorsPage /></RequireAuth>} />
      <Route path="/ssh-keys" element={<RequireAuth><SSHKeysPage /></RequireAuth>} />
      <Route path="/alert-categories" element={<RequireAuth><AlertCategoriesPage /></RequireAuth>} />
      <Route path="/alert-rules" element={<RequireAuth><AlertRulesPage /></RequireAuth>} />
      <Route path="/telegram-bots" element={<RequireAuth><TelegramBotsPage /></RequireAuth>} />
      <Route path="/alert-events" element={<RequireAuth><AlertEventsPage /></RequireAuth>} />
    </Routes>
  );
}

export default App;
