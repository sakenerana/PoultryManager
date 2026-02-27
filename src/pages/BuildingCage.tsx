import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Modal, Form, Input, InputNumber } from "antd";
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
};

type CageStats = {
  avgWeight: number;
  mortality: number;
};

const BRAND = "#008822";

export const CAGES: Cage[] = [
  { id: "1", buildingId: "1", name: "Cage 1", avgWeight: 1850, mortality: 14 },
  { id: "2", buildingId: "1", name: "Cage 2", avgWeight: 3214, mortality: 18 },
  { id: "3", buildingId: "2", name: "Cage 3", avgWeight: 1920, mortality: 7 },
  { id: "4", buildingId: "2", name: "Cage 4", avgWeight: 1680, mortality: 12 },
  { id: "5", buildingId: "3", name: "Cage 5", avgWeight: 1790, mortality: 10 },
  { id: "3", buildingId: "1", name: "Cage 3", avgWeight: 1725, mortality: 9 },
  { id: "4", buildingId: "2", name: "Cage 4", avgWeight: 1920, mortality: 7 },
  { id: "5", buildingId: "2", name: "Cage 5", avgWeight: 1680, mortality: 12 },
  { id: "6", buildingId: "3", name: "Cage 6", avgWeight: 1790, mortality: 10 },
];

