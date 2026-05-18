import { Button, Divider, Layout, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const { Header, Content } = Layout;
const { Title } = Typography;

type ReportTile = {
  key: "grows" | "harvested" | "income";
  title: string;
  subtitle: string;
  borderColor: string;
  titleColor: string;
  iconSrc: string;
  statUnit: string;
  path?: string;
};

const tiles: ReportTile[] = [
  {
    key: "grows",
    title: "Grows",
    subtitle: "Grow records and status history",
    borderColor: "#22c55e",
    titleColor: "#0f172a",
    iconSrc: "/img/chicken-head.svg",
    statUnit: "grows",
    path: "/reports/grows",
  },
  {
    key: "harvested",
    title: "Harvested",
    subtitle: "Harvested batch summaries",
    borderColor: "#0ea5e9",
    titleColor: "#475569",
    iconSrc: "/img/chicken-harvest.svg",
    statUnit: "harvested",
    path: "/reports/harvested",
  },
  {
    key: "income",
    title: "Income",
    subtitle: "Revenue and earnings overview",
    borderColor: "#f59e0b",
    titleColor: "#475569",
    iconSrc: "/img/report.svg",
    statUnit: "soon",
  },
];

export default function ReportsMenuPage() {
  const navigate = useNavigate();
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [growsCount, setGrowsCount] = useState(0);
  const [harvestedCount, setHarvestedCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const loadCounts = async () => {
      const growsTable = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
      const { data, error } = await supabase
        .from(growsTable)
        .select("total_animals, status, is_harvested");

      if (error || !alive) return;

      const rows = (data ?? []) as Array<{
        total_animals: number | null;
        status: string | null;
        is_harvested: boolean | null;
      }>;

      let nextGrowsCount = 0;
      let nextHarvestedCount = 0;

      for (const row of rows) {
        const status = String(row.status ?? "").toLowerCase();
        const harvested = row.is_harvested === true || status === "harvested";
        if (harvested) nextHarvestedCount += 1;
        else nextGrowsCount += 1;
      }

      if (!alive) return;
      setGrowsCount(nextGrowsCount);
      setHarvestedCount(nextHarvestedCount);
    };

    void loadCounts();
    return () => {
      alive = false;
    };
  }, []);

  const statByTile = useMemo(
    () => ({
      grows: growsCount,
      harvested: harvestedCount,
      income: 0,
    }),
    [growsCount, harvestedCount]
  );

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
            Reports
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

      <Content className="px-3 py-3">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Reports Center
            </div>
            <div className="mt-1.5 text-xl font-bold leading-tight">Choose a report category</div>
            <div className="mt-1 text-xs text-emerald-50/90">
              Open Grows, Harvested, or Income reports.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <button
                key={tile.key}
                onClick={() => tile.path && navigate(tile.path)}
                className={[
                  "w-full rounded-sm border bg-white text-left shadow-sm p-2.5 overflow-hidden",
                  tile.key === "income" ? "col-span-2" : "",
                  tile.path ? "cursor-pointer hover:shadow-md" : "cursor-default",
                ].join(" ")}
                style={{ borderColor: tile.borderColor, borderWidth: 1.5 }}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] font-medium uppercase tracking-[0.24em] text-slate-500">BLDG</div>
                    <div className="mt-1 text-[18px] leading-tight font-semibold tracking-tight" style={{ color: tile.titleColor }}>
                      {tile.title}
                    </div>
                    <div className="mt-1 text-[9px] leading-tight text-slate-400">{tile.subtitle}</div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-[#f3d89f] p-2.5">
                    <img src={tile.iconSrc} alt={tile.title} className="h-9 w-9" />
                  </div>
                </div>
                <div className="mt-2 rounded-xl bg-slate-100 px-2.5 py-2">
                    <div className="text-[8px] font-medium uppercase tracking-[0.22em] text-slate-500">Total</div>
                  <div className="mt-0.5 flex items-end justify-between">
                    <div className="text-[31px] leading-none font-bold text-slate-900">
                      {statByTile[tile.key].toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500">{tile.path ? tile.statUnit : "coming soon"}</div>
                  </div>
                </div>
                <div className="mt-2 h-1 rounded-full bg-emerald-50" />
              </button>
            ))}
          </div>
        </div>
      </Content>
    </Layout>
  );
}
