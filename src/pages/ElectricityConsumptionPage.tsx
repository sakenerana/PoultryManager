import { Button, Divider, Grid, Layout, Pagination, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlineBolt, MdOutlineConstruction, MdOutlinePictureAsPdf } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const ELECTRICITY_TABLE = import.meta.env.VITE_SUPABASE_ELECTRICITY_CONSUMPTION_TABLE ?? "ElectricityConsumption";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type BuildingElectricityRow = {
  key: string;
  id: number;
  name: string;
  latestGrowId: number | null;
  buildingName: string;
  createdAt: string;
  totalBirds: number;
  totalKwh: number;
  status: string;
  isHarvested: boolean;
};

type ElectricitySourceRow = {
  grow_id: number | null;
  date: string | null;
  day: number | null;
  meter_reading: number | null;
  consumption: number | null;
};

type GrowCycleElectricityRow = {
  key: string;
  growId: number;
  buildingId: number | null;
  buildingName: string;
  createdAt: string;
  endDate: string;
  totalBirds: number;
  startReading: number | null;
  endReading: number | null;
  totalKwh: number;
  daysLogged: number;
  status: string;
  isHarvested: boolean;
};

const formatDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM DD, YYYY") : "-";
};

const formatShortDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMM D, YYYY") : "-";
};

const formatKwh = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

const statusColor = (status: string, isHarvested: boolean): string => {
  const normalized = status.toLowerCase();
  if (isHarvested || normalized === "harvested") return "orange";
  if (normalized === "growing") return "green";
  if (normalized === "loading") return "blue";
  if (normalized === "ready") return "default";
  return "cyan";
};

