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
import GrowsReportPage from "./pages/GrowsReportPage";
import HarvestedReportPage from "./pages/HarvestedReportPage";
import ReportGrowHistoryPage from "./pages/ReportGrowHistoryPage";
import HarvestedReportHistoryPage from "./pages/HarvestedReportHistoryPage";
import ReportsMenuPage from "./pages/ReportsMenuPage";
import IncomeReportPage from "./pages/IncomeReportPage";
import IncomeSummaryFormPage from "./pages/IncomeSummaryFormPage";
import ElectricityConsumptionPage from "./pages/ElectricityConsumptionPage";
import ElectricityConsumptionFormPage from "./pages/ElectricityConsumptionFormPage";
import HarvestBuildingPage from "./pages/HarvestBuildingPage";
import HarvestTruckPage from "./pages/HarvestTruckPage";
import HarvestMetricHistoryPage from "./pages/HarvestMetricHistoryPage";
import HarvestAvgWeightHistoryPage from "./pages/HarvestAvgWeightHistoryPage";
import HarvestTruckHistoryPage from "./pages/HarvestTruckHistoryPage";
import SettingsPage from "./pages/SettingsPage";
import AccountsPage from "./pages/AccountsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminOnlyRoute from "./components/AdminOnlyRoute";
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
            <Route path="/building-metric-history/:id/:metric?" element={<BuildingMetricHistoryPage />} />
            <Route path="/building-avg-weight-history/:id" element={<BuildingAvgWeightHistoryPage />} />
            <Route path="/harvest" element={<HarvestBuildingPage />} />
            <Route path="/truck/:id" element={<HarvestTruckPage />} />
            <Route path="/harvest-metric-history/:id/:metric?" element={<HarvestMetricHistoryPage />} />
            <Route path="/harvest-avg-weight-history/:id" element={<HarvestAvgWeightHistoryPage />} />
            <Route path="/harvest-truck-history/:id" element={<HarvestTruckHistoryPage />} />
            <Route path="/reports" element={<ReportsMenuPage />} />
            <Route path="/reports/grows" element={<GrowsReportPage />} />
            <Route path="/reports/harvested" element={<HarvestedReportPage />} />
            <Route element={<AdminOnlyRoute />}>
              <Route path="/reports/income" element={<IncomeReportPage />} />
              <Route path="/reports/income/new" element={<IncomeSummaryFormPage />} />
              <Route path="/electricity-consumption" element={<ElectricityConsumptionPage />} />
              <Route path="/electricity-consumption/grow/:growId" element={<ElectricityConsumptionFormPage />} />
            </Route>
            <Route path="/reports/grow/:id/history" element={<ReportGrowHistoryPage />} />
            <Route path="/reports/harvested/grow/:id/history" element={<HarvestedReportHistoryPage />} />
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
