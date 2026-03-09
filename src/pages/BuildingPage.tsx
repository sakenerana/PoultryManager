// BuildingOverviewPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker, Drawer, Form, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { addBuilding, loadBuildings } from "../controller/buildingCrud";
import type { BuildingRecord } from "../type/building.type";
import { useAuth } from "../context/AuthContext";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Building = {
  id: string;
  name: string;
  days: number;
  total: number;
  avgWeight: number;
  mortality: number;
  thinning: number;
  takeOut: number;
};

type BuildingStats = {
  days: number;
  total: number;
  remaining: number;
  avgWeight: number;
  status: "Loading" | "Growing" | "Harvested" | "Ready";
  mortality: number;
  thinning: number;
  takeOut: number;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const BODY_WEIGHT_LOGS_TABLE = import.meta.env.VITE_SUPABASE_BODY_WEIGHT_LOGS_TABLE ?? "BodyWeightLogs";

type UserAccess = {
  role: "Admin" | "Supervisor" | "Staff" | null;
  buildingId: number | null;
  isActive: boolean;
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

const toNonNegativeInt = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

const toWeightArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [0];
  const mapped = value
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, n));
  return mapped.length > 0 ? mapped : [0];
};

const normalizeBuildingStatus = (value: unknown): BuildingStats["status"] => {
  if (typeof value !== "string") return "Ready";
  const normalized = value.trim().toLowerCase();
  if (normalized === "loading") return "Loading";
  if (normalized === "growing") return "Growing";
  if (normalized === "harvesting" || normalized === "harvested") return "Harvested";
  if (normalized === "ready") return "Ready";
  return "Ready";
};

const mapRecordToBuilding = (record: BuildingRecord): Building => ({
  id: record.id,
  name: record.name,
  days: 0,
  total: 0,
  avgWeight: 0,
  mortality: 0,
  thinning: 0,
  takeOut: 0,
});

