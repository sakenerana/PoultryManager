// HarvestBuildingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker, Drawer, InputNumber, Input } from "antd";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import { getHarvestById, loadHarvests, loadHarvestTrucks } from "../controller/harvestCrud";
import {
  addHarvestLog,
  addHarvestReductionTransaction,
  loadHarvestReductionTransactionsByHarvestId,
  updateHarvestReductionTransaction,
} from "../controller/harvestLogsCrud";
import type { HarvestReductionType } from "../type/harvestLogs.type";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Building = {
  id: string;
  growId: number;
  name: string;
  days: number;
  total: number;
  growStatus: "Growing" | "Harvested";
};

type BuildingStats = {
  days: number;
  total: number;
  status: "Growing" | "Harvested";
  avgWeight: number;
  trucks: number;
  reduction: number;
  totalHarvested: number;
  mortality: number;
  thinning: number;
  takeOut: number;
  remaining: number;
  defect: number;
};
type EditableMetric = "mortality" | "thinning" | "takeOut" | "defect";
type ReductionHistoryRow = {
  date: string;
  dayNumber: number;
  value: number;
  avgWeight: number | null;
  remarks: string;
};

type BuildingCardTheme = {
  cardBorder: string;
  cardBackground: string;
  pillBorder: string;
  pillBackground: string;
  iconBackground: string;
  tagBorder: string;
  tagBackground: string;
  tagText: string;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const STAT_PILL_BORDER_COLORS = ["#e8d15d", "#b8cf6a", "#8fcf8b", "#9ac7e8", "#d6b4f7", "#f2b36f"];
const BUILDING_CARD_THEMES: BuildingCardTheme[] = [
  {
    cardBorder: "#3a500b",
    cardBackground: "white",
    pillBorder: "#d9e7a2",
    pillBackground: "#f1f5f9",
    iconBackground: "#f1f5f9",
    tagBorder: "#e8d15d",
    tagBackground: "#fff5c4",
    tagText: "#b28700",
  },
  {
    cardBorder: "#3a500b",
    cardBackground: "white",
    pillBorder: "#c8e0b6",
    pillBackground: "#f1f5f9",
    iconBackground: "#f1f5f9",
    tagBorder: "#d7d56b",
    tagBackground: "#f8f6c9",
    tagText: "#7c8a13",
  },
  {
    cardBorder: "#3a500b",
    cardBackground: "white",
    pillBorder: "#d7d88e",
    pillBackground: "#f1f5f9",
    iconBackground: "#f1f5f9",
    tagBorder: "#d9c94d",
    tagBackground: "#fff0af",
    tagText: "#9f8400",
  },
  {
    cardBorder: "#3a500b",
    cardBackground: "white",
    pillBorder: "#cfe3bc",
    pillBackground: "#f1f5f9",
    iconBackground: "#f1f5f9",
    tagBorder: "#d6d46e",
    tagBackground: "#fbf7cb",
    tagText: "#7d8914",
  },
];
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const REDUCTION_TYPE_BY_METRIC: Record<EditableMetric, HarvestReductionType> = {
  mortality: "mortality",
  thinning: "thinning",
  takeOut: "takeout",
  defect: "defect",
};
const EMPTY_REDUCTION_TOTALS: Record<EditableMetric, number> = {
  mortality: 0,
  thinning: 0,
  takeOut: 0,
  defect: 0,
};
const EMPTY_REDUCTION_HISTORY: Record<EditableMetric, ReductionHistoryRow[]> = {
  mortality: [],
  thinning: [],
  takeOut: [],
  defect: [],
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}

const getBuildingCardTheme = (seed: string): BuildingCardTheme => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BUILDING_CARD_THEMES[hash % BUILDING_CARD_THEMES.length];
};

const getStatPillBorderColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return STAT_PILL_BORDER_COLORS[hash % STAT_PILL_BORDER_COLORS.length];
};

const withAlpha = (hex: string, alpha: string): string => `${hex}${alpha}`;

function StatPill({
  label,
  value,
  leftIcon,
  rightIcon,
  onClick,
  borderColor,
  backgroundColor,
}: {
  label: string;
  value: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
  theme: BuildingCardTheme;
  borderColor: string;
  backgroundColor: string;
}) {
  return (
    <div
      className={[
        "rounded-lg px-2 py-1.5",
        onClick ? "cursor-pointer transition" : "",
      ].join(" ")}
      style={{
        border: `1px solid ${borderColor}`,
        background: backgroundColor,
      }}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className="text-[10px] text-slate-500 leading-none">{label}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 leading-none">
          {leftIcon}
          {value}
        </div>
        {rightIcon}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BuildingStats["status"] }) {
  const styles: Record<BuildingStats["status"], { pill: string; dot: string; text: string }> = {
    Growing: {
      pill: "bg-emerald-100 border-emerald-200",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
    },
    Harvested: {
      pill: "bg-amber-100 border-amber-200",
      dot: "bg-amber-500",
      text: "text-amber-800",
    },
  };

  const style = styles[status];

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm",
        style.pill,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", style.dot].join(" ")} />
      <span className={style.text}>{status}</span>
    </span>
  );
}

function ChickenState({
  title,
  subtitle,
  fullScreen,
  titleClassName,
  subtitleClassName,
}: {
  title: string;
  subtitle: string;
  fullScreen?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
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
      <div className={["mt-3 text-sm font-semibold", titleClassName ?? "text-slate-700"].join(" ")}>{title}</div>
      <div className={["mt-1 text-xs", subtitleClassName ?? "text-slate-500"].join(" ")}>{subtitle}</div>
    </div>
  );
}

