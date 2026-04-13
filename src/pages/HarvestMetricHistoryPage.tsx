import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid, Drawer, Input, InputNumber } from "antd";
import dayjs from "dayjs";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import { updateGrow } from "../controller/growsCrud";
import { loadHarvestReductionTransactionsByHarvestId } from "../controller/harvestLogsCrud";
import { loadHarvests, loadHarvestTrucks, updateHarvest } from "../controller/harvestCrud";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const PRIMARY = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const HARVEST_LOGS_TABLE = import.meta.env.VITE_SUPABASE_HARVEST_LOGS_TABLE ?? "HarvestLogs";
const HARVEST_REDUCTION_TRANSACTIONS_TABLE =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_TRANSACTIONS_TABLE ?? "HarvestReductionTransactions";
const HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN ?? "animal_count_to_deduct";
const HARVEST_REDUCTION_TYPE_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_TYPE_COLUMN ?? "reduction_type";

type EditableMetric = "mortality" | "thinning" | "takeOut" | "defect";

type ReductionHistoryRow = {
  date: string;
  dayNumber: number;
  value: number;
  avgWeight: number | null;
  remarks: string;
};
type ReductionTx = {
  id: string;
  createdAt: string;
  harvestLogId: number | null;
  animalCount: number;
  reductionType: string | null;
  remarks: string | null;
};

const METRIC_META: Record<EditableMetric, { title: string; accent: string; borderColor: string; dotColor: string }> = {
  mortality: { title: "Mortality", accent: "text-[#f59e0b]", borderColor: "#f59e0b", dotColor: "bg-[#f59e0b]" },
  thinning: { title: "Thinning", accent: "text-[#008822]", borderColor: "#22c55e", dotColor: "bg-[#008822]" },
  takeOut: { title: "Take Out", accent: "text-[#d97706]", borderColor: "#f59e0b", dotColor: "bg-[#f59e0b]" },
  defect: { title: "Defect", accent: "text-[#ea580c]", borderColor: "#f97316", dotColor: "bg-[#f97316]" },
};
const METRIC_CARDS: Array<{
  key: EditableMetric;
  label: string;
  borderColor: string;
  accent: string;
  icon: React.ReactNode;
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
    key: "defect",
    label: "Defect",
    borderColor: "#f97316",
    accent: "text-[#ea580c]",
    icon: <img src="/img/chicken-head.svg" alt="Defect" className="h-10 w-10" />,
  },
];

