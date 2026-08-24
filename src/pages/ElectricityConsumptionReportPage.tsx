import { Button, Card, Col, DatePicker, Divider, Grid, Layout, Row, Select, Statistic, Table, Typography } from "antd";
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
const ELECTRICITY_TABLE = import.meta.env.VITE_SUPABASE_ELECTRICITY_CONSUMPTION_TABLE ?? "ElectricityConsumption";
const { Header, Content } = Layout;
const { Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

type BuildingOption = {
  id: number;
  name: string;
};

type GrowRow = {
  id: number | null;
  building_id: number | null;
  created_at: string | null;
  total_animals: number | null;
  status: string | null;
};

type ElectricityReportRow = {
  key: string;
  id: number | null;
  growId: number;
  buildingName: string;
  growStartedAt: string;
  growStatus: string;
  totalBirds: number;
  date: string;
  day: number;
  meterReading: number | null;
  consumption: number | null;
  remarks: string;
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
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
        onError={(event) => {
          const target = event.currentTarget;
          target.onerror = null;
          target.src = "/img/chicken-bird.svg";
        }}
      />
      <div className="mt-3 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

export default function ElectricityConsumptionReportPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [isLoading, setIsLoading] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [reportRows, setReportRows] = useState<ElectricityReportRow[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadBuildings = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from(BUILDINGS_TABLE)
          .select("id, name")
          .order("name", { ascending: true });

        if (!active) return;
        if (error) throw error;

        const nextBuildings = ((data ?? []) as Array<{ id: number | null; name: string | null }>)
          .filter((building): building is { id: number; name: string | null } => building.id != null)
          .map((building) => ({
            id: building.id,
            name: building.name ?? `Building ${building.id}`,
          }));

        setBuildings(nextBuildings);
        setSelectedBuildingId((current) => current ?? nextBuildings[0]?.id ?? null);
      } catch (error) {
        setToastMessage(`Failed to load buildings: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadBuildings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      if (!selectedBuildingId) {
        setReportRows([]);
        return;
      }

      try {
        setIsLoading(true);
        const { data: growRows, error: growError } = await supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, total_animals, status")
          .eq("building_id", selectedBuildingId)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (growError) throw growError;

        const growMap = new Map<number, GrowRow>();
        const growIds = ((growRows ?? []) as GrowRow[])
          .map((grow) => {
            if (grow.id == null) return null;
            growMap.set(grow.id, grow);
            return grow.id;
          })
          .filter((id): id is number => id != null);

        if (growIds.length === 0) {
          setReportRows([]);
          return;
        }

        let electricityQuery = supabase
          .from(ELECTRICITY_TABLE)
          .select("id, grow_id, date, day, remarks, meter_reading, consumption")
          .in("grow_id", growIds);

        if (dateRange?.[0] && dateRange?.[1]) {
          electricityQuery = electricityQuery
            .gte("date", dateRange[0].startOf("day").format("YYYY-MM-DD"))
            .lte("date", dateRange[1].endOf("day").format("YYYY-MM-DD"));
        }

        const { data: electricityRows, error: electricityError } = await electricityQuery
          .order("date", { ascending: false })
          .order("day", { ascending: false });

        if (!active) return;
        if (electricityError) throw electricityError;

        const buildingName =
          buildings.find((building) => building.id === selectedBuildingId)?.name ?? `Building ${selectedBuildingId}`;

        const rows = ((electricityRows ?? []) as Array<{
          id: number | null;
          grow_id: number | null;
          date: string | null;
          day: number | null;
          remarks: string | null;
          meter_reading: number | null;
          consumption: number | null;
        }>)
          .filter((row) => row.grow_id != null)
          .map<ElectricityReportRow>((row, index) => {
            const grow = growMap.get(Number(row.grow_id));
            return {
              key: `${row.id ?? "row"}-${index}`,
              id: row.id,
              growId: Number(row.grow_id),
              buildingName,
              growStartedAt: String(grow?.created_at ?? ""),
              growStatus: String(grow?.status ?? "Unknown"),
              totalBirds: Math.max(0, Math.floor(Number(grow?.total_animals ?? 0))),
              date: String(row.date ?? ""),
              day: Math.max(0, Math.floor(Number(row.day ?? 0))),
              meterReading: toNumberOrNull(row.meter_reading),
              consumption: toNumberOrNull(row.consumption),
              remarks: String(row.remarks ?? ""),
            };
          });

        setReportRows(rows);
      } catch (error) {
        setReportRows([]);
        setToastMessage(`Failed to load electricity report: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadReport();
    return () => {
      active = false;
    };
  }, [buildings, dateRange, selectedBuildingId]);

  const selectedBuildingName = useMemo(
    () =>
      buildings.find((building) => building.id === selectedBuildingId)?.name ??
      (selectedBuildingId ? `Building ${selectedBuildingId}` : "All buildings"),
    [buildings, selectedBuildingId]
  );

  const buildingOptions = useMemo(
    () => buildings.map((building) => ({ value: building.id, label: building.name })),
    [buildings]
  );

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.[0] || !dateRange?.[1]) return "All reading dates";
    return `${dateRange[0].format("MMM D, YYYY")} - ${dateRange[1].format("MMM D, YYYY")}`;
  }, [dateRange]);

  const applyQuickRange = (range: "today" | "week" | "month" | "all") => {
    const today = dayjs();
    if (range === "all") {
      setDateRange(null);
      return;
    }
    if (range === "today") {
      setDateRange([today.startOf("day"), today.endOf("day")]);
      return;
    }
    if (range === "week") {
      setDateRange([today.startOf("week"), today.endOf("week")]);
      return;
    }
    setDateRange([today.startOf("month"), today.endOf("month")]);
  };

  const summary = useMemo(() => {
    const totalRecords = reportRows.length;
    const totalKwh = reportRows.reduce((sum, row) => sum + (row.consumption ?? 0), 0);
    const latestDate = reportRows[0]?.date ? dayjs(reportRows[0].date).format("MMMM D, YYYY") : "No readings";
    const averageKwh = totalRecords > 0 ? totalKwh / totalRecords : 0;
    const byMonth = reportRows.reduce<Record<string, { count: number; kwh: number }>>((acc, row) => {
      const key = row.date ? dayjs(row.date).format("YYYY-MM") : "Unknown";
      acc[key] = acc[key] ?? { count: 0, kwh: 0 };
      acc[key].count += 1;
      acc[key].kwh += row.consumption ?? 0;
      return acc;
    }, {});
    const months = Object.keys(byMonth).sort();

    return { totalRecords, totalKwh, averageKwh, latestDate, byMonth, months };
  }, [reportRows]);

  const handlePdfClick = () => {
    if (reportRows.length === 0) {
      setToastMessage("No electricity report data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const generatedAt = dayjs();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Electricity Consumption Report", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Building: ${selectedBuildingName}`, 14, 26);
      doc.text(`Coverage: ${dateRangeLabel}`, 14, 32);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 38);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.7);
      doc.line(14, 42, 196, 42);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Summary", 14, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`Readings: ${summary.totalRecords.toLocaleString()}`, 14, 57);
      doc.text(`Total kWh: ${formatNumber(summary.totalKwh, 2)}`, 62, 57);
      doc.text(`Average kWh: ${formatNumber(summary.averageKwh, 2)}`, 118, 57);

      autoTable(doc, {
        startY: 66,
        theme: "grid",
        head: [["Date", "Grow", "Day", "Meter Reading", "Consumption", "Remarks"]],
        body: reportRows.map((row) => [
          dayjs(row.date).format("MMM D, YYYY"),
          `#${row.growId}`,
          `Day ${row.day}`,
          formatNumber(row.meterReading, 2),
          formatNumber(row.consumption, 2),
          row.remarks.trim() || "-",
        ]),
        foot: [["", "", "", "Total", formatNumber(summary.totalKwh, 2), ""]],
        headStyles: {
          fillColor: [0, 136, 34],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [239, 239, 239],
          textColor: [15, 23, 42],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 30, halign: "right" },
          5: { cellWidth: 50 },
        },
        didDrawPage: (data) => {
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(`Page ${data.pageNumber}`, 196, 287, { align: "right" });
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
      setToastMessage(`Failed to generate PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const columns: ColumnsType<ElectricityReportRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 150,
      render: (date: string) => (dayjs(date).isValid() ? dayjs(date).format("MMM D, YYYY") : "-"),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      defaultSortOrder: "descend",
    },
    {
      title: "Grow",
      dataIndex: "growId",
      key: "growId",
      width: 100,
      render: (growId: number) => `#${growId}`,
      sorter: (a, b) => a.growId - b.growId,
    },
    {
      title: "Day",
      dataIndex: "day",
      key: "day",
      width: 90,
      render: (day: number) => `Day ${day}`,
      sorter: (a, b) => a.day - b.day,
    },
    {
      title: "Meter Reading",
      dataIndex: "meterReading",
      key: "meterReading",
      align: "right",
      width: 150,
      render: (value: number | null) => formatNumber(value, 2),
      sorter: (a, b) => (a.meterReading ?? 0) - (b.meterReading ?? 0),
    },
    {
      title: "Consumption",
      dataIndex: "consumption",
      key: "consumption",
      align: "right",
      width: 140,
      render: (value: number | null) => `${formatNumber(value, 2)} kWh`,
      sorter: (a, b) => (a.consumption ?? 0) - (b.consumption ?? 0),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (value: string) => value.trim() || "-",
    },
    {
      title: "",
      key: "action",
      width: 170,
      render: (_: unknown, record: ElectricityReportRow) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/electricity-consumption/grow/${record.growId}`);
          }}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          View consumption history
        </button>
      ),
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
          {isMobile ? (
            <>
              <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
              <Title level={4} className="!m-0 !text-base !text-white">
                Electricity Report
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Analytics</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Electricity Consumption Report
              </Title>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={isMobile ? 21 : 23} />}
            className="!text-white hover:!text-white/90"
            onClick={handlePdfClick}
            aria-label="Export PDF"
            loading={isExportingPdf}
          />
          <Button
            type="text"
            icon={<FaSignOutAlt size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => void signOutAndRedirect(navigate)}
            aria-label="Sign out"
          />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-4 py-4" : "px-8 py-6"}>
        <div className="mx-auto w-full max-w-7xl">
          <div className={isMobile ? "space-y-4" : "space-y-6"}>
            <div className="overflow-hidden rounded-2xl border border-emerald-100 shadow-sm">
              <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-5 py-5 text-white md:px-7 md:py-6">
                <div className={isMobile ? "space-y-4" : "grid grid-cols-12 gap-6 items-end"}>
                  <div className={isMobile ? "" : "col-span-7"}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                      Electricity Analytics
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight md:text-3xl">
                      Electricity Consumption Report
                    </div>
                    <div className="mt-2 max-w-2xl text-sm text-emerald-50/90 md:text-base">
                      Review kWh readings by building, grow, and date range with PDF export.
                    </div>
                  </div>
                  <div className={isMobile ? "grid grid-cols-2 gap-3" : "col-span-5 grid grid-cols-2 gap-3"}>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Building</div>
                      <div className="mt-1 text-sm font-semibold text-white md:text-base">{selectedBuildingName}</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Latest Reading</div>
                      <div className="mt-1 text-sm font-semibold text-white md:text-base">{summary.latestDate}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white px-4 py-4 md:px-6 md:py-5">
                <div className={isMobile ? "space-y-4" : "grid grid-cols-12 gap-4 items-end"}>
                  <div className={isMobile ? "space-y-4" : "col-span-9 grid grid-cols-2 gap-4"}>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Building</div>
                      <Select
                        className="!w-full"
                        size="large"
                        placeholder="Select a building"
                        value={selectedBuildingId ?? undefined}
                        options={buildingOptions}
                        onChange={(value) => setSelectedBuildingId(Number(value))}
                        loading={isLoading && buildings.length === 0}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reading Date Range</div>
                      {isMobile ? (
                        <div className="grid grid-cols-2 gap-2">
                          <DatePicker
                            className="!w-full"
                            size="middle"
                            styles={{ input: { fontSize: 16 } }}
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
                            disabledDate={(current) => !!dateRange?.[1] && current.isAfter(dateRange[1], "day")}
                          />
                          <DatePicker
                            className="!w-full"
                            size="middle"
                            styles={{ input: { fontSize: 16 } }}
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
                            disabledDate={(current) => !!dateRange?.[0] && current.isBefore(dateRange[0], "day")}
                          />
                        </div>
                      ) : (
                        <RangePicker
                          className="!w-full"
                          size="large"
                          value={dateRange}
                          onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
                          placeholder={["Start date", "End date"]}
                          allowClear
                        />
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          ["Today", "today"],
                          ["This Week", "week"],
                          ["This Month", "month"],
                          ["All", "all"],
                        ].map(([label, value]) => (
                          <Button
                            key={value}
                            size="small"
                            className="!rounded-full !border-emerald-100 !bg-emerald-50 !px-2.5 !text-[11px] !font-semibold !text-emerald-700 hover:!border-emerald-200 hover:!bg-emerald-100"
                            onClick={() => applyQuickRange(value as "today" | "week" | "month" | "all")}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={isMobile ? "flex justify-end" : "col-span-3 flex justify-end"}>
                    {dateRange ? (
                      <Button size="large" onClick={() => setDateRange(null)}>
                        Clear Dates
                      </Button>
                    ) : (
                      <div
                        className={[
                          "border border-slate-200 bg-slate-50 text-right",
                          isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3",
                        ].join(" ")}
                      >
                        <div className={isMobile ? "text-[9px] uppercase tracking-[0.12em] text-slate-500" : "text-[11px] uppercase tracking-[0.14em] text-slate-500"}>
                          Coverage
                        </div>
                        <div className={isMobile ? "mt-0.5 text-xs font-medium text-slate-700" : "mt-1 text-sm font-medium text-slate-700"}>
                          {dateRangeLabel}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Row gutter={isMobile ? [8, 8] : [16, 16]}>
              <Col xs={8} sm={12} lg={8}>
                <Card className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: isMobile ? 8 : 16 } }}>
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500" : "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"}>
                    Readings
                  </div>
                  <Statistic
                    value={summary.totalRecords}
                    valueStyle={{ color: "#0f172a", fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
              <Col xs={8} sm={12} lg={8}>
                <Card className="!rounded-sm !border !border-emerald-100 shadow-sm" styles={{ body: { padding: isMobile ? 8 : 16 } }}>
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700" : "text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"}>
                    Total kWh
                  </div>
                  <Statistic
                    value={summary.totalKwh}
                    precision={2}
                    groupSeparator=","
                    valueStyle={{ color: BRAND, fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
              <Col xs={8} sm={12} lg={8}>
                <Card className="!rounded-sm !border !border-amber-100 shadow-sm" styles={{ body: { padding: isMobile ? 8 : 16 } }}>
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700" : "text-xs font-semibold uppercase tracking-[0.16em] text-amber-700"}>
                    Avg kWh
                  </div>
                  <Statistic
                    value={summary.averageKwh}
                    precision={2}
                    groupSeparator=","
                    valueStyle={{ color: "#92400e", fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
            </Row>

            {reportRows.length > 0 && !isMobile && summary.months.length > 0 ? (
              <Card className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 12 } }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trend Snapshot</div>
                    <div className="mt-0.5 text-base font-bold text-slate-900">Monthly Breakdown</div>
                  </div>
                  <div className="text-[11px] text-slate-500">{dateRangeLabel}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.months.map((month) => (
                    <div
                      key={month}
                      className="w-[220px] rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-3 py-2.5"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        {month === "Unknown" ? month : dayjs(month).format("MMMM YYYY")}
                      </div>
                      <div className="mt-1 flex items-end justify-between">
                        <div>
                          <div className="text-xl font-bold leading-none text-slate-900">{summary.byMonth[month].count}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">readings</div>
                        </div>
                        <div className="rounded-md bg-white/90 px-2 py-1 text-[13px] font-semibold text-emerald-800 shadow-sm">
                          {formatNumber(summary.byMonth[month].kwh, 2)} kWh
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          {isLoading && reportRows.length === 0 ? (
            <ChickenState title="Loading report..." subtitle="Fetching electricity readings from your tables." fullScreen={false} />
          ) : reportRows.length === 0 ? (
            <ChickenState
              title="No electricity readings yet"
              subtitle={
                selectedBuildingId
                  ? dateRange
                    ? "No readings were saved for this building in the selected date range."
                    : "No electricity readings have been saved for this building yet."
                  : "Select a building to view the electricity report."
              }
              fullScreen={false}
            />
          ) : isMobile ? (
            <div className="mt-4 space-y-4">
              {reportRows.map((row) => (
                <Card key={row.key} size="small" className="!rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 12 } }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reading</div>
                      <div className="text-[20px] font-semibold leading-none text-emerald-700">{dayjs(row.date).format("MMM D, YYYY")}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">Grow #{row.growId} | Day {row.day}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">kWh</div>
                      <div className="text-[24px] font-bold leading-none text-slate-900">{formatNumber(row.consumption, 2)}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500">Meter</div>
                      <div className="mt-1 text-[13px] font-medium leading-none text-slate-900">{formatNumber(row.meterReading, 2)}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-emerald-700">Birds</div>
                      <div className="mt-1 text-[13px] font-bold leading-none text-emerald-800">{row.totalBirds.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Remarks: {row.remarks.trim() || "-"}</div>
                  <button
                    type="button"
                    onClick={() => navigate(`/electricity-consumption/grow/${row.growId}`)}
                    className="mt-2 block w-full text-right text-[11px] font-semibold text-emerald-700"
                  >
                    View consumption history
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-6 !rounded-sm !border !border-slate-200 shadow-sm" styles={{ body: { padding: 0 } }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detailed Records</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Electricity Consumption Report Table</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Filter Span</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{dateRangeLabel}</div>
                </div>
              </div>
              <Table<ElectricityReportRow>
                dataSource={reportRows}
                columns={columns}
                rowKey="key"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `${total} readings`,
                }}
                scroll={{ x: 920 }}
                loading={isLoading}
                onRow={(record) => ({
                  onClick: () => navigate(`/electricity-consumption/grow/${record.growId}`),
                  className: "cursor-pointer",
                })}
              />
            </Card>
          )}
        </div>
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
