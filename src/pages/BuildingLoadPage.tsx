import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Layout, Button, Divider, Grid, Typography, Modal } from "antd";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { FiEdit2, FiTrash2, FiX, FiCheck } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { signOutAndRedirect } from "../utils/auth";
import { loadGrowReductionTransactionsByGrowId } from "../controller/growLogsCrud";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const BRAND = "#008822";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";

type UserAccess = {
  role: "Admin" | "Supervisor" | "Staff" | null;
  isActive: boolean;
};

type HistoryEntry = {
  growId: number | null;
  loadId: number | null;
  transactionId: number | null;
  date: string;
  dateTime: string;
  status: string;
  total: number;
};

type TransferEntry = {
  id: number;
  date: string;
  dateTime: string;
  total: number;
  sourceBuildingName: string;
  remarks: string | null;
};

export default function BuildingLoadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const selectedDate = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get("date");
    return dateParam && dayjs(dateParam, "YYYY-MM-DD", true).isValid()
      ? dateParam
      : dayjs().format("YYYY-MM-DD");
  }, [location.search]);
  const selectedDateDisplay = useMemo(
    () => dayjs(selectedDate).format("MMMM D, YYYY"),
    [selectedDate]
  );
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [totalInput, setTotalInput] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [transferEntries, setTransferEntries] = useState<TransferEntry[]>([]);
  const [isTransferLoading, setIsTransferLoading] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editingTotalInput, setEditingTotalInput] = useState("");
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  const [activeGrowId, setActiveGrowId] = useState<number | null>(null);
  const [activeGrowStatus, setActiveGrowStatus] = useState<string>("");
  const [userRole, setUserRole] = useState<UserAccess["role"]>(null);

  const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
  const LOAD_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TABLE ?? "Load";
  const LOAD_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE ?? "LoadTransactions";
  const DOA_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_DOA_TRANSACTIONS_TABLE ?? "DOATransactions";
  const CULLED_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_CULLED_TRANSACTIONS_TABLE ?? "CulledTransactions";
  const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
  const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
  const TRANSFER_TRANSACTIONS_TABLE =
    import.meta.env.VITE_SUPABASE_TRANSFER_TRANSACTIONS_TABLE ?? "TransferTransactions";

  const entriesForSelectedDate = useMemo(
    () => historyEntries.filter((entry) => entry.date === selectedDate),
    [historyEntries, selectedDate]
  );
  const todayTotal = useMemo(() => {
    return entriesForSelectedDate.length > 0 ? entriesForSelectedDate[entriesForSelectedDate.length - 1].total : 0;
  }, [entriesForSelectedDate]);

  const hasTodayRecord = todayTotal > 0;

  const history = useMemo(() => {
    return [...historyEntries];
  }, [historyEntries]);

  const grandTotal = useMemo(() => {
    return historyEntries.reduce((sum, entry) => sum + entry.total, 0);
  }, [historyEntries]);
  const transferGrandTotal = useMemo(() => {
    return transferEntries.reduce((sum, entry) => sum + entry.total, 0);
  }, [transferEntries]);
  const isCompleted = activeGrowStatus.toLowerCase() === "growing";
  const canUndoCompletion = userRole === "Admin" && isCompleted;
  const canEditHistory = userRole === "Admin";

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
      const message =
        error instanceof Error ? error.message : "Unable to load user access. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    }
  };

  const fetchHistoryByStatus = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setHistoryEntries([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const { data: grows, error: growsError } = await supabase
        .from(GROWS_TABLE)
        .select("id, status")
        .eq("building_id", buildingId)
        .in("status", ["Loading", "Growing"])
        .order("created_at", { ascending: true });

      if (growsError) {
        throw new Error(growsError.message || "Failed to load grows for history.");
      }

      const growRows = (grows ?? []) as Array<{ id: number; status?: string | null }>;
      const growIds = growRows.map((row) => row.id);
      const latestGrow = growRows[growRows.length - 1] ?? null;
      setActiveGrowId(latestGrow?.id ?? null);
      setActiveGrowStatus(latestGrow?.status ?? "");
      if (growIds.length === 0) {
        setHistoryEntries([]);
        return;
      }

      const growStatusMap = new Map<number, string>();
      growRows.forEach((row) => {
        growStatusMap.set(row.id, row.status ?? "");
      });

      const { data: loads, error: loadsError } = await supabase
        .from(LOAD_TABLE)
        .select("id, grow_id")
        .in("grow_id", growIds);

      if (loadsError) {
        throw new Error(loadsError.message || "Failed to load related loads for history.");
      }

      const loadRows = (loads ?? []) as Array<{ id: number; grow_id: number | null }>;
      const loadIds = loadRows.map((row) => row.id);
      if (loadIds.length === 0) {
        setHistoryEntries([]);
        return;
      }

      const loadGrowMap = new Map<number, number | null>();
      loadRows.forEach((row) => {
        loadGrowMap.set(row.id, row.grow_id ?? null);
      });

      const { data: loadTransactions, error: loadTransactionsError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .select("id, created_at, load_id, animal_count")
        .in("load_id", loadIds)
        .order("created_at", { ascending: true });

      if (loadTransactionsError) {
        throw new Error(loadTransactionsError.message || "Failed to load history transactions.");
      }

      const mapped =
        ((loadTransactions ?? []) as Array<{ id: number; created_at: string; load_id: number | null; animal_count?: number | null }>).map((row) => {
          const growId = row.load_id != null ? loadGrowMap.get(row.load_id) ?? null : null;
          const status = growId != null ? growStatusMap.get(growId) ?? "" : "";
          return {
            growId,
            loadId: row.load_id ?? null,
            transactionId: row.id ?? null,
            date: dayjs(row.created_at).format("YYYY-MM-DD"),
            dateTime: dayjs(row.created_at).format("MMMM D, YYYY h:mm A"),
            status,
            total: row.animal_count ?? 0,
          };
        }) ?? [];

      setHistoryEntries(mapped);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load history logs. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
      setHistoryEntries([]);
      setActiveGrowId(null);
      setActiveGrowStatus("");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistoryByStatus();
  }, [id, selectedDate]);

  const fetchTransferHistoryByBuilding = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setTransferEntries([]);
      return;
    }

    setIsTransferLoading(true);
    try {
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
      const { data, error } = await supabase
        .from(TRANSFER_TRANSACTIONS_TABLE)
        .select("id, created_at, total_animals_count, remarks, grow_id")
        .eq("building_id", buildingId)
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message || "Failed to load transfer history.");
      }

      const rows = (data ?? []) as Array<{
        id: number;
        created_at: string;
        total_animals_count: number | null;
        remarks: string | null;
        grow_id: number | null;
      }>;

      const sourceGrowIds = rows
        .map((row) => row.grow_id)
        .filter((growId): growId is number => growId != null);

      const sourceBuildingNameByGrowId: Record<number, string> = {};
      if (sourceGrowIds.length > 0) {
        const { data: sourceGrows, error: sourceGrowsError } = await supabase
          .from(GROWS_TABLE)
          .select("id, building_id")
          .in("id", sourceGrowIds);

        if (sourceGrowsError) {
          throw new Error(sourceGrowsError.message || "Failed to load source grow data.");
        }

        const sourceBuildingIds = ((sourceGrows ?? []) as Array<{ id: number; building_id: number | null }>)
          .map((row) => row.building_id)
          .filter((buildingIdValue): buildingIdValue is number => buildingIdValue != null);

        const { data: sourceBuildings, error: sourceBuildingsError } = await supabase
          .from(BUILDINGS_TABLE)
          .select("id, name")
          .in("id", sourceBuildingIds.length > 0 ? sourceBuildingIds : [-1]);

        if (sourceBuildingsError) {
          throw new Error(sourceBuildingsError.message || "Failed to load source building names.");
        }

        const buildingNameById = ((sourceBuildings ?? []) as Array<{ id: number; name: string | null }>)
          .reduce<Record<number, string>>((acc, row) => {
            acc[row.id] = typeof row.name === "string" && row.name.trim().length > 0 ? row.name : `Building #${row.id}`;
            return acc;
          }, {});

        ((sourceGrows ?? []) as Array<{ id: number; building_id: number | null }>).forEach((row) => {
          if (row.building_id == null) return;
          sourceBuildingNameByGrowId[row.id] = buildingNameById[row.building_id] ?? `Building #${row.building_id}`;
        });
      }

      setTransferEntries(
        rows.map((row) => ({
          id: row.id,
          date: dayjs(row.created_at).format("YYYY-MM-DD"),
          dateTime: dayjs(row.created_at).format("MMMM D, YYYY h:mm A"),
          total: Math.max(0, Math.floor(Number(row.total_animals_count ?? 0))),
          sourceBuildingName: row.grow_id != null ? sourceBuildingNameByGrowId[row.grow_id] ?? "Unknown" : "Unknown",
          remarks: typeof row.remarks === "string" ? row.remarks : null,
        }))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load transfer history. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
      setTransferEntries([]);
    } finally {
      setIsTransferLoading(false);
    }
  };

  useEffect(() => {
    void fetchTransferHistoryByBuilding();
  }, [id, selectedDate]);

  useEffect(() => {
    void fetchUserAccess();
  }, [user?.id]);

  const resetEditState = () => {
    setEditingTransactionId(null);
    setEditingTotalInput("");
  };

  const resolveDisplayedCurrentAnimals = async (growId: number, totalAnimals: number) => {
    const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
    const transactions = (await loadGrowReductionTransactionsByGrowId(growId)).filter(
      (row) => dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
    );
    const { data: culledTransactions, error: culledTransactionsError } = await supabase
      .from(CULLED_TRANSACTIONS_TABLE)
      .select("total_animals_count")
      .eq("grow_id", growId)
      .lt("created_at", selectedDayEnd);

    if (culledTransactionsError) {
      throw new Error(culledTransactionsError.message || "Failed to load culled transactions.");
    }

    const latestByDayCageAndType: Record<string, number> = {};

    transactions
      .sort((a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf())
      .forEach((row) => {
        if (row.subbuildingId == null || !row.reductionType) return;
        const dayKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
        const key = `${dayKey}-${row.subbuildingId}-${row.reductionType}`;
        if (latestByDayCageAndType[key] != null) return;
        latestByDayCageAndType[key] = Math.max(0, Math.floor(Number(row.animalCount ?? 0)));
      });

    const reductionTotal = Object.values(latestByDayCageAndType).reduce((sum, value) => sum + value, 0);
    const culledTotal = (culledTransactions ?? []).reduce(
      (sum: number, row: { total_animals_count?: number | null }) => sum + Math.max(0, Math.floor(Number(row.total_animals_count ?? 0))),
      0
    );
    return Math.max(0, Math.floor(totalAnimals) - reductionTotal - culledTotal);
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

    const { error: latestGrowLogUpdateError } = await supabase
      .from(GROW_LOGS_TABLE)
      .update({ actual_total_animals: Math.max(0, Math.floor(totalAnimals)) })
      .eq("grow_id", growId)
      .gte("created_at", latestLogStart.toISOString())
      .lt("created_at", latestLogEnd.toISOString());

    if (latestGrowLogUpdateError) {
      throw new Error(latestGrowLogUpdateError.message || "Failed to sync latest grow log total animals.");
    }
  };

  const createGrowLogSnapshotFromLatestDate = async (growId: number, totalAnimals: number, createdAt: string) => {
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

  const recalculateGrowTotal = async (growId: number) => {
    const { data: loadsForGrow, error: loadsForGrowError } = await supabase
      .from(LOAD_TABLE)
      .select("id")
      .eq("grow_id", growId);

    if (loadsForGrowError) {
      throw new Error(loadsForGrowError.message || "Failed to load related loads for grow.");
    }

    const loadIds = (loadsForGrow ?? []).map((row: { id: number }) => row.id);

    const { data: loadTransactions, error: loadTransactionsError } = await supabase
      .from(LOAD_TRANSACTIONS_TABLE)
      .select("animal_count")
      .in("load_id", loadIds.length > 0 ? loadIds : [-1]);

    if (loadTransactionsError) {
      throw new Error(loadTransactionsError.message || "Failed to compute total animals from load transactions.");
    }

    const loadedAnimalsTotal = (loadTransactions ?? []).reduce(
      (sum: number, row: { animal_count?: number | null }) => sum + (row.animal_count ?? 0),
      0
    );

    const { data: doaTransactions, error: doaTransactionsError } = await supabase
      .from(DOA_TRANSACTIONS_TABLE)
      .select("total_animals_count")
      .eq("grow_id", growId);

    if (doaTransactionsError) {
      throw new Error(doaTransactionsError.message || "Failed to compute total DOA animals.");
    }

    const doaTotal = (doaTransactions ?? []).reduce(
      (sum: number, row: { total_animals_count?: number | null }) => sum + (row.total_animals_count ?? 0),
      0
    );

    const summedTotal = Math.max(0, loadedAnimalsTotal - doaTotal);

    const { error: growTotalError } = await supabase
      .from(GROWS_TABLE)
      .update({ total_animals: summedTotal })
      .eq("id", growId);

    if (growTotalError) {
      throw new Error(growTotalError.message || "Failed to update grow total_animals.");
    }

    return summedTotal;
  };

  const handleSaveOrUpdate = async () => {
    const parsed = Number(totalInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setToastType("error");
      setToastMessage("Invalid building id.");
      setIsToastOpen(true);
      return;
    }

    const total = Math.floor(parsed);
    const actionLabel = hasTodayRecord ? "updated" : "saved";

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: hasTodayRecord ? "Update Building Load" : "Save Building Load",
        content: hasTodayRecord
          ? `Are you sure you want to update this load entry to ${total.toLocaleString()}?`
          : `Are you sure you want to save this load entry with ${total.toLocaleString()} birds?`,
        okText: hasTodayRecord ? "Update" : "Save",
        cancelText: "Cancel",
        okButtonProps: {
          style: { backgroundColor: BRAND, borderColor: BRAND },
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setIsSaving(true);

    try {
      const { data: activeGrow, error: activeGrowError } = await supabase
        .from(GROWS_TABLE)
        .select("id, status")
        .eq("building_id", buildingId)
        .in("status", ["Loading", "Growing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeGrowError) {
        throw new Error(activeGrowError.message || "Failed to check existing transactions.");
      }

      if (typeof activeGrow?.status === "string" && activeGrow.status.toLowerCase() === "growing") {
        setToastType("error");
        setToastMessage("This building load is already completed.");
        setIsToastOpen(true);
        return;
      }

      const growUpsertPayload: Record<string, unknown> = {
        building_id: buildingId,
        status: typeof activeGrow?.status === "string" ? activeGrow.status : "Loading",
        is_harvested: false,
      };
      if (activeGrow?.id != null) {
        growUpsertPayload.id = activeGrow.id;
      }

      const { data: grow, error: growError } = await supabase
        .from(GROWS_TABLE)
        .upsert([growUpsertPayload])
        .select()
        .single();

      if (growError || !grow?.id) {
        throw new Error(growError?.message || "Failed to upsert grow record.");
      }

      const { data: load, error: loadError } = await supabase
        .from(LOAD_TABLE)
        .insert([
          {
            grow_id: grow.id,
            truck_plate_no: null,
            status: "Pending",
          },
        ])
        .select()
        .single();

      if (loadError || !load?.id) {
        throw new Error(loadError?.message || "Failed to insert load record.");
      }

      const { error: txError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .insert([
          {
            load_id: load.id,
            animal_count: total,
          },
        ]);

      if (txError) {
        throw new Error(txError.message || "Failed to insert load transactions.");
      }

      const recalculatedTotal = await recalculateGrowTotal(grow.id);
      const displayedCurrentAnimals = await resolveDisplayedCurrentAnimals(grow.id, recalculatedTotal);
      const snapshotCreatedAt = dayjs(selectedDate)
        .hour(dayjs().hour())
        .minute(dayjs().minute())
        .second(dayjs().second())
        .millisecond(0)
        .toISOString();
      await createGrowLogSnapshotFromLatestDate(grow.id, displayedCurrentAnimals, snapshotCreatedAt);
      await syncLatestGrowLogActualTotal(grow.id, displayedCurrentAnimals);

      await fetchHistoryByStatus();
      setTotalInput("");
      setToastType("success");
      setToastMessage(`Building load ${actionLabel} successfully.`);
      setIsToastOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save building load. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingEntry = (entry: HistoryEntry) => {
    if (!canEditHistory || entry.transactionId == null) return;
    setEditingTransactionId(entry.transactionId);
    setEditingTotalInput(String(entry.total));
  };

  const handleEditSave = async (entry: HistoryEntry) => {
    if (!canEditHistory) {
      setToastType("error");
      setToastMessage("Only Admin can edit history entries.");
      setIsToastOpen(true);
      return;
    }

    if (entry.transactionId == null || entry.growId == null || entry.loadId == null) {
      setToastType("error");
      setToastMessage("This history entry cannot be edited.");
      setIsToastOpen(true);
      return;
    }

    const parsed = Number(editingTotalInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setToastType("error");
      setToastMessage("Please enter a valid total.");
      setIsToastOpen(true);
      return;
    }

    const nextTotal = Math.floor(parsed);
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Save Edited History Entry",
        content: `Are you sure you want to save this change to ${nextTotal.toLocaleString()}?`,
        okText: "Save",
        cancelText: "Cancel",
        okButtonProps: {
          style: { backgroundColor: BRAND, borderColor: BRAND },
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setIsEditingSaving(true);
    try {
      const { error: transactionError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .update({ animal_count: nextTotal })
        .eq("id", entry.transactionId);

      if (transactionError) {
        throw new Error(transactionError.message || "Failed to update load transaction.");
      }

      const { error: loadError } = await supabase
        .from(LOAD_TABLE)
        .update({ status: entry.status || "Pending" })
        .eq("id", entry.loadId);

      if (loadError) {
        throw new Error(loadError.message || "Failed to update load record.");
      }

      const recalculatedTotal = await recalculateGrowTotal(entry.growId);
      const displayedCurrentAnimals = await resolveDisplayedCurrentAnimals(entry.growId, recalculatedTotal);
      const snapshotCreatedAt = dayjs(selectedDate)
        .hour(dayjs().hour())
        .minute(dayjs().minute())
        .second(dayjs().second())
        .millisecond(0)
        .toISOString();
      await createGrowLogSnapshotFromLatestDate(entry.growId, displayedCurrentAnimals, snapshotCreatedAt);
      await syncLatestGrowLogActualTotal(entry.growId, displayedCurrentAnimals);

      const { error: growError } = await supabase
        .from(GROWS_TABLE)
        .update({ status: entry.status || "Loading" })
        .eq("id", entry.growId);

      if (growError) {
        throw new Error(growError.message || "Failed to update grow record.");
      }

      await fetchHistoryByStatus();
      resetEditState();
      setToastType("success");
      setToastMessage("History entry updated successfully.");
      setIsToastOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update history entry. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleDeleteEntry = async (entry: HistoryEntry) => {
    if (!canEditHistory) {
      setToastType("error");
      setToastMessage("Only Admin can delete history entries.");
      setIsToastOpen(true);
      return;
    }

    if (entry.transactionId == null || entry.growId == null || entry.loadId == null) {
      setToastType("error");
      setToastMessage("This history entry cannot be deleted.");
      setIsToastOpen(true);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Delete History Entry",
        content:
          "Are you sure you want to delete or remove this entry? This will recalculate the grow total, and the related load record may also be removed if this is its last transaction.",
        okText: "Delete",
        cancelText: "Cancel",
        okButtonProps: {
          danger: true,
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setIsEditingSaving(true);
    try {
      const { error: deleteTransactionError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .delete()
        .eq("id", entry.transactionId);

      if (deleteTransactionError) {
        throw new Error(deleteTransactionError.message || "Failed to delete load transaction.");
      }

      const { data: remainingTransactions, error: remainingTransactionsError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .select("id")
        .eq("load_id", entry.loadId)
        .limit(1);

      if (remainingTransactionsError) {
        throw new Error(remainingTransactionsError.message || "Failed to check remaining load transactions.");
      }

      if ((remainingTransactions ?? []).length === 0) {
        const { error: deleteLoadError } = await supabase
          .from(LOAD_TABLE)
          .delete()
          .eq("id", entry.loadId);

        if (deleteLoadError) {
          throw new Error(deleteLoadError.message || "Failed to remove empty load record.");
        }
      }

      const recalculatedTotal = await recalculateGrowTotal(entry.growId);
      const displayedCurrentAnimals = await resolveDisplayedCurrentAnimals(entry.growId, recalculatedTotal);
      const snapshotCreatedAt = dayjs(selectedDate)
        .hour(dayjs().hour())
        .minute(dayjs().minute())
        .second(dayjs().second())
        .millisecond(0)
        .toISOString();
      await createGrowLogSnapshotFromLatestDate(entry.growId, displayedCurrentAnimals, snapshotCreatedAt);
      await syncLatestGrowLogActualTotal(entry.growId, displayedCurrentAnimals);

      const { error: growError } = await supabase
        .from(GROWS_TABLE)
        .update({ status: entry.status || "Loading" })
        .eq("id", entry.growId);

      if (growError) {
        throw new Error(growError.message || "Failed to update grow record.");
      }

      await fetchHistoryByStatus();
      resetEditState();
      setToastType("success");
      setToastMessage("History entry deleted successfully.");
      setIsToastOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete history entry. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsEditingSaving(false);
    }
  };

  const isTotalValid =
    !isCompleted && totalInput.trim() !== "" && Number.isFinite(Number(totalInput)) && Number(totalInput) >= 0;
  const handleComplete = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setToastType("error");
      setToastMessage("Invalid building id.");
      setIsToastOpen(true);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Complete Building Load",
        content: "Are you sure you want to complete?",
        okText: "Complete",
        cancelText: "Cancel",
        okButtonProps: {
          style: { backgroundColor: BRAND, borderColor: BRAND },
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setIsCompleting(true);
    try {
      let growId = activeGrowId;
      let growStatus = activeGrowStatus;

      if (growId == null) {
        const { data: activeGrow, error: activeGrowError } = await supabase
          .from(GROWS_TABLE)
          .select("id, status")
          .eq("building_id", buildingId)
          .in("status", ["Loading", "Growing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeGrowError) {
          throw new Error(activeGrowError.message || "Failed to load active grow.");
        }

        growId = activeGrow?.id ?? null;
        growStatus = activeGrow?.status ?? "";
      }

      if (growId == null) {
        setToastType("error");
        setToastMessage("No active load session found to complete.");
        setIsToastOpen(true);
        return;
      }

      if (typeof growStatus === "string" && growStatus.toLowerCase() === "growing") {
        setToastType("success");
        setToastMessage("This building load is already completed.");
        setIsToastOpen(true);
        return;
      }

      const { error: growStatusError } = await supabase
        .from(GROWS_TABLE)
        .update({ status: "Growing" })
        .eq("id", growId);

      if (growStatusError) {
        throw new Error(growStatusError.message || "Failed to complete building load.");
      }

      await fetchHistoryByStatus();
      setToastType("success");
      setToastMessage("Building load completed successfully.");
      setIsToastOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to complete building load. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleUndoCompletion = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setToastType("error");
      setToastMessage("Invalid building id.");
      setIsToastOpen(true);
      return;
    }

    if (userRole !== "Admin") {
      setToastType("error");
      setToastMessage("Only Admin can undo the completion.");
      setIsToastOpen(true);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: "Undo Building Load Completion",
        content: "Are you sure you want to undo the completion?",
        okText: "Undo Completion",
        cancelText: "Cancel",
        okButtonProps: {
          style: { backgroundColor: BRAND, borderColor: BRAND },
        },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    setIsCompleting(true);
    try {
      let growId = activeGrowId;
      let growStatus = activeGrowStatus;

      if (growId == null) {
        const { data: activeGrow, error: activeGrowError } = await supabase
          .from(GROWS_TABLE)
          .select("id, status")
          .eq("building_id", buildingId)
          .in("status", ["Loading", "Growing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeGrowError) {
          throw new Error(activeGrowError.message || "Failed to load active grow.");
        }

        growId = activeGrow?.id ?? null;
        growStatus = activeGrow?.status ?? "";
      }

      if (growId == null) {
        setToastType("error");
        setToastMessage("No completed load session found to undo.");
        setIsToastOpen(true);
        return;
      }

      if (typeof growStatus !== "string" || growStatus.toLowerCase() !== "growing") {
        setToastType("error");
        setToastMessage("Only completed building loads can be undone.");
        setIsToastOpen(true);
        return;
      }

      const { error: growStatusError } = await supabase
        .from(GROWS_TABLE)
        .update({ status: "Loading" })
        .eq("id", growId);

      if (growStatusError) {
        throw new Error(growStatusError.message || "Failed to undo building load completion.");
      }

      await fetchHistoryByStatus();
      setToastType("success");
      setToastMessage("Building load completion has been undone.");
      setIsToastOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to undo building load completion. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAndRedirect(navigate);
  };

  const renderHistoryRow = (item: HistoryEntry, index: number, compact = false) => {
    const isEditing = editingTransactionId != null && editingTransactionId === item.transactionId;
    const isEditingValueValid =
      editingTotalInput.trim() !== "" &&
      Number.isFinite(Number(editingTotalInput)) &&
      Number(editingTotalInput) >= 0;

    if (compact) {
      return (
        <li key={`${item.transactionId ?? item.dateTime}-${index}`} className="rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="w-10 text-slate-500">#{index + 1}</span>
            <span className="flex-1">{item.dateTime}</span>
            {isEditing ? (
              <input
                className="w-24 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-right text-[16px] outline-none focus:ring-2 focus:ring-[#008822]/30"
                value={editingTotalInput}
                onChange={(e) => setEditingTotalInput(e.target.value)}
                inputMode="numeric"
              />
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
                {item.total.toLocaleString()}
              </span>
            )}
          </div>
          {canEditHistory && (
            <div className="mt-1.5 flex justify-end">
              {isEditing ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-1.5 py-1 shadow-sm">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={resetEditState}
                    disabled={isEditingSaving}
                    aria-label="Cancel editing"
                  >
                    <FiX size={13} />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#008822] px-2.5 text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleEditSave(item)}
                    disabled={!isEditingValueValid || isEditingSaving}
                    aria-label="Save entry"
                  >
                    {isEditingSaving ? (
                      <span className="text-[11px] font-semibold">...</span>
                    ) : (
                      <>
                        <FiCheck size={12} />
                        <span className="ml-1 text-[10px] font-semibold">Save</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-full bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700"
                    onClick={() => startEditingEntry(item)}
                  >
                    <FiEdit2 size={11} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-full bg-red-50 px-2 text-[10px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleDeleteEntry(item)}
                    disabled={isEditingSaving}
                  >
                    <FiTrash2 size={11} />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </li>
      );
    }

    return (
      <li
        key={`${item.transactionId ?? item.dateTime}-${index}`}
        className="rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2.5"
      >
        <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
          <span className="text-sm text-slate-700">{item.dateTime}</span>
          {isEditing ? (
            <input
              className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-[#008822]/30"
              value={editingTotalInput}
              onChange={(e) => setEditingTotalInput(e.target.value)}
              inputMode="numeric"
            />
          ) : (
            <span className="text-sm font-semibold text-slate-900">{item.total.toLocaleString()}</span>
          )}
        </div>
        {canEditHistory && (
          <div className="mt-2 flex justify-end">
            {isEditing ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-2 py-1 shadow-sm">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={resetEditState}
                  disabled={isEditingSaving}
                  aria-label="Cancel editing"
                >
                  <FiX size={14} />
                </button>
                <button
                  type="button"
                  className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#008822] px-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleEditSave(item)}
                  disabled={!isEditingValueValid || isEditingSaving}
                  aria-label="Save entry"
                >
                  {isEditingSaving ? (
                    <span className="text-[11px] font-semibold">...</span>
                  ) : (
                    <>
                      <FiCheck size={13} />
                      <span className="ml-1 text-[11px] font-semibold">Save</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700"
                  onClick={() => startEditingEntry(item)}
                >
                  <FiEdit2 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-full bg-red-50 px-3 text-[11px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleDeleteEntry(item)}
                  disabled={isEditingSaving}
                >
                  <FiTrash2 size={12} />
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
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
          backgroundColor: BRAND,
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
          {isMobile ? (
            <>
              <Divider
                type="vertical"
                className="!m-0 !h-5 !border-white/60"
              />
              <Title level={4} className="!m-0 !text-base !text-white">
                Building Load
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Inventory</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Building Load Entry
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

      <Content className={["flex-1", isMobile ? "px-3 py-3 pb-10" : "px-8 py-6"].join(" ")}>
        {isMobile ? (
          <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h1 className="text-md pl-2 font-bold text-[#0f7aa8]">Building # {id ?? ""}</h1>
              </div>
              <div className="text-md pr-2 font-semibold text-slate-500">
                {selectedDateDisplay}
              </div>
            </div>

            <div className="bg-white rounded-sm shadow-sm p-4 mb-4 flex-1 min-h-0">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                History
              </div>
              {isHistoryLoading ? (
                <div className="text-sm text-slate-500">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="text-sm text-slate-500">No history yet.</div>
              ) : (
                <ul className="text-sm text-slate-700 space-y-1">
                  {history.map((item, index) => (
                    renderHistoryRow(item, index, true)
                  ))}
                </ul>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Encoded (All)</span>
                <span className="font-semibold text-slate-900">{grandTotal.toLocaleString()}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500 mb-2">Transfer History (To This Building)</div>
                {isTransferLoading ? (
                  <div className="text-sm text-slate-500">Loading transfers...</div>
                ) : transferEntries.length === 0 ? (
                  <div className="text-sm text-slate-500">No transfer history yet.</div>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {transferEntries.map((item, index) => (
                      <li key={`transfer-${item.id}-${index}`} className="rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">#{index + 1}</span>
                          <span className="flex-1">{item.dateTime}</span>
                          <span className="font-semibold text-slate-900">{item.total.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">From: {item.sourceBuildingName}</div>
                        {item.remarks ? <div className="mt-0.5 text-[11px] text-slate-500">{item.remarks}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total Transferred In</span>
                  <span className="font-semibold text-slate-900">{transferGrandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-sm shadow-sm p-4 mt-auto">
              {!isCompleted && (
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[#008822]/30"
                  placeholder="Enter total count"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  inputMode="numeric"
                />
              )}
              <button
                type="button"
                className="text-base mt-3 w-full rounded-lg h-11 bg-[#008822] text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleSaveOrUpdate}
                disabled={!isTotalValid || isSaving}
              >
                {isCompleted ? "Completed" : isSaving ? "Saving..." : hasTodayRecord ? "Update" : "Save"}
              </button>
              {!isCompleted && history.length > 0 && (
                <button
                  type="button"
                  className="text-base mt-3 w-full rounded-lg h-11 border border-[#008822] text-[#008822] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleComplete}
                  disabled={isSaving || isCompleting}
                >
                  {isCompleting ? "Completing..." : "Complete"}
                </button>
              )}
              {canUndoCompletion && (
                <button
                  type="button"
                  className="text-base mt-3 w-full rounded-lg h-11 border border-[#d97706] text-[#d97706] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleUndoCompletion}
                  disabled={isSaving || isCompleting}
                >
                  {isCompleting ? "Undoing..." : "Undo the completion"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-5 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-6 py-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Load Session
              </div>
              <div className="mt-1 flex items-end justify-between gap-6">
                <div>
                  <div className="text-2xl font-bold text-slate-900">Building #{id ?? ""}</div>
                  <div className="mt-1 text-sm text-slate-600">Selected date: {selectedDateDisplay}</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-sm border border-emerald-100 bg-white/90 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">History Rows</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{history.length}</div>
                  </div>
                  <div className="rounded-sm border border-emerald-100 bg-white/90 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Session Status</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{isCompleted ? "Completed" : "Open"}</div>
                  </div>
                  <div className="rounded-sm border border-emerald-100 bg-white/90 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Grand Total</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{grandTotal.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-5 flex flex-col gap-4">
                <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Entry Panel</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Encode Load Count</div>
                  <div className="mt-4 text-sm text-slate-500">
                    Save load entries as needed, then mark the session complete when you are done.
                  </div>
                  <div className="mt-4 rounded-sm bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">Today Total</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{todayTotal.toLocaleString()}</div>
                  </div>
                  {!isCompleted && (
                    <input
                      className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#008822]/30"
                      placeholder="Enter total count"
                      value={totalInput}
                      onChange={(e) => setTotalInput(e.target.value)}
                      inputMode="numeric"
                    />
                  )}
                  <button
                    type="button"
                    className="mt-4 h-11 w-full rounded-lg bg-[#008822] text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSaveOrUpdate}
                    disabled={!isTotalValid || isSaving}
                  >
                    {isCompleted ? "Completed" : isSaving ? "Saving..." : hasTodayRecord ? "Update" : "Save"}
                  </button>
                  {!isCompleted && history.length > 0 && (
                    <button
                      type="button"
                      className="mt-3 h-11 w-full rounded-lg border border-[#008822] bg-white text-base font-semibold text-[#008822] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleComplete}
                      disabled={isSaving || isCompleting}
                    >
                      {isCompleting ? "Completing..." : "Complete"}
                    </button>
                  )}
                  {canUndoCompletion && (
                    <button
                      type="button"
                      className="mt-3 h-11 w-full rounded-lg border border-[#d97706] bg-white text-base font-semibold text-[#d97706] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleUndoCompletion}
                      disabled={isSaving || isCompleting}
                    >
                      {isCompleting ? "Undoing..." : "Undo the completion"}
                    </button>
                  )}
                </div>
              </div>

              <div className="col-span-7">
                <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm h-full">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-900">History</div>
                    <div className="text-xs font-medium text-slate-500">{selectedDateDisplay}</div>
                  </div>
                  <div className="mt-4">
                    {isHistoryLoading ? (
                      <div className="text-sm text-slate-500">Loading history...</div>
                    ) : history.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No history yet.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {history.map((item, index) => (
                          renderHistoryRow(item, index)
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total Encoded (All)</span>
                    <span className="font-semibold text-slate-900">{grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900">Transfer History (To This Building)</div>
                    <div className="mt-3">
                      {isTransferLoading ? (
                        <div className="text-sm text-slate-500">Loading transfers...</div>
                      ) : transferEntries.length === 0 ? (
                        <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          No transfer history yet.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {transferEntries.map((item, index) => (
                            <li key={`transfer-desktop-${item.id}-${index}`} className="rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                              <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
                                <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                                <span className="text-sm text-slate-700">{item.dateTime}</span>
                                <span className="text-sm font-semibold text-slate-900">{item.total.toLocaleString()}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">From: {item.sourceBuildingName}</div>
                              {item.remarks ? <div className="mt-0.5 text-[11px] text-slate-500">{item.remarks}</div> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Total Transferred In</span>
                      <span className="font-semibold text-slate-900">{transferGrandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Content>
      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
