import { Button, Checkbox, Divider, Drawer, Grid, Input, InputNumber, Layout, Typography } from "antd";
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { FiCheck } from "react-icons/fi";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const ELECTRICITY_TABLE = import.meta.env.VITE_SUPABASE_ELECTRICITY_CONSUMPTION_TABLE ?? "ElectricityConsumption";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
const METER_RESET_NOTE = "[Meter reset/replaced]";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type GrowInfo = {
  id: number | null;
  buildingId: number | null;
  buildingName: string;
  createdAt: string;
  status: string;
};

type ElectricityEntry = {
  id: number | null;
  date: string;
  day: number;
  meterReading: number | null;
  consumption: number | null;
  remarks: string;
};

type AppRole = "Admin" | "Supervisor" | "Staff" | null;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

const formatNumber = (value: number | null | undefined, fractionDigits = 0): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const isLoadingDay = (day: number): boolean => day === 0;
const displayDay = (day: number): number => day;
const displayDayLabel = (day: number): string => (isLoadingDay(day) ? "Loading Day" : `Day ${displayDay(day)}`);
const displayDayDetail = (day: number): string => (isLoadingDay(day) ? "Day 0 baseline" : `Day ${displayDay(day)}`);
const getPreviousMeterReading = (day: number, sourceEntries: ElectricityEntry[]): number | null => {
  return sourceEntries.find((entry) => entry.day === day - 1)?.meterReading ?? null;
};
const getCalculatedConsumption = (entry: ElectricityEntry, sourceEntries: ElectricityEntry[]): number | null => {
  if (isLoadingDay(entry.day)) return null;
  if (entry.consumption != null) return entry.consumption;
  const previousMeterReading = getPreviousMeterReading(entry.day, sourceEntries);
  if (entry.meterReading != null && previousMeterReading != null) {
    return Math.max(0, Number(entry.meterReading) - Number(previousMeterReading));
  }
  return null;
};
const hasMeterReadingDrop = (entry: ElectricityEntry, sourceEntries: ElectricityEntry[]): boolean => {
  const previousMeterReading = getPreviousMeterReading(entry.day, sourceEntries);
  return !isLoadingDay(entry.day) && entry.meterReading != null && previousMeterReading != null && entry.meterReading < previousMeterReading;
};
const hasMeterResetNote = (remarks: string): boolean => remarks.includes(METER_RESET_NOTE);
const setMeterResetNote = (remarks: string, checked: boolean): string => {
  const withoutNote = remarks.replace(METER_RESET_NOTE, "").replace(/\s{2,}/g, " ").trim();
  return checked ? [METER_RESET_NOTE, withoutNote].filter(Boolean).join(" ") : withoutNote;
};

