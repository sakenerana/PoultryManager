import { Button, DatePicker, Divider, Form, Input, InputNumber, Layout, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome, IoCalendarOutline, IoStatsChartOutline, IoLeafOutline, IoDocumentTextOutline } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useLocation, useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const INCOME_SUMMARY_TABLE = import.meta.env.VITE_SUPABASE_INCOME_SUMMARY_TABLE ?? "IncomeSummary";
const DEFAULT_PDF_URL = import.meta.env.VITE_BROILER_SUMMARY_PDF_URL ?? "/docs/broiler-summary-sample.pdf";
const { Header, Content } = Layout;
const { Title } = Typography;

const sectionCardClass =
  "rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-sm backdrop-blur-sm md:p-4";

const toNullableNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type IncomeSummaryFormValues = {
  reportNo: string;
  farmName: string;
  flock: string;
  dateStart: Dayjs | null;
  dateFinish: Dayjs | null;
  harvestStart: Dayjs | null;
  harvestPeriod: string | number | null;
  address: string;
  code: string;
  house: string;
  area: string;
  vatRegNo: string;
  totalDocLoad: string | number | null;
  totalDocStart: string | number | null;
  totalHarvest: string | number | null;
  mortalityTotal: string | number | null;
  mortalityPercent: string | number | null;
  eff: string | number | null;
  adg: string | number | null;
  doa: string | number | null;
  dead: string | number | null;
  cull: string | number | null;
  firstWeek: string | number | null;
  stdMort: string | number | null;
  diffMort: string | number | null;
  hf510Bags: string | number | null;
  hf510Kilo: string | number | null;
  hf510Percent: string | number | null;
  hf510FeedsHead: string | number | null;
  hf511Bags: string | number | null;
  hf511Kilo: string | number | null;
  hf511Percent: string | number | null;
  hf511FeedsHead: string | number | null;
  feed524Bags: string | number | null;
  feed524Kilo: string | number | null;
  feed524Percent: string | number | null;
  feed524FeedsHead: string | number | null;
  feed532Bags: string | number | null;
  feed532Kilo: string | number | null;
  feed532Percent: string | number | null;
  feed532FeedsHead: string | number | null;
  feedsTotalBags: string;
  feedsTotalKilo: string;
  feedsTotalPercent: string;
  feedsTotalHead: string;
  fcrActual: string | number | null;
  fcrStd: string | number | null;
  fcrDiff: string | number | null;
  qtyHarvest: string | number | null;
  kiloHarvest: string | number | null;
  alw: string | number | null;
  unaccountedBirds: string | number | null;
  growersFeeRate: string | number | null;
  performanceEfficiencyRate: string | number | null;
  bonusFCRate: string | number | null;
  harvestRecoveryRate: string | number | null;
  lpgRate: string | number | null;
  electricityRate: string | number | null;
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
  const SectionTitle = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/65 px-3 py-2">
      {icon ? <span className="text-emerald-700">{icon}</span> : null}
      <span className="text-sm font-semibold tracking-wide text-emerald-900">{title}</span>
    </div>
  );
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
        dateStart: data.date_start ? dayjs(String(data.date_start)) : null,
        harvestStart: data.harvest_start ? dayjs(String(data.harvest_start)) : null,
        dateFinish: data.date_finish ? dayjs(String(data.date_finish)) : null,
        harvestPeriod: toNullableNumber(data.harvest_period),
        totalDocLoad: toNullableNumber(data.total_doc_load),
        totalDocStart: toNullableNumber(data.total_doc_start),
        totalHarvest: toNullableNumber(data.total_harvest),
        mortalityTotal: toNullableNumber(data.mortality),
        mortalityPercent: toNullableNumber(data.mortality_percent),
        eff: toNullableNumber(data.eff),
        adg: toNullableNumber(data.adg),
        vatRegNo: String(data.vat_reg_no ?? ""),
        doa: toNullableNumber(data.DOA),
        dead: toNullableNumber(data.Dead),
        cull: toNullableNumber(data.Cull),
        firstWeek: toNullableNumber(data.first_week),
        stdMort: toNullableNumber(data.std_mort_percent),
        diffMort: toNullableNumber(data.diff_mort_percent),
        hf510Bags: toNullableNumber(data["510_hf_bags"]),
        hf510Kilo: toNullableNumber(data["510_hf_kilo"]),
        hf510Percent: toNullableNumber(data["510_hf_percent"]),
        hf510FeedsHead: toNullableNumber(data["510_hf_feeds/head"]),
        hf511Bags: toNullableNumber(data["511_hf_bags"]),
        hf511Kilo: toNullableNumber(data["511_hf_kilo"]),
        hf511Percent: toNullableNumber(data["511_hf_percent"]),
        hf511FeedsHead: toNullableNumber(data["511_hf_feeds/head"]),
        feed524Bags: toNullableNumber(data["524_bags"]),
        feed524Kilo: toNullableNumber(data["524_kilo"]),
        feed524Percent: toNullableNumber(data["524_percent"]),
        feed524FeedsHead: toNullableNumber(data["524_feeds/head"]),
        feed532Bags: toNullableNumber(data["532_bags"]),
        feed532Kilo: toNullableNumber(data["532_kilo"]),
        feed532Percent: toNullableNumber(data["532_percent"]),
        feed532FeedsHead: toNullableNumber(data["532_feeds/head"]),
        fcrActual: toNullableNumber(data.fcr_actual),
        fcrStd: toNullableNumber(data.fcr_std),
        fcrDiff: toNullableNumber(data.fcr_diff),
        qtyHarvest: toNullableNumber(data.harvest_qty),
        kiloHarvest: toNullableNumber(data.harvest_kilo),
        alw: toNullableNumber(data.alw),
        unaccountedBirds: toNullableNumber(data.unaccounted_birds),
        growersFeeRate: toNullableNumber(data.growers_fee_rate),
        performanceEfficiencyRate: toNullableNumber(data.performance_efficiency_rate),
        bonusFCRate: toNullableNumber(data.bonus_fc_rate),
        harvestRecoveryRate: toNullableNumber(data.harvest_recovery_rate),
        lpgRate: toNullableNumber(data.lpg_rate),
        electricityRate: toNullableNumber(data.electricity_rate),
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
        date_start: values.dateStart ? values.dateStart.format("YYYY-MM-DD") : null,
        harvest_start: values.harvestStart ? values.harvestStart.format("YYYY-MM-DD") : null,
        date_finish: values.dateFinish ? values.dateFinish.format("YYYY-MM-DD") : null,
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
        "524_bags": toNumber(values.feed524Bags),
        "524_kilo": toNumber(values.feed524Kilo),
        "524_percent": toNumber(values.feed524Percent),
        "524_feeds/head": toNumber(values.feed524FeedsHead),
        "532_bags": toNumber(values.feed532Bags),
        "532_kilo": toNumber(values.feed532Kilo),
        "532_percent": toNumber(values.feed532Percent),
        "532_feeds/head": toNumber(values.feed532FeedsHead),
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
            className="space-y-2.5 [&_.ant-form-item]:!mb-2 [&_.ant-form-item-label>label]:!text-slate-700 [&_.ant-form-item-label>label]:!text-[13px] [&_.ant-form-item-label]:!pb-0.5 [&_.ant-input]:!rounded-lg [&_.ant-input-number]:!rounded-lg [&_.ant-picker]:!rounded-lg"
            initialValues={{
              reportNo: autoReportNo || fallbackReportNo,
              pdfUrl: DEFAULT_PDF_URL,
            }}
          >
            <section className={sectionCardClass}>
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <Form.Item name="reportNo" label={isEditMode ? "Report No" : "Report No (Auto Generated)"} className="!mb-0">
                  <Input size="large" readOnly className="!font-semibold !text-emerald-900" />
                </Form.Item>
              </div>
              <SectionTitle title="Farm & Header" icon={<IoLeafOutline size={16} />} />
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
              <SectionTitle title="Schedule" icon={<IoCalendarOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Form.Item name="dateStart" label="Date Start">
                <DatePicker size="large" className="!w-full" format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="harvestStart" label="Harvest Start">
                <DatePicker size="large" className="!w-full" format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="dateFinish" label="Date Finish">
                <DatePicker size="large" className="!w-full" format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="harvestPeriod" label="Harvest Period">
                <InputNumber className="!w-full" controls={false} placeholder="0" />
              </Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="Totals / KPI" icon={<IoStatsChartOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Form.Item name="totalDocLoad" label="Total Doc Load"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="totalDocStart" label="Total Doc Start"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="totalHarvest" label="Total Harvest"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="mortalityTotal" label="Mortality"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="mortalityPercent" label="% Mortality"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="eff" label="EFF"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="adg" label="ADG"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="Mortality" icon={<IoStatsChartOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Form.Item name="doa" label="DOA"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="dead" label="Dead"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="cull" label="Cull"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="firstWeek" label="1st Wk"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="stdMort" label="Std. Mort %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="diffMort" label="Diff. Mort %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="Feeds Phase Usage" icon={<IoLeafOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Form.Item name="hf510Bags" label="510 HF Bags"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf510Kilo" label="510 HF Kilo"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf510Percent" label="510 HF %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf510FeedsHead" label="510 HF Feeds/Head"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf511Bags" label="511 HF Bags"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf511Kilo" label="511 HF Kilo"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf511Percent" label="511 HF %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="hf511FeedsHead" label="511 HF Feeds/Head"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed524Bags" label="524 Bags"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed524Kilo" label="524 Kilo"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed524Percent" label="524 %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed524FeedsHead" label="524 Feeds/Head"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed532Bags" label="532 Bags"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed532Kilo" label="532 Kilo"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed532Percent" label="532 %"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="feed532FeedsHead" label="532 Feeds/Head"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="FCR / Harvest" icon={<IoStatsChartOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Form.Item name="fcrActual" label="FCR Actual"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="fcrStd" label="FCR Std"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="fcrDiff" label="FCR Diff"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="qtyHarvest" label="Harvest Qty"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="kiloHarvest" label="Harvest Kilo"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="alw" label="ALW"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="unaccountedBirds" label="Unaccounted Birds"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="Scheme / Summary" icon={<IoStatsChartOutline size={16} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Form.Item name="growersFeeRate" label="Grower's Fee Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="performanceEfficiencyRate" label="Performance Efficiency Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="bonusFCRate" label="Bonus FC Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="harvestRecoveryRate" label="Harvest Recovery Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="lpgRate" label="LPG Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="electricityRate" label="Electricity Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="avgScheme" label="Average Scheme (Php/Head)"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              <Form.Item name="cashBondRate" label="Cash Bond Rate"><InputNumber className="!w-full" controls={false} placeholder="0" /></Form.Item>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionTitle title="Output" icon={<IoDocumentTextOutline size={16} />} />
              <Form.Item name="pdfUrl" label="PDF URL" rules={[{ required: true, message: "PDF URL is required." }]}>
                <Input placeholder="/docs/broiler-summary-sample.pdf" />
              </Form.Item>
            </section>

            <div className="sticky bottom-2 z-20 rounded-xl border border-emerald-100 bg-white/92 p-2.5 shadow-lg backdrop-blur-sm md:bottom-4 md:p-3">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button size="large" className="sm:!min-w-[110px]" onClick={() => navigate(-1)}>Cancel</Button>
                <Button
                  size="large"
                  type="primary"
                  className="w-full !rounded-lg !bg-emerald-700 !font-semibold hover:!bg-emerald-600 sm:!w-auto sm:!min-w-[220px]"
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
