import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Drawer, Form, Input, InputNumber, Tabs } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

export type Cage = {
  id: string;
  buildingId: string;
  name: string;
  avgWeight: number;
  mortality: number;
  thinning: number;
  takeOut: number;
};

type CageStats = {
  avgWeight: number;
  mortality: number;
  thinning: number;
  takeOut: number;
};

type WeightEntry = {
  frontWeights: number[];
  middleWeights: number[];
  backWeights: number[];
};
type EditableMetric = "mortality" | "thinning" | "takeOut";

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";

export const CAGES: Cage[] = [
  { id: "1", buildingId: "1", name: "Cage 1", avgWeight: 1850, mortality: 14, thinning: 8, takeOut: 4 },
  { id: "2", buildingId: "1", name: "Cage 2", avgWeight: 3214, mortality: 18, thinning: 10, takeOut: 5 },
  { id: "3", buildingId: "2", name: "Cage 3", avgWeight: 1920, mortality: 7, thinning: 7, takeOut: 3 },
  { id: "4", buildingId: "2", name: "Cage 4", avgWeight: 1680, mortality: 12, thinning: 9, takeOut: 4 },
  { id: "5", buildingId: "3", name: "Cage 5", avgWeight: 1790, mortality: 10, thinning: 8, takeOut: 4 },
  { id: "3", buildingId: "1", name: "Cage 3", avgWeight: 1725, mortality: 9, thinning: 6, takeOut: 3 },
  { id: "4", buildingId: "2", name: "Cage 4", avgWeight: 1920, mortality: 7, thinning: 7, takeOut: 3 },
  { id: "5", buildingId: "2", name: "Cage 5", avgWeight: 1680, mortality: 12, thinning: 9, takeOut: 4 },
  { id: "6", buildingId: "3", name: "Cage 6", avgWeight: 1790, mortality: 10, thinning: 8, takeOut: 4 },
];

const MOCK_STATS_BY_DATE: Record<string, Record<string, CageStats>> = {
  "2026-02-27": {
    "1": { avgWeight: 1850, mortality: 14, thinning: 8, takeOut: 4 },
    "2": { avgWeight: 1725, mortality: 9, thinning: 6, takeOut: 3 },
    "3": { avgWeight: 1920, mortality: 7, thinning: 7, takeOut: 3 },
    "4": { avgWeight: 1680, mortality: 12, thinning: 9, takeOut: 4 },
    "5": { avgWeight: 1790, mortality: 10, thinning: 8, takeOut: 4 },
  },
  "2026-02-28": {
    "1": { avgWeight: 1835, mortality: 16, thinning: 9, takeOut: 4 },
    "2": { avgWeight: 1710, mortality: 11, thinning: 7, takeOut: 3 },
    "3": { avgWeight: 1900, mortality: 9, thinning: 8, takeOut: 4 },
    "4": { avgWeight: 1670, mortality: 13, thinning: 10, takeOut: 5 },
    "5": { avgWeight: 1775, mortality: 12, thinning: 9, takeOut: 4 },
  },
};

function StatPill({
  label,
  value,
  leftIcon,
  rightIcon,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={[
        "rounded-lg bg-slate-50 px-2 py-1.5",
        onClick ? "cursor-pointer hover:bg-slate-100 transition" : "",
      ].join(" ")}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className="text-[10px] text-slate-500 leading-none">{label}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 leading-none">
          {leftIcon}
          {value}
        </div>
        {rightIcon}
      </div>
    </div>
  );
}