export default function ElectricityConsumptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [rows, setRows] = useState<BuildingElectricityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(5);
  const [summary, setSummary] = useState({ buildings: 0, grows: 0, todayKwh: 0 });
  const [cycleRows, setCycleRows] = useState<GrowCycleElectricityRow[]>([]);
  const [isExportingCyclePdf, setIsExportingCyclePdf] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const pageMode = location.pathname.endsWith("/daily")
    ? "daily"
    : location.pathname.endsWith("/grow-cycle")
      ? "grow-cycle"
      : "menu";

  const mobilePagedRows = useMemo(() => {
    const start = (mobilePage - 1) * mobilePageSize;
    return rows.slice(start, start + mobilePageSize);
  }, [mobilePage, mobilePageSize, rows]);

  const mobilePagedCycleRows = useMemo(() => {
    const start = (mobilePage - 1) * mobilePageSize;
    return cycleRows.slice(start, start + mobilePageSize);
  }, [cycleRows, mobilePage, mobilePageSize]);

  const columns: ColumnsType<BuildingElectricityRow> = useMemo(
    () => [
      { title: "Building", dataIndex: "name", key: "name", width: 180 },
      {
        title: "Latest Grow",
        dataIndex: "latestGrowId",
        key: "latestGrowId",
        width: 120,
        render: (id: number | null) => (id == null ? "-" : `#${id}`),
      },
      {
        title: "Date Start",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 140,
        render: (value: string) => formatDate(value),
      },
      {
        title: "Total Birds",
        dataIndex: "totalBirds",
        key: "totalBirds",
        width: 140,
        align: "right",
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: "Total kWh",
        dataIndex: "totalKwh",
        key: "totalKwh",
        width: 140,
        align: "right",
        render: (value: number) => formatKwh(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status: string, record) => (
          <Tag color={statusColor(status, record.isHarvested)} className="!mr-0">
            {status || "Unknown"}
          </Tag>
        ),
      },
    ],
    []
  );

  const cycleColumns: ColumnsType<GrowCycleElectricityRow> = useMemo(
    () => [
      { title: "Building", dataIndex: "buildingName", key: "buildingName", width: 140 },
      {
        title: "Grow",
        dataIndex: "growId",
        key: "growId",
        width: 90,
        render: (id: number) => `#${id}`,
      },
      {
        title: "Start Date",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 130,
        render: (value: string) => formatShortDate(value),
      },
      {
        title: "End Date",
        dataIndex: "endDate",
        key: "endDate",
        width: 130,
        render: (value: string) => formatShortDate(value),
      },
      {
        title: "Start Reading",
        dataIndex: "startReading",
        key: "startReading",
        width: 130,
        align: "right",
        render: (value: number | null) => formatKwh(value),
      },
      {
        title: "End Reading",
        dataIndex: "endReading",
        key: "endReading",
        width: 130,
        align: "right",
        render: (value: number | null) => formatKwh(value),
      },
      {
        title: "Total kWh",
        dataIndex: "totalKwh",
        key: "totalKwh",
        width: 130,
        align: "right",
        render: (value: number) => formatKwh(value),
      },
      {
        title: "Days",
        dataIndex: "daysLogged",
        key: "daysLogged",
        width: 90,
        align: "right",
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status: string, record) => (
          <Tag color={statusColor(status, record.isHarvested)} className="!mr-0">
            {status || "Unknown"}
          </Tag>
        ),
      },
    ],
    []
  );

  useEffect(() => {
    let active = true;

    const loadRows = async () => {
      try {
        setIsLoading(true);
        const [
          { data: growRows, error: growError },
          { data: buildingRows, error: buildingError },
          { data: electricityRows, error: electricityError },
        ] = await Promise.all([
          supabase
            .from(GROWS_TABLE)
            .select("id, building_id, created_at, total_animals, status, is_harvested")
            .order("created_at", { ascending: false }),
          supabase.from(BUILDINGS_TABLE).select("id, name"),
          supabase.from(ELECTRICITY_TABLE).select("grow_id, date, day, meter_reading, consumption"),
        ]);

        if (!active) return;
        if (growError) throw growError;
        if (buildingError) throw buildingError;
        if (electricityError) throw electricityError;

        const buildings = ((buildingRows ?? []) as Array<{ id: number | null; name: string | null }>)
          .filter((building): building is { id: number; name: string | null } => building.id != null)
          .sort((a, b) => {
            const aName = a.name ?? `Building ${a.id}`;
            const bName = b.name ?? `Building ${b.id}`;
            return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
          });
        const totalKwhByGrowId = new Map<number, number>();
        let todayKwh = 0;
        const todayKey = dayjs().format("YYYY-MM-DD");
        const electricitySourceRows = (electricityRows ?? []) as ElectricitySourceRow[];
        electricitySourceRows.forEach((row) => {
          if (row.grow_id == null) return;
          const value = Number(row.consumption ?? 0);
          const safeValue = Number.isFinite(value) ? value : 0;
          totalKwhByGrowId.set(row.grow_id, (totalKwhByGrowId.get(row.grow_id) ?? 0) + safeValue);
          if (row.date === todayKey) todayKwh += safeValue;
        });
        const electricityRowsByGrowId = new Map<number, ElectricitySourceRow[]>();
        electricitySourceRows.forEach((row) => {
          if (row.grow_id == null) return;
          const growEntries = electricityRowsByGrowId.get(row.grow_id) ?? [];
          growEntries.push(row);
          electricityRowsByGrowId.set(row.grow_id, growEntries);
        });

        const latestGrowByBuildingId = new Map<number, {
          id: number;
          createdAt: string;
          totalBirds: number;
          status: string;
          isHarvested: boolean;
        }>();

        const growSourceRows = (growRows ?? []) as Array<{
          id: number | null;
          building_id: number | null;
          created_at: string | null;
          total_animals: number | null;
          status: string | null;
          is_harvested: boolean | null;
        }>;
        growSourceRows.forEach((row) => {
            if (row.id == null || row.building_id == null) return;
            if (latestGrowByBuildingId.has(row.building_id)) return;
            latestGrowByBuildingId.set(row.building_id, {
              id: Number(row.id),
              createdAt: String(row.created_at ?? ""),
              totalBirds: Math.max(0, Math.floor(Number(row.total_animals ?? 0))),
              status: String(row.status ?? "Ready"),
              isHarvested: row.is_harvested === true,
            });
          });

        const mapped = buildings.map<BuildingElectricityRow>((building) => {
          const latestGrow = latestGrowByBuildingId.get(building.id);
          const name = building.name ?? `Building ${building.id}`;
          return {
            key: String(building.id),
            id: building.id,
            name,
            latestGrowId: latestGrow?.id ?? null,
            buildingName: name,
            createdAt: latestGrow?.createdAt ?? "",
            totalBirds: latestGrow?.totalBirds ?? 0,
            totalKwh: latestGrow ? totalKwhByGrowId.get(latestGrow.id) ?? 0 : 0,
            status: latestGrow?.status ?? "Ready",
            isHarvested: latestGrow?.isHarvested ?? false,
          };
        });

        const buildingNameById = new Map(buildings.map((building) => [building.id, building.name ?? `Building ${building.id}`]));
        const mappedCycleRows = growSourceRows
          .filter((grow): grow is typeof grow & { id: number } => grow.id != null)
          .map<GrowCycleElectricityRow>((grow) => {
            const growId = Number(grow.id);
            const growEntries = (electricityRowsByGrowId.get(growId) ?? [])
              .filter((entry) => entry.meter_reading != null || entry.consumption != null)
              .sort((a, b) => {
                const daySort = Number(a.day ?? 0) - Number(b.day ?? 0);
                if (daySort !== 0) return daySort;
                return dayjs(a.date ?? "").valueOf() - dayjs(b.date ?? "").valueOf();
              });
            const readings = growEntries.filter((entry) => entry.meter_reading != null);
            const loadingReading = readings.find((entry) => Number(entry.day ?? -1) === 0);
            const startEntry = loadingReading ?? readings[0] ?? null;
            const endEntry = readings[readings.length - 1] ?? null;
            const startReading = startEntry?.meter_reading ?? null;
            const endReading = endEntry?.meter_reading ?? null;
            const calculatedKwh =
              startReading != null && endReading != null
                ? Math.max(0, Number(endReading) - Number(startReading))
                : totalKwhByGrowId.get(growId) ?? 0;

            return {
              key: String(growId),
              growId,
              buildingId: grow.building_id,
              buildingName: grow.building_id == null ? "Unknown Building" : buildingNameById.get(grow.building_id) ?? `Building ${grow.building_id}`,
              createdAt: String(grow.created_at ?? ""),
              endDate: String(endEntry?.date ?? ""),
              totalBirds: Math.max(0, Math.floor(Number(grow.total_animals ?? 0))),
              startReading,
              endReading,
              totalKwh: calculatedKwh,
              daysLogged: growEntries.length,
              status: String(grow.status ?? "Ready"),
              isHarvested: grow.is_harvested === true,
            };
          });

        setRows(mapped);
        setCycleRows(mappedCycleRows);
        setSummary({ buildings: mapped.length, grows: (growRows ?? []).length, todayKwh });
      } catch (error) {
        console.error("Failed to load grow statuses:", error);
        setRows([]);
        setCycleRows([]);
        setSummary({ buildings: 0, grows: 0, todayKwh: 0 });
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const handleExportCyclePdf = () => {
    if (cycleRows.length === 0) {
      setToastMessage("No grow-cycle electricity data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingCyclePdf(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const generatedAt = dayjs();
      const totalKwh = cycleRows.reduce((sum, row) => sum + row.totalKwh, 0);
      const totalDays = cycleRows.reduce((sum, row) => sum + row.daysLogged, 0);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("Electricity Consumption per Broiler Grow Cycle", 14, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 24);
      doc.text(`Grow Cycles: ${cycleRows.length.toLocaleString()}`, 14, 30);
      doc.text(`Total kWh: ${formatKwh(totalKwh)}`, 118, 24);
      doc.text(`Logged Days: ${totalDays.toLocaleString()}`, 118, 30);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.6);
      doc.line(14, 35, 283, 35);

      autoTable(doc, {
        startY: 41,
        theme: "grid",
        head: [["Building", "Grow", "Start Date", "End Date", "Start Reading", "End Reading", "Total kWh", "Days", "Status"]],
        body: cycleRows.map((row) => [
          row.buildingName,
          `#${row.growId}`,
          formatShortDate(row.createdAt),
          formatShortDate(row.endDate),
          formatKwh(row.startReading),
          formatKwh(row.endReading),
          formatKwh(row.totalKwh),
          row.daysLogged.toLocaleString(),
          row.status || "Unknown",
        ]),
        headStyles: {
          fillColor: [0, 136, 34],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [210, 210, 210],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 34 },
          1: { cellWidth: 18, halign: "center" },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 31, halign: "right" },
          5: { cellWidth: 31, halign: "right" },
          6: { cellWidth: 31, halign: "right" },
          7: { cellWidth: 18, halign: "right" },
          8: { cellWidth: 24 },
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(`Page ${data.pageNumber}`, 283, 200, { align: "right" });
        },
      });

      const pdfUrl = doc.output("bloburl");
      const pdfWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!pdfWindow) {
        setToastMessage("Unable to open PDF preview. Please allow pop-ups and try again.");
        setIsToastOpen(true);
        return;
      }

      setToastMessage("PDF preview opened.");
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to export PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingCyclePdf(false);
    }
  };

  const electricityMenuCards = [
    {
      title: "Daily Electricity Consumption Monitoring",
      subtitle: "Broiler Farm",
      description: "Record and review daily building kWh readings.",
      icon: <MdOutlineBolt size={30} />,
      accent: "#008822",
      stat: `${summary.todayKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh today`,
      path: "/electricity-consumption/daily",
    },
    {
      title: "Electricity Consumption per Broiler Grow Cycle",
      subtitle: "Cycle summary",
      description: "Grow-cycle comparison and analytics.",
      icon: <MdOutlineConstruction size={30} />,
      accent: "#f59e0b",
      stat: `${cycleRows.length.toLocaleString()} grow cycles`,
      path: "/electricity-consumption/grow-cycle",
    },
  ];

  const renderHeader = (title: string) => (
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
          {title}
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
  );

  if (pageMode === "menu") {
    return (
      <Layout className="min-h-screen bg-slate-100">
        {renderHeader("Electricity Consumption")}
        <Content className="px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto w-full max-w-[420px] md:max-w-5xl">
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-5 text-white md:px-6 md:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                    Electricity Consumption
                  </div>
                  <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Choose a monitoring type</div>
                  <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
                    Select daily building readings or grow-cycle electricity analysis.
                  </div>
                </div>
                <Button
                  icon={<MdOutlinePictureAsPdf size={17} />}
                  className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                  onClick={() => navigate("/reports/electricity-consumption")}
                >
                  Report
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Buildings {summary.buildings.toLocaleString()}</div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grows {summary.grows.toLocaleString()}</div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Today {summary.todayKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {electricityMenuCards.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: card.accent }}
                  onClick={() => navigate(card.path)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Electricity
                      </div>
                      <div className="mt-3 text-xl font-bold leading-tight md:text-2xl" style={{ color: card.accent }}>
                        {card.title}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{card.subtitle}</div>
                      <div className="mt-2 text-sm text-slate-500">{card.description}</div>
                    </div>
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#ffda8a] text-slate-900">
                      {card.icon}
                    </div>
                  </div>
                  <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div>
                    <div className="mt-1 text-base font-bold text-slate-950">{card.stat}</div>
                  </div>
                  <div className="mt-3 text-right text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: card.accent }}>
                    Open
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Content>
      </Layout>
    );
  }

  if (pageMode === "grow-cycle") {
    return (
      <Layout className="min-h-screen bg-slate-100">
        {renderHeader("Electricity Consumption")}
        <Content className="px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto w-full max-w-[420px] md:max-w-6xl">
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-5 text-white md:px-6 md:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                    Electricity Consumption
                  </div>
                  <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">
                    Electricity Consumption per Broiler Grow Cycle
                  </div>
                  <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
                    Summary of start reading, end reading, and total kWh per grow.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    icon={<MdOutlinePictureAsPdf size={17} />}
                    className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                    onClick={handleExportCyclePdf}
                    loading={isExportingCyclePdf}
                  >
                    Export PDF
                  </Button>
                  <Button
                    className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                    onClick={() => navigate("/electricity-consumption/daily")}
                  >
                    Daily Monitoring
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grow Cycles {cycleRows.length.toLocaleString()}</div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Total {formatKwh(cycleRows.reduce((sum, row) => sum + row.totalKwh, 0))} kWh
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Logged {cycleRows.reduce((sum, row) => sum + row.daysLogged, 0).toLocaleString()} days
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Grow Cycle Summary</div>
              </div>
              <div className="mb-2 text-xs text-slate-500">
                Total kWh uses end meter reading minus start meter reading, with saved daily kWh as fallback when readings are incomplete.
              </div>
              {isMobile ? (
                <div className="space-y-2">
                  {mobilePagedCycleRows.map((record) => (
                    <button
                      key={record.key}
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                      onClick={() => navigate(`/electricity-consumption/grow/${record.growId}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500">{record.buildingName}</div>
                          <div className="font-semibold text-slate-800">Grow #{record.growId}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {formatShortDate(record.createdAt)} to {formatShortDate(record.endDate)}
                          </div>
                        </div>
                        <Tag color={statusColor(record.status, record.isHarvested)} className="!mr-0">
                          {record.status || "Unknown"}
                        </Tag>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <div><span className="text-slate-500">Start:</span> {formatKwh(record.startReading)}</div>
                        <div><span className="text-slate-500">End:</span> {formatKwh(record.endReading)}</div>
                        <div><span className="text-slate-500">Total kWh:</span> {formatKwh(record.totalKwh)}</div>
                        <div><span className="text-slate-500">Days:</span> {record.daysLogged.toLocaleString()}</div>
                      </div>
                      <div className="mt-2 text-right text-[11px] font-medium text-emerald-700">View daily records</div>
                    </button>
                  ))}
                  <div className="pt-1">
                    <Pagination
                      current={mobilePage}
                      pageSize={mobilePageSize}
                      total={cycleRows.length}
                      size="small"
                      showSizeChanger={cycleRows.length > 5}
                      pageSizeOptions={["5", "10", "20"]}
                      onChange={(page, pageSize) => {
                        setMobilePage(page);
                        setMobilePageSize(pageSize);
                      }}
                      showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                    />
                  </div>
                </div>
              ) : (
                <Table<GrowCycleElectricityRow>
                  size="small"
                  rowKey="key"
                  columns={cycleColumns}
                  dataSource={cycleRows}
                  loading={isLoading}
                  pagination={{
                    pageSize: 8,
                    showSizeChanger: cycleRows.length > 8,
                    pageSizeOptions: ["8", "15", "30"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} grow cycles`,
                  }}
                  scroll={{ x: 1120 }}
                  onRow={(record) => ({
                    onClick: () => navigate(`/electricity-consumption/grow/${record.growId}`),
                    title: "Click to view daily electricity records",
                    className: "cursor-pointer hover:!bg-emerald-50/60",
                  })}
                />
              )}
            </div>
          </div>
        </Content>
        <NotificationToast
          open={isToastOpen}
          message={toastMessage}
          onClose={() => setIsToastOpen(false)}
          durationMs={3000}
        />
      </Layout>
    );
  }

  return (
    <Layout className="min-h-screen bg-slate-100">
      {renderHeader("Electricity Consumption")}

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-6xl">
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white md:mb-5 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                  Electricity Consumption
                </div>
                <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Daily Electricity Consumption Monitoring</div>
                <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
                  Select a building to review daily electricity consumption records.
                </div>
              </div>
              <Button
                className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                onClick={() => navigate("/reports/electricity-consumption")}
              >
                Report
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Buildings {summary.buildings.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grows {summary.grows.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                Today {summary.todayKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Building List</div>
              </div>
              <div className="mb-2 text-xs text-slate-500">All buildings currently available in the system.</div>
              {isMobile ? (
                <div className="space-y-2">
                  {mobilePagedRows.map((record) => (
                    <button
                      key={record.key}
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                      onClick={() => navigate(`/electricity-consumption/building/${record.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500">Building</div>
                          <div className="font-semibold text-slate-800">{record.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Latest Grow: {record.latestGrowId == null ? "-" : `#${record.latestGrowId}`}
                          </div>
                        </div>
                        <Tag color={statusColor(record.status, record.isHarvested)} className="!mr-0">
                          {record.status || "Unknown"}
                        </Tag>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <div><span className="text-slate-500">Start:</span> {formatDate(record.createdAt)}</div>
                        <div><span className="text-slate-500">Birds:</span> {record.totalBirds.toLocaleString()}</div>
                        <div><span className="text-slate-500">Total kWh:</span> {record.totalKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      </div>
                      <div className="mt-2 text-right text-[11px] font-medium text-emerald-700">Tap to view</div>
                    </button>
                  ))}
                  <div className="pt-1">
                    <Pagination
                      current={mobilePage}
                      pageSize={mobilePageSize}
                      total={rows.length}
                      size="small"
                      showSizeChanger={rows.length > 5}
                      pageSizeOptions={["5", "10", "20"]}
                      onChange={(page, pageSize) => {
                        setMobilePage(page);
                        setMobilePageSize(pageSize);
                      }}
                      showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                    />
                  </div>
                </div>
              ) : (
                <Table<BuildingElectricityRow>
                  size="small"
                  rowKey="key"
                  columns={columns}
                  dataSource={rows}
                  loading={isLoading}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: rows.length > 5,
                    pageSizeOptions: ["5", "10", "20"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} buildings`,
                  }}
                  scroll={{ x: 720 }}
                  onRow={(record) => ({
                    onClick: () => navigate(`/electricity-consumption/building/${record.id}`),
                    title: "Click to view electricity consumption",
                    className: "cursor-pointer hover:!bg-emerald-50/60",
                  })}
                />
              )}
            </div>
          </div>
        </div>
      </Content>
      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        onClose={() => setIsToastOpen(false)}
        durationMs={3000}
      />
    </Layout>
  );
}
