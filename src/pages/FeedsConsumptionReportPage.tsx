import { Button, Card, Col, DatePicker, Divider, Grid, Layout, Row, Segmented, Select, Statistic, Table, Tabs, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const FEEDS_TABLE = import.meta.env.VITE_SUPABASE_FEEDS_CONSUMPTION_TABLE ?? "FeedsConsumption";
const FEED_RECEIVED_TABLE = import.meta.env.VITE_SUPABASE_FEED_RECEIVED_TABLE ?? "FeedReceived";
const FEED_TRANSFER_IN_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_IN_TABLE ?? "FeedTransferIn";
const FEED_TRANSFER_OUT_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_OUT_TABLE ?? "FeedTransferOut";
const FEED_USAGE_SUMMARY_TABLE = import.meta.env.VITE_SUPABASE_FEED_USAGE_SUMMARY_TABLE ?? "FeedUsageSummary";
const { Header, Content } = Layout;
const { Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

type BuildingOption = {
  id: number;
  name: string;
};

type GrowOption = {
  id: number;
  building_id: number;
  created_at: string;
  total_animals: number;
  status: string;
};

type FeedRow = {
  id: number;
  building_id: number;
  grow_id: number;
  age_day: number | null;
  record_date: string;
  feed_code: string | null;
  feed_standard: number | null;
  feed_quantity_bags: number | null;
  feed_quantity_kg: number | null;
  cumulative_feed_kg: number | null;
  mortality_dead: number | null;
  mortality_culling: number | null;
  remaining_birds: number | null;
  remarks: string | null;
};

type FeedReceivedRow = {
  id: number;
  building_id: number;
  grow_id: number;
  received_date: string;
  document_no: string | null;
  feed_code: string | null;
  qty_bags: number | null;
  remarks: string | null;
};

type FeedTransferRow = {
  id: number;
  building_id: number;
  grow_id: number;
  transfer_date: string;
  issue_no: string | null;
  feed_code: string | null;
  qty_bags: number | null;
  farm_name: string | null;
};

type FeedUsageSummaryRow = {
  id: number;
  building_id: number;
  grow_id: number;
  feed_code: string | null;
  bags: number | null;
  kg: number | null;
};

type ReportTabKey = "usage" | "received" | "transferIn" | "transferOut" | "summary";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, fractionDigits = 0): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDate(value: string | null | undefined): string {
  return value && dayjs(value).isValid() ? dayjs(value).format("MMM D, YYYY") : "-";
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function FeedsConsumptionReportPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [grows, setGrows] = useState<GrowOption[]>([]);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [receivedRows, setReceivedRows] = useState<FeedReceivedRow[]>([]);
  const [transferInRows, setTransferInRows] = useState<FeedTransferRow[]>([]);
  const [transferOutRows, setTransferOutRows] = useState<FeedTransferRow[]>([]);
  const [usageSummaryRows, setUsageSummaryRows] = useState<FeedUsageSummaryRow[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedGrowId, setSelectedGrowId] = useState<number | "all">("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<ReportTabKey>("usage");
  const [toastMessage, setToastMessage] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadBuildings = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from(BUILDINGS_TABLE)
          .select("id, name")
          .order("name", { ascending: true });

        if (!alive) return;
        if (error) throw error;

        const nextBuildings = ((data ?? []) as Array<{ id: number | null; name: string | null }>)
          .filter((row): row is { id: number; name: string | null } => row.id != null)
          .map((row) => ({ id: row.id, name: row.name ?? `Building ${row.id}` }));

        setBuildings(nextBuildings);
        setSelectedBuildingId((current) => current ?? nextBuildings[0]?.id ?? null);
      } catch (error) {
        setToastMessage(`Failed to load buildings: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void loadBuildings();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadGrows = async () => {
      if (!selectedBuildingId) {
        setGrows([]);
        setSelectedGrowId("all");
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, total_animals, status")
          .eq("building_id", selectedBuildingId)
          .order("created_at", { ascending: false });

        if (!alive) return;
        if (error) throw error;

        const nextGrows = ((data ?? []) as Array<{
          id: number | null;
          building_id: number | null;
          created_at: string | null;
          total_animals: number | null;
          status: string | null;
        }>)
          .filter((row): row is { id: number; building_id: number; created_at: string | null; total_animals: number | null; status: string | null } =>
            row.id != null && row.building_id != null
          )
          .map((row) => ({
            id: row.id,
            building_id: row.building_id,
            created_at: row.created_at ?? "",
            total_animals: Math.max(0, Math.floor(toNumber(row.total_animals))),
            status: row.status ?? "Unknown",
          }));

        setGrows(nextGrows);
        setSelectedGrowId("all");
      } catch (error) {
        setToastMessage(`Failed to load grows: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void loadGrows();
    return () => {
      alive = false;
    };
  }, [selectedBuildingId]);

  useEffect(() => {
    let alive = true;

    const loadReport = async () => {
      if (!selectedBuildingId) {
        setFeedRows([]);
        setReceivedRows([]);
        setTransferInRows([]);
        setTransferOutRows([]);
        setUsageSummaryRows([]);
        return;
      }

      try {
        setIsLoading(true);
        const applyGrowFilter = <T extends { eq: (column: string, value: number) => T }>(query: T) =>
          selectedGrowId === "all" ? query : query.eq("grow_id", selectedGrowId);

        const applyDateRange = <T extends {
          gte: (column: string, value: string) => T;
          lte: (column: string, value: string) => T;
        }>(query: T, dateColumn: string) => {
          if (!dateRange?.[0] || !dateRange?.[1]) return query;
          return query
            .gte(dateColumn, dateRange[0].startOf("day").format("YYYY-MM-DD"))
            .lte(dateColumn, dateRange[1].endOf("day").format("YYYY-MM-DD"));
        };

        const feedQuery = applyDateRange(
          applyGrowFilter(
            supabase
              .from(FEEDS_TABLE)
              .select("id, building_id, grow_id, age_day, record_date, feed_code, feed_standard, feed_quantity_bags, feed_quantity_kg, cumulative_feed_kg, mortality_dead, mortality_culling, remaining_birds, remarks")
              .eq("building_id", selectedBuildingId)
          ),
          "record_date"
        )
          .order("grow_id", { ascending: true })
          .order("age_day", { ascending: true })
          .order("record_date", { ascending: true });

        const receivedQuery = applyDateRange(
          applyGrowFilter(
            supabase
              .from(FEED_RECEIVED_TABLE)
              .select("id, building_id, grow_id, received_date, document_no, feed_code, qty_bags, remarks")
              .eq("building_id", selectedBuildingId)
          ),
          "received_date"
        ).order("received_date", { ascending: true });

        const transferInQuery = applyDateRange(
          applyGrowFilter(
            supabase
              .from(FEED_TRANSFER_IN_TABLE)
              .select("id, building_id, grow_id, transfer_date, issue_no, feed_code, qty_bags, farm_name")
              .eq("building_id", selectedBuildingId)
          ),
          "transfer_date"
        ).order("transfer_date", { ascending: true });

        const transferOutQuery = applyDateRange(
          applyGrowFilter(
            supabase
              .from(FEED_TRANSFER_OUT_TABLE)
              .select("id, building_id, grow_id, transfer_date, issue_no, feed_code, qty_bags, farm_name")
              .eq("building_id", selectedBuildingId)
          ),
          "transfer_date"
        ).order("transfer_date", { ascending: true });

        const usageSummaryQuery = applyGrowFilter(
          supabase
            .from(FEED_USAGE_SUMMARY_TABLE)
            .select("id, building_id, grow_id, feed_code, bags, kg")
            .eq("building_id", selectedBuildingId)
        ).order("feed_code", { ascending: true });

        const [feedResult, receivedResult, transferInResult, transferOutResult, usageSummaryResult] = await Promise.all([
          feedQuery,
          receivedQuery,
          transferInQuery,
          transferOutQuery,
          usageSummaryQuery,
        ]);

        if (!alive) return;
        if (feedResult.error) throw feedResult.error;
        if (receivedResult.error) throw receivedResult.error;
        if (transferInResult.error) throw transferInResult.error;
        if (transferOutResult.error) throw transferOutResult.error;
        if (usageSummaryResult.error) throw usageSummaryResult.error;

        setFeedRows((feedResult.data ?? []) as FeedRow[]);
        setReceivedRows((receivedResult.data ?? []) as FeedReceivedRow[]);
        setTransferInRows((transferInResult.data ?? []) as FeedTransferRow[]);
        setTransferOutRows((transferOutResult.data ?? []) as FeedTransferRow[]);
        setUsageSummaryRows((usageSummaryResult.data ?? []) as FeedUsageSummaryRow[]);
      } catch (error) {
        setFeedRows([]);
        setReceivedRows([]);
        setTransferInRows([]);
        setTransferOutRows([]);
        setUsageSummaryRows([]);
        setToastMessage(`Failed to load feed report: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void loadReport();
    return () => {
      alive = false;
    };
  }, [dateRange, selectedBuildingId, selectedGrowId]);

  const selectedBuildingName = useMemo(
    () =>
      buildings.find((building) => building.id === selectedBuildingId)?.name ??
      (selectedBuildingId ? `Building ${selectedBuildingId}` : "No building selected"),
    [buildings, selectedBuildingId]
  );

  const selectedGrow = useMemo(
    () => (selectedGrowId === "all" ? null : grows.find((grow) => grow.id === selectedGrowId) ?? null),
    [grows, selectedGrowId]
  );

  const buildingOptions = useMemo(
    () => buildings.map((building) => ({ value: building.id, label: building.name })),
    [buildings]
  );

  const growOptions = useMemo(
    () => [
      { value: "all" as const, label: "All grow batches" },
      ...grows.map((grow) => ({
        value: grow.id,
        label: `Grow #${grow.id} | ${grow.status} | ${grow.total_animals.toLocaleString()} birds`,
      })),
    ],
    [grows]
  );

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.[0] || !dateRange?.[1]) return "All dates";
    return `${dateRange[0].format("MMM D, YYYY")} - ${dateRange[1].format("MMM D, YYYY")}`;
  }, [dateRange]);

  const selectedGrowLabel = useMemo(
    () => (selectedGrowId === "all" ? "All grow batches" : `Grow #${selectedGrowId}`),
    [selectedGrowId]
  );

  const summary = useMemo(() => {
    const totalBags = feedRows.reduce((sum, row) => sum + toNumber(row.feed_quantity_bags), 0);
    const totalKg = feedRows.reduce((sum, row) => sum + toNumber(row.feed_quantity_kg), 0);
    const totalMortality = feedRows.reduce((sum, row) => sum + toNumber(row.mortality_dead) + toNumber(row.mortality_culling), 0);
    const receivedBags = receivedRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0);
    const transferInBags = transferInRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0);
    const transferOutBags = transferOutRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0);
    const latestRemain = [...feedRows].reverse().find((row) => row.remaining_birds != null)?.remaining_birds ?? selectedGrow?.total_animals ?? 0;
    const byFeedCode = usageSummaryRows.length > 0
      ? usageSummaryRows.reduce<Record<string, { bags: number; kg: number }>>((acc, row) => {
          const key = row.feed_code?.trim() || "Uncoded";
          acc[key] = acc[key] ?? { bags: 0, kg: 0 };
          acc[key].bags += toNumber(row.bags);
          acc[key].kg += toNumber(row.kg);
          return acc;
        }, {})
      : feedRows.reduce<Record<string, { bags: number; kg: number }>>((acc, row) => {
          const key = row.feed_code?.trim() || "Uncoded";
          acc[key] = acc[key] ?? { bags: 0, kg: 0 };
          acc[key].bags += toNumber(row.feed_quantity_bags);
          acc[key].kg += toNumber(row.feed_quantity_kg);
          return acc;
        }, {});

    return {
      totalRecords: feedRows.length,
      totalBags,
      totalKg,
      totalMortality,
      receivedBags,
      transferInBags,
      transferOutBags,
      latestRemain,
      byFeedCode,
    };
  }, [feedRows, receivedRows, selectedGrow?.total_animals, transferInRows, transferOutRows, usageSummaryRows]);

  const hasReportData =
    feedRows.length > 0 ||
    receivedRows.length > 0 ||
    transferInRows.length > 0 ||
    transferOutRows.length > 0 ||
    usageSummaryRows.length > 0;
  const hasActiveSecondaryFilters = selectedGrowId !== "all" || dateRange !== null;

  const feedCodeSummaryRows = useMemo(
    () =>
      Object.entries(summary.byFeedCode)
        .map(([feedCode, totals]) => ({
          feedCode,
          bags: totals.bags,
          kg: totals.kg,
        }))
        .sort((a, b) => a.feedCode.localeCompare(b.feedCode)),
    [summary.byFeedCode]
  );

  const reportSections = useMemo(
    () => [
      {
        key: "usage" as const,
        shortLabel: "Daily Usage",
        title: "Daily Feed Usage",
        count: feedRows.length,
        description: "Age-day feed consumption, mortality, and remaining birds.",
      },
      {
        key: "received" as const,
        shortLabel: "Received",
        title: "Feed Received",
        count: receivedRows.length,
        description: "Feed deliveries received for the selected building and grow.",
      },
      {
        key: "transferIn" as const,
        shortLabel: "Transfer In",
        title: "Feed Transfer In",
        count: transferInRows.length,
        description: "Feed moved into this building or grow batch.",
      },
      {
        key: "transferOut" as const,
        shortLabel: "Transfer Out",
        title: "Feed Transfer Out",
        count: transferOutRows.length,
        description: "Feed moved out from this building or grow batch.",
      },
      {
        key: "summary" as const,
        shortLabel: "Summary",
        title: "Feed Code Summary",
        count: feedCodeSummaryRows.length,
        description: "Bag and kilogram totals grouped by feed code.",
      },
    ],
    [feedCodeSummaryRows.length, feedRows.length, receivedRows.length, transferInRows.length, transferOutRows.length]
  );

  const activeReportSection = reportSections.find((section) => section.key === activeReportTab) ?? reportSections[0];

  const handlePdfClick = () => {
    if (!selectedBuildingId) {
      setToastMessage("Select a building before exporting the feed report.");
      setIsToastOpen(true);
      return;
    }
    if (!hasReportData) {
      setToastMessage("No feed records match the current filters.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const generatedAt = dayjs();
      const tableTheme = {
        theme: "grid" as const,
        styles: { fontSize: 5.8, cellPadding: 0.8, lineWidth: 0.12, lineColor: [95, 95, 95] as [number, number, number] },
        headStyles: { fillColor: [236, 241, 232] as [number, number, number], textColor: [25, 25, 25] as [number, number, number], fontStyle: "bold" as const },
        footStyles: { fillColor: [246, 246, 246] as [number, number, number], textColor: [25, 25, 25] as [number, number, number], fontStyle: "bold" as const },
      };
      const growStartDate = selectedGrow?.created_at ? formatDate(selectedGrow.created_at) : "-";
      const dailyRowsByAge = new Map<number, FeedRow>();

      for (const row of feedRows) {
        if (row.age_day != null && !dailyRowsByAge.has(row.age_day)) {
          dailyRowsByAge.set(row.age_day, row);
        }
      }

      const drawLabelValue = (label: string, value: string, x: number, y: number) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, x, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, x + 24, y);
        doc.line(x + 23, y + 0.7, x + 58, y + 0.7);
      };

      const makeAgeBlockRows = (startAge: number) => {
        const rows = Array.from({ length: 7 }, (_, index) => {
          const age = startAge + index;
          const row = dailyRowsByAge.get(age);
          return [
            String(age),
            row ? dayjs(row.record_date).format("M-D") : "",
            row?.feed_standard ? formatNumber(row.feed_standard, 2) : "",
            row?.feed_quantity_bags ? formatNumber(row.feed_quantity_bags, 2) : "",
            row?.cumulative_feed_kg ? formatNumber(row.cumulative_feed_kg, 2) : "",
            row?.mortality_dead ? formatNumber(row.mortality_dead) : "",
            row?.mortality_culling ? formatNumber(row.mortality_culling) : "",
            row?.remaining_birds ? formatNumber(row.remaining_birds) : "",
          ];
        });
        const blockRows = feedRows.filter((row) => row.age_day != null && row.age_day >= startAge && row.age_day < startAge + 7);
        rows.push([
          `${Math.ceil(startAge / 7)} TOTAL`,
          "",
          "",
          formatNumber(blockRows.reduce((sum, row) => sum + toNumber(row.feed_quantity_bags), 0), 2),
          "",
          formatNumber(blockRows.reduce((sum, row) => sum + toNumber(row.mortality_dead), 0)),
          formatNumber(blockRows.reduce((sum, row) => sum + toNumber(row.mortality_culling), 0)),
          "",
        ]);
        return rows;
      };

      const drawAgeBlock = (startAge: number, x: number, y: number) => {
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          margin: { left: x },
          tableWidth: 88,
          head: [[
            { content: "AGE\n(Day)", rowSpan: 2 },
            { content: "DATE", rowSpan: 2 },
            { content: "FEED USAGE", colSpan: 2 },
            { content: "CUM\nFEED", rowSpan: 2 },
            { content: "MORTALITY", colSpan: 2 },
            { content: "REMAIN", rowSpan: 2 },
          ], ["STD", "QTY", "Dead", "Culling"]],
          body: makeAgeBlockRows(startAge),
          columnStyles: {
            0: { cellWidth: 9 },
            1: { cellWidth: 12 },
            2: { cellWidth: 11 },
            3: { cellWidth: 12 },
            4: { cellWidth: 13 },
            5: { cellWidth: 10 },
            6: { cellWidth: 11 },
            7: { cellWidth: 10 },
          },
        });
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y + 41.4, 15, 3.2, "F");
        doc.setFontSize(5.6);
        doc.text("REMARKS:", x, y + 44);
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("CHAROEN POKPHAND FOODS PHILIPPINES CORPORATION", 105, 10, { align: "center" });
      doc.setFontSize(10);
      doc.text("BROILER RAISING RECORD", 105, 15, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      drawLabelValue("CF No.", "-", 14, 25);
      drawLabelValue("Farm Name:", "GGDC", 14, 31);
      drawLabelValue("House:", selectedBuildingName, 14, 37);
      drawLabelValue("Flock:", selectedGrowLabel, 14, 43);
      drawLabelValue("DOA @ Truck:", "-", 78, 25);
      drawLabelValue("DOA @ Farm:", "-", 78, 31);
      drawLabelValue("TOTAL:", "-", 78, 37);
      drawLabelValue("DOA %:", "-", 78, 43);
      drawLabelValue("Loading Date:", dateRange?.[0] ? dateRange[0].format("M-D-YY") : "-", 145, 25);
      drawLabelValue("Chicks Quantity:", selectedGrow ? formatNumber(selectedGrow.total_animals) : "-", 145, 31);
      drawLabelValue("Chicks Start:", growStartDate, 145, 37);

      drawAgeBlock(1, 14, 51);
      drawAgeBlock(8, 14, 96);
      drawAgeBlock(15, 14, 141);
      drawAgeBlock(22, 14, 186);
      drawAgeBlock(29, 14, 231);
      drawAgeBlock(36, 108, 51);

      const summaryRows = Object.entries(summary.byFeedCode).map(([feedCode, totals]) => [
        feedCode,
        formatNumber(totals.bags, 2),
        formatNumber(totals.kg, 2),
      ]);

      autoTable(doc, {
        ...tableTheme,
        startY: 263,
        margin: { left: 108 },
        tableWidth: 54,
        head: [["FEED USAGE SUMMARY", "BAGS", "KG"]],
        body: summaryRows.length > 0 ? summaryRows.slice(0, 5) : [["510", "", ""], ["511", "", ""], ["512", "", ""], ["513", "", ""]],
        foot: [["Total", formatNumber(summary.totalBags, 2), formatNumber(summary.totalKg, 2)]],
      });

      autoTable(doc, {
        ...tableTheme,
        startY: 103,
        margin: { left: 108 },
        tableWidth: 88,
        head: [["FEED RECEIVED", "DOCUMENT NO.", "FEED CODE", "QTY (bags)", "REMARKS"]],
        body: receivedRows.length > 0
          ? receivedRows.slice(0, 9).map((row) => [dayjs(row.received_date).format("M-D"), row.document_no || "", row.feed_code || "", formatNumber(row.qty_bags, 2), row.remarks || ""])
          : Array.from({ length: 9 }, () => ["", "", "", "", ""]),
      });

      autoTable(doc, {
        ...tableTheme,
        startY: 161,
        margin: { left: 108 },
        tableWidth: 88,
        head: [["FEED TRANSFER IN", "ISSUE NO.", "FEED CODE", "QTY (bags)", "FARM NAME"]],
        body: transferInRows.length > 0
          ? transferInRows.slice(0, 7).map((row) => [dayjs(row.transfer_date).format("M-D"), row.issue_no || "", row.feed_code || "", formatNumber(row.qty_bags, 2), row.farm_name || ""])
          : Array.from({ length: 7 }, () => ["", "", "", "", ""]),
      });

      autoTable(doc, {
        ...tableTheme,
        startY: 211,
        margin: { left: 108 },
        tableWidth: 88,
        head: [["FEED TRANSFER OUT", "ISSUE NO.", "FEED CODE", "QTY (bags)", "FARM NAME"]],
        body: transferOutRows.length > 0
          ? transferOutRows.slice(0, 7).map((row) => [dayjs(row.transfer_date).format("M-D"), row.issue_no || "", row.feed_code || "", formatNumber(row.qty_bags, 2), row.farm_name || ""])
          : Array.from({ length: 7 }, () => ["", "", "", "", ""]),
      });

      doc.setFontSize(6);
      doc.text(`Generated: ${generatedAt.format("MMM D, YYYY h:mm A")} | Filters: ${selectedBuildingName} | ${selectedGrowLabel} | ${dateRangeLabel}`, 14, 291);

      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("FILTERED FEED CONSUMPTION DETAIL", 14, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${selectedBuildingName} | ${selectedGrowLabel} | ${dateRangeLabel}`, 14, 21);

      autoTable(doc, {
        startY: 28,
        theme: "grid",
        head: [["Grow", "Age", "Date", "Code", "Bags", "KG", "Cum Feed", "Dead", "Culling", "Remain", "Remarks"]],
        body: feedRows.map((row) => [
          `#${row.grow_id}`,
          row.age_day == null ? "-" : String(row.age_day),
          formatDate(row.record_date),
          row.feed_code || "-",
          formatNumber(row.feed_quantity_bags, 2),
          formatNumber(row.feed_quantity_kg, 2),
          formatNumber(row.cumulative_feed_kg, 2),
          formatNumber(row.mortality_dead),
          formatNumber(row.mortality_culling),
          formatNumber(row.remaining_birds),
          row.remarks || "-",
        ]),
        foot: [["Total", "", "", "", formatNumber(summary.totalBags, 2), formatNumber(summary.totalKg, 2), "", formatNumber(summary.totalMortality), "", formatNumber(summary.latestRemain), ""]],
        styles: { fontSize: 6.2, cellPadding: 1, lineWidth: 0.1, lineColor: [120, 120, 120] },
        headStyles: { fillColor: [235, 242, 235], textColor: [20, 20, 20], fontStyle: "bold" },
        footStyles: { fillColor: [245, 245, 245], textColor: [20, 20, 20], fontStyle: "bold" },
      });

      const growFilenamePart = selectedGrowId === "all" ? "All Grows" : `Grow ${selectedGrowId}`;
      const pdfFilename = [
        "Filtered Feed Report",
        sanitizeFilenamePart(selectedBuildingName),
        sanitizeFilenamePart(growFilenamePart),
        generatedAt.format("MMM D YYYY"),
      ].join(" - ");

      doc.save(`${pdfFilename}.pdf`);
      setToastMessage("Filtered feed report PDF downloaded.");
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to generate feed PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const dailyColumns: ColumnsType<FeedRow> = [
    { title: "Grow", dataIndex: "grow_id", key: "grow_id", width: 90, render: (value: number) => `#${value}` },
    { title: "Age", dataIndex: "age_day", key: "age_day", width: 80, render: (value: number | null) => (value == null ? "-" : `Day ${value}`), sorter: (a, b) => toNumber(a.age_day) - toNumber(b.age_day) },
    { title: "Date", dataIndex: "record_date", key: "record_date", width: 130, render: formatDate },
    { title: "Feed Code", dataIndex: "feed_code", key: "feed_code", width: 110, render: (value: string | null) => value || "-" },
    { title: "Bags", dataIndex: "feed_quantity_bags", key: "feed_quantity_bags", align: "right", width: 100, render: (value: number | null) => formatNumber(value, 2) },
    { title: "KG", dataIndex: "feed_quantity_kg", key: "feed_quantity_kg", align: "right", width: 100, render: (value: number | null) => formatNumber(value, 2) },
    { title: "Cum Feed", dataIndex: "cumulative_feed_kg", key: "cumulative_feed_kg", align: "right", width: 120, render: (value: number | null) => formatNumber(value, 2) },
    { title: "Dead", dataIndex: "mortality_dead", key: "mortality_dead", align: "right", width: 90, render: (value: number | null) => formatNumber(value) },
    { title: "Culling", dataIndex: "mortality_culling", key: "mortality_culling", align: "right", width: 90, render: (value: number | null) => formatNumber(value) },
    { title: "Remain", dataIndex: "remaining_birds", key: "remaining_birds", align: "right", width: 110, render: (value: number | null) => formatNumber(value) },
    { title: "Remarks", dataIndex: "remarks", key: "remarks", render: (value: string | null) => value || "-" },
  ];

  const receivedColumns: ColumnsType<FeedReceivedRow> = [
    { title: "Grow", dataIndex: "grow_id", key: "grow_id", width: 90, render: (value: number) => `#${value}` },
    { title: "Date", dataIndex: "received_date", key: "received_date", width: 130, render: formatDate },
    { title: "Document No.", dataIndex: "document_no", key: "document_no", render: (value: string | null) => value || "-" },
    { title: "Feed Code", dataIndex: "feed_code", key: "feed_code", width: 110, render: (value: string | null) => value || "-" },
    { title: "Qty Bags", dataIndex: "qty_bags", key: "qty_bags", align: "right", width: 110, render: (value: number | null) => formatNumber(value, 2) },
    { title: "Remarks", dataIndex: "remarks", key: "remarks", render: (value: string | null) => value || "-" },
  ];

  const transferColumns: ColumnsType<FeedTransferRow> = [
    { title: "Grow", dataIndex: "grow_id", key: "grow_id", width: 90, render: (value: number) => `#${value}` },
    { title: "Date", dataIndex: "transfer_date", key: "transfer_date", width: 130, render: formatDate },
    { title: "Issue No.", dataIndex: "issue_no", key: "issue_no", render: (value: string | null) => value || "-" },
    { title: "Feed Code", dataIndex: "feed_code", key: "feed_code", width: 110, render: (value: string | null) => value || "-" },
    { title: "Qty Bags", dataIndex: "qty_bags", key: "qty_bags", align: "right", width: 110, render: (value: number | null) => formatNumber(value, 2) },
    { title: "Farm Name", dataIndex: "farm_name", key: "farm_name", render: (value: string | null) => value || "-" },
  ];

  const usageSummaryColumns: ColumnsType<FeedUsageSummaryRow> = [
    { title: "Grow", dataIndex: "grow_id", key: "grow_id", width: 90, render: (value: number) => `#${value}` },
    { title: "Feed Code", dataIndex: "feed_code", key: "feed_code", render: (value: string | null) => value || "-" },
    { title: "Bags", dataIndex: "bags", key: "bags", align: "right", render: (value: number | null) => formatNumber(value, 2) },
    { title: "KG", dataIndex: "kg", key: "kg", align: "right", render: (value: number | null) => formatNumber(value, 2) },
  ];

  const renderMobileDailyList = () => (
    <div className="space-y-3">
      {feedRows.map((row) => (
        <Card key={row.id} size="small" className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 12 } }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Feed Usage</div>
              <div className="text-lg font-bold text-emerald-700">Grow #{row.grow_id} | Day {row.age_day ?? "-"}</div>
              <div className="text-[11px] text-slate-500">{formatDate(row.record_date)}</div>
            </div>
            <div className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">{row.feed_code || "No code"}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md bg-amber-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-amber-700">Bags</div>
              <div className="text-base font-bold text-amber-800">{formatNumber(row.feed_quantity_bags, 2)}</div>
            </div>
            <div className="rounded-md bg-emerald-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-emerald-700">KG</div>
              <div className="text-base font-bold text-emerald-800">{formatNumber(row.feed_quantity_kg, 2)}</div>
            </div>
            <div className="rounded-md bg-slate-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Remain</div>
              <div className="text-base font-bold text-slate-900">{formatNumber(row.remaining_birds)}</div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-slate-100 bg-white px-2.5 py-2 text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Cumulative Feed</div>
              <div className="font-semibold text-slate-800">{formatNumber(row.cumulative_feed_kg, 2)} kg</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Mortality</div>
              <div className="font-semibold text-slate-800">
                {formatNumber(row.mortality_dead)} dead / {formatNumber(row.mortality_culling)} cull
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Standard</div>
              <div className="font-semibold text-slate-800">{formatNumber(row.feed_standard, 2)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Remarks</div>
              <div className="truncate font-semibold text-slate-800">{row.remarks || "-"}</div>
            </div>
          </div>
        </Card>
      ))}
      {feedRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500">
          No feed usage records match the current filters.
        </div>
      ) : null}
    </div>
  );

  const renderMobileReceivedList = () => (
    <div className="space-y-3">
      {receivedRows.map((row) => (
        <Card key={row.id} size="small" className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 12 } }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Feed Received</div>
              <div className="text-lg font-bold text-emerald-700">Grow #{row.grow_id}</div>
              <div className="text-[11px] text-slate-500">{formatDate(row.received_date)}</div>
            </div>
            <div className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">{row.feed_code || "No code"}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-amber-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-amber-700">Bags</div>
              <div className="text-base font-bold text-amber-800">{formatNumber(row.qty_bags, 2)}</div>
            </div>
            <div className="rounded-md bg-slate-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Document No.</div>
              <div className="truncate text-base font-bold text-slate-900">{row.document_no || "-"}</div>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-slate-100 bg-white px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-400">Remarks</div>
            <div className="text-[11px] font-semibold text-slate-800">{row.remarks || "-"}</div>
          </div>
        </Card>
      ))}
      {receivedRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500">
          No feed received records match the current filters.
        </div>
      ) : null}
    </div>
  );

  const renderMobileTransferList = (rows: FeedTransferRow[], emptyText: string, title: string) => (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id} size="small" className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 12 } }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</div>
              <div className="text-lg font-bold text-emerald-700">Grow #{row.grow_id}</div>
              <div className="text-[11px] text-slate-500">{formatDate(row.transfer_date)}</div>
            </div>
            <div className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">{row.feed_code || "No code"}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-amber-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-amber-700">Bags</div>
              <div className="text-base font-bold text-amber-800">{formatNumber(row.qty_bags, 2)}</div>
            </div>
            <div className="rounded-md bg-slate-50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Issue No.</div>
              <div className="truncate text-base font-bold text-slate-900">{row.issue_no || "-"}</div>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-slate-100 bg-white px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-400">Farm Name</div>
            <div className="text-[11px] font-semibold text-slate-800">{row.farm_name || "-"}</div>
          </div>
        </Card>
      ))}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500">
          {emptyText}
        </div>
      ) : null}
    </div>
  );

  const renderTabLabel = (label: string, count: number) => (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-600">
        {count.toLocaleString()}
      </span>
    </span>
  );

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={["sticky top-0 z-40", "flex items-center justify-between", isMobile ? "!px-3 !h-auto !min-h-14" : "!px-8 !h-[74px]"].join(" ")}
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
          <Button type="text" icon={<IoMdArrowRoundBack size={20} />} className="!text-white hover:!text-white/90" onClick={() => navigate(-1)} aria-label="Back" />
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Button type="text" icon={<IoHome size={18} />} className="!text-white hover:!text-white/90" onClick={() => navigate("/landing-page")} aria-label="Home" />
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Title level={4} className="!m-0 !text-base !text-white md:!text-lg">
            Feeds Report
          </Title>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={isMobile ? 21 : 23} />}
            className="!text-white hover:!text-white/90 disabled:!text-white/40"
            onClick={handlePdfClick}
            loading={isExportingPdf}
            disabled={!hasReportData}
            title={hasReportData ? "Export all filtered feed data" : "No feed records to export"}
            aria-label="Export PDF"
          />
          <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={() => void signOutAndRedirect(navigate)} aria-label="Sign out" />
        </div>
        <div className="absolute bottom-0 left-0 h-1 w-full bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-4 py-4" : "px-8 py-6"}>
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <div className="overflow-hidden rounded-2xl border border-emerald-100 shadow-sm">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-5 py-5 text-white md:px-7 md:py-6">
              <div className={isMobile ? "space-y-4" : "grid grid-cols-12 gap-6 items-end"}>
                <div className={isMobile ? "" : "col-span-7"}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Reports Center</div>
                  <div className="mt-2 text-2xl font-bold leading-tight md:text-3xl">Feeds Report</div>
                  <div className="mt-2 max-w-2xl text-sm text-emerald-50/90 md:text-base">
                    Filter feed usage by building, grow, and date range, then export the visible report to PDF.
                  </div>
                </div>
                <div className={isMobile ? "grid grid-cols-2 gap-3" : "col-span-5 grid grid-cols-2 gap-3"}>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Building</div>
                    <div className="mt-1 text-sm font-semibold text-white md:text-base">{selectedBuildingName}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Coverage</div>
                    <div className="mt-1 text-sm font-semibold text-white md:text-base">{dateRangeLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white px-4 py-4 md:px-6 md:py-5">
              <div className={isMobile ? "space-y-3" : "grid grid-cols-12 gap-4 items-end"}>
                <div className={isMobile ? "" : "col-span-4"}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Building</div>
                  <Select className="!w-full" size="large" value={selectedBuildingId ?? undefined} options={buildingOptions} onChange={(value) => setSelectedBuildingId(Number(value))} loading={isLoading && buildings.length === 0} />
                </div>
                <div className={isMobile ? "" : "col-span-4"}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grow Batch</div>
                  <Select className="!w-full" size="large" value={selectedGrowId} options={growOptions} onChange={(value) => setSelectedGrowId(value)} placeholder="Select grow" loading={isLoading} />
                </div>
                <div className={isMobile ? "" : "col-span-4"}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date Range</div>
                  {isMobile ? (
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker
                        className="!w-full"
                        value={dateRange?.[0] ?? null}
                        placeholder="Start"
                        allowClear
                        onChange={(startDate) => {
                          if (!startDate) {
                            setDateRange(null);
                            return;
                          }
                          const currentEnd = dateRange?.[1] ?? startDate;
                          setDateRange(currentEnd.isBefore(startDate, "day") ? [startDate, startDate] : [startDate, currentEnd]);
                        }}
                      />
                      <DatePicker
                        className="!w-full"
                        value={dateRange?.[1] ?? null}
                        placeholder="End"
                        allowClear
                        onChange={(endDate) => {
                          if (!endDate) {
                            setDateRange(null);
                            return;
                          }
                          const currentStart = dateRange?.[0] ?? endDate;
                          setDateRange(endDate.isBefore(currentStart, "day") ? [currentStart, currentStart] : [currentStart, endDate]);
                        }}
                      />
                    </div>
                  ) : (
                    <RangePicker className="!w-full" size="large" value={dateRange} onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)} allowClear />
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 md:flex md:items-center md:justify-between md:gap-3 md:text-sm">
                <div className="min-w-0">
                  <span className="font-semibold">Current filter</span>
                  <span className="mt-1 block md:mt-0">
                    {selectedBuildingName} | {selectedGrowLabel} | {dateRangeLabel}
                  </span>
                </div>
                <Button
                  className="mt-2 !border-emerald-200 !text-emerald-700 md:mt-0"
                  size="small"
                  disabled={!hasActiveSecondaryFilters}
                  onClick={() => {
                    setSelectedGrowId("all");
                    setDateRange(null);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          <Row gutter={isMobile ? [8, 8] : [16, 16]}>
            <Col xs={12} md={6}>
              <Card className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: isMobile ? 10 : 16 } }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Records</div>
                <Statistic value={summary.totalRecords} valueStyle={{ color: "#0f172a", fontSize: isMobile ? 18 : 28, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="!rounded-sm !border !border-emerald-100 shadow-sm" styles={{ body: { padding: isMobile ? 10 : 16 } }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Total Feed KG</div>
                <Statistic value={summary.totalKg} precision={2} valueStyle={{ color: BRAND, fontSize: isMobile ? 18 : 28, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="!rounded-sm !border !border-amber-100 shadow-sm" styles={{ body: { padding: isMobile ? 10 : 16 } }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Received Bags</div>
                <Statistic value={summary.receivedBags} precision={2} valueStyle={{ color: "#92400e", fontSize: isMobile ? 18 : 28, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: isMobile ? 10 : 16 } }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Net Transfer Bags</div>
                <Statistic value={summary.transferInBags - summary.transferOutBags} precision={2} valueStyle={{ color: "#0f172a", fontSize: isMobile ? 18 : 28, fontWeight: 700 }} />
              </Card>
            </Col>
          </Row>

          <Card className="!rounded-sm !border !border-emerald-100 shadow-sm" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
            <div className={isMobile ? "space-y-3" : "flex items-start justify-between gap-4"}>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Feed Code Summary</div>
                <div className="text-base font-bold text-slate-900 md:text-lg">Bags and KG by feed code</div>
              </div>
              <div className="text-xs text-slate-500 md:text-right">
                {usageSummaryRows.length > 0 ? "Using saved summary records" : "Calculated from daily usage"}
              </div>
            </div>
            {feedCodeSummaryRows.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {feedCodeSummaryRows.map((row) => (
                  <div key={row.feedCode} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Feed {row.feedCode}</div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-xl font-bold leading-none text-slate-900">{formatNumber(row.bags, 2)}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">bags</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700">{formatNumber(row.kg, 2)}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">kg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                No feed code totals match the current filters.
              </div>
            )}
          </Card>

          <Card className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: isMobile ? 12 : 18 } }}>
            <div className={isMobile ? "mb-3 space-y-3" : "mb-3 flex items-start justify-between gap-3"}>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Filtered Lists</div>
                <div className="text-lg font-bold text-slate-900">{activeReportSection.title}</div>
                <div className="mt-1 text-xs text-slate-500">{activeReportSection.description}</div>
              </div>
              <Button
                icon={<MdOutlinePictureAsPdf size={18} />}
                onClick={handlePdfClick}
                loading={isExportingPdf}
                disabled={!hasReportData}
                title={hasReportData ? "Export filtered feed report sections" : "No feed records to export"}
              >
                Export Filtered PDF
              </Button>
            </div>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className={isMobile ? "space-y-2" : "flex items-center justify-between gap-3"}>
                <div className={isMobile ? "overflow-x-auto pb-1" : ""}>
                  <Segmented
                    size={isMobile ? "small" : "middle"}
                    value={activeReportTab}
                    onChange={(value) => setActiveReportTab(value as ReportTabKey)}
                    options={reportSections.map((section) => ({
                      label: `${section.shortLabel} ${section.count.toLocaleString()}`,
                      value: section.key,
                    }))}
                  />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  PDF exports all filtered sections
                </div>
              </div>
            </div>
            {!isLoading && !hasReportData ? (
              <div className="mb-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 md:text-sm">
                <div className="font-semibold">No feed records found for this building, grow, and date range.</div>
                <div className="mt-1 text-amber-800">Try clearing filters or selecting another grow batch.</div>
              </div>
            ) : null}
            <Tabs
              activeKey={activeReportTab}
              onChange={(key) => setActiveReportTab(key as ReportTabKey)}
              items={[
                {
                  key: "usage",
                  label: renderTabLabel("Daily Feed Usage", feedRows.length),
                  children: isMobile ? renderMobileDailyList() : (
                    <Table<FeedRow>
                      dataSource={feedRows}
                      columns={dailyColumns}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} feed records` }}
                      scroll={{ x: 1120 }}
                      locale={{ emptyText: "No feed usage records match the current filters." }}
                    />
                  ),
                },
                {
                  key: "received",
                  label: renderTabLabel("Feed Received", receivedRows.length),
                  children: isMobile ? renderMobileReceivedList() : (
                    <Table<FeedReceivedRow>
                      dataSource={receivedRows}
                      columns={receivedColumns}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{ pageSize: 10 }}
                      size={isMobile ? "small" : "middle"}
                      scroll={{ x: 760 }}
                      locale={{ emptyText: "No feed received records match the current filters." }}
                    />
                  ),
                },
                {
                  key: "transferIn",
                  label: renderTabLabel("Transfer In", transferInRows.length),
                  children: isMobile ? renderMobileTransferList(transferInRows, "No transfer in records match the current filters.", "Transfer In") : (
                    <Table<FeedTransferRow>
                      dataSource={transferInRows}
                      columns={transferColumns}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{ pageSize: 10 }}
                      size={isMobile ? "small" : "middle"}
                      scroll={{ x: 760 }}
                      locale={{ emptyText: "No transfer in records match the current filters." }}
                    />
                  ),
                },
                {
                  key: "transferOut",
                  label: renderTabLabel("Transfer Out", transferOutRows.length),
                  children: isMobile ? renderMobileTransferList(transferOutRows, "No transfer out records match the current filters.", "Transfer Out") : (
                    <Table<FeedTransferRow>
                      dataSource={transferOutRows}
                      columns={transferColumns}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{ pageSize: 10 }}
                      size={isMobile ? "small" : "middle"}
                      scroll={{ x: 760 }}
                      locale={{ emptyText: "No transfer out records match the current filters." }}
                    />
                  ),
                },
                {
                  key: "summary",
                  label: renderTabLabel("Feed Code Summary", feedCodeSummaryRows.length),
                  children: (
                    <Table<FeedUsageSummaryRow>
                      dataSource={usageSummaryRows}
                      columns={usageSummaryColumns}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{ pageSize: 10 }}
                      size={isMobile ? "small" : "middle"}
                      locale={{ emptyText: "No manual usage summary records match the current filters." }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </Content>

      <NotificationToast open={isToastOpen} message={toastMessage} type="success" onClose={() => setIsToastOpen(false)} />
    </Layout>
  );
}
