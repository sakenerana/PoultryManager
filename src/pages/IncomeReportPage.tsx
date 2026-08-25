import { Button, Divider, Grid, Layout, Pagination, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoCreateOutline, IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoAdd } from "react-icons/io5";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation, useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const INCOME_SUMMARY_TABLE = import.meta.env.VITE_SUPABASE_INCOME_SUMMARY_TABLE ?? "IncomeSummary";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type BroilerSummaryReport = {
  key: string;
  id: number;
  reportNo: string;
  farmName: string;
  flock: string;
  dateStart: string;
  dateFinish: string;
  pdfUrl: string;
  row: Record<string, any>;
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: unknown, fractionDigits = 0): string => {
  const parsed = asNumber(value);
  if (parsed === null) return "-";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatPercent = (value: unknown, fractionDigits = 2): string => {
  const parsed = asNumber(value);
  if (parsed === null) return "-";
  return `${parsed.toFixed(fractionDigits)}%`;
};

const formatDate = (value: unknown): string => {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : text;
};

const multiply = (...values: Array<unknown>): number | null => {
  const parsed = values.map(asNumber);
  if (parsed.some((value) => value === null)) return null;
  return parsed.reduce<number>((total, value) => total * Number(value), 1);
};

export default function IncomeReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [reports, setReports] = useState<BroilerSummaryReport[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(5);
  const mobilePagedReports = useMemo(() => {
    const start = (mobilePage - 1) * mobilePageSize;
    return reports.slice(start, start + mobilePageSize);
  }, [mobilePage, mobilePageSize, reports]);
  const summary = useMemo(() => {
    const farms = new Set(reports.map((report) => report.farmName.trim()).filter(Boolean));
    const totalHarvest = reports.reduce((sum, report) => sum + (asNumber(report.row.total_harvest) ?? 0), 0);
    const latestFinish = reports
      .map((report) => report.dateFinish)
      .filter((date) => dayjs(date).isValid())
      .sort((a, b) => dayjs(b).unix() - dayjs(a).unix())[0];

    return {
      totalReports: reports.length,
      totalFarms: farms.size,
      totalHarvest,
      latestFinish: latestFinish ? dayjs(latestFinish).format("MMM D, YYYY") : "No finish date",
    };
  }, [reports]);

  const columns: ColumnsType<BroilerSummaryReport> = useMemo(
    () => [
      { title: "Report No", dataIndex: "reportNo", key: "reportNo", width: 160 },
      { title: "Farm Name", dataIndex: "farmName", key: "farmName", width: 160 },
      { title: "Flock", dataIndex: "flock", key: "flock", width: 90 },
      {
        title: "Date Start",
        dataIndex: "dateStart",
        key: "dateStart",
        width: 120,
        render: (value: string) => formatDate(value),
      },
      {
        title: "Date Finish",
        dataIndex: "dateFinish",
        key: "dateFinish",
        width: 120,
        render: (value: string) => formatDate(value),
      },
      {
        title: "PDF",
        key: "pdf",
        width: 90,
        render: (_value, record) => (
          <Tag color={record.pdfUrl ? "green" : "default"} className="!mr-0">
            {record.pdfUrl ? "Ready" : "No URL"}
          </Tag>
        ),
      },
      {
        title: "",
        key: "action",
        width: 185,
        fixed: "right",
        align: "right",
        render: (_value, record) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedKey(record.key);
                exportBroilerSummaryPdf(record);
              }}
            >
              View income summary PDF
            </button>
            <Button
              size="small"
              type="default"
              icon={<IoCreateOutline size={14} />}
              className="!rounded-md !border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!border-emerald-300 hover:!bg-emerald-100 hover:!text-emerald-800"
            onClick={(event) => {
              event.stopPropagation();
              navigate("/reports/income/new", {
                state: {
                  mode: "edit",
                  editId: record.id,
                  reportNo: record.reportNo,
                  existingReportNos: reports.map((item) => item.reportNo),
                },
              });
            }}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [navigate, reports]
  );

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      const { data, error } = await supabase
        .from(INCOME_SUMMARY_TABLE)
        .select("*")
        .order("id", { ascending: true });

      if (!active) return;
      if (error) {
        console.error("Failed to load income summary reports:", error);
        setReports([]);
        return;
      }

      const mapped: BroilerSummaryReport[] = (data ?? []).map((row: any, index: number) => {
        const id = Number(row.id ?? 0);
        const year = String(row.created_at ?? row.date_start ?? new Date().toISOString()).slice(0, 4);
        const reportNo = `BSR-${year}-${String(index + 1).padStart(3, "0")}`;
        return {
          key: String(id),
          id,
          reportNo,
          farmName: String(row.farm_name ?? ""),
          flock: String(row.flock ?? ""),
          dateStart: String(row.date_start ?? ""),
          dateFinish: String(row.date_finish ?? ""),
          pdfUrl: String(row.pdf_url ?? import.meta.env.VITE_BROILER_SUMMARY_PDF_URL ?? "/docs/broiler-summary-sample.pdf"),
          row,
        };
      });

      setReports(mapped);
      setSelectedKey((prev) => prev || mapped[0]?.key || "");
    };

    void loadReports();
    navigate(location.pathname, { replace: true, state: null });
    return () => {
      active = false;
    };
  }, [location.pathname, location.state, navigate]);

  const exportBroilerSummaryPdf = (report: BroilerSummaryReport) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const yellow: [number, number, number] = [255, 242, 0];
    const green: [number, number, number] = [146, 208, 80];
    const r = report.row;
    const mortalityTotal = asNumber(r.mortality);
    const totalDocLoad = asNumber(r.total_doc_load);
    const firstWeek = asNumber(r.first_week);
    const mortalityPercent = asNumber(r.mortality_percent);
    const firstWeekPercent = firstWeek !== null && totalDocLoad ? (firstWeek / totalDocLoad) * 100 : null;
    const feedRows = [
      ["510 HF", r["510_hf_bags"], r["510_hf_kilo"], r["510_hf_percent"], r["510_hf_feeds/head"]],
      ["511 HF", r["511_hf_bags"], r["511_hf_kilo"], r["511_hf_percent"], r["511_hf_feeds/head"]],
      ["524", r["524_bags"], r["524_kilo"], r["524_percent"], r["524_feeds/head"]],
      ["532", r["532_bags"], r["532_kilo"], r["532_percent"], r["532_feeds/head"]],
    ] as const;
    const feedTotalBags = feedRows.reduce((sum, row) => sum + (asNumber(row[1]) ?? 0), 0);
    const feedTotalKilo = feedRows.reduce((sum, row) => sum + (asNumber(row[2]) ?? 0), 0);
    const feedTotalPercent = feedRows.reduce((sum, row) => sum + (asNumber(row[3]) ?? 0), 0);
    const feedTotalHead = feedRows.reduce((sum, row) => sum + (asNumber(row[4]) ?? 0), 0);
    const growersFeeAmount = multiply(r.harvest_kilo, r.growers_fee_rate);
    const performanceAmount = multiply(r.harvest_qty, r.performance_efficiency_rate);
    const bonusAmount = multiply(r.harvest_qty, r.bonus_fc_rate);
    const recoveryAmount = multiply(r.harvest_qty, r.harvest_recovery_rate);
    const lpgAmount = multiply(r.harvest_qty, r.lpg_rate);
    const electricityAmount = multiply(r.harvest_qty, r.electricity_rate);
    const cashBondAmount = multiply(r.harvest_qty, r.cash_bond_rate);
    const grossPayable = [growersFeeAmount, performanceAmount, bonusAmount, recoveryAmount, lpgAmount, electricityAmount].reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0
    );
    const withholdingTaxBase = grossPayable + (cashBondAmount ?? 0);
    const withholdingTax = withholdingTaxBase * 0.02;
    const netAfterTax = withholdingTaxBase - withholdingTax;
    const netAmountPayable = netAfterTax - (cashBondAmount ?? 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BROILER SUMMARY REPORT", 105, 10, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`FARM NAME   ${report.farmName}`, 8, 20);
    doc.text(`CODE   ${r.code ?? "-"}`, 8, 25);
    doc.text(`HOUSE: ${r.house ?? "-"}`, 35, 25);
    doc.text(`FLOCK: ${report.flock}`, 58, 25);
    // Header right-side lanes to avoid overlap.
    doc.text("Address:", 95, 20);
    doc.text(String(r.address ?? "-"), 112, 20);
    doc.text(`AREA: ${r.area ?? "-"}`, 139, 25);
    doc.text(`VAT REG NO ${r.vat_reg_no ?? ""}`, 172, 25);

    autoTable(doc, {
      startY: 30,
      margin: { left: 8 },
      tableWidth: 54,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [
        ["DATE START", formatDate(r.date_start)],
        ["HARVEST START", formatDate(r.harvest_start)],
        ["DATE FINISH", formatDate(r.date_finish)],
        ["HARV. PERIOD", formatNumber(r.harvest_period)],
      ],
      columnStyles: {
        1: { halign: "center", fillColor: yellow },
      },
    });

    autoTable(doc, {
      startY: 30,
      margin: { left: 75 },
      tableWidth: 78,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [
        ["TOTAL DOC LOAD", formatNumber(r.total_doc_load)],
        ["TOTAL DOC START", formatNumber(r.total_doc_start)],
        ["TOTAL HARVEST", formatNumber(r.total_harvest)],
        ["MORTALITY", formatNumber(r.mortality)],
        ["% MORTALITY", formatPercent(r.mortality_percent)],
      ],
      columnStyles: {
        1: { halign: "right", fillColor: [255, 255, 255] },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1 && data.row.index <= 1) data.cell.styles.fillColor = yellow;
        if (data.section === "body" && data.column.index === 1 && data.row.index === 4) data.cell.styles.fillColor = green;
        if (data.section === "body" && data.column.index === 0 && data.row.index === 4) data.cell.styles.halign = "center";
        if (data.section === "body" && data.column.index === 1 && data.row.index === 4) data.cell.styles.halign = "center";
      },
    });

    autoTable(doc, {
      startY: 30,
      margin: { left: 162 },
      tableWidth: 40,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [
        ["EFF", formatNumber(r.eff, 2)],
        ["ADG", formatNumber(r.adg, 2)],
      ],
      columnStyles: {
        1: { halign: "center" },
      },
    });

    autoTable(doc, {
      startY: 57,
      margin: { left: 8 },
      tableWidth: 60,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [
        [{ content: "MORTALITY", colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
        ["DOA", formatNumber(r.DOA), totalDocLoad ? formatPercent((asNumber(r.DOA) ?? 0) / totalDocLoad * 100) : "-"],
        ["DEAD", formatNumber(r.Dead), totalDocLoad ? formatPercent((asNumber(r.Dead) ?? 0) / totalDocLoad * 100) : "-"],
        ["CULL", formatNumber(r.Cull), totalDocLoad ? formatPercent((asNumber(r.Cull) ?? 0) / totalDocLoad * 100) : "-"],
        ["TOTAL", formatNumber(mortalityTotal), formatPercent(mortalityPercent)],
        ["1ST WK.", formatNumber(firstWeek), formatPercent(firstWeekPercent)],
        ["STD. MORT.", "", formatPercent(r.std_mort_percent)],
        ["DIFF. MORT.", "", formatPercent(r.diff_mort_percent)],
      ],
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 1 && d.row.index >= 1 && d.row.index <= 5) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 4 && d.column.index === 1) d.cell.styles.fillColor = green;
        if (d.section === "body" && d.row.index === 5 && d.column.index === 1) d.cell.styles.fillColor = green;
        if (d.section === "body" && d.row.index >= 1 && (d.column.index === 1 || d.column.index === 2)) d.cell.styles.halign = "center";
      },
    });

    autoTable(doc, {
      startY: 60.5,
      margin: { left: 75 },
      tableWidth: 127,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2, halign: "center" },
      body: [["FEEDS PHASE USAGE"]],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      margin: { left: 75 },
      tableWidth: 127,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      head: [["TYPE", "BAGS", "KILO", "%", "FEEDS/HEAD"]],
      body: [
        ...feedRows.map(([type, bags, kilo, percent, feedsHead]) => [
          type,
          formatNumber(bags, 2),
          formatNumber(kilo, 2),
          asNumber(percent) === null ? "-" : `${formatNumber(percent, 0)}%`,
          formatNumber(feedsHead, 2),
        ]),
        ["TOTAL", formatNumber(feedTotalBags, 2), formatNumber(feedTotalKilo, 2), `${formatNumber(feedTotalPercent, 0)}%`, formatNumber(feedTotalHead, 2)],
      ],
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right" },
      },
      didParseCell: (d) => {
        if (d.section === "head") {
          d.cell.styles.fillColor = [35, 122, 179];
          d.cell.styles.textColor = [255, 255, 255];
          d.cell.styles.fontStyle = "bold";
        }
        if (d.section === "head" && d.column.index === 3) d.cell.styles.halign = "center";
        if (d.section === "body" && d.column.index === 1 && d.row.index < 4) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 4 && d.column.index === 4) d.cell.styles.fillColor = green;
      },
    });

    const nextY = (doc as any).lastAutoTable.finalY + 4;
    autoTable(doc, {
      startY: nextY,
      margin: { left: 8 },
      tableWidth: 42,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "right" },
      },
      body: [
        [{ content: "FCR", colSpan: 2, styles: { halign: "center" } }],
        ["ACTUAL", formatNumber(r.fcr_actual, 3)],
        ["STD.", formatNumber(r.fcr_std, 3)],
        ["DIFF.", formatNumber(r.fcr_diff, 3)],
      ],
      didParseCell: (d) => {
        if (d.section === "body" && d.row.index === 2 && d.column.index === 1) d.cell.styles.fillColor = yellow;
      },
    });

    autoTable(doc, {
      startY: nextY,
      margin: { left: 75 },
      tableWidth: 127,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      head: [["", "QTY", "", "ALW", ""]],
      body: [
        ["HARVEST", formatNumber(r.harvest_qty), formatNumber(r.harvest_kilo, 2), formatNumber(r.alw, 2), formatNumber(r.alw, 2)],
      ],
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "center" },
      },
      didParseCell: (d) => {
        if (d.section === "head") d.cell.styles.halign = "center";
        if (d.section === "body" && d.row.index === 0 && (d.column.index === 1 || d.column.index === 2)) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 0 && d.column.index === 4) d.cell.styles.fillColor = green;
      },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      margin: { left: 75 },
      tableWidth: 60,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [["UNACCOUNTED BIRDS", formatNumber(r.unaccounted_birds)]],
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "right" },
      },
    });

    const schemeY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text("SCHEME REPORT", 105, schemeY, { align: "center" });
    doc.setFont("helvetica", "normal");
    autoTable(doc, {
      startY: schemeY + 2,
      margin: { left: 8 },
      tableWidth: 194,
      styles: { fontSize: 7, cellPadding: 0.7, lineColor: [220, 220, 220], lineWidth: 0.05 },
      body: [
        ["1", "Grower's Fee for total weight out in kilograms", formatNumber(r.harvest_kilo, 2), formatNumber(r.growers_fee_rate, 2), "Php", formatNumber(growersFeeAmount, 2)],
        ["2", "Performance Efficiency", formatNumber(r.harvest_qty), formatNumber(r.performance_efficiency_rate, 2), "", formatNumber(performanceAmount, 2)],
        ["3", "Bonus FC", formatNumber(r.harvest_qty), formatNumber(r.bonus_fc_rate, 2), "", formatNumber(bonusAmount, 2)],
        ["4", "% Harvest Recovery", formatNumber(r.harvest_qty), formatNumber(r.harvest_recovery_rate, 2), "", formatNumber(recoveryAmount, 2)],
        ["5", "Energy Subsidies", "", "", "", ""],
        ["", "5.1 LPG", formatNumber(r.harvest_qty), formatNumber(r.lpg_rate, 2), "", formatNumber(lpgAmount, 2)],
        ["", "5.2 Electricity", formatNumber(r.harvest_qty), formatNumber(r.electricity_rate, 2), "", formatNumber(electricityAmount, 2)],
        ["6", "Unaccounted Penalty", "", "", "", "-"],
        ["", "Special Payment", formatNumber(r.harvest_qty), "", "", "-"],
        ["", "", "", "", "", formatNumber(grossPayable, 2)],
        ["", "SILO", formatNumber(r.harvest_qty), formatNumber(r.cash_bond_rate, 2), "", formatNumber(cashBondAmount, 2)],
        ["", "", "", "", "", formatNumber(grossPayable + (cashBondAmount ?? 0), 2)],
      ],
      didParseCell: (d) => {
        if (d.section === "body" && d.row.index === 1 && d.column.index === 3) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 1 && d.column.index === 1) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 3 && d.column.index === 1) d.cell.styles.fillColor = yellow;
        if (d.section === "body" && d.row.index === 6 && d.column.index === 1) d.cell.styles.fillColor = yellow;
      },
    });

    const summaryY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(7);
    doc.text("Average Scheme (Php/Head)", 10, summaryY);
    doc.text(formatNumber(r.avg_scheme, 2), 52, summaryY);
    const totalRowY = summaryY - 4;
    doc.text("TOTAL Net of 12% VAT", 92, totalRowY);
    doc.text("Less - 2% Withholding Tax", 92, summaryY + 4);
    doc.text(formatNumber(withholdingTax, 2), 188, summaryY + 4, { align: "right" });
    doc.text(formatNumber(netAfterTax, 2), 188, summaryY + 10, { align: "right" });
    doc.text("LESS", 20, summaryY + 16);
    doc.text("Cash Bond", 30, summaryY + 16);
    doc.text(formatNumber(r.harvest_qty), 125, summaryY + 16, { align: "right" });
    doc.text(formatNumber(r.cash_bond_rate, 2), 145, summaryY + 16, { align: "right" });
    doc.text(formatNumber(cashBondAmount, 2), 188, summaryY + 16, { align: "right" });
    doc.text("Net Amount Payable", 100, summaryY + 22);
    doc.text("Php", 156, summaryY + 22);
    doc.setFont("helvetica", "bold");
    doc.text(formatNumber(netAmountPayable, 2), 188, summaryY + 22, { align: "right" });
    doc.setFont("helvetica", "normal");

    const footY = summaryY + 27;
    doc.line(8, footY, 202, footY);
    doc.text("FARMER", 25, footY + 8, { align: "center" });
    doc.text("ANIMAL HUSBANDRY", 105, footY + 8, { align: "center" });
    doc.text("GENERAL MANAGER", 185, footY + 8, { align: "center" });
    doc.line(8, footY + 12, 202, footY + 12);
    doc.setFontSize(7);
    doc.text("FOR ACCOUNTING DEPARTMENT ONLY:", 9, footY + 17);
    doc.text("IO NUMBER", 140, footY + 17);
    doc.setFontSize(9);

    const url = doc.output("bloburl");
    window.open(url, "_blank", "noopener,noreferrer");
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
            Income Report
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Income Report
            </div>
            <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Income Summary Reports</div>
            <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
              Review saved broiler income summaries, open PDF previews, or update report details.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reports</div>
                <div className="mt-1 text-xl font-bold leading-none text-slate-900">{summary.totalReports.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Farms</div>
                <div className="mt-1 text-xl font-bold leading-none text-emerald-800">{summary.totalFarms.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total Harvest</div>
                <div className="mt-1 text-xl font-bold leading-none text-slate-900">{formatNumber(summary.totalHarvest)}</div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-700">Latest Finish</div>
                <div className="mt-1 text-sm font-bold leading-tight text-slate-900">{summary.latestFinish}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Detailed Records</div>
                  <div className="text-sm font-semibold text-slate-800">Income Summary Report List</div>
                </div>
                <Button
                  type="primary"
                  icon={<IoAdd size={16} />}
                  className="!rounded-md !bg-emerald-700 !px-3 !text-xs !font-semibold hover:!bg-emerald-600"
                  onClick={() =>
                    navigate("/reports/income/new", {
                      state: { existingReportNos: reports.map((item) => item.reportNo) },
                    })
                  }
                >
                  Add Income Summary
              </Button>
              </div>
              <div className="mb-2 text-xs text-slate-500">Tap or click a record to view the income summary PDF.</div>
              {reports.length === 0 ? (
                <div className="rounded-sm border border-emerald-100 bg-emerald-50/60 p-5 text-center">
                  <div className="text-sm font-semibold text-slate-800">No income summaries yet</div>
                  <div className="mt-1 text-xs text-slate-500">Add an income summary to generate broiler summary reports.</div>
                </div>
              ) : isMobile ? (
                <div className="space-y-2">
                  {mobilePagedReports.map((record) => (
                    <div
                      key={record.key}
                      role="button"
                      tabIndex={0}
                      className={`w-full rounded-lg border p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 ${
                        record.key === selectedKey ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 bg-white"
                      }`}
                      onClick={() => {
                        setSelectedKey(record.key);
                        exportBroilerSummaryPdf(record);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedKey(record.key);
                        exportBroilerSummaryPdf(record);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Income Summary</div>
                          <div className="font-semibold text-slate-800">{record.reportNo}</div>
                          <div className="mt-0.5 text-[10px] text-slate-500">{record.farmName || "Unnamed farm"}</div>
                        </div>
                        <Tag color={record.pdfUrl ? "green" : "default"} className="!mr-0">
                          {record.pdfUrl ? "PDF Ready" : "No PDF URL"}
                        </Tag>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <div><span className="text-slate-500">Flock:</span> {record.flock || "-"}</div>
                        <div><span className="text-slate-500">Harvest:</span> {formatNumber(record.row.total_harvest)}</div>
                        <div><span className="text-slate-500">Start:</span> {formatDate(record.dateStart)}</div>
                        <div><span className="text-slate-500">Finish:</span> {formatDate(record.dateFinish)}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-emerald-700">View income summary PDF</span>
                        <Button
                          size="small"
                          icon={<IoCreateOutline size={14} />}
                          className="!rounded-md !border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!border-emerald-300 hover:!bg-emerald-100 hover:!text-emerald-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate("/reports/income/new", {
                              state: {
                                mode: "edit",
                                editId: record.id,
                                reportNo: record.reportNo,
                                existingReportNos: reports.map((item) => item.reportNo),
                              },
                            });
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1">
                    <Pagination
                      current={mobilePage}
                      pageSize={mobilePageSize}
                      total={reports.length}
                      size="small"
                      showSizeChanger={reports.length > 5}
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
                <Table<BroilerSummaryReport>
                  size="small"
                  rowKey="key"
                  columns={columns}
                  dataSource={reports}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: reports.length > 5,
                    pageSizeOptions: ["5", "10", "20"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
                  }}
                  scroll={{ x: 760 }}
                  onRow={(record) => ({
                    onClick: () => {
                      setSelectedKey(record.key);
                      exportBroilerSummaryPdf(record);
                    },
                    className: `${record.key === selectedKey ? "!bg-emerald-50" : ""} cursor-pointer hover:!bg-emerald-50/60`,
                  })}
                />
              )}
            </div>

          </div>
        </div>
      </Content>

    </Layout>
  );
}
