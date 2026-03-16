const UPDATE_EVENT = "pwa-update-state";

let hasRegisteredControllerChange = false;
let isReloadingForUpdate = false;
let activeRegistration = null;
let clearMessageTimeout = null;

function clearPendingMessageReset() {
  if (clearMessageTimeout != null) {
    window.clearTimeout(clearMessageTimeout);
    clearMessageTimeout = null;
  }
}

function dispatchUpdateState(detail) {
  clearPendingMessageReset();
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail }));
}

function dispatchTemporaryState(detail, timeoutMs = 2500) {
  dispatchUpdateState(detail);
  clearMessageTimeout = window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent(UPDATE_EVENT, {
        detail: { status: "idle", message: "" },
      })
    );
    clearMessageTimeout = null;
  }, timeoutMs);
}

function forceRefreshToLatestBuild() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("refresh", String(Date.now()));
  window.location.replace(nextUrl.toString());
}

function promptWaitingWorker(worker) {
  if (!worker) return;
  dispatchUpdateState({
    status: "updating",
    message: "A new version is ready. Updating now...",
  });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function trackInstallingWorker(worker) {
  if (!worker) return;

  dispatchUpdateState({
    status: "updating",
    message: "Downloading the latest version...",
  });

  worker.addEventListener("statechange", () => {
    if (worker.state === "installed") {
      promptWaitingWorker(worker);
    }
  });
}

function attachControllerChangeReload() {
  if (hasRegisteredControllerChange) return;
  hasRegisteredControllerChange = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isReloadingForUpdate) return;
    isReloadingForUpdate = true;

    dispatchUpdateState({
      status: "reloading",
      message: "Update installed. Reloading...",
    });

    window.location.reload();
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      activeRegistration = registration;
      attachControllerChangeReload();

      if (registration.waiting) {
        promptWaitingWorker(registration.waiting);
      }

      if (registration.installing) {
        trackInstallingWorker(registration.installing);
      }

      registration.addEventListener("updatefound", () => {
        trackInstallingWorker(registration.installing);
      });

      const requestUpdateCheck = () => {
        void checkForAppUpdate();
      };

      window.addEventListener("focus", requestUpdateCheck);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          requestUpdateCheck();
        }
      });

      window.setInterval(requestUpdateCheck, 5 * 60 * 1000);
    } catch (error) {
      console.error("Service worker registration failed:", error);
      dispatchUpdateState({
        status: "error",
        message: "App update setup failed.",
      });
    }
  });
}

export async function checkForAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    dispatchUpdateState({
      status: "reloading",
      message: "Refreshing to check for the latest version...",
    });
    window.setTimeout(() => {
      forceRefreshToLatestBuild();
    }, 500);
    return true;
  }

  try {
    const registration = activeRegistration ?? (await navigator.serviceWorker.getRegistration());
    if (!registration) {
      dispatchTemporaryState({
        status: "error",
        message: "Update service is not ready yet.",
      });
      return false;
    }

    activeRegistration = registration;

    dispatchUpdateState({
      status: "updating",
      message: "Syncing and checking for updates... Please reopen the app after the update is installed.",
    });

    if (registration.waiting) {
      promptWaitingWorker(registration.waiting);
      return true;
    }

    await registration.update();

    if (registration.waiting) {
      promptWaitingWorker(registration.waiting);
      return true;
    }

    dispatchTemporaryState({
      status: "success",
      message: "You already have the latest version.",
    });
    return false;
  } catch (error) {
    console.error("Failed to check for updates:", error);
    dispatchTemporaryState({
      status: "error",
      message: "Unable to sync updates right now.",
    });
    return false;
  }
}

export { UPDATE_EVENT };
