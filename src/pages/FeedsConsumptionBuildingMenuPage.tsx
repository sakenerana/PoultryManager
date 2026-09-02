import { Button, Divider, Grid, Layout, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const FEEDS_TABLE = import.meta.env.VITE_SUPABASE_FEEDS_CONSUMPTION_TABLE ?? "FeedsConsumption";
const FEED_RECEIVED_TABLE = import.meta.env.VITE_SUPABASE_FEED_RECEIVED_TABLE ?? "FeedReceived";
const FEED_TRANSFER_IN_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_IN_TABLE ?? "FeedTransferIn";
const FEED_TRANSFER_OUT_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_OUT_TABLE ?? "FeedTransferOut";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type BuildingSummary = {
  id: number;
  name: string;
  latestGrowId: number | null;
  createdAt: string;
  totalBirds: number;
  feedRecords: number;
  usedBags: number;
  usedKg: number;
  receivedRecords: number;
  receivedBags: number;
  transferInRecords: number;
  transferInBags: number;
  transferOutRecords: number;
  transferOutBags: number;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM DD, YYYY") : "-";
};

export default function FeedsConsumptionBuildingMenuPage() {
  const navigate = useNavigate();
  const { buildingId } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [summary, setSummary] = useState<BuildingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const parsedBuildingId = useMemo(() => {
    const parsed = Number(buildingId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [buildingId]);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      if (parsedBuildingId == null) {
        setSummary(null);
        return;
      }

      try {
        setIsLoading(true);
        const [
          buildingResult,
          growResult,
          feedResult,
          receivedResult,
          transferInResult,
          transferOutResult,
        ] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("id, name").eq("id", parsedBuildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id, created_at, total_animals")
            .eq("building_id", parsedBuildingId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from(FEEDS_TABLE).select("id, feed_quantity_bags, feed_quantity_kg").eq("building_id", parsedBuildingId),
          supabase.from(FEED_RECEIVED_TABLE).select("id, qty_bags").eq("building_id", parsedBuildingId),
          supabase.from(FEED_TRANSFER_IN_TABLE).select("id, qty_bags").eq("building_id", parsedBuildingId),
          supabase.from(FEED_TRANSFER_OUT_TABLE).select("id, qty_bags").eq("building_id", parsedBuildingId),
        ]);

        if (!active) return;
        if (buildingResult.error) throw buildingResult.error;
        if (growResult.error) throw growResult.error;
        if (feedResult.error) throw feedResult.error;
        if (receivedResult.error) throw receivedResult.error;
        if (transferInResult.error) throw transferInResult.error;
        if (transferOutResult.error) throw transferOutResult.error;

        const building = buildingResult.data as { id: number; name: string | null } | null;
        const grow = growResult.data as { id: number; created_at: string | null; total_animals: number | null } | null;
        const feedRows = (feedResult.data ?? []) as Array<{
          id: number | null;
          feed_quantity_bags: number | null;
          feed_quantity_kg: number | null;
        }>;
        const receivedRows = (receivedResult.data ?? []) as Array<{ id: number | null; qty_bags: number | null }>;
        const transferInRows = (transferInResult.data ?? []) as Array<{ id: number | null; qty_bags: number | null }>;
        const transferOutRows = (transferOutResult.data ?? []) as Array<{ id: number | null; qty_bags: number | null }>;
        if (!building) {
          setSummary(null);
          return;
        }

        setSummary({
          id: building.id,
          name: building.name ?? `Building ${building.id}`,
          latestGrowId: grow?.id ?? null,
          createdAt: grow?.created_at ?? "",
          totalBirds: Math.max(0, Math.floor(toNumber(grow?.total_animals))),
          feedRecords: feedRows.length,
          usedBags: feedRows.reduce((sum, row) => sum + toNumber(row.feed_quantity_bags), 0),
          usedKg: feedRows.reduce((sum, row) => sum + toNumber(row.feed_quantity_kg), 0),
          receivedRecords: receivedRows.length,
          receivedBags: receivedRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0),
          transferInRecords: transferInRows.length,
          transferInBags: transferInRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0),
          transferOutRecords: transferOutRows.length,
          transferOutBags: transferOutRows.reduce((sum, row) => sum + toNumber(row.qty_bags), 0),
        });
      } catch (error) {
        console.error("Failed to load feed record menu:", error);
        setSummary(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, [parsedBuildingId]);

  const netAvailableBags = summary
    ? summary.receivedBags + summary.transferInBags - summary.usedBags - summary.transferOutBags
    : 0;

  const menuCards = [
    {
      title: "Daily Feed Usage",
      description: "Daily age-day consumption and mortality.",
      total: summary?.usedBags ?? 0,
      unit: "bags used",
      secondary: `${(summary?.usedKg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg | ${(summary?.feedRecords ?? 0).toLocaleString()} records`,
      accent: "#008822",
      path: `/feeds-consumption/building/${parsedBuildingId}/daily`,
    },
    {
      title: "Feed Received",
      description: "Deliveries and document numbers.",
      total: summary?.receivedBags ?? 0,
      unit: "bags received",
      secondary: `${(summary?.receivedRecords ?? 0).toLocaleString()} records`,
      accent: "#0ea5e9",
      path: `/feeds-consumption/building/${parsedBuildingId}/received`,
    },
    {
      title: "Transfer In",
      description: "Feed moved into this building.",
      total: summary?.transferInBags ?? 0,
      unit: "bags in",
      secondary: `${(summary?.transferInRecords ?? 0).toLocaleString()} records`,
      accent: "#f59e0b",
      path: `/feeds-consumption/building/${parsedBuildingId}/transfer-in`,
    },
    {
      title: "Transfer Out",
      description: "Feed moved out of this building.",
      total: summary?.transferOutBags ?? 0,
      unit: "bags out",
      secondary: `${(summary?.transferOutRecords ?? 0).toLocaleString()} records`,
      accent: "#ef4444",
      path: `/feeds-consumption/building/${parsedBuildingId}/transfer-out`,
    },
  ];

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

      <Content className="px-4 py-5 md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-5 rounded-xl bg-gradient-to-r from-emerald-950 via-emerald-800 to-lime-700 px-5 py-6 text-white shadow-sm md:px-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">Feeds Setup</div>
                <Title level={isMobile ? 3 : 2} className="!m-0 !text-white">
                  Choose feed record type
                </Title>
                <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">
                  {summary?.name ?? (isLoading ? "Loading building" : "Building not found")} | Select the record section to encode for this building.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em]">
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grow {summary?.latestGrowId ? `#${summary.latestGrowId}` : "-"}</div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{summary?.totalBirds.toLocaleString() ?? 0} birds</div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{formatDate(summary?.createdAt ?? "")}</div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Net {netAvailableBags.toLocaleString(undefined, { maximumFractionDigits: 2 })} bags
                  </div>
                </div>
              </div>
              <Button
                ghost
                icon={<MdOutlinePictureAsPdf />}
                className="!border-white/30 !text-white hover:!border-white hover:!text-white"
                onClick={() => navigate("/reports/feeds-consumption")}
              >
                Report
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {menuCards.map((card) => (
              <button
                key={card.title}
                type="button"
                className="rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: card.accent }}
                disabled={!summary}
                onClick={() => navigate(card.path)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">{summary?.name ?? "Building"}</div>
                    <div className="mt-3 text-2xl font-bold" style={{ color: card.accent }}>
                      {card.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{card.description}</div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#ffda8a] text-2xl font-bold text-slate-900">
                    {card.title.charAt(0)}
                  </div>
                </div>
                <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Total</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-3xl font-bold text-slate-950">{card.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="text-xs text-slate-500">{card.unit}</div>
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-500">{card.secondary}</div>
                </div>
                <div className="mt-3 text-right text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: card.accent }}>
                  Open
                </div>
              </button>
            ))}
          </div>
        </div>
      </Content>
    </Layout>
  );
}