function BuildingRow({
  b,
  onOpen,
  isMobile,
  stats,
  onReductionClick,
  onAvgWeightClick,
  onTrucksClick,
  theme,
}: {
  b: Building;
  onOpen: () => void;
  isMobile: boolean;
  stats: BuildingStats;
  onReductionClick: (buildingId: string) => void;
  onAvgWeightClick: (buildingId: string) => void;
  onTrucksClick: (buildingId: string) => void;
  theme: BuildingCardTheme;
}) {
  const remainingBirds = stats.remaining;
  const remainingPercentage = stats.total > 0 ? (remainingBirds / stats.total) * 100 : 0;
  const isHarvested = stats.status === "Harvested";
  return (
    <Card
      hoverable={!isHarvested}
      onClick={isHarvested ? undefined : onOpen}
      className={[
        "!border !overflow-hidden shadow-sm transition h-full",
        isHarvested ? "opacity-80 cursor-not-allowed" : "hover:shadow-md cursor-pointer",
        "!rounded-sm",
      ].join(" ")}
      style={{
        background: theme.cardBackground,
        borderColor: theme.cardBorder,
      }}
      bodyStyle={{ padding: isMobile ? 10 : 14, background: "transparent" }}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-sm" : "h-10 w-10 rounded-sm"].join(
            " "
          )}
          style={{ background: theme.iconBackground }}
        >
          <img
            src="/img/building4.svg"
            alt="Building"
            className={isMobile ? "h-4 w-4 opacity-80" : "h-5 w-5 opacity-80"}
            style={{ filter: "grayscale(1) contrast(1.05) sepia(0.35) hue-rotate(28deg) saturate(1.2)" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
                  {b.name}
                </div>
                <Tag
                  className="!m-0"
                  style={{
                    borderColor: theme.tagBorder,
                    backgroundColor: theme.tagBackground,
                    color: theme.tagText,
                    fontSize: isMobile ? 10 : 11,
                    paddingInline: isMobile ? 6 : 7,
                    lineHeight: isMobile ? "16px" : "18px",
                  }}
                >
                  {stats.days} Days
                </Tag>
              </div>
            </div>

            <div className="shrink-0">
              <StatusBadge status={stats.status} />
            </div>
          </div>

          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Total Birds"
              value={stats.total.toLocaleString()}
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-total-birds`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-total-birds`), "12")}
            />
            <StatPill
              label="Current"
              value={(
                <span>
                  {remainingBirds.toLocaleString()}{" "}
                  <span className="text-[10px] font-medium text-slate-500">
                    ({remainingPercentage.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%)
                  </span>
                </span>
              )}
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-current`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-current`), "12")}
            />
            <StatPill
              label="Avg Weight"
              value=""
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-avg-weight`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-avg-weight`), "12")}
              onClick={isHarvested ? undefined : () => onAvgWeightClick(b.id)}
            />
            <StatPill
              label="Total Birds Harvested"
              value={stats.totalHarvested.toLocaleString()}
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-total-harvested`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-total-harvested`), "12")}
            />
            <StatPill
              label="Trucks"
              value={stats.trucks.toLocaleString()}
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-trucks`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-trucks`), "12")}
              onClick={isHarvested ? undefined : () => onTrucksClick(b.id)}
            />
            <StatPill
              label="Reduction"
              value={stats.reduction.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              theme={theme}
              borderColor={getStatPillBorderColor(`${b.id}-take-out`)}
              backgroundColor={withAlpha(getStatPillBorderColor(`${b.id}-take-out`), "12")}
              onClick={isHarvested ? undefined : () => onReductionClick(b.id)}
            />
          </div>
        </div>

      </div>
    </Card>
  );
}

