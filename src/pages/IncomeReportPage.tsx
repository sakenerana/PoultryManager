import { Button, Divider, Layout, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
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

type BroilerSummaryReport = {
  key: string;
  id: number;
  reportNo: string;
  farmName: string;
  flock: string;
  dateStart: string;
  dateFinish: string;
  pdfUrl: string;
};

export default function IncomeReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [reports, setReports] = useState<BroilerSummaryReport[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const columns: ColumnsType<BroilerSummaryReport> = [
    { title: "Report No", dataIndex: "reportNo", key: "reportNo", width: 160 },
    { title: "Farm Name", dataIndex: "farmName", key: "farmName", width: 160 },
    { title: "Flock", dataIndex: "flock", key: "flock", width: 90 },
    { title: "Date Start", dataIndex: "dateStart", key: "dateStart", width: 120 },
    { title: "Date Finish", dataIndex: "dateFinish", key: "dateFinish", width: 120 },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_value, record) => (
        <Button
          size="small"
          type="default"
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
      ),
    },
  ];

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      const { data, error } = await supabase
        .from(INCOME_SUMMARY_TABLE)
        .select("id, created_at, farm_name, flock, date_start, date_finish, pdf_url")
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BROILER SUMMARY REPORT", 105, 10, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`FARM NAME   ${report.farmName}`, 8, 20);
    doc.text("CODE   0", 8, 25);
    doc.text("HOUSE: 2", 35, 25);
    doc.text(`FLOCK: ${report.flock}`, 58, 25);
    // Header right-side lanes to avoid overlap.
    doc.text("Address:", 95, 20);
    doc.text("BALAO, BARILI, CEBU", 112, 20);
    doc.text("AREA: 53x416", 139, 25);
    doc.text("VAT REG NO", 172, 25);

    autoTable(doc, {
      startY: 30,
      margin: { left: 8 },
      tableWidth: 54,
      styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
      body: [
        ["DATE START", "17/03/2026"],
        ["HARVEST START", "15/04/2026"],
        ["DATE FINISH", "16/04/2026"],
        ["HARV. PERIOD", "2"],
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
        ["TOTAL DOC LOAD", "105,000"],
        ["TOTAL DOC START", "104,302"],
        ["TOTAL HARVEST", "101,100"],
        ["MORTALITY", "3,202"],
        ["% MORTALITY", "3.07%"],
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
        ["EFF", "346.30"],
        ["ADG", "51.12"],
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
        ["DOA", "698", "0.66%"],
        ["DEAD", "2,529", "2.42%"],
        ["CULL", "673", "0.65%"],
        ["TOTAL", "3,202", "3.07%"],
        ["1ST WK.", "244", "0.23%"],
        ["STD. MORT.", "", "4.00%"],
        ["DIFF. MORT.", "", "-0.93%"],
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
        ["510 HF", "1,640.00", "82,000.00", "37%", "0.81"],
        ["511 HF", "2,796.56", "139,828.00", "63%", "1.38"],
        ["524", "-", "-", "-", ""],
        ["532", "-", "-", "-", ""],
        ["TOTAL", "4,436.56", "221,828.00", "100%", "2.19"],
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
        ["ACTUAL", "1.43"],
        ["STD.", "1.638"],
        ["DIFF.", "-0.207"],
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
        ["HARVEST", "101,100", "155,040.00", "1.53", "1.53"],
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
      body: [["UNACCOUNTED BIRDS", "0"]],
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
        ["1", "Grower's Fee for total weight out in kilograms", "155,040.00", "4.50", "Php", "697,680.00"],
        ["2", "Performance Efficiency", "101,100", "9.05", "", "914,955.00"],
        ["3", "Bonus FC", "101,100", "3.25", "", "328,575.00"],
        ["4", "% Harvest Recovery", "101,100", "2.75", "", "278,025.00"],
        ["5", "Energy Subsidies", "", "", "", ""],
        ["", "5.1 LPG", "101,100", "1.00", "", "101,100.00"],
        ["", "5.2 Electricity", "101,100", "1.00", "", "101,100.00"],
        ["6", "Unaccounted Penalty", "", "", "", "-"],
        ["", "Special Payment", "101,100", "", "", "-"],
        ["", "", "", "", "", "2,421,435.00"],
        ["", "SILO", "101,100", "1.00", "", "101,100.00"],
        ["", "", "", "", "", "2,522,535.00"],
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
    doc.text("24.95", 52, summaryY);
    const totalRowY = summaryY - 4;
    doc.text("TOTAL Net of 12% VAT", 92, totalRowY);
    doc.text("Less - 2% Withholding Tax", 92, summaryY + 4);
    doc.text("50,450.70", 188, summaryY + 4, { align: "right" });
    doc.text("2,472,084.30", 188, summaryY + 10, { align: "right" });
    doc.text("LESS", 20, summaryY + 16);
    doc.text("Cash Bond", 30, summaryY + 16);
    doc.text("101,100", 125, summaryY + 16, { align: "right" });
    doc.text("1.00", 145, summaryY + 16, { align: "right" });
    doc.text("101,100.00", 188, summaryY + 16, { align: "right" });
    doc.text("Net Amount Payable", 100, summaryY + 22);
    doc.text("Php", 156, summaryY + 22);
    doc.setFont("helvetica", "bold");
    doc.text("2,370,984.30", 188, summaryY + 22, { align: "right" });
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
              Broiler Summary Report
            </div>
            <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Select a report to preview PDF</div>
            <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
              Tap or click a row below to display the selected summary report.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Broiler Summary Report List</div>
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
                  Income Summary
                </Button>
              </div>
              <Table<BroilerSummaryReport>
                size="small"
                rowKey="key"
                columns={columns}
                dataSource={reports}
                pagination={{
                  pageSize: 5,
                  showSizeChanger: true,
                  pageSizeOptions: ["5", "10", "20"],
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
                }}
                scroll={{ x: 680 }}
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedKey(record.key);
                    exportBroilerSummaryPdf(record);
                  },
                  className: record.key === selectedKey ? "!bg-emerald-50" : "",
                })}
              />
            </div>

          </div>
        </div>
      </Content>

    </Layout>
  );
}
