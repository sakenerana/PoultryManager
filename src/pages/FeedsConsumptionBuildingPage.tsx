import { Button, DatePicker, Divider, Form, Grid, Input, InputNumber, Layout, Modal, Popconfirm, Segmented, Select, Typography } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { FiTrash2 } from "react-icons/fi";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const FEEDS_TABLE = import.meta.env.VITE_SUPABASE_FEEDS_CONSUMPTION_TABLE ?? "FeedsConsumption";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type FeedSetupRow = {
  key: string;
  id: number;
  name: string;
  latestGrowId: number | null;
  createdAt: string;
  totalBirds: number;
  feedRecords: number;
  totalKg: number;
  totalBags: number;
  status: string;
  isHarvested: boolean;
};

type GrowRecord = {
  id: number;
  buildingId: number;
  createdAt: string;
  totalBirds: number;
  status: string;
  isHarvested: boolean;
};

type FeedEntryRecord = {
  id: number;
  buildingId: number;
  growId: number;
  ageDay: number | null;
  recordDate: string;
  feedCode: string | null;
  feedStandard: number | null;
  feedQuantityBags: number | null;
  feedQuantityKg: number | null;
  cumulativeFeedKg: number | null;
  mortalityDead: number | null;
  mortalityCulling: number | null;
  remainingBirds: number | null;
  remarks: string | null;
};

type FeedDayRow = {
  ageDay: number;
  recordDate: string;
  weekNumber: number;
  entry: FeedEntryRecord | null;
};

type FeedStatusFilter = "all" | "recorded" | "pending";

type FeedEntryFormValues = {
  growId: number;
  ageDay: number;
  recordDate: Dayjs;
  feedCode?: string;
  feedStandard?: number;
  feedQuantityBags?: number;
  feedQuantityKg?: number;
  cumulativeFeedKg?: number;
  mortalityDead?: number;
  mortalityCulling?: number;
  remainingBirds?: number;
  remarks?: string;
};

const formatDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM DD, YYYY") : "-";
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

