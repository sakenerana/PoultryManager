import React, { useEffect } from "react";
import { CheckCircleFilled, InfoCircleFilled, WarningFilled, CloseCircleFilled } from "@ant-design/icons";

type NotificationType = "success" | "info" | "warning" | "error";

type NotificationToastProps = {
  open: boolean;
  message: string;
  type?: NotificationType;
  durationMs?: number;
  onClose: () => void;
};

export default function NotificationToast({
  open,
  message,
  type = "success",
  durationMs = 2500,
  onClose,
}: NotificationToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const styles: Record<
    NotificationType,
    { icon: React.ReactNode; iconBg: string; accent: string; title: string }
  > = {
    success: {
      icon: <CheckCircleFilled />,
      iconBg: "bg-emerald-500",
      accent: "bg-emerald-500",
      title: "Success",
    },
    info: {
      icon: <InfoCircleFilled />,
      iconBg: "bg-blue-500",
      accent: "bg-blue-500",
      title: "Info",
    },
    warning: {
      icon: <WarningFilled />,
      iconBg: "bg-amber-500",
      accent: "bg-amber-500",
      title: "Warning",
    },
    error: {
      icon: <CloseCircleFilled />,
      iconBg: "bg-red-500",
      accent: "bg-red-500",
      title: "Error",
    },
  };
  const theme = styles[type];

  return (
    <div className="fixed top-14 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 px-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className={["mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white", theme.iconBg].join(" ")}>
            {theme.icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{theme.title}</div>
            <div className="mt-0.5 break-words text-sm font-medium leading-5 text-slate-800">{message}</div>
          </div>
        </div>
        <div className={["h-1 w-full", theme.accent].join(" ")} />
      </div>
    </div>
  );
}
