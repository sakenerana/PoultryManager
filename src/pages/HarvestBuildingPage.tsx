// HarvestBuildingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tag, Divider, Grid, DatePicker, Drawer, InputNumber, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Building = {
  id: string;
  name: string;
  days: number;
  total: number;
};

type BuildingStats = {
  days: number;
  total: number;
  status: "Loading" | "Complete";
  mortality: number;
  thinning: number;
  takeOut: number;
  remaining: number;
  defect: number;
};
type EditableMetric = "mortality" | "thinning" | "takeOut" | "defect";

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";

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

function ChickenState({
  title,
  subtitle,
  fullScreen,
  titleClassName,
  subtitleClassName,
}: {
  title: string;
  subtitle: string;
  fullScreen?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center text-center",
        fullScreen ? "min-h-[calc(100vh-90px)]" : "py-8",
      ].join(" ")}
    >
      <img
        src="/img/happyrun.gif"
        alt="Chicken loading"
        className="h-24 w-24 object-cover rounded-full"
        onError={(e) => {
          const target = e.currentTarget;
          target.onerror = null;
          target.src = "/img/chicken-bird.svg";
        }}
      />
      <div className={["mt-3 text-sm font-semibold", titleClassName ?? "text-slate-700"].join(" ")}>{title}</div>
      <div className={["mt-1 text-xs", subtitleClassName ?? "text-slate-500"].join(" ")}>{subtitle}</div>
    </div>
  );
}

