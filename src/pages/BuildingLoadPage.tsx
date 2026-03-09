import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Layout, Button, Divider, Grid, Typography } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const BRAND = "#008822";

export default function BuildingLoadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
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
  const [historyEntries, setHistoryEntries] = useState<
    Array<{ date: string; dateTime: string; status: string; total: number }>
  >([]);
  const [totalInput, setTotalInput] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
  const LOAD_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TABLE ?? "Load";
  const LOAD_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE ?? "LoadTransactions";

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
  const isCompleted = history.length >= 2;

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
        .select("created_at, load_id, animal_count")
        .in("load_id", loadIds)
        .order("created_at", { ascending: true });

      if (loadTransactionsError) {
        throw new Error(loadTransactionsError.message || "Failed to load history transactions.");
      }

      const mapped =
        ((loadTransactions ?? []) as Array<{ created_at: string; load_id: number | null; animal_count?: number | null }>).map((row) => {
          const growId = row.load_id != null ? loadGrowMap.get(row.load_id) ?? null : null;
          const status = growId != null ? growStatusMap.get(growId) ?? "" : "";
          return {
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
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistoryByStatus();
  }, [id, selectedDate]);

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

      const { data: loadsBeforeInsert, error: loadsBeforeInsertError } = await supabase
        .from(LOAD_TABLE)
        .select("id")
        .eq("grow_id", grow.id);

      if (loadsBeforeInsertError) {
        throw new Error(loadsBeforeInsertError.message || "Failed to check load records.");
      }

      const loadIdsBeforeInsert = (loadsBeforeInsert ?? []).map((row: { id: number }) => row.id);
      const { data: existingTransactions, error: existingTransactionsError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .select("id")
        .in("load_id", loadIdsBeforeInsert.length > 0 ? loadIdsBeforeInsert : [-1]);

      if (existingTransactionsError) {
        throw new Error(existingTransactionsError.message || "Failed to check existing load transactions.");
      }

      const transactionCountBeforeInsert = (existingTransactions ?? []).length;
      if (transactionCountBeforeInsert >= 2) {
        setToastType("error");
        setToastMessage("Only 2 load transactions are allowed for this grow.");
        setIsToastOpen(true);
        return;
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

      const { data: loadsForGrow, error: loadsForGrowError } = await supabase
        .from(LOAD_TABLE)
        .select("id")
        .eq("grow_id", grow.id);

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

      const summedTotal = (loadTransactions ?? []).reduce(
        (sum: number, row: { animal_count?: number | null }) => sum + (row.animal_count ?? 0),
        0
      );

      const { error: growTotalError } = await supabase
        .from(GROWS_TABLE)
        .update({ total_animals: summedTotal })
        .eq("id", grow.id);

      if (growTotalError) {
        throw new Error(growTotalError.message || "Failed to update grow total_animals.");
      }

      const transactionCountAfterInsert = transactionCountBeforeInsert + 1;
      const nextGrowStatus = transactionCountAfterInsert === 2 ? "Growing" : "Loading";
      const { error: growStatusError } = await supabase
        .from(GROWS_TABLE)
        .update({ status: nextGrowStatus })
        .eq("id", grow.id);

      if (growStatusError) {
        throw new Error(growStatusError.message || "Failed to update grow status.");
      }

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

  const isTotalValid =
    !isCompleted && totalInput.trim() !== "" && Number.isFinite(Number(totalInput)) && Number(totalInput) >= 0;
  const handleSignOut = async () => {
    await signOutAndRedirect(navigate);
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-4 !h-16",
        ].join(" ")}
        style={{ backgroundColor: BRAND }}
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
            Building Load
          </Title>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={["flex-1 flex", isMobile ? "px-3 py-3 pb-10" : "px-4 py-4"].join(" ")}>
        <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1 className="text-md pl-2 font-bold text-[#0f7aa8]">Building # {id ?? ""}</h1>
            </div>
            <div className="text-md pr-2 font-semibold text-slate-500">
              {selectedDateDisplay}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex-1 min-h-0">
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
                  <li key={`${item.dateTime}-${index}`} className="flex items-center gap-3">
                    <span className="w-10 text-slate-500">#{index + 1}</span>
                    <span className="flex-1">{item.dateTime}</span>
                    <span className="font-semibold">{item.total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Total Encoded (All)</span>
              <span className="font-semibold text-slate-900">{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mt-auto">
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
          </div>
        </div>
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
