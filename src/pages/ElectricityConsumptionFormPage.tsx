import { Button, Divider, Drawer, Grid, Input, InputNumber, Layout, Typography } from "antd";
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { FiCheck } from "react-icons/fi";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
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

type GrowInfo = {
  id: number;
  buildingId: number | null;
  buildingName: string;
  createdAt: string;
  status: string;
};

type ElectricityEntry = {
  id: number | null;
  date: string;
  day: number;
  meterReading: number | null;
  consumption: number | null;
  remarks: string;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

export default function ElectricityConsumptionFormPage() {
  const navigate = useNavigate();
  const { growId } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [growInfo, setGrowInfo] = useState<GrowInfo | null>(null);
  const [entries, setEntries] = useState<ElectricityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [activeEntry, setActiveEntry] = useState<ElectricityEntry | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const totalConsumption = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.consumption ?? 0), 0),
    [entries]
  );

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const parsedGrowId = Number(growId);
      if (!Number.isFinite(parsedGrowId)) {
        setGrowInfo(null);
        setEntries([]);
        return;
      }

      try {
        setIsLoading(true);
        const [{ data: growRow, error: growError }, { data: savedRows, error: savedError }] = await Promise.all([
          supabase
            .from(GROWS_TABLE)
            .select("id, building_id, created_at, status")
            .eq("id", parsedGrowId)
            .maybeSingle(),
          supabase
            .from(ELECTRICITY_TABLE)
            .select("id, date, day, remarks, meter_reading, consumption")
            .eq("grow_id", parsedGrowId)
            .order("day", { ascending: true }),
        ]);

        if (!active) return;
        if (growError) throw growError;
        if (savedError) throw savedError;
        if (!growRow?.id) {
          setGrowInfo(null);
          setEntries([]);
          return;
        }

        const buildingId = typeof growRow.building_id === "number" ? growRow.building_id : null;
        let buildingName = buildingId == null ? "Unassigned" : `Building ${buildingId}`;
        if (buildingId != null) {
          const { data: buildingRow, error: buildingError } = await supabase
            .from(BUILDINGS_TABLE)
            .select("name")
            .eq("id", buildingId)
            .maybeSingle();
          if (buildingError) throw buildingError;
          buildingName = typeof buildingRow?.name === "string" && buildingRow.name.trim() ? buildingRow.name : buildingName;
        }

        if (!active) return;
        const createdAt = String(growRow.created_at ?? "");
        const startDate = dayjs(createdAt).startOf("day");
        const today = dayjs().startOf("day");
        const daysListed = Math.max(0, today.diff(startDate, "day")) + 1;
        const savedByDay = new Map<number, {
          id: number | null;
          date: string | null;
          day: number | null;
          remarks: string | null;
          meter_reading: number | null;
          consumption: number | null;
        }>();

        ((savedRows ?? []) as Array<{
          id: number | null;
          date: string | null;
          day: number | null;
          remarks: string | null;
          meter_reading: number | null;
          consumption: number | null;
        }>).forEach((row) => {
          if (row.day == null) return;
          savedByDay.set(Number(row.day), row);
        });

        setGrowInfo({
          id: Number(growRow.id),
          buildingId,
          buildingName,
          createdAt,
          status: String(growRow.status ?? "Unknown"),
        });
        setEntries(
          Array.from({ length: daysListed }, (_, day) => {
            const saved = savedByDay.get(day);
            return {
              id: saved?.id ?? null,
              date: String(saved?.date ?? startDate.add(day, "day").format("YYYY-MM-DD")),
              day,
              meterReading: toNumberOrNull(saved?.meter_reading),
              consumption: toNumberOrNull(saved?.consumption),
              remarks: String(saved?.remarks ?? ""),
            };
          })
        );
      } catch (error) {
        setToastMessage(`Failed to load electricity consumption: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [growId]);

  const updateEntry = (day: number, patch: Partial<ElectricityEntry>) => {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.day !== day) return entry;
        const next = { ...entry, ...patch };
        if ("meterReading" in patch && !("consumption" in patch)) {
          const previous = current.find((item) => item.day === day - 1);
          if (patch.meterReading != null && previous?.meterReading != null) {
            next.consumption = Math.max(0, Number(patch.meterReading) - Number(previous.meterReading));
          }
        }
        return next;
      })
    );
  };

  const updateActiveEntry = (patch: Partial<ElectricityEntry>) => {
    setActiveEntry((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if ("meterReading" in patch && !("consumption" in patch)) {
        const previous = entries.find((item) => item.day === current.day - 1);
        if (patch.meterReading != null && previous?.meterReading != null) {
          next.consumption = Math.max(0, Number(patch.meterReading) - Number(previous.meterReading));
        }
      }
      return next;
    });
  };

  const handleSaveEntry = async (entry: ElectricityEntry) => {
    const parsedGrowId = Number(growId);
    if (!Number.isFinite(parsedGrowId)) return;

    try {
      setSavingDay(entry.day);
      const payload = {
        grow_id: parsedGrowId,
        date: entry.date,
        day: entry.day,
        meter_reading: entry.meterReading,
        consumption: entry.consumption,
        remarks: entry.remarks.trim() || null,
      };

      const { data, error } = entry.id
        ? await supabase.from(ELECTRICITY_TABLE).update(payload).eq("id", entry.id).select("id").single()
        : await supabase.from(ELECTRICITY_TABLE).insert([payload]).select("id").single();

      if (error) throw error;
      if (data?.id) updateEntry(entry.day, { id: Number(data.id) });
      updateEntry(entry.day, {
        id: data?.id ? Number(data.id) : entry.id,
        meterReading: entry.meterReading,
        consumption: entry.consumption,
        remarks: entry.remarks,
      });
      setActiveEntry(null);
      setToastMessage(`Saved electricity consumption for Day ${entry.day}.`);
      setIsToastOpen(true);
    } catch (error) {
      setToastMessage(`Save failed: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setSavingDay(null);
    }
  };

  const handleExportPdf = () => {
    if (!growInfo || entries.length === 0) {
      setToastMessage("No electricity consumption data available to export.");
      setIsToastOpen(true);
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const generatedAt = dayjs();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Electricity Consumption Daily History", 14, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Building: ${growInfo.buildingName}`, 14, 24);
      doc.text(`Grow: #${growInfo.id} (${growInfo.status})`, 14, 30);
      doc.text(`Started: ${dayjs(growInfo.createdAt).format("MMMM D, YYYY")}`, 14, 36);
      doc.text(`Generated: ${generatedAt.format("MMMM D, YYYY h:mm A")}`, 14, 42);
      doc.text(`Days Listed: ${entries.length}`, 126, 24);
      doc.text(`Total kWh: ${totalConsumption.toLocaleString()}`, 126, 30);

      doc.setDrawColor(0, 136, 34);
      doc.setLineWidth(0.6);
      doc.line(14, 47, 196, 47);

      autoTable(doc, {
        startY: 53,
        theme: "grid",
        head: [["Day", "Date", "Meter Reading", "Consumption", "Remarks"]],
        body: entries.map((entry) => [
          `Day ${entry.day}`,
          dayjs(entry.date).format("MMM D, YYYY"),
          entry.meterReading == null ? "-" : entry.meterReading.toLocaleString(),
          entry.consumption == null ? "-" : entry.consumption.toLocaleString(),
          entry.remarks.trim() || "-",
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
          0: { cellWidth: 18 },
          1: { cellWidth: 34 },
          2: { cellWidth: 34, halign: "right" },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 64 },
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
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
      setToastMessage(`Failed to export PDF: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsExportingPdf(false);
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
          <Button type="text" icon={<IoMdArrowRoundBack size={20} />} className="!text-white hover:!text-white/90" onClick={() => navigate(-1)} aria-label="Back" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button type="text" icon={<IoHome size={18} />} className="!text-white hover:!text-white/90" onClick={() => navigate("/landing-page")} aria-label="Home" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className="!m-0 !text-base !text-white">Electricity Consumption</Title>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<MdOutlinePictureAsPdf size={21} />}
            className="!text-white hover:!text-white/90"
            onClick={handleExportPdf}
            aria-label="Export PDF"
            loading={isExportingPdf}
          />
          <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={() => void signOutAndRedirect(navigate)} aria-label="Sign out" />
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-5xl">
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-white px-4 py-4 shadow-sm md:mb-5 md:px-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {growInfo?.buildingName ?? "Grow"}
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">Electricity Consumption Daily History</div>
            <div className="mt-1 text-xs text-slate-500 md:text-sm">
              {growInfo
                ? `Showing day 0 to ${dayjs().format("MMMM D, YYYY")}`
                : isLoading
                  ? "Loading grow details..."
                  : "Grow record not found."}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Days Listed <span className="ml-1 text-slate-900">{entries.length}</span>
              </div>
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Total kWh <span className="ml-1 text-slate-900">{totalConsumption.toLocaleString()}</span>
              </div>
              {growInfo ? (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Grow #{growInfo.id} <span className="ml-1 text-slate-900">{growInfo.status}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2.5">
            {entries.map((entry) => (
              <button
                key={entry.day}
                type="button"
                className="w-full rounded-sm border border-emerald-100 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                onClick={() => setActiveEntry(entry)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" />
                      <div className="text-sm font-semibold text-slate-900">Day {entry.day}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{dayjs(entry.date).format("MMMM D, YYYY")}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">Started {dayjs(growInfo?.createdAt).format("MMM D")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Consumption</div>
                    <div className="text-2xl font-bold leading-none text-slate-900">{entry.consumption ?? "-"}</div>
                    <div className="mt-1 text-[10px] text-slate-400">kWh</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Meter Reading: {entry.meterReading ?? "-"}</span>
                  <span className="font-medium text-emerald-700">{entry.id ? "Saved" : "Tap to encode"}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                  Remarks: {entry.remarks.trim() || "-"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Content>

      <Drawer
        open={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "62%" : undefined}
        width={isMobile ? undefined : 420}
        className="electricity-consumption-drawer"
        bodyStyle={{ padding: 16, backgroundColor: "#f8fafc" }}
      >
        {activeEntry ? (
          <div>
            <div className="rounded-sm border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {growInfo?.buildingName ?? "Grow"}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">Day {activeEntry.day}</div>
              <div className="mt-1 text-xs text-slate-500">{dayjs(activeEntry.date).format("MMMM D, YYYY")}</div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Consumption</div>
                <div className="text-2xl font-bold leading-none text-slate-900">{activeEntry.consumption ?? "-"}</div>
                <div className="mt-1 text-[10px] text-slate-400">kWh</div>
              </div>
            </div>

            <div className="mt-3 rounded-sm border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="mb-1 text-[11px] font-medium text-slate-500">Meter Reading</div>
              <InputNumber
                min={0}
                value={activeEntry.meterReading}
                onChange={(value) => updateActiveEntry({ meterReading: toNumberOrNull(value) })}
                className="!w-full"
                controls={false}
                placeholder="0"
                styles={{ input: { fontSize: 16 } }}
              />

              <div className="mb-1 mt-3 text-[11px] font-medium text-slate-500">Consumption</div>
              <InputNumber
                min={0}
                value={activeEntry.consumption}
                onChange={(value) => updateActiveEntry({ consumption: toNumberOrNull(value) })}
                className="!w-full"
                controls={false}
                placeholder="0"
                styles={{ input: { fontSize: 16 } }}
              />

              <div className="mb-1 mt-3 text-[11px] font-medium text-slate-500">Remarks</div>
              <Input.TextArea
                rows={3}
                value={activeEntry.remarks}
                onChange={(event) => updateActiveEntry({ remarks: event.target.value })}
                placeholder="Optional"
                className="!text-base"
              />

              <Button
                type="primary"
                icon={<FiCheck size={14} />}
                className="mt-4 !h-11 !w-full !rounded-lg !bg-emerald-700 !font-semibold hover:!bg-emerald-600"
                loading={savingDay === activeEntry.day}
                disabled={savingDay !== null}
                onClick={() => void handleSaveEntry(activeEntry)}
              >
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
