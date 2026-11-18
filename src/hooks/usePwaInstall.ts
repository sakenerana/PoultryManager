import { useSyncExternalStore } from "react";

type InstallSnapshot = {
  canInstall: boolean;
  isInstalled: boolean;
  isPrompting: boolean;
  isSecureContext: boolean;
  platform: "android" | "ios" | "desktop";
  isEmbedded: boolean;
};
type InstallResult = { outcome: "accepted" | "dismissed" | "unavailable" | "error" };
type InstallManager = {
  getSnapshot: () => InstallSnapshot;
  subscribe: (listener: () => void) => () => void;
  install: () => Promise<InstallResult>;
};

const fallback: InstallSnapshot = {
  canInstall: false,
  isInstalled: false,
  isPrompting: false,
  isSecureContext: typeof window !== "undefined" && window.isSecureContext,
  platform: typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
    ? "android" : typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "desktop",
  isEmbedded: false,
};
const fallbackSubscribe = () => () => {};
const fallbackSnapshot = () => fallback;
const unavailable = async (): Promise<InstallResult> => ({ outcome: "unavailable" });

export function usePwaInstall() {
  const manager = (window as Window & { gpmInstall?: InstallManager }).gpmInstall;
  const snapshot = useSyncExternalStore(
    manager?.subscribe ?? fallbackSubscribe,
    manager?.getSnapshot ?? fallbackSnapshot,
    fallbackSnapshot
  );
  return { ...snapshot, install: manager?.install ?? unavailable };
}
