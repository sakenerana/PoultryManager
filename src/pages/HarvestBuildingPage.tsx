// HarvestBuildingPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker, Drawer, Form, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Building = {
  id: string;
  name: string;
  days: number;
  total: number;
  avgWeight: number;
  mortality: number;
};

type BuildingStats = {
  days: number;
  total: number;
  avgWeight: number;
  status: "Loading" | "Growing" | "Harvesting" | "Ready";
  mortality: number;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";

const BUILDINGS: Building[] = [
  { id: "1", name: "Building 1", days: 28, total: 1200, avgWeight: 1850, mortality: 14 },
  { id: "2", name: "Building 2", days: 41, total: 980, avgWeight: 1725, mortality: 9 },
  { id: "3", name: "Building 3", days: 52, total: 1500, avgWeight: 1920, mortality: 7 },
  { id: "4", name: "Building 4", days: 32, total: 800, avgWeight: 1680, mortality: 12 },
  { id: "5", name: "Building 5", days: 22, total: 1100, avgWeight: 1790, mortality: 10 },
];

const MOCK_STATS_BY_DATE: Record<string, Record<string, BuildingStats>> = {
  "2026-02-27": {
    "1": { days: 28, total: 1200, avgWeight: 1850, status: "Loading", mortality: 14 },
    "2": { days: 41, total: 980, avgWeight: 1725, status: "Growing", mortality: 9 },
    "3": { days: 52, total: 1500, avgWeight: 1920, status: "Harvesting", mortality: 7 },
    "4": { days: 32, total: 800, avgWeight: 1680, status: "Ready", mortality: 12 },
    "5": { days: 22, total: 1100, avgWeight: 1790, status: "Growing", mortality: 10 },
  },
  "2026-02-28": {
    "1": { days: 29, total: 1185, avgWeight: 1835, status: "Growing", mortality: 16 },
    "2": { days: 42, total: 960, avgWeight: 1710, status: "Harvesting", mortality: 11 },
    "3": { days: 53, total: 1480, avgWeight: 1900, status: "Ready", mortality: 9 },
    "4": { days: 33, total: 790, avgWeight: 1670, status: "Loading", mortality: 13 },
    "5": { days: 23, total: 1085, avgWeight: 1775, status: "Growing", mortality: 12 },
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
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
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
  canLoad,
}: {
  b: Building;
  onOpen: () => void;
  isMobile: boolean;
  stats: BuildingStats;
  canLoad: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Card
      hoverable
      onClick={onOpen}
      className={[
        "!border-0 shadow-sm hover:shadow-md transition cursor-pointer",
        isMobile ? "!rounded-sm" : "!rounded-xl",
      ].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 12 }}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-sm" : "h-10 w-10 rounded-xl"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img
            src="/img/building4.svg"
            alt="Building"
            className={isMobile ? "h-4 w-4" : "h-5 w-5"}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
                  {b.name}
                </div>
                <Tag
                  className="!m-0"
                  style={{
                    borderColor: `${SECONDARY}80`,
                    color: SECONDARY,
                    fontSize: isMobile ? 10 : 11,
                    paddingInline: isMobile ? 6 : 7,
                    lineHeight: isMobile ? "16px" : "18px",
                  }}
                >
                  {stats.days} Days
                </Tag>
              </div>
            </div>

            {/* Load button: compact on mobile */}
            {canLoad && (
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
                  isMobile ? "!px-3 !h-6 !text-[12px]" : "!px-4 !h-8 !text-[12px]",
                ].join(" ")}
                style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              >
                Load
              </Button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill label="Total Birds" value={stats.total.toLocaleString()} />
            <StatPill label="Avg. Weight" value={`${stats.avgWeight.toLocaleString()} g`} />
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

export default function HarvestBuildingPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const [buildings, setBuildings] = useState<Building[]>(BUILDINGS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addForm] = Form.useForm();

  const handleSignOut = () => {
    // TODO: wire up auth sign out logic here
    console.log("sign out");
  };
  const handleOpenAdd = () => {
    const nextIndex = buildings.length + 1;
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
      const nextId = (Math.max(0, ...buildings.map((b) => Number(b.id) || 0)) + 1).toString();
      const newBuilding: Building = {
        id: nextId,
        name: values.name,
        days: 0,
        total: 0,
        avgWeight: 0,
        mortality: 0,
      };
      setBuildings((prev) => [...prev, newBuilding]);
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
        days: building.days,
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
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button
            type="text"
            icon={<HomeOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className={["!m-0 !text-white", isMobile ? "!text-base" : ""].join(" ")}>
            Harvest Building
          </Title>
        </div>
        <Button type="text" icon={<LogoutOutlined />} className="!text-white hover:!text-white/90" onClick={handleSignOut} />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-4 py-4"}>
        {/* Date Filter */}
        <div
          className={[
            "bg-white shadow-sm",
            isMobile ? "rounded-sm px-3 py-3 mb-3" : "rounded-xl px-4 py-4 mb-4",
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
          <div className={["bg-[#ffa6001f]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
            <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
              Active Buildings ({buildings.length})
            </div>
          </div>

          <Divider className={isMobile ? "!my-2" : "!my-3"} />

          {/* Use gap, not space-y, for consistent spacing */}
          <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
            {buildings.map((b) => (
              <BuildingRow
                key={b.id}
                b={b}
                stats={getStatsForBuilding(b)}
                isMobile={isMobile}
                onOpen={() => navigate(`/building-cage/${b.id}`)}
                canLoad={isTodaySelected}
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
        className="add-building-drawer"
        bodyStyle={{ padding: 16 }}
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
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
            >
              Add Building
            </Button>
          </div>
        </Form>
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
