import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid, Drawer, Input, InputNumber, Modal } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaSignOutAlt } from "react-icons/fa";
import { FiCheck, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
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
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
const DOA_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_DOA_TRANSACTIONS_TABLE ?? "DOATransactions";
const CULLED_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_CULLED_TRANSACTIONS_TABLE ?? "CulledTransactions";

type UserRole = "Admin" | "Supervisor" | "Staff" | null;

type MetricKey = "mortality" | "thinning" | "takeOut" | "reduction" | "doa" | "culled";

type HistoryRow = {
  date: string;
  dayNumber: number;
  value: number;
  avgWeight: number | null;
  expectedDailyDeaths: number | null;
  sourceTime: string | null;
};

type DoaTransactionRow = {
  id: number;
  createdAt: string;
  totalAnimalsCount: number;
  remarks: string | null;
};

type MetricTotals = Record<MetricKey, number>;

const METRIC_META: Record<MetricKey, { title: string; accent: string }> = {
  mortality: { title: "Actual Death", accent: "bg-red-500" },
  thinning: { title: "Thinning", accent: "bg-slate-400" },
  takeOut: { title: "Take Out", accent: "bg-amber-500" },
  reduction: { title: "Reduction", accent: "bg-rose-500" },
  doa: { title: "DOA", accent: "bg-sky-500" },
  culled: { title: "Culled", accent: "bg-emerald-500" },
};

const METRIC_CARDS: Array<{
  key: MetricKey;
  label: string;
  borderColor: string;
  accent: string;
  icon: React.ReactNode;
  enabledRoles?: Array<Exclude<UserRole, null>>;
}> = [
  {
    key: "mortality",
    label: "Mortality",
    borderColor: "#f59e0b",
    accent: "text-[#f59e0b]",
    icon: <img src="/img/chicken-head.svg" alt="Mortality" className="h-10 w-10" />,
  },
  {
    key: "thinning",
    label: "Thinning",
    borderColor: "#22c55e",
    accent: "text-[#008822]",
    icon: <img src="/img/chicken-head.svg" alt="Thinning" className="h-10 w-10" />,
  },
  {
    key: "takeOut",
    label: "Take Out",
    borderColor: "#f59e0b",
    accent: "text-[#d97706]",
    icon: <img src="/img/chicken-head.svg" alt="Take Out" className="h-10 w-10" />,
  },
  {
    key: "doa",
    label: "DOA",
    borderColor: "#0ea5e9",
    accent: "text-[#0284c7]",
    icon: <img src="/img/chicken-doa.svg" alt="DOA" className="h-10 w-10" />,
    enabledRoles: ["Admin", "Supervisor"],
  },
  {
    key: "culled",
    label: "Culled",
    borderColor: "#8b5cf6",
    accent: "text-[#7c3aed]",
    icon: <img src="/img/chicken-doa.svg" alt="Culled" className="h-10 w-10" />,
    enabledRoles: ["Admin", "Supervisor"],
  },
];

const EXPECTED_DAILY_DEATHS: Record<number, number> = {
  0: 0,
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
  if (
    value === "mortality" ||
    value === "thinning" ||
    value === "takeOut" ||
    value === "reduction" ||
    value === "doa" ||
    value === "culled"
  ) {
    return value;
  }
  return "mortality";
};

const toNonNegativeInt = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

const formatSpecialTransactionTimestamp = (value: string): string =>
  dayjs.utc(value).format("MMMM D, YYYY h:mm A");

const toReductionType = (metricKey: "mortality" | "thinning" | "takeOut"): "mortality" | "thinning" | "take_out" => {
  if (metricKey === "takeOut") return "take_out";
  return metricKey;
};

const isSpecialMetric = (metricKey: MetricKey): metricKey is "doa" | "culled" =>
  metricKey === "doa" || metricKey === "culled";

export default function BuildingMetricHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id, metric } = useParams();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const selectedMetric = metric ? toMetricKey(metric) : null;
  const metricKey = selectedMetric ?? "mortality";
  const isSelectorPage = selectedMetric == null;
  const selectedDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [totalBirdsLoaded, setTotalBirdsLoaded] = useState(0);
  const [activeGrowId, setActiveGrowId] = useState<number | null>(null);
  const [activeGrowStatus, setActiveGrowStatus] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isDoaDrawerOpen, setIsDoaDrawerOpen] = useState(false);
  const [doaDrawerDate, setDoaDrawerDate] = useState(selectedDate);
  const [doaCount, setDoaCount] = useState(0);
  const [doaRemarks, setDoaRemarks] = useState("");
  const [doaHistoryRows, setDoaHistoryRows] = useState<DoaTransactionRow[]>([]);
  const [isSavingDoa, setIsSavingDoa] = useState(false);
  const [editingDoaTransactionId, setEditingDoaTransactionId] = useState<number | null>(null);
  const [editingDoaCount, setEditingDoaCount] = useState(0);
  const [editingDoaRemarks, setEditingDoaRemarks] = useState("");
  const [isEditingDoa, setIsEditingDoa] = useState(false);
  const [isCulledDrawerOpen, setIsCulledDrawerOpen] = useState(false);
  const [culledDrawerDate, setCulledDrawerDate] = useState(selectedDate);
  const [culledCount, setCulledCount] = useState(0);
  const [culledRemarks, setCulledRemarks] = useState("");
  const [culledHistoryRows, setCulledHistoryRows] = useState<DoaTransactionRow[]>([]);
  const [isSavingCulled, setIsSavingCulled] = useState(false);
  const [editingCulledTransactionId, setEditingCulledTransactionId] = useState<number | null>(null);
  const [editingCulledCount, setEditingCulledCount] = useState(0);
  const [editingCulledRemarks, setEditingCulledRemarks] = useState("");
  const [isEditingCulled, setIsEditingCulled] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [metricTotals, setMetricTotals] = useState<MetricTotals>({
    mortality: 0,
    thinning: 0,
    takeOut: 0,
    reduction: 0,
    doa: 0,
    culled: 0,
  });

  useEffect(() => {
    const resolveUserRole = async () => {
      if (!user?.id) {
        setUserRole(null);
        return;
      }

      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select("role")
        .eq("user_uuid", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setUserRole(null);
        return;
      }

      setUserRole(data?.role === "Admin" || data?.role === "Supervisor" ? data.role : "Staff");
    };

    void resolveUserRole();
  }, [user?.id]);

  useEffect(() => {
    const fetchHistory = async () => {
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId)) {
        setHistoryRows([]);
        setBuildingName("");
        setTotalBirdsLoaded(0);
        setActiveGrowId(null);
        setActiveGrowStatus("");
        setMetricTotals({
          mortality: 0,
          thinning: 0,
          takeOut: 0,
          reduction: 0,
          doa: 0,
          culled: 0,
        });
        return;
      }

      try {
        setIsLoading(true);
        const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
        const [{ data: buildingData, error: buildingError }, { data: growRows, error: growsError }] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("name").eq("id", buildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id, created_at, total_animals, status")
            .eq("building_id", buildingId)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (buildingError) throw buildingError;
        if (growsError) throw growsError;

        setBuildingName(typeof buildingData?.name === "string" ? buildingData.name : "");

        const growRow = ((growRows ?? []) as Array<{
          id: number | null;
          created_at: string;
          total_animals: number | null;
          status?: string | null;
        }>)[0];
        if (!growRow?.id) {
          setHistoryRows([]);
          setTotalBirdsLoaded(0);
          setActiveGrowId(null);
          setActiveGrowStatus("");
          setMetricTotals({
            mortality: 0,
            thinning: 0,
            takeOut: 0,
            reduction: 0,
            doa: 0,
            culled: 0,
          });
          return;
        }
        setActiveGrowId(growRow.id);
        setActiveGrowStatus(typeof growRow.status === "string" ? growRow.status : "");
        setTotalBirdsLoaded(toNonNegativeInt(growRow.total_animals));

        const [growLogs, reductionTransactions, bodyWeightLogs, doaTransactionsResult, culledTransactionsResult] = await Promise.all([
          loadGrowLogsByGrowId(growRow.id),
          loadGrowReductionTransactionsByGrowId(growRow.id),
          loadBodyWeightLogsByBuildingId(buildingId),
          supabase
            .from(DOA_TRANSACTIONS_TABLE)
            .select("created_at, total_animals_count")
            .eq("grow_id", growRow.id)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false }),
          supabase
            .from(CULLED_TRANSACTIONS_TABLE)
            .select("created_at, total_animals_count")
            .eq("grow_id", growRow.id)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false }),
        ]);
        if (doaTransactionsResult.error) throw doaTransactionsResult.error;
        if (culledTransactionsResult.error) throw culledTransactionsResult.error;
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
        const doaTotalsByDate = ((doaTransactionsResult.data ?? []) as Array<{
          created_at: string;
          total_animals_count: number | null;
        }>).reduce<Record<string, { total: number; sourceTime: string | null }>>((acc, row) => {
          const dateKey = dayjs.utc(row.created_at).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = { total: 0, sourceTime: row.created_at };
          acc[dateKey].total += toNonNegativeInt(row.total_animals_count);
          return acc;
        }, {});
        const culledTotalsByDate = ((culledTransactionsResult.data ?? []) as Array<{
          created_at: string;
          total_animals_count: number | null;
        }>).reduce<Record<string, { total: number; sourceTime: string | null }>>((acc, row) => {
          const dateKey = dayjs.utc(row.created_at).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = { total: 0, sourceTime: row.created_at };
          acc[dateKey].total += toNonNegativeInt(row.total_animals_count);
          return acc;
        }, {});

        const startDate = dayjs.utc(growRow.created_at).startOf("day");
        const endDate = dayjs.utc(selectedDate, "YYYY-MM-DD").startOf("day");
        const nextRows: HistoryRow[] = [];
        const nextMetricTotals: MetricTotals = {
          mortality: 0,
          thinning: 0,
          takeOut: 0,
          reduction: 0,
          doa: 0,
          culled: 0,
        };

        for (
          let cursor = startDate;
          cursor.isBefore(endDate) || cursor.isSame(endDate, "day");
          cursor = cursor.add(1, "day")
        ) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const dayRows = [...(logsByDate[dateKey] ?? [])].sort(
            (a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf()
          );
          const latestRow = dayRows[0] ?? null;
          const dayReductionRows = isSpecialMetric(metricKey)
            ? []
            : [...(reductionTransactionsByDate[dateKey] ?? [])]
              .filter((row) => (
                isSelectorPage || metricKey === "reduction"
                  ? row.reductionType === "mortality" || row.reductionType === "thinning" || row.reductionType === "take_out"
                  : row.reductionType === toReductionType(metricKey)
              ))
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

          const latestReductionByCage = dayReductionRows.reduce<Record<string, number>>((acc, row) => {
            if (row.subbuildingId == null || row.reductionType == null) return acc;
            const reductionType = row.reductionType;
            const reductionKey =
              reductionType === "take_out" || reductionType === "mortality" || reductionType === "thinning"
                ? reductionType
                : null;
            if (!reductionKey) return acc;
            const key = `${row.subbuildingId}-${reductionKey}`;
            if (acc[key] != null) return acc;
            acc[key] = toNonNegativeInt(row.animalCount);
            return acc;
          }, {});

          const summarizeReductionRows = (rows: typeof dayReductionRows) =>
            rows.reduce<Record<string, number>>((acc, row) => {
              if (row.subbuildingId == null) return acc;
              const key = String(row.subbuildingId);
              if (acc[key] != null) return acc;
              acc[key] = toNonNegativeInt(row.animalCount);
              return acc;
            }, {});

          const mortalityReductionByCage = summarizeReductionRows(
            dayReductionRows.filter((row) => row.reductionType === "mortality")
          );
          const thinningReductionByCage = summarizeReductionRows(
            dayReductionRows.filter((row) => row.reductionType === "thinning")
          );
          const takeOutReductionByCage = summarizeReductionRows(
            dayReductionRows.filter((row) => row.reductionType === "take_out")
          );

          const specialMetricEntry =
            metricKey === "doa" ? doaTotalsByDate[dateKey] : metricKey === "culled" ? culledTotalsByDate[dateKey] : null;
          let value = 0;

          const dayMetricValues: MetricTotals = {
            mortality:
              Object.keys(mortalityReductionByCage).length > 0
                ? Object.values(mortalityReductionByCage).reduce((sum, current) => sum + current, 0)
                : Object.keys(latestByCage).length > 0
                  ? Object.values(latestByCage).reduce((sum, row) => sum + row.mortality, 0)
                  : toNonNegativeInt(latestRow?.mortality ?? 0),
            thinning:
              Object.keys(thinningReductionByCage).length > 0
                ? Object.values(thinningReductionByCage).reduce((sum, current) => sum + current, 0)
                : Object.keys(latestByCage).length > 0
                  ? Object.values(latestByCage).reduce((sum, row) => sum + row.thinning, 0)
                  : toNonNegativeInt(latestRow?.thinning ?? 0),
            takeOut:
              Object.keys(takeOutReductionByCage).length > 0
                ? Object.values(takeOutReductionByCage).reduce((sum, current) => sum + current, 0)
                : Object.keys(latestByCage).length > 0
                  ? Object.values(latestByCage).reduce((sum, row) => sum + row.takeOut, 0)
                  : toNonNegativeInt(latestRow?.takeOut ?? 0),
            reduction:
              Object.keys(latestReductionByCage).length > 0
                ? Object.values(latestReductionByCage).reduce((sum, current) => sum + current, 0)
                : Object.keys(latestByCage).length > 0
                  ? Object.values(latestByCage).reduce((sum, row) => sum + row.mortality + row.thinning + row.takeOut, 0)
                  : toNonNegativeInt(latestRow?.mortality ?? 0) +
                    toNonNegativeInt(latestRow?.thinning ?? 0) +
                    toNonNegativeInt(latestRow?.takeOut ?? 0),
            doa: doaTotalsByDate[dateKey]?.total ?? 0,
            culled: culledTotalsByDate[dateKey]?.total ?? 0,
          };

          nextMetricTotals.mortality += dayMetricValues.mortality;
          nextMetricTotals.thinning += dayMetricValues.thinning;
          nextMetricTotals.takeOut += dayMetricValues.takeOut;
          nextMetricTotals.reduction += dayMetricValues.reduction;
          nextMetricTotals.doa += dayMetricValues.doa;
          nextMetricTotals.culled += dayMetricValues.culled;

          value = specialMetricEntry ? specialMetricEntry.total : dayMetricValues[metricKey];
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
            expectedDailyDeaths: metricKey === "mortality" ? EXPECTED_DAILY_DEATHS[cursor.diff(startDate, "day")] ?? null : null,
            sourceTime: specialMetricEntry?.sourceTime ?? dayReductionRows[0]?.createdAt ?? latestRow?.createdAt ?? null,
          });
        }

        setMetricTotals(nextMetricTotals);
        setHistoryRows(isSelectorPage ? [] : nextRows);
      } catch (error) {
        setHistoryRows([]);
        setActiveGrowId(null);
        setActiveGrowStatus("");
        setMetricTotals({
          mortality: 0,
          thinning: 0,
          takeOut: 0,
          reduction: 0,
          doa: 0,
          culled: 0,
        });
        setToastMessage(`Failed to load ${METRIC_META[metricKey].title.toLowerCase()} history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistory();
  }, [id, metricKey, selectedDate, isSelectorPage, historyRefreshKey]);

  const refreshMetricHistory = () => {
    setHistoryRefreshKey((current) => current + 1);
  };

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
              })} g`
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
          ...(metricKey === "mortality" ? ["Standard Deaths"] : []),
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
                })} g`
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
              })} g`
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
    if (!id) return;
    if (selectedMetric === nextMetric) return;
    navigate(`/building-metric-history/${id}/${nextMetric}?date=${selectedDate}`);
  };

  const resolveEffectiveGrowMeta = async (): Promise<{ growId: number | null; status: string }> => {
    if (activeGrowId != null) {
      return { growId: activeGrowId, status: activeGrowStatus };
    }

    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) return { growId: null, status: "" };

    const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
    const { data: growRows, error: growError } = await supabase
      .from(GROWS_TABLE)
      .select("id, status")
      .eq("building_id", buildingId)
      .lt("created_at", selectedDayEnd)
      .order("created_at", { ascending: false })
      .limit(1);

    if (growError) {
      throw new Error(growError.message || "Failed to load active grow.");
    }

    const growRow = ((growRows ?? []) as Array<{ id: number | null; status?: string | null }>)[0];
    const nextGrowId = growRow?.id ?? null;
    const nextGrowStatus = typeof growRow?.status === "string" ? growRow.status : "";
    setActiveGrowId(nextGrowId);
    setActiveGrowStatus(nextGrowStatus);
    return { growId: nextGrowId, status: nextGrowStatus };
  };

  const resolveEffectiveGrowId = async (): Promise<number | null> => {
    const { growId } = await resolveEffectiveGrowMeta();
    return growId;
  };

  const resolveGrowAnimalLimit = async (providedGrowId?: number | null): Promise<{ growId: number | null; totalAnimals: number }> => {
    const growId = providedGrowId ?? await resolveEffectiveGrowId();
    if (growId == null) {
      return { growId: null, totalAnimals: 0 };
    }

    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select("total_animals")
      .eq("id", growId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load current total animals.");
    }

    const totalAnimals = toNonNegativeInt(data?.total_animals);
    setTotalBirdsLoaded(totalAnimals);
    return { growId, totalAnimals };
  };

  const updateGrowTotalAnimals = async (growId: number, totalAnimals: number) => {
    const { error } = await supabase
      .from(GROWS_TABLE)
      .update({ total_animals: Math.max(0, Math.floor(totalAnimals)) })
      .eq("id", growId);

    if (error) {
      throw new Error(error.message || "Failed to update grow total animals.");
    }
  };

  const resolveDisplayedCurrentAnimals = async (growId: number, totalAnimals: number) => {
    const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
    const [transactions, culledTransactionsResult] = await Promise.all([
      loadGrowReductionTransactionsByGrowId(growId),
      supabase
        .from(CULLED_TRANSACTIONS_TABLE)
        .select("total_animals_count, created_at")
        .eq("grow_id", growId)
        .lt("created_at", selectedDayEnd),
    ]);

    if (culledTransactionsResult.error) {
      throw new Error(culledTransactionsResult.error.message || "Failed to load culled totals.");
    }

    const filteredTransactions = transactions.filter(
      (row) => dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
    );

    const latestByDayCageAndType: Record<string, { animalCount: number; reductionType: string | null }> = {};

    filteredTransactions
      .sort((a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf())
      .forEach((row) => {
        if (row.subbuildingId == null || !row.reductionType) return;
        const dayKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
        const key = `${dayKey}-${row.subbuildingId}-${row.reductionType}`;
        if (latestByDayCageAndType[key]) return;
        latestByDayCageAndType[key] = {
          animalCount: toNonNegativeInt(row.animalCount),
          reductionType: row.reductionType,
        };
      });

    const reductionTotals = Object.values(latestByDayCageAndType).reduce(
      (sum, row) => sum + row.animalCount,
      0
    );

    const culledTotal = ((culledTransactionsResult.data ?? []) as Array<{ total_animals_count: number | null }>).reduce(
      (sum, row) => sum + toNonNegativeInt(row.total_animals_count),
      0
    );

    return Math.max(0, Math.floor(totalAnimals) - reductionTotals - culledTotal);
  };

  const syncLatestGrowLogActualTotal = async (growId: number, totalAnimals: number) => {
    const { data: latestGrowLogRow, error: latestGrowLogRowError } = await supabase
      .from(GROW_LOGS_TABLE)
      .select("created_at")
      .eq("grow_id", growId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestGrowLogRowError) {
      throw new Error(latestGrowLogRowError.message || "Failed to load latest grow log.");
    }

    if (!latestGrowLogRow?.created_at) return;

    const latestLogDate = dayjs.utc(latestGrowLogRow.created_at).format("YYYY-MM-DD");
    const latestLogStart = dayjs.utc(latestLogDate, "YYYY-MM-DD").startOf("day");
    const latestLogEnd = latestLogStart.add(1, "day");
    const normalizedTotalAnimals = Math.max(0, Math.floor(totalAnimals));

    const { error: latestGrowLogUpdateError } = await supabase
      .from(GROW_LOGS_TABLE)
      .update({ actual_total_animals: normalizedTotalAnimals })
      .eq("grow_id", growId)
      .gte("created_at", latestLogStart.toISOString())
      .lt("created_at", latestLogEnd.toISOString());

    if (latestGrowLogUpdateError) {
      throw new Error(latestGrowLogUpdateError.message || "Failed to sync latest grow log total animals.");
    }
  };

  const createGrowLogSnapshotFromLatestDate = async (
    growId: number,
    totalAnimals: number,
    createdAt: string
  ) => {
    const { data: latestGrowLogRow, error: latestGrowLogRowError } = await supabase
      .from(GROW_LOGS_TABLE)
      .select("created_at")
      .eq("grow_id", growId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestGrowLogRowError) {
      throw new Error(latestGrowLogRowError.message || "Failed to load latest grow log.");
    }

    if (!latestGrowLogRow?.created_at) return;

    const latestLogDate = dayjs.utc(latestGrowLogRow.created_at).format("YYYY-MM-DD");
    const latestLogStart = dayjs.utc(latestLogDate, "YYYY-MM-DD").startOf("day");
    const latestLogEnd = latestLogStart.add(1, "day");

    const { data: latestGrowLogRows, error: latestGrowLogRowsError } = await supabase
      .from(GROW_LOGS_TABLE)
      .select("subbuilding_id, mortality, thinning, take_out")
      .eq("grow_id", growId)
      .gte("created_at", latestLogStart.toISOString())
      .lt("created_at", latestLogEnd.toISOString())
      .order("created_at", { ascending: false });

    if (latestGrowLogRowsError) {
      throw new Error(latestGrowLogRowsError.message || "Failed to load latest grow log rows.");
    }

    const snapshotRows = ((latestGrowLogRows ?? []) as Array<{
      subbuilding_id: number | null;
      mortality: number | null;
      thinning: number | null;
      take_out: number | null;
    }>).map((row) => ({
      grow_id: growId,
      subbuilding_id: row.subbuilding_id,
      actual_total_animals: Math.max(0, Math.floor(totalAnimals)),
      mortality: row.mortality,
      thinning: row.thinning,
      take_out: row.take_out,
      created_at: createdAt,
    }));

    if (snapshotRows.length === 0) return;

    const { error: insertSnapshotError } = await supabase.from(GROW_LOGS_TABLE).insert(snapshotRows);

    if (insertSnapshotError) {
      throw new Error(insertSnapshotError.message || "Failed to create grow log snapshot.");
    }
  };

  const ensureCountWithinGrowTotal = (count: number, totalAnimals: number, label: string): boolean => {
    if (count > totalAnimals) {
      setToastMessage(`${label} cannot exceed current total animals (${totalAnimals.toLocaleString()}).`);
      setIsToastOpen(true);
      return false;
    }

    return true;
  };

  const loadDoaHistory = async () => {
    const { growId, status } = await resolveEffectiveGrowMeta();
    if (growId == null || (status !== "Loading" && status !== "Growing")) {
      setDoaHistoryRows([]);
      return;
    }

    const drawerDayStart = `${dayjs(doaDrawerDate).format("YYYY-MM-DD")}T00:00:00+00:00`;
    const drawerDayEnd = `${dayjs(doaDrawerDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

    const { data, error } = await supabase
      .from(DOA_TRANSACTIONS_TABLE)
      .select("id, created_at, total_animals_count, remarks")
      .eq("grow_id", growId)
      .gte("created_at", drawerDayStart)
      .lt("created_at", drawerDayEnd)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to load DOA history.");
    }

    const rows = ((data ?? []) as Array<{
      id: number;
      created_at: string;
      total_animals_count: number | null;
      remarks: string | null;
    }>).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      totalAnimalsCount: toNonNegativeInt(row.total_animals_count),
      remarks: typeof row.remarks === "string" ? row.remarks : null,
    }));

    setDoaHistoryRows(rows);
  };

  const loadCulledHistory = async () => {
    const { growId, status } = await resolveEffectiveGrowMeta();
    if (growId == null || (status !== "Loading" && status !== "Growing")) {
      setCulledHistoryRows([]);
      return;
    }

    const drawerDayStart = `${dayjs(culledDrawerDate).format("YYYY-MM-DD")}T00:00:00+00:00`;
    const drawerDayEnd = `${dayjs(culledDrawerDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

    const { data, error } = await supabase
      .from(CULLED_TRANSACTIONS_TABLE)
      .select("id, created_at, total_animals_count, remarks")
      .eq("grow_id", growId)
      .gte("created_at", drawerDayStart)
      .lt("created_at", drawerDayEnd)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to load culled history.");
    }

    const rows = ((data ?? []) as Array<{
      id: number;
      created_at: string;
      total_animals_count: number | null;
      remarks: string | null;
    }>).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      totalAnimalsCount: toNonNegativeInt(row.total_animals_count),
      remarks: typeof row.remarks === "string" ? row.remarks : null,
    }));

    setCulledHistoryRows(rows);
  };

  useEffect(() => {
    if (metricKey === "reduction") {
      setDoaHistoryRows([]);
      return;
    }

    const fetchDoaHistory = async () => {
      try {
        await loadDoaHistory();
      } catch (error) {
        setDoaHistoryRows([]);
        setToastMessage(getErrorMessage(error));
        setIsToastOpen(true);
      }
    };

    void fetchDoaHistory();
  }, [metricKey, activeGrowId, activeGrowStatus, id, doaDrawerDate]);

  useEffect(() => {
    if (!isDoaDrawerOpen) return;

    const fetchDoaHistory = async () => {
      try {
        await loadDoaHistory();
      } catch (error) {
        setDoaHistoryRows([]);
        setToastMessage(getErrorMessage(error));
        setIsToastOpen(true);
      }
    };

    void fetchDoaHistory();
  }, [isDoaDrawerOpen, activeGrowId, id, doaDrawerDate]);

  useEffect(() => {
    if (metricKey === "reduction") {
      setCulledHistoryRows([]);
      return;
    }

    const fetchCulledHistory = async () => {
      try {
        await loadCulledHistory();
      } catch (error) {
        setCulledHistoryRows([]);
        setToastMessage(getErrorMessage(error));
        setIsToastOpen(true);
      }
    };

    void fetchCulledHistory();
  }, [metricKey, activeGrowId, activeGrowStatus, id, culledDrawerDate]);

  useEffect(() => {
    if (!isCulledDrawerOpen) return;

    const fetchCulledHistory = async () => {
      try {
        await loadCulledHistory();
      } catch (error) {
        setCulledHistoryRows([]);
        setToastMessage(getErrorMessage(error));
        setIsToastOpen(true);
      }
    };

    void fetchCulledHistory();
  }, [isCulledDrawerOpen, activeGrowId, id, culledDrawerDate]);

  const handleOpenDoaDrawer = (date = selectedDate) => {
    setDoaDrawerDate(date);
    setDoaCount(0);
    setDoaRemarks("");
    setEditingDoaTransactionId(null);
    setEditingDoaCount(0);
    setEditingDoaRemarks("");
    setIsEditingDoa(false);
    setIsDoaDrawerOpen(true);
  };

  const handleCloseDoaDrawer = () => {
    setIsDoaDrawerOpen(false);
    setDoaDrawerDate(selectedDate);
    setDoaCount(0);
    setDoaRemarks("");
    setEditingDoaTransactionId(null);
    setEditingDoaCount(0);
    setEditingDoaRemarks("");
    setIsEditingDoa(false);
  };

  const startEditingDoaEntry = (entry: DoaTransactionRow) => {
    setEditingDoaTransactionId(entry.id);
    setEditingDoaCount(entry.totalAnimalsCount);
    setEditingDoaRemarks(entry.remarks ?? "");
  };

  const resetDoaEditState = () => {
    setEditingDoaTransactionId(null);
    setEditingDoaCount(0);
    setEditingDoaRemarks("");
    setIsEditingDoa(false);
  };

  const handleSaveDoa = async () => {
    if (isSavingDoa) return;
    if (doaCount <= 0) {
      setToastMessage("DOA Count is required.");
      setIsToastOpen(true);
      return;
    }

    setIsSavingDoa(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsSavingDoa(false);
      return;
    }

    if (growId == null) {
      setToastMessage("No active grow found for this building.");
      setIsToastOpen(true);
      setIsSavingDoa(false);
      return;
    }

    if (!ensureCountWithinGrowTotal(doaCount, totalAnimals, "DOA Count")) {
      setIsSavingDoa(false);
      return;
    }

    const now = dayjs();
    const createdAt = dayjs(doaDrawerDate)
      .hour(now.hour())
      .minute(now.minute())
      .second(now.second())
      .millisecond(0)
      .toISOString();

    const { error } = await supabase.from(DOA_TRANSACTIONS_TABLE).insert([
      {
        created_at: createdAt,
        grow_id: growId,
        total_animals_count: doaCount,
        remarks: doaRemarks.trim() || null,
      },
    ]);

    if (error) {
      setToastMessage(error.message || "Failed to save DOA record.");
      setIsToastOpen(true);
      setIsSavingDoa(false);
      return;
    }

    try {
      const nextTotalAnimals = totalAnimals - doaCount;
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, nextTotalAnimals);
      await updateGrowTotalAnimals(growId, nextTotalAnimals);
      await createGrowLogSnapshotFromLatestDate(growId, nextDisplayedCurrentAnimals, createdAt);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
      setTotalBirdsLoaded(nextTotalAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsSavingDoa(false);
      return;
    }

    try {
      await loadDoaHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsSavingDoa(false);
      return;
    }

    setDoaCount(0);
    setDoaRemarks("");
    refreshMetricHistory();
    setToastMessage("DOA record saved.");
    setIsToastOpen(true);
    setIsSavingDoa(false);
  };

  const handleSaveEditedDoa = async (entry: DoaTransactionRow) => {
    if (isEditingDoa) return;
    if (editingDoaCount <= 0) {
      setToastMessage("DOA Count is required.");
      setIsToastOpen(true);
      return;
    }

    setIsEditingDoa(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;

      if (growId == null) {
        setToastMessage("No active grow found for this building.");
        setIsToastOpen(true);
        setIsEditingDoa(false);
        return;
      }

      const maxAllowed = totalAnimals + entry.totalAnimalsCount;
      if (!ensureCountWithinGrowTotal(editingDoaCount, maxAllowed, "DOA Count")) {
        setIsEditingDoa(false);
        return;
      }
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    const { error } = await supabase
      .from(DOA_TRANSACTIONS_TABLE)
      .update({
        total_animals_count: editingDoaCount,
        remarks: editingDoaRemarks.trim() || null,
      })
      .eq("id", entry.id);

    if (error) {
      setToastMessage(error.message || "Failed to update DOA record.");
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    try {
      const nextTotalAnimals = totalAnimals + entry.totalAnimalsCount - editingDoaCount;
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, nextTotalAnimals);
      await updateGrowTotalAnimals(growId, nextTotalAnimals);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
      setTotalBirdsLoaded(nextTotalAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    try {
      await loadDoaHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    resetDoaEditState();
    refreshMetricHistory();
    setToastMessage("DOA record updated.");
    setIsToastOpen(true);
  };

  const handleDeleteDoaEntry = async (entry: DoaTransactionRow) => {
    if (isEditingDoa) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Remove DOA Entry",
        content: "Are you sure you want to remove this DOA record?",
        okText: "Remove",
        cancelText: "Cancel",
        okButtonProps: {
          danger: true,
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    setIsEditingDoa(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    if (growId == null) {
      setToastMessage("No active grow found for this building.");
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    const { error } = await supabase
      .from(DOA_TRANSACTIONS_TABLE)
      .delete()
      .eq("id", entry.id);

    if (error) {
      setToastMessage(error.message || "Failed to remove DOA record.");
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    try {
      const nextTotalAnimals = totalAnimals + entry.totalAnimalsCount;
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, nextTotalAnimals);
      await updateGrowTotalAnimals(growId, nextTotalAnimals);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
      setTotalBirdsLoaded(nextTotalAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    try {
      await loadDoaHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsEditingDoa(false);
      return;
    }

    resetDoaEditState();
    refreshMetricHistory();
    setToastMessage("DOA record removed.");
    setIsToastOpen(true);
  };

  const handleOpenCulledDrawer = (date = selectedDate) => {
    setCulledDrawerDate(date);
    setCulledCount(0);
    setCulledRemarks("");
    setEditingCulledTransactionId(null);
    setEditingCulledCount(0);
    setEditingCulledRemarks("");
    setIsEditingCulled(false);
    setIsCulledDrawerOpen(true);
  };

  const handleCloseCulledDrawer = () => {
    setIsCulledDrawerOpen(false);
    setCulledDrawerDate(selectedDate);
    setCulledCount(0);
    setCulledRemarks("");
    setEditingCulledTransactionId(null);
    setEditingCulledCount(0);
    setEditingCulledRemarks("");
    setIsEditingCulled(false);
  };

  const startEditingCulledEntry = (entry: DoaTransactionRow) => {
    setEditingCulledTransactionId(entry.id);
    setEditingCulledCount(entry.totalAnimalsCount);
    setEditingCulledRemarks(entry.remarks ?? "");
  };

  const resetCulledEditState = () => {
    setEditingCulledTransactionId(null);
    setEditingCulledCount(0);
    setEditingCulledRemarks("");
    setIsEditingCulled(false);
  };

  const handleSaveCulled = async () => {
    if (isSavingCulled) return;
    if (culledCount <= 0) {
      setToastMessage("Culled Count is required.");
      setIsToastOpen(true);
      return;
    }

    setIsSavingCulled(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsSavingCulled(false);
      return;
    }

    if (growId == null) {
      setToastMessage("No active grow found for this building.");
      setIsToastOpen(true);
      setIsSavingCulled(false);
      return;
    }

    if (!ensureCountWithinGrowTotal(culledCount, totalAnimals, "Culled Count")) {
      setIsSavingCulled(false);
      return;
    }

    const now = dayjs();
    const createdAt = dayjs(culledDrawerDate)
      .hour(now.hour())
      .minute(now.minute())
      .second(now.second())
      .millisecond(0)
      .toISOString();

    const { error } = await supabase.from(CULLED_TRANSACTIONS_TABLE).insert([
      {
        created_at: createdAt,
        grow_id: growId,
        total_animals_count: culledCount,
        remarks: culledRemarks.trim() || null,
      },
    ]);

    if (error) {
      setToastMessage(error.message || "Failed to save culled record.");
      setIsToastOpen(true);
      setIsSavingCulled(false);
      return;
    }

    try {
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, totalAnimals);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsSavingCulled(false);
      return;
    }

    try {
      await loadCulledHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsSavingCulled(false);
      return;
    }

    setCulledCount(0);
    setCulledRemarks("");
    refreshMetricHistory();
    setToastMessage("Culled record saved.");
    setIsToastOpen(true);
    setIsSavingCulled(false);
  };

  const handleSaveEditedCulled = async (entry: DoaTransactionRow) => {
    if (isEditingCulled) return;
    if (editingCulledCount <= 0) {
      setToastMessage("Culled Count is required.");
      setIsToastOpen(true);
      return;
    }

    setIsEditingCulled(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;

      if (growId == null) {
        setToastMessage("No active grow found for this building.");
        setIsToastOpen(true);
        setIsEditingCulled(false);
        return;
      }

      const maxAllowed = totalAnimals + entry.totalAnimalsCount;
      if (!ensureCountWithinGrowTotal(editingCulledCount, maxAllowed, "Culled Count")) {
        setIsEditingCulled(false);
        return;
      }
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    const { error } = await supabase
      .from(CULLED_TRANSACTIONS_TABLE)
      .update({
        total_animals_count: editingCulledCount,
        remarks: editingCulledRemarks.trim() || null,
      })
      .eq("id", entry.id);

    if (error) {
      setToastMessage(error.message || "Failed to update culled record.");
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    try {
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, totalAnimals);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    try {
      await loadCulledHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    resetCulledEditState();
    refreshMetricHistory();
    setToastMessage("Culled record updated.");
    setIsToastOpen(true);
  };

  const handleDeleteCulledEntry = async (entry: DoaTransactionRow) => {
    if (isEditingCulled) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Remove Culled Entry",
        content: "Are you sure you want to remove this culled record?",
        okText: "Remove",
        cancelText: "Cancel",
        okButtonProps: {
          danger: true,
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    setIsEditingCulled(true);

    let growId: number | null = null;
    let totalAnimals = 0;

    try {
      const growSummary = await resolveGrowAnimalLimit();
      growId = growSummary.growId;
      totalAnimals = growSummary.totalAnimals;
    } catch (error) {
      setToastMessage(getErrorMessage(error));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    if (growId == null) {
      setToastMessage("No active grow found for this building.");
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    const { error } = await supabase
      .from(CULLED_TRANSACTIONS_TABLE)
      .delete()
      .eq("id", entry.id);

    if (error) {
      setToastMessage(error.message || "Failed to remove culled record.");
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    try {
      const nextDisplayedCurrentAnimals = await resolveDisplayedCurrentAnimals(growId, totalAnimals);
      await syncLatestGrowLogActualTotal(growId, nextDisplayedCurrentAnimals);
    } catch (growUpdateError) {
      setToastMessage(getErrorMessage(growUpdateError));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    try {
      await loadCulledHistory();
    } catch (historyError) {
      setToastMessage(getErrorMessage(historyError));
      setIsToastOpen(true);
      setIsEditingCulled(false);
      return;
    }

    resetCulledEditState();
    refreshMetricHistory();
    setToastMessage("Culled record removed.");
    setIsToastOpen(true);
  };

  const handleHistoryRowClick = (date: string) => {
    if (!id) return;
    navigate(`/building-cage/${id}?date=${date}`);
  };

  const totalValue = useMemo(() => historyRows.reduce((sum, row) => sum + row.value, 0), [historyRows]);
  const totalLabel = useMemo(() => {
    if (metricKey === "mortality") return "Total";
    if (metricKey === "thinning") return "Total";
    if (metricKey === "takeOut") return "Total";
    if (metricKey === "doa") return "Total DOA";
    if (metricKey === "culled") return "Total Culled";
    return "Total Reduction";
  }, [metricKey]);
  const totalAvgWeight = useMemo(() => {
    const rowsWithAvgWeight = historyRows.filter((row) => row.avgWeight != null);
    if (rowsWithAvgWeight.length === 0) return null;
    return rowsWithAvgWeight.reduce((sum, row) => sum + (row.avgWeight ?? 0), 0) / rowsWithAvgWeight.length;
  }, [historyRows]);
  const doaTotalEncoded = useMemo(
    () => doaHistoryRows.reduce((sum, row) => sum + row.totalAnimalsCount, 0),
    [doaHistoryRows]
  );
  const culledTotalEncoded = useMemo(
    () => culledHistoryRows.reduce((sum, row) => sum + row.totalAnimalsCount, 0),
    [culledHistoryRows]
  );
  const visibleMetricCards = useMemo(
    () =>
      METRIC_CARDS.filter((card) => {
        if (!card.enabledRoles || card.enabledRoles.length === 0) return true;
        return userRole != null && card.enabledRoles.includes(userRole);
      }),
    [userRole]
  );

  const renderSpecialDrawerHeader = (title: "DOA" | "Culled", onClose: () => void) => (
    <div
      className={[
        "sticky top-0 z-10 flex items-center justify-between",
        isMobile ? "px-3 min-h-14" : "px-6 h-[74px]",
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
          onClick={onClose}
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
        {isMobile ? (
          <>
            <Divider
              type="vertical"
              className="!m-0 !h-5 !border-white/60"
            />
            <Title level={4} className="!m-0 !text-base !text-white">
              {title}
            </Title>
          </>
        ) : (
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Building Metric</div>
            <Title level={4} className="!m-0 !text-white !text-lg">
              {title}
            </Title>
          </div>
        )}
      </div>
      <Button
        type="text"
        icon={<FaSignOutAlt size={18} />}
        className="!text-white hover:!text-white/90"
        onClick={handleSignOut}
        aria-label="Sign out"
      />
      <div className="absolute bottom-0 left-0 h-1 w-full bg-[#ffc700]" />
    </div>
  );

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
            onClick={() => {
              if (selectedMetric && id) {
                navigate(`/building-metric-history/${id}?date=${selectedDate}`);
                return;
              }
              navigate("/buildings");
            }}
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
              {selectedMetric ? `${METRIC_META[metricKey].title} History` : "Metric History"}
            </Title>
          </div>
        </div>
        <div className={["flex items-center", isMobile ? "gap-1" : "gap-2"].join(" ")}>
          {selectedMetric && (
            <Button
              type="text"
              icon={<MdOutlinePictureAsPdf size={20} />}
              className="!text-white hover:!text-white/90"
              onClick={handlePdfClick}
              aria-label="PDF"
            />
          )}
          <Button
            type="text"
            icon={<FaSignOutAlt size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={handleSignOut}
          />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-8" : "px-8 py-6"}>
        {isSelectorPage ? (
          <div className="mx-auto w-full max-w-4xl">
            <div className={isMobile ? "" : "flex justify-center"}>
              <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
                {visibleMetricCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleMetricTabChange(card.key)}
                    style={{ borderColor: card.borderColor }}
                    className={[
                      "text-left bg-white rounded-sm shadow-sm border-2",
                      "p-3 sm:p-5",
                      "h-full min-h-[146px] sm:min-h-[196px]",
                      "transition-all duration-200 cursor-pointer",
                      "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008822]/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          {buildingName || `Bldg ${id}`}
                        </div>
                        <div className={["mt-1 text-lg sm:text-2xl font-bold tracking-tight", card.accent].join(" ")}>
                          {card.label}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-[#ffa600]/25 p-3 sm:p-4 shadow-inner">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                          {card.icon}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</div>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <div className="text-xl font-bold text-slate-900 sm:text-2xl">
                          {metricTotals[card.key].toLocaleString()}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500">birds</div>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-[#008822]/0 via-[#008822]/10 to-[#008822]/0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : isLoading ? (
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
                {buildingName || `Bldg ${id}`}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{METRIC_META[metricKey].title} Daily History</div>
              <div className="mt-2 text-sm text-slate-600">
                Showing day 0 to {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">{historyRows.length}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{totalLabel}</span>
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
                  onClick={() => {
                    if (metricKey === "doa") {
                      handleOpenDoaDrawer(row.date);
                      return;
                    }
                    if (metricKey === "culled") {
                      handleOpenCulledDrawer(row.date);
                      return;
                    }
                    handleHistoryRowClick(row.date);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (metricKey === "doa") {
                        handleOpenDoaDrawer(row.date);
                        return;
                      }
                      if (metricKey === "culled") {
                        handleOpenCulledDrawer(row.date);
                        return;
                      }
                      handleHistoryRowClick(row.date);
                    }
                  }}
                  className={[
                    "rounded-sm border border-emerald-200 bg-white px-4 py-3 shadow-sm transition",
                    "hover:border-emerald-300 hover:shadow-md cursor-pointer",
                  ].join(" ")}
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
                      <div className="mt-1 text-[10px] text-slate-500">
                        {metricKey === "mortality" ? (
                          <>
                            Standard Death{" "}
                            <span className="font-semibold text-slate-700">
                              {row.expectedDailyDeaths != null ? row.expectedDailyDeaths.toLocaleString() : "-"}
                            </span>
                          </>
                        ) : (
                          ""
                        )}
                      </div>
                    </div>
                    <div className="min-w-[108px] text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{METRIC_META[metricKey].title}</div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">{row.value.toLocaleString()}</div>
                      {!isSpecialMetric(metricKey) ? (
                        <div className="mt-2 grid gap-1 text-[10px] text-slate-500">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="uppercase tracking-wide">Avg. Weight</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {row.avgWeight !== null
                                ? `${row.avgWeight.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} g`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Content>

      <Drawer
        open={isDoaDrawerOpen}
        onClose={handleCloseDoaDrawer}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="doa-drawer"
        closable={false}
        headerStyle={{ display: "none" }}
        bodyStyle={{ padding: 0, backgroundColor: "#f8fafc" }}
      >
        {renderSpecialDrawerHeader("DOA", handleCloseDoaDrawer)}

        <div className="p-5">
          <div className="rounded-sm border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#2563eb]">{buildingName || `Building #${id}`}</div>
              <div className="text-xs font-medium text-slate-500">{dayjs(doaDrawerDate).format("MMMM D, YYYY")}</div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-900">History</div>
              {doaHistoryRows.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">No history yet.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {doaHistoryRows.map((row) => {
                    const isEditing = editingDoaTransactionId === row.id;

                    return (
                    <div key={row.id} className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900">
                            {formatSpecialTransactionTimestamp(row.createdAt)}
                          </div>
                          {isEditing ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <InputNumber
                                  min={0}
                                  value={editingDoaCount}
                                  onChange={(value) => setEditingDoaCount(Number(value) || 0)}
                                  parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
                                  inputMode="numeric"
                                  className="!w-[110px]"
                                  size="small"
                                  styles={{ input: { fontSize: 16 } }}
                                />
                                <div className="text-[11px] font-semibold text-slate-500">birds</div>
                              </div>
                              <Input.TextArea
                                rows={1}
                                value={editingDoaRemarks}
                                onChange={(event) => setEditingDoaRemarks(event.target.value)}
                                placeholder="Add remarks (optional)"
                                autoSize={{ minRows: 1, maxRows: 2 }}
                                className="!text-base"
                                style={{ fontSize: 16 }}
                              />
                            </div>
                          ) : row.remarks ? (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 break-words">{row.remarks}</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {!isEditing ? (
                            <div className="inline-flex min-w-[76px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-900">
                              {row.totalAnimalsCount.toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={resetDoaEditState}
                              disabled={isEditingDoa}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 disabled:opacity-60"
                            >
                              <FiX size={12} />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveEditedDoa(row)}
                              disabled={editingDoaCount <= 0 || isEditingDoa}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <FiCheck size={12} />
                              <span>{isEditingDoa ? "Saving..." : "Save"}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => startEditingDoaEntry(row)}
                              disabled={isEditingDoa}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <FiEdit2 size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDoaEntry(row)}
                              disabled={isEditingDoa}
                              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 disabled:opacity-60"
                            >
                              <FiTrash2 size={11} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="text-slate-500">Total Encoded</span>
              <span className="font-semibold text-slate-900">{doaTotalEncoded.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4 rounded-sm border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-full">
                <div className="mb-2 text-xs font-medium text-slate-500">DOA Count</div>
              <InputNumber
                min={0}
                value={doaCount}
                onChange={(value) => setDoaCount(Number(value) || 0)}
                parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
                inputMode="numeric"
                placeholder="Enter total count"
                className="!w-full"
                styles={{ input: { fontSize: 16, height: 44 } }}
              />
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-slate-500">Remarks</div>
              <Input.TextArea
                rows={3}
                value={doaRemarks}
                onChange={(event) => setDoaRemarks(event.target.value)}
                placeholder="Add remarks (optional)"
                className="!text-base"
              />
            </div>

            {doaCount <= 0 && (
              <div className="text-xs text-red-500 mt-2">
                DOA Count is required.
              </div>
            )}

            <Button
              type="primary"
              className="mt-4 !h-11 !w-full !rounded-lg !border-0 text-base font-semibold"
              style={{ backgroundColor: "#66bb7a" }}
              onClick={handleSaveDoa}
              disabled={doaCount <= 0 || isSavingDoa}
              loading={isSavingDoa}
            >
              Save
            </Button>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={isCulledDrawerOpen}
        onClose={handleCloseCulledDrawer}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="culled-drawer"
        closable={false}
        headerStyle={{ display: "none" }}
        bodyStyle={{ padding: 0, backgroundColor: "#f8fafc" }}
      >
        {renderSpecialDrawerHeader("Culled", handleCloseCulledDrawer)}

        <div className="p-5">
          <div className="rounded-sm border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#2563eb]">{buildingName || `Building #${id}`}</div>
              <div className="text-xs font-medium text-slate-500">{dayjs(culledDrawerDate).format("MMMM D, YYYY")}</div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-900">History</div>
              {culledHistoryRows.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">No history yet.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {culledHistoryRows.map((row) => {
                    const isEditing = editingCulledTransactionId === row.id;

                    return (
                    <div key={row.id} className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900">
                            {formatSpecialTransactionTimestamp(row.createdAt)}
                          </div>
                          {isEditing ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <InputNumber
                                  min={0}
                                  value={editingCulledCount}
                                  onChange={(value) => setEditingCulledCount(Number(value) || 0)}
                                  parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
                                  inputMode="numeric"
                                  className="!w-[110px]"
                                  size="small"
                                  styles={{ input: { fontSize: 16 } }}
                                />
                                <div className="text-[11px] font-semibold text-slate-500">birds</div>
                              </div>
                              <Input.TextArea
                                rows={1}
                                value={editingCulledRemarks}
                                onChange={(event) => setEditingCulledRemarks(event.target.value)}
                                placeholder="Add remarks (optional)"
                                autoSize={{ minRows: 1, maxRows: 2 }}
                                className="!text-base"
                                style={{ fontSize: 16 }}
                              />
                            </div>
                          ) : row.remarks ? (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 break-words">{row.remarks}</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {!isEditing ? (
                            <div className="inline-flex min-w-[76px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-900">
                              {row.totalAnimalsCount.toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={resetCulledEditState}
                              disabled={isEditingCulled}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 disabled:opacity-60"
                            >
                              <FiX size={12} />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveEditedCulled(row)}
                              disabled={editingCulledCount <= 0 || isEditingCulled}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <FiCheck size={12} />
                              <span>{isEditingCulled ? "Saving..." : "Save"}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => startEditingCulledEntry(row)}
                              disabled={isEditingCulled}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <FiEdit2 size={11} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCulledEntry(row)}
                              disabled={isEditingCulled}
                              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 disabled:opacity-60"
                            >
                              <FiTrash2 size={11} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="text-slate-500">Total Encoded</span>
              <span className="font-semibold text-slate-900">{culledTotalEncoded.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4 rounded-sm border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-full">
                <div className="mb-2 text-xs font-medium text-slate-500">Culled Count</div>
              <InputNumber
                min={0}
                value={culledCount}
                onChange={(value) => setCulledCount(Number(value) || 0)}
                parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
                inputMode="numeric"
                placeholder="Enter total count"
                className="!w-full"
                styles={{ input: { fontSize: 16, height: 44 } }}
              />
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-slate-500">Remarks</div>
              <Input.TextArea
                rows={3}
                value={culledRemarks}
                onChange={(event) => setCulledRemarks(event.target.value)}
                placeholder="Add remarks (optional)"
                className="!text-base"
              />
            </div>

            {culledCount <= 0 && (
              <div className="text-xs text-red-500 mt-2">
                Culled Count is required.
              </div>
            )}

            <Button
              type="primary"
              className="mt-4 !h-11 !w-full !rounded-lg !border-0 text-base font-semibold"
              style={{ backgroundColor: "#66bb7a" }}
              onClick={handleSaveCulled}
              disabled={culledCount <= 0 || isSavingCulled}
              loading={isSavingCulled}
            >
              Save
            </Button>
          </div>
        </div>
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
