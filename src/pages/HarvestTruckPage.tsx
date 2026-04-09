import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Drawer, Form, Input, Popconfirm } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import { loadHarvestReductionTransactionsByHarvestId } from "../controller/harvestLogsCrud";
import {
  addHarvest,
  addHarvestTruck,
  deleteHarvestTruck,
  getHarvestById,
  loadHarvests,
  loadHarvestTrucks,
  updateHarvest,
  updateHarvestTruck,
} from "../controller/harvestCrud";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Truck = {
  status: "Loading" | "Completed";
  id: string;
  harvestId: number | null;
  name: string;
  dateTime: string;
  plateNo: string;
  weightNoLoad: number;
  birdsLoad: number;
  weightLoad: number;
  isLoaded: boolean;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";

type UserRole = "Admin" | "Supervisor" | "Staff" | null;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Failed to add truck.";
}

const parseTruckDate = (value: string) => {
  const withTime = dayjs(value, "YYYY-MM-DD HH:mm", true);
  if (withTime.isValid()) return withTime;
  const dateOnly = dayjs(value, "YYYY-MM-DD", true);
  if (dateOnly.isValid()) return dateOnly;
  return dayjs(value);
};

const computeAvgWeight = (truck: Truck) => {
  if (truck.birdsLoad <= 0) return null;
  return (truck.weightLoad - truck.weightNoLoad) / truck.birdsLoad;
};

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  const isClickable = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={[
        "w-full rounded-lg border border-emerald-200 bg-slate-50 px-2 py-1.5 text-left",
        isClickable ? "cursor-pointer transition hover:border-emerald-400 hover:bg-emerald-50" : "cursor-default",
      ].join(" ")}
    >
      <div className="text-[10px] text-slate-500 leading-none">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold text-slate-900 leading-none">
        {value}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: Truck["status"] }) {
  const styles: Record<Truck["status"], { dot: string; text: string }> = {
    Loading: { dot: "bg-blue-500", text: "text-blue-700" },
    Completed: { dot: "bg-emerald-500", text: "text-emerald-700" },
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
      <div className="mt-3 text-sm font-semibold text-[#008822]">{title}</div>
      <div className="mt-1 text-xs text-[#008822]/80">{subtitle}</div>
    </div>
  );
}

