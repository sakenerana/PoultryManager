import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { loadBodyWeightLogsByBuildingId } from "../controller/bodyWeightCrud";
import { resolveBodyWeightAverage } from "../utils/bodyWeight";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

dayjs.extend(utc);

const PRIMARY = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const NORMAL_DAILY_GAIN_BY_DAY: Record<number, number> = {
  0: 0,
  1: 0,
  2: 13,
  3: 17,
  4: 23,
  5: 27,
  6: 33,
  7: 38,
  8: 43,
  9: 48,
  10: 53,
  11: 58,
  12: 62,
  13: 67,
  14: 71,
  15: 75,
  16: 78,
  17: 82,
  18: 85,
  19: 90,
  20: 93,
  21: 97,
  22: 100,
  23: 91,
  24: 94,
  25: 96,
  26: 97,
  27: 99,
  28: 101,
  29: 103,
  30: 103,
};
const TARGET_WEIGHT_BY_DAY: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
  7: 175,
  8: 200,
  9: 230,
  10: 270,
  11: 315,
  12: 360,
  13: 410,
  14: 460,
  15: 520,
  16: 580,
  17: 640,
  18: 710,
  19: 780,
  20: 860,
  21: 940,
  22: 1020,
  23: 1100,
  24: 1180,
  25: 1260,
  26: 1340,
  27: 1420,
  28: 1500,
  29: 1590,
  30: 1680,
};

type HistoryRow = {
  date: string;
  dayNumber: number;
  avgWeight: number | null;
  sourceTime: string | null;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("error_description" in error && typeof error.error_description === "string") {
      return error.error_description;
    }
  }
  return "Unknown error";
};

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