function StatPill({
  label,
  value,
  leftIcon,
  rightIcon,
}: {
  label: string;
  value: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
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
  const styles: Record<BuildingStats["status"], { dot: string; text: string }> = {
    Loading: { dot: "bg-blue-500", text: "text-blue-700" },
    Growing: { dot: "bg-emerald-500", text: "text-emerald-700" },
    Harvested: { dot: "bg-amber-500", text: "text-amber-800" },
    Ready: { dot: "bg-slate-500", text: "text-slate-700" },
  };

  const style = styles[status];

  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold">
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
  canLoad,
  selectedDate,
}: {
  b: Building;
  onOpen: () => void;
  isMobile: boolean;
  stats: BuildingStats;
  canLoad: boolean;
  selectedDate: string;
}) {
  const navigate = useNavigate();
  const remainingPercentage =
    stats.total > 0 ? (stats.remaining / stats.total) * 100 : 0;

  return (
    <Card
      hoverable
      onClick={onOpen}
      className={[
        "!border-0 shadow-sm hover:shadow-md transition cursor-pointer",
        isMobile ? "!rounded-sm" : "!rounded-xl",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 12 }}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-sm" : "h-10 w-10 rounded-xl"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img
            src="/img/building4.svg"
            alt="Building"
            className={isMobile ? "h-4 w-4" : "h-5 w-5"}
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
                    borderColor: `${SECONDARY}80`,
                    color: SECONDARY,
                    fontSize: isMobile ? 10 : 11,
                    paddingInline: isMobile ? 6 : 7,
                    lineHeight: isMobile ? "16px" : "18px",
                  }}
                >
                  {stats.days} Days
                </Tag>
              </div>
              {/* <div className="text-xs text-slate-500 mt-1 truncate">{b.category}</div> */}
            </div>

            {/* Load button: compact on mobile */}
            {canLoad && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("open data for", b.id);
                  navigate(`/building-load/${b.id}?date=${selectedDate}`);
                }}
                className={[
                  "!font-medium shadow-sm !rounded-md",
                  isMobile ? "!px-3 !h-6 !text-[12px]" : "!px-4 !h-8 !text-[12px]",
                ].join(" ")}
                style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              >
                Load
              </Button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Total Birds / Remaining"
              value={(
                <span>
                  {stats.total.toLocaleString()} / {stats.remaining.toLocaleString()}{" "}
                  <span className="text-[10px] font-medium text-slate-500">
                    ({remainingPercentage.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%)
                  </span>
                </span>
              )}
            />
            <StatPill
              label="Body Weight"
              value={`${stats.avgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} kg`}
            />
            <StatPill label="Status" value={<StatusBadge status={stats.status} />} />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
            />
            <StatPill
              label="Thinning"
              value={stats.thinning.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
            />
            <StatPill
              label="Take Out"
              value={stats.takeOut.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
            />
          </div>
        </div>

        {/* Chevron - hide on mobile to reduce clutter */}
        {!isMobile && <div className="text-slate-300 text-lg mt-2">›</div>}
      </div>
    </Card>
  );
}

export default function BuildingOverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [statsByBuildingId, setStatsByBuildingId] = useState<Record<string, BuildingStats>>({});
  const [addForm] = Form.useForm();

  const resolveUserAccess = async (): Promise<UserAccess> => {
    if (!user?.id) return { role: null, buildingId: null, isActive: false };

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select("role, building_id, status")
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load user access.");
    }

    if (!data) {
      return { role: null, buildingId: null, isActive: false };
    }

    const normalizedRole =
      data.role === "Admin" || data.role === "Supervisor" ? data.role : "Staff";

    return {
      role: normalizedRole,
      buildingId: data.building_id ?? null,
      isActive: data.status !== "Inactive",
    };
  };

  const fetchBuildings = async () => {
    try {
      setIsLoading(true);
      const access = await resolveUserAccess();
      const data = await loadBuildings();
      const mapped = data.map(mapRecordToBuilding);

      if (!access.isActive) {
        setBuildings([]);
        return;
      }

      if (access.role === "Staff") {
        if (access.buildingId == null) {
          setBuildings([]);
          return;
        }
        setBuildings(mapped.filter((building) => Number(building.id) === access.buildingId));
        return;
      }

      setBuildings(mapped);
    } catch (error) {
      setToastMessage(`Failed to load buildings: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBuildings();
  }, [user?.id]);

  const fetchBuildingStatsByDate = async () => {
    if (buildings.length === 0) {
      setStatsByBuildingId({});
      setIsStatsLoading(false);
      return;
    }

    const buildingIds = buildings
      .map((b) => Number(b.id))
      .filter((id): id is number => Number.isFinite(id));

    if (buildingIds.length === 0) {
      setStatsByBuildingId({});
      setIsStatsLoading(false);
      return;
    }

    try {
      setIsStatsLoading(true);
      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

      const { data: growRows, error: growsError } = await supabase
        .from(GROWS_TABLE)
        .select("id, building_id, created_at, total_animals, status")
        .in("building_id", buildingIds)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false });

      if (growsError) throw growsError;

      const latestGrowByBuilding: Record<
        number,
        { growId: number; createdAt: string; totalAnimals: number; status: BuildingStats["status"] }
      > = {};

      ((growRows ?? []) as Array<{
        id: number | null;
        building_id: number | null;
        created_at: string;
        total_animals: number | null;
        status: string | null;
      }>).forEach((row) => {
        if (row.building_id == null || row.id == null) return;
        if (latestGrowByBuilding[row.building_id]) return;
        latestGrowByBuilding[row.building_id] = {
          growId: row.id,
          createdAt: row.created_at,
          totalAnimals: toNonNegativeInt(row.total_animals),
          status: normalizeBuildingStatus(row.status),
        };
      });

      const latestGrowIds = Object.values(latestGrowByBuilding).map((row) => row.growId);
      const latestGrowLogByGrowId: Record<
        number,
        { createdAt: string; actualTotalAnimals: number; mortality: number; thinning: number; takeOut: number }
      > = {};

      if (latestGrowIds.length > 0) {
        const { data: selectedDayGrowLogs, error: selectedDayGrowLogsError } = await supabase
          .from(GROW_LOGS_TABLE)
          .select("grow_id, actual_total_animals, mortality, thinning, take_out, created_at")
          .in("grow_id", latestGrowIds)
          .gte("created_at", selectedDayStart)
          .lt("created_at", selectedDayEnd)
          .order("created_at", { ascending: false });

        if (selectedDayGrowLogsError) throw selectedDayGrowLogsError;

        ((selectedDayGrowLogs ?? []) as Array<{
          created_at: string;
          grow_id: number | null;
          actual_total_animals: number | null;
          mortality: number | null;
          thinning: number | null;
          take_out: number | null;
        }>).forEach((row) => {
          if (row.grow_id == null || latestGrowLogByGrowId[row.grow_id]) return;
          latestGrowLogByGrowId[row.grow_id] = {
            createdAt: row.created_at,
            actualTotalAnimals: toNonNegativeInt(row.actual_total_animals),
            mortality: toNonNegativeInt(row.mortality),
            thinning: toNonNegativeInt(row.thinning),
            takeOut: toNonNegativeInt(row.take_out),
          };
        });

        const missingGrowIds = latestGrowIds.filter((growId) => !latestGrowLogByGrowId[growId]);
        if (missingGrowIds.length > 0) {
          const { data: previousGrowLogs, error: previousGrowLogsError } = await supabase
            .from(GROW_LOGS_TABLE)
            .select("grow_id, actual_total_animals, mortality, thinning, take_out, created_at")
            .in("grow_id", missingGrowIds)
            .lt("created_at", selectedDayStart)
            .order("created_at", { ascending: false });

          if (previousGrowLogsError) throw previousGrowLogsError;

          ((previousGrowLogs ?? []) as Array<{
            created_at: string;
            grow_id: number | null;
            actual_total_animals: number | null;
            mortality: number | null;
            thinning: number | null;
            take_out: number | null;
          }>).forEach((row) => {
            if (row.grow_id == null || latestGrowLogByGrowId[row.grow_id]) return;
            latestGrowLogByGrowId[row.grow_id] = {
              createdAt: row.created_at,
              actualTotalAnimals: toNonNegativeInt(row.actual_total_animals),
              mortality: toNonNegativeInt(row.mortality),
              thinning: toNonNegativeInt(row.thinning),
              takeOut: toNonNegativeInt(row.take_out),
            };
          });
        }
      }

      const overallMetricsByGrowId: Record<number, { mortality: number; thinning: number; takeOut: number }> = {};
      await Promise.all(
        latestGrowIds.map(async (growId) => {
          const matchedGrowLog = latestGrowLogByGrowId[growId];
          if (!matchedGrowLog) return;

          const effectiveDate = dayjs(matchedGrowLog.createdAt).format("YYYY-MM-DD");
          const effectiveStart = `${effectiveDate}T00:00:00+00:00`;
          const effectiveEnd = `${dayjs(effectiveDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

          const { data: growLogRows, error: growLogRowsError } = await supabase
            .from(GROW_LOGS_TABLE)
            .select("subbuilding_id, mortality, thinning, take_out, created_at")
            .eq("grow_id", growId)
            .gte("created_at", effectiveStart)
            .lt("created_at", effectiveEnd)
            .order("created_at", { ascending: false });

          if (growLogRowsError) throw growLogRowsError;

          const latestByCage: Record<string, { mortality: number; thinning: number; takeOut: number }> = {};
          ((growLogRows ?? []) as Array<{
            subbuilding_id: number | null;
            mortality: number | null;
            thinning: number | null;
            take_out: number | null;
          }>).forEach((row) => {
            if (row.subbuilding_id == null) return;
            const cageId = String(row.subbuilding_id);
            if (latestByCage[cageId]) return;
            latestByCage[cageId] = {
              mortality: toNonNegativeInt(row.mortality),
              thinning: toNonNegativeInt(row.thinning),
              takeOut: toNonNegativeInt(row.take_out),
            };
          });

          const rolledUp = Object.values(latestByCage).reduce(
            (acc, row) => ({
              mortality: acc.mortality + row.mortality,
              thinning: acc.thinning + row.thinning,
              takeOut: acc.takeOut + row.takeOut,
            }),
            { mortality: 0, thinning: 0, takeOut: 0 }
          );

          overallMetricsByGrowId[growId] =
            Object.keys(latestByCage).length > 0
              ? rolledUp
              : {
                  mortality: matchedGrowLog.mortality,
                  thinning: matchedGrowLog.thinning,
                  takeOut: matchedGrowLog.takeOut,
                };
        })
      );

      const nextStatsByBuildingId: Record<string, BuildingStats> = {};
      const avgWeightByBuildingId: Record<number, number> = {};

      const { data: selectedDayBodyWeightRows, error: selectedDayBodyWeightError } = await supabase
        .from(BODY_WEIGHT_LOGS_TABLE)
        .select("building_id, subbuilding_id, avg_weight, front_weight, middle_weight, back_weight, created_at")
        .in("building_id", buildingIds)
        .gte("created_at", selectedDayStart)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false });

      if (selectedDayBodyWeightError) throw selectedDayBodyWeightError;

      const latestSelectedWeightByBuildingAndSubbuilding: Record<string, number> = {};
      ((selectedDayBodyWeightRows ?? []) as Array<{
        building_id: number | null;
        subbuilding_id: number | null;
        avg_weight: number | null;
        front_weight: unknown;
        middle_weight: unknown;
        back_weight: unknown;
      }>).forEach((row) => {
        if (row.building_id == null || row.subbuilding_id == null) return;
        const key = `${row.building_id}-${row.subbuilding_id}`;
        if (latestSelectedWeightByBuildingAndSubbuilding[key] != null) return;
        const frontWeights = toWeightArray(row.front_weight);
        const middleWeights = toWeightArray(row.middle_weight);
        const backWeights = toWeightArray(row.back_weight);
        const totalWeight =
          frontWeights.reduce((sum, value) => sum + value, 0) +
          middleWeights.reduce((sum, value) => sum + value, 0) +
          backWeights.reduce((sum, value) => sum + value, 0);
        const totalChicken = frontWeights.length + middleWeights.length + backWeights.length;
        const weight = totalChicken > 0 ? totalWeight / totalChicken : 0;
        latestSelectedWeightByBuildingAndSubbuilding[key] = weight;
      });

      const weightValuesByBuilding: Record<number, number[]> = {};
      Object.entries(latestSelectedWeightByBuildingAndSubbuilding).forEach(([key, weight]) => {
        const [buildingIdPart] = key.split("-");
        const buildingId = Number(buildingIdPart);
        if (!Number.isFinite(buildingId)) return;
        if (!weightValuesByBuilding[buildingId]) weightValuesByBuilding[buildingId] = [];
        weightValuesByBuilding[buildingId].push(weight);
      });

      if ((selectedDayBodyWeightRows ?? []).length === 0) {
        const { data: previousBodyWeightRows, error: previousBodyWeightError } = await supabase
          .from(BODY_WEIGHT_LOGS_TABLE)
          .select("building_id, subbuilding_id, avg_weight, front_weight, middle_weight, back_weight, created_at")
          .in("building_id", buildingIds)
          .lt("created_at", selectedDayEnd)
          .order("created_at", { ascending: false });

        if (previousBodyWeightError) throw previousBodyWeightError;

        const latestPreviousWeightByBuildingAndSubbuilding: Record<string, number> = {};
        ((previousBodyWeightRows ?? []) as Array<{
          building_id: number | null;
          subbuilding_id: number | null;
          avg_weight: number | null;
          front_weight: unknown;
          middle_weight: unknown;
          back_weight: unknown;
        }>).forEach((row) => {
          if (row.building_id == null || row.subbuilding_id == null) return;
          const key = `${row.building_id}-${row.subbuilding_id}`;
          if (latestPreviousWeightByBuildingAndSubbuilding[key] != null) return;
          const frontWeights = toWeightArray(row.front_weight);
          const middleWeights = toWeightArray(row.middle_weight);
          const backWeights = toWeightArray(row.back_weight);
          const totalWeight =
            frontWeights.reduce((sum, value) => sum + value, 0) +
            middleWeights.reduce((sum, value) => sum + value, 0) +
            backWeights.reduce((sum, value) => sum + value, 0);
          const totalChicken = frontWeights.length + middleWeights.length + backWeights.length;
          const weight = totalChicken > 0 ? totalWeight / totalChicken : 0;
          latestPreviousWeightByBuildingAndSubbuilding[key] = weight;
        });

        Object.entries(latestPreviousWeightByBuildingAndSubbuilding).forEach(([key, weight]) => {
          const [buildingIdPart] = key.split("-");
          const buildingId = Number(buildingIdPart);
          if (!Number.isFinite(buildingId)) return;
          if (!weightValuesByBuilding[buildingId]) weightValuesByBuilding[buildingId] = [];
          weightValuesByBuilding[buildingId].push(weight);
        });
      }

      Object.entries(weightValuesByBuilding).forEach(([buildingIdKey, weights]) => {
        const buildingId = Number(buildingIdKey);
        if (!Number.isFinite(buildingId) || weights.length === 0) return;
        const totalWeight = weights.reduce((sum, value) => sum + value, 0);
        avgWeightByBuildingId[buildingId] = totalWeight / weights.length;
      });

      buildings.forEach((building) => {
        const buildingId = Number(building.id);
        const grow = Number.isFinite(buildingId) ? latestGrowByBuilding[buildingId] : undefined;
        const growLog = grow ? latestGrowLogByGrowId[grow.growId] : undefined;
        const overallMetrics = grow ? overallMetricsByGrowId[grow.growId] : undefined;
        const total = grow?.totalAnimals ?? 0;
        const remaining = growLog?.actualTotalAnimals ?? total;
        const days = grow
          ? Math.max(0, dayjs(selectedDate).startOf("day").diff(dayjs(grow.createdAt).startOf("day"), "day")) + 1
          : 0;

        nextStatsByBuildingId[building.id] = {
          days,
          total,
          remaining,
          avgWeight: Number.isFinite(buildingId) ? avgWeightByBuildingId[buildingId] ?? 0 : 0,
          status: grow?.status ?? "Ready",
          mortality: overallMetrics?.mortality ?? growLog?.mortality ?? 0,
          thinning: overallMetrics?.thinning ?? growLog?.thinning ?? 0,
          takeOut: overallMetrics?.takeOut ?? growLog?.takeOut ?? 0,
        };
      });

      setStatsByBuildingId(nextStatsByBuildingId);
    } catch (error) {
      setToastMessage(`Failed to load building stats: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
      setStatsByBuildingId({});
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBuildingStatsByDate();
  }, [buildings, selectedDate]);

  const handleDateChange = (date: Dayjs | null) => {
    const nextDate = date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
    setToastMessage(`Filtered date: ${dayjs(nextDate).format("MMM D, YYYY")}`);
    setIsToastOpen(true);
  };

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };
  const handleOpenAdd = () => {
    const nextIndex = buildings.length + 1;
    addForm.setFieldsValue({ name: `Building ${nextIndex}` });
    setIsAddModalOpen(true);
  };
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    addForm.resetFields();
  };

  const handleSubmitAdd = async () => {
    try {
      const values = await addForm.validateFields();
      await addBuilding({ name: values.name });
      await fetchBuildings();
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      setToastMessage(`Failed to add building: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const getStatsForBuilding = useMemo(() => {
    return (building: Building): BuildingStats => {
      const mapped = statsByBuildingId[building.id];
      if (mapped) return mapped;
      return {
        days: building.days,
        total: building.total,
        remaining: building.total,
        avgWeight: building.avgWeight,
        status: "Ready",
        mortality: building.mortality,
        thinning: building.thinning,
        takeOut: building.takeOut,
      };
    };
  }, [statsByBuildingId]);

  const sortedBuildings = useMemo(() => {
    const getTrailingNumber = (name: string): number | null => {
      const match = name.match(/(\d+)\s*$/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    };

    return [...buildings].sort((a, b) => {
      const aNum = getTrailingNumber(a.name);
      const bNum = getTrailingNumber(b.name);

      if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
      if (aNum != null && bNum == null) return -1;
      if (aNum == null && bNum != null) return 1;

      const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      if (nameOrder !== 0) return nameOrder;

      return Number(a.id) - Number(b.id);
    });
  }, [buildings]);

  const isPageLoading = isLoading || isStatsLoading;

  return (
    <Layout className="min-h-screen bg-slate-100">
      {/* Header */}
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-4 !h-16",
        ].join(" ")}
        style={{ backgroundColor: PRIMARY }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Button
            type="text"
            icon={<HomeOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Title level={4} className={["!m-0 !text-white", isMobile ? "!text-base" : ""].join(" ")}>
            Building
          </Title>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        {/* divider */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-4 py-4"}>
        {isPageLoading ? (
          <ChickenState
            title="Loading..."
            subtitle=""
            fullScreen
            titleClassName="text-[#008822]"
            subtitleClassName="text-[#008822]/80"
          />
        ) : buildings.length === 0 ? (
          <div className="min-h-[calc(100vh-90px)] flex flex-col items-center justify-center">
            <ChickenState
              title="No data yet"
              subtitle="No buildings found for this date."
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="!h-11 !px-4 !rounded-lg"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleOpenAdd}
            >
              Add First Building
            </Button>
          </div>
        ) : (
          <>
            {/* Date Filter */}
            <div
              className={[
                "bg-white shadow-sm",
                isMobile ? "rounded-sm px-3 py-3 mb-3" : "rounded-xl px-4 py-4 mb-4",
              ].join(" ")}
            >
              <div className={["text-slate-600 font-medium", isMobile ? "text-xs mb-2" : "text-sm mb-2"].join(" ")}>
                Date
              </div>
              <DatePicker
                className={isMobile ? "!w-full" : "!w-[220px]"}
                size={isMobile ? "middle" : "large"}
                placeholder="Select date"
                value={dayjs(selectedDate)}
                onChange={handleDateChange}
                style={{ fontSize: 16 }}
                styles={{ input: { fontSize: 16 } }}
              />
            </div>

            {/* Active Buildings Section */}
            <div>
              <div className={["bg-[#ffa6001f]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
                <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
                  Active Buildings ({buildings.length})
                </div>
              </div>

              <Divider className={isMobile ? "!my-2" : "!my-3"} />

              {/* Use gap, not space-y, for consistent spacing */}
            <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
              {sortedBuildings.map((b) => (
                <BuildingRow
                  key={b.id}
                  b={b}
                  stats={getStatsForBuilding(b)}
                  isMobile={isMobile}
                  onOpen={() => navigate(`/building-cage/${b.id}`)}
                  canLoad={isTodaySelected}
                  selectedDate={selectedDate}
                />
              ))}
            </div>
            </div>
          </>
        )}

        {/* Floating Add Button - full width on mobile */}
        {isTodaySelected && buildings.length > 0 && !isPageLoading && (
          <div className={["fixed z-50", "bottom-6 right-6"].join(" ")}>
            <Button
              type="primary"
              size="large"
              icon={
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/90">
                  <PlusOutlined className="text-[12px]" style={{ color: SECONDARY }} />
                </span>
              }
              className="shadow-lg !rounded-full !px-4 !h-10 !text-sm !font-semibold"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleOpenAdd}
            >
              Add
            </Button>
          </div>
        )}
      </Content>

      <Drawer
        open={isAddModalOpen}
        onClose={handleCloseAdd}
        placement="bottom"
        height={isMobile ? "60%" : 420}
        className="add-building-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Add New Building
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter the details to create a new building record.
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Building Name"
            name="name"
            rules={[{ required: true, message: "Please enter building name" }]}
          >
            <Input placeholder="e.g., Building 6" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
            >
              Add Building
            </Button>
          </div>
        </Form>
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