export default function ElectricityConsumptionFormPage() {
  const navigate = useNavigate();
  const { growId, buildingId } = useParams();
  const { user } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [growInfo, setGrowInfo] = useState<GrowInfo | null>(null);
  const [entries, setEntries] = useState<ElectricityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [activeEntry, setActiveEntry] = useState<ElectricityEntry | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [userRole, setUserRole] = useState<AppRole>(null);

  const totalConsumption = useMemo(
    () => entries.reduce((sum, entry) => sum + (getCalculatedConsumption(entry, entries) ?? 0), 0),
    [entries]
  );
  const electricitySummary = useMemo(() => {
    const loggedEntries = entries.filter(
      (entry) => entry.id != null || entry.meterReading != null || entry.consumption != null || entry.remarks.trim()
    );
    const daysLogged = loggedEntries.length;
    const consumptionDays = loggedEntries.filter((entry) => !isLoadingDay(entry.day) && getCalculatedConsumption(entry, entries) != null);
    const averageKwh = consumptionDays.length > 0 ? totalConsumption / consumptionDays.length : 0;
    const latestEntry = [...loggedEntries]
      .filter((entry) => dayjs(entry.date).isValid())
      .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())[0];

    return {
      daysListed: entries.length,
      daysLogged,
      averageKwh,
      latestReading: latestEntry ? dayjs(latestEntry.date).format("MMM D, YYYY") : "No readings",
    };
  }, [entries, totalConsumption]);
  const hasResolvedGrow = growInfo?.id != null;
  const canEditExistingElectricityEntries = userRole === "Admin";

  useEffect(() => {
    let alive = true;

    const loadUserRole = async () => {
      if (!user?.id) {
        setUserRole(null);
        return;
      }

      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select("role, status")
        .eq("user_uuid", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.error("Failed to load electricity edit access:", error.message);
        setUserRole(null);
        return;
      }

      const role = data?.role === "Admin" || data?.role === "Supervisor" || data?.role === "Staff" ? data.role : null;
      setUserRole(data?.status === "Inactive" ? null : role);
    };

    void loadUserRole();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const parsedGrowId = Number(growId);
      const parsedBuildingId = Number(buildingId);
      const hasGrowParam = Number.isFinite(parsedGrowId);
      const hasBuildingParam = Number.isFinite(parsedBuildingId);

      if (!hasGrowParam && !hasBuildingParam) {
        setGrowInfo(null);
        setEntries([]);
        return;
      }

      try {
        setIsLoading(true);
        let growQuery = supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, status")
          .order("created_at", { ascending: false })
          .limit(1);

        if (hasGrowParam) {
          growQuery = growQuery.eq("id", parsedGrowId);
        } else {
          growQuery = growQuery.eq("building_id", parsedBuildingId);
        }

        const { data: growRows, error: growError } = await growQuery;

        if (!active) return;
        if (growError) throw growError;

        const growRow = ((growRows ?? []) as Array<{
          id: number | null;
          building_id: number | null;
          created_at: string | null;
          status: string | null;
        }>)[0] ?? null;

        const resolvedBuildingId =
          typeof growRow?.building_id === "number"
            ? growRow.building_id
            : hasBuildingParam
              ? parsedBuildingId
              : null;
        let buildingName = resolvedBuildingId == null ? "Unassigned" : `Building ${resolvedBuildingId}`;
        if (resolvedBuildingId != null) {
          const { data: buildingRow, error: buildingError } = await supabase
            .from(BUILDINGS_TABLE)
            .select("name")
            .eq("id", resolvedBuildingId)
            .maybeSingle();
          if (buildingError) throw buildingError;
          buildingName = typeof buildingRow?.name === "string" && buildingRow.name.trim() ? buildingRow.name : buildingName;
        }

        if (!growRow?.id) {
          setGrowInfo({
            id: null,
            buildingId: resolvedBuildingId,
            buildingName,
            createdAt: "",
            status: "Ready",
          });
          setEntries([]);
          return;
        }

        const resolvedGrowId = Number(growRow.id);
        const { data: savedRows, error: savedError } = await supabase
          .from(ELECTRICITY_TABLE)
          .select("id, date, day, remarks, meter_reading, consumption")
          .eq("grow_id", resolvedGrowId)
          .order("day", { ascending: true });

        if (!active) return;
        if (savedError) throw savedError;

        const createdAt = String(growRow.created_at ?? "");
        const startDate = dayjs(createdAt).startOf("day");
        const today = dayjs().startOf("day");
        const daysListed = Math.max(0, today.diff(startDate, "day")) + 1;
        const savedByDay = new Map<number, {
          id: number | null;
          date: string | null;
          day: number | null;
          remarks: string | null;
          meter_reading: number | null;
          consumption: number | null;
        }>();

        ((savedRows ?? []) as Array<{
          id: number | null;
          date: string | null;
          day: number | null;
          remarks: string | null;
          meter_reading: number | null;
          consumption: number | null;
        }>).forEach((row) => {
          if (row.day == null) return;
          savedByDay.set(Number(row.day), row);
        });

        setGrowInfo({
          id: resolvedGrowId,
          buildingId: resolvedBuildingId,
          buildingName,
          createdAt,
          status: String(growRow.status ?? "Unknown"),
        });
        setEntries(
          Array.from({ length: daysListed }, (_, day) => {
            const saved = savedByDay.get(day);
            return {
              id: saved?.id ?? null,
              date: String(saved?.date ?? startDate.add(day, "day").format("YYYY-MM-DD")),
              day,
              meterReading: toNumberOrNull(saved?.meter_reading),
              consumption: toNumberOrNull(saved?.consumption),
              remarks: String(saved?.remarks ?? ""),
            };
          })
        );
      } catch (error) {
        setToastMessage(`Failed to load electricity consumption: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [buildingId, growId]);

  const updateEntry = (day: number, patch: Partial<ElectricityEntry>) => {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.day !== day) return entry;
        const next = { ...entry, ...patch };
        if ("meterReading" in patch && !("consumption" in patch)) {
          const previous = current.find((item) => item.day === day - 1);
          if (isLoadingDay(day)) {
            next.consumption = null;
          } else if (patch.meterReading != null && previous?.meterReading != null) {
            next.consumption = Math.max(0, Number(patch.meterReading) - Number(previous.meterReading));
          }
        }
        return next;
      })
    );
  };

  const updateActiveEntry = (patch: Partial<ElectricityEntry>) => {
    setActiveEntry((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if ("meterReading" in patch && !("consumption" in patch)) {
        const previous = entries.find((item) => item.day === current.day - 1);
        if (isLoadingDay(current.day)) {
          next.consumption = null;
        } else if (patch.meterReading != null && previous?.meterReading != null) {
          next.consumption = Math.max(0, Number(patch.meterReading) - Number(previous.meterReading));
        }
      }
      return next;
    });
  };

  const handleSaveEntry = async (entry: ElectricityEntry) => {
    const resolvedGrowId = growInfo?.id;
    if (resolvedGrowId == null || !Number.isFinite(resolvedGrowId)) return;
    if (entry.id && !canEditExistingElectricityEntries) {
      setToastMessage("Only Admin users can edit electricity readings.");
      setIsToastOpen(true);
      return;
    }

    try {
      setSavingDay(entry.day);
      const draftEntries = entries.map((current) => (current.day === entry.day ? entry : current));
      const calculatedConsumption = getCalculatedConsumption(entry, draftEntries);
      const payload = {
        grow_id: resolvedGrowId,
        date: entry.date,
        day: entry.day,
        meter_reading: entry.meterReading,
        consumption: calculatedConsumption,
        remarks: entry.remarks.trim() || null,
      };

      const { data, error } = entry.id
        ? await supabase.from(ELECTRICITY_TABLE).update(payload).eq("id", entry.id).select("id").single()
        : await supabase.from(ELECTRICITY_TABLE).insert([payload]).select("id").single();

      if (error) throw error;
      if (data?.id) updateEntry(entry.day, { id: Number(data.id) });
      updateEntry(entry.day, {
        id: data?.id ? Number(data.id) : entry.id,
        meterReading: entry.meterReading,
        consumption: calculatedConsumption,
        remarks: entry.remarks,
      });
      setActiveEntry(null);
      setToastMessage(`Saved electricity consumption for ${displayDayLabel(entry.day)}.`);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Save failed: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setSavingDay(null);
    }
  };

  const handleExportPdf = () => {
    if (!growInfo || entries.length === 0) {
      setToastMessage("No electricity history data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const generatedAt = dayjs();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Daily Electricity Consumption Monitoring - Broiler Farm", 14, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Building: ${growInfo.buildingName}`, 14, 24);
      doc.text(`Active Grow: ${growInfo.id == null ? "-" : `#${growInfo.id}`} (${growInfo.status})`, 14, 30);
      doc.text(`Started: ${dayjs(growInfo.createdAt).format("MMMM D, YYYY")}`, 14, 36);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 42);
      doc.text(`Days Logged: ${electricitySummary.daysLogged.toLocaleString()}`, 126, 24);
      doc.text(`Total kWh: ${formatNumber(totalConsumption, 2)}`, 126, 30);
      doc.text(`Average kWh/Day: ${formatNumber(electricitySummary.averageKwh, 2)}`, 126, 36);
      doc.text(`Latest Reading: ${electricitySummary.latestReading}`, 126, 42);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.6);
      doc.line(14, 47, 196, 47);

      autoTable(doc, {
        startY: 53,
        theme: "grid",
        head: [["Date", "Day No", "Time", "Previous / Start", "Current / End", "Electricity Consumption", "Remarks"]],
        body: entries.map((entry) => {
          const previousMeterReading = getPreviousMeterReading(entry.day, entries);
          const calculatedConsumption = getCalculatedConsumption(entry, entries);
          return [
            dayjs(entry.date).format("M/D/YYYY"),
            isLoadingDay(entry.day) ? "LOADING" : `DAY ${displayDay(entry.day)}`,
            "-",
            isLoadingDay(entry.day) ? "-" : formatNumber(previousMeterReading, 2),
            formatNumber(entry.meterReading, 2),
            isLoadingDay(entry.day) ? "-" : formatNumber(calculatedConsumption, 2),
            entry.remarks.trim() || "-",
          ];
        }),
        headStyles: {
          fillColor: [0, 136, 34],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [210, 210, 210],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 23 },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 26, halign: "right" },
          4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 32, halign: "right" },
          6: { cellWidth: 35 },
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(`Page ${data.pageNumber}`, 196, 287, { align: "right" });
        },
      });

      const pdfUrl = doc.output("bloburl");
      const pdfWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!pdfWindow) {
        setToastMessage("Unable to open PDF preview. Please allow pop-ups and try again.");
        setIsToastOpen(true);
        return;
      }

      setToastMessage("PDF preview opened.");
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to export PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className="!px-3 !h-auto !min-h-14 sticky top-0 z-40 flex items-center justify-between"
        style={{
          backgroundColor: BRAND,
          paddingTop: mobileSafeAreaTop,
          height: `calc(56px + ${mobileSafeAreaTop})`,
        }}
      >
        <div className="flex items-center gap-2">
          <Button type="text" icon={<IoMdArrowRoundBack size={20} />} className="!text-white hover:!text-white/90" onClick={() => navigate(-1)} aria-label="Back" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button type="text" icon={<IoHome size={18} />} className="!text-white hover:!text-white/90" onClick={() => navigate("/landing-page")} aria-label="Home" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className="!m-0 !text-base !text-white">Electricity History</Title>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={21} />}
            className="!text-white hover:!text-white/90"
            onClick={handleExportPdf}
            aria-label="Export PDF"
            loading={isExportingPdf}
          />
          <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={() => void signOutAndRedirect(navigate)} aria-label="Sign out" />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-5xl">
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-white px-4 py-4 shadow-sm md:mb-5 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Electricity History
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
                  Electricity History - {growInfo?.buildingName ?? "Building"}
                </div>
              </div>
              <Button
                className="!rounded-lg !border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!border-emerald-300 hover:!bg-emerald-100"
                onClick={() => navigate("/reports/electricity-consumption")}
              >
                Report
              </Button>
            </div>
            <div className="mt-1 text-xs text-slate-500 md:text-sm">
              {growInfo
                ? hasResolvedGrow
                  ? `Active Grow ${growInfo.id == null ? "-" : `#${growInfo.id}`} | Started ${dayjs(growInfo.createdAt).format("MMMM D, YYYY")}`
                  : "No active grow record found for this building."
                : isLoading
                  ? "Loading grow details..."
                  : "Grow record not found."}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Total kWh</div>
                <div className="mt-1 text-lg font-bold leading-none text-slate-900">{formatNumber(totalConsumption, 2)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Avg kWh / Day</div>
                <div className="mt-1 text-lg font-bold leading-none text-slate-900">{formatNumber(electricitySummary.averageKwh, 2)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Latest Reading</div>
                <div className="mt-1 text-sm font-bold leading-tight text-slate-900">{electricitySummary.latestReading}</div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-700">Days Logged</div>
                <div className="mt-1 text-lg font-bold leading-none text-slate-900">{electricitySummary.daysLogged.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {!isLoading && entries.length === 0 ? (
              <div className="rounded-sm border border-emerald-100 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
                {growInfo ? `No readings have been saved yet for ${growInfo.buildingName}.` : "No electricity history is available yet."}
              </div>
            ) : null}
            {entries.map((entry) => {
              const previousMeterReading = getPreviousMeterReading(entry.day, entries);
              const calculatedConsumption = getCalculatedConsumption(entry, entries);
              const meterReadingDropped = hasMeterReadingDrop(entry, entries);
              const meterResetNoted = hasMeterResetNote(entry.remarks);
              return (
                <button
                  key={entry.day}
                  type="button"
                  className="w-full rounded-sm border border-emerald-100 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                  onClick={() => {
                    if (entry.id && !canEditExistingElectricityEntries) {
                      setToastMessage("Only Admin users can edit saved electricity readings.");
                      setIsToastOpen(true);
                      return;
                    }
                    setActiveEntry(entry);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />
                        <div className="text-sm font-semibold text-slate-900">{displayDayLabel(entry.day)}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{dayjs(entry.date).format("MMMM D, YYYY")}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {displayDayDetail(entry.day)} | Active Grow {growInfo?.id == null ? "-" : `#${growInfo.id}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Consumption</div>
                      <div className="text-2xl font-bold leading-none text-slate-900">{formatNumber(calculatedConsumption, 2)}</div>
                      <div className="mt-1 text-[10px] text-slate-400">kWh</div>
                    </div>
                  </div>
                  {isLoadingDay(entry.day) ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Baseline Reading: {formatNumber(entry.meterReading, 2)}
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span>Previous: {formatNumber(previousMeterReading, 2)}</span>
                      <span>Current: {formatNumber(entry.meterReading, 2)}</span>
                    </div>
                  )}
                  {meterReadingDropped ? (
                    <div className={[
                      "mt-2 rounded-md border px-2.5 py-2 text-[11px] font-medium",
                      meterResetNoted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
                    ].join(" ")}>
                      {meterResetNoted
                        ? "Meter reset/replaced noted. Manual consumption can be used for this day."
                        : "Current reading is lower than previous. Check the meter reading or mark meter reset/replaced."}
                    </div>
                  ) : null}
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="line-clamp-2 text-slate-500">Remarks: {entry.remarks.trim() || "-"}</span>
                    <span className="shrink-0 font-medium text-emerald-700">
                      {entry.id ? (canEditExistingElectricityEntries ? "Tap to edit" : "Saved") : "Tap to add reading"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Content>

      <Drawer
        open={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "62%" : undefined}
        width={isMobile ? undefined : 420}
        className="electricity-consumption-drawer"
        bodyStyle={{ padding: 16, backgroundColor: "#f8fafc" }}
      >
        {activeEntry ? (() => {
          const activeEntries = entries.map((entry) => (entry.day === activeEntry.day ? activeEntry : entry));
          const activePreviousMeterReading = getPreviousMeterReading(activeEntry.day, activeEntries);
          const activeConsumption = getCalculatedConsumption(activeEntry, activeEntries);
          const activeMeterReadingDropped = hasMeterReadingDrop(activeEntry, activeEntries);
          const activeMeterResetNoted = hasMeterResetNote(activeEntry.remarks);
          return (
          <div>
            <div className="rounded-sm border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {growInfo?.buildingName ?? "Grow"}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">{displayDayLabel(activeEntry.day)}</div>
              <div className="mt-1 text-xs text-slate-500">{dayjs(activeEntry.date).format("MMMM D, YYYY")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                    {isLoadingDay(activeEntry.day) ? "Start" : "Previous"}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {isLoadingDay(activeEntry.day) ? "-" : formatNumber(activePreviousMeterReading, 2)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                    {isLoadingDay(activeEntry.day) ? "Baseline" : "Current"}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">{formatNumber(activeEntry.meterReading, 2)}</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Consumption</div>
                <div className="text-2xl font-bold leading-none text-slate-900">{formatNumber(activeConsumption, 2)}</div>
                <div className="mt-1 text-[10px] text-slate-400">kWh</div>
              </div>
              {activeMeterReadingDropped ? (
                <div className={[
                  "mt-3 rounded-md border px-3 py-2 text-xs font-medium",
                  activeMeterResetNoted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
                ].join(" ")}>
                  {activeMeterResetNoted
                    ? "Meter reset/replaced noted. Manual consumption can be used for this day."
                    : "Current reading is lower than previous. Check the meter reading or mark meter reset/replaced."}
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-sm border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="mb-1 text-[11px] font-medium text-slate-500">
                {isLoadingDay(activeEntry.day) ? "Baseline Meter Reading" : "Current Meter Reading"}
              </div>
              <InputNumber
                min={0}
                value={activeEntry.meterReading}
                onChange={(value) => updateActiveEntry({ meterReading: toNumberOrNull(value) })}
                className="!w-full"
                controls={false}
                placeholder="0"
                styles={{ input: { fontSize: 16 } }}
              />

              <div className="mb-1 mt-3 text-[11px] font-medium text-slate-500">
                {isLoadingDay(activeEntry.day) ? "Consumption" : "Calculated Consumption"}
              </div>
              <InputNumber
                min={0}
                value={activeConsumption}
                onChange={(value) => updateActiveEntry({ consumption: toNumberOrNull(value) })}
                className="!w-full"
                controls={false}
                placeholder="0"
                disabled={isLoadingDay(activeEntry.day)}
                styles={{ input: { fontSize: 16 } }}
              />

              {!isLoadingDay(activeEntry.day) && activeMeterReadingDropped ? (
                <Checkbox
                  className="mt-3 !text-sm !text-slate-700"
                  checked={activeMeterResetNoted}
                  onChange={(event) => updateActiveEntry({ remarks: setMeterResetNote(activeEntry.remarks, event.target.checked) })}
                >
                  Meter reset / replaced
                </Checkbox>
              ) : null}

              <div className="mb-1 mt-3 text-[11px] font-medium text-slate-500">Remarks</div>
              <Input.TextArea
                rows={3}
                value={activeEntry.remarks}
                onChange={(event) => updateActiveEntry({ remarks: event.target.value })}
                placeholder="Optional"
                className="!text-base"
              />

              <Button
                type="primary"
                icon={<FiCheck size={14} />}
                className="mt-4 !h-11 !w-full !rounded-lg !bg-emerald-700 !font-semibold hover:!bg-emerald-600"
                loading={savingDay === activeEntry.day}
                disabled={savingDay !== null}
                onClick={() => void handleSaveEntry(activeEntry)}
              >
                Save
              </Button>
            </div>
          </div>
          );
        })() : null}
      </Drawer>

      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
