import { Button, Divider, Grid, Layout, Pagination, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const ELECTRICITY_TABLE = import.meta.env.VITE_SUPABASE_ELECTRICITY_CONSUMPTION_TABLE ?? "ElectricityConsumption";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type GrowStatusRow = {
  key: string;
  id: number;
  buildingName: string;
  createdAt: string;
  totalBirds: number;
  totalKwh: number;
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

export default function ElectricityConsumptionPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [rows, setRows] = useState<GrowStatusRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(5);

  const mobilePagedRows = useMemo(() => {
    const start = (mobilePage - 1) * mobilePageSize;
    return rows.slice(start, start + mobilePageSize);
  }, [mobilePage, mobilePageSize, rows]);

  const columns: ColumnsType<GrowStatusRow> = useMemo(
    () => [
      { title: "Grow ID", dataIndex: "id", key: "id", width: 120, render: (id: number) => `#${id}` },
      { title: "Building", dataIndex: "buildingName", key: "buildingName", width: 180 },
      {
        title: "Date Start",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 140,
        render: (value: string) => formatDate(value),
      },
      {
        title: "Total Birds",
        dataIndex: "totalBirds",
        key: "totalBirds",
        width: 140,
        align: "right",
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: "Total kWh",
        dataIndex: "totalKwh",
        key: "totalKwh",
        width: 140,
        align: "right",
        render: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status: string, record) => (
          <Tag color={statusColor(status, record.isHarvested)} className="!mr-0">
            {status || "Unknown"}
          </Tag>
        ),
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
          { data: growRows, error: growError },
          { data: buildingRows, error: buildingError },
          { data: electricityRows, error: electricityError },
        ] = await Promise.all([
          supabase
            .from(GROWS_TABLE)
            .select("id, building_id, created_at, total_animals, status, is_harvested")
            .order("created_at", { ascending: false }),
          supabase.from(BUILDINGS_TABLE).select("id, name"),
          supabase.from(ELECTRICITY_TABLE).select("grow_id, consumption"),
        ]);

        if (!active) return;
        if (growError) throw growError;
        if (buildingError) throw buildingError;
        if (electricityError) throw electricityError;

        const buildingNameById = new Map<number, string>();
        ((buildingRows ?? []) as Array<{ id: number | null; name: string | null }>).forEach((building) => {
          if (building.id == null) return;
          buildingNameById.set(building.id, building.name ?? `Building ${building.id}`);
        });
        const totalKwhByGrowId = new Map<number, number>();
        ((electricityRows ?? []) as Array<{ grow_id: number | null; consumption: number | null }>).forEach((row) => {
          if (row.grow_id == null) return;
          const value = Number(row.consumption ?? 0);
          totalKwhByGrowId.set(row.grow_id, (totalKwhByGrowId.get(row.grow_id) ?? 0) + (Number.isFinite(value) ? value : 0));
        });

        const mapped = ((growRows ?? []) as Array<{
          id: number | null;
          building_id: number | null;
          created_at: string | null;
          total_animals: number | null;
          status: string | null;
          is_harvested: boolean | null;
        }>)
          .filter((row) => row.id != null)
          .map<GrowStatusRow>((row) => ({
            key: String(row.id),
            id: Number(row.id),
            buildingName:
              row.building_id == null
                ? "Unassigned"
                : buildingNameById.get(row.building_id) ?? `Building ${row.building_id}`,
            createdAt: String(row.created_at ?? ""),
            totalBirds: Math.max(0, Math.floor(Number(row.total_animals ?? 0))),
            totalKwh: totalKwhByGrowId.get(Number(row.id)) ?? 0,
            status: String(row.status ?? "Unknown"),
            isHarvested: row.is_harvested === true,
          }));

        setRows(mapped);
      } catch (error) {
        console.error("Failed to load grow statuses:", error);
        setRows([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

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
            Electricity Consumption
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
              Electricity Consumption
            </div>
            <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">Select a grow status</div>
            <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
              Tap or click a row below to review grow status records.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Grows Status List</div>
              </div>
              <div className="mb-2 text-xs text-slate-500">All grow records currently available in the system.</div>
              {isMobile ? (
                <div className="space-y-2">
                  {mobilePagedRows.map((record) => (
                    <button
                      key={record.key}
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                      onClick={() => navigate(`/electricity-consumption/grow/${record.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500">Grow ID</div>
                          <div className="font-semibold text-slate-800">#{record.id}</div>
                        </div>
                        <Tag color={statusColor(record.status, record.isHarvested)} className="!mr-0">
                          {record.status || "Unknown"}
                        </Tag>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <div><span className="text-slate-500">Building:</span> {record.buildingName}</div>
                        <div><span className="text-slate-500">Start:</span> {formatDate(record.createdAt)}</div>
                        <div><span className="text-slate-500">Birds:</span> {record.totalBirds.toLocaleString()}</div>
                        <div><span className="text-slate-500">Total kWh:</span> {record.totalKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      </div>
                      <div className="mt-2 text-right text-[11px] font-medium text-emerald-700">Tap to view</div>
                    </button>
                  ))}
                  <div className="pt-1">
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
                </div>
              ) : (
                <Table<GrowStatusRow>
                  size="small"
                  rowKey="key"
                  columns={columns}
                  dataSource={rows}
                  loading={isLoading}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: rows.length > 5,
                    pageSizeOptions: ["5", "10", "20"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} grows`,
                  }}
                  scroll={{ x: 720 }}
                  onRow={(record) => ({
                    onClick: () => navigate(`/electricity-consumption/grow/${record.id}`),
                    title: "Click to view electricity consumption",
                    className: "cursor-pointer hover:!bg-emerald-50/60",
                  })}
                />
              )}
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
