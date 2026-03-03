export type ThemeMode = "light" | "dark";

export type UserSettings = {
  textSize: number;
  theme: ThemeMode;
  primaryColor: string;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  textSize: 16,
  theme: "light",
  primaryColor: "#008822",
};

const STORAGE_KEY = "user_settings_v1";

export const loadUserSettings = (): UserSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      textSize: Number(parsed.textSize) || DEFAULT_USER_SETTINGS.textSize,
      theme: parsed.theme === "dark" ? "dark" : "light",
      primaryColor: parsed.primaryColor || DEFAULT_USER_SETTINGS.primaryColor,
    };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
};

export const applyUserSettings = (settings: UserSettings) => {
  document.documentElement.style.fontSize = `${settings.textSize}px`;
  document.documentElement.style.setProperty("--app-primary", settings.primaryColor);
  document.documentElement.style.setProperty("--app-primary-soft", `${settings.primaryColor}22`);
  document.documentElement.classList.toggle("app-dark", settings.theme === "dark");
  document.documentElement.classList.toggle("app-light", settings.theme === "light");
};

export const saveUserSettings = (settings: UserSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applyUserSettings(settings);
};