function CageRow({
  c,
  onMortalityClick,
  onThinningClick,
  onTakeOutClick,
  onWeightClick,
  isMobile,
  stats,
  displayName,
}: {
  c: Cage;
  onMortalityClick: (cageId: string, current: number) => void;
  onThinningClick: (cageId: string, current: number) => void;
  onTakeOutClick: (cageId: string, current: number) => void;
  onWeightClick: (cageId: string) => void;
  isMobile: boolean;
  stats: CageStats;
  displayName: string;
}) {
  return (
    <Card
      hoverable
      className={[
        "!border-0 shadow-sm hover:shadow-md transition cursor-pointer",
        "!rounded-sm",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 12 }}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img
            src="/img/cage2.svg"
            alt="Cage"
            className={isMobile ? "h-5 w-5" : "h-5 w-5"}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
                  {displayName}
                </div>
              </div>
            </div>

            <div />
          </div>

          {/* Stats Row */}
          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Avg. Weight"
              value={`${stats.avgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} g`}
              rightIcon={<span className="text-slate-400 text-base leading-none">›</span>}
              onClick={() => onWeightClick(c.id)}
            />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">›</span>}
              onClick={() => onMortalityClick(c.id, stats.mortality)}
            />
            <StatPill
              label="Thinning"
              value={stats.thinning.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">›</span>}
              onClick={() => onThinningClick(c.id, stats.thinning)}
            />
            <StatPill
              label="Take Out"
              value={stats.takeOut.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-base leading-none">›</span>}
              onClick={() => onTakeOutClick(c.id, stats.takeOut)}
            />
          </div>
        </div>

        {/* Chevron - hide on mobile to reduce clutter */}
        {!isMobile && <div className="text-slate-300 text-lg mt-2">›</div>}
      </div>
    </Card>
  );
}

export default function BuildingCage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [cages, setCages] = useState<Cage[]>(CAGES);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const [metricOverrides, setMetricOverrides] = useState<Record<EditableMetric, Record<string, Record<string, number>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
  });
  const [metricRemarksByType, setMetricRemarksByType] = useState<Record<EditableMetric, Record<string, Record<string, string>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
  });
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [activeCageId, setActiveCageId] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<EditableMetric>("mortality");
  const [metricDraft, setMetricDraft] = useState<number>(0);
  const [metricRemarksDraft, setMetricRemarksDraft] = useState<string>("");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, Record<string, WeightEntry>>>({});
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightDraft, setWeightDraft] = useState<WeightEntry>({
    frontWeights: [0],
    middleWeights: [0],
    backWeights: [0],
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addForm] = Form.useForm();
  const handleDateChange = (date: dayjs.Dayjs | null) => {
    const nextDate = date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
    setToastMessage(`Filtered date: ${dayjs(nextDate).format("MMM D, YYYY")}`);
    setIsToastOpen(true);
  };

  const handleSignOut = () => {
    // TODO: wire up auth sign out logic here
    console.log("sign out");
  };
  const handleOpenAdd = () => {
    const nextIndex = filteredCages.length + 1;
    addForm.setFieldsValue({ name: `Cage ${nextIndex}` });
    setIsAddModalOpen(true);
  };
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    addForm.resetFields();
  };

  const handleSubmitAdd = async () => {
    try {
      const values = await addForm.validateFields();
      const nextId = (Math.max(0, ...cages.map((cage) => Number(cage.id) || 0)) + 1).toString();
      const newCage: Cage = {
        id: nextId,
        buildingId: id ?? "1",
        name: values.name,
        avgWeight: 0,
        mortality: 0,
        thinning: 0,
        takeOut: 0,
      };
      setCages((prev) => [...prev, newCage]);
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch {
      // validation errors handled by antd
    }
  };

  const getStatsForCage = useMemo(() => {
    return (cage: Cage): CageStats => {
      if (selectedDate && MOCK_STATS_BY_DATE[selectedDate]?.[cage.id]) {
        const base = MOCK_STATS_BY_DATE[selectedDate][cage.id];
        const mortalityOverride = metricOverrides.mortality[selectedDate]?.[cage.id];
        const thinningOverride = metricOverrides.thinning[selectedDate]?.[cage.id];
        const takeOutOverride = metricOverrides.takeOut[selectedDate]?.[cage.id];
        const weightOverride = weightOverrides[selectedDate]?.[cage.id];
        const weightTotal = weightOverride
          ? weightOverride.frontWeights.reduce((sum, w) => sum + w, 0) +
          weightOverride.middleWeights.reduce((sum, w) => sum + w, 0) +
          weightOverride.backWeights.reduce((sum, w) => sum + w, 0)
          : base.avgWeight;
        return {
          avgWeight: weightTotal,
          mortality: mortalityOverride ?? base.mortality,
          thinning: thinningOverride ?? base.thinning,
          takeOut: takeOutOverride ?? base.takeOut,
        };
      }
      const mortalityOverride = metricOverrides.mortality[selectedDate]?.[cage.id];
      const thinningOverride = metricOverrides.thinning[selectedDate]?.[cage.id];
      const takeOutOverride = metricOverrides.takeOut[selectedDate]?.[cage.id];
      const weightOverride = weightOverrides[selectedDate]?.[cage.id];
      const weightTotal = weightOverride
        ? weightOverride.frontWeights.reduce((sum, w) => sum + w, 0) +
        weightOverride.middleWeights.reduce((sum, w) => sum + w, 0) +
        weightOverride.backWeights.reduce((sum, w) => sum + w, 0)
        : cage.avgWeight;
      return {
        avgWeight: weightTotal,
        mortality: mortalityOverride ?? cage.mortality,
        thinning: thinningOverride ?? cage.thinning,
        takeOut: takeOutOverride ?? cage.takeOut,
      };
    };
  }, [selectedDate, metricOverrides, weightOverrides]);

  const filteredCages = useMemo(() => {
    if (!id) return cages;
    return cages.filter((cage) => cage.buildingId === id);
  }, [id, cages]);

  const metricMeta: Record<EditableMetric, { title: string; helper: string; label: string; success: string }> = {
    mortality: {
      title: "Mortality",
      helper: "Adjust the mortality count for this cage.",
      label: "Mortality Count",
      success: "Mortality updated successfully.",
    },
    thinning: {
      title: "Thinning",
      helper: "Adjust the thinning count for this cage.",
      label: "Thinning Count",
      success: "Thinning updated successfully.",
    },
    takeOut: {
      title: "Take Out",
      helper: "Adjust the take out count for this cage.",
      label: "Take Out Count",
      success: "Take out updated successfully.",
    },
  };

  const openMetricModal = (metric: EditableMetric, cageId: string, current: number) => {
    const existingRemarks = metricRemarksByType[metric][selectedDate]?.[cageId] ?? "";
    setActiveMetric(metric);
    setActiveCageId(cageId);
    setMetricDraft(current);
    setMetricRemarksDraft(existingRemarks);
    setIsMetricModalOpen(true);
  };

  const openWeightModal = (cageId: string) => {
    setActiveCageId(cageId);
    const existing = weightOverrides[selectedDate]?.[cageId];
    setWeightDraft(
      existing ?? {
        frontWeights: [0],
        middleWeights: [0],
        backWeights: [0],
      }
    );
    setIsWeightModalOpen(true);
  };

  const closeMetricModal = () => {
    setIsMetricModalOpen(false);
    setActiveCageId(null);
    setMetricRemarksDraft("");
  };

  const closeWeightModal = () => {
    setIsWeightModalOpen(false);
    setActiveCageId(null);
  };

  const handleUpdateMetric = () => {
    if (!activeCageId) return;
    if (!isTodaySelected) return;
    if (metricDraft <= 0) return;
    const value = Math.max(0, Math.floor(metricDraft || 0));
    setMetricOverrides((prev) => {
      const next = { ...prev };
      const selectedMetric = { ...next[activeMetric] };
      const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
      day[activeCageId] = value;
      selectedMetric[selectedDate] = day;
      next[activeMetric] = selectedMetric;
      return next;
    });
    setMetricRemarksByType((prev) => {
      const next = { ...prev };
      const selectedMetric = { ...next[activeMetric] };
      const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
      day[activeCageId] = metricRemarksDraft.trim();
      selectedMetric[selectedDate] = day;
      next[activeMetric] = selectedMetric;
      return next;
    });
    closeMetricModal();
    setToastMessage(metricMeta[activeMetric].success);
    setIsToastOpen(true);
  };

  const isMetricValid = metricDraft > 0;

  const handleUpdateWeight = () => {
    if (!activeCageId) return;
    if (!isTodaySelected) return;
    const frontWeights = weightDraft.frontWeights.map((w) => Math.max(0, Number(w) || 0));
    const middleWeights = weightDraft.middleWeights.map((w) => Math.max(0, Number(w) || 0));
    const backWeights = weightDraft.backWeights.map((w) => Math.max(0, Number(w) || 0));
    const clean = {
      frontWeights,
      middleWeights,
      backWeights,
    };
    setWeightOverrides((prev) => {
      const next = { ...prev };
      const day = next[selectedDate] ? { ...next[selectedDate] } : {};
      day[activeCageId] = clean;
      next[selectedDate] = day;
      return next;
    });
    closeWeightModal();
    setToastMessage("Average weight updated successfully.");
    setIsToastOpen(true);
  };

  const totalFrontWeight = weightDraft.frontWeights.reduce((sum, w) => sum + w, 0);
  const totalMiddleWeight = weightDraft.middleWeights.reduce((sum, w) => sum + w, 0);
  const totalBackWeight = weightDraft.backWeights.reduce((sum, w) => sum + w, 0);
  const totalWeight = totalFrontWeight + totalMiddleWeight + totalBackWeight;

  const totals = useMemo(() => {
    const totalAvgWeight = filteredCages.reduce((sum, c) => sum + getStatsForCage(c).avgWeight, 0);
    const totalMortality = filteredCages.reduce((sum, c) => sum + getStatsForCage(c).mortality, 0);
    return { totalAvgWeight, totalMortality };
  }, [filteredCages, getStatsForCage]);

  return (
    <Layout className="min-h-screen bg-slate-100">
      {/* Header */}
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-4 !h-16",
        ].join(" ")}
        style={{ backgroundColor: PRIMARY }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Button
            type="text"
            icon={<HomeOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Title level={4} className={["!m-0 !text-white", isMobile ? "!text-base" : ""].join(" ")}>
            Cage
          </Title>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        {/* divider */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-4 py-4"}>
        {/* Date Filter */}
        <div
          className={[
            "bg-white shadow-sm",
            isMobile ? "rounded-lg px-3 py-3 mb-3" : "rounded-xl px-4 py-4 mb-4",
          ].join(" ")}
        >
          <div className={["text-slate-600 font-medium", isMobile ? "text-xs mb-2" : "text-sm mb-2"].join(" ")}>
            Date
          </div>
          <DatePicker
            className={isMobile ? "!w-full" : "!w-[220px]"}
            size={isMobile ? "middle" : "large"}
            placeholder="Select date"
            defaultValue={dayjs()}
            onChange={handleDateChange}
            style={{ fontSize: 16 }}
            styles={{ input: { fontSize: 16 } }}
          />
        </div>

        {/* Active Cages Section */}
        <div>
          <div className={["bg-[#ffa6001f]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
            <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
              Active Cages ({filteredCages.length})
            </div>
          </div>

          <Divider className={isMobile ? "!my-2" : "!my-3"} />

          <div className="bg-white rounded-xl shadow-sm p-3 mb-3 flex items-center justify-between text-sm">
            <div className="text-slate-600">
              Total Avg. Weight:{" "}
              <span className="font-semibold text-slate-900">{totals.totalAvgWeight.toLocaleString()} g</span>
            </div>
            <div className="text-slate-600">
              Total Mortality:{" "}
              <span className="font-semibold text-slate-900">{totals.totalMortality.toLocaleString()}</span>
            </div>
          </div>

          {/* Use gap, not space-y, for consistent spacing */}
          <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
            {filteredCages.map((c, index) => (
              <CageRow
                key={c.id}
                c={c}
                stats={getStatsForCage(c)}
                isMobile={isMobile}
                displayName={`Cage ${index + 1}`}
                onMortalityClick={(cageId, current) => openMetricModal("mortality", cageId, current)}
                onThinningClick={(cageId, current) => openMetricModal("thinning", cageId, current)}
                onTakeOutClick={(cageId, current) => openMetricModal("takeOut", cageId, current)}
                onWeightClick={openWeightModal}
              />
            ))}
          </div>
        </div>

        {/* Floating Add Button */}
        {isTodaySelected && (
          <div className={["fixed z-50", "bottom-6 right-6"].join(" ")}>
            <Button
              type="primary"
              size="large"
              icon={
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/90">
                  <PlusOutlined className="text-[12px]" style={{ color: SECONDARY }} />
                </span>
              }
              className="shadow-lg !rounded-full !px-4 !h-10 !text-sm !font-semibold"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleOpenAdd}
            >
              Add
            </Button>
          </div>
        )}
      </Content>

      <Drawer
        open={isAddModalOpen}
        onClose={handleCloseAdd}
        placement="bottom"
        height={isMobile ? "60%" : 420}
        className="add-cage-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Add New Cage
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter the details to create a new cage record.
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Cage Name"
            name="name"
            rules={[{ required: true, message: "Please enter cage name" }]}
          >
            <Input placeholder="e.g., Cage 6" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
            >
              Add Cage
            </Button>
          </div>
        </Form>
      </Drawer>

      <Drawer
        open={isMetricModalOpen}
        onClose={closeMetricModal}
        placement="bottom"
        height={isMobile ? "60%" : 420}
        className="metric-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update {metricMeta[activeMetric].title}
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            {metricMeta[activeMetric].helper}
          </div>
          {!isTodaySelected && (
            <div className="text-amber-600 text-xs mt-1">
              Previous dates are view-only.
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">{metricMeta[activeMetric].label}</div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setMetricDraft((v) => Math.max(0, (v || 0) - 1))}
              disabled={!isTodaySelected}
            >
              -
            </Button>
            <InputNumber
              min={0}
              value={metricDraft}
              onChange={(v) => setMetricDraft(Number(v) || 0)}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
              disabled={!isTodaySelected}
            />
            <Button
              onClick={() => setMetricDraft((v) => (v || 0) + 1)}
              disabled={!isTodaySelected}
            >
              +
            </Button>
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 mb-2">Remarks</div>
            <Input.TextArea
              rows={3}
              value={metricRemarksDraft}
              onChange={(e) => setMetricRemarksDraft(e.target.value)}
              placeholder="Add remarks (optional)"
              className="!text-base"
              disabled={!isTodaySelected}
            />
          </div>
          {isTodaySelected && !isMetricValid && (
            <div className="text-xs text-red-500 mt-2">
              {metricMeta[activeMetric].label} is required.
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeMetricModal}>
            Cancel
          </Button>
          {isTodaySelected && (
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleUpdateMetric}
              disabled={!isMetricValid}
            >
              Update
            </Button>
          )}
        </div>
      </Drawer>

      <Drawer
        open={isWeightModalOpen}
        onClose={closeWeightModal}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="weight-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update Avg. Weight
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter individual chicken weights by section (g).
          </div>
          {!isTodaySelected && (
            <div className="text-amber-600 text-xs mt-1">
              Previous dates are view-only.
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <Tabs
            type="card"
            size="large"
            className={[
              "weight-section-tabs",
              "[&_.ant-tabs-nav]:!mb-3",
              "[&_.ant-tabs-nav-list]:!w-full",
              "[&_.ant-tabs-tab]:!m-0",
              "[&_.ant-tabs-tab]:!flex-1",
              "[&_.ant-tabs-tab]:!justify-center",
              "[&_.ant-tabs-tab]:!text-sm",
              "[&_.ant-tabs-tab]:!font-semibold",
              "[&_.ant-tabs-tab]:!py-2",
              "[&_.ant-tabs-tab]:!px-2",
              "[&_.ant-tabs-tab]:!bg-white",
              "[&_.ant-tabs-tab]:!border-slate-200",
              "[&_.ant-tabs-tab-active]:!bg-[#ffa600]",
              "[&_.ant-tabs-tab-active]:!border-[#ffa600]",
              "[&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:!text-white",
            ].join(" ")}
            items={[
              {
                key: "front",
                label: "Front",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Front Chicken Weights (g)</div>
                    <div className="space-y-2">
                      {weightDraft.frontWeights.map((weight, index) => (
                        <div key={`front-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                frontWeights: prev.frontWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                frontWeights:
                                  prev.frontWeights.length === 1
                                    ? prev.frontWeights
                                    : prev.frontWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected || weightDraft.frontWeights.length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          setWeightDraft((prev) => ({
                            ...prev,
                            frontWeights: [...prev.frontWeights, 0],
                          }))
                        }
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Front Weight: {totalFrontWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} g
                    </div>
                  </div>
                ),
              },
              {
                key: "middle",
                label: "Middle",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Middle Chicken Weights (g)</div>
                    <div className="space-y-2">
                      {weightDraft.middleWeights.map((weight, index) => (
                        <div key={`middle-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                middleWeights: prev.middleWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                middleWeights:
                                  prev.middleWeights.length === 1
                                    ? prev.middleWeights
                                    : prev.middleWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected || weightDraft.middleWeights.length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          setWeightDraft((prev) => ({
                            ...prev,
                            middleWeights: [...prev.middleWeights, 0],
                          }))
                        }
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Middle Weight: {totalMiddleWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} g
                    </div>
                  </div>
                ),
              },
              {
                key: "back",
                label: "Back",
                children: (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-2">Back Chicken Weights (g)</div>
                    <div className="space-y-2">
                      {weightDraft.backWeights.map((weight, index) => (
                        <div key={`back-weight-${index}`} className="flex items-center gap-2">
                          <div className="w-10 text-center text-xs font-semibold text-slate-600">
                            #{index + 1}
                          </div>
                          <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            stringMode
                            value={weight}
                            onChange={(v) =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                backWeights: prev.backWeights.map((w, i) => (i === index ? Number(v) || 0 : w)),
                              }))
                            }
                            inputMode="decimal"
                            className="!w-full"
                            styles={{ input: { fontSize: 16 } }}
                            disabled={!isTodaySelected}
                          />
                          <Button
                            onClick={() =>
                              setWeightDraft((prev) => ({
                                ...prev,
                                backWeights:
                                  prev.backWeights.length === 1
                                    ? prev.backWeights
                                    : prev.backWeights.filter((_, i) => i !== index),
                              }))
                            }
                            disabled={!isTodaySelected || weightDraft.backWeights.length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          setWeightDraft((prev) => ({
                            ...prev,
                            backWeights: [...prev.backWeights, 0],
                          }))
                        }
                        icon={<PlusOutlined />}
                        disabled={!isTodaySelected}
                      >
                        Add Chicken
                      </Button>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">
                      Total Back Weight: {totalBackWeight.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} g
                    </div>
                  </div>
                ),
              },
            ]}
          />
          <div className="text-sm font-semibold text-slate-800">
            Total: {totalWeight.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} g
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeWeightModal}>
            Cancel
          </Button>
          {isTodaySelected && (
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleUpdateWeight}
            >
              Update
            </Button>
          )}
        </div>
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
