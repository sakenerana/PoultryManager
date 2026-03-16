import { useEffect, useState } from "react";
import { applyAppUpdate, UPDATE_EVENT } from "../serviceWorkerRegistration";

type UpdateStatus = "idle" | "ready" | "updating" | "reloading" | "error" | "success";

type UpdateState = {
  status: UpdateStatus;
  message: string;
};

const initialState: UpdateState = {
  status: "idle",
  message: "",
};

export default function AppUpdateIndicator() {
  const [updateState, setUpdateState] = useState<UpdateState>(initialState);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  useEffect(() => {
    const handleUpdateState = (event: Event) => {
      const customEvent = event as CustomEvent<UpdateState>;
      setUpdateState(customEvent.detail ?? initialState);
    };

    window.addEventListener(UPDATE_EVENT, handleUpdateState);
    return () => window.removeEventListener(UPDATE_EVENT, handleUpdateState);
  }, []);

  if (updateState.status === "idle" || !updateState.message) {
    return null;
  }

  const isError = updateState.status === "error";
  const isSuccess = updateState.status === "success";
  const isReady = updateState.status === "ready";

  const handleApplyUpdate = async () => {
    if (isApplyingUpdate) return;
    try {
      setIsApplyingUpdate(true);
      await applyAppUpdate();
    } finally {
      setIsApplyingUpdate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-6">
      <div
        className={[
          "w-full max-w-sm rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md",
          "flex flex-col items-center justify-center text-center gap-3",
          isError
            ? "bg-red-600/95 text-white"
            : isSuccess
              ? "bg-emerald-600/95 text-white"
              : isReady
                ? "bg-white text-slate-900"
                : "bg-slate-900/92 text-white",
        ].join(" ")}
      >
        {!isError && !isSuccess && !isReady && (
          <span
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
            aria-hidden="true"
          />
        )}
        {isReady && (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700" aria-hidden="true">
            Up
          </span>
        )}
        {isSuccess && (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-bold" aria-hidden="true">
            OK
          </span>
        )}
        {isError && (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-bold" aria-hidden="true">
            !
          </span>
        )}
        <div className="text-base font-semibold">{updateState.message}</div>
        {isReady && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={isApplyingUpdate}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {isApplyingUpdate ? "Updating..." : "Update now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
