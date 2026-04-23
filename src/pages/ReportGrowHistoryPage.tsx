import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid, Card, Table, Tag, Row, Col } from "antd";
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const BRAND = "#008822";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const HARVEST_TABLE = import.meta.env.VITE_SUPABASE_HARVEST_TABLE ?? "Harvest";
const HARVEST_REDUCTION_TRANSACTIONS_TABLE =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_TRANSACTIONS_TABLE ?? "HarvestReductionTransactions";
const HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN ?? "animal_count_to_deduct";

type GrowRow = {
  id: number;
  building_id: number | null;
  created_at: string;
  total_animals: number | null;
  status: string | null;
  is_harvested: boolean | null;
};

type BuildingRow = {
  id: number;
  name: string | null;
};

type GrowLogRow = {
  id: number;
  created_at: string;
  actual_total_animals: number | null;
  mortality: number | null;
  thinning: number | null;
  take_out: number | null;
};

type HarvestRow = {
  id: number;
  created_at: string;
  status: string | null;
  total_animals_out?: number | null;
  total_animals_?: number | null;
  total_animals?: number | null;
  [key: string]: unknown;
};

type HarvestReductionRow = {
  id: number | string;
  harvest_id: number | null;
  created_at: string;
  reduction_type: string | null;
  remarks: string | null;
  [key: string]: unknown;
};

type GrowInfo = {
  growId: number;
  buildingId: number | null;
  buildingName: string;
  createdAt: string;
  totalAnimals: number;
  status: string;
  isHarvested: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}

