import { useEffect, useMemo, useState } from "react";
import { Layout, Button, Divider, Grid, Typography, Select, DatePicker, Card, Statistic, Row, Col, Table, Tag } from "antd";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;

const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";

type BuildingOption = {
  id: number;
  name: string;
};

type HarvestedGrow = {
  id: number;
  building_id: number;
  created_at: string;
  total_animals: number;
  status: string;
  is_harvested: boolean;
};

type ReportRow = {
  growId: number;
  buildingName: string;
  createdAt: string;
  totalBirds: number;
  status: string;
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}

function toNonNegativeInt(value: unknown): number {
  return Math.max(0, Math.floor(Number(value ?? 0)));
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
      <div className="mt-3 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

export default function BuildingHarvestedReportPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [isLoading, setIsLoading] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handlePdfClick = () => {
    if (reportRows.length === 0) {
      setToastMessage("No harvest report data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingPdf(true);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const generatedAt = dayjs();
      const fileBuildingName = selectedBuildingName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const fileName = `${fileBuildingName || "harvest-report"}_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Harvested Grows Report", 14, 18);

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
      doc.text(`Harvested Grows: ${summary.totalGrows.toLocaleString()}`, 14, 57);
      doc.text(`Birds Harvested: ${summary.totalBirds.toLocaleString()}`, 72, 57);
      doc.text(`Average per Grow: ${Math.round(summary.avgBirdsPerGrow).toLocaleString()}`, 14, 63);
      doc.text(`Latest Harvest: ${latestHarvestDate}`, 72, 63);

      autoTable(doc, {
        startY: 70,
        theme: "grid",
        headStyles: {
          fillColor: [0, 136, 34],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 55 },
          2: { cellWidth: 42 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
        },
        head: [[
          "Grow ID",
          "Building",
          "Created Date",
          "Total Birds",
          "Status",
        ]],
        body: reportRows.map((row) => [
          `#${row.growId}`,
          row.buildingName,
          dayjs(row.createdAt).format("MMM D, YYYY"),
          row.totalBirds.toLocaleString(),
          row.status,
        ]),
        foot: [[
          "",
          "Totals",
          "",
          summary.totalBirds.toLocaleString(),
          `${summary.totalGrows} grows`,
        ]],
        footStyles: {
          fillColor: [239, 239, 239],
          textColor: [15, 23, 42],
          fontStyle: "bold",
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

      setToastMessage(`PDF preview opened: ${fileName}`);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Failed to generate PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Load buildings on mount
  useEffect(() => {
    const loadBuildings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from(BUILDINGS_TABLE)
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;
        const buildingList = (data ?? []) as { id: number; name: string | null }[];
        setBuildings(
          buildingList.map((b) => ({
            id: b.id,
            name: b.name ?? `Building ${b.id}`,
          }))
        );
        if (buildingList.length > 0) {
          setSelectedBuildingId(buildingList[0].id);
        }
      } catch (error) {
        setToastMessage(`Failed to load buildings: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };
    void loadBuildings();
  }, []);

  // Load harvested grows report when building or date range changes
  useEffect(() => {
    const loadReport = async () => {
      if (!selectedBuildingId) {
        setReportRows([]);
        return;
      }

      setIsLoading(true);
      try {
        // Build query for harvested grows
        let query = supabase
          .from(GROWS_TABLE)
          .select("id, building_id, created_at, total_animals, status, is_harvested")
          .eq("building_id", selectedBuildingId)
          .eq("status", "Harvested")
          .eq("is_harvested", true);

        // Apply date range filter if provided (using created_at only)
        if (dateRange && dateRange[0] && dateRange[1]) {
          const startDate = dateRange[0].startOf("day").toISOString();
          const endDate = dateRange[1].endOf("day").toISOString();
          query = query.gte("created_at", startDate).lte("created_at", endDate);
        }

        const { data: growRows, error: growError } = await query.order("created_at", { ascending: false });

        if (growError) throw growError;
        
        const harvestedGrows = (growRows ?? []) as HarvestedGrow[];
        
        if (harvestedGrows.length === 0) {
          setReportRows([]);
          return;
        }

        const buildingName = buildings.find(b => b.id === selectedBuildingId)?.name ?? `Building ${selectedBuildingId}`;

        const nextRows = harvestedGrows.map<ReportRow>((grow) => ({
          growId: grow.id,
          buildingName: buildingName,
          createdAt: grow.created_at,
          totalBirds: toNonNegativeInt(grow.total_animals),
          status: "Harvested",
        }));

        setReportRows(nextRows);
      } catch (error) {
        setReportRows([]);
        setToastMessage(`Failed to load report: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadReport();
  }, [selectedBuildingId, dateRange, buildings]);

  const summary = useMemo(() => {
    const totalGrows = reportRows.length;
    const totalBirds = reportRows.reduce((sum, row) => sum + row.totalBirds, 0);
    
    // Group by month for additional insights
    const byMonth = reportRows.reduce<Record<string, { count: number; birds: number }>>((acc, row) => {
      const month = dayjs(row.createdAt).format("YYYY-MM");
      if (!acc[month]) {
        acc[month] = { count: 0, birds: 0 };
      }
      acc[month].count += 1;
      acc[month].birds += row.totalBirds;
      return acc;
    }, {});

    const months = Object.keys(byMonth).sort();
    const avgBirdsPerGrow = totalGrows > 0 ? totalBirds / totalGrows : 0;

    return {
      totalGrows,
      totalBirds,
      avgBirdsPerGrow,
      months,
      byMonth,
    };
  }, [reportRows]);

  const buildingOptions = useMemo(
    () => buildings.map((b) => ({ value: b.id, label: b.name })),
    [buildings]
  );

  const selectedBuildingName = useMemo(
    () =>
      buildings.find((building) => building.id === selectedBuildingId)?.name ??
      (selectedBuildingId ? `Building ${selectedBuildingId}` : "All buildings"),
    [buildings, selectedBuildingId]
  );

  const dateRangeLabel = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return "All created dates";
    return `${dateRange[0].format("MMM D, YYYY")} - ${dateRange[1].format("MMM D, YYYY")}`;
  }, [dateRange]);

  const latestHarvestDate = useMemo(() => {
    if (reportRows.length === 0) return "No harvest records";
    return dayjs(reportRows[0].createdAt).format("MMMM D, YYYY");
  }, [reportRows]);

  const columns = [
    {
      title: "Grow ID",
      dataIndex: "growId",
      key: "growId",
      render: (id: number) => <span className="font-semibold text-emerald-700">#{id}</span>,
      sorter: (a: ReportRow, b: ReportRow) => a.growId - b.growId,
    },
    {
      title: "Created Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => dayjs(date).format("MMM D, YYYY"),
      sorter: (a: ReportRow, b: ReportRow) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: "descend" as const,
    },
    {
      title: "Total Birds",
      dataIndex: "totalBirds",
      key: "totalBirds",
      render: (val: number) => val.toLocaleString(),
      sorter: (a: ReportRow, b: ReportRow) => a.totalBirds - b.totalBirds,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color="orange" className="font-medium">
          {status}
        </Tag>
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
                Harvest Report
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Analytics</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Harvested Grows Report
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
            onClick={handleSignOut}
            aria-label="Sign out"
          />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-4 py-4" : "px-8 py-6"}>
        <div className="mx-auto w-full max-w-7xl">
          <div className={isMobile ? "space-y-4" : "space-y-6"}>
            <div
              className={[
                "overflow-hidden rounded-2xl border shadow-sm",
                isMobile ? "border-emerald-100" : "border-emerald-100",
              ].join(" ")}
            >
              <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-5 py-5 text-white md:px-7 md:py-6">
                <div className={isMobile ? "space-y-4" : "grid grid-cols-12 gap-6 items-end"}>
                  <div className={isMobile ? "" : "col-span-7"}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                      Harvest Analytics
                    </div>
                    <div className="mt-2 text-2xl font-bold leading-tight md:text-3xl">
                      Harvested Grows Report
                    </div>
                    <div className="mt-2 max-w-2xl text-sm text-emerald-50/90 md:text-base">
                      Review harvested batches by building and date range with a cleaner operational summary.
                    </div>
                  </div>
                  <div className={isMobile ? "grid grid-cols-2 gap-3" : "col-span-5 grid grid-cols-2 gap-3"}>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Building</div>
                      <div className="mt-1 text-sm font-semibold text-white md:text-base">{selectedBuildingName}</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">Latest Harvest</div>
                      <div className="mt-1 text-sm font-semibold text-white md:text-base">{latestHarvestDate}</div>
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
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created Date Range</div>
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
                              setDateRange(
                                currentEnd.isBefore(startDate, "day")
                                  ? [startDate, startDate]
                                  : [startDate, currentEnd]
                              );
                            }}
                            disabledDate={(current) =>
                              !!dateRange?.[1] && current.isAfter(dateRange[1], "day")
                            }
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
                              setDateRange(
                                endDate.isBefore(currentStart, "day")
                                  ? [currentStart, currentStart]
                                  : [currentStart, endDate]
                              );
                            }}
                            disabledDate={(current) =>
                              !!dateRange?.[0] && current.isBefore(dateRange[0], "day")
                            }
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
                <Card
                  className="!rounded-sm !border !border-slate-200 shadow-sm"
                  styles={{ body: { padding: isMobile ? 8 : 16 } }}
                >
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500" : "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"}>
                    Harvested Grows
                  </div>
                  <Statistic
                    value={summary.totalGrows}
                    valueStyle={{ color: "#0f172a", fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
              <Col xs={8} sm={12} lg={8}>
                <Card
                  className="!rounded-sm !border !border-emerald-100 shadow-sm"
                  styles={{ body: { padding: isMobile ? 8 : 16 } }}
                >
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700" : "text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"}>
                    Overall Birds Harvested
                  </div>
                  <Statistic
                    value={summary.totalBirds}
                    groupSeparator=","
                    valueStyle={{ color: BRAND, fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
              <Col xs={8} sm={12} lg={8}>
                <Card
                  className="!rounded-sm !border !border-amber-100 shadow-sm"
                  styles={{ body: { padding: isMobile ? 8 : 16 } }}
                >
                  <div className={isMobile ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700" : "text-xs font-semibold uppercase tracking-[0.16em] text-amber-700"}>
                    Average per Grow
                  </div>
                  <Statistic
                    value={summary.avgBirdsPerGrow}
                    precision={0}
                    groupSeparator=","
                    valueStyle={{ color: "#92400e", fontSize: isMobile ? 16 : 28, fontWeight: 700, lineHeight: 1.05 }}
                  />
                </Card>
              </Col>
            </Row>

            {reportRows.length > 0 && !isMobile && summary.months.length > 0 && (
              <Card
                className="!rounded-sm !border !border-slate-200 shadow-sm"
                styles={{ body: { padding: 12 } }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Trend Snapshot
                    </div>
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
                        {dayjs(month).format("MMMM YYYY")}
                      </div>
                      <div className="mt-1 flex items-end justify-between">
                        <div>
                          <div className="text-xl font-bold leading-none text-slate-900">
                            {summary.byMonth[month].count}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">entries</div>
                        </div>
                        <div className="rounded-md bg-white/90 px-2 py-1 text-[13px] font-semibold text-emerald-800 shadow-sm">
                          {summary.byMonth[month].birds.toLocaleString()} birds
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Report Table / Mobile Cards */}
          {isLoading && reportRows.length === 0 ? (
            <ChickenState title="Loading report..." subtitle="Fetching harvested grows from your tables." fullScreen={false} />
          ) : reportRows.length === 0 ? (
            <ChickenState
              title="No harvested grows found"
              subtitle={
                selectedBuildingId
                  ? dateRange
                    ? "No harvested grows in this building for the selected date range."
                    : "No harvested grows found for this building. Try a different building or check status values."
                  : "Select a building to view the harvested grows report."
              }
              fullScreen={false}
            />
          ) : isMobile ? (
            <div className="mt-3 space-y-3">
              {reportRows.map((row) => (
                <Card
                  key={row.growId}
                  size="small"
                  className="!rounded-sm !border !border-slate-200 shadow-sm"
                  styles={{ body: { padding: 10 } }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Harvest Entry</div>
                      <span className="font-semibold text-emerald-700 text-[20px] leading-none">Grow #{row.growId}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{row.buildingName}</div>
                    </div>
                    <Tag color="orange" className="!rounded-full !px-2 !py-0 !text-[10px] !font-medium">Harvested</Tag>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <div className="text-slate-500 text-[9px] uppercase tracking-wide">Created Date</div>
                      <div className="font-medium text-[13px] leading-none text-slate-900 mt-1">{dayjs(row.createdAt).format("MMM D, YYYY")}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
                      <div className="text-emerald-700 text-[9px] uppercase tracking-wide">Total Birds</div>
                      <div className="font-bold text-emerald-800 text-[24px] leading-none mt-1">{row.totalBirds.toLocaleString()}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card
              className="mt-6 !rounded-sm !border !border-slate-200 shadow-sm"
              styles={{ body: { padding: 0 } }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detailed Records</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Harvest Report Table</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Filter Span</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{dateRangeLabel}</div>
                </div>
              </div>
              <Table
                dataSource={reportRows}
                columns={columns}
                rowKey="growId"
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} harvested grows` }}
                className="shadow-none"
                loading={isLoading}
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
