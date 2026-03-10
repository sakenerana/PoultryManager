import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Drawer, Form, Input, InputNumber, Tabs, Select } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { loadSubBuildingsByBuildingId } from "../controller/subbuildingsCrud";
import type { SubBuildingRecord } from "../type/subbuildings.type";
import { useAuth } from "../context/AuthContext";
import supabase from "../utils/supabase";
import {
  addBodyWeightLog,
  loadBodyWeightLogsByBuildingId,
  loadBodyWeightLogsByBuildingIdAndDate,
  updateBodyWeightLog,
} from "../controller/bodyWeightCrud";
import {
  addGrowLog,
  addGrowReductionTransaction,
  loadGrowReductionTransactionsByGrowId,
  loadGrowLogsByGrowId,
  updateGrowReductionTransaction,
} from "../controller/growLogsCrud";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

export type Cage = {
  id: string;
  buildingId: string;
  name: string;
  avgWeight: number;
  mortality: number;
  thinning: number;
  takeOut: number;
};

type CageStats = {
  avgWeight: number;
  mortality: number;
  thinning: number;
  takeOut: number;
};

type WeightEntry = {
  frontWeights: number[];
  middleWeights: number[];
  backWeights: number[];
};
type EditableMetric = "mortality" | "thinning" | "takeOut";
type GrowLogPreview = {
  createdAt: string;
  mortality: number;
  thinning: number;
  takeOut: number;
} | null;
type UserAccess = {
  role: "Admin" | "Supervisor" | "Staff" | null;
  isActive: boolean;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const SUBBUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_SUBBUILDINGS_TABLE ?? "Subbuildings";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [0];
  const mapped = value
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, n));
  return mapped.length > 0 ? mapped : [0];
};

const mapSubBuildingToCage = (record: SubBuildingRecord): Cage => ({
  id: record.id,
  buildingId: String(record.buildingId ?? ""),
  name: record.name,
  avgWeight: 0,
  mortality: 0,
  thinning: 0,
  takeOut: 0,
});

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