function toNonNegativeInt(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function getHarvestTotalAnimals(row: HarvestRow): number {
  const configured = row.total_animals_out;
  if (typeof configured === "number" || configured === null) {
    return toNonNegativeInt(configured);
  }
  return toNonNegativeInt(row.total_animals_ ?? row.total_animals ?? 0);
}

function getHarvestReductionCount(row: HarvestReductionRow): number {
  const configured = row[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN];
  if (typeof configured === "number" || configured === null || configured === undefined) {
    return toNonNegativeInt(configured);
  }
  return toNonNegativeInt(0);
}

function ChickenState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <img
        src="/img/happyrun.gif"
        alt="Chicken loading"
        className="h-24 w-24 rounded-full object-cover"
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

export default function ReportGrowHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";

  const [isLoading, setIsLoading] = useState(false);
  const [growInfo, setGrowInfo] = useState<GrowInfo | null>(null);
  const [growHistory, setGrowHistory] = useState<GrowLogRow[]>([]);
  const [harvestHistory, setHarvestHistory] = useState<HarvestRow[]>([]);
  const [harvestReductionHistory, setHarvestReductionHistory] = useState<HarvestReductionRow[]>([]);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [exportingSection, setExportingSection] = useState<"summary" | "grow" | "harvest" | "reduction" | null>(null);

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const openPdfPreview = (doc: jsPDF, fileName: string) => {
    const pdfUrl = doc.output("bloburl");
    const previewWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      setToastMessage("Unable to open PDF preview. Please allow pop-ups and try again.");
      setIsToastOpen(true);
      return;
    }
    setToastMessage(`PDF preview opened: ${fileName}`);
    setIsToastOpen(true);
  };

  const exportSummaryPdf = () => {
    if (!growInfo) return;
    setExportingSection("summary");
    try {
      const generatedAt = dayjs();
      const fileName = `grow-${growInfo.growId}-summary_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(`Grow #${growInfo.growId} Summary`, 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Building: ${growInfo.buildingName}`, 14, 26);
      doc.text(`Status: ${growInfo.status}`, 14, 32);
      doc.text(`Created: ${dayjs(growInfo.createdAt).format("MMMM D, YYYY h:mm A")}`, 14, 38);

      autoTable(doc, {
        startY: 46,
        head: [["Metric", "Value"]],
        body: [
          ["Total Birds", growInfo.totalAnimals.toLocaleString()],
          ["Grow Logs", summary.growLogs.toLocaleString()],
          ["Harvest Entries", summary.harvestEntries.toLocaleString()],
          ["Harvested Birds", summary.totalHarvested.toLocaleString()],
          ["Reduction Transactions", summary.totalReductions.toLocaleString()],
        ],
        headStyles: { fillColor: [0, 136, 34] },
      });

      openPdfPreview(doc, fileName);
    } catch (error) {
      setToastMessage(`Failed to export summary PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setExportingSection(null);
    }
  };

  const exportGrowLogsPdf = () => {
    if (!growInfo || growHistory.length === 0) {
      setToastMessage("No grow logs available to export.");
      setIsToastOpen(true);
      return;
    }

    setExportingSection("grow");
    try {
      const generatedAt = dayjs();
      const fileName = `grow-${growInfo.growId}-logs_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`Grow #${growInfo.growId} - Daily Grow Logs`, 14, 16);

      autoTable(doc, {
        startY: 22,
        head: [["Date", "Actual Total", "Mortality", "Thinning", "Take Out"]],
        body: growHistory.map((row) => [
          dayjs(row.created_at).format("MMM D, YYYY h:mm A"),
          toNonNegativeInt(row.actual_total_animals).toLocaleString(),
          toNonNegativeInt(row.mortality).toLocaleString(),
          toNonNegativeInt(row.thinning).toLocaleString(),
          toNonNegativeInt(row.take_out).toLocaleString(),
        ]),
        headStyles: { fillColor: [0, 136, 34] },
      });

      openPdfPreview(doc, fileName);
    } catch (error) {
      setToastMessage(`Failed to export grow logs PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setExportingSection(null);
    }
  };

  const exportHarvestHistoryPdf = () => {
    if (!growInfo || harvestHistory.length === 0) {
      setToastMessage("No harvest history available to export.");
      setIsToastOpen(true);
      return;
    }

    setExportingSection("harvest");
    try {
      const generatedAt = dayjs();
      const fileName = `grow-${growInfo.growId}-harvest-history_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`Grow #${growInfo.growId} - Harvest History`, 14, 16);

      autoTable(doc, {
        startY: 22,
        head: [["Harvest #", "Date", "Status", "Total Animals Out"]],
        body: harvestHistory.map((row) => [
          `#${row.id}`,
          dayjs(row.created_at).format("MMM D, YYYY h:mm A"),
          row.status ?? "Unknown",
          getHarvestTotalAnimals(row).toLocaleString(),
        ]),
        headStyles: { fillColor: [0, 136, 34] },
      });

      openPdfPreview(doc, fileName);
    } catch (error) {
      setToastMessage(`Failed to export harvest history PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setExportingSection(null);
    }
  };

  const exportReductionHistoryPdf = () => {
    if (!growInfo || harvestReductionHistory.length === 0) {
      setToastMessage("No reduction history available to export.");
      setIsToastOpen(true);
      return;
    }

    setExportingSection("reduction");
    try {
      const generatedAt = dayjs();
      const fileName = `grow-${growInfo.growId}-reduction-history_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`Grow #${growInfo.growId} - Reduction Transactions`, 14, 16);

      autoTable(doc, {
        startY: 22,
        head: [["Date", "Harvest #", "Type", "Count", "Remarks"]],
        body: harvestReductionHistory.map((row) => [
          dayjs(row.created_at).format("MMM D, YYYY h:mm A"),
          row.harvest_id == null ? "-" : `#${row.harvest_id}`,
          row.reduction_type ?? "Unknown",
          getHarvestReductionCount(row).toLocaleString(),
          row.remarks ?? "-",
        ]),
        headStyles: { fillColor: [0, 136, 34] },
      });

      openPdfPreview(doc, fileName);
    } catch (error) {
      setToastMessage(`Failed to export reduction history PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setExportingSection(null);
    }
  };

  useEffect(() => {
    const growId = Number(id);
    if (!Number.isFinite(growId) || growId <= 0) {
      setToastMessage("Invalid grow ID.");
      setIsToastOpen(true);
      setGrowInfo(null);
      setGrowHistory([]);
      setHarvestHistory([]);
      setHarvestReductionHistory([]);
      return;
    }

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const { data: growData, error: growError } = await supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, total_animals, status, is_harvested")
          .eq("id", growId)
          .maybeSingle();
        if (growError) throw growError;

        if (!growData) {
          setGrowInfo(null);
          setGrowHistory([]);
          setHarvestHistory([]);
          setHarvestReductionHistory([]);
          setToastMessage(`Grow #${growId} was not found.`);
          setIsToastOpen(true);
          return;
        }

        const growRow = growData as GrowRow;
        let buildingName = growRow.building_id ? `Building ${growRow.building_id}` : "Unknown building";

        if (growRow.building_id != null) {
          const { data: buildingData, error: buildingError } = await supabase
            .from(BUILDINGS_TABLE)
            .select("id, name")
            .eq("id", growRow.building_id)
            .maybeSingle();
          if (buildingError) throw buildingError;
          const buildingRow = buildingData as BuildingRow | null;
          buildingName = buildingRow?.name ?? buildingName;
        }

        setGrowInfo({
          growId: growRow.id,
          buildingId: growRow.building_id,
          buildingName,
          createdAt: growRow.created_at,
          totalAnimals: toNonNegativeInt(growRow.total_animals),
          status: growRow.status ?? "Unknown",
          isHarvested: Boolean(growRow.is_harvested),
        });

        const [{ data: growLogsData, error: growLogsError }, { data: harvestData, error: harvestError }] = await Promise.all([
          supabase
            .from(GROW_LOGS_TABLE)
            .select("id, created_at, actual_total_animals, mortality, thinning, take_out")
            .eq("grow_id", growId)
            .order("created_at", { ascending: false }),
          supabase
            .from(HARVEST_TABLE)
            .select("*")
            .eq("grow_id", growId)
            .order("created_at", { ascending: false }),
        ]);
        if (growLogsError) throw growLogsError;
        if (harvestError) throw harvestError;

        const nextGrowHistory = (growLogsData ?? []) as GrowLogRow[];
        const nextHarvestHistory = (harvestData ?? []) as HarvestRow[];
        setGrowHistory(nextGrowHistory);
        setHarvestHistory(nextHarvestHistory);

        const harvestIds = nextHarvestHistory
          .map((row) => Number(row.id))
          .filter((val) => Number.isFinite(val) && val > 0);

        if (harvestIds.length === 0) {
          setHarvestReductionHistory([]);
          return;
        }

        const { data: reductionData, error: reductionError } = await supabase
          .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
          .select("*")
          .in("harvest_id", harvestIds)
          .order("created_at", { ascending: false });
        if (reductionError) throw reductionError;
        setHarvestReductionHistory((reductionData ?? []) as HarvestReductionRow[]);
      } catch (error) {
        setGrowInfo(null);
        setGrowHistory([]);
        setHarvestHistory([]);
        setHarvestReductionHistory([]);
        setToastMessage(`Failed to load grow history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [id]);

  const summary = useMemo(() => {
    const totalHarvested = harvestHistory.reduce((sum, row) => sum + getHarvestTotalAnimals(row), 0);
    const totalReductions = harvestReductionHistory.reduce((sum, row) => sum + getHarvestReductionCount(row), 0);
    return {
      growLogs: growHistory.length,
      harvestEntries: harvestHistory.length,
      totalHarvested,
      totalReductions,
    };
  }, [growHistory, harvestHistory, harvestReductionHistory]);

  const growHistoryColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => dayjs(value).format("MMM D, YYYY h:mm A"),
    },
    {
      title: "Actual Total",
      dataIndex: "actual_total_animals",
      key: "actual_total_animals",
      render: (value: number | null) => toNonNegativeInt(value).toLocaleString(),
    },
    {
      title: "Mortality",
      dataIndex: "mortality",
      key: "mortality",
      render: (value: number | null) => toNonNegativeInt(value).toLocaleString(),
    },
    {
      title: "Thinning",
      dataIndex: "thinning",
      key: "thinning",
      render: (value: number | null) => toNonNegativeInt(value).toLocaleString(),
    },
    {
      title: "Take Out",
      dataIndex: "take_out",
      key: "take_out",
      render: (value: number | null) => toNonNegativeInt(value).toLocaleString(),
    },
  ];

  const harvestHistoryColumns = [
    {
      title: "Harvest #",
      dataIndex: "id",
      key: "id",
      render: (value: number) => <span className="font-semibold text-emerald-700">#{value}</span>,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => dayjs(value).format("MMM D, YYYY h:mm A"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string | null) => <Tag color="orange">{value ?? "Unknown"}</Tag>,
    },
    {
      title: "Total Animals Out",
      key: "total_animals_out",
      render: (_: unknown, row: HarvestRow) => getHarvestTotalAnimals(row).toLocaleString(),
    },
  ];

  const harvestReductionColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => dayjs(value).format("MMM D, YYYY h:mm A"),
    },
    {
      title: "Harvest #",
      dataIndex: "harvest_id",
      key: "harvest_id",
      render: (value: number | null) => (value == null ? "-" : `#${value}`),
    },
    {
      title: "Type",
      dataIndex: "reduction_type",
      key: "reduction_type",
      render: (value: string | null) => value ?? "Unknown",
    },
    {
      title: "Count",
      key: "count",
      render: (_: unknown, row: HarvestReductionRow) => getHarvestReductionCount(row).toLocaleString(),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (value: string | null) => value ?? "-",
    },
  ];

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
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Reports</div>
            <Title level={4} className="!m-0 !text-white !text-lg">
              Grow History Detail
            </Title>
          </div>
        </div>
        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
          aria-label="Sign out"
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-4 py-4" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState title="Loading grow report history..." subtitle="Fetching grow and harvest records." />
        ) : !growInfo ? (
          <ChickenState
            title="No grow detail found"
            subtitle="Try going back and opening a different Grow entry."
          />
        ) : (
          <div className="mx-auto w-full max-w-7xl space-y-6 md:space-y-8">
            <Card className="!rounded-sm !border !border-emerald-100 shadow-sm" styles={{ body: { padding: isMobile ? 14 : 20 } }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Grow Summary</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">Grow #{growInfo.growId}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {growInfo.buildingName} | Created {dayjs(growInfo.createdAt).format("MMMM D, YYYY h:mm A")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag color={growInfo.isHarvested ? "orange" : "green"} className="!w-fit !text-sm !font-semibold">
                    {growInfo.status}
                  </Tag>
                  <Button
                    icon={<MdOutlinePictureAsPdf size={18} />}
                    onClick={exportSummaryPdf}
                    loading={exportingSection === "summary"}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              <Row gutter={isMobile ? [12, 12] : [16, 16]} className="mt-5">
                <Col xs={12} md={6}>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Total Birds</div>
                    <div className="text-xl font-bold text-slate-900">{growInfo.totalAnimals.toLocaleString()}</div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Grow Logs</div>
                    <div className="text-xl font-bold text-slate-900">{summary.growLogs.toLocaleString()}</div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Harvest Entries</div>
                    <div className="text-xl font-bold text-emerald-800">{summary.harvestEntries.toLocaleString()}</div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-amber-700">Harvested Birds</div>
                    <div className="text-xl font-bold text-amber-800">{summary.totalHarvested.toLocaleString()}</div>
                  </div>
                </Col>
              </Row>
            </Card>

            <Card className="!rounded-sm !border !border-slate-200 shadow-sm !mt-6" styles={{ body: { padding: isMobile ? 14 : 20 } }}>
              <div className="mb-4 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grow History</div>
                  <div className="text-lg font-bold text-slate-900">Daily Grow Logs</div>
                </div>
                <Button
                  icon={<MdOutlinePictureAsPdf size={18} />}
                  onClick={exportGrowLogsPdf}
                  loading={exportingSection === "grow"}
                >
                  PDF
                </Button>
              </div>
              <Table
                dataSource={growHistory}
                columns={growHistoryColumns}
                rowKey="id"
                pagination={{ pageSize: 8, showSizeChanger: true }}
                size={isMobile ? "small" : "middle"}
                locale={{ emptyText: "No grow logs found for this grow." }}
              />
            </Card>

            <Card className="!rounded-sm !border !border-slate-200 shadow-sm !mt-4" styles={{ body: { padding: isMobile ? 14 : 20 } }}>
              <div className="mb-4 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Harvest History</div>
                  <div className="text-lg font-bold text-slate-900">Harvest Batches</div>
                </div>
                <Button
                  icon={<MdOutlinePictureAsPdf size={18} />}
                  onClick={exportHarvestHistoryPdf}
                  loading={exportingSection === "harvest"}
                >
                  PDF
                </Button>
              </div>
              <Table
                dataSource={harvestHistory}
                columns={harvestHistoryColumns}
                rowKey="id"
                pagination={{ pageSize: 8, showSizeChanger: true }}
                size={isMobile ? "small" : "middle"}
                locale={{ emptyText: "No harvest entries found for this grow." }}
              />
            </Card>

            <Card className="!rounded-sm !border !border-slate-200 shadow-sm !mt-4" styles={{ body: { padding: isMobile ? 14 : 20 } }}>
              <div className="mb-4 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Harvest Reduction History</div>
                  <div className="text-lg font-bold text-slate-900">Reduction Transactions</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Total: {summary.totalReductions.toLocaleString()}
                  </div>
                  <Button
                    icon={<MdOutlinePictureAsPdf size={18} />}
                    onClick={exportReductionHistoryPdf}
                    loading={exportingSection === "reduction"}
                  >
                    PDF
                  </Button>
                </div>
              </div>
              <Table
                dataSource={harvestReductionHistory}
                columns={harvestReductionColumns}
                rowKey={(row) => String(row.id)}
                pagination={{ pageSize: 8, showSizeChanger: true }}
                size={isMobile ? "small" : "middle"}
                locale={{ emptyText: "No harvest reduction transactions found for this grow." }}
              />
            </Card>
          </div>
        )}
      </Content>

      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
