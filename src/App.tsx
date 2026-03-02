import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import BuildingOverviewPage from "./pages/BuildingPage";
import BuildingLoadPage from "./pages/BuildingLoadPage";
import BuildingCage from "./pages/BuildingCage";
import ReportPage from "./pages/ReportPage";
import HarvestBuildingPage from "./pages/HarvestBuildingPage";

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
        <Route path="/reports" element={<ReportPage />} />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
