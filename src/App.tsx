import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LandingPage from "./pages/LandingPage";
import BuildingOverviewPage from "./pages/BuildingPage";
import BuildingLoadPage from "./pages/BuildingLoadPage";
import BuildingCage from "./pages/BuildingCage";
import BuildingMetricHistoryPage from "./pages/BuildingMetricHistoryPage";
import BuildingAvgWeightHistoryPage from "./pages/BuildingAvgWeightHistoryPage";
import ReportPage from "./pages/ReportPage";
import HarvestBuildingPage from "./pages/HarvestBuildingPage";
import HarvestTruckPage from "./pages/HarvestTruckPage";
import SettingsPage from "./pages/SettingsPage";
import AccountsPage from "./pages/AccountsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AppUpdateIndicator from "./components/AppUpdateIndicator";

function App() {
  return (
    <>
      <AppUpdateIndicator />
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<PublicRoute />}>
            <Route path="/" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/landing-page" element={<LandingPage />} />
            <Route path="/buildings" element={<BuildingOverviewPage />} />
            <Route path="/building-load/:id" element={<BuildingLoadPage />} />
            <Route path="/building-cage/:id" element={<BuildingCage />} />
            <Route path="/building-metric-history/:id/:metric" element={<BuildingMetricHistoryPage />} />
            <Route path="/building-avg-weight-history/:id" element={<BuildingAvgWeightHistoryPage />} />
            <Route path="/harvest" element={<HarvestBuildingPage />} />
            <Route path="/truck/:id" element={<HarvestTruckPage />} />
            <Route path="/reports" element={<ReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
          </Route>

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
