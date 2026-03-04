// HarvestBuildingPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { signOutAndRedirect } from "../utils/auth";

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
  thinning: number;
  takeOut: number;
};

type BuildingStats = {
  days: number;
  total: number;
  avgWeight: number;
  status: "Loading" | "Complete";
  mortality: number;
  thinning: number;
  takeOut: number;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";

const BUILDINGS: Building[] = [
  { id: "1", name: "Building 1", days: 28, total: 1200, avgWeight: 1850, mortality: 14, thinning: 35, takeOut: 18 },
  { id: "2", name: "Building 2", days: 41, total: 980, avgWeight: 1725, mortality: 9, thinning: 42, takeOut: 20 },
  { id: "3", name: "Building 3", days: 52, total: 1500, avgWeight: 1920, mortality: 7, thinning: 50, takeOut: 27 },
  { id: "4", name: "Building 4", days: 32, total: 800, avgWeight: 1680, mortality: 12, thinning: 28, takeOut: 14 },
  { id: "5", name: "Building 5", days: 22, total: 1100, avgWeight: 1790, mortality: 10, thinning: 31, takeOut: 16 },
];

const MOCK_STATS_BY_DATE: Record<string, Record<string, BuildingStats>> = {
  "2026-02-27": {
    "1": { days: 28, total: 1200, avgWeight: 1850, status: "Loading", mortality: 14, thinning: 35, takeOut: 18 },
    "2": { days: 41, total: 980, avgWeight: 1725, status: "Complete", mortality: 9, thinning: 42, takeOut: 20 },
    "3": { days: 52, total: 1500, avgWeight: 1920, status: "Complete", mortality: 7, thinning: 50, takeOut: 27 },
    "4": { days: 32, total: 800, avgWeight: 1680, status: "Complete", mortality: 12, thinning: 28, takeOut: 14 },
    "5": { days: 22, total: 1100, avgWeight: 1790, status: "Complete", mortality: 10, thinning: 31, takeOut: 16 },
  },
  "2026-02-28": {
    "1": { days: 29, total: 1185, avgWeight: 1835, status: "Complete", mortality: 16, thinning: 37, takeOut: 19 },
    "2": { days: 42, total: 960, avgWeight: 1710, status: "Complete", mortality: 11, thinning: 44, takeOut: 22 },
    "3": { days: 53, total: 1480, avgWeight: 1900, status: "Complete", mortality: 9, thinning: 52, takeOut: 28 },
    "4": { days: 33, total: 790, avgWeight: 1670, status: "Loading", mortality: 13, thinning: 29, takeOut: 15 },
    "5": { days: 23, total: 1085, avgWeight: 1775, status: "Complete", mortality: 12, thinning: 33, takeOut: 17 },
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
    Complete: { dot: "bg-emerald-500", text: "text-emerald-700" },
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
  const remainingBirds = Math.max(stats.total - stats.mortality - stats.thinning - stats.takeOut, 0);
  const remainingPercentage = stats.total > 0 ? (remainingBirds / stats.total) * 100 : 0;
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

            <div />
          </div>

          {/* Stats Grid */}
          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill label="Total Birds" value={stats.total.toLocaleString()} />
            <StatPill
              label="Remaining"
              value={`${remainingBirds.toLocaleString()}(${remainingPercentage.toFixed(2)}%)`}
            />
            <StatPill label="Status" value={<StatusBadge status={stats.status} />} />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
            />
            <StatPill
              label="Thinning"
              value={stats.thinning.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
            />
            <StatPill
              label="Take Out"
              value={stats.takeOut.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
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
  const buildings = BUILDINGS;

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
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
        status: "Complete",
        mortality: building.mortality,
        thinning: building.thinning,
        takeOut: building.takeOut,
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
                onOpen={() => navigate(`/truck/${b.id}`)}
              />
            ))}
          </div>
        </div>

      </Content>
    </Layout>
  );
}
