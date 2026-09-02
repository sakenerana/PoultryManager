import { Button, Divider, Grid, Layout, Pagination, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const FEEDS_TABLE = import.meta.env.VITE_SUPABASE_FEEDS_CONSUMPTION_TABLE ?? "FeedsConsumption";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type FeedSetupRow = {
  key: string;
  id: number;
  name: string;
  latestGrowId: number | null;
  createdAt: string;
  totalBirds: number;
  feedRecords: number;
  totalKg: number;
  totalBags: number;
  status: string;
  isHarvested: boolean;
};

const formatDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM DD, YYYY") : "-";
};

const statusColor = (status: string, isHarvested: boolean): string => {
  const normalized = status.toLowerCase();
  if (isHarvested || normalized === "harvested") return "orange";
  if (normalized === "growing") return "green";
  if (normalized === "loading") return "blue";
  if (normalized === "ready") return "default";
  return "cyan";
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function FeedsConsumptionPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [rows, setRows] = useState<FeedSetupRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(5);
  const [summary, setSummary] = useState({ buildings: 0, grows: 0, records: 0, kg: 0 });

  const mobilePagedRows = useMemo(() => {
    const start = (mobilePage - 1) * mobilePageSize;
    return rows.slice(start, start + mobilePageSize);
  }, [mobilePage, mobilePageSize, rows]);

  const columns: ColumnsType<FeedSetupRow> = useMemo(
    () => [
      { title: "Building", dataIndex: "name", key: "name", width: 160 },
      {
        title: "Latest Grow",
        dataIndex: "latestGrowId",
        key: "latestGrowId",
        width: 120,
        render: (id: number | null) => (id == null ? "-" : `#${id}`),
      },
      {
        title: "Date Start",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 140,
        render: (value: string) => formatDate(value),
      },
      {
        title: "Records",
        dataIndex: "feedRecords",
        key: "feedRecords",
        width: 110,
        align: "right",
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: "Total Bags",
        dataIndex: "totalBags",
        key: "totalBags",
        width: 130,
        align: "right",
        render: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        title: "Total KG",
        dataIndex: "totalKg",
        key: "totalKg",
        width: 130,
        align: "right",
        render: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status: string, record) => (
          <Tag color={statusColor(status, record.isHarvested)} className="!mr-0">
            {status || "Unknown"}
          </Tag>
        ),
      },
      {
        title: "",
        key: "actionHint",
        width: 120,
        align: "right",
        render: () => <span className="text-xs font-semibold text-orange-700">Open setup</span>,
      },
    ],
    []
  );

  useEffect(() => {
    let active = true;

    const loadRows = async () => {
      try {
        setIsLoading(true);
        const [
          { data: buildingRows, error: buildingError },
          { data: growRows, error: growError },
          { data: feedRows, error: feedError },
        ] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("id, name"),
          supabase
            .from(GROWS_TABLE)
            .select("id, building_id, created_at, total_animals, status, is_harvested")
            .order("created_at", { ascending: false }),
          supabase.from(FEEDS_TABLE).select("building_id, feed_quantity_bags, feed_quantity_kg"),
        ]);

        if (!active) return;
        if (buildingError) throw buildingError;
        if (growError) throw growError;
        if (feedError) throw feedError;

        const buildings = ((buildingRows ?? []) as Array<{ id: number | null; name: string | null }>)
          .filter((building): building is { id: number; name: string | null } => building.id != null)
          .sort((a, b) => {
            const aName = a.name ?? `Building ${a.id}`;
            const bName = b.name ?? `Building ${b.id}`;
            return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
          });

        const latestGrowByBuildingId = new Map<
          number,
          { id: number; createdAt: string; totalBirds: number; status: string; isHarvested: boolean }
        >();

        ((growRows ?? []) as Array<{
          id: number | null;
          building_id: number | null;
          created_at: string | null;
          total_animals: number | null;
          status: string | null;
          is_harvested: boolean | null;
        }>).forEach((row) => {
          if (row.id == null || row.building_id == null) return;
          if (latestGrowByBuildingId.has(row.building_id)) return;
          latestGrowByBuildingId.set(row.building_id, {
            id: row.id,
            createdAt: row.created_at ?? "",
            totalBirds: Math.max(0, Math.floor(toNumber(row.total_animals))),
            status: row.status ?? "Ready",
            isHarvested: row.is_harvested === true,
          });
        });

        const feedTotalsByBuildingId = new Map<number, { records: number; bags: number; kg: number }>();
        ((feedRows ?? []) as Array<{
          building_id: number | null;
          feed_quantity_bags: number | null;
          feed_quantity_kg: number | null;
        }>).forEach((row) => {
          if (row.building_id == null) return;
          const current = feedTotalsByBuildingId.get(row.building_id) ?? { records: 0, bags: 0, kg: 0 };
          current.records += 1;
          current.bags += toNumber(row.feed_quantity_bags);
          current.kg += toNumber(row.feed_quantity_kg);
          feedTotalsByBuildingId.set(row.building_id, current);
        });

        const mapped = buildings.map<FeedSetupRow>((building) => {
          const latestGrow = latestGrowByBuildingId.get(building.id);
          const feedTotals = feedTotalsByBuildingId.get(building.id) ?? { records: 0, bags: 0, kg: 0 };
          const name = building.name ?? `Building ${building.id}`;
          return {
            key: String(building.id),
            id: building.id,
            name,
            latestGrowId: latestGrow?.id ?? null,
            createdAt: latestGrow?.createdAt ?? "",
            totalBirds: latestGrow?.totalBirds ?? 0,
            feedRecords: feedTotals.records,
            totalKg: feedTotals.kg,
            totalBags: feedTotals.bags,
            status: latestGrow?.status ?? "Ready",
            isHarvested: latestGrow?.isHarvested ?? false,
          };
        });

        setRows(mapped);
        setSummary({
          buildings: mapped.length,
          grows: (growRows ?? []).length,
          records: mapped.reduce((sum, row) => sum + row.feedRecords, 0),
          kg: mapped.reduce((sum, row) => sum + row.totalKg, 0),
        });
      } catch (error) {
        console.error("Failed to load feed setup:", error);
        setRows([]);
        setSummary({ buildings: 0, grows: 0, records: 0, kg: 0 });
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const openBuilding = (buildingId: number) => {
    navigate(`/feeds-consumption/building/${buildingId}`);
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
          <Button type="text" icon={<IoMdArrowRoundBack size={20} />} className="!text-white hover:!text-white/90" onClick={() => navigate(-1)} aria-label="Back" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button type="text" icon={<IoHome size={18} />} className="!text-white hover:!text-white/90" onClick={() => navigate("/landing-page")} aria-label="Home" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className="!m-0 !text-base !text-white">
            Feeds Setup
          </Title>
        </div>
        <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={() => void signOutAndRedirect(navigate)} aria-label="Sign out" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-6xl">
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white md:mb-5 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">Feeds Setup</div>
                <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Select a building</div>
                <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">Click a building to choose daily usage, received feed, transfer in, or transfer out.</div>
              </div>
              <Button icon={<MdOutlinePictureAsPdf size={17} />} className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20" onClick={() => navigate("/reports/feeds-consumption")}>
                Report
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50/90">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Buildings {summary.buildings.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grows {summary.grows.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Records {summary.records.toLocaleString()}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Feed {summary.kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-slate-700">Buildings</div>
            <div className="mb-2 text-xs text-slate-500">Select a building to encode daily usage, received feed, transfer in, or transfer out.</div>
            {isMobile ? (
              <div className="space-y-2">
                {mobilePagedRows.map((record) => (
                  <button key={record.key} type="button" className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/40" onClick={() => openBuilding(record.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-500">Building</div>
                        <div className="font-semibold text-slate-800">{record.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Latest Grow: {record.latestGrowId == null ? "-" : `#${record.latestGrowId}`}</div>
                      </div>
                      <Tag color={statusColor(record.status, record.isHarvested)} className="!mr-0">
                        {record.status || "Unknown"}
                      </Tag>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                      <div><span className="text-slate-500">Start:</span> {formatDate(record.createdAt)}</div>
                      <div><span className="text-slate-500">Birds:</span> {record.totalBirds.toLocaleString()}</div>
                      <div><span className="text-slate-500">Records:</span> {record.feedRecords.toLocaleString()}</div>
                      <div><span className="text-slate-500">KG:</span> {record.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="mt-2 text-right text-[11px] font-semibold text-orange-700">Open setup</div>
                  </button>
                ))}
                <Pagination
                  current={mobilePage}
                  pageSize={mobilePageSize}
                  total={rows.length}
                  size="small"
                  showSizeChanger={rows.length > 5}
                  pageSizeOptions={["5", "10", "20"]}
                  onChange={(page, pageSize) => {
                    setMobilePage(page);
                    setMobilePageSize(pageSize);
                  }}
                  showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                />
              </div>
            ) : (
              <Table<FeedSetupRow>
                size="small"
                rowKey="key"
                columns={columns}
                dataSource={rows}
                loading={isLoading}
                pagination={{
                  pageSize: 5,
                  showSizeChanger: rows.length > 5,
                  pageSizeOptions: ["5", "10", "20"],
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} buildings`,
                }}
                scroll={{ x: 900 }}
                onRow={(record) => ({
                  onClick: () => openBuilding(record.id),
                  title: "Open feeds setup",
                  className: "cursor-pointer hover:!bg-orange-50/60",
                })}
              />
            )}
          </div>
        </div>
      </Content>
    </Layout>
  );
}