export default function FeedsConsumptionBuildingPage() {
  const navigate = useNavigate();
  const { buildingId } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [rows, setRows] = useState<FeedSetupRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(() => {
    const parsed = Number(buildingId);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [allGrows, setAllGrows] = useState<GrowRecord[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntryRecord[]>([]);
  const [activeFeedDay, setActiveFeedDay] = useState<FeedDayRow | null>(null);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isSavingFeedEntry, setIsSavingFeedEntry] = useState(false);
  const [deletingFeedEntryId, setDeletingFeedEntryId] = useState<number | null>(null);
  const [feedStatusFilter, setFeedStatusFilter] = useState<FeedStatusFilter>("all");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [feedForm] = Form.useForm<FeedEntryFormValues>();

  const selectedSetupRow = useMemo(
    () => rows.find((row) => row.id === selectedBuildingId) ?? null,
    [rows, selectedBuildingId]
  );

  const selectedBuildingGrows = useMemo(
    () =>
      allGrows
        .filter((grow) => grow.buildingId === selectedSetupRow?.id)
        .sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix()),
    [allGrows, selectedSetupRow?.id]
  );

  const growOptions = useMemo(
    () =>
      selectedBuildingGrows.map((grow) => ({
        value: grow.id,
        label: `Grow #${grow.id} | ${grow.status} | ${grow.totalBirds.toLocaleString()} birds`,
      })),
    [selectedBuildingGrows]
  );

  const selectedGrowForDays = useMemo(
    () => selectedBuildingGrows.find((grow) => grow.id === selectedSetupRow?.latestGrowId) ?? selectedBuildingGrows[0] ?? null,
    [selectedBuildingGrows, selectedSetupRow?.latestGrowId]
  );

  const selectedGrowFeedEntries = useMemo(
    () => feedEntries.filter((entry) => entry.growId === selectedGrowForDays?.id),
    [feedEntries, selectedGrowForDays?.id]
  );

  const feedEntryByDay = useMemo(() => {
    const byDay = new Map<number, FeedEntryRecord>();
    selectedGrowFeedEntries.forEach((entry) => {
      if (entry.ageDay != null) byDay.set(entry.ageDay, entry);
    });
    return byDay;
  }, [selectedGrowFeedEntries]);

  const feedDayRows = useMemo<FeedDayRow[]>(() => {
    if (!selectedGrowForDays?.createdAt || !dayjs(selectedGrowForDays.createdAt).isValid()) return [];
    const startDate = dayjs(selectedGrowForDays.createdAt).startOf("day");
    const today = dayjs().startOf("day");
    const daysListed = Math.max(1, today.diff(startDate, "day") + 1);
    return Array.from({ length: daysListed }, (_, index) => {
      const ageDay = index + 1;
      return {
        ageDay,
        recordDate: startDate.add(index, "day").format("YYYY-MM-DD"),
        weekNumber: Math.ceil(ageDay / 7),
        entry: feedEntryByDay.get(ageDay) ?? null,
      };
    });
  }, [feedEntryByDay, selectedGrowForDays?.createdAt]);

  const filteredFeedDayRows = useMemo(() => {
    if (feedStatusFilter === "recorded") return feedDayRows.filter((row) => row.entry != null);
    if (feedStatusFilter === "pending") return feedDayRows.filter((row) => row.entry == null);
    return feedDayRows;
  }, [feedDayRows, feedStatusFilter]);

  const feedDayGroups = useMemo(() => {
    const groups = new Map<number, FeedDayRow[]>();
    filteredFeedDayRows.forEach((row) => {
      const current = groups.get(row.weekNumber) ?? [];
      current.push(row);
      groups.set(row.weekNumber, current);
    });
    return Array.from(groups.entries()).map(([weekNumber, days]) => {
      const firstDay = days[0]?.ageDay ?? (weekNumber - 1) * 7 + 1;
      const lastDay = days[days.length - 1]?.ageDay ?? weekNumber * 7;
      return {
        weekNumber,
        days,
        firstDay,
        lastDay,
        recordedDays: days.filter((row) => row.entry != null).length,
        totalBags: days.reduce((sum, row) => sum + toNumber(row.entry?.feedQuantityBags), 0),
        totalKg: days.reduce((sum, row) => sum + toNumber(row.entry?.feedQuantityKg), 0),
        totalDead: days.reduce((sum, row) => sum + toNumber(row.entry?.mortalityDead), 0),
        totalCulling: days.reduce((sum, row) => sum + toNumber(row.entry?.mortalityCulling), 0),
      };
    });
  }, [filteredFeedDayRows]);

  const recordedFeedDays = useMemo(
    () => feedDayRows.filter((row) => row.entry != null).length,
    [feedDayRows]
  );
  const pendingFeedDays = feedDayRows.length - recordedFeedDays;

  const loadRows = useCallback(async (active = true) => {
    try {
      setIsLoading(true);
      const [
        { data: buildingRows, error: buildingError },
        { data: growRows, error: growError },
        { data: feedRows, error: feedError },
      ] = await Promise.all([
        supabase.from(BUILDINGS_TABLE).select("id, name"),
        supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, total_animals, status, is_harvested")
          .order("created_at", { ascending: false }),
        supabase
          .from(FEEDS_TABLE)
          .select("id, building_id, grow_id, age_day, record_date, feed_code, feed_standard, feed_quantity_bags, feed_quantity_kg, cumulative_feed_kg, mortality_dead, mortality_culling, remaining_birds, remarks"),
      ]);

      if (!active) return;
      if (buildingError) throw buildingError;
      if (growError) throw growError;
      if (feedError) throw feedError;

      const buildings = ((buildingRows ?? []) as Array<{ id: number | null; name: string | null }>)
        .filter((building): building is { id: number; name: string | null } => building.id != null)
        .sort((a, b) => {
          const aName = a.name ?? `Building ${a.id}`;
          const bName = b.name ?? `Building ${b.id}`;
          return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
        });

      const nextGrows = ((growRows ?? []) as Array<{
        id: number | null;
        building_id: number | null;
        created_at: string | null;
        total_animals: number | null;
        status: string | null;
        is_harvested: boolean | null;
      }>)
        .filter((row): row is {
          id: number;
          building_id: number;
          created_at: string | null;
          total_animals: number | null;
          status: string | null;
          is_harvested: boolean | null;
        } => row.id != null && row.building_id != null)
        .map((row) => ({
          id: row.id,
          buildingId: row.building_id,
          createdAt: row.created_at ?? "",
          totalBirds: Math.max(0, Math.floor(toNumber(row.total_animals))),
          status: row.status ?? "Ready",
          isHarvested: row.is_harvested === true,
        }));

      const latestGrowByBuildingId = new Map<number, GrowRecord>();
      nextGrows.forEach((grow) => {
        if (latestGrowByBuildingId.has(grow.buildingId)) return;
        latestGrowByBuildingId.set(grow.buildingId, grow);
      });

      const nextFeedEntries = ((feedRows ?? []) as Array<{
        id: number | null;
        building_id: number | null;
        grow_id: number | null;
        age_day: number | null;
        record_date: string | null;
        feed_code: string | null;
        feed_standard: number | null;
        feed_quantity_bags: number | null;
        feed_quantity_kg: number | null;
        cumulative_feed_kg: number | null;
        mortality_dead: number | null;
        mortality_culling: number | null;
        remaining_birds: number | null;
        remarks: string | null;
      }>)
        .filter((row): row is {
          id: number;
          building_id: number;
          grow_id: number;
          age_day: number | null;
          record_date: string | null;
          feed_code: string | null;
          feed_standard: number | null;
          feed_quantity_bags: number | null;
          feed_quantity_kg: number | null;
          cumulative_feed_kg: number | null;
          mortality_dead: number | null;
          mortality_culling: number | null;
          remaining_birds: number | null;
          remarks: string | null;
        } => row.id != null && row.building_id != null && row.grow_id != null)
        .map((row) => ({
          id: row.id,
          buildingId: row.building_id,
          growId: row.grow_id,
          ageDay: row.age_day,
          recordDate: row.record_date ?? "",
          feedCode: row.feed_code,
          feedStandard: row.feed_standard,
          feedQuantityBags: row.feed_quantity_bags,
          feedQuantityKg: row.feed_quantity_kg,
          cumulativeFeedKg: row.cumulative_feed_kg,
          mortalityDead: row.mortality_dead,
          mortalityCulling: row.mortality_culling,
          remainingBirds: row.remaining_birds,
          remarks: row.remarks,
        }));

      const feedTotalsByBuildingId = new Map<number, { records: number; bags: number; kg: number }>();
      nextFeedEntries.forEach((row) => {
        const current = feedTotalsByBuildingId.get(row.buildingId) ?? { records: 0, bags: 0, kg: 0 };
        current.records += 1;
        current.bags += toNumber(row.feedQuantityBags);
        current.kg += toNumber(row.feedQuantityKg);
        feedTotalsByBuildingId.set(row.buildingId, current);
      });

      const mapped = buildings.map<FeedSetupRow>((building) => {
        const latestGrow = latestGrowByBuildingId.get(building.id);
        const feedTotals = feedTotalsByBuildingId.get(building.id) ?? { records: 0, bags: 0, kg: 0 };
        const name = building.name ?? `Building ${building.id}`;
        return {
          key: String(building.id),
          id: building.id,
          name,
          latestGrowId: latestGrow?.id ?? null,
          createdAt: latestGrow?.createdAt ?? "",
          totalBirds: latestGrow?.totalBirds ?? 0,
          feedRecords: feedTotals.records,
          totalKg: feedTotals.kg,
          totalBags: feedTotals.bags,
          status: latestGrow?.status ?? "Ready",
          isHarvested: latestGrow?.isHarvested ?? false,
        };
      });

      setRows(mapped);
      setAllGrows(nextGrows);
      setFeedEntries(nextFeedEntries);
      setSelectedBuildingId((current) => (current != null && mapped.some((row) => row.id === current) ? current : null));
    } catch (error) {
      console.error("Failed to load feed setup:", error);
      setRows([]);
      setAllGrows([]);
      setFeedEntries([]);
      setSelectedBuildingId(null);
    } finally {
      if (active) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void loadRows(active);
    return () => {
      active = false;
    };
  }, [loadRows]);

  useEffect(() => {
    const parsed = Number(buildingId);
    setSelectedBuildingId(Number.isFinite(parsed) ? parsed : null);
  }, [buildingId]);

  const handleOpenFeedModal = (dayRow: FeedDayRow) => {
    if (!selectedSetupRow) {
      setToastMessage("Select a building before adding feed entry.");
      setIsToastOpen(true);
      return;
    }
    if (!selectedGrowForDays) {
      setToastMessage("This building has no grow batch yet.");
      setIsToastOpen(true);
      return;
    }

    const existingEntry = dayRow.entry;
    const previousEntry = selectedGrowFeedEntries
      .filter((entry) => entry.ageDay != null && entry.ageDay < dayRow.ageDay)
      .sort((a, b) => (b.ageDay ?? 0) - (a.ageDay ?? 0))[0];
    const feedQuantityKg = existingEntry?.feedQuantityKg ?? 0;
    const mortalityDead = existingEntry?.mortalityDead ?? 0;
    const mortalityCulling = existingEntry?.mortalityCulling ?? 0;
    const previousCumulativeFeedKg = toNumber(previousEntry?.cumulativeFeedKg);
    const previousRemainingBirds = previousEntry?.remainingBirds ?? selectedGrowForDays.totalBirds;

    feedForm.setFieldsValue({
      growId: selectedGrowForDays.id,
      ageDay: dayRow.ageDay,
      recordDate: dayjs(existingEntry?.recordDate || dayRow.recordDate),
      feedCode: existingEntry?.feedCode ?? "",
      feedStandard: existingEntry?.feedStandard ?? 0,
      feedQuantityBags: existingEntry?.feedQuantityBags ?? 0,
      feedQuantityKg,
      cumulativeFeedKg: existingEntry?.cumulativeFeedKg ?? previousCumulativeFeedKg + feedQuantityKg,
      mortalityDead,
      mortalityCulling,
      remainingBirds: existingEntry?.remainingBirds ?? Math.max(0, previousRemainingBirds - mortalityDead - mortalityCulling),
      remarks: existingEntry?.remarks ?? "",
    });
    setActiveFeedDay(dayRow);
    setIsFeedModalOpen(true);
  };

  const handleFeedFormChange = (changedValues: Partial<FeedEntryFormValues>) => {
    if (!activeFeedDay || !selectedGrowForDays) return;
    const shouldRecalculateCumulative = "feedQuantityKg" in changedValues;
    const shouldRecalculateRemaining = "mortalityDead" in changedValues || "mortalityCulling" in changedValues;
    if (!shouldRecalculateCumulative && !shouldRecalculateRemaining) return;

    const previousEntry = selectedGrowFeedEntries
      .filter((entry) => entry.ageDay != null && entry.ageDay < activeFeedDay.ageDay)
      .sort((a, b) => (b.ageDay ?? 0) - (a.ageDay ?? 0))[0];
    const values = feedForm.getFieldsValue();
    const updates: Partial<FeedEntryFormValues> = {};

    if (shouldRecalculateCumulative) {
      updates.cumulativeFeedKg = toNumber(previousEntry?.cumulativeFeedKg) + toNumber(values.feedQuantityKg);
    }
    if (shouldRecalculateRemaining) {
      const previousRemainingBirds = previousEntry?.remainingBirds ?? selectedGrowForDays.totalBirds;
      updates.remainingBirds = Math.max(0, previousRemainingBirds - toNumber(values.mortalityDead) - toNumber(values.mortalityCulling));
    }

    feedForm.setFieldsValue(updates);
  };

  const handleSaveFeedEntry = async () => {
    if (!selectedSetupRow) return;

    try {
      setIsSavingFeedEntry(true);
      const values = await feedForm.validateFields();
      const payload = {
        building_id: selectedSetupRow.id,
        grow_id: values.growId,
        age_day: values.ageDay,
        record_date: values.recordDate.format("YYYY-MM-DD"),
        feed_code: values.feedCode?.trim() || null,
        feed_standard: values.feedStandard ?? 0,
        feed_quantity_bags: values.feedQuantityBags ?? 0,
        feed_quantity_kg: values.feedQuantityKg ?? 0,
        cumulative_feed_kg: values.cumulativeFeedKg ?? 0,
        mortality_dead: values.mortalityDead ?? 0,
        mortality_culling: values.mortalityCulling ?? 0,
        remaining_birds: values.remainingBirds ?? 0,
        remarks: values.remarks?.trim() || null,
      };

      const { error } = await supabase.from(FEEDS_TABLE).upsert(payload, { onConflict: "grow_id,age_day" });
      if (error) throw error;

      setIsFeedModalOpen(false);
      setActiveFeedDay(null);
      feedForm.resetFields();
      setToastMessage(`Day ${values.ageDay} feed entry saved.`);
      setIsToastOpen(true);
      await loadRows();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      setToastMessage(`Failed to save feed entry: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsSavingFeedEntry(false);
    }
  };

  const handleDeleteFeedEntry = async (entry: FeedEntryRecord) => {
    try {
      setDeletingFeedEntryId(entry.id);
      const { error } = await supabase.from(FEEDS_TABLE).delete().eq("id", entry.id);
      if (error) throw error;

      setToastMessage(`Day ${entry.ageDay ?? ""} feed entry deleted.`);
      setIsToastOpen(true);
      await loadRows();
    } catch (error) {
      setToastMessage(`Failed to delete feed entry: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setDeletingFeedEntryId(null);
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className="!px-3 !h-auto !min-h-14 sticky top-0 z-40 flex items-center justify-between"
        style={{
          backgroundColor: BRAND,
          paddingTop: mobileSafeAreaTop,
          height: `calc(56px + ${mobileSafeAreaTop})`,
        }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<IoMdArrowRoundBack size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className="!m-0 !text-base !text-white">
            Feeds Setup
          </Title>
        </div>
        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={() => void signOutAndRedirect(navigate)}
          aria-label="Sign out"
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-6xl">
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white md:mb-5 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                  Feeds Setup
                </div>
                <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">
                  {selectedSetupRow ? selectedSetupRow.name : "Daily feed usage"}
                </div>
                <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
                  Record daily feed usage by age day, grouped every 7 days.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                  disabled={!selectedBuildingId}
                  onClick={() => selectedBuildingId && navigate(`/feeds-consumption/building/${selectedBuildingId}`)}
                >
                  Record Types
                </Button>
                <Button
                  icon={<MdOutlinePictureAsPdf size={17} />}
                  className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                  onClick={() => navigate("/reports/feeds-consumption")}
                >
                  Report
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grow {selectedGrowForDays ? `#${selectedGrowForDays.id}` : "-"}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Days {feedDayRows.length.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Recorded {recordedFeedDays.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                Feed {(selectedSetupRow?.totalKg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500 shadow-sm">
              Loading feed usage days...
            </div>
          ) : selectedSetupRow ? (
            <div className="mt-3 rounded-lg border border-orange-100 bg-white p-3 shadow-sm">
              <div className={isMobile ? "space-y-2" : "flex items-start justify-between gap-3"}>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">Daily Feed Usage</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {selectedSetupRow.name} {selectedGrowForDays ? `| Grow #${selectedGrowForDays.id}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Days are recorded daily and grouped every 7 days to match the broiler raising record.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1">Days {feedDayRows.length.toLocaleString()}</div>
                  <div className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1">Recorded {recordedFeedDays.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:flex-row md:items-center md:justify-between">
                <Segmented
                  size={isMobile ? "small" : "middle"}
                  value={feedStatusFilter}
                  onChange={(value) => setFeedStatusFilter(value as FeedStatusFilter)}
                  options={[
                    { label: `All ${feedDayRows.length.toLocaleString()}`, value: "all" },
                    { label: `Recorded ${recordedFeedDays.toLocaleString()}`, value: "recorded" },
                    { label: `Pending ${pendingFeedDays.toLocaleString()}`, value: "pending" },
                  ]}
                />
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Showing {filteredFeedDayRows.length.toLocaleString()} days
                </div>
              </div>

              {selectedGrowForDays ? (
                <div className="mt-3 space-y-4">
                  {feedDayGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                      No {feedStatusFilter === "all" ? "feed usage" : feedStatusFilter} days to show.
                    </div>
                  ) : (
                    feedDayGroups.map((group) => (
                      <div key={group.weekNumber}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            Days {group.firstDay === group.lastDay ? group.firstDay : `${group.firstDay}-${group.lastDay}`}
                          </div>
                          <div className="text-[11px] text-slate-400">Week {group.weekNumber}</div>
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs md:grid-cols-5">
                          <div>
                            <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Recorded</div>
                            <div className="mt-1 font-bold text-slate-900">{group.recordedDays.toLocaleString()} / {group.days.length}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Bags</div>
                            <div className="mt-1 font-bold text-slate-900">{group.totalBags.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">KG</div>
                            <div className="mt-1 font-bold text-slate-900">{group.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Dead</div>
                            <div className="mt-1 font-bold text-slate-900">{group.totalDead.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Culling</div>
                            <div className="mt-1 font-bold text-slate-900">{group.totalCulling.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.days.map((dayRow) => {
                          const entry = dayRow.entry;
                          const hasEntry = entry != null;
                          return (
                            <div
                              key={dayRow.ageDay}
                              role="button"
                              tabIndex={0}
                              className={[
                                "group",
                                "w-full rounded-lg border p-3 text-left shadow-sm transition",
                                hasEntry
                                  ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
                                  : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30",
                              ].join(" ")}
                              onClick={() => handleOpenFeedModal(dayRow)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleOpenFeedModal(dayRow);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={hasEntry ? "h-2.5 w-2.5 rounded-full bg-emerald-500" : "h-2.5 w-2.5 rounded-full bg-slate-300"} />
                                    <span className="font-bold text-slate-900">Day {dayRow.ageDay}</span>
                                  </div>
                                  <div className="mt-1 text-sm text-slate-600">{formatDate(dayRow.recordDate)}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Feed {entry?.feedCode || "-"} | Bags {toNumber(entry?.feedQuantityBags).toLocaleString(undefined, { maximumFractionDigits: 2 })} | KG {toNumber(entry?.feedQuantityKg).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {hasEntry ? "Recorded" : "Pending"}
                                  </div>
                                  <div className="mt-1 text-lg font-bold text-slate-900">
                                    {entry?.remainingBirds == null ? "-" : toNumber(entry.remainingBirds).toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-slate-500">remain</div>
                                </div>
                              </div>
                              {entry && (
                                <div className="mt-3 flex justify-end">
                                  <Popconfirm
                                    title={`Delete Day ${dayRow.ageDay} feed entry?`}
                                    description="This will return the day to Pending."
                                    okText="Delete"
                                    okButtonProps={{ danger: true, loading: deletingFeedEntryId === entry.id }}
                                    onConfirm={(event) => {
                                      event?.stopPropagation();
                                      return handleDeleteFeedEntry(entry);
                                    }}
                                    onCancel={(event) => event?.stopPropagation()}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      icon={<FiTrash2 size={13} />}
                                      loading={deletingFeedEntryId === entry.id}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      Delete
                                    </Button>
                                  </Popconfirm>
                                </div>
                              )}
                            </div>
                          );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
                  This building has no grow batch yet.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-8 text-center text-sm text-slate-500 shadow-sm">
              Building feed setup was not found.
            </div>
          )}
        </div>
      </Content>
      <Modal
        title={
          activeFeedDay
            ? `${selectedSetupRow?.name ?? "Building"} | Grow #${selectedGrowForDays?.id ?? "-"} | Day ${activeFeedDay.ageDay}`
            : "Feed Entry"
        }
        open={isFeedModalOpen}
        onCancel={() => {
          setIsFeedModalOpen(false);
          setActiveFeedDay(null);
        }}
        onOk={handleSaveFeedEntry}
        okText="Save Entry"
        confirmLoading={isSavingFeedEntry}
        destroyOnHidden
        width={760}
      >
        <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 px-3 py-3 text-xs text-orange-900">
          <div className="font-semibold">Daily feed usage record</div>
          <div className="mt-1 text-orange-800">
            {activeFeedDay ? `${formatDate(activeFeedDay.recordDate)} saves to ${FEEDS_TABLE}.` : `Daily feed usage saves to ${FEEDS_TABLE}.`}
          </div>
        </div>
        <Form form={feedForm} layout="vertical" requiredMark={false} onValuesChange={handleFeedFormChange}>
          <div className="grid grid-cols-1 gap-x-3 md:grid-cols-3">
            <Form.Item
              name="growId"
              label="Grow"
              rules={[{ required: true, message: "Select grow batch" }]}
            >
              <Select disabled options={growOptions} placeholder="Select grow" />
            </Form.Item>
            <Form.Item
              name="ageDay"
              label="Day"
              rules={[{ required: true, message: "Enter age day" }]}
            >
              <InputNumber className="!w-full" disabled min={1} precision={0} />
            </Form.Item>
            <Form.Item
              name="recordDate"
              label="Date"
              rules={[{ required: true, message: "Select record date" }]}
            >
              <DatePicker className="!w-full" disabled />
            </Form.Item>
            <Form.Item name="feedCode" label="Feed Code">
              <Input placeholder="510, 511, 512..." />
            </Form.Item>
            <Form.Item name="feedStandard" label="STD">
              <InputNumber className="!w-full" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="feedQuantityBags" label="QTY Bags">
              <InputNumber className="!w-full" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="feedQuantityKg" label="QTY KG">
              <InputNumber className="!w-full" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="cumulativeFeedKg" label="Cum Feed KG">
              <InputNumber className="!w-full" min={0} precision={2} />
            </Form.Item>
            <Form.Item name="mortalityDead" label="Dead">
              <InputNumber className="!w-full" min={0} precision={0} />
            </Form.Item>
            <Form.Item name="mortalityCulling" label="Culling">
              <InputNumber className="!w-full" min={0} precision={0} />
            </Form.Item>
            <Form.Item name="remainingBirds" label="Remain">
              <InputNumber className="!w-full" min={0} precision={0} />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" className="md:col-span-3">
              <Input.TextArea rows={3} placeholder="Optional notes" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
      <NotificationToast open={isToastOpen} message={toastMessage} type="success" onClose={() => setIsToastOpen(false)} />
    </Layout>
  );
}
