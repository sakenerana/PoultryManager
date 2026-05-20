import { Button, Divider, Form, Input, Layout, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useLocation, useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const INCOME_SUMMARY_TABLE = import.meta.env.VITE_SUPABASE_INCOME_SUMMARY_TABLE ?? "IncomeSummary";
const { Header, Content } = Layout;
const { Title } = Typography;

const sectionCardClass =
  "rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5";

type IncomeSummaryFormValues = {
  reportNo: string;
  farmName: string;
  flock: string;
  dateStart: string;
  dateFinish: string;
  harvestStart: string;
  harvestPeriod: string;
  address: string;
  code: string;
  house: string;
  area: string;
  vatRegNo: string;
  totalDocLoad: string;
  totalDocStart: string;
  totalHarvest: string;
  mortalityTotal: string;
  mortalityPercent: string;
  eff: string;
  adg: string;
  doa: string;
  dead: string;
  cull: string;
  firstWeek: string;
  stdMort: string;
  diffMort: string;
  hf510Bags: string;
  hf510Kilo: string;
  hf510Percent: string;
  hf510FeedsHead: string;
  hf511Bags: string;
  hf511Kilo: string;
  hf511Percent: string;
  hf511FeedsHead: string;
  feed524: string;
  feed532: string;
  feedsTotalBags: string;
  feedsTotalKilo: string;
  feedsTotalPercent: string;
  feedsTotalHead: string;
  fcrActual: string;
  fcrStd: string;
  fcrDiff: string;
  qtyHarvest: string;
  kiloHarvest: string;
  alw: string;
  unaccountedBirds: string;
  growersFeeRate: string;
  performanceEfficiencyRate: string;
  bonusFCRate: string;
  harvestRecoveryRate: string;
  lpgRate: string;
  electricityRate: string;
  cashBondQty: string;
  cashBondRate: string;
  avgScheme: string;
  totalNetVat: string;
  withholdingTax: string;
  netAfterTax: string;
  cashBondAmount: string;
  netAmountPayable: string;
  pdfUrl: string;
};

export default function IncomeSummaryFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { mode?: "edit"; editId?: number; reportNo?: string; existingReportNos?: string[] } | null) ?? null;
  const isEditMode = navState?.mode === "edit" && Number.isFinite(navState?.editId);
  const editId = isEditMode ? Number(navState?.editId) : null;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [form] = Form.useForm<IncomeSummaryFormValues>();
  const [autoReportNo, setAutoReportNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fallbackReportNo = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const state = location.state as { existingReportNos?: string[] } | null;
    const reportNos = state?.existingReportNos ?? [];
    let maxSeq = 0;

    for (const reportNo of reportNos) {
      const match = reportNo.match(new RegExp(`^BSR-${year}-(\\d{3,})$`));
      if (!match) continue;
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }

    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    return `BSR-${year}-${nextSeq}`;
  }, [location.state]);

  useEffect(() => {
    if (isEditMode) return;
    let active = true;

    const loadNextReportNo = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const { data, error } = await supabase
        .from(INCOME_SUMMARY_TABLE)
        .select("id, created_at")
        .order("id", { ascending: false })
        .limit(1);

      if (!active) return;
      if (error || !data || data.length === 0) {
        setAutoReportNo(fallbackReportNo);
        form.setFieldValue("reportNo", fallbackReportNo);
        return;
      }

      const latestId = Number(data[0]?.id ?? 0);
      const next = `BSR-${year}-${String(latestId + 1).padStart(3, "0")}`;
      setAutoReportNo(next);
      form.setFieldValue("reportNo", next);
    };

    void loadNextReportNo();
    return () => {
      active = false;
    };
  }, [fallbackReportNo, form, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !editId) return;
    let active = true;

    const loadForEdit = async () => {
      const { data, error } = await supabase.from(INCOME_SUMMARY_TABLE).select("*").eq("id", editId).maybeSingle();
      if (!active || error || !data) return;

      const createdYear = String(data.created_at ?? new Date().toISOString()).slice(0, 4);
      form.setFieldsValue({
        reportNo: String(navState?.reportNo ?? `BSR-${createdYear}-${String(editId).padStart(3, "0")}`),
        farmName: String(data.farm_name ?? ""),
        flock: String(data.flock ?? ""),
        house: String(data.house ?? ""),
        code: String(data.code ?? ""),
        area: String(data.area ?? ""),
        address: String(data.address ?? ""),
        dateStart: String(data.date_start ?? ""),
        harvestStart: String(data.harvest_start ?? ""),
        dateFinish: String(data.date_finish ?? ""),
        harvestPeriod: String(data.harvest_period ?? ""),
        totalDocLoad: String(data.total_doc_load ?? ""),
        totalDocStart: String(data.total_doc_start ?? ""),
        totalHarvest: String(data.total_harvest ?? ""),
        mortalityTotal: String(data.mortality ?? ""),
        mortalityPercent: String(data.mortality_percent ?? ""),
        eff: String(data.eff ?? ""),
        adg: String(data.adg ?? ""),
        vatRegNo: String(data.vat_reg_no ?? ""),
        doa: String(data.DOA ?? ""),
        dead: String(data.Dead ?? ""),
        cull: String(data.Cull ?? ""),
        firstWeek: String(data.first_week ?? ""),
        stdMort: String(data.std_mort_percent ?? ""),
        diffMort: String(data.diff_mort_percent ?? ""),
        hf510Bags: String(data["510_hf_bags"] ?? ""),
        hf510Kilo: String(data["510_hf_kilo"] ?? ""),
        hf510Percent: String(data["510_hf_percent"] ?? ""),
        hf510FeedsHead: String(data["510_hf_feeds/head"] ?? ""),
        hf511Bags: String(data["511_hf_bags"] ?? ""),
        hf511Kilo: String(data["511_hf_kilo"] ?? ""),
        hf511Percent: String(data["511_hf_percent"] ?? ""),
        hf511FeedsHead: String(data["511_hf_feeds/head"] ?? ""),
        feed524: String(data["524_bags"] ?? "-"),
        feed532: String(data["532_bags"] ?? "-"),
        fcrActual: String(data.fcr_actual ?? ""),
        fcrStd: String(data.fcr_std ?? ""),
        fcrDiff: String(data.fcr_diff ?? ""),
        qtyHarvest: String(data.harvest_qty ?? ""),
        kiloHarvest: String(data.harvest_kilo ?? ""),
        alw: String(data.alw ?? ""),
        unaccountedBirds: String(data.unaccounted_birds ?? ""),
        growersFeeRate: String(data.growers_fee_rate ?? ""),
        performanceEfficiencyRate: String(data.performance_efficiency_rate ?? ""),
        bonusFCRate: String(data.bonus_fc_rate ?? ""),
        harvestRecoveryRate: String(data.harvest_recovery_rate ?? ""),
        lpgRate: String(data.lpg_rate ?? ""),
        electricityRate: String(data.electricity_rate ?? ""),
        avgScheme: String(data.avg_scheme ?? ""),
        cashBondRate: String(data.cash_bond_rate ?? ""),
        pdfUrl: String(data.pdf_url ?? ""),
      });
    };

    void loadForEdit();
    return () => {
      active = false;
    };
  }, [editId, form, isEditMode]);

  const toNumber = (value: unknown): number | null => {
    const cleaned = String(value ?? "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    const parsed = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toInteger = (value: unknown): number | null => {
    const parsed = toNumber(value);
    return parsed === null ? null : Math.round(parsed);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      const payload = {
        farm_name: String(values.farmName ?? "").trim(),
        flock: String(values.flock ?? "").trim(),
        house: String(values.house ?? "").trim() || null,
        code: String(values.code ?? "").trim() || null,
        area: String(values.area ?? "").trim() || null,
        address: String(values.address ?? "").trim() || null,
        date_start: String(values.dateStart ?? "").trim() || null,
        harvest_start: String(values.harvestStart ?? "").trim() || null,
        date_finish: String(values.dateFinish ?? "").trim() || null,
        harvest_period: toInteger(values.harvestPeriod),
        total_doc_load: toNumber(values.totalDocLoad),
        total_doc_start: toNumber(values.totalDocStart),
        total_harvest: toNumber(values.totalHarvest),
        mortality: toInteger(values.mortalityTotal),
        mortality_percent: toNumber(values.mortalityPercent),
        eff: toNumber(values.eff),
        adg: toNumber(values.adg),
        vat_reg_no: String(values.vatRegNo ?? "").trim() || null,
        DOA: toInteger(values.doa),
        Dead: toInteger(values.dead),
        Cull: toInteger(values.cull),
        first_week: toInteger(values.firstWeek),
        std_mort_percent: toNumber(values.stdMort),
        diff_mort_percent: toNumber(values.diffMort),
        "510_hf_bags": toNumber(values.hf510Bags),
        "510_hf_kilo": toNumber(values.hf510Kilo),
        "510_hf_percent": toNumber(values.hf510Percent),
        "510_hf_feeds/head": toNumber(values.hf510FeedsHead),
        "511_hf_bags": toNumber(values.hf511Bags),
        "511_hf_kilo": toNumber(values.hf511Kilo),
        "511_hf_percent": toNumber(values.hf511Percent),
        "511_hf_feeds/head": toNumber(values.hf511FeedsHead),
        "524_bags": toNumber(values.feed524),
        "524_kilo": null,
        "524_percent": null,
        "524_feeds/head": null,
        "532_bags": toNumber(values.feed532),
        "532_kilo": null,
        "532_percent": null,
        "532_feeds/head": null,
        fcr_actual: toNumber(values.fcrActual),
        fcr_std: toNumber(values.fcrStd),
        fcr_diff: toNumber(values.fcrDiff),
        harvest_qty: toNumber(values.qtyHarvest),
        harvest_kilo: toNumber(values.kiloHarvest),
        alw: toNumber(values.alw),
        unaccounted_birds: toInteger(values.unaccountedBirds),
        growers_fee_rate: toNumber(values.growersFeeRate),
        performance_efficiency_rate: toNumber(values.performanceEfficiencyRate),
        bonus_fc_rate: toNumber(values.bonusFCRate),
        harvest_recovery_rate: toNumber(values.harvestRecoveryRate),
        lpg_rate: toNumber(values.lpgRate),
        electricity_rate: toNumber(values.electricityRate),
        avg_scheme: toNumber(values.avgScheme),
        cash_bond_rate: toNumber(values.cashBondRate),
        pdf_url: String(values.pdfUrl ?? "").trim() || null,
      };

      const { error } = isEditMode && editId
        ? await supabase.from(INCOME_SUMMARY_TABLE).update(payload).eq("id", editId)
        : await supabase.from(INCOME_SUMMARY_TABLE).insert([payload]);
      if (error) {
        console.error("Failed to save income summary:", error);
        message.error(`Save failed: ${error.message}`);
        return;
      }

      message.success(isEditMode ? "Income summary updated." : "Income summary saved to Supabase.");
      navigate("/reports/income", {
        state: { refreshAt: Date.now() },
      });
    } finally {
      setSubmitting(false);
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
            {isEditMode ? "Edit Income Summary" : "Add Income Summary"}
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
        <div className="mx-auto w-full max-w-[420px] md:max-w-5xl">
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white md:px-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
              Broiler Summary
            </div>
            <div className="mt-1 text-lg font-bold md:text-2xl">Income Summary Form</div>
            <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
              Fill in report details below. Layout is optimized for phone, tablet, and desktop.
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            className="space-y-4"
            initialValues={{
              reportNo: autoReportNo || fallbackReportNo,
              farmName: "GGDC H1",
              flock: "3",
              dateStart: "2026-03-17",
              dateFinish: "2026-04-16",
              harvestStart: "2026-04-15",
              harvestPeriod: "2",
              address: "BALAO, BARILI, CEBU",
              code: "0",
              house: "2",
              area: "53x416",
              vatRegNo: "",
              totalDocLoad: "105000",
              totalDocStart: "104302",
              totalHarvest: "101100",
              mortalityTotal: "3202",
              mortalityPercent: "3.07",
              eff: "346.30",
              adg: "51.12",
              doa: "698",
              dead: "2529",
              cull: "673",
              firstWeek: "244",
              stdMort: "4.00",
              diffMort: "-0.93",
              hf510Bags: "1640.00",
              hf510Kilo: "82000.00",
              hf510Percent: "37",
              hf510FeedsHead: "0.81",
              hf511Bags: "2796.56",
              hf511Kilo: "139828.00",
              hf511Percent: "63",
              hf511FeedsHead: "1.38",
              feed524: "-",
              feed532: "-",
              feedsTotalBags: "4436.56",
              feedsTotalKilo: "221828.00",
              feedsTotalPercent: "100",
              feedsTotalHead: "2.19",
              fcrActual: "1.43",
              fcrStd: "1.638",
              fcrDiff: "-0.207",
              qtyHarvest: "101100",
              kiloHarvest: "155040.00",
              alw: "1.53",
              unaccountedBirds: "0",
              growersFeeRate: "4.50",
              performanceEfficiencyRate: "9.05",
              bonusFCRate: "3.25",
              harvestRecoveryRate: "2.75",
              lpgRate: "1.00",
              electricityRate: "1.00",
              cashBondQty: "101100",
              cashBondRate: "1.00",
              avgScheme: "24.95",
              totalNetVat: "2522535.00",
              withholdingTax: "50450.70",
              netAfterTax: "2472084.30",
              cashBondAmount: "101100.00",
              netAmountPayable: "2370984.30",
              pdfUrl: import.meta.env.VITE_BROILER_SUMMARY_PDF_URL ?? "/docs/broiler-summary-sample.pdf",
            }}
          >
            <section className={sectionCardClass}>
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                <Form.Item name="reportNo" label={isEditMode ? "Report No" : "Report No (Auto Generated)"} className="!mb-0">
                  <Input size="large" readOnly className="!font-semibold !text-emerald-900" />
                </Form.Item>
              </div>
              <Divider className="!mt-0 !mb-3">Farm & Header</Divider>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Form.Item name="farmName" label="Farm Name" rules={[{ required: true, message: "Farm Name is required." }]}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="flock" label="Flock" rules={[{ required: true, message: "Flock is required." }]}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="house" label="House">
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="code" label="Code">
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="area" label="Area">
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="vatRegNo" label="VAT Reg No">
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="address" label="Address" className="md:col-span-2">
                  <Input size="large" />
                </Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Schedule</Divider>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Form.Item name="dateStart" label="Date Start">
                <Input />
              </Form.Item>
              <Form.Item name="harvestStart" label="Harvest Start">
                <Input />
              </Form.Item>
              <Form.Item name="dateFinish" label="Date Finish">
                <Input />
              </Form.Item>
              <Form.Item name="harvestPeriod" label="Harvest Period">
                <Input />
              </Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Totals / KPI</Divider>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Form.Item name="totalDocLoad" label="Total Doc Load"><Input /></Form.Item>
              <Form.Item name="totalDocStart" label="Total Doc Start"><Input /></Form.Item>
              <Form.Item name="totalHarvest" label="Total Harvest"><Input /></Form.Item>
              <Form.Item name="mortalityTotal" label="Mortality"><Input /></Form.Item>
              <Form.Item name="mortalityPercent" label="% Mortality"><Input /></Form.Item>
              <Form.Item name="eff" label="EFF"><Input /></Form.Item>
              <Form.Item name="adg" label="ADG"><Input /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Mortality</Divider>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Form.Item name="doa" label="DOA"><Input /></Form.Item>
              <Form.Item name="dead" label="Dead"><Input /></Form.Item>
              <Form.Item name="cull" label="Cull"><Input /></Form.Item>
              <Form.Item name="firstWeek" label="1st Wk"><Input /></Form.Item>
              <Form.Item name="stdMort" label="Std. Mort %"><Input /></Form.Item>
              <Form.Item name="diffMort" label="Diff. Mort %"><Input /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Feeds Phase Usage</Divider>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Form.Item name="hf510Bags" label="510 HF Bags"><Input /></Form.Item>
              <Form.Item name="hf510Kilo" label="510 HF Kilo"><Input /></Form.Item>
              <Form.Item name="hf510Percent" label="510 HF %"><Input /></Form.Item>
              <Form.Item name="hf510FeedsHead" label="510 HF Feeds/Head"><Input /></Form.Item>
              <Form.Item name="hf511Bags" label="511 HF Bags"><Input /></Form.Item>
              <Form.Item name="hf511Kilo" label="511 HF Kilo"><Input /></Form.Item>
              <Form.Item name="hf511Percent" label="511 HF %"><Input /></Form.Item>
              <Form.Item name="hf511FeedsHead" label="511 HF Feeds/Head"><Input /></Form.Item>
              <Form.Item name="feed524Bags" label="524 Bags"><Input /></Form.Item>
              <Form.Item name="feed524Kilo" label="524 Kilo"><Input /></Form.Item>
              <Form.Item name="feed524Percent" label="524 %"><Input /></Form.Item>
              <Form.Item name="feed524FeedsHead" label="524 Feeds/Head"><Input /></Form.Item>
              <Form.Item name="feed532Bags" label="532 Bags"><Input /></Form.Item>
              <Form.Item name="feed532Kilo" label="532 Kilo"><Input /></Form.Item>
              <Form.Item name="feed532Percent" label="532 %"><Input /></Form.Item>
              <Form.Item name="feed532FeedsHead" label="532 Feeds/Head"><Input /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">FCR / Harvest</Divider>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Form.Item name="fcrActual" label="FCR Actual"><Input /></Form.Item>
              <Form.Item name="fcrStd" label="FCR Std"><Input /></Form.Item>
              <Form.Item name="fcrDiff" label="FCR Diff"><Input /></Form.Item>
              <Form.Item name="qtyHarvest" label="Harvest Qty"><Input /></Form.Item>
              <Form.Item name="kiloHarvest" label="Harvest Kilo"><Input /></Form.Item>
              <Form.Item name="alw" label="ALW"><Input /></Form.Item>
              <Form.Item name="unaccountedBirds" label="Unaccounted Birds"><Input /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Scheme / Summary</Divider>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Form.Item name="growersFeeRate" label="Grower's Fee Rate"><Input /></Form.Item>
              <Form.Item name="performanceEfficiencyRate" label="Performance Efficiency Rate"><Input /></Form.Item>
              <Form.Item name="bonusFCRate" label="Bonus FC Rate"><Input /></Form.Item>
              <Form.Item name="harvestRecoveryRate" label="Harvest Recovery Rate"><Input /></Form.Item>
              <Form.Item name="lpgRate" label="LPG Rate"><Input /></Form.Item>
              <Form.Item name="electricityRate" label="Electricity Rate"><Input /></Form.Item>
              <Form.Item name="avgScheme" label="Average Scheme (Php/Head)"><Input /></Form.Item>
              <Form.Item name="cashBondRate" label="Cash Bond Rate"><Input /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <Divider className="!mt-0 !mb-3">Output</Divider>
              <Form.Item name="pdfUrl" label="PDF URL" rules={[{ required: true, message: "PDF URL is required." }]}>
                <Input placeholder="/docs/broiler-summary-sample.pdf" />
              </Form.Item>
            </section>

            <div className="sticky bottom-3 z-20 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button size="large" onClick={() => navigate(-1)}>Cancel</Button>
                <Button
                  size="large"
                  type="primary"
                  className="!bg-emerald-700 hover:!bg-emerald-600"
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {isEditMode ? "Update Income Summary" : "Save Income Summary"}
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </Content>
    </Layout>
  );
}
