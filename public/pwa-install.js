// Loaded before the application bundle so installation events cannot be lost
// while signing in, navigating, or downloading the React application.
(function initializeInstallManager() {
  if (window.gpmInstall) return;

  const displayMode = window.matchMedia(
    "(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)"
  );
  const listeners = new Set();
  let deferredPrompt = null;
  let prompting = false;
  let installed = displayMode.matches || navigator.standalone === true;
  const userAgent = navigator.userAgent || "";
  const platform = /iphone|ipad|ipod/i.test(userAgent) ||
    (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1)
    ? "ios" : /android/i.test(userAgent) ? "android" : "desktop";
  const isEmbedded = /FBAN|FBAV|Instagram|; wv\)|\bLine\//i.test(userAgent);

  function snapshot() {
    return Object.freeze({
      canInstall: !!deferredPrompt && !installed && !prompting && window.isSecureContext === true,
      isInstalled: installed,
      isPrompting: prompting,
      isSecureContext: window.isSecureContext === true,
      platform,
      isEmbedded,
    });
  }

  let state = snapshot();
  function publish() {
    state = snapshot();
    listeners.forEach((listener) => listener());
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    if (installed) return;
    event.preventDefault();
    deferredPrompt = event;
    publish();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    publish();
  });

  const updateDisplayMode = () => {
    installed = installed || displayMode.matches || navigator.standalone === true;
    if (installed) deferredPrompt = null;
    publish();
  };
  if (typeof displayMode.addEventListener === "function") {
    displayMode.addEventListener("change", updateDisplayMode);
  } else if (typeof displayMode.addListener === "function") {
    displayMode.addListener(updateDisplayMode);
  }

  window.gpmInstall = Object.freeze({
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async install() {
      if (!deferredPrompt || installed || prompting || !window.isSecureContext) {
        return { outcome: "unavailable" };
      }
      const prompt = deferredPrompt;
      // An event can only be used once. Clear before awaiting so that a fresh
      // browser event arriving during this attempt is preserved for the next one.
      deferredPrompt = null;
      prompting = true;
      publish();
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        return { outcome: choice.outcome };
      } catch {
        return { outcome: "error" };
      } finally {
        prompting = false;
        publish();
      }
    },
  });
})();
