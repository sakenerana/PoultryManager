import { useMemo, useState } from "react";
import { Layout, Typography, Button, Divider, Grid, Slider, Card } from "antd";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { applyUserSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings } from "../utils/userSettings";
import type { UserSettings } from "../utils/userSettings";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { usePwaInstall } from "../hooks/usePwaInstall";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const PRIMARY = "#008822";

export default function SettingsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const { canInstall, isInstalled, isPrompting, isSecureContext, platform, isEmbedded, install } = usePwaInstall();

  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [isDirty, setIsDirty] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "info" | "error">("success");

  const previewStyle = useMemo(
    () => ({
      fontSize: `${settings.textSize}px`,
      borderColor: "#cbd5e1",
      backgroundColor: "#ffffff",
      color: "#0f172a",
    }),
    [settings.textSize]
  );

  const patchSettings = (next: Partial<UserSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setIsDirty(true);
    applyUserSettings(merged);
  };

  const handleReset = () => {
    const next = { ...settings, textSize: DEFAULT_USER_SETTINGS.textSize };
    setSettings(next);
    setIsDirty(true);
    applyUserSettings(next);
  };

  const handleSave = () => {
    saveUserSettings(settings);
    setIsDirty(false);
    setToastMessage("Settings saved successfully.");
    setToastType("success");
    setIsToastOpen(true);
  };

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handleInstallApp = async () => {
    const result = await install();
    if (result.outcome === "accepted") {
      setToastMessage("App installation started.");
      setToastType("success");
    } else if (result.outcome === "dismissed") {
      setToastMessage("App installation was canceled.");
      setToastType("info");
    } else if (result.outcome === "error") {
      setToastMessage("The install prompt could not open. Use your browser menu to install the app.");
      setToastType("error");
    } else {
      setToastMessage("Use your browser menu to install the app, or open the app from your home screen if it is already installed.");
      setToastType("info");
    }
    setIsToastOpen(true);
  };

  const installInstructions = !isSecureContext
    ? "Open this site using HTTPS to install the app. Installation is unavailable on an unsecured connection."
    : isEmbedded
      ? "Open this site in the Chrome app first. Installation may not be available inside Facebook, Messenger, or other in-app browsers."
      : platform === "ios"
        ? "On iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen."
        : platform === "android"
          ? "In Chrome, tap the three-dot menu, then Install and create shortcut, then Install. On some versions, choose Install app or Add to Home screen."
          : "In Chrome, use the install icon in the address bar or open the browser menu and choose Install this page as an app.";
  const installContent = isInstalled ? (
    <div className="text-xs text-slate-500">This app is running in installed mode.</div>
  ) : (
    <div className="space-y-3">
      {canInstall || isPrompting ? (
        <Button
          type="primary"
          className="!rounded-lg !h-10"
          style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
          onClick={() => void handleInstallApp()}
          loading={isPrompting}
          disabled={isPrompting}
        >
          Install App
        </Button>
      ) : null}
      <p className="text-xs leading-relaxed text-slate-600">{installInstructions}</p>
      {!canInstall && isSecureContext && !isEmbedded && platform !== "ios" && (
        <p className="text-xs leading-relaxed text-slate-500">
          If no install option appears, use a regular browser tab instead of Incognito. If the app is already installed, open it from your home screen or app launcher.
        </p>
      )}
    </div>
  );

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-auto !min-h-14" : "!px-8 !h-[74px]",
        ].join(" ")}
        style={{
          backgroundColor: PRIMARY,
          ...(isMobile
            ? {
              paddingTop: mobileSafeAreaTop,
              height: `calc(56px + ${mobileSafeAreaTop})`,
            }
            : {}),
        }}
      >
        <div className={["flex items-center", isMobile ? "gap-2" : "gap-4"].join(" ")}>
          <Button
            type="text"
            icon={<IoMdArrowRoundBack size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          {isMobile ? (
            <>
              <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
              <Title level={4} className="!m-0 !text-base !text-white">
                Settings
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Preferences</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Application Settings
              </Title>
            </div>
          )}
        </div>
        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3" : "px-8 py-6"}>
        {isMobile ? (
          <div className="max-w-2xl mx-auto space-y-3">
            <Card className="!rounded-sm !border-0 shadow-sm !mt-4" bodyStyle={{ padding: 12 }}>
              <div className="text-sm font-semibold text-slate-700 mb-2">Text Size</div>
              <Slider
                min={12}
                max={22}
                value={settings.textSize}
                onChange={(v) => patchSettings({ textSize: Number(v) })}
                tooltip={{ formatter: (v) => `${v}px` }}
              />
              <div className="text-xs text-slate-500 mt-1">Current: {settings.textSize}px</div>
            </Card>

            <Card className="!rounded-sm !border-0 shadow-sm !mt-2" bodyStyle={{ padding: 12 }}>
              <div className="text-sm font-semibold mb-2">Preview</div>
              <div className="rounded-sm border p-3" style={previewStyle}>
                <div className="font-semibold">GGDC Poultry Manager</div>
                <div className="text-sm mt-1">This is how text size will look.</div>
              </div>
            </Card>

            <Card className="!rounded-sm !border-0 shadow-sm !mt-2" bodyStyle={{ padding: 12 }}>
              <div className="text-sm font-semibold mb-2">Install App</div>

              {installContent}
            </Card>

            <div className="flex gap-2 mt-4">
              <Button className="!flex-1 !rounded-sm" onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="primary"
                className="!flex-1 !rounded-sm"
                style={{ backgroundColor: "#008822", borderColor: "#008822" }}
                onClick={handleSave}
                disabled={!isDirty}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-6 py-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Settings Snapshot</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">Experience Preferences</div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Text Size</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{settings.textSize}px</div>
                </div>
                <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Changes</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{isDirty ? "Unsaved" : "Saved"}</div>
                </div>
                <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Install Prompt</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{isInstalled ? "Installed" : isPrompting ? "Opening" : canInstall ? "Ready" : !isSecureContext ? "HTTPS needed" : "Browser menu"}</div>
                </div>
                <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">PWA Status</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{isInstalled ? "Installed" : "Web"}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-7 space-y-4">
                <Card className="!rounded-sm !border !border-slate-200 !shadow-sm" bodyStyle={{ padding: 20 }}>
                  <div className="text-sm font-semibold text-slate-700 mb-2">Text Size</div>
                  <Slider
                    min={12}
                    max={22}
                    value={settings.textSize}
                    onChange={(v) => patchSettings({ textSize: Number(v) })}
                    tooltip={{ formatter: (v) => `${v}px` }}
                  />
                  <div className="text-xs text-slate-500 mt-1">Current: {settings.textSize}px</div>
                </Card>

                <Card className="!rounded-sm !border !border-slate-200 !shadow-sm !mt-4" bodyStyle={{ padding: 20 }}>
                  <div className="text-sm font-semibold mb-2">Preview</div>
                  <div className="rounded-lg border p-4" style={previewStyle}>
                    <div className="font-semibold">GGDC Poultry Manager</div>
                    <div className="text-sm mt-1">This is how text size will look.</div>
                  </div>
                </Card>
              </div>

              <div className="col-span-5 space-y-4">
                <Card className="!rounded-sm !border !border-slate-200 !shadow-sm" bodyStyle={{ padding: 20 }}>
                  <div className="text-sm font-semibold mb-2">Install App</div>
                  {installContent}
                </Card>

                <Card className="!rounded-sm !border !border-slate-200 !shadow-sm !mt-4" bodyStyle={{ padding: 20 }}>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">Actions</div>
                  <div className="flex gap-2">
                    <Button className="!flex-1 !rounded-lg !h-10" onClick={handleReset}>
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      className="!flex-1 !rounded-lg !h-10"
                      style={{ backgroundColor: "#008822", borderColor: "#008822" }}
                      onClick={handleSave}
                      disabled={!isDirty}
                    >
                      Save
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Content>
      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
