import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid } from "antd";
import { MinusCircleFilled, PlusCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { loadBodyWeightLogsByBuildingId } from "../controller/bodyWeightCrud";
import { loadGrowLogsByGrowId, loadGrowReductionTransactionsByGrowId } from "../controller/growLogsCrud";
import { resolveBodyWeightAverage } from "../utils/bodyWeight";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

dayjs.extend(utc);

const PRIMARY = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";

type MetricKey = "mortality" | "thinning" | "takeOut";

type HistoryRow = {
  date: string;
  dayNumber: number;
  value: number;
  avgWeight: number | null;
  expectedDailyDeaths: number | null;
  sourceTime: string | null;
};

const METRIC_META: Record<MetricKey, { title: string; accent: string }> = {
  mortality: { title: "Mortality", accent: "bg-red-500" },
  thinning: { title: "Thinning", accent: "bg-slate-400" },
  takeOut: { title: "Take Out", accent: "bg-amber-500" },
};

const METRIC_TABS: Array<{ key: MetricKey; label: string; activeBg: string; activeText: string; icon: "plus" | "minus" }> = [
  { key: "mortality", label: "Mortality", activeBg: "#ffa600", activeText: "#ffffff", icon: "minus" },
  { key: "thinning", label: "Thinning", activeBg: "#008822", activeText: "#ffffff", icon: "minus" },
  { key: "takeOut", label: "Take Out", activeBg: "#f59e0b", activeText: "#ffffff", icon: "plus" },
];

const EXPECTED_DAILY_DEATHS: Record<number, number> = {
  1: 150,
  2: 160,
  3: 170,
  4: 180,
  5: 190,
  6: 180,
  7: 160,
  8: 120,
  9: 110,
  10: 100,
  11: 95,
  12: 90,
  13: 85,
  14: 80,
  15: 75,
  16: 70,
  17: 65,
  18: 60,
  19: 55,
  20: 50,
  21: 45,
  22: 40,
  23: 38,
  24: 36,
  25: 34,
  26: 32,
  27: 30,
  28: 28,
  29: 25,
  30: 22,
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("error_description" in error && typeof error.error_description === "string") {
      return error.error_description;
    }
  }
  return "Unknown error";
};

function ChickenState({
  title,
  subtitle,
  fullScreen,
}: {
  title: string;
  subtitle: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center text-center",
        fullScreen ? "min-h-[calc(100vh-90px)]" : "py-8",
      ].join(" ")}
    >
      <img
        src="/img/happyrun.gif"
        alt="Chicken loading"
        className="h-24 w-24 object-cover rounded-full"
        onError={(e) => {
          const target = e.currentTarget;
          target.onerror = null;
          target.src = "/img/chicken-bird.svg";
        }}
      />
      <div className="mt-3 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

const toMetricKey = (value: string | undefined): MetricKey => {
  if (value === "mortality" || value === "thinning" || value === "takeOut") {
    return value;
  }
  return "mortality";
};

const toNonNegativeInt = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

const toReductionType = (metricKey: MetricKey): "mortality" | "thinning" | "take_out" => {
  if (metricKey === "takeOut") return "take_out";
  return metricKey;
};

