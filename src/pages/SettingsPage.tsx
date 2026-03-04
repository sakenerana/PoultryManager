import { useEffect, useMemo, useState } from "react";
import { Layout, Typography, Button, Divider, Grid, Slider, Card } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { applyUserSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings } from "../utils/userSettings";
import type { UserSettings } from "../utils/userSettings";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const PRIMARY = "#008822";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ((window.navigator as Navigator & { standalone?: boolean }).standalone ?? false);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [isDirty, setIsDirty] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

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
    setIsToastOpen(true);
  };

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;

    if (result.outcome === "accepted") {
      setToastMessage("App installation started.");
    } else {
      setToastMessage("App installation was canceled.");
    }

    setIsToastOpen(true);
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setToastMessage("App installed successfully.");
      setIsToastOpen(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-4 !h-16",
        ].join(" ")}
        style={{ backgroundColor: PRIMARY }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button
            type="text"
            icon={<HomeOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className={["!m-0 !text-white", isMobile ? "!text-base" : ""].join(" ")}>
            Settings
          </Title>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3" : "px-4 py-4"}>
        <div className="max-w-2xl mx-auto space-y-3">
          <Card className="!rounded-sm !border-0 shadow-sm !mt-4" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
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

          <Card className="!rounded-sm !border-0 shadow-sm !mt-2" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
            <div className="text-sm font-semibold mb-2">Preview</div>
            <div className="rounded-sm border p-3" style={previewStyle}>
              <div className="font-semibold">GGDC Poultry Manager</div>
              <div className="text-sm mt-1">This is how text size will look.</div>
            </div>
          </Card>

          <Card className="!rounded-sm !border-0 shadow-sm !mt-2" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
            <div className="text-sm font-semibold mb-2">Install App</div>

            {isStandalone ? (
              <div className="text-xs text-slate-500">App is already installed on this device.</div>
            ) : canInstall ? (
              <Button
                type="primary"
                className="!rounded-sm"
                style={{ backgroundColor: "#008822", borderColor: "#008822" }}
                onClick={() => void handleInstallApp()}
              >
                Install App
              </Button>
            ) : isIos ? (
              <div className="text-xs text-slate-500">
                On iPhone, open Share and choose Add to Home Screen.
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Install button appears when your browser makes this app installable.
              </div>
            )}
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
      </Content>
      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