const MOCK_STATS_BY_DATE: Record<string, Record<string, CageStats>> = {
  "2026-02-27": {
    "1": { avgWeight: 1850, mortality: 14 },
    "2": { avgWeight: 1725, mortality: 9 },
    "3": { avgWeight: 1920, mortality: 7 },
    "4": { avgWeight: 1680, mortality: 12 },
    "5": { avgWeight: 1790, mortality: 10 },
  },
  "2026-02-28": {
    "1": { avgWeight: 1835, mortality: 16 },
    "2": { avgWeight: 1710, mortality: 11 },
    "3": { avgWeight: 1900, mortality: 9 },
    "4": { avgWeight: 1670, mortality: 13 },
    "5": { avgWeight: 1775, mortality: 12 },
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
        "rounded-xl bg-slate-50 px-3 py-2",
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
      <div className="text-[11px] text-slate-500 leading-none">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 leading-none">
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
  onWeightClick,
  isMobile,
  stats,
  displayName,
}: {
  c: Cage;
  onMortalityClick: (cageId: string, current: number) => void;
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
        isMobile ? "!rounded-xl" : "!rounded-2xl",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 12 : 14 }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-2xl"].join(
            " "
          )}
          style={{ backgroundColor: `${BRAND}22` }}
        >
          <img
            src="/img/cage.svg"
            alt="Cage"
            className={isMobile ? "h-5 w-5" : "h-6 w-6"}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 14 : 16 }}>
                  {displayName}
                </div>
              </div>
            </div>

            <div />
          </div>

          {/* Stats Row */}
          <div className={["mt-3", isMobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"].join(" ")}>
            <StatPill
              label="Avg. Weight"
              value={`${stats.avgWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} g`}
              rightIcon={<img src="/img/weight.svg" alt="" className="h-4 w-4" />}
              onClick={() => onWeightClick(c.id)}
            />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              rightIcon={<span className="text-slate-400 text-lg leading-none">›</span>}
              onClick={() => onMortalityClick(c.id, stats.mortality)}
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
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [mortalityOverrides, setMortalityOverrides] = useState<Record<string, Record<string, number>>>({});
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState(false);
  const [activeCageId, setActiveCageId] = useState<string | null>(null);
  const [mortalityDraft, setMortalityDraft] = useState<number>(0);
  const [weightOverrides, setWeightOverrides] = useState<
    Record<string, Record<string, { front: number; middle: number; back: number }>>
  >({});
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightDraft, setWeightDraft] = useState<{ front: number; middle: number; back: number }>({
    front: 0,
    middle: 0,
    back: 0,
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addForm] = Form.useForm();
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
      console.log("add cage", values);
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
        const override = mortalityOverrides[selectedDate]?.[cage.id];
        const weightOverride = weightOverrides[selectedDate]?.[cage.id];
        const weightTotal = weightOverride
          ? weightOverride.front + weightOverride.middle + weightOverride.back
          : base.avgWeight;
        return {
          ...base,
          mortality: override ?? base.mortality,
          avgWeight: weightTotal,
        };
      }
      const override = mortalityOverrides[selectedDate]?.[cage.id];
      const weightOverride = weightOverrides[selectedDate]?.[cage.id];
      const weightTotal = weightOverride
        ? weightOverride.front + weightOverride.middle + weightOverride.back
        : cage.avgWeight;
      return {
        avgWeight: weightTotal,
        mortality: override ?? cage.mortality,
      };
    };
  }, [selectedDate, mortalityOverrides, weightOverrides]);

  const filteredCages = useMemo(() => {
    if (!id) return CAGES;
    return CAGES.filter((cage) => cage.buildingId === id);
  }, [id]);

  const openMortalityModal = (cageId: string, current: number) => {
    setActiveCageId(cageId);
    setMortalityDraft(current);
    setIsMortalityModalOpen(true);
  };

  const openWeightModal = (cageId: string) => {
    setActiveCageId(cageId);
    const existing = weightOverrides[selectedDate]?.[cageId];
    setWeightDraft(
      existing ?? {
        front: 0,
        middle: 0,
        back: 0,
      }
    );
    setIsWeightModalOpen(true);
  };

  const closeMortalityModal = () => {
    setIsMortalityModalOpen(false);
    setActiveCageId(null);
  };

  const closeWeightModal = () => {
    setIsWeightModalOpen(false);
    setActiveCageId(null);
  };

  const handleUpdateMortality = () => {
    if (!activeCageId) return;
    if (mortalityDraft <= 0) return;
    const value = Math.max(0, Math.floor(mortalityDraft || 0));
    setMortalityOverrides((prev) => {
      const next = { ...prev };
      const day = next[selectedDate] ? { ...next[selectedDate] } : {};
      day[activeCageId] = value;
      next[selectedDate] = day;
      return next;
    });
    closeMortalityModal();
    setToastMessage("Mortality updated successfully.");
    setIsToastOpen(true);
  };

  const isMortalityValid = mortalityDraft > 0;

  const handleUpdateWeight = () => {
    if (!activeCageId) return;
    if (weightDraft.front <= 0 || weightDraft.middle <= 0 || weightDraft.back <= 0) return;
    const clean = {
      front: Math.max(0, Number(weightDraft.front) || 0),
      middle: Math.max(0, Number(weightDraft.middle) || 0),
      back: Math.max(0, Number(weightDraft.back) || 0),
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

  const isWeightValid =
    weightDraft.front > 0 && weightDraft.middle > 0 && weightDraft.back > 0;

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
        style={{ backgroundColor: BRAND }}
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
            onChange={(date) => setSelectedDate(date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"))}
            style={{ fontSize: 16 }}
            styles={{ input: { fontSize: 16 } }}
          />
        </div>

        {/* Active Cages Section */}
        <div>
          <div className={["bg-[#00882215]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
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
                onMortalityClick={openMortalityModal}
                onWeightClick={openWeightModal}
              />
            ))}
          </div>
        </div>

        {/* Floating Add Button - full width on mobile */}
        <div className={["fixed z-50", isMobile ? "left-3 right-3 bottom-4" : "bottom-6 right-6"].join(" ")}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            className={["shadow-lg", isMobile ? "!w-full !rounded-xl !h-12" : "!rounded-full !px-6 !h-12"].join(" ")}
            style={{ backgroundColor: BRAND, borderColor: BRAND }}
            onClick={handleOpenAdd}
          >
            Add Cage
          </Button>
        </div>
      </Content>

      <Modal
        open={isAddModalOpen}
        onCancel={handleCloseAdd}
        footer={null}
        centered
        width={isMobile ? "90%" : 520}
        className="add-cage-modal"
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
              style={{ backgroundColor: BRAND, borderColor: BRAND }}
              onClick={handleSubmitAdd}
            >
              Add Cage
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        open={isMortalityModalOpen}
        onCancel={closeMortalityModal}
        footer={null}
        centered
        width={isMobile ? "90%" : 420}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update Mortality
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Adjust the mortality count for this cage.
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">Mortality Count</div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setMortalityDraft((v) => Math.max(0, (v || 0) - 1))}>
              -
            </Button>
            <InputNumber
              min={0}
              value={mortalityDraft}
              onChange={(v) => setMortalityDraft(Number(v) || 0)}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
            <Button onClick={() => setMortalityDraft((v) => (v || 0) + 1)}>
              +
            </Button>
          </div>
          {!isMortalityValid && (
            <div className="text-xs text-red-500 mt-2">
              Mortality count is required.
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeMortalityModal}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!flex-1"
            style={{ backgroundColor: BRAND, borderColor: BRAND }}
            onClick={handleUpdateMortality}
            disabled={!isMortalityValid}
          >
            Update
          </Button>
        </div>
      </Modal>

      <Modal
        open={isWeightModalOpen}
        onCancel={closeWeightModal}
        footer={null}
        centered
        width={isMobile ? "90%" : 420}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Update Avg. Weight
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter front, middle, and back weights (g).
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <div>
            <div className="text-[11px] text-slate-500 mb-2">Front Weight (g)</div>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              stringMode
              value={weightDraft.front}
              onChange={(v) => setWeightDraft((prev) => ({ ...prev, front: Number(v) || 0 }))}
              inputMode="decimal"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-2">Middle Weight (g)</div>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              stringMode
              value={weightDraft.middle}
              onChange={(v) => setWeightDraft((prev) => ({ ...prev, middle: Number(v) || 0 }))}
              inputMode="decimal"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-2">Back Weight (g)</div>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              stringMode
              value={weightDraft.back}
              onChange={(v) => setWeightDraft((prev) => ({ ...prev, back: Number(v) || 0 }))}
              inputMode="decimal"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Total: {(weightDraft.front + weightDraft.middle + weightDraft.back).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} g
          </div>
          {!isWeightValid && (
            <div className="text-xs text-red-500 mt-2">
              Front, middle, and back weights are required.
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeWeightModal}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!flex-1"
            style={{ backgroundColor: BRAND, borderColor: BRAND }}
            onClick={handleUpdateWeight}
            disabled={!isWeightValid}
          >
            Update
          </Button>
        </div>
      </Modal>
      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
