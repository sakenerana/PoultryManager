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
    Array<{ date: string; dateTime: string; total: number }>
  >([]);
  const [totalInput, setTotalInput] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [latestGrowStatus, setLatestGrowStatus] = useState<string>("");
  const [latestGrowIsHarvested, setLatestGrowIsHarvested] = useState(false);

  const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
  const LOAD_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TABLE ?? "Load";
  const LOAD_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE ?? "LoadTransactions";

  const todayTotal = useMemo(() => {
    const entriesToday = historyEntries.filter((entry) => entry.date === selectedDate);
    return entriesToday.length > 0 ? entriesToday[entriesToday.length - 1].total : 0;
  }, [historyEntries, selectedDate]);

  const hasTodayRecord = todayTotal > 0;

  const history = useMemo(() => {
    return [...historyEntries].reverse();
  }, [historyEntries]);

  const grandTotal = useMemo(() => {
    return historyEntries.reduce((sum, entry) => sum + entry.total, 0);
  }, [historyEntries]);
  const isReadyStatus = latestGrowStatus === "Ready";
  const isCompleted = historyEntries.length >= 2 && !isReadyStatus && !latestGrowIsHarvested;

  const fetchHistoryByDate = async () => {
    const buildingId = Number(id);
    if (!Number.isFinite(buildingId)) {
      setHistoryEntries([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const startOfDay = dayjs(selectedDate).startOf("day").toISOString();
      const endOfDay = dayjs(selectedDate).add(1, "day").startOf("day").toISOString();

      const { data, error } = await supabase
        .from(GROWS_TABLE)
        .select("id, created_at, total_animals, status")
        .eq("building_id", buildingId)
        .in("status", ["Loading", "Growing"])
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message || "Failed to load history logs.");
      }

      const mapped =
        (data ?? []).map((row: { created_at: string; total_animals: number | null }) => ({
          date: dayjs(row.created_at).format("YYYY-MM-DD"),
          dateTime: dayjs(row.created_at).format("MMMM D, YYYY h:mm A"),
          total: row.total_animals ?? 0,
        })) ?? [];

      setHistoryEntries(mapped);
      const latestRow = data && data.length > 0 ? data[data.length - 1] : null;
      setLatestGrowStatus(typeof latestRow?.status === "string" ? latestRow.status : "");

      const { data: latestAnyGrow, error: latestAnyGrowError } = await supabase
        .from(GROWS_TABLE)
        .select("status, is_harvested, created_at")
        .eq("building_id", buildingId)
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAnyGrowError) {
        throw new Error(latestAnyGrowError.message || "Failed to check harvested status.");
      }

      const isHarvested =
        latestAnyGrow?.is_harvested === true ||
        (typeof latestAnyGrow?.status === "string" &&
          latestAnyGrow.status.toLowerCase() === "harvested");
      setLatestGrowIsHarvested(isHarvested);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load history logs. Please try again.";
      setToastType("error");
      setToastMessage(message);
      setIsToastOpen(true);
      setHistoryEntries([]);
      setLatestGrowStatus("");
      setLatestGrowIsHarvested(false);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistoryByDate();
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
      const startOfDay = dayjs(selectedDate).startOf("day").toISOString();
      const endOfDay = dayjs(selectedDate).add(1, "day").startOf("day").toISOString();
      const { data: existingGrows, error: existingGrowsError } = await supabase
        .from(GROWS_TABLE)
        .select("id, created_at, status, is_harvested")
        .eq("building_id", buildingId)
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay)
        .order("created_at", { ascending: true });

      if (existingGrowsError) {
        throw new Error(existingGrowsError.message || "Failed to check existing transactions.");
      }

      const hasHarvestedStatus =
        (existingGrows ?? []).some(
          (row: { status?: string | null; is_harvested?: boolean | null }) =>
            row.is_harvested === true ||
            (typeof row.status === "string" && row.status.toLowerCase() === "harvested")
        );

      if ((existingGrows?.length ?? 0) >= 2 && !hasHarvestedStatus) {
        setToastType("error");
        setToastMessage("Only 2 transactions are allowed for this building and date.");
        setIsToastOpen(true);
        return;
      }

      const { data: grow, error: growError } = await supabase
        .from(GROWS_TABLE)
        .insert([
          {
            building_id: buildingId,
            total_animals: total,
            status: "Loading",
            is_harvested: false,
          },
        ])
        .select()
        .single();

      if (growError || !grow?.id) {
        throw new Error(growError?.message || "Failed to insert grow record.");
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

      const loadTransactionsPayload = [
        {
          load_id: load.id,
          animal_count: total,
        },
      ];

      const { error: txError } = await supabase
        .from(LOAD_TRANSACTIONS_TABLE)
        .insert(loadTransactionsPayload);

      if (txError) {
        throw new Error(txError.message || "Failed to insert load transactions.");
      }

      const { data: growsAfterSave, error: growsAfterSaveError } = await supabase
        .from(GROWS_TABLE)
        .select("id, created_at, status")
        .eq("building_id", buildingId)
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay)
        .order("created_at", { ascending: true });

      if (growsAfterSaveError) {
        throw new Error(growsAfterSaveError.message || "Failed to reload transactions.");
      }

      const loadingRows =
        (growsAfterSave ?? []).filter(
          (row: { id: number; status?: string | null }) => row.status === "Loading"
        ) ?? [];

      if (loadingRows.length === 1 && loadingRows[0]?.id != null) {
        const { error: growStatusError } = await supabase
          .from(GROWS_TABLE)
          .update({ status: "Loading" })
          .eq("id", loadingRows[0].id);
        if (growStatusError) {
          throw new Error(growStatusError.message || "Failed to update first transaction status.");
        }
      } else if (loadingRows.length >= 2) {
        const idsToUpdate = loadingRows.map((row: { id: number }) => row.id);
        const { error: growStatusError } = await supabase
          .from(GROWS_TABLE)
          .update({ status: "Growing" })
          .in("id", idsToUpdate);

        if (growStatusError) {
          throw new Error(growStatusError.message || "Failed to update transaction statuses.");
        }
      }

      await fetchHistoryByDate();
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
                    <span className="w-10 text-slate-500">#{history.length - index}</span>
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
