export const UPDATE_EVENT: string;
export function registerServiceWorker(): void;
export function checkForAppUpdate(): Promise<boolean>;
export function applyAppUpdate(): Promise<boolean>;