function TruckRow({
  truck,
  isMobile,
  displayName,
  canLoad,
  canDelete,
  canEditBirdsLoad,
  onLoadClick,
  onDeleteClick,
  onEditClick,
}: {
  truck: Truck;
  isMobile: boolean;
  displayName: string;
  canLoad: boolean;
  canDelete: boolean;
  canEditBirdsLoad: boolean;
  onLoadClick: (truck: Truck) => void;
  onDeleteClick: (truck: Truck) => void;
  onEditClick: (truck: Truck) => void;
}) {
  const avgWeight = computeAvgWeight(truck);

  return (
    <Card
      className={[
        "!border !border-emerald-200 bg-white/95 shadow-sm transition h-full",
        "hover:shadow-md",
        "!rounded-sm",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 14 }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-sm"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img src="/img/truck2.svg" alt="Truck" className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
              {displayName}
            </div>
            {truck.status === "Loading" && (
              <div className="flex items-center gap-2">
                {canDelete && (
                  <Popconfirm
                    title={`Remove ${truck.name}?`}
                    description="This will permanently remove this truck record."
                    okText="Yes, remove"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onDeleteClick(truck)}
                  >
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className={[
                        "!font-semibold !border-0 !text-white shadow-sm hover:!text-white",
                        "!bg-gradient-to-r !from-rose-500 !to-red-600 hover:!from-rose-600 hover:!to-red-700",
                        "!shadow-[0_8px_18px_rgba(220,38,38,0.22)] !rounded-full",
                        isMobile ? "!px-3 !h-6 !text-[12px]" : "!px-4 !h-8 !text-[12px]",
                      ].join(" ")}
                      style={{
                        borderColor: "transparent",
                      }}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                )}
                {canLoad && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadClick(truck);
                    }}
                    className={[
                      "!font-medium shadow-sm !rounded-md",
                      isMobile ? "!px-3 !h-6 !text-[12px]" : "!px-4 !h-8 !text-[12px]",
                    ].join(" ")}
                    style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
                  >
                    Load Truck
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Date & time"
              value={truck.dateTime ? parseTruckDate(truck.dateTime).format("MMMM D, YYYY HH:mm") : "N/A"}
            />
            <StatPill label="Plate No." value={truck.plateNo?.trim() ? truck.plateNo : "N/A"} />
            <StatPill
              label="Weight(No Load)"
              value={truck.weightNoLoad > 0 ? `${truck.weightNoLoad.toLocaleString()} g` : "0 g"}
              onClick={canEditBirdsLoad ? () => onEditClick(truck) : undefined}
            />
            <StatPill
              label="Weight(Load)"
              value={truck.weightLoad > 0 ? `${truck.weightLoad.toLocaleString()} g` : "0 g"}
            />
            <StatPill
              label="Birds Load"
              value={truck.birdsLoad > 0 ? truck.birdsLoad.toLocaleString() : "0"}
              onClick={canEditBirdsLoad ? () => onLoadClick(truck) : undefined}
            />
            <StatPill
              label="Avg. Weight"
              value={avgWeight !== null ? `${avgWeight.toFixed(2)} g/bird` : "N/A"}
            />
            <StatPill label="Status" value={<StatusBadge status={truck.status} />} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function HarvestTruckPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id: buildingIdParam } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get("date") ?? dayjs().format("YYYY-MM-DD"));
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [isLoadingTrucks, setIsLoadingTrucks] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [isLoadDrawerOpen, setIsLoadDrawerOpen] = useState(false);
  const [isSavingLoad, setIsSavingLoad] = useState(false);
  const [activeEditTruckId, setActiveEditTruckId] = useState<string | null>(null);
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null);
  const [activeHarvestRemaining, setActiveHarvestRemaining] = useState<number | null>(null);
  const [activeTruckPreviousBirdsLoad, setActiveTruckPreviousBirdsLoad] = useState(0);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [addForm] = Form.useForm();
  const [loadForm] = Form.useForm();
  const loadFormValues = Form.useWatch([], loadForm);

  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const canLoadTruck = isTodaySelected || userRole === "Admin" || userRole === "Supervisor";
  const isLoadFormValid =
    Number(loadFormValues?.weightLoad) > 0 &&
    Number(loadFormValues?.birdsLoad) > 0;

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    const nextDate = date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
    setToastMessage(`Filtered date: ${dayjs(nextDate).format("MMM D, YYYY")}`);
    setIsToastOpen(true);
  };

  useEffect(() => {
    const nextDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
  }, [searchParams]);

  const filteredTrucks = useMemo(() => {
    const getTrailingNumber = (name: string): number | null => {
      const match = name.match(/(\d+)\s*$/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    };

    return trucks
      .filter((truck) => parseTruckDate(truck.dateTime).format("YYYY-MM-DD") === selectedDate)
      .sort((a, b) => {
        const aNum = getTrailingNumber(a.name);
        const bNum = getTrailingNumber(b.name);

        if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
        if (aNum != null && bNum == null) return -1;
        if (aNum == null && bNum != null) return 1;

        const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        if (nameOrder !== 0) return nameOrder;

        return parseTruckDate(a.dateTime).valueOf() - parseTruckDate(b.dateTime).valueOf();
      });
  }, [trucks, selectedDate]);

  const activeTruck = useMemo(() => {
    if (!activeTruckId) return null;
    return trucks.find((truck) => truck.id === activeTruckId) ?? null;
  }, [activeTruckId, trucks]);

  const loadDrawerAvgWeight = useMemo(() => {
    if (!activeTruck) return null;
    const weightLoad = Number(loadFormValues?.weightLoad) || 0;
    const birdsLoad = Number(loadFormValues?.birdsLoad) || 0;
    if (birdsLoad <= 0) return null;
    return (weightLoad - activeTruck.weightNoLoad) / birdsLoad;
  }, [activeTruck, loadFormValues?.birdsLoad, loadFormValues?.weightLoad]);

  const totals = useMemo(() => {
    const totalBirdsLoad = filteredTrucks.reduce((sum, t) => sum + t.birdsLoad, 0);
    const totalWeightLoad = filteredTrucks.reduce((sum, t) => sum + t.weightLoad, 0);
    return { totalBirdsLoad, totalWeightLoad };
  }, [filteredTrucks]);
  const overviewStats = useMemo(() => {
    const loadingCount = filteredTrucks.filter((truck) => truck.status === "Loading").length;
    const completedCount = filteredTrucks.filter((truck) => truck.status === "Completed").length;
    const avgWeightLoaded =
      totals.totalBirdsLoad > 0 ? totals.totalWeightLoad / totals.totalBirdsLoad : 0;
    return {
      totalTrucks: filteredTrucks.length,
      loadingCount,
      completedCount,
      avgWeightLoaded,
    };
  }, [filteredTrucks, totals.totalBirdsLoad, totals.totalWeightLoad]);

  const getGrowTotalAnimals = async (growId: number | null, fallbackBuildingId: number): Promise<number | null> => {
    if (growId !== null) {
      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

      const { data: selectedDayGrowLogs, error: selectedDayGrowLogsError } = await supabase
        .from(GROW_LOGS_TABLE)
        .select("actual_total_animals, created_at")
        .eq("grow_id", growId)
        .gte("created_at", selectedDayStart)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false })
        .limit(1);

      if (selectedDayGrowLogsError) throw selectedDayGrowLogsError;
      if (selectedDayGrowLogs && selectedDayGrowLogs.length > 0) {
        return Math.max(0, Math.floor(Number(selectedDayGrowLogs[0]?.actual_total_animals ?? 0)));
      }

      const { data: previousGrowLogs, error: previousGrowLogsError } = await supabase
        .from(GROW_LOGS_TABLE)
        .select("actual_total_animals, created_at")
        .eq("grow_id", growId)
        .lt("created_at", selectedDayStart)
        .order("created_at", { ascending: false })
        .limit(1);

      if (previousGrowLogsError) throw previousGrowLogsError;
      if (previousGrowLogs && previousGrowLogs.length > 0) {
        return Math.max(0, Math.floor(Number(previousGrowLogs[0]?.actual_total_animals ?? 0)));
      }

      const { data, error } = await supabase
        .from(GROWS_TABLE)
        .select("total_animals")
        .eq("id", growId)
        .single();

      if (error) throw error;
      return Math.max(0, Math.floor(Number(data?.total_animals ?? 0)));
    }

    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select("total_animals, created_at")
      .eq("building_id", fallbackBuildingId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return Math.max(0, Math.floor(Number(data[0]?.total_animals ?? 0)));
  };

  const resolveCurrentGrowIdForBuilding = async (buildingId: number): Promise<number | null> => {
    const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
    const { data: growRows, error: growError } = await supabase
      .from(GROWS_TABLE)
      .select("id, created_at")
      .eq("building_id", buildingId)
      .lt("created_at", selectedDayEnd)
      .order("created_at", { ascending: false })
      .limit(1);

    if (growError) throw growError;

    const grow = (growRows?.[0] ?? null) as { id: number } | null;
    return grow ? Number(grow.id) : null;
  };

  const fetchTrucksFromSupabase = async () => {
    const buildingId = Number(buildingIdParam);
    if (!Number.isFinite(buildingId) || buildingId <= 0) {
      setTrucks([]);
      return;
    }

    setIsLoadingTrucks(true);
    try {
      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
      const growId = await resolveCurrentGrowIdForBuilding(buildingId);
      if (growId === null) {
        setTrucks([]);
        return;
      }

      const harvests = await loadHarvests({ growId, limit: 500 });
      if (harvests.length === 0) {
        setTrucks([]);
        return;
      }

      const byHarvest = await Promise.all(
        harvests.map((harvest) =>
          loadHarvestTrucks({
            harvestId: Number(harvest.id),
            createdFrom: selectedDayStart,
            createdTo: selectedDayEnd,
            ascending: false,
            limit: 500,
          })
        )
      );

      const merged = byHarvest
        .flat()
        .map<Truck>((row) => {
          const normalizedStatus = (row.status ?? "").toLowerCase();
          const status: Truck["status"] = normalizedStatus === "completed" || normalizedStatus === "complete"
            ? "Completed"
            : "Loading";
          return {
            id: row.id,
            harvestId: row.harvestId,
            name: row.name || "Truck",
            dateTime: dayjs(row.createdAt).format("YYYY-MM-DD HH:mm"),
            plateNo: row.plateNo || "",
            weightNoLoad: Number(row.weightNoLoad) || 0,
            birdsLoad: Number(row.animalsLoaded) || 0,
            weightLoad: Number(row.weightWithLoad) || 0,
            status,
            isLoaded: status === "Completed",
          };
        })
        .sort((a, b) => parseTruckDate(b.dateTime).valueOf() - parseTruckDate(a.dateTime).valueOf());

      setTrucks(merged);
    } catch (error) {
      console.error("Failed to load trucks from Supabase:", error);
      setTrucks([]);
    } finally {
      setIsLoadingTrucks(false);
    }
  };

  useEffect(() => {
    void fetchTrucksFromSupabase();
  }, [buildingIdParam, selectedDate]);

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

  const handleOpenAdd = () => {
    setActiveEditTruckId(null);
    const nextIndex = filteredTrucks.length + 1;
    addForm.setFieldsValue({
      name: `Truck ${nextIndex}`,
      dateTime: dayjs(),
      plateNo: "",
      weightNoLoad: 0,
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    setActiveEditTruckId(null);
    addForm.resetFields();
  };

  const handleOpenEditTruck = (truck: Truck) => {
    if (userRole !== "Admin") return;
    setActiveEditTruckId(truck.id);
    addForm.setFieldsValue({
      name: truck.name,
      dateTime: parseTruckDate(truck.dateTime),
      plateNo: truck.plateNo,
      weightNoLoad: truck.weightNoLoad,
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteTruck = async (truck: Truck) => {
    if (userRole !== "Admin" || truck.status !== "Loading") return;

    try {
      await deleteHarvestTruck(truck.id);
      if (activeTruckId === truck.id) {
        handleCloseLoadDrawer();
      }
      await fetchTrucksFromSupabase();
      setToastMessage(`${truck.name} deleted successfully.`);
      setIsToastOpen(true);
    } catch (error) {
      console.error("Failed to delete truck:", error);
      setToastMessage("Failed to delete truck.");
      setIsToastOpen(true);
    }
  };

  const handleSubmitAdd = async () => {
    let createdTruckId: string | null = null;
    setIsSavingAdd(true);
    try {
      const values = await addForm.validateFields();
      const buildingId = Number(buildingIdParam);
      if (!Number.isFinite(buildingId) || buildingId <= 0) {
        throw new Error("Invalid building id.");
      }

      if (activeEditTruckId) {
        await updateHarvestTruck(activeEditTruckId, {
          name: values.name,
          plateNo: values.plateNo,
          weightNoLoad: Number(values.weightNoLoad) || 0,
        });

        await fetchTrucksFromSupabase();
        handleCloseAdd();
        setToastMessage(`Successfully updated ${values.name}`);
        setIsToastOpen(true);
        return;
      }

      // 1) Insert to HarvestTrucks first, default status = Loading.
      const createdTruck = await addHarvestTruck({
        harvestId: null,
        name: values.name,
        plateNo: values.plateNo,
        weightNoLoad: Number(values.weightNoLoad) || 0,
        weightWithLoad: 0,
        animalsLoaded: 0,
        status: "Loading",
      });
      createdTruckId = createdTruck.id;

      // 2) Upsert Harvests with default status = Loading.
      const growId = await resolveCurrentGrowIdForBuilding(buildingId);

      const existingHarvests = await loadHarvests({
        ...(growId !== null ? { growId } : { buildingId }),
        limit: 1,
      });
      const harvestRecord = existingHarvests.length > 0
        ? await updateHarvest(existingHarvests[0].id, {
            buildingId,
            growId,
            status: "Loading",
          })
        : await addHarvest({
            buildingId,
            growId,
            totalAnimals: 0,
            status: "Loading",
          });

      // Keep relation after Harvest is available.
      await updateHarvestTruck(createdTruck.id, {
        harvestId: Number(harvestRecord.id),
        status: "Loading",
      });

      await fetchTrucksFromSupabase();
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch (error) {
      if (createdTruckId) {
        await deleteHarvestTruck(createdTruckId).catch(() => undefined);
      }
      const message = getErrorMessage(error);
      console.error("Failed to add truck:", error);
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleOpenLoadDrawer = (truck: Truck) => {
    const buildingId = Number(buildingIdParam);
    setActiveTruckId(truck.id);
    setActiveTruckPreviousBirdsLoad(truck.birdsLoad || 0);
    setActiveHarvestRemaining(null);

    if (truck.harvestId !== null && Number.isFinite(buildingId) && buildingId > 0) {
      void getHarvestById(truck.harvestId)
        .then(async (harvest) => {
          const growTotalAnimals = await getGrowTotalAnimals(harvest.growId, buildingId);
          if (growTotalAnimals === null) {
            setActiveHarvestRemaining(null);
            return;
          }

          const reductions = await loadHarvestReductionTransactionsByHarvestId(Number(harvest.id));
          const reductionTotal = reductions.reduce(
            (sum, row) => sum + Math.max(0, Math.floor(Number(row.animalCount ?? 0))),
            0
          );
          const remaining = Math.max(
            0,
            growTotalAnimals - Math.max(0, Math.floor(Number(harvest.totalAnimals ?? 0))) - reductionTotal
          );
          setActiveHarvestRemaining(remaining);
        })
        .catch(() => {
          setActiveHarvestRemaining(null);
        });
    }

    loadForm.setFieldsValue({
      weightLoad: truck.weightLoad || 0,
      birdsLoad: truck.birdsLoad || 0,
    });
    setIsLoadDrawerOpen(true);
  };

  const handleCloseLoadDrawer = () => {
    setIsLoadDrawerOpen(false);
    setActiveTruckId(null);
    setActiveHarvestRemaining(null);
    setActiveTruckPreviousBirdsLoad(0);
    loadForm.resetFields();
  };

  const handleSubmitLoad = async () => {
    setIsSavingLoad(true);
    try {
      if (!activeTruckId) return;
      const values = await loadForm.validateFields();

      const nextWeightLoad = Number(values.weightLoad) || 0;
      const nextAnimalsLoaded = Number(values.birdsLoad) || 0;
      const animalsLoadedDelta = nextAnimalsLoaded - activeTruckPreviousBirdsLoad;

      const updatedTruck = await updateHarvestTruck(activeTruckId, {
        weightWithLoad: nextWeightLoad,
        animalsLoaded: nextAnimalsLoaded,
        status: "Completed",
      });

      if (updatedTruck.harvestId !== null) {
        const buildingId = Number(buildingIdParam);
        if (!Number.isFinite(buildingId) || buildingId <= 0) {
          throw new Error("Invalid building id.");
        }

        const harvest = await getHarvestById(updatedTruck.harvestId);
        const nextTotalAnimalsOut = Math.max(0, harvest.totalAnimals + animalsLoadedDelta);
        const growTotalAnimals = await getGrowTotalAnimals(harvest.growId, buildingId);
        const reductions = await loadHarvestReductionTransactionsByHarvestId(Number(harvest.id));
        const reductionTotal = reductions.reduce(
          (sum, row) => sum + Math.max(0, Math.floor(Number(row.animalCount ?? 0))),
          0
        );
        const remainingAfterLoad = growTotalAnimals === null
          ? null
          : Math.max(0, growTotalAnimals - nextTotalAnimalsOut - reductionTotal);

        const shouldMarkHarvestCompleted = remainingAfterLoad !== null && remainingAfterLoad <= 0;
        const shouldUpdateTotalAnimalsOut = animalsLoadedDelta !== 0;

        if (shouldUpdateTotalAnimalsOut || shouldMarkHarvestCompleted) {
          await updateHarvest(harvest.id, {
            ...(shouldUpdateTotalAnimalsOut ? { totalAnimals: nextTotalAnimalsOut } : {}),
            ...(shouldMarkHarvestCompleted ? { status: "Completed" } : {}),
          });
        }

        if (shouldMarkHarvestCompleted && harvest.growId !== null) {
          const { error: growUpdateError } = await supabase
            .from(GROWS_TABLE)
            .update({
              status: "Harvested",
              is_harvested: true,
            })
            .eq("id", harvest.growId);

          if (growUpdateError) throw growUpdateError;
        }
      }

      await fetchTrucksFromSupabase();
      handleCloseLoadDrawer();
      setToastMessage("Truck loaded successfully.");
      setIsToastOpen(true);
    } catch {
      // validation handled by antd
    } finally {
      setIsSavingLoad(false);
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
          {isMobile ? (
            <>
              <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
              <Title level={4} className="!m-0 !text-base !text-white">
                Truck
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Harvest</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Truck Operations
              </Title>
            </div>
          )}
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
        {isLoadingTrucks ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
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
                  onChange={handleDateChange}
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
                  <div className="mt-1 text-2xl font-bold text-slate-900">Truck Dispatch & Loads</div>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Trucks</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.totalTrucks}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Completed</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{overviewStats.completedCount}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Birds Loaded</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{totals.totalBirdsLoad.toLocaleString()}</div>
                    </div>
                    <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Avg Weight</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {overviewStats.avgWeightLoaded.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} g/bird
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
                    onChange={handleDateChange}
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                  />
                  <div className="mt-3 text-xs text-slate-500">
                    Showing data for {dayjs(selectedDate).format("MMMM D, YYYY")}
                  </div>
                  {isTodaySelected && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      className="!mt-4 !h-10 !w-full !rounded-sm !font-semibold"
                      style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
                      onClick={handleOpenAdd}
                    >
                      Add Truck
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className={["bg-[#ffa6001f]", isMobile ? "rounded-sm px-3 py-2" : "rounded-sm px-5 py-3 border border-amber-200"].join(" ")}>
                <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-base"].join(" ")}>
                  Active Trucks ({filteredTrucks.length})
                </div>
              </div>

              <Divider className={isMobile ? "!my-2" : "!my-3"} />

              <div className="bg-white rounded-sm border border-emerald-200 shadow-sm p-3 mb-3 flex items-center justify-between text-sm">
                <div className="text-slate-600">
                  Total Birds Load: <span className="font-semibold text-slate-900">{totals.totalBirdsLoad.toLocaleString()}</span>
                </div>
                <div className="text-slate-600">
                  Total Weight (Load):{" "}
                  <span className="font-semibold text-slate-900">{totals.totalWeightLoad.toLocaleString()} g</span>
                </div>
              </div>

              <div className={isMobile ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4"}>
                {filteredTrucks.map((truck) => (
                  <TruckRow
                    key={truck.id}
                    truck={truck}
                    isMobile={isMobile}
                    displayName={truck.name}
                    canLoad={canLoadTruck}
                    canDelete={userRole === "Admin"}
                    canEditBirdsLoad={userRole === "Admin"}
                    onLoadClick={handleOpenLoadDrawer}
                    onDeleteClick={handleDeleteTruck}
                    onEditClick={handleOpenEditTruck}
                  />
                ))}
              </div>
            </div>

            {isMobile && isTodaySelected && (
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
          </>
        )}
      </Content>

      <Drawer
        open={isAddModalOpen}
        onClose={handleCloseAdd}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "70%" : undefined}
        width={isMobile ? undefined : 460}
        className="add-truck-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            {activeEditTruckId ? "Edit Truck" : "Add Truck"}
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            {activeEditTruckId ? "Update the details for this truck record." : "Enter the details to add a truck record."}
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item label="Truck Name" name="name" rules={[{ required: true, message: "Please enter truck name" }]}>
            <Input placeholder="e.g., Truck 4" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Date"
            name="dateTime"
            rules={[{ required: true, message: "Please enter date and time" }]}
          >
            <DatePicker
              format="MMMM D, YYYY"
              className="!w-full"
              size="large"
              placeholder="Select date"
            />
          </Form.Item>
          <Form.Item
            label="Plate No."
            name="plateNo"
            rules={[
              { required: true },
              {
                validator: (_, value) =>
                  typeof value === "string" && value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("Please enter plate no.")),
              },
            ]}
          >
            <Input placeholder="e.g., ABC-1234" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Weight of Truck(No Load)"
            name="weightNoLoad"
            rules={[
              { required: true, message: "Please enter weight (no load)" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
            ]}
          >
            <Input min={0} type="number" inputMode="decimal" size="large" className="!text-base" />
          </Form.Item>
          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
              loading={isSavingAdd}
              disabled={isSavingAdd}
            >
              {activeEditTruckId ? "Save Changes" : "Load Truck"}
            </Button>
          </div>
        </Form>
      </Drawer>

      <Drawer
        open={isLoadDrawerOpen}
        onClose={handleCloseLoadDrawer}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="load-truck-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Load Truck
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter load details for this truck.
          </div>
          <div className="text-slate-600 text-sm mt-2">
            Remaining:{" "}
            <span className="font-semibold text-slate-900">
              {activeHarvestRemaining !== null ? activeHarvestRemaining.toLocaleString() : "N/A"}
            </span>
          </div>
          <div className="text-slate-600 text-sm mt-1">
            Avg. Weight Truck:{" "}
            <span className="font-semibold text-slate-900">
              {loadDrawerAvgWeight !== null ? `${loadDrawerAvgWeight.toFixed(2)} g/bird` : "N/A"}
            </span>
          </div>
        </div>

        <Form form={loadForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Weight of Truck(Loaded)"
            name="weightLoad"
            rules={[
              { required: true, message: "Please enter weight (loaded)" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
            ]}
          >
            <Input min={0} type="number" inputMode="decimal" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Birds Load"
            name="birdsLoad"
            rules={[
              { required: true, message: "Please enter birds load" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
              {
                validator: (_, value) => {
                  if (activeHarvestRemaining === null) return Promise.resolve();
                  const maxAllowed = activeHarvestRemaining + activeTruckPreviousBirdsLoad;
                  if (Number(value) <= maxAllowed) return Promise.resolve();
                  return Promise.reject(
                    new Error(
                      `Birds load cannot exceed ${maxAllowed.toLocaleString()} (remaining + current truck load).`
                    )
                  );
                },
              },
            ]}
          >
            <Input min={0} type="number" inputMode="numeric" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4 flex gap-2">
            <Button className="!flex-1" onClick={handleCloseLoadDrawer}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleSubmitLoad}
              disabled={!isLoadFormValid || isSavingLoad}
              loading={isSavingLoad}
            >
              Save
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
