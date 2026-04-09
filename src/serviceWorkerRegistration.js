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

function dispatchReadyState() {
  dispatchUpdateState({
    status: "ready",
    message: "A new version is available.",
  });
}

function activateWaitingWorker(worker) {
  if (!worker) return;
  dispatchUpdateState({
    status: "updating",
    message: "A new version is ready. Updating now...",
  });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function waitForInstallingWorker(worker) {
  if (!worker) return;

  return new Promise((resolve) => {
    const handleStateChange = () => {
      if (worker.state === "installed" || worker.state === "redundant") {
        worker.removeEventListener("statechange", handleStateChange);
        resolve(worker.state);
      }
    };

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
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
    } catch (error) {
      console.error("Service worker registration failed:", error);
      dispatchUpdateState({
        status: "error",
        message: "App update setup failed.",
      });
    }
  });
}

export async function checkForAppUpdate(options = {}) {
  const isSilent = options.silent === true;
  if (!("serviceWorker" in navigator)) {
    if (!isSilent) {
      dispatchUpdateState({
        status: "reloading",
        message: "Refreshing to check for the latest version...",
      });
      window.setTimeout(() => {
        forceRefreshToLatestBuild();
      }, 500);
      return true;
    }
    return false;
  }

  try {
    const registration = activeRegistration ?? (await navigator.serviceWorker.getRegistration());
    if (!registration) {
      if (!isSilent) {
        dispatchTemporaryState({
          status: "error",
          message: "Update service is not ready yet.",
        });
      }
      return false;
    }

    activeRegistration = registration;

    if (!isSilent) {
      dispatchUpdateState({
        status: "updating",
        message: "Checking for updates...",
      });
    }

    if (registration.waiting) {
      dispatchReadyState();
      return true;
    }

    await registration.update();

    if (registration.installing) {
      if (!isSilent) {
        dispatchUpdateState({
          status: "updating",
          message: "Downloading the latest version...",
        });
      }

      await waitForInstallingWorker(registration.installing);
    }

    if (registration.waiting) {
      dispatchReadyState();
      return true;
    }

    if (!isSilent) {
      dispatchTemporaryState({
        status: "success",
        message: "You already have the latest version.",
      });
    }
    return false;
  } catch (error) {
    console.error("Failed to check for updates:", error);
    if (!isSilent) {
      dispatchTemporaryState({
        status: "error",
        message: "Unable to sync updates right now.",
      });
    }
    return false;
  }
}

export async function applyAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    forceRefreshToLatestBuild();
    return false;
  }

  const registration = activeRegistration ?? (await navigator.serviceWorker.getRegistration());
  if (!registration?.waiting) {
    dispatchTemporaryState({
      status: "success",
      message: "You already have the latest version.",
    });
    return false;
  }

  activeRegistration = registration;
  activateWaitingWorker(registration.waiting);
  return true;
}

export { UPDATE_EVENT };
