// BuildingOverviewPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker, Modal, Form, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Building = {
  id: string;
  name: string;
  weeks: number;
  total: number;
  avgWeight: number;
  mortality: number;
};

type BuildingStats = {
  weeks: number;
  total: number;
  avgWeight: number;
  status: "Loading" | "Growing" | "Harvesting" | "Ready";
  mortality: number;
};

const BRAND = "#008822";

const BUILDINGS: Building[] = [
  { id: "1", name: "Building 1", weeks: 28, total: 1200, avgWeight: 1850, mortality: 14 },
  { id: "2", name: "Building 2", weeks: 41, total: 980, avgWeight: 1725, mortality: 9 },
  { id: "3", name: "Building 3", weeks: 52, total: 1500, avgWeight: 1920, mortality: 7 },
  { id: "4", name: "Building 4", weeks: 32, total: 800, avgWeight: 1680, mortality: 12 },
  { id: "5", name: "Building 5", weeks: 22, total: 1100, avgWeight: 1790, mortality: 10 },
];

const MOCK_STATS_BY_DATE: Record<string, Record<string, BuildingStats>> = {
  "2026-02-27": {
    "1": { weeks: 28, total: 1200, avgWeight: 1850, status: "Loading", mortality: 14 },
    "2": { weeks: 41, total: 980, avgWeight: 1725, status: "Growing", mortality: 9 },
    "3": { weeks: 52, total: 1500, avgWeight: 1920, status: "Harvesting", mortality: 7 },
    "4": { weeks: 32, total: 800, avgWeight: 1680, status: "Ready", mortality: 12 },
    "5": { weeks: 22, total: 1100, avgWeight: 1790, status: "Growing", mortality: 10 },
  },
  "2026-02-28": {
    "1": { weeks: 29, total: 1185, avgWeight: 1835, status: "Growing", mortality: 16 },
    "2": { weeks: 42, total: 960, avgWeight: 1710, status: "Harvesting", mortality: 11 },
    "3": { weeks: 53, total: 1480, avgWeight: 1900, status: "Ready", mortality: 9 },
    "4": { weeks: 33, total: 790, avgWeight: 1670, status: "Loading", mortality: 13 },
    "5": { weeks: 23, total: 1085, avgWeight: 1775, status: "Growing", mortality: 12 },
  },
};

function StatPill({
  label,
  value,
  leftIcon,
  rightIcon,
}: {
  label: string;
  value: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
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

function StatusBadge({ status }: { status: BuildingStats["status"] }) {
  const styles: Record<BuildingStats["status"], { dot: string; text: string }> = {
    Loading: { dot: "bg-blue-500", text: "text-blue-700" },
    Growing: { dot: "bg-emerald-500", text: "text-emerald-700" },
    Harvesting: { dot: "bg-amber-500", text: "text-amber-800" },
    Ready: { dot: "bg-slate-500", text: "text-slate-700" },
  };

  const style = styles[status];

  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold">
      <span className={["h-2 w-2 rounded-full", style.dot].join(" ")} />
      <span className={style.text}>{status}</span>
    </span>
  );
}

function BuildingRow({
  b,
  onOpen,
  isMobile,
  stats,
}: {
  b: Building;
  onOpen: () => void;
  isMobile: boolean;
  stats: BuildingStats;
}) {
  const navigate = useNavigate();
  return (
    <Card
      hoverable
      onClick={onOpen}
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
            src="/img/building.svg"
            alt="Building"
            className={isMobile ? "h-5 w-5" : "h-6 w-6"}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 14 : 16 }}>
                  {b.name}
                </div>
                <Tag
                  className="!m-0"
                  style={{
                    borderColor: `${BRAND}40`,
                    color: BRAND,
                    fontSize: isMobile ? 11 : 12,
                    paddingInline: isMobile ? 6 : 8,
                    lineHeight: isMobile ? "18px" : "20px",
                  }}
                >
                  {stats.weeks} Weeks
                </Tag>
              </div>
              {/* <div className="text-xs text-slate-500 mt-1 truncate">{b.category}</div> */}
            </div>

            {/* Load button: compact on mobile */}
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                console.log("open data for", b.id);
                navigate(`/building-load/${b.id}`);
              }}
              className={[
                "!font-medium shadow-sm !rounded-md",
                isMobile ? "!px-4 !h-9 !text-sm" : "!px-5 !h-9 !text-sm",
              ].join(" ")}
              style={{ backgroundColor: BRAND, borderColor: BRAND }}
            >
              Load
            </Button>
          </div>

          {/* Stats Row */}
          <div className={["mt-3", isMobile ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"].join(" ")}>
            <StatPill
              label="Total Birds"
              value={stats.total.toLocaleString()}
              rightIcon={<img src="/img/chicken-bird.svg" alt="" className="h-4 w-4" />}
            />
            <StatPill
              label="Avg. Weight"
              value={`${stats.avgWeight.toLocaleString()} g`}
              rightIcon={<img src="/img/weight.svg" alt="" className="h-4 w-4" />}
            />
            <StatPill label="Status" value={<StatusBadge status={stats.status} />} />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
            />
          </div>
        </div>

        {/* Chevron - hide on mobile to reduce clutter */}
        {!isMobile && <div className="text-slate-300 text-lg mt-2">›</div>}
      </div>
    </Card>
  );
}

export default function BuildingOverviewPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addForm] = Form.useForm();
  const handleSignOut = () => {
    // TODO: wire up auth sign out logic here
    console.log("sign out");
  };
  const handleOpenAdd = () => {
    const nextIndex = BUILDINGS.length + 1;
    addForm.setFieldsValue({ name: `Building ${nextIndex}` });
    setIsAddModalOpen(true);
  };
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    addForm.resetFields();
  };
  
  const handleSubmitAdd = async () => {
    try {
      const values = await addForm.validateFields();
      console.log("add building", values);
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch {
      // validation errors handled by antd
    }
  };

  const getStatsForBuilding = useMemo(() => {
    return (building: Building): BuildingStats => {
      if (selectedDate && MOCK_STATS_BY_DATE[selectedDate]?.[building.id]) {
        return MOCK_STATS_BY_DATE[selectedDate][building.id];
      }
      return {
        weeks: building.weeks,
        total: building.total,
        avgWeight: building.avgWeight,
        status: "Growing",
        mortality: building.mortality,
      };
    };
  }, [selectedDate]);

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
            Building
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

        {/* Active Buildings Section */}
        <div>
          <div className={["bg-[#00882215]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
            <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
              Active Buildings ({BUILDINGS.length})
            </div>
          </div>

          <Divider className={isMobile ? "!my-2" : "!my-3"} />

          {/* Use gap, not space-y, for consistent spacing */}
          <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
            {BUILDINGS.map((b) => (
              <BuildingRow
                key={b.id}
                b={b}
                stats={getStatsForBuilding(b)}
                isMobile={isMobile}
                onOpen={() => navigate(`/building-cage/${b.id}`)}
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
            Add Building
          </Button>
        </div>
      </Content>

      <Modal
        open={isAddModalOpen}
        onCancel={handleCloseAdd}
        footer={null}
        centered
        width={isMobile ? "90%" : 520}
        className="add-building-modal"
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Add New Building
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter the details to create a new building record.
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Building Name"
            name="name"
            rules={[{ required: true, message: "Please enter building name" }]}
          >
            <Input placeholder="e.g., Building 6" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: BRAND, borderColor: BRAND }}
              onClick={handleSubmitAdd}
            >
              Add Building
            </Button>
          </div>
        </Form>
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