export default function BuildingMetricHistoryPage() {
  const navigate = useNavigate();
  const { id, metric } = useParams();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const metricKey = toMetricKey(metric);
  const selectedDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [totalBirdsLoaded, setTotalBirdsLoaded] = useState(0);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId)) {
        setHistoryRows([]);
        setBuildingName("");
        setTotalBirdsLoaded(0);
        return;
      }

      try {
        setIsLoading(true);
        const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

        const [{ data: buildingData, error: buildingError }, { data: growRows, error: growsError }] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("name").eq("id", buildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id, created_at, total_animals")
            .eq("building_id", buildingId)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (buildingError) throw buildingError;
        if (growsError) throw growsError;

        setBuildingName(typeof buildingData?.name === "string" ? buildingData.name : "");

        const growRow = ((growRows ?? []) as Array<{ id: number | null; created_at: string; total_animals: number | null }>)[0];
        if (!growRow?.id) {
          setHistoryRows([]);
          setTotalBirdsLoaded(0);
          return;
        }
        setTotalBirdsLoaded(toNonNegativeInt(growRow.total_animals));

        const [growLogs, reductionTransactions, bodyWeightLogs] = await Promise.all([
          loadGrowLogsByGrowId(growRow.id),
          loadGrowReductionTransactionsByGrowId(growRow.id),
          loadBodyWeightLogsByBuildingId(buildingId),
        ]);
        const logsUntilSelectedDate = growLogs.filter((row) => dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf());
        const logsByDate = logsUntilSelectedDate.reduce<Record<string, typeof growLogs>>((acc, row) => {
          const dateKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(row);
          return acc;
        }, {});
        const reductionTransactionsUntilSelectedDate = reductionTransactions.filter(
          (row) => dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
        );
        const reductionTransactionsByDate = reductionTransactionsUntilSelectedDate.reduce<
          Record<string, typeof reductionTransactions>
        >((acc, row) => {
          const dateKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(row);
          return acc;
        }, {});
        const bodyWeightLogsUntilSelectedDate = bodyWeightLogs.filter(
          (row) =>
            row.growId === growRow.id &&
            dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
        );
        const bodyWeightLogsByDate = bodyWeightLogsUntilSelectedDate.reduce<Record<string, typeof bodyWeightLogs>>((acc, row) => {
          const dateKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(row);
          return acc;
        }, {});

        const startDate = dayjs.utc(growRow.created_at).startOf("day");
        const endDate = dayjs.utc(selectedDate, "YYYY-MM-DD").startOf("day");
        const nextRows: HistoryRow[] = [];

        for (
          let cursor = startDate.add(1, "day");
          cursor.isBefore(endDate) || cursor.isSame(endDate, "day");
          cursor = cursor.add(1, "day")
        ) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const dayRows = [...(logsByDate[dateKey] ?? [])].sort(
            (a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf()
          );
          const latestRow = dayRows[0] ?? null;
          const dayReductionRows = [...(reductionTransactionsByDate[dateKey] ?? [])]
            .filter((row) => row.reductionType === toReductionType(metricKey))
            .sort((a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf());

          const latestByCage: Record<string, { mortality: number; thinning: number; takeOut: number }> = {};
          dayRows.forEach((row) => {
            if (row.subbuildingId == null) return;
            const cageId = String(row.subbuildingId);
            if (latestByCage[cageId]) return;
            latestByCage[cageId] = {
              mortality: toNonNegativeInt(row.mortality),
              thinning: toNonNegativeInt(row.thinning),
              takeOut: toNonNegativeInt(row.takeOut),
            };
          });

          const latestReductionByCage: Record<string, number> = {};
          dayReductionRows.forEach((row) => {
            if (row.subbuildingId == null) return;
            const cageId = String(row.subbuildingId);
            if (latestReductionByCage[cageId] != null) return;
            latestReductionByCage[cageId] = toNonNegativeInt(row.animalCount);
          });

          const value =
            Object.keys(latestReductionByCage).length > 0
              ? Object.values(latestReductionByCage).reduce((sum, current) => sum + current, 0)
              : Object.keys(latestByCage).length > 0
              ? Object.values(latestByCage).reduce((sum, row) => sum + row[metricKey], 0)
              : toNonNegativeInt(latestRow?.[metricKey] ?? 0);
          const dayWeightRows = [...(bodyWeightLogsByDate[dateKey] ?? [])].sort(
            (a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf()
          );
          const latestWeightByCage: Record<string, number> = {};

          dayWeightRows.forEach((row) => {
            if (row.subbuildingId == null) return;
            const cageId = String(row.subbuildingId);
            if (latestWeightByCage[cageId] != null) return;
            const avgWeight = resolveBodyWeightAverage(row);
            if (avgWeight == null) return;
            latestWeightByCage[cageId] = avgWeight;
          });

          const avgWeightValues = Object.values(latestWeightByCage).filter((weight) => weight > 0);
          const avgWeight =
            avgWeightValues.length > 0
              ? avgWeightValues.reduce((sum, current) => sum + current, 0) / avgWeightValues.length
              : null;

          nextRows.push({
            date: dateKey,
            dayNumber: cursor.diff(startDate, "day"),
            value,
            avgWeight,
            expectedDailyDeaths: EXPECTED_DAILY_DEATHS[cursor.diff(startDate, "day")] ?? null,
            sourceTime: dayReductionRows[0]?.createdAt ?? latestRow?.createdAt ?? null,
          });
        }

        setHistoryRows(nextRows);
      } catch (error) {
        setHistoryRows([]);
        setToastMessage(`Failed to load ${METRIC_META[metricKey].title.toLowerCase()} history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistory();
  }, [id, metricKey, selectedDate]);

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handlePdfClick = () => {
    if (historyRows.length === 0) {
      setToastMessage("No history data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      let runningMortality = 0;

      const generatedAt = dayjs();
      const fileMetricName = METRIC_META[metricKey].title.toLowerCase().replace(/\s+/g, "-");
      const fileBuildingName = (buildingName || `building-${id ?? "unknown"}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const fileName = `${fileBuildingName}_${fileMetricName}_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const reportTitle = `${METRIC_META[metricKey].title} History`;
      const reportBuildingName = buildingName || `Building ${id}`;
      const selectedDateLabel = dayjs(selectedDate).format("MMMM D, YYYY");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(reportTitle, 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(reportBuildingName, 14, 26);
      doc.text(`Selected Date: ${selectedDateLabel}`, 14, 32);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 38);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.7);
      doc.line(14, 42, 196, 42);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Summary", 14, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`Days Listed: ${historyRows.length}`, 14, 57);
      doc.text(`Total ${METRIC_META[metricKey].title}: ${totalValue.toLocaleString()}`, 72, 57);
      doc.text(`Total Birds Loaded: ${totalBirdsLoaded.toLocaleString()}`, 14, 63);
      doc.text(
        `Avg Weight: ${
          totalAvgWeight != null
            ? `${totalAvgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} kg`
            : "-"
        }`,
        72,
        63
      );

      autoTable(doc, {
        startY: 70,
        theme: "grid",
        headStyles: {
          fillColor: [0, 136, 34],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 34 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 24 },
          5: { cellWidth: 30 },
          6: { cellWidth: 28 },
        },
        head: [[
          "Day",
          "Date",
          ...(metricKey === "mortality" ? ["Expected Deaths"] : []),
          METRIC_META[metricKey].title,
          ...(metricKey === "mortality" ? ["Birds Alive"] : []),
          "Avg Wt",
          "Status",
        ]],
        body: historyRows.map((row) => {
          if (metricKey === "mortality") {
            runningMortality += row.value;
          }
          const birdsAlive = Math.max(0, totalBirdsLoaded - runningMortality);

          return [
            String(row.dayNumber),
            dayjs(row.date).format("MMM D, YYYY"),
            ...(metricKey === "mortality"
              ? [row.expectedDailyDeaths != null ? row.expectedDailyDeaths.toLocaleString() : "-"]
              : []),
            row.value.toLocaleString(),
            ...(metricKey === "mortality" ? [birdsAlive.toLocaleString()] : []),
            row.avgWeight != null
              ? `${row.avgWeight.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} kg`
              : "-",
            row.sourceTime ? "Recorded" : "No log for this date",
          ];
        }),
        foot: [[
          "",
          "Total",
          ...(metricKey === "mortality" ? [""] : []),
          totalValue.toLocaleString(),
          ...(metricKey === "mortality" ? [Math.max(0, totalBirdsLoaded - totalValue).toLocaleString()] : []),
          totalAvgWeight != null
            ? `${totalAvgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} kg`
            : "-",
          `Up to ${selectedDateLabel}`,
        ]],
        footStyles: {
          fillColor: [239, 239, 239],
          textColor: [15, 23, 42],
          fontStyle: "bold",
        },
        didDrawPage: (data) => {
          doc.setFontSize(9);
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

      setToastMessage(`PDF preview opened: ${fileName}`);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to generate PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const handleMetricTabChange = (nextMetric: MetricKey) => {
    if (!id || nextMetric === metricKey) return;
    navigate(`/building-metric-history/${id}/${nextMetric}?date=${selectedDate}`);
  };

  const handleHistoryRowClick = (date: string) => {
    if (!id) return;
    navigate(`/building-cage/${id}?date=${date}`);
  };

  const totalValue = useMemo(() => historyRows.reduce((sum, row) => sum + row.value, 0), [historyRows]);
  const totalAvgWeight = useMemo(() => {
    const rowsWithAvgWeight = historyRows.filter((row) => row.avgWeight != null);
    if (rowsWithAvgWeight.length === 0) return null;
    return rowsWithAvgWeight.reduce((sum, row) => sum + (row.avgWeight ?? 0), 0) / rowsWithAvgWeight.length;
  }, [historyRows]);

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-auto !min-h-14" : "!px-8 !h-[74px]",
        ].join(" ")}
        style={{
          backgroundColor: PRIMARY,
          ...(isMobile
            ? {
              paddingTop: mobileSafeAreaTop,
              height: `calc(56px + ${mobileSafeAreaTop})`,
            }
            : {}),
        }}
      >
        <div className={["flex items-center", isMobile ? "gap-2" : "gap-4"].join(" ")}>
          <Button
            type="text"
            icon={<IoMdArrowRoundBack size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider
            type="vertical"
            className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")}
          />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Building Metric</div>
            <Title level={4} className="!m-0 !text-white !text-base md:!text-lg">
              {METRIC_META[metricKey].title} History
            </Title>
          </div>
        </div>
        <div className={["flex items-center", isMobile ? "gap-1" : "gap-2"].join(" ")}>
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={handlePdfClick}
            aria-label="PDF"
          />
          <Button
            type="text"
            icon={<FaSignOutAlt size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={handleSignOut}
          />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-3">
          {METRIC_TABS.map((tab) => {
            const isActive = tab.key === metricKey;
            const Icon = tab.icon === "plus" ? PlusCircleFilled : MinusCircleFilled;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleMetricTabChange(tab.key)}
                className={[
                  "flex items-center justify-center gap-2 px-3 font-semibold transition",
                  isMobile ? "h-14 text-sm" : "h-16 text-base",
                  isActive ? "shadow-inner" : "hover:bg-slate-50",
                ].join(" ")}
                style={{
                  backgroundColor: isActive ? tab.activeBg : "#ffffff",
                  color: isActive ? tab.activeText : "#0f172a",
                }}
                aria-pressed={isActive}
              >
                <Icon
                  style={{
                    fontSize: isMobile ? 22 : 24,
                    color: isActive ? "#ffffff" : PRIMARY,
                  }}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Content className={isMobile ? "px-3 py-3 pb-8" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
        ) : historyRows.length === 0 ? (
          <ChickenState
            title="No history yet"
            subtitle={`No ${METRIC_META[metricKey].title.toLowerCase()} data found up to ${dayjs(selectedDate).format("MMMM D, YYYY")}.`}
            fullScreen
          />
        ) : (
          <>
            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {buildingName || `Building ${id}`}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{METRIC_META[metricKey].title} Daily History</div>
              <div className="mt-2 text-sm text-slate-600">
                Showing day 1 to {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">{historyRows.length}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</span>
                  <span className="text-sm font-bold text-slate-900">{totalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {historyRows.map((row) => (
                <div
                  key={row.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleHistoryRowClick(row.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleHistoryRowClick(row.date);
                    }
                  }}
                  className="rounded-sm border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            row.date === dayjs().format("YYYY-MM-DD") ? "bg-emerald-500" : METRIC_META[metricKey].accent,
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <div className="text-sm font-semibold text-slate-900">
                          Day {row.dayNumber}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{dayjs(row.date).format("MMMM D, YYYY")}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.sourceTime ? `Latest log ${dayjs(row.sourceTime).format("h:mm A")}` : "No log for this date"}
                      </div>
                    </div>
                    <div className="min-w-[108px] text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{METRIC_META[metricKey].title}</div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">{row.value.toLocaleString()}</div>
                      <div className="mt-2 grid gap-1 text-[10px] text-slate-500">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="uppercase tracking-wide">Avg. Weight</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {row.avgWeight !== null
                              ? `${row.avgWeight.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} kg`
                              : "-"}
                          </span>
                        </div>
                        {metricKey === "mortality" ? (
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="uppercase tracking-wide">Expected</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {row.expectedDailyDeaths != null ? row.expectedDailyDeaths.toLocaleString() : "-"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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