export default function BuildingAvgWeightHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const selectedDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId)) {
        setHistoryRows([]);
        setBuildingName("");
        return;
      }

      try {
        setIsLoading(true);
        const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

        const [{ data: buildingData, error: buildingError }, { data: growRows, error: growsError }] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("name").eq("id", buildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id, created_at")
            .eq("building_id", buildingId)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (buildingError) throw buildingError;
        if (growsError) throw growsError;

        setBuildingName(typeof buildingData?.name === "string" ? buildingData.name : "");

        const growRow = ((growRows ?? []) as Array<{ id: number | null; created_at: string }>)[0];
        if (!growRow?.id) {
          setHistoryRows([]);
          return;
        }

        const bodyWeightLogs = await loadBodyWeightLogsByBuildingId(buildingId);
        const bodyWeightLogsUntilSelectedDate = bodyWeightLogs.filter(
          (row) =>
            row.growId === growRow.id &&
            dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
        );

        const bodyWeightLogsByDate = bodyWeightLogsUntilSelectedDate.reduce<Record<string, typeof bodyWeightLogs>>((acc, row) => {
          const dateKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(row);
          return acc;
        }, {});

        const startDate = dayjs.utc(growRow.created_at).startOf("day");
        const endDate = dayjs.utc(selectedDate, "YYYY-MM-DD").startOf("day");
        const nextRows: HistoryRow[] = [];

        for (
          let cursor = startDate;
          cursor.isBefore(endDate) || cursor.isSame(endDate, "day");
          cursor = cursor.add(1, "day")
        ) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const dayWeightRows = [...(bodyWeightLogsByDate[dateKey] ?? [])].sort(
            (a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf()
          );
          const latestWeightByCage: Record<string, number> = {};

          dayWeightRows.forEach((row) => {
            if (row.subbuildingId == null) return;
            const cageId = String(row.subbuildingId);
            if (latestWeightByCage[cageId] != null) return;
            const avgWeight = resolveBodyWeightAverage(row);
            if (avgWeight == null) return;
            latestWeightByCage[cageId] = avgWeight;
          });

          const avgWeightValues = Object.values(latestWeightByCage).filter((weight) => weight > 0);
          const avgWeight =
            avgWeightValues.length > 0
              ? avgWeightValues.reduce((sum, current) => sum + current, 0) / avgWeightValues.length
              : null;

          nextRows.push({
            date: dateKey,
            dayNumber: cursor.diff(startDate, "day"),
            avgWeight,
            sourceTime: dayWeightRows[0]?.createdAt ?? null,
          });
        }

        setHistoryRows(nextRows);
      } catch (error) {
        setHistoryRows([]);
        setToastMessage(`Failed to load avg weight history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistory();
  }, [id, selectedDate]);

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handlePdfClick = () => {
    if (historyRows.length === 0) {
      setToastMessage("No history data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const generatedAt = dayjs();
      const fileBuildingName = (buildingName || `building-${id ?? "unknown"}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const fileName = `${fileBuildingName}_avg-weight_${generatedAt.format("YYYY-MM-DD_HHmmss")}.pdf`;
      const reportBuildingName = buildingName || `Building ${id}`;
      const selectedDateLabel = dayjs(selectedDate).format("MMMM D, YYYY");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Avg Weight History", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(reportBuildingName, 14, 26);
      doc.text(`Selected Date: ${selectedDateLabel}`, 14, 32);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 38);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.7);
      doc.line(14, 42, 196, 42);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Summary", 14, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`Days Listed: ${historyRows.length}`, 14, 57);
      doc.text(`Recorded Days: ${recordedDays}`, 72, 57);
      doc.text(
        `Average: ${
          averageAcrossDays != null
            ? `${averageAcrossDays.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} g`
            : "-"
        }`,
        14,
        63
      );

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
          0: { cellWidth: 15 },
          1: { cellWidth: 30 },
          2: { cellWidth: 26 },
          3: { cellWidth: 24 },
          4: { cellWidth: 42 },
          5: { cellWidth: 43 },
        },
        head: [[
          "Day",
          "Date",
          "Avg Wt",
          "Normal Daily Gain (g/day)",
          "Target",
          "Status",
        ]],
        body: historyRows.map((row) => [
          String(row.dayNumber),
          dayjs(row.date).format("MMM D, YYYY"),
          row.avgWeight != null
            ? `${row.avgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} g`
            : "-",
          `${NORMAL_DAILY_GAIN_BY_DAY[row.dayNumber] ?? 0} g`,
          `${TARGET_WEIGHT_BY_DAY[row.dayNumber] ?? 0} g`,
          row.avgWeight != null ? "Recorded" : "No weight log",
        ]),
        foot: [[
          "",
          "Average",
          averageAcrossDays != null
            ? `${averageAcrossDays.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} g`
            : "-",
          "",
          `Up to ${selectedDateLabel}`,
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
    }
  };

  const handleHistoryRowClick = (date: string) => {
    if (!id) return;
    navigate(`/building-cage/${id}?date=${date}`);
  };

  const averageAcrossDays = useMemo(() => {
    const rowsWithWeight = historyRows.filter((row) => row.avgWeight != null);
    if (rowsWithWeight.length === 0) return null;
    return rowsWithWeight.reduce((sum, row) => sum + (row.avgWeight ?? 0), 0) / rowsWithWeight.length;
  }, [historyRows]);

  const recordedDays = useMemo(
    () => historyRows.filter((row) => row.avgWeight != null).length,
    [historyRows]
  );

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
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Building Metric</div>
            <Title level={4} className="!m-0 !text-white !text-base md:!text-lg">
              Avg Weight History
            </Title>
          </div>
        </div>
        <div className={["flex items-center", isMobile ? "gap-1" : "gap-2"].join(" ")}>
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={handlePdfClick}
            aria-label="PDF"
          />
          <Button
            type="text"
            icon={<FaSignOutAlt size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={handleSignOut}
          />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-8" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
        ) : historyRows.length === 0 ? (
          <ChickenState
            title="No history yet"
            subtitle={`No avg weight data found from day 0 up to ${dayjs(selectedDate).format("MMMM D, YYYY")}.`}
            fullScreen
          />
        ) : (
          <>
            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {buildingName || `Bldg ${id}`}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">Average Weight Daily History</div>
              <div className="mt-2 text-sm text-slate-600">
                Showing day 0 to {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">{historyRows.length}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recorded</span>
                  <span className="text-sm font-bold text-slate-900">{recordedDays}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {historyRows.map((row) => (
                <div
                  key={row.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleHistoryRowClick(row.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleHistoryRowClick(row.date);
                    }
                  }}
                  className="rounded-sm border border-emerald-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            row.avgWeight != null ? "bg-emerald-500" : "bg-slate-300",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <div className="text-sm font-semibold text-slate-900">Day {row.dayNumber}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{dayjs(row.date).format("MMMM D, YYYY")}</div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Target -{" "}
                        <span className="font-bold text-slate-700">
                          {`${TARGET_WEIGHT_BY_DAY[row.dayNumber] ?? 0} g`}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Normal Daily Gain (g/day) -{" "}
                        <span className="font-bold text-slate-700">
                          {`${NORMAL_DAILY_GAIN_BY_DAY[row.dayNumber] ?? 0} g`}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[132px] text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Avg Weight</div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">
                        {row.avgWeight != null
                          ? `${row.avgWeight.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} g`
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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
