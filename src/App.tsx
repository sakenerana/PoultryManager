import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import BuildingOverviewPage from "./pages/BuildingPage";
import BuildingLoadPage from "./pages/BuildingLoadPage";
import BuildingCage from "./pages/BuildingCage";
import ReportPage from "./pages/ReportPage";
import HarvestBuildingPage from "./pages/HarvestBuildingPage";
import HarvestTruckPage from "./pages/HarvestTruckPage";
import SettingsPage from "./pages/SettingsPage";
import AccountsPage from "./pages/AccountsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/landing-page" element={<LandingPage />} />
        <Route path="/buildings" element={<BuildingOverviewPage />} />
        <Route path="/building-load/:id" element={<BuildingLoadPage />} />
        <Route path="/building-cage/:id" element={<BuildingCage />} />
        <Route path="/harvest" element={<HarvestBuildingPage />} />
        <Route path="/truck/:id" element={<HarvestTruckPage />} />
        <Route path="/reports" element={<ReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