export default function HarvestBuildingPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingMetric, setIsSavingMetric] = useState(false);
  const [hasTruckByBuildingId, setHasTruckByBuildingId] = useState<Record<string, { harvestId: number | null; hasTruck: boolean }>>({});
  const [harvestAnimalsOutByBuilding, setHarvestAnimalsOutByBuilding] = useState<Record<string, Record<string, number>>>({});
  const [currentTotalByBuildingId, setCurrentTotalByBuildingId] = useState<Record<string, number>>({});
  const [avgWeightByBuildingId, setAvgWeightByBuildingId] = useState<Record<string, Record<string, number>>>({});
  const [truckCountByBuildingId, setTruckCountByBuildingId] = useState<Record<string, Record<string, number>>>({});
  const [metricOverrides, setMetricOverrides] = useState<Record<EditableMetric, Record<string, Record<string, number>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
    defect: {},
  });
  const [metricRemarksByType, setMetricRemarksByType] = useState<Record<EditableMetric, Record<string, Record<string, string>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
    defect: {},
  });
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<EditableMetric>("mortality");
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);
  const [activeMetricRemaining, setActiveMetricRemaining] = useState<number | null>(null);
  const [activeMetricPreviousValue, setActiveMetricPreviousValue] = useState(0);
  const [metricDraft, setMetricDraft] = useState<number>(0);
  const [metricRemarksDraft, setMetricRemarksDraft] = useState<string>("");
  const [isReductionDrawerOpen, setIsReductionDrawerOpen] = useState(false);
  const [activeReductionBuildingId, setActiveReductionBuildingId] = useState<string | null>(null);
  const [activeReductionHistoryMetric, setActiveReductionHistoryMetric] = useState<EditableMetric | null>(null);
  const isReductionHistoryLoading = false;
  const [reductionHistoryByMetric, setReductionHistoryByMetric] =
    useState<Record<EditableMetric, ReductionHistoryRow[]>>(EMPTY_REDUCTION_HISTORY);
  const [reductionTotalsByMetric, setReductionTotalsByMetric] =
    useState<Record<EditableMetric, number>>(EMPTY_REDUCTION_TOTALS);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const fetchBuildingsFromGrows = async () => {
    try {
      setIsLoading(true);
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

      const { data: growRows, error: growsError } = await supabase
        .from(GROWS_TABLE)
        .select("id, building_id, total_animals, created_at, status, is_harvested")
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false });

      if (growsError) throw growsError;

      const latestByBuildingId: Record<number, { growId: number; total: number; createdAt: string; status: string }> = {};
      ((growRows ?? []) as Array<{
        id?: number | null;
        building_id: number | null;
        total_animals: number | null;
        created_at: string;
        status?: string | null;
        is_harvested?: boolean | null;
      }>).forEach((row) => {
        if (row.building_id == null || row.id == null) return;
        if (latestByBuildingId[row.building_id]) return;
        const normalizedStatus = String(row.status ?? "").trim().toLowerCase();
        const status = row.is_harvested === true || normalizedStatus === "harvested" ? "harvested" : normalizedStatus;
        latestByBuildingId[row.building_id] = {
          growId: Number(row.id),
          total: Math.max(0, Math.floor(Number(row.total_animals ?? 0))),
          createdAt: row.created_at,
          status,
        };
      });

      const buildingIds = Object.entries(latestByBuildingId)
        .filter(([, latest]) => latest.status === "growing" || latest.status === "harvested")
        .map(([id]) => Number(id));
      if (buildingIds.length === 0) {
        setBuildings([]);
        return;
      }

      const { data: buildingRows, error: buildingsError } = await supabase
        .from(BUILDINGS_TABLE)
        .select("id, name")
        .in("id", buildingIds);

      if (buildingsError) throw buildingsError;

      const nameById: Record<number, string> = {};
      ((buildingRows ?? []) as Array<{ id: number; name: string | null }>).forEach((row) => {
        nameById[row.id] = row.name ?? `Building ${row.id}`;
      });

      const mapped = buildingIds.map((buildingId) => {
        const latest = latestByBuildingId[buildingId];
        const days = Math.max(
          0,
          dayjs.utc(selectedDate, "YYYY-MM-DD").startOf("day").diff(dayjs.utc(latest.createdAt).startOf("day"), "day")
        );
        const growStatus: Building["growStatus"] = latest.status === "harvested" ? "Harvested" : "Growing";
        return {
          id: String(buildingId),
          growId: latest.growId,
          name: nameById[buildingId] ?? `Building ${buildingId}`,
          days,
          total: latest.total,
          growStatus,
        };
      });

      setBuildings(mapped);
    } catch (error) {
      console.error("Failed to load harvest buildings:", error);
      setBuildings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBuildingsFromGrows();
  }, [selectedDate]);

  const fetchCurrentTotalsByDate = async () => {
    if (buildings.length === 0) {
      setCurrentTotalByBuildingId({});
      return;
    }

    try {
      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
      const growIds = buildings
        .map((building) => building.growId)
        .filter((growId): growId is number => Number.isFinite(growId));

      if (growIds.length === 0) {
        setCurrentTotalByBuildingId({});
        return;
      }

      const latestGrowLogByGrowId: Record<number, number> = {};

      const { data: selectedDayGrowLogs, error: selectedDayGrowLogsError } = await supabase
        .from(GROW_LOGS_TABLE)
        .select("grow_id, actual_total_animals, created_at")
        .in("grow_id", growIds)
        .gte("created_at", selectedDayStart)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false });

      if (selectedDayGrowLogsError) throw selectedDayGrowLogsError;

      ((selectedDayGrowLogs ?? []) as Array<{
        grow_id: number | null;
        actual_total_animals: number | null;
      }>).forEach((row) => {
        if (row.grow_id == null || latestGrowLogByGrowId[row.grow_id] != null) return;
        latestGrowLogByGrowId[row.grow_id] = Math.max(0, Math.floor(Number(row.actual_total_animals ?? 0)));
      });

      const missingGrowIds = growIds.filter((growId) => latestGrowLogByGrowId[growId] == null);
      if (missingGrowIds.length > 0) {
        const { data: previousGrowLogs, error: previousGrowLogsError } = await supabase
          .from(GROW_LOGS_TABLE)
          .select("grow_id, actual_total_animals, created_at")
          .in("grow_id", missingGrowIds)
          .lt("created_at", selectedDayStart)
          .order("created_at", { ascending: false });

        if (previousGrowLogsError) throw previousGrowLogsError;

        ((previousGrowLogs ?? []) as Array<{
          grow_id: number | null;
          actual_total_animals: number | null;
        }>).forEach((row) => {
          if (row.grow_id == null || latestGrowLogByGrowId[row.grow_id] != null) return;
          latestGrowLogByGrowId[row.grow_id] = Math.max(0, Math.floor(Number(row.actual_total_animals ?? 0)));
        });
      }

      const nextCurrentTotals = Object.fromEntries(
        buildings.map((building) => [
          building.id,
          latestGrowLogByGrowId[building.growId] ?? building.total,
        ])
      );

      setCurrentTotalByBuildingId(nextCurrentTotals);
    } catch (error) {
      console.error("Failed to load current harvest totals:", error);
      setCurrentTotalByBuildingId(
        Object.fromEntries(buildings.map((building) => [building.id, building.total]))
      );
    }
  };

  useEffect(() => {
    void fetchCurrentTotalsByDate();
  }, [buildings, selectedDate]);

  const isSameSelectedDate = (dateTime: string): boolean =>
    dayjs(dateTime).format("YYYY-MM-DD") === selectedDate;

  const getHarvestForBuilding = async (
    building: Building
  ): Promise<{ harvestId: number; totalAnimalsOut: number } | null> => {
    const byGrow = await loadHarvests({ growId: building.growId, limit: 1 });
    if (byGrow.length > 0) {
      return {
        harvestId: Number(byGrow[0].id),
        totalAnimalsOut: Math.max(0, Math.floor(Number(byGrow[0].totalAnimals ?? 0))),
      };
    }

    const byBuilding = await loadHarvests({ buildingId: Number(building.id), limit: 1 });
    if (byBuilding.length > 0) {
      return {
        harvestId: Number(byBuilding[0].id),
        totalAnimalsOut: Math.max(0, Math.floor(Number(byBuilding[0].totalAnimals ?? 0))),
      };
    }

    return null;
  };

  const fetchHarvestMetricsByDate = async () => {
    if (buildings.length === 0) {
      setHasTruckByBuildingId({});
      setHarvestAnimalsOutByBuilding((prev) => ({ ...prev, [selectedDate]: {} }));
      setMetricOverrides((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: {} },
        thinning: { ...prev.thinning, [selectedDate]: {} },
        takeOut: { ...prev.takeOut, [selectedDate]: {} },
        defect: { ...prev.defect, [selectedDate]: {} },
      }));
      setMetricRemarksByType((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: {} },
        thinning: { ...prev.thinning, [selectedDate]: {} },
        takeOut: { ...prev.takeOut, [selectedDate]: {} },
        defect: { ...prev.defect, [selectedDate]: {} },
      }));
      return;
    }

    try {
      const mortalityByBuilding: Record<string, number> = {};
      const thinningByBuilding: Record<string, number> = {};
      const takeOutByBuilding: Record<string, number> = {};
      const defectByBuilding: Record<string, number> = {};
      const mortalityRemarksByBuilding: Record<string, string> = {};
      const thinningRemarksByBuilding: Record<string, string> = {};
      const takeOutRemarksByBuilding: Record<string, string> = {};
      const defectRemarksByBuilding: Record<string, string> = {};
      const editMap: Record<string, { harvestId: number | null; hasTruck: boolean }> = {};
      const harvestAnimalsOutMap: Record<string, number> = {};
      const avgWeightMap: Record<string, number> = {};
      const truckCountMap: Record<string, number> = {};

      await Promise.all(
        buildings.map(async (building) => {
          const harvestInfo = await getHarvestForBuilding(building);
          if (harvestInfo == null) {
            editMap[building.id] = { harvestId: null, hasTruck: false };
            harvestAnimalsOutMap[building.id] = 0;
            return;
          }

          const [trucks, reductions] = await Promise.all([
            loadHarvestTrucks({ harvestId: harvestInfo.harvestId, limit: 500 }),
            loadHarvestReductionTransactionsByHarvestId(harvestInfo.harvestId),
          ]);

          editMap[building.id] = { harvestId: harvestInfo.harvestId, hasTruck: trucks.length > 0 };
          harvestAnimalsOutMap[building.id] = harvestInfo.totalAnimalsOut;
          truckCountMap[building.id] = trucks.length;
          const totalBirdsLoaded = trucks.reduce(
            (sum, truck) => sum + Math.max(0, Math.floor(Number(truck.animalsLoaded ?? 0))),
            0
          );
          const totalNetWeight = trucks.reduce(
            (sum, truck) => sum + Math.max(0, Number(truck.weightWithLoad ?? 0) - Number(truck.weightNoLoad ?? 0)),
            0
          );
          avgWeightMap[building.id] = totalBirdsLoaded > 0 ? totalNetWeight / totalBirdsLoaded : 0;

          const selectedDayRows = reductions.filter((row) => isSameSelectedDate(row.createdAt));
          mortalityByBuilding[building.id] = 0;
          thinningByBuilding[building.id] = 0;
          takeOutByBuilding[building.id] = 0;
          defectByBuilding[building.id] = 0;

          selectedDayRows.forEach((row) => {
            const count = Math.max(0, Math.floor(Number(row.animalCount ?? 0)));
            if (row.reductionType === "mortality") mortalityByBuilding[building.id] += count;
            if (row.reductionType === "thinning") thinningByBuilding[building.id] += count;
            if (row.reductionType === "take_out" || row.reductionType === "takeout") takeOutByBuilding[building.id] += count;
            if (row.reductionType === "defect") defectByBuilding[building.id] += count;
          });

          const latestRemarkByType: Record<string, string> = {};
          selectedDayRows.forEach((row) => {
            if (!row.reductionType) return;
            if (latestRemarkByType[row.reductionType] != null) return;
            latestRemarkByType[row.reductionType] = row.remarks ?? "";
          });

          mortalityRemarksByBuilding[building.id] = latestRemarkByType.mortality ?? "";
          thinningRemarksByBuilding[building.id] = latestRemarkByType.thinning ?? "";
          takeOutRemarksByBuilding[building.id] = latestRemarkByType.take_out ?? latestRemarkByType.takeout ?? "";
          defectRemarksByBuilding[building.id] = latestRemarkByType.defect ?? "";
        })
      );

      setHasTruckByBuildingId(editMap);
      setHarvestAnimalsOutByBuilding((prev) => ({
        ...prev,
        [selectedDate]: harvestAnimalsOutMap,
      }));
      setAvgWeightByBuildingId((prev) => ({
        ...prev,
        [selectedDate]: avgWeightMap,
      }));
      setTruckCountByBuildingId((prev) => ({
        ...prev,
        [selectedDate]: truckCountMap,
      }));
      setMetricOverrides((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: mortalityByBuilding },
        thinning: { ...prev.thinning, [selectedDate]: thinningByBuilding },
        takeOut: { ...prev.takeOut, [selectedDate]: takeOutByBuilding },
        defect: { ...prev.defect, [selectedDate]: defectByBuilding },
      }));
      setMetricRemarksByType((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: mortalityRemarksByBuilding },
        thinning: { ...prev.thinning, [selectedDate]: thinningRemarksByBuilding },
        takeOut: { ...prev.takeOut, [selectedDate]: takeOutRemarksByBuilding },
        defect: { ...prev.defect, [selectedDate]: defectRemarksByBuilding },
      }));
    } catch (error) {
      setToastMessage(`Failed to load harvest reductions: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  useEffect(() => {
    void fetchHarvestMetricsByDate();
  }, [buildings, selectedDate]);

  const metricMeta: Record<EditableMetric, { title: string; helper: string; label: string }> = {
    mortality: {
      title: "Mortality",
      helper: "Adjust the mortality count for this building.",
      label: "Mortality Count",
    },
    thinning: {
      title: "Thinning",
      helper: "Adjust the thinning count for this building.",
      label: "Thinning Count",
    },
    takeOut: {
      title: "Take Out",
      helper: "Adjust the take out count for this building.",
      label: "Take Out Count",
    },
    defect: {
      title: "Defect",
      helper: "Adjust the defect count for this building.",
      label: "Defect Count",
    },
  };
  const reductionCardMeta: Record<EditableMetric, { accent: string; borderColor: string; dotColor: string }> = {
    mortality: { accent: "text-red-600", borderColor: "#fecaca", dotColor: "bg-red-500" },
    thinning: { accent: "text-slate-600", borderColor: "#cbd5e1", dotColor: "bg-slate-400" },
    takeOut: { accent: "text-amber-600", borderColor: "#fde68a", dotColor: "bg-amber-500" },
    defect: { accent: "text-orange-600", borderColor: "#fdba74", dotColor: "bg-orange-500" },
  };

  const getReductionValueForType = (metric: EditableMetric, row: {
    reductionType: HarvestReductionType | null;
    animalCount: number;
  }): number => {
    if (metric === "takeOut") {
      return row.reductionType === "takeout" || row.reductionType === "take_out" ? row.animalCount : 0;
    }
    return row.reductionType === REDUCTION_TYPE_BY_METRIC[metric] ? row.animalCount : 0;
  };

  const loadReductionHistory = async (buildingId: string) => {
    const selectedBuilding = buildings.find((item) => item.id === buildingId);
    if (!selectedBuilding) {
      setReductionHistoryByMetric(EMPTY_REDUCTION_HISTORY);
      setReductionTotalsByMetric(EMPTY_REDUCTION_TOTALS);
      return;
    }

    const harvestInfo = await getHarvestForBuilding(selectedBuilding);
    if (!harvestInfo) {
      setReductionHistoryByMetric(EMPTY_REDUCTION_HISTORY);
      setReductionTotalsByMetric(EMPTY_REDUCTION_TOTALS);
      return;
    }

    const [trucks, reductions] = await Promise.all([
      loadHarvestTrucks({ harvestId: harvestInfo.harvestId, ascending: true, limit: 500 }),
      loadHarvestReductionTransactionsByHarvestId(harvestInfo.harvestId),
    ]);

    if (trucks.length === 0) {
      setReductionHistoryByMetric(EMPTY_REDUCTION_HISTORY);
      setReductionTotalsByMetric(EMPTY_REDUCTION_TOTALS);
      return;
    }

    const firstTruckDate = dayjs(trucks[0].createdAt).startOf("day");
    const selectedHistoryDate = dayjs(selectedDate, "YYYY-MM-DD").startOf("day");
    if (firstTruckDate.isAfter(selectedHistoryDate)) {
      setReductionHistoryByMetric(EMPTY_REDUCTION_HISTORY);
      setReductionTotalsByMetric(EMPTY_REDUCTION_TOTALS);
      return;
    }

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

    const avgWeightByDate = trucks.reduce<Record<string, { birds: number; netWeight: number }>>((acc, truck) => {
      const dateKey = dayjs(truck.createdAt).format("YYYY-MM-DD");
      const birds = Math.max(0, Math.floor(Number(truck.animalsLoaded ?? 0)));
      const netWeight = Math.max(0, Number(truck.weightWithLoad ?? 0) - Number(truck.weightNoLoad ?? 0));
      acc[dateKey] = acc[dateKey] ?? { birds: 0, netWeight: 0 };
      acc[dateKey].birds += birds;
      acc[dateKey].netWeight += netWeight;
      return acc;
    }, {});

    for (
      let cursor = firstTruckDate;
      cursor.isBefore(selectedHistoryDate) || cursor.isSame(selectedHistoryDate, "day");
      cursor = cursor.add(1, "day")
    ) {
      const dateKey = cursor.format("YYYY-MM-DD");
      const dayRows = reductions.filter((row) => dayjs(row.createdAt).format("YYYY-MM-DD") === dateKey);
      const avgWeightData = avgWeightByDate[dateKey];
      const avgWeight =
        avgWeightData && avgWeightData.birds > 0 ? avgWeightData.netWeight / avgWeightData.birds : null;

      (Object.keys(metricMeta) as EditableMetric[]).forEach((metric) => {
        const value = dayRows.reduce((sum, row) => sum + getReductionValueForType(metric, row), 0);
        const latestRemark =
          dayRows.find((row) => getReductionValueForType(metric, row) > 0)?.remarks?.trim() ?? "";

        nextHistory[metric].push({
          date: dateKey,
          dayNumber: cursor.diff(firstTruckDate, "day") + 1,
          value,
          avgWeight,
          remarks: latestRemark,
        });
        nextTotals[metric] += value;
      });
    }

    setReductionHistoryByMetric(nextHistory);
    setReductionTotalsByMetric(nextTotals);
  };

  const openReductionDrawer = (buildingId: string) => {
    const selectedBuilding = buildings.find((item) => item.id === buildingId);
    if (selectedBuilding?.growStatus === "Harvested") {
      setToastMessage("This building is already harvested and cannot be viewed here.");
      setIsToastOpen(true);
      return;
    }

    const editInfo = hasTruckByBuildingId[buildingId];
    if (!editInfo?.hasTruck) {
      setToastMessage("You can only view reductions after adding at least one truck.");
      setIsToastOpen(true);
      return;
    }

    navigate(`/harvest-metric-history/${buildingId}?date=${selectedDate}`);
  };

  const closeReductionDrawer = () => {
    setIsReductionDrawerOpen(false);
    setActiveReductionBuildingId(null);
    setActiveReductionHistoryMetric(null);
    setReductionHistoryByMetric(EMPTY_REDUCTION_HISTORY);
    setReductionTotalsByMetric(EMPTY_REDUCTION_TOTALS);
  };

  const handleOpenAvgWeightHistory = async (buildingId: string) => {
    const selectedBuilding = buildings.find((item) => item.id === buildingId);
    if (selectedBuilding?.growStatus === "Harvested") {
      setToastMessage("This building is already harvested and cannot be viewed here.");
      setIsToastOpen(true);
      return;
    }

    const editInfo = hasTruckByBuildingId[buildingId];
    if (!editInfo?.hasTruck) {
      setToastMessage("You can only view avg weight after adding at least one truck.");
      setIsToastOpen(true);
      return;
    }

    navigate(`/harvest-avg-weight-history/${buildingId}?date=${selectedDate}`);
  };

  const handleOpenTruckHistory = async (buildingId: string) => {
    const selectedBuilding = buildings.find((item) => item.id === buildingId);
    if (selectedBuilding?.growStatus === "Harvested") {
      setToastMessage("This building is already harvested and cannot be viewed here.");
      setIsToastOpen(true);
      return;
    }

    const editInfo = hasTruckByBuildingId[buildingId];
    if (!editInfo?.hasTruck) {
      setToastMessage("You can only view trucks after adding at least one truck.");
      setIsToastOpen(true);
      return;
    }

    navigate(`/harvest-truck-history/${buildingId}?date=${selectedDate}`);
  };

  const openMetricModal = (metric: EditableMetric, buildingId: string, current: number) => {
    const selectedBuilding = buildings.find((item) => item.id === buildingId);
    if (selectedBuilding?.growStatus === "Harvested") {
      setToastMessage("This building is already harvested and cannot be edited.");
      setIsToastOpen(true);
      return;
    }

    const editInfo = hasTruckByBuildingId[buildingId];
    if (!editInfo?.hasTruck) {
      setToastMessage("You can only edit reductions after adding at least one truck.");
      setIsToastOpen(true);
      return;
    }

    const existingRemarks = metricRemarksByType[metric][selectedDate]?.[buildingId] ?? "";
    setActiveMetric(metric);
    setActiveBuildingId(buildingId);
    setActiveMetricRemaining(null);
    setActiveMetricPreviousValue(Math.max(0, Math.floor(current || 0)));
    setMetricDraft(Math.max(0, Math.floor(current || 0)));
    setMetricRemarksDraft(existingRemarks);
    setIsMetricModalOpen(true);

    if (editInfo.harvestId != null) {
      void getHarvestById(editInfo.harvestId)
        .then(async (harvest) => {
          const currentTotal =
            currentTotalByBuildingId[buildingId] ??
            selectedBuilding?.total ??
            null;
          if (currentTotal === null) {
            setActiveMetricRemaining(null);
            return;
          }
          const remaining = Math.max(
            0,
            currentTotal - Math.max(0, Math.floor(Number(harvest.totalAnimals ?? 0)))
          );
          setActiveMetricRemaining(remaining);
        })
        .catch(() => {
          setActiveMetricRemaining(null);
        });
    }
  };

  const closeMetricModal = () => {
    setIsMetricModalOpen(false);
    setActiveBuildingId(null);
    setActiveMetricRemaining(null);
    setActiveMetricPreviousValue(0);
    setMetricRemarksDraft("");
  };

  const handleUpdateMetric = async () => {
    if (!activeBuildingId) return;
    const nextValue = Math.max(0, Math.floor(metricDraft || 0));
    if (nextValue <= 0) return;
    const maxAllowed = activeMetricRemaining === null ? null : activeMetricRemaining + activeMetricPreviousValue;
    if (maxAllowed !== null && nextValue > maxAllowed) {
      setToastMessage(`Value cannot exceed ${maxAllowed.toLocaleString()} (remaining + current value).`);
      setIsToastOpen(true);
      return;
    }

    const editInfo = hasTruckByBuildingId[activeBuildingId];
    if (!editInfo?.hasTruck || editInfo.harvestId == null) {
      setToastMessage("You can only edit reductions after adding at least one truck.");
      setIsToastOpen(true);
      return;
    }

    const reductionType = REDUCTION_TYPE_BY_METRIC[activeMetric];
    const harvestId = editInfo.harvestId;

    setIsSavingMetric(true);
    try {
      const reductions = await loadHarvestReductionTransactionsByHarvestId(harvestId);
      const selectedDayRows = reductions.filter((row) => isSameSelectedDate(row.createdAt));

      const existingReductionTx =
        selectedDayRows.find((row) => {
          if (!row.reductionType) return false;
          if (reductionType === "takeout") {
            return row.reductionType === "takeout" || row.reductionType === "take_out";
          }
          return row.reductionType === reductionType;
        }) ?? null;

      const selectedDayTotals = selectedDayRows.reduce(
        (acc, row) => {
          const count = Math.max(0, Math.floor(Number(row.animalCount ?? 0)));
          if (row.reductionType === "mortality") acc.mortality += count;
          if (row.reductionType === "thinning") acc.thinning += count;
          if (row.reductionType === "take_out" || row.reductionType === "takeout") acc.takeOut += count;
          if (row.reductionType === "defect") acc.defect += count;
          return acc;
        },
        { mortality: 0, thinning: 0, takeOut: 0, defect: 0 }
      );

      const previousValueForThisTx = existingReductionTx?.animalCount ?? 0;
      if (reductionType === "mortality") {
        selectedDayTotals.mortality = Math.max(0, selectedDayTotals.mortality - previousValueForThisTx + nextValue);
      } else if (reductionType === "thinning") {
        selectedDayTotals.thinning = Math.max(0, selectedDayTotals.thinning - previousValueForThisTx + nextValue);
      } else if (reductionType === "defect") {
        selectedDayTotals.defect = Math.max(0, selectedDayTotals.defect - previousValueForThisTx + nextValue);
      } else {
        selectedDayTotals.takeOut = Math.max(0, selectedDayTotals.takeOut - previousValueForThisTx + nextValue);
      }

      const savedHarvestLog = await addHarvestLog({
        harvestId,
        mortality: selectedDayTotals.mortality,
        thinning: selectedDayTotals.thinning,
        takeOut: selectedDayTotals.takeOut,
        defect: selectedDayTotals.defect,
      });

      if (existingReductionTx) {
        await updateHarvestReductionTransaction(existingReductionTx.id, {
          harvestLogId: Number(savedHarvestLog.id),
          animalCount: nextValue,
          remarks: metricRemarksDraft.trim() || null,
        });
      } else {
        await addHarvestReductionTransaction({
          harvestId,
          harvestLogId: Number(savedHarvestLog.id),
          animalCount: nextValue,
          reductionType,
          remarks: metricRemarksDraft.trim() || null,
        });
      }

      setMetricOverrides((prev) => {
        const next = { ...prev };
        const selectedMetric = { ...next[activeMetric] };
        const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
        day[activeBuildingId] = nextValue;
        selectedMetric[selectedDate] = day;
        next[activeMetric] = selectedMetric;
        return next;
      });
      setMetricRemarksByType((prev) => {
        const next = { ...prev };
        const selectedMetric = { ...next[activeMetric] };
        const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
        day[activeBuildingId] = metricRemarksDraft.trim();
        selectedMetric[selectedDate] = day;
        next[activeMetric] = selectedMetric;
        return next;
      });

      if (isReductionDrawerOpen && activeReductionBuildingId === activeBuildingId) {
        void loadReductionHistory(activeBuildingId).catch(() => undefined);
      }

      closeMetricModal();
      setToastMessage(`${metricMeta[activeMetric].title} updated successfully.`);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to save ${metricMeta[activeMetric].title.toLowerCase()}: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsSavingMetric(false);
    }
  };

  const getStatsForBuilding = useMemo(() => {
    return (building: Building): BuildingStats => {
      const currentTotal = currentTotalByBuildingId[building.id] ?? building.total;
      const mortality = metricOverrides.mortality[selectedDate]?.[building.id] ?? 0;
      const thinning = metricOverrides.thinning[selectedDate]?.[building.id] ?? 0;
      const takeOut = metricOverrides.takeOut[selectedDate]?.[building.id] ?? 0;
      const defect = metricOverrides.defect[selectedDate]?.[building.id] ?? 0;
      const totalAnimalsOut = harvestAnimalsOutByBuilding[selectedDate]?.[building.id] ?? 0;
      const avgWeight = avgWeightByBuildingId[selectedDate]?.[building.id] ?? 0;
      const trucks = truckCountByBuildingId[selectedDate]?.[building.id] ?? 0;
      const reduction = mortality + thinning + takeOut + defect;
      const remaining = Math.max(0, currentTotal - totalAnimalsOut - reduction);
      return {
        days: building.days,
        total: currentTotal,
        status: building.growStatus,
        avgWeight,
        trucks,
        reduction,
        totalHarvested: totalAnimalsOut,
        mortality,
        thinning,
        takeOut,
        remaining,
        defect,
      };
    };
  }, [avgWeightByBuildingId, currentTotalByBuildingId, harvestAnimalsOutByBuilding, metricOverrides, selectedDate, truckCountByBuildingId]);

  const isMetricValid = metricDraft > 0;
  const maxMetricAllowed = activeMetricRemaining === null ? null : activeMetricRemaining + activeMetricPreviousValue;
  const isMetricWithinRemaining = maxMetricAllowed === null || metricDraft <= maxMetricAllowed;
  const overviewStats = useMemo(() => {
    return buildings.reduce(
      (acc, building) => {
        const stats = getStatsForBuilding(building);
        acc.totalBuildings += 1;
        acc.totalBirds += stats.total;
        acc.totalRemaining += stats.remaining;
        acc.totalMortality += stats.mortality;
        acc.totalDefect += stats.defect;
        acc.totalThinning += stats.thinning;
        acc.totalTakeOut += stats.takeOut;
        acc.totalTrucks += stats.trucks;
        return acc;
      },
      {
        totalBuildings: 0,
        totalBirds: 0,
        totalRemaining: 0,
        totalMortality: 0,
        totalDefect: 0,
        totalThinning: 0,
        totalTakeOut: 0,
        totalTrucks: 0,
      }
    );
  }, [buildings, getStatsForBuilding]);

  return (
    <Layout className="min-h-screen bg-slate-100">
      {/* Header */}
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
          {isMobile ? (
            <>
              <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
              <Title level={4} className="!m-0 !text-base !text-white">
                Harvest Building
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Harvest</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Building Harvest Overview
              </Title>
            </div>
          )}
        </div>
        <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={handleSignOut} />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState
            title="Loading..."
            subtitle=""
            fullScreen
            titleClassName="text-[#008822]"
            subtitleClassName="text-[#008822]/80"
          />
        ) : buildings.length === 0 ? (
          <ChickenState
            title="No data yet"
            subtitle="No grow records found for this date."
            fullScreen
          />
        ) : (
          <>
            {isMobile ? (
              <div
                className={[
                  "border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 shadow-sm",
                  "rounded-sm px-3 py-3 mb-3",
                ].join(" ")}
              >
                <div className="text-emerald-700 font-medium text-xs mb-2">
                  Date
                </div>
                <DatePicker
                  className="!w-full"
                  size="middle"
                  placeholder="Select date"
                  value={dayjs(selectedDate)}
                  onChange={(date) => setSelectedDate(date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"))}
                  style={{ fontSize: 16 }}
                  styles={{ input: { fontSize: 16 } }}
                />
              </div>
            ) : (
              <div className="mb-6 grid grid-cols-12 gap-4">
                <div className="col-span-8 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-6 py-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Daily Snapshot
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">Harvest Operations</div>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Buildings</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalBuildings}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total Birds</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalBirds.toLocaleString()}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Remaining</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalRemaining.toLocaleString()}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Loss + Out</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {(overviewStats.totalMortality + overviewStats.totalDefect + overviewStats.totalThinning + overviewStats.totalTakeOut).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Filter</div>
                  <div className="mt-1 text-base font-semibold text-slate-800">Date</div>
                  <DatePicker
                    className="!mt-3 !w-full"
                    size="large"
                    placeholder="Select date"
                    value={dayjs(selectedDate)}
                    onChange={(date) => setSelectedDate(date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"))}
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                  />
                  <div className="mt-3 text-xs text-slate-500">
                    Showing data for {dayjs(selectedDate).format("MMMM D, YYYY")}
                  </div>
                </div>
              </div>
            )}

            {/* Active Buildings Section */}
            <div>
              <div className={["bg-[#ffa6001f]", isMobile ? "rounded-lg px-3 py-2" : "rounded-sm px-5 py-3 border border-amber-200"].join(" ")}>
                <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-base"].join(" ")}>
                  Active Buildings ({buildings.length})
                </div>
              </div>

              <Divider className={isMobile ? "!my-2" : "!my-3"} />

              <div className={isMobile ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4"}>
                {buildings.map((b) => (
                  <BuildingRow
                    key={b.id}
                    b={b}
                    stats={getStatsForBuilding(b)}
                    theme={getBuildingCardTheme(String(b.id))}
                    isMobile={isMobile}
                    onReductionClick={openReductionDrawer}
                    onAvgWeightClick={handleOpenAvgWeightHistory}
                    onTrucksClick={handleOpenTruckHistory}
                    onOpen={() => navigate(`/truck/${b.id}`)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </Content>

      <Drawer
        open={isMetricModalOpen}
        onClose={closeMetricModal}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "60%" : undefined}
        width={isMobile ? undefined : 460}
        className="metric-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update {metricMeta[activeMetric].title}
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            {metricMeta[activeMetric].helper}
          </div>
          <div className="text-slate-600 text-sm mt-2">
            Remaining:{" "}
            <span className="font-semibold text-slate-900">
              {activeMetricRemaining !== null ? activeMetricRemaining.toLocaleString() : "N/A"}
            </span>
          </div>
        </div>

          <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">{metricMeta[activeMetric].label}</div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setMetricDraft((v) => Math.max(0, (v || 0) - 1))}>-</Button>
            <InputNumber
              min={0}
              value={metricDraft}
              onChange={(v) => setMetricDraft(Math.max(0, Math.floor(Number(v) || 0)))}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
            <Button
              onClick={() => setMetricDraft((v) => (v || 0) + 1)}
              disabled={maxMetricAllowed !== null && metricDraft >= maxMetricAllowed}
            >
              +
            </Button>
          </div>
          {!isMetricWithinRemaining && maxMetricAllowed !== null && (
            <div className="mt-2 text-xs text-red-500">
              Value cannot exceed {maxMetricAllowed.toLocaleString()} (remaining + current value).
            </div>
          )}
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 mb-2">Remarks</div>
            <Input.TextArea
              rows={3}
              value={metricRemarksDraft}
              onChange={(e) => setMetricRemarksDraft(e.target.value)}
              placeholder="Add remarks (optional)"
              className="!text-base"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeMetricModal}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!flex-1"
            style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
            onClick={handleUpdateMetric}
            disabled={!isMetricValid || !isMetricWithinRemaining || isSavingMetric}
            loading={isSavingMetric}
          >
            Update
          </Button>
        </div>
      </Drawer>

      <Drawer
        open={isReductionDrawerOpen}
        onClose={closeReductionDrawer}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "88%" : undefined}
        width={isMobile ? undefined : 520}
        className="reduction-history-drawer"
        bodyStyle={{ padding: 16, backgroundColor: "#f8fafc" }}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Title level={4} className="!m-0">
                {activeReductionHistoryMetric === null
                  ? "Reduction"
                  : `${metricMeta[activeReductionHistoryMetric].title} Daily History`}
              </Title>
              <div className="text-slate-500 text-sm mt-1">
                {activeReductionHistoryMetric === null
                  ? "Choose a reduction type to view its harvest history."
                  : `Showing day 1 onward from the first truck added up to ${dayjs(selectedDate).format("MMMM D, YYYY")}.`}
              </div>
            </div>
            {activeReductionHistoryMetric !== null && (
              <Button onClick={() => setActiveReductionHistoryMetric(null)}>
                Back
              </Button>
            )}
          </div>
        </div>

        {isReductionHistoryLoading ? (
          <ChickenState title="Loading..." subtitle="" />
        ) : activeReductionHistoryMetric === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(metricMeta) as EditableMetric[]).map((metric) => {
              const card = reductionCardMeta[metric];
              return (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setActiveReductionHistoryMetric(metric)}
                  style={{ borderColor: card.borderColor }}
                  className={[
                    "text-left bg-white rounded-sm shadow-sm border-2",
                    "p-4 min-h-[160px]",
                    "transition-all duration-200 cursor-pointer",
                    "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {buildings.find((building) => building.id === activeReductionBuildingId)?.name ?? "Building"}
                      </div>
                      <div className={["mt-1 text-lg font-bold tracking-tight", card.accent].join(" ")}>
                        {metricMeta[metric].title}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-2xl bg-[#ffa600]/25 p-3 shadow-inner">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                        <span className={["h-3 w-3 rounded-full", card.dotColor].join(" ")} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="text-xl font-bold text-slate-900">
                        {reductionTotalsByMetric[metric].toLocaleString()}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">birds</div>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-[#008822]/0 via-[#008822]/10 to-[#008822]/0" />
                </button>
              );
            })}
          </div>
        ) : reductionHistoryByMetric[activeReductionHistoryMetric].length === 0 ? (
          <ChickenState
            title="No history yet"
            subtitle={`No ${metricMeta[activeReductionHistoryMetric].title.toLowerCase()} data found after the first truck was added.`}
          />
        ) : (
          <>
            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {buildings.find((building) => building.id === activeReductionBuildingId)?.name ?? "Building"}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {metricMeta[activeReductionHistoryMetric].title} Daily History
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Showing day 1 to {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">
                    {reductionHistoryByMetric[activeReductionHistoryMetric].length}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</span>
                  <span className="text-sm font-bold text-slate-900">
                    {reductionTotalsByMetric[activeReductionHistoryMetric].toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {reductionHistoryByMetric[activeReductionHistoryMetric].map((row) => (
                <div
                  key={`${activeReductionHistoryMetric}-${row.date}`}
                  className="rounded-sm border border-emerald-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            reductionCardMeta[activeReductionHistoryMetric].dotColor,
                          ].join(" ")}
                          aria-hidden="true"
                        />
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
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        {metricMeta[activeReductionHistoryMetric].title}
                      </div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">
                        {row.value.toLocaleString()}
                      </div>
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

            {activeReductionBuildingId !== null && (
              <div className="mt-4">
                <Button
                  type="primary"
                  className="!w-full"
                  style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
                  onClick={() => {
                    const selectedBuilding = buildings.find((building) => building.id === activeReductionBuildingId);
                    if (!selectedBuilding) return;
                    const stats = getStatsForBuilding(selectedBuilding);
                    const currentValue =
                      activeReductionHistoryMetric === "mortality"
                        ? stats.mortality
                        : activeReductionHistoryMetric === "thinning"
                          ? stats.thinning
                          : activeReductionHistoryMetric === "takeOut"
                            ? stats.takeOut
                            : stats.defect;
                    openMetricModal(activeReductionHistoryMetric, activeReductionBuildingId, currentValue);
                  }}
                >
                  Update {metricMeta[activeReductionHistoryMetric].title} for Selected Date
                </Button>
              </div>
            )}
          </>
        )}
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