function BuildingRow({
  b,
  onOpen,
  isMobile,
  stats,
  onMetricClick,
}: {
  b: Building;
  onOpen: () => void;
  isMobile: boolean;
  stats: BuildingStats;
  onMetricClick: (metric: EditableMetric, buildingId: string, current: number) => void;
}) {
  const remainingBirds = stats.remaining;
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
            <StatPill
              label="Total Birds / Remaining"
              value={(
                <span>
                  {stats.total.toLocaleString()} / {remainingBirds.toLocaleString()}{" "}
                  <span className="text-[10px] font-medium text-slate-500">
                    ({remainingPercentage.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%)
                  </span>
                </span>
              )}
            />
            <StatPill label="Status" value={<StatusBadge status={stats.status} />} />
            <StatPill
              label="Mortality"
              value={stats.mortality.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
              rightIcon={<RightOutlined className="!text-slate-400 !text-[10px]" />}
              onClick={() => onMetricClick("mortality", b.id, stats.mortality)}
            />
            <StatPill
              label="Defect"
              value={stats.defect.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />}
              rightIcon={<RightOutlined className="!text-slate-400 !text-[10px]" />}
              onClick={() => onMetricClick("defect", b.id, stats.defect)}
            />
            <StatPill
              label="Take Out"
              value={stats.takeOut.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<RightOutlined className="!text-slate-400 !text-[10px]" />}
              onClick={() => onMetricClick("takeOut", b.id, stats.takeOut)}
            />
            <StatPill
              label="Thinning"
              value={stats.thinning.toLocaleString()}
              leftIcon={<span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />}
              rightIcon={<RightOutlined className="!text-slate-400 !text-[10px]" />}
              onClick={() => onMetricClick("thinning", b.id, stats.thinning)}
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
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metricOverrides, setMetricOverrides] = useState<Record<EditableMetric, Record<string, Record<string, number>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
    defect: {},
  });
  const [metricRemarksByType, setMetricRemarksByType] = useState<Record<EditableMetric, Record<string, Record<string, string>>>>({
    mortality: {},
    thinning: {},
    takeOut: {},
    defect: {},
  });
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<EditableMetric>("mortality");
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);
  const [metricDraft, setMetricDraft] = useState<number>(0);
  const [metricRemarksDraft, setMetricRemarksDraft] = useState<string>("");

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const fetchBuildingsFromGrows = async () => {
    try {
      setIsLoading(true);
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

      const { data: growRows, error: growsError } = await supabase
        .from(GROWS_TABLE)
        .select("id, building_id, total_animals, created_at")
        .lt("created_at", selectedDayEnd)
        .order("created_at", { ascending: false });

      if (growsError) throw growsError;

      const latestByBuildingId: Record<number, { total: number; createdAt: string }> = {};
      ((growRows ?? []) as Array<{
        building_id: number | null;
        total_animals: number | null;
        created_at: string;
      }>).forEach((row) => {
        if (row.building_id == null) return;
        if (latestByBuildingId[row.building_id]) return;
        latestByBuildingId[row.building_id] = {
          total: Math.max(0, Math.floor(Number(row.total_animals ?? 0))),
          createdAt: row.created_at,
        };
      });

      const buildingIds = Object.keys(latestByBuildingId).map((id) => Number(id));
      if (buildingIds.length === 0) {
        setBuildings([]);
        return;
      }

      const { data: buildingRows, error: buildingsError } = await supabase
        .from(BUILDINGS_TABLE)
        .select("id, name")
        .in("id", buildingIds);

      if (buildingsError) throw buildingsError;

      const nameById: Record<number, string> = {};
      ((buildingRows ?? []) as Array<{ id: number; name: string | null }>).forEach((row) => {
        nameById[row.id] = row.name ?? `Building ${row.id}`;
      });

      const mapped = buildingIds.map((buildingId) => {
        const latest = latestByBuildingId[buildingId];
        const days = Math.max(
          0,
          dayjs(selectedDate).startOf("day").diff(dayjs(latest.createdAt).startOf("day"), "day")
        ) + 1;
        return {
          id: String(buildingId),
          name: nameById[buildingId] ?? `Building ${buildingId}`,
          days,
          total: latest.total,
        };
      });

      setBuildings(mapped);
    } catch (error) {
      console.error("Failed to load harvest buildings:", error);
      setBuildings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBuildingsFromGrows();
  }, [selectedDate]);

  const metricMeta: Record<EditableMetric, { title: string; helper: string; label: string }> = {
    mortality: {
      title: "Mortality",
      helper: "Adjust the mortality count for this building.",
      label: "Mortality Count",
    },
    thinning: {
      title: "Thinning",
      helper: "Adjust the thinning count for this building.",
      label: "Thinning Count",
    },
    takeOut: {
      title: "Take Out",
      helper: "Adjust the take out count for this building.",
      label: "Take Out Count",
    },
    defect: {
      title: "Defect",
      helper: "Adjust the defect count for this building.",
      label: "Defect Count",
    },
  };

  const openMetricModal = (metric: EditableMetric, buildingId: string, current: number) => {
    const existingRemarks = metricRemarksByType[metric][selectedDate]?.[buildingId] ?? "";
    setActiveMetric(metric);
    setActiveBuildingId(buildingId);
    setMetricDraft(Math.max(0, Math.floor(current || 0)));
    setMetricRemarksDraft(existingRemarks);
    setIsMetricModalOpen(true);
  };

  const closeMetricModal = () => {
    setIsMetricModalOpen(false);
    setActiveBuildingId(null);
    setMetricRemarksDraft("");
  };

  const handleUpdateMetric = () => {
    if (!activeBuildingId) return;
    const nextValue = Math.max(0, Math.floor(metricDraft || 0));
    setMetricOverrides((prev) => {
      const next = { ...prev };
      const selectedMetric = { ...next[activeMetric] };
      const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
      day[activeBuildingId] = nextValue;
      selectedMetric[selectedDate] = day;
      next[activeMetric] = selectedMetric;
      return next;
    });
    setMetricRemarksByType((prev) => {
      const next = { ...prev };
      const selectedMetric = { ...next[activeMetric] };
      const day = selectedMetric[selectedDate] ? { ...selectedMetric[selectedDate] } : {};
      day[activeBuildingId] = metricRemarksDraft.trim();
      selectedMetric[selectedDate] = day;
      next[activeMetric] = selectedMetric;
      return next;
    });
    closeMetricModal();
  };

  const getStatsForBuilding = useMemo(() => {
    return (building: Building): BuildingStats => {
      const mortality = metricOverrides.mortality[selectedDate]?.[building.id] ?? 0;
      const thinning = metricOverrides.thinning[selectedDate]?.[building.id] ?? 0;
      const takeOut = metricOverrides.takeOut[selectedDate]?.[building.id] ?? 0;
      const defect = metricOverrides.defect[selectedDate]?.[building.id] ?? 0;
      return {
        days: building.days,
        total: building.total,
        status: "Loading",
        mortality,
        thinning,
        takeOut,
        remaining: 0,
        defect,
      };
    };
  }, [metricOverrides, selectedDate]);

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
        {isLoading ? (
          <ChickenState
            title="Loading..."
            subtitle=""
            fullScreen
            titleClassName="text-[#008822]"
            subtitleClassName="text-[#008822]/80"
          />
        ) : buildings.length === 0 ? (
          <ChickenState
            title="No data yet"
            subtitle="No grow records found for this date."
            fullScreen
          />
        ) : (
          <>
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
                value={dayjs(selectedDate)}
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

              <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
                {buildings.map((b) => (
                  <BuildingRow
                    key={b.id}
                  b={b}
                  stats={getStatsForBuilding(b)}
                  isMobile={isMobile}
                  onMetricClick={openMetricModal}
                  onOpen={() => navigate(`/truck/${b.id}`)}
                />
              ))}
              </div>
            </div>
          </>
        )}
      </Content>

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
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">{metricMeta[activeMetric].label}</div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setMetricDraft((v) => Math.max(0, (v || 0) - 1))}>-</Button>
            <InputNumber
              min={0}
              value={metricDraft}
              onChange={(v) => setMetricDraft(Number(v) || 0)}
              parser={(value) => Number(String(value ?? "").replace(/[^\d]/g, "") || "0")}
              inputMode="numeric"
              className="!w-full"
              styles={{ input: { fontSize: 16 } }}
            />
            <Button onClick={() => setMetricDraft((v) => (v || 0) + 1)}>+</Button>
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 mb-2">Remarks</div>
            <Input.TextArea
              rows={3}
              value={metricRemarksDraft}
              onChange={(e) => setMetricRemarksDraft(e.target.value)}
              placeholder="Add remarks (optional)"
              className="!text-base"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="!flex-1" onClick={closeMetricModal}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!flex-1"
            style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
            onClick={handleUpdateMetric}
          >
            Update
          </Button>
        </div>
      </Drawer>
    </Layout>
  );
}