function StatPill({
  label,
  value,
  leftIcon,
  rightIcon,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={[
        "rounded-lg bg-slate-50 px-2 py-1.5",
        onClick ? "cursor-pointer hover:bg-slate-100 transition" : "",
      ].join(" ")}
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

function CageRow({
  c,
  onMortalityClick,
  onThinningClick,
  onTakeOutClick,
  onWeightClick,
  isMobile,
  stats,
  displayName,
  hideMetrics,
}: {
  c: Cage;
  onMortalityClick: (cageId: string, current: number) => void;
  onThinningClick: (cageId: string, current: number) => void;
  onTakeOutClick: (cageId: string, current: number) => void;
  onWeightClick: (cageId: string) => void;
  isMobile: boolean;
  stats: CageStats;
  displayName: string;
  hideMetrics: boolean;
}) {
  return (
    <Card
      hoverable
      className={[
        "!border-0 shadow-sm hover:shadow-md transition cursor-pointer h-full",
        isMobile ? "!rounded-sm" : "!rounded-sm border border-slate-200/80 bg-white/95",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 14 }}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-sm"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img
            src="/img/cage2.svg"
            alt="Cage"
            className={isMobile ? "h-5 w-5" : "h-5 w-5"}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
                  {displayName}
                </div>
              </div>
            </div>

            <div />
          </div>

          {/* Stats Row */}
          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Avg. Weight"
              value={hideMetrics ? "-" : `${stats.avgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} kg`}
              rightIcon={<span className="text-slate-400 text-base leading-none">{">"}</span>}
              onClick={hideMetrics ? undefined : () => onWeightClick(c.id)}
            />
            <StatPill
              label="Mortality"
              value={hideMetrics ? "-" : stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">{">"}</span>}
              onClick={hideMetrics ? undefined : () => onMortalityClick(c.id, stats.mortality)}
            />
            <StatPill
              label="Thinning"
              value={hideMetrics ? "-" : stats.thinning.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">{">"}</span>}
              onClick={hideMetrics ? undefined : () => onThinningClick(c.id, stats.thinning)}
            />
            <StatPill
              label="Take Out"
              value={hideMetrics ? "-" : stats.takeOut.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">{">"}</span>}
              onClick={hideMetrics ? undefined : () => onTakeOutClick(c.id, stats.takeOut)}
            />
          </div>
        </div>

        {/* Chevron - hide on mobile to reduce clutter */}
        {!isMobile && <div className="text-slate-300 text-lg mt-2">{">"}</div>}
      </div>
    </Card>
  );
}

export default function BuildingCage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [cages, setCages] = useState<Cage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const [metricOverrides, setMetricOverrides] = useState<Record<EditableMetric, Record<string, Record<string, number>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
  });
  const [metricRemarksByType, setMetricRemarksByType] = useState<Record<EditableMetric, Record<string, Record<string, string>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
  });
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [activeCageId, setActiveCageId] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<EditableMetric>("mortality");
  const [metricDraft, setMetricDraft] = useState<number>(0);
  const [metricRemarksDraft, setMetricRemarksDraft] = useState<string>("");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, Record<string, WeightEntry>>>({});
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightDraft, setWeightDraft] = useState<WeightEntry>({
    frontWeights: [],
    middleWeights: [],
    backWeights: [],
  });
  const [addChickenRows, setAddChickenRows] = useState<number>(1);
  const [batchWeightToSplit, setBatchWeightToSplit] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [userRole, setUserRole] = useState<UserAccess["role"]>(null);
  const [selectedBuildingName, setSelectedBuildingName] = useState<string>("");
  const [isLatestGrowHarvested, setIsLatestGrowHarvested] = useState(false);
  const [growLogPreview, setGrowLogPreview] = useState<GrowLogPreview>(null);
  const [addForm] = Form.useForm();
  const canManageCages = userRole === "Admin" || userRole === "Supervisor";

  const resolveUserAccess = async (): Promise<UserAccess> => {
    if (!user?.id) return { role: null, isActive: false };

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select("role, status")
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load user access.");
    }

    if (!data) {
      return { role: null, isActive: false };
    }

    const normalizedRole =
      data.role === "Admin" || data.role === "Supervisor" ? data.role : "Staff";

    return {
      role: normalizedRole,
      isActive: data.status !== "Inactive",
    };
  };

  const fetchUserAccess = async () => {
    try {
      const access = await resolveUserAccess();
      setUserRole(access.isActive ? access.role : null);
    } catch (error) {
      setUserRole(null);
      setToastMessage(`Failed to load user access: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const fetchSelectedBuildingName = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setSelectedBuildingName("");
      return;
    }

    try {
      const { data, error } = await supabase
        .from(BUILDINGS_TABLE)
        .select("name")
        .eq("id", buildingId)
        .maybeSingle();

      if (error) throw error;
      setSelectedBuildingName(typeof data?.name === "string" ? data.name : "");
    } catch (error) {
      setToastMessage(`Failed to load building name: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
      setSelectedBuildingName("");
    }
  };

  const fetchCagesByBuildingId = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setCages([]);
      return;
    }

    try {
      setIsLoading(true);
      const data = await loadSubBuildingsByBuildingId(buildingId);
      setCages(data.map(mapSubBuildingToCage));
    } catch (error) {
      setToastMessage(`Failed to load cages: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCagesByBuildingId();
  }, [id]);

  useEffect(() => {
    void fetchSelectedBuildingName();
  }, [id]);

  useEffect(() => {
    void fetchUserAccess();
  }, [user?.id]);

  const fetchBodyWeightLogsByDate = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) return;

    try {
      const logs = await loadBodyWeightLogsByBuildingIdAndDate(buildingId, selectedDate);
      let logsForDisplay = logs;

      if (logsForDisplay.length === 0) {
        const allLogs = await loadBodyWeightLogsByBuildingId(buildingId);
        const selectedDayEnd = dayjs(selectedDate).add(1, "day").startOf("day").valueOf();
        const latestByCage: Record<string, (typeof allLogs)[number]> = {};

        allLogs
          .filter((row) => dayjs(row.createdAt).valueOf() < selectedDayEnd)
          .forEach((row) => {
            if (row.subbuildingId == null) return;
            const cageId = String(row.subbuildingId);
            const previous = latestByCage[cageId];
            if (!previous || dayjs(row.createdAt).isAfter(dayjs(previous.createdAt))) {
              latestByCage[cageId] = row;
            }
          });

        logsForDisplay = Object.values(latestByCage);
      }

      const byCage: Record<string, WeightEntry> = {};

      logsForDisplay.forEach((row) => {
        if (row.subbuildingId == null) return;
        byCage[String(row.subbuildingId)] = {
          frontWeights: toNumberArray(row.frontWeight),
          middleWeights: toNumberArray(row.middleWeight),
          backWeights: toNumberArray(row.backWeight),
        };
      });

      setWeightOverrides((prev) => ({
        ...prev,
        [selectedDate]: byCage,
      }));
    } catch (error) {
      setToastMessage(`Failed to load body weights: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  useEffect(() => {
    void fetchBodyWeightLogsByDate();
  }, [id, selectedDate]);

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    const nextDate = date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
    setToastMessage(`Filtered date: ${dayjs(nextDate).format("MMM D, YYYY")}`);
    setIsToastOpen(true);
  };

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };
  const handleOpenAdd = () => {
    if (!canManageCages) {
      setToastMessage("Please contact an Admin or Supervisor to add a new cage.");
      setIsToastOpen(true);
      return;
    }
    const nextIndex = filteredCages.length + 1;
    addForm.setFieldsValue({ name: `Cage ${nextIndex}` });
    setIsAddModalOpen(true);
  };
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    addForm.resetFields();
  };

  const handleSubmitAdd = async () => {
    if (!canManageCages) {
      setToastMessage("Please contact an Admin or Supervisor to add a new cage.");
      setIsToastOpen(true);
      return;
    }

    try {
      const values = await addForm.validateFields();
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId)) {
        setToastMessage("Invalid building ID.");
        setIsToastOpen(true);
        return;
      }

      const { error } = await supabase
        .from(SUBBUILDINGS_TABLE)
        .insert([
          {
            building_id: buildingId,
            name: String(values.name ?? "").trim(),
          },
        ]);

      if (error) {
        throw error;
      }

      await fetchCagesByBuildingId();
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      setToastMessage(`Failed to add cage: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const getStatsForCage = useMemo(() => {
    return (cage: Cage): CageStats => {
      const mortalityOverride = metricOverrides.mortality[selectedDate]?.[cage.id];
      const thinningOverride = metricOverrides.thinning[selectedDate]?.[cage.id];
      const takeOutOverride = metricOverrides.takeOut[selectedDate]?.[cage.id];
      const weightOverride = weightOverrides[selectedDate]?.[cage.id];
      const avgWeight = weightOverride
        ? (() => {
          const totalWeight =
            weightOverride.frontWeights.reduce((sum, w) => sum + w, 0) +
            weightOverride.middleWeights.reduce((sum, w) => sum + w, 0) +
            weightOverride.backWeights.reduce((sum, w) => sum + w, 0);
          const totalChicken =
            weightOverride.frontWeights.length +
            weightOverride.middleWeights.length +
            weightOverride.backWeights.length;
          return totalChicken > 0 ? totalWeight / totalChicken : cage.avgWeight;
        })()
        : cage.avgWeight;
      return {
        avgWeight,
        mortality: mortalityOverride ?? cage.mortality,
        thinning: thinningOverride ?? cage.thinning,
        takeOut: takeOutOverride ?? cage.takeOut,
      };
    };
  }, [selectedDate, metricOverrides, weightOverrides]);

  const filteredCages = useMemo(() => {
    const getTrailingNumber = (name: string): number | null => {
      const match = name.match(/(\d+)\s*$/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    };

    return [...cages].sort((a, b) => {
      const aNum = getTrailingNumber(a.name);
      const bNum = getTrailingNumber(b.name);

      if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
      if (aNum != null && bNum == null) return -1;
      if (aNum == null && bNum != null) return 1;

      const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      if (nameOrder !== 0) return nameOrder;

      return Number(a.id) - Number(b.id);
    });
  }, [cages]);

  const metricMeta: Record<EditableMetric, { title: string; helper: string; label: string; success: string }> = {
    mortality: {
      title: "Mortality",
      helper: "Adjust the mortality count for this cage.",
      label: "Mortality Count",
      success: "Mortality updated successfully.",
    },
    thinning: {
      title: "Thinning",
      helper: "Adjust the thinning count for this cage.",
      label: "Thinning Count",
      success: "Thinning updated successfully.",
    },
    takeOut: {
      title: "Take Out",
      helper: "Adjust the take out count for this cage.",
      label: "Take Out Count",
      success: "Take out updated successfully.",
    },
  };

  const openMetricModal = (metric: EditableMetric, cageId: string, current: number) => {
    const existingRemarks = metricRemarksByType[metric][selectedDate]?.[cageId] ?? "";
    setActiveMetric(metric);
    setActiveCageId(cageId);
    setMetricDraft(current);
    setMetricRemarksDraft(existingRemarks);
    setIsMetricModalOpen(true);
  };

  const openWeightModal = (cageId: string) => {
    setActiveCageId(cageId);
    const existing = weightOverrides[selectedDate]?.[cageId];
    setWeightDraft(
      existing ?? {
        frontWeights: [],
        middleWeights: [],
        backWeights: [],
      }
    );
    setIsWeightModalOpen(true);
  };

  const closeMetricModal = () => {
    setIsMetricModalOpen(false);
    setActiveCageId(null);
    setMetricRemarksDraft("");
  };

  const closeWeightModal = () => {
    setIsWeightModalOpen(false);
    setActiveCageId(null);
  };

  const isSameSelectedDate = (dateTime: string): boolean =>
    dayjs(dateTime).format("YYYY-MM-DD") === selectedDate;

  const resolveGrowForDate = async (
    buildingId: number,
    date: string
  ): Promise<{ id: number; totalAnimals: number; isHarvested: boolean } | null> => {
    const endOfDay = dayjs(date).add(1, "day").startOf("day").toISOString();
    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select("id, total_animals, status, is_harvested")
      .eq("building_id", buildingId)
      .lt("created_at", endOfDay)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const idValue = data?.id;
    if (typeof idValue !== "number") return null;
    const totalAnimals =
      typeof data?.total_animals === "number" && Number.isFinite(data.total_animals)
        ? Math.max(0, Math.floor(data.total_animals))
        : 0;
    const isHarvested =
      data?.is_harvested === true ||
      (typeof data?.status === "string" && data.status.toLowerCase() === "harvested");
    return { id: idValue, totalAnimals, isHarvested };
  };

  const resolveLatestGrowStatus = async (
    buildingId: number
  ): Promise<{ isHarvested: boolean; status: string } | null> => {
    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select("status, is_harvested")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const status = typeof data.status === "string" ? data.status : "";
    const isHarvested =
      data.is_harvested === true || status.toLowerCase() === "harvested";
    return { isHarvested, status };
  };

  const syncEditabilityFromLatestGrow = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setIsLatestGrowHarvested(false);
      return;
    }

    try {
      const latest = await resolveLatestGrowStatus(buildingId);
      if (!latest) {
        setIsLatestGrowHarvested(false);
        return;
      }
      const normalized = latest.status.toLowerCase();
      const isEditableByStatus = normalized === "loading" || normalized === "growing";
      setIsLatestGrowHarvested(!isEditableByStatus || latest.isHarvested);
    } catch (error) {
      setToastMessage(`Failed to load latest grow status: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  useEffect(() => {
    void syncEditabilityFromLatestGrow();
  }, [id]);

  const fetchReductionMetricsByDate = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) return;

    try {
      const { data: growRows, error: growRowsError } = await supabase
        .from(GROWS_TABLE)
        .select("id")
        .eq("building_id", buildingId);

      if (growRowsError) throw growRowsError;

      const growIds = ((growRows ?? []) as Array<{ id: number | null }>).flatMap((row) =>
        typeof row.id === "number" ? [row.id] : []
      );

      if (growIds.length === 0) {
        setGrowLogPreview(null);
        setMetricOverrides((prev) => ({
          ...prev,
          mortality: { ...prev.mortality, [selectedDate]: {} },
          thinning: { ...prev.thinning, [selectedDate]: {} },
          takeOut: { ...prev.takeOut, [selectedDate]: {} },
        }));
        setMetricRemarksByType((prev) => ({
          ...prev,
          mortality: { ...prev.mortality, [selectedDate]: {} },
          thinning: { ...prev.thinning, [selectedDate]: {} },
          takeOut: { ...prev.takeOut, [selectedDate]: {} },
        }));
        return;
      }

      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
      const { data: selectedDayGrowLogRow, error: selectedDayGrowLogError } = await supabase
        .from(GROW_LOGS_TABLE)
        .select("id, created_at, grow_id, subbuilding_id, actual_total_animals, mortality, thinning, take_out")
        .in("grow_id", growIds)
        .gte("created_at", selectedDayStart)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectedDayGrowLogError) throw selectedDayGrowLogError;

      let matchedGrowLogRow = selectedDayGrowLogRow;
      if (!matchedGrowLogRow) {
        const { data: previousGrowLogRow, error: previousGrowLogError } = await supabase
          .from(GROW_LOGS_TABLE)
          .select("id, created_at, grow_id, subbuilding_id, actual_total_animals, mortality, thinning, take_out")
          .in("grow_id", growIds)
          .lt("created_at", selectedDayStart)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousGrowLogError) throw previousGrowLogError;
        matchedGrowLogRow = previousGrowLogRow;
      }

      const selectedDayGrowLog = matchedGrowLogRow
        ? {
          createdAt: matchedGrowLogRow.created_at,
          growId: matchedGrowLogRow.grow_id,
          mortality: matchedGrowLogRow.mortality,
          thinning: matchedGrowLogRow.thinning,
          takeOut: matchedGrowLogRow.take_out,
        }
        : null;

      if (!selectedDayGrowLog) {
        setGrowLogPreview(null);
        setMetricOverrides((prev) => ({
          ...prev,
          mortality: { ...prev.mortality, [selectedDate]: {} },
          thinning: { ...prev.thinning, [selectedDate]: {} },
          takeOut: { ...prev.takeOut, [selectedDate]: {} },
        }));
        setMetricRemarksByType((prev) => ({
          ...prev,
          mortality: { ...prev.mortality, [selectedDate]: {} },
          thinning: { ...prev.thinning, [selectedDate]: {} },
          takeOut: { ...prev.takeOut, [selectedDate]: {} },
        }));
        return;
      }
      const mortalityByCage: Record<string, number> = {};
      const thinningByCage: Record<string, number> = {};
      const takeOutByCage: Record<string, number> = {};
      const mortalityRemarksByCage: Record<string, string> = {};
      const thinningRemarksByCage: Record<string, string> = {};
      const takeOutRemarksByCage: Record<string, string> = {};
      const effectiveDate = dayjs(selectedDayGrowLog.createdAt).format("YYYY-MM-DD");
      const effectiveGrowId = selectedDayGrowLog.growId;
      if (typeof selectedDayGrowLog.growId === "number") {
        const reductions = await loadGrowReductionTransactionsByGrowId(selectedDayGrowLog.growId);
        const selectedDayRows = reductions.filter(
          (row) => dayjs(row.createdAt).format("YYYY-MM-DD") === effectiveDate
        );
        const latestByCageAndType: Record<string, (typeof selectedDayRows)[number]> = {};

        selectedDayRows.forEach((row) => {
          if (row.subbuildingId == null || !row.reductionType) return;
          const key = `${row.subbuildingId}-${row.reductionType}`;
          const previous = latestByCageAndType[key];
          if (!previous || dayjs(row.createdAt).isAfter(dayjs(previous.createdAt))) {
            latestByCageAndType[key] = row;
          }
        });

        Object.values(latestByCageAndType).forEach((row) => {
          if (row.subbuildingId == null || !row.reductionType) return;
          const cageId = String(row.subbuildingId);
          const remarks = row.remarks ?? "";
          if (row.reductionType === "mortality") {
            mortalityRemarksByCage[cageId] = remarks;
          } else if (row.reductionType === "thinning") {
            thinningRemarksByCage[cageId] = remarks;
          } else if (row.reductionType === "take_out") {
            takeOutRemarksByCage[cageId] = remarks;
          }
        });
      }
      if (typeof effectiveGrowId === "number") {
        const effectiveStart = `${effectiveDate}T00:00:00+00:00`;
        const effectiveEnd = `${dayjs(effectiveDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
        const { data: growLogRows, error: growLogRowsError } = await supabase
          .from(GROW_LOGS_TABLE)
          .select("created_at, subbuilding_id, mortality, thinning, take_out")
          .eq("grow_id", effectiveGrowId)
          .gte("created_at", effectiveStart)
          .lt("created_at", effectiveEnd)
          .order("created_at", { ascending: false });

        if (growLogRowsError) throw growLogRowsError;

        const latestByCage: Record<string, { mortality: number; thinning: number; takeOut: number }> = {};
        ((growLogRows ?? []) as Array<{
          created_at: string;
          subbuilding_id: number | null;
          mortality: number | null;
          thinning: number | null;
          take_out: number | null;
        }>).forEach((row) => {
          if (row.subbuilding_id == null) return;
          const cageId = String(row.subbuilding_id);
          if (latestByCage[cageId]) return;
          latestByCage[cageId] = {
            mortality: Math.max(0, Math.floor(row.mortality ?? 0)),
            thinning: Math.max(0, Math.floor(row.thinning ?? 0)),
            takeOut: Math.max(0, Math.floor(row.take_out ?? 0)),
          };
        });

        Object.entries(latestByCage).forEach(([cageId, stats]) => {
          mortalityByCage[cageId] = stats.mortality;
          thinningByCage[cageId] = stats.thinning;
          takeOutByCage[cageId] = stats.takeOut;
        });
      }

      if (Object.keys(mortalityByCage).length === 0 && Object.keys(thinningByCage).length === 0 && Object.keys(takeOutByCage).length === 0) {
        const mortalityFromGrowLog = Math.max(0, Math.floor(selectedDayGrowLog.mortality ?? 0));
        const thinningFromGrowLog = Math.max(0, Math.floor(selectedDayGrowLog.thinning ?? 0));
        const takeOutFromGrowLog = Math.max(0, Math.floor(selectedDayGrowLog.takeOut ?? 0));
        const cageIds = cages.map((c) => c.id);
        if (cageIds.length > 0) {
          const distribute = (total: number): Record<string, number> => {
            const base = Math.floor(total / cageIds.length);
            const remainder = total % cageIds.length;
            return cageIds.reduce<Record<string, number>>((acc, cageId, index) => {
              acc[cageId] = base + (index < remainder ? 1 : 0);
              return acc;
            }, {});
          };
          Object.assign(mortalityByCage, distribute(mortalityFromGrowLog));
          Object.assign(thinningByCage, distribute(thinningFromGrowLog));
          Object.assign(takeOutByCage, distribute(takeOutFromGrowLog));
        }
      }

      setGrowLogPreview({
        createdAt: selectedDayGrowLog.createdAt,
        mortality: Object.values(mortalityByCage).reduce((sum, value) => sum + value, 0),
        thinning: Object.values(thinningByCage).reduce((sum, value) => sum + value, 0),
        takeOut: Object.values(takeOutByCage).reduce((sum, value) => sum + value, 0),
      });

      setMetricOverrides((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: mortalityByCage },
        thinning: { ...prev.thinning, [selectedDate]: thinningByCage },
        takeOut: { ...prev.takeOut, [selectedDate]: takeOutByCage },
      }));

      setMetricRemarksByType((prev) => ({
        ...prev,
        mortality: { ...prev.mortality, [selectedDate]: mortalityRemarksByCage },
        thinning: { ...prev.thinning, [selectedDate]: thinningRemarksByCage },
        takeOut: { ...prev.takeOut, [selectedDate]: takeOutRemarksByCage },
      }));
    } catch (error) {
      setGrowLogPreview(null);
      setToastMessage(`Failed to load reduction metrics: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  useEffect(() => {
    void fetchReductionMetricsByDate();
  }, [id, selectedDate, cages]);

  const handleUpdateMetric = async () => {
    if (isLatestGrowHarvested) {
      setToastMessage("Cage is not editable. Latest grow status is not Loading/Growing.");
      setIsToastOpen(true);
      return;
    }
    if (!activeCageId) return;
    if (!isTodaySelected) return;
    if (metricDraft <= 0) return;

    const buildingId = Number(id);
    const subbuildingId = Number(activeCageId);
    if (!Number.isFinite(buildingId) || !Number.isFinite(subbuildingId)) {
      setToastMessage("Invalid building/cage ID.");
      setIsToastOpen(true);
      return;
    }

    const value = Math.max(0, Math.floor(metricDraft || 0));
    const reductionType = activeMetric === "takeOut" ? "take_out" : activeMetric;

    try {
      const latestGrow = await resolveGrowForDate(buildingId, selectedDate);
      if (!latestGrow) {
        setToastMessage("No grow record found for this building/date.");
        setIsToastOpen(true);
        return;
      }
      const growId = latestGrow.id;
      const growLogs = await loadGrowLogsByGrowId(growId);
      const reductions = await loadGrowReductionTransactionsByGrowId(growId);

      const selectedDayReductions = reductions.filter((row) => isSameSelectedDate(row.createdAt));

      const existingReductionTx =
        selectedDayReductions.find(
          (row) => row.subbuildingId === subbuildingId && row.reductionType === reductionType
        ) ?? null;

      const selectedDayTotals = selectedDayReductions.reduce(
        (acc, row) => {
          const key = row.reductionType;
          const count = row.animalCount ?? 0;
          if (key === "mortality") acc.mortality += count;
          if (key === "thinning") acc.thinning += count;
          if (key === "take_out") acc.takeOut += count;
          return acc;
        },
        { mortality: 0, thinning: 0, takeOut: 0 }
      );
      const selectedCageTotals = selectedDayReductions
        .filter((row) => row.subbuildingId === subbuildingId)
        .reduce(
          (acc, row) => {
            const key = row.reductionType;
            const count = row.animalCount ?? 0;
            if (key === "mortality") acc.mortality += count;
            if (key === "thinning") acc.thinning += count;
            if (key === "take_out") acc.takeOut += count;
            return acc;
          },
          { mortality: 0, thinning: 0, takeOut: 0 }
        );

      const previousValueForThisTx = existingReductionTx?.animalCount ?? 0;
      if (reductionType === "mortality") {
        selectedDayTotals.mortality = Math.max(
          0,
          selectedDayTotals.mortality - previousValueForThisTx + value
        );
        selectedCageTotals.mortality = Math.max(
          0,
          selectedCageTotals.mortality - previousValueForThisTx + value
        );
      } else if (reductionType === "thinning") {
        selectedDayTotals.thinning = Math.max(
          0,
          selectedDayTotals.thinning - previousValueForThisTx + value
        );
        selectedCageTotals.thinning = Math.max(
          0,
          selectedCageTotals.thinning - previousValueForThisTx + value
        );
      } else {
        selectedDayTotals.takeOut = Math.max(
          0,
          selectedDayTotals.takeOut - previousValueForThisTx + value
        );
        selectedCageTotals.takeOut = Math.max(
          0,
          selectedCageTotals.takeOut - previousValueForThisTx + value
        );
      }

      const totalReductionFromOtherDays = growLogs
        .filter((row) => !isSameSelectedDate(row.createdAt))
        .reduce(
          (sum, row) => sum + (row.mortality ?? 0) + (row.thinning ?? 0) + (row.takeOut ?? 0),
          0
        );

      const totalReductionWithSelectedDay =
        totalReductionFromOtherDays +
        selectedDayTotals.mortality +
        selectedDayTotals.thinning +
        selectedDayTotals.takeOut;

      const actualTotalAnimals = Math.max(0, latestGrow.totalAnimals - totalReductionWithSelectedDay);

      const savedGrowLog = await addGrowLog({
        growId,
        subbuildingId,
        mortality: selectedCageTotals.mortality,
        thinning: selectedCageTotals.thinning,
        takeOut: selectedCageTotals.takeOut,
        actualTotalAnimals,
      });

      if (existingReductionTx) {
        await updateGrowReductionTransaction(existingReductionTx.id, {
          growLogId: Number(savedGrowLog.id),
          animalCount: value,
          remarks: metricRemarksDraft.trim() || null,
        });
      } else {
        await addGrowReductionTransaction({
          buildingId,
          subbuildingId,
          growId,
          growLogId: Number(savedGrowLog.id),
          animalCount: value,
          reductionType,
          remarks: metricRemarksDraft.trim() || null,
        });
      }

      setMetricOverrides((prev) => {
        const next = { ...prev };
        const selectedMetric = { ...next[activeMetric] };
        const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
        day[activeCageId] = value;
        selectedMetric[selectedDate] = day;
        next[activeMetric] = selectedMetric;
        return next;
      });
      setMetricRemarksByType((prev) => {
        const next = { ...prev };
        const selectedMetric = { ...next[activeMetric] };
        const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
        day[activeCageId] = metricRemarksDraft.trim();
        selectedMetric[selectedDate] = day;
        next[activeMetric] = selectedMetric;
        return next;
      });

      closeMetricModal();
      setToastMessage(metricMeta[activeMetric].success);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to save ${metricMeta[activeMetric].title.toLowerCase()}: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const isMetricValid = metricDraft > 0;

  const handleUpdateWeight = async () => {
    if (isLatestGrowHarvested) {
      setToastMessage("Cage is not editable. Latest grow status is not Loading/Growing.");
      setIsToastOpen(true);
      return;
    }
    if (!activeCageId) return;
    if (!isTodaySelected) return;
    const buildingId = Number(id);
    const subbuildingId = Number(activeCageId);
    if (!Number.isFinite(buildingId) || !Number.isFinite(subbuildingId)) {
      setToastMessage("Invalid building/cage ID.");
      setIsToastOpen(true);
      return;
    }

    const frontWeights = weightDraft.frontWeights.map((w) => Math.max(0, Number(w) || 0));
    const middleWeights = weightDraft.middleWeights.map((w) => Math.max(0, Number(w) || 0));
    const backWeights = weightDraft.backWeights.map((w) => Math.max(0, Number(w) || 0));
    const clean = {
      frontWeights,
      middleWeights,
      backWeights,
    };

    const totalWeight =
      clean.frontWeights.reduce((sum, w) => sum + w, 0) +
      clean.middleWeights.reduce((sum, w) => sum + w, 0) +
      clean.backWeights.reduce((sum, w) => sum + w, 0);
    const totalChicken =
      clean.frontWeights.length +
      clean.middleWeights.length +
      clean.backWeights.length;
    const avgWeight = totalChicken > 0 ? totalWeight / totalChicken : 0;

    try {
      const latestGrow = await resolveGrowForDate(buildingId, selectedDate);
      if (!latestGrow) {
        setToastMessage("No grow record found for this building/date.");
        setIsToastOpen(true);
        return;
      }
      const growId = latestGrow.id;

      const logs = await loadBodyWeightLogsByBuildingIdAndDate(buildingId, selectedDate);
      const existing = logs.find((row) => row.subbuildingId === subbuildingId);

      if (existing) {
        await updateBodyWeightLog(existing.id, {
          growId,
          avgWeight,
          frontWeight: clean.frontWeights,
          middleWeight: clean.middleWeights,
          backWeight: clean.backWeights,
        });
      } else {
        await addBodyWeightLog({
          buildingId,
          subbuildingId,
          growId,
          avgWeight,
          frontWeight: clean.frontWeights,
          middleWeight: clean.middleWeights,
          backWeight: clean.backWeights,
        });
      }

      setWeightOverrides((prev) => {
        const next = { ...prev };
        const day = next[selectedDate] ? { ...next[selectedDate] } : {};
        day[activeCageId] = clean;
        next[selectedDate] = day;
        return next;
      });

      closeWeightModal();
      setToastMessage("Average weight saved successfully.");
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to save average weight: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    }
  };

  const totalFrontWeight = weightDraft.frontWeights.reduce((sum, w) => sum + w, 0);
  const totalMiddleWeight = weightDraft.middleWeights.reduce((sum, w) => sum + w, 0);
  const totalBackWeight = weightDraft.backWeights.reduce((sum, w) => sum + w, 0);
  const totalWeight = totalFrontWeight + totalMiddleWeight + totalBackWeight;

  const addChickenRowsToSection = (section: keyof WeightEntry) => {
    const rowsToAdd = Math.max(1, Math.floor(Number(addChickenRows) || 1));
    const totalWeightForBatch = Math.max(0, Number(batchWeightToSplit) || 0);
    const valuePerRow = rowsToAdd > 0 ? totalWeightForBatch / rowsToAdd : 0;
    setWeightDraft((prev) => ({
      ...prev,
      [section]: [...prev[section], ...Array.from({ length: rowsToAdd }, () => valuePerRow)],
    }));
  };

  const overviewStats = useMemo(() => {
    return filteredCages.reduce(
      (acc, cage) => {
        const stats = getStatsForCage(cage);
        acc.totalCages += 1;
        acc.totalMortality += stats.mortality;
        acc.totalThinning += stats.thinning;
        acc.totalTakeOut += stats.takeOut;
        acc.totalAvgWeight += stats.avgWeight;
        return acc;
      },
      { totalCages: 0, totalMortality: 0, totalThinning: 0, totalTakeOut: 0, totalAvgWeight: 0 }
    );
  }, [filteredCages, getStatsForCage]);
  const avgWeightAcrossCages =
    overviewStats.totalCages > 0 ? overviewStats.totalAvgWeight / overviewStats.totalCages : 0;

  // const totals = useMemo(() => {
  //   const totalAvgWeight = filteredCages.reduce((sum, c) => sum + getStatsForCage(c).avgWeight, 0);
  //   const totalMortality = filteredCages.reduce((sum, c) => sum + getStatsForCage(c).mortality, 0);
  //   return { totalAvgWeight, totalMortality };
  // }, [filteredCages, getStatsForCage]);

  return (
    <Layout className="min-h-screen bg-slate-100">
      {/* Header */}
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-8 !h-[74px]",
        ].join(" ")}
        style={{ backgroundColor: PRIMARY }}
      >
        <div className={["flex items-center", isMobile ? "gap-2" : "gap-4"].join(" ")}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
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
            icon={<HomeOutlined />}
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
                Cage
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Inventory</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Cage Overview
              </Title>
            </div>
          )}
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

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState
            title="Loading..."
            subtitle=""
            fullScreen
            titleClassName="text-[#008822]"
            subtitleClassName="text-[#008822]/80"
          />
        ) : filteredCages.length === 0 ? (
          <div className="min-h-[calc(100vh-90px)] flex flex-col items-center justify-center">
            <ChickenState
              title="No data yet"
              subtitle="No cages found for this building."
            />
            {canManageCages ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="!h-11 !px-4 !rounded-lg"
                style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
                onClick={handleOpenAdd}
              >
                Add First Cage
              </Button>
            ) : (
              <div className="mt-3 text-sm text-slate-600 text-center">
                Contact an Admin or Supervisor to add a new cage.
              </div>
            )}
          </div>
        ) : (
          <>
            {isMobile ? (
              <div
                className={[
                  "bg-white shadow-sm",
                  "rounded-lg px-3 py-3 mb-3",
                ].join(" ")}
              >
                <div className="text-slate-600 font-medium text-xs mb-2">
                  Date
                </div>
                <DatePicker
                  className="!w-full"
                  size="middle"
                  placeholder="Select date"
                  value={dayjs(selectedDate)}
                  onChange={handleDateChange}
                  style={{ fontSize: 16 }}
                  styles={{ input: { fontSize: 16 } }}
                />
                <div className="mt-2 text-xs text-slate-600">
                  Filtered Date: <span className="font-semibold text-slate-800">{dayjs(selectedDate).format("MMMM D, YYYY")}</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  GrowLogs:{" "}
                  <span className="font-semibold text-slate-800">
                    {growLogPreview
                      ? `${dayjs(growLogPreview.createdAt).format("MMMM D, YYYY h:mm A")}${dayjs(growLogPreview.createdAt).format("YYYY-MM-DD") !== selectedDate ? " (latest previous)" : ""} (M:${growLogPreview.mortality}, T:${growLogPreview.thinning}, O:${growLogPreview.takeOut})`
                      : "No record on selected date"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-6 grid grid-cols-12 gap-4">
                <div className="col-span-8 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-6 py-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Daily Snapshot
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">Cage Operations</div>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cages</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalCages}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Avg Weight</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {avgWeightAcrossCages.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} kg
                      </div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Mortality</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalMortality.toLocaleString()}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Thinning / Out</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {(overviewStats.totalThinning + overviewStats.totalTakeOut).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 rounded-sm border border-slate-200 bg-white px-5 py-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Filter</div>
                  <div className="mt-1 text-base font-semibold text-slate-800">Date</div>
                  <DatePicker
                    className="!mt-3 !w-full"
                    size="large"
                    placeholder="Select date"
                    value={dayjs(selectedDate)}
                    onChange={handleDateChange}
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                  />
                  <div className="mt-3 text-xs text-slate-500">
                    Showing data for {dayjs(selectedDate).format("MMMM D, YYYY")}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    GrowLogs:{" "}
                    <span className="font-semibold text-slate-800">
                      {growLogPreview
                        ? `${dayjs(growLogPreview.createdAt).format("MMMM D, YYYY h:mm A")}${dayjs(growLogPreview.createdAt).format("YYYY-MM-DD") !== selectedDate ? " (latest previous)" : ""} (M:${growLogPreview.mortality}, T:${growLogPreview.thinning}, O:${growLogPreview.takeOut})`
                        : "No record on selected date"}
                    </span>
                  </div>
                  {isTodaySelected && (
                    canManageCages ? (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        className="!mt-4 !h-10 !w-full !rounded-sm !font-semibold"
                        style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
                        onClick={handleOpenAdd}
                      >
                        Add Cage
                      </Button>
                    ) : (
                      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Contact Admin/Supervisor to add cage.
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Active Cages Section */}
            <div>
              <div
                className={[
                  "bg-[#ffa6001f] flex items-center justify-between gap-2",
                  isMobile ? "rounded-lg px-3 py-2" : "rounded-sm px-5 py-3 border border-amber-200",
                ].join(" ")}
              >
                <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-base"].join(" ")}>
                  Active Cages ({filteredCages.length})
                </div>
                <div className={["text-slate-600 text-right", isMobile ? "text-[11px]" : "text-xs"].join(" ")}>
                  Building: <span className="font-semibold text-slate-800">{selectedBuildingName || "-"}</span>
                </div>
              </div>

              <Divider className={isMobile ? "!my-2" : "!my-3"} />

              <div className={isMobile ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4"}>
                {filteredCages.map((c, index) => (
                  <CageRow
                    key={c.id}
                    c={c}
                    stats={getStatsForCage(c)}
                    isMobile={isMobile}
                    displayName={c.name || `Cage ${index + 1}`}
                    hideMetrics={isLatestGrowHarvested}
                    onMortalityClick={(cageId, current) => openMetricModal("mortality", cageId, current)}
                    onThinningClick={(cageId, current) => openMetricModal("thinning", cageId, current)}
                    onTakeOutClick={(cageId, current) => openMetricModal("takeOut", cageId, current)}
                    onWeightClick={openWeightModal}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Floating Add Button */}
        {isMobile && isTodaySelected && filteredCages.length > 0 && !isLoading && (
          canManageCages ? (
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
          ) : (
            <div className={["fixed z-50", "bottom-6 right-6"].join(" ")}>
              <div className="rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md">
                Contact Admin/Supervisor to add cage.
              </div>
            </div>
          )
        )}
      </Content>

      <Drawer
        open={isAddModalOpen}
        onClose={handleCloseAdd}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "60%" : undefined}
        width={isMobile ? undefined : 460}
        className="add-cage-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Add New Cage
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter the details to create a new cage record.
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Cage Name"
            name="name"
            rules={[{ required: true, message: "Please enter cage name" }]}
          >
            <Input placeholder="e.g., Cage 6" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
            >
              Add Cage
            </Button>
          </div>
        </Form>
      </Drawer>

      <Drawer
        open={isMetricModalOpen}
        onClose={closeMetricModal}
        placement="bottom"
        height={isMobile ? "60%" : 420}
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
          {!isTodaySelected && (
            <div className="text-amber-600 text-xs mt-1">
              Previous dates are view-only.
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">{metricMeta[activeMetric].label}</div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setMetricDraft((v) => Math.max(0, (v || 0) - 1))}
              disabled={!isTodaySelected}
            >
              -
            </Button>
            <InputNumber
              min={0}
              value={metricDraft}
              onChange={(v) => setMetricDraft(Number(v) || 0)}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
              disabled={!isTodaySelected}
            />
            <Button
              onClick={() => setMetricDraft((v) => (v || 0) + 1)}
              disabled={!isTodaySelected}
            >
              +
            </Button>
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 mb-2">Remarks</div>
            <Input.TextArea
              rows={3}
              value={metricRemarksDraft}
              onChange={(e) => setMetricRemarksDraft(e.target.value)}
              placeholder="Add remarks (optional)"
              className="!text-base"
              disabled={!isTodaySelected}
            />
          </div>
          {isTodaySelected && !isMetricValid && (
            <div className="text-xs text-red-500 mt-2">
              {metricMeta[activeMetric].label} is required.
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeMetricModal}>
            Cancel
          </Button>
          {isTodaySelected && (
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleUpdateMetric}
              disabled={!isMetricValid}
            >
              Update
            </Button>
          )}
        </div>
      </Drawer>

      <Drawer
        open={isWeightModalOpen}
        onClose={closeWeightModal}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="weight-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update Avg. Weight
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter individual chicken weights by section (kg).
          </div>
          {!isTodaySelected && (
            <div className="text-amber-600 text-xs mt-1">
              Previous dates are view-only.
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <div>
            <div className="text-[11px] text-slate-500 mb-2">Chicken to add</div>
            <Select
              value={addChickenRows}
              onChange={(value) => setAddChickenRows(Number(value))}
              options={[
                { label: "1 chicken", value: 1 },
                { label: "5 chicken", value: 5 },
                { label: "10 chicken", value: 10 },
              ]}
              className="!w-full"
              size="large"
              disabled={!isTodaySelected}
            />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-2">Total weight to split (kg)</div>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              stringMode
              placeholder="No data yet"
              value={batchWeightToSplit}
              onChange={(value) => setBatchWeightToSplit(Math.max(0, Number(value) || 0))}
              inputMode="decimal"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
              disabled={!isTodaySelected}
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Each added row gets:{" "}
              {(Math.max(0, Number(batchWeightToSplit) || 0) / Math.max(1, Math.floor(Number(addChickenRows) || 1))).toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}{" "}
              kg
            </div>
          </div>
          <Tabs
            type="card"
            size="large"
            className={[
              "weight-section-tabs",
              "[&_.ant-tabs-nav]:!mb-3",
              "[&_.ant-tabs-nav-list]:!w-full",
              "[&_.ant-tabs-tab]:!m-0",
              "[&_.ant-tabs-tab]:!flex-1",
              "[&_.ant-tabs-tab]:!justify-center",
              "[&_.ant-tabs-tab]:!text-sm",
              "[&_.ant-tabs-tab]:!font-semibold",
              "[&_.ant-tabs-tab]:!py-2",
              "[&_.ant-tabs-tab]:!px-2",
              "[&_.ant-tabs-tab]:!bg-white",
              "[&_.ant-tabs-tab]:!border-slate-200",
              "[&_.ant-tabs-tab-active]:!bg-[#ffa600]",
              "[&_.ant-tabs-tab-active]:!border-[#ffa600]",
              "[&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:!text-white",
            ].join(" ")}
            items={[
              {
                key: "front",
                label: "Front",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Front Chicken Weights (kg)</div>
                    <div className="space-y-2">
                      {weightDraft.frontWeights.length === 0 && (
                        <div className="text-xs text-slate-500">No data yet. Click Add Chicken.</div>
                      )}
                      {weightDraft.frontWeights.map((weight, index) => (
                        <div key={`front-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            placeholder="No data yet"
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                frontWeights: prev.frontWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                frontWeights: prev.frontWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addChickenRowsToSection("frontWeights")}
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Front Weight: {totalFrontWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} kg
                    </div>
                  </div>
                ),
              },
              {
                key: "middle",
                label: "Middle",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Middle Chicken Weights (kg)</div>
                    <div className="space-y-2">
                      {weightDraft.middleWeights.length === 0 && (
                        <div className="text-xs text-slate-500">No data yet. Click Add Chicken.</div>
                      )}
                      {weightDraft.middleWeights.map((weight, index) => (
                        <div key={`middle-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            placeholder="No data yet"
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                middleWeights: prev.middleWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                middleWeights: prev.middleWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addChickenRowsToSection("middleWeights")}
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Middle Weight: {totalMiddleWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} kg
                    </div>
                  </div>
                ),
              },
              {
                key: "back",
                label: "Back",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Back Chicken Weights (kg)</div>
                    <div className="space-y-2">
                      {weightDraft.backWeights.length === 0 && (
                        <div className="text-xs text-slate-500">No data yet. Click Add Chicken.</div>
                      )}
                      {weightDraft.backWeights.map((weight, index) => (
                        <div key={`back-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            placeholder="No data yet"
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                backWeights: prev.backWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                backWeights: prev.backWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addChickenRowsToSection("backWeights")}
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Back Weight: {totalBackWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} kg
                    </div>
                  </div>
                ),
              },
            ]}
          />
          <div className="text-sm font-semibold text-slate-800">
            Total: {totalWeight.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} kg
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeWeightModal}>
            Cancel
          </Button>
          {isTodaySelected && (
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleUpdateWeight}
            >
              Update
            </Button>
          )}
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