const toMetric = (value: string | undefined): EditableMetric | null => {
  if (value === "mortality" || value === "thinning" || value === "takeOut" || value === "defect") {
    return value;
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
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

export default function HarvestMetricHistoryPage() {
  const navigate = useNavigate();
  const { id, metric } = useParams<{ id: string; metric?: string }>();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const selectedMetric = toMetric(metric);
  const isSelectorPage = selectedMetric == null;
  const selectedDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [activeGrowId, setActiveGrowId] = useState<number | null>(null);
  const [activeHarvestId, setActiveHarvestId] = useState<number | null>(null);
  const [selectedDayTotalAnimals, setSelectedDayTotalAnimals] = useState(0);
  const [harvestTotalAnimalsOut, setHarvestTotalAnimalsOut] = useState(0);
  const [reductionRows, setReductionRows] = useState<ReductionTx[]>([]);
  const [historyByMetric, setHistoryByMetric] = useState<Record<EditableMetric, ReductionHistoryRow[]>>({
    mortality: [],
    thinning: [],
    takeOut: [],
    defect: [],
  });
  const [metricTotals, setMetricTotals] = useState<Record<EditableMetric, number>>({
    mortality: 0,
    thinning: 0,
    takeOut: 0,
    defect: 0,
  });
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState(false);
  const [activeDayRow, setActiveDayRow] = useState<ReductionHistoryRow | null>(null);
  const [dayCountDraft, setDayCountDraft] = useState(0);
  const [dayRemarksDraft, setDayRemarksDraft] = useState("");
  const [dayPreviousValue, setDayPreviousValue] = useState(0);
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const loadHarvestSummaryForGrow = async (growId: number) => {
    const harvests = await loadHarvests({ growId, limit: 500 });
    if (harvests.length === 0) {
      return {
        latestHarvestId: null as number | null,
        totalAnimalsOut: 0,
        allTrucks: [] as Awaited<ReturnType<typeof loadHarvestTrucks>>,
        allReductions: [] as Awaited<ReturnType<typeof loadHarvestReductionTransactionsByHarvestId>>,
        harvests,
      };
    }

    const harvestBundles = await Promise.all(
      harvests.map(async (harvest) => {
        const harvestId = Number(harvest.id);
        const [trucks, reductions] = await Promise.all([
          loadHarvestTrucks({ harvestId, ascending: true, limit: 500 }),
          loadHarvestReductionTransactionsByHarvestId(harvestId),
        ]);

        return { harvest, trucks, reductions };
      })
    );

    return {
      latestHarvestId: Number(harvests[0].id),
      totalAnimalsOut: harvests.reduce(
        (sum, harvest) => sum + Math.max(0, Math.floor(Number(harvest.totalAnimals ?? 0))),
        0
      ),
      allTrucks: harvestBundles.flatMap((entry) => entry.trucks),
      allReductions: harvestBundles.flatMap((entry) => entry.reductions),
      harvests,
    };
  };

  useEffect(() => {
    const loadHistory = async () => {
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId) || buildingId <= 0) {
        setBuildingName("");
        setActiveHarvestId(null);
        setSelectedDayTotalAnimals(0);
        setHarvestTotalAnimalsOut(0);
        setReductionRows([]);
        setHistoryByMetric({ mortality: [], thinning: [], takeOut: [], defect: [] });
        setMetricTotals({ mortality: 0, thinning: 0, takeOut: 0, defect: 0 });
        return;
      }

      setIsLoading(true);
      try {
        const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
        const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

        const [{ data: buildingRow, error: buildingError }, { data: growRows, error: growError }] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("name").eq("id", buildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id, total_animals")
            .eq("building_id", buildingId)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (buildingError) throw buildingError;
        if (growError) throw growError;

        setBuildingName(buildingRow?.name ?? `Building ${buildingId}`);

        const latestGrow = ((growRows ?? []) as Array<{ id: number | null; total_animals?: number | null }>)[0] ?? null;
        const activeGrowId = latestGrow?.id ?? null;
        setActiveGrowId(activeGrowId);
        const growFallbackTotal = Math.max(0, Math.floor(Number(latestGrow?.total_animals ?? 0)));
        let resolvedSelectedDayTotal = growFallbackTotal;

        if (activeGrowId != null) {
          const { data: selectedDayGrowLogs, error: selectedDayGrowLogsError } = await supabase
            .from(GROW_LOGS_TABLE)
            .select("actual_total_animals, created_at")
            .eq("grow_id", activeGrowId)
            .gte("created_at", selectedDayStart)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1);
          if (selectedDayGrowLogsError) throw selectedDayGrowLogsError;

          const selectedDayGrowLog = ((selectedDayGrowLogs ?? []) as Array<{ actual_total_animals: number | null }>)[0] ?? null;
          if (selectedDayGrowLog) {
            resolvedSelectedDayTotal = Math.max(0, Math.floor(Number(selectedDayGrowLog.actual_total_animals ?? 0)));
          } else {
            const { data: previousGrowLogs, error: previousGrowLogsError } = await supabase
              .from(GROW_LOGS_TABLE)
              .select("actual_total_animals, created_at")
              .eq("grow_id", activeGrowId)
              .lt("created_at", selectedDayStart)
              .order("created_at", { ascending: false })
              .limit(1);
            if (previousGrowLogsError) throw previousGrowLogsError;

            const previousGrowLog = ((previousGrowLogs ?? []) as Array<{ actual_total_animals: number | null }>)[0] ?? null;
            if (previousGrowLog) {
              resolvedSelectedDayTotal = Math.max(0, Math.floor(Number(previousGrowLog.actual_total_animals ?? 0)));
            }
          }
        }

        setSelectedDayTotalAnimals(resolvedSelectedDayTotal);
        if (activeGrowId == null) {
          setActiveHarvestId(null);
          setHarvestTotalAnimalsOut(0);
          setReductionRows([]);
          setHistoryByMetric({ mortality: [], thinning: [], takeOut: [], defect: [] });
          setMetricTotals({ mortality: 0, thinning: 0, takeOut: 0, defect: 0 });
          return;
        }

        const harvestSummary = await loadHarvestSummaryForGrow(activeGrowId);
        if (harvestSummary.latestHarvestId == null) {
          setActiveHarvestId(null);
          setHarvestTotalAnimalsOut(0);
          setReductionRows([]);
          setHistoryByMetric({ mortality: [], thinning: [], takeOut: [], defect: [] });
          setMetricTotals({ mortality: 0, thinning: 0, takeOut: 0, defect: 0 });
          return;
        }

        setActiveHarvestId(harvestSummary.latestHarvestId);
        setHarvestTotalAnimalsOut(harvestSummary.totalAnimalsOut);

        const trucks = harvestSummary.allTrucks;
        const reductions = harvestSummary.allReductions;
        setReductionRows(
          reductions.map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
            harvestLogId: row.harvestLogId !== null ? Number(row.harvestLogId) : null,
            animalCount: Math.max(0, Math.floor(Number(row.animalCount ?? 0))),
            reductionType: row.reductionType,
            remarks: row.remarks,
          }))
        );

        if (trucks.length === 0) {
          setHistoryByMetric({ mortality: [], thinning: [], takeOut: [], defect: [] });
          setMetricTotals({ mortality: 0, thinning: 0, takeOut: 0, defect: 0 });
          return;
        }

        const firstTruckDate = dayjs(trucks[0].createdAt).startOf("day");
        const endDate = dayjs(selectedDate, "YYYY-MM-DD").startOf("day");

        const avgWeightByDate = trucks.reduce<Record<string, { birds: number; netWeight: number }>>((acc, truck) => {
          const dateKey = dayjs(truck.createdAt).format("YYYY-MM-DD");
          const birds = Math.max(0, Math.floor(Number(truck.animalsLoaded ?? 0)));
          const netWeight = Math.max(0, Number(truck.weightWithLoad ?? 0) - Number(truck.weightNoLoad ?? 0));
          acc[dateKey] = acc[dateKey] ?? { birds: 0, netWeight: 0 };
          acc[dateKey].birds += birds;
          acc[dateKey].netWeight += netWeight;
          return acc;
        }, {});

        const nextHistory: Record<EditableMetric, ReductionHistoryRow[]> = {
          mortality: [],
          thinning: [],
          takeOut: [],
          defect: [],
        };
        const nextTotals: Record<EditableMetric, number> = {
          mortality: 0,
          thinning: 0,
          takeOut: 0,
          defect: 0,
        };

        const getMetricValue = (metricKey: EditableMetric, reductionType: string | null, animalCount: number) => {
          if (metricKey === "takeOut") {
            return reductionType === "takeout" || reductionType === "take_out" ? animalCount : 0;
          }
          return reductionType === metricKey ? animalCount : 0;
        };

        for (let cursor = firstTruckDate; cursor.isBefore(endDate) || cursor.isSame(endDate, "day"); cursor = cursor.add(1, "day")) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const dayRows = reductions.filter((row) => dayjs(row.createdAt).format("YYYY-MM-DD") === dateKey);
          const avgWeightData = avgWeightByDate[dateKey];
          const avgWeight = avgWeightData && avgWeightData.birds > 0 ? avgWeightData.netWeight / avgWeightData.birds : null;

          (Object.keys(METRIC_META) as EditableMetric[]).forEach((metricKey) => {
            const value = dayRows.reduce(
              (sum, row) => sum + getMetricValue(metricKey, row.reductionType, Math.max(0, Math.floor(Number(row.animalCount ?? 0)))),
              0
            );
            const remarks =
              dayRows.find(
                (row) => getMetricValue(metricKey, row.reductionType, Math.max(0, Math.floor(Number(row.animalCount ?? 0)))) > 0
              )?.remarks?.trim() ?? "";

            nextHistory[metricKey].push({
              date: dateKey,
              dayNumber: cursor.diff(firstTruckDate, "day") + 1,
              value,
              avgWeight,
              remarks,
            });
            nextTotals[metricKey] += value;
          });
        }

        setHistoryByMetric(nextHistory);
        setMetricTotals(nextTotals);
      } catch (error) {
        setToastMessage(`Failed to load reduction history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [id, selectedDate]);

  const activeHistoryRows = useMemo(
    () => (selectedMetric ? historyByMetric[selectedMetric] : []),
    [historyByMetric, selectedMetric]
  );
  const totalReduction = useMemo(
    () => reductionRows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.animalCount ?? 0))), 0),
    [reductionRows]
  );
  const currentRemaining = Math.max(0, selectedDayTotalAnimals - harvestTotalAnimalsOut - totalReduction);
  const dayMaxAllowed = Math.max(0, currentRemaining + dayPreviousValue);

  const openDayDrawer = (row: ReductionHistoryRow) => {
    setActiveDayRow(row);
    setDayCountDraft(row.value);
    setDayPreviousValue(row.value);
    setDayRemarksDraft(row.remarks);
    setIsDayDrawerOpen(true);
  };

  const closeDayDrawer = () => {
    setIsDayDrawerOpen(false);
    setActiveDayRow(null);
    setDayCountDraft(0);
    setDayPreviousValue(0);
    setDayRemarksDraft("");
  };

  const handleSaveDay = async () => {
    if (!selectedMetric || !activeDayRow || activeHarvestId == null || activeGrowId == null) return;

    const nextValue = Math.max(0, Math.floor(dayCountDraft || 0));
    if (nextValue > dayMaxAllowed) {
      setToastMessage(`Value cannot exceed ${dayMaxAllowed.toLocaleString()} (remaining + current value).`);
      setIsToastOpen(true);
      return;
    }

    setIsSavingDay(true);
    try {
      const dayStart = `${activeDayRow.date}T00:00:00+00:00`;
      const dayEnd = `${dayjs(activeDayRow.date).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
      const reductionType = selectedMetric === "takeOut" ? "takeout" : selectedMetric;
      const existingRowsForDay = reductionRows.filter((row) => dayjs(row.createdAt).format("YYYY-MM-DD") === activeDayRow.date);
      const existingReductionTx =
        existingRowsForDay.find((row) =>
          selectedMetric === "takeOut"
            ? row.reductionType === "takeout" || row.reductionType === "take_out"
            : row.reductionType === reductionType
        ) ?? null;

      const dayTotals = existingRowsForDay.reduce(
        (acc, row) => {
          if (row.reductionType === "mortality") acc.mortality += row.animalCount;
          if (row.reductionType === "thinning") acc.thinning += row.animalCount;
          if (row.reductionType === "takeout" || row.reductionType === "take_out") acc.takeOut += row.animalCount;
          if (row.reductionType === "defect") acc.defect += row.animalCount;
          return acc;
        },
        { mortality: 0, thinning: 0, takeOut: 0, defect: 0 }
      );

      const previousValue = existingReductionTx?.animalCount ?? 0;
      if (selectedMetric === "mortality") dayTotals.mortality = Math.max(0, dayTotals.mortality - previousValue + nextValue);
      if (selectedMetric === "thinning") dayTotals.thinning = Math.max(0, dayTotals.thinning - previousValue + nextValue);
      if (selectedMetric === "takeOut") dayTotals.takeOut = Math.max(0, dayTotals.takeOut - previousValue + nextValue);
      if (selectedMetric === "defect") dayTotals.defect = Math.max(0, dayTotals.defect - previousValue + nextValue);

      const { data: existingLogRows, error: logLookupError } = await supabase
        .from(HARVEST_LOGS_TABLE)
        .select("id")
        .eq("harvest_id", activeHarvestId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(1);
      if (logLookupError) throw logLookupError;

      const existingLogId = (existingLogRows?.[0] as { id: number } | undefined)?.id ?? existingReductionTx?.harvestLogId ?? null;
      const createdAt = existingReductionTx?.createdAt ?? `${activeDayRow.date}T12:00:00+00:00`;

      let harvestLogId = existingLogId;
      if (harvestLogId != null) {
        const { error: updateLogError } = await supabase
          .from(HARVEST_LOGS_TABLE)
          .update({
            mortality: dayTotals.mortality,
            thinning: dayTotals.thinning,
            takeout: dayTotals.takeOut,
            defect: dayTotals.defect,
          })
          .eq("id", harvestLogId);
        if (updateLogError) throw updateLogError;
      } else {
        const { data: insertedLog, error: insertLogError } = await supabase
          .from(HARVEST_LOGS_TABLE)
          .insert([{
            harvest_id: activeHarvestId,
            mortality: dayTotals.mortality,
            thinning: dayTotals.thinning,
            takeout: dayTotals.takeOut,
            defect: dayTotals.defect,
            created_at: createdAt,
          }])
          .select("id")
          .single();
        if (insertLogError) throw insertLogError;
        harvestLogId = Number((insertedLog as { id: number }).id);
      }

      if (existingReductionTx) {
        const payload: Record<string, string | number | null> = {
          harvest_log_id: harvestLogId,
          remarks: dayRemarksDraft.trim() || null,
        };
        payload[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN] = nextValue;
        const { error: updateReductionError } = await supabase
          .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
          .update(payload)
          .eq("id", existingReductionTx.id);
        if (updateReductionError) throw updateReductionError;
      } else {
        const payload: Record<string, string | number | null> = {
          harvest_id: activeHarvestId,
          harvest_log_id: harvestLogId,
          remarks: dayRemarksDraft.trim() || null,
          created_at: createdAt,
        };
        payload[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN] = nextValue;
        payload[HARVEST_REDUCTION_TYPE_COLUMN] = reductionType;
        const { error: insertReductionError } = await supabase
          .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
          .insert([payload]);
        if (insertReductionError) throw insertReductionError;
      }

      const refreshedSummary = await loadHarvestSummaryForGrow(activeGrowId);
      const refreshedReductionTotal = refreshedSummary.allReductions.reduce(
        (sum, row) => sum + Math.max(0, Math.floor(Number(row.animalCount ?? 0))),
        0
      );
      const remainingAfterSave = Math.max(0, selectedDayTotalAnimals - refreshedSummary.totalAnimalsOut - refreshedReductionTotal);

      if (remainingAfterSave <= 0) {
        await Promise.all(
          refreshedSummary.harvests.map((harvest) =>
            updateHarvest(harvest.id, {
              status: "Completed",
            })
          )
        );

        const updateGrowResult = await updateGrow(activeGrowId, {
          grow: {
            status: "Harvested",
            is_harvested: true,
          },
        });

        if (updateGrowResult.error) {
          const { error: growUpdateError } = await supabase
            .from(GROWS_TABLE)
            .update({
              status: "Harvested",
              is_harvested: true,
            })
            .eq("id", activeGrowId);

          if (growUpdateError) throw growUpdateError;
        }
      }

      setToastMessage(`${METRIC_META[selectedMetric].title} updated successfully.`);
      setIsToastOpen(true);
      closeDayDrawer();
      window.location.reload();
    } catch (error) {
      setToastMessage(`Failed to save ${METRIC_META[selectedMetric].title.toLowerCase()}: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsSavingDay(false);
    }
  };

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
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Harvest</div>
            <Title level={4} className="!m-0 !text-white !text-lg">
              Reduction History
            </Title>
          </div>
        </div>

        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
        ) : isSelectorPage ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {METRIC_CARDS.map((card) => {
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => navigate(`/harvest-metric-history/${id}/${card.key}?date=${selectedDate}`)}
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
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          {buildingName || `Building ${id}`}
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
                        <div className="text-xl font-bold text-slate-900 sm:text-2xl">{metricTotals[card.key].toLocaleString()}</div>
                        <div className="text-[11px] font-medium text-slate-500">birds</div>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-[#008822]/0 via-[#008822]/10 to-[#008822]/0" />
                  </button>
                );
              })}
            </div>
          </>
        ) : activeHistoryRows.length === 0 ? (
          <ChickenState
            title="No history yet"
            subtitle={`No ${METRIC_META[selectedMetric].title.toLowerCase()} data found after the first truck was added.`}
            fullScreen
          />
        ) : (
          <>
            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-4 shadow-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {buildingName || `Building ${id}`}
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">{METRIC_META[selectedMetric].title} Daily History</div>
                <div className="mt-2 text-sm text-slate-600">
                  Showing day 1 to {dayjs(selectedDate).format("MMMM D, YYYY")}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">{activeHistoryRows.length}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</span>
                  <span className="text-sm font-bold text-slate-900">{metricTotals[selectedMetric].toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {activeHistoryRows.map((row) => (
                <div
                  key={`${selectedMetric}-${row.date}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDayDrawer(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDayDrawer(row);
                    }
                  }}
                  className="rounded-sm border border-emerald-200 bg-white px-4 py-3 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={["h-2.5 w-2.5 rounded-full", METRIC_META[selectedMetric].dotColor].join(" ")} aria-hidden="true" />
                        <div className="text-sm font-semibold text-slate-900">Day {row.dayNumber}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{dayjs(row.date).format("MMMM D, YYYY")}</div>
                      {row.remarks ? (
                        <div className="mt-2 text-xs text-slate-500">
                          Remarks: <span className="font-medium text-slate-700">{row.remarks}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-[108px] text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{METRIC_META[selectedMetric].title}</div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">{row.value.toLocaleString()}</div>
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Content>

      <Drawer
        open={isDayDrawerOpen}
        onClose={closeDayDrawer}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="harvest-metric-day-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            {selectedMetric ? `Update ${METRIC_META[selectedMetric].title}` : "Update"}
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            {activeDayRow ? dayjs(activeDayRow.date).format("MMMM D, YYYY") : ""}
          </div>
          <div className="text-slate-600 text-sm mt-2">
            Remaining: <span className="font-semibold text-slate-900">{currentRemaining.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">Count</div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setDayCountDraft((value) => Math.max(0, value - 1))}>-</Button>
            <InputNumber
              min={0}
              value={dayCountDraft}
              onChange={(value) => setDayCountDraft(Math.max(0, Math.floor(Number(value) || 0)))}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
            <Button onClick={() => setDayCountDraft((value) => value + 1)} disabled={dayCountDraft >= dayMaxAllowed}>
              +
            </Button>
          </div>
          {dayCountDraft > dayMaxAllowed && (
            <div className="mt-2 text-xs text-red-500">
              Value cannot exceed {dayMaxAllowed.toLocaleString()} (remaining + current value).
            </div>
          )}
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 mb-2">Remarks</div>
            <Input.TextArea
              rows={3}
              value={dayRemarksDraft}
              onChange={(e) => setDayRemarksDraft(e.target.value)}
              placeholder="Add remarks (optional)"
              className="!text-base"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeDayDrawer}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!flex-1"
            style={{ backgroundColor: "#ffa600", borderColor: "#ffa600" }}
            onClick={handleSaveDay}
            loading={isSavingDay}
          >
            Save
          </Button>
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
