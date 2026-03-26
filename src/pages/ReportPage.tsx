import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Layout, Button, Divider, Grid, Typography, DatePicker } from "antd";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";

type Period = "week" | "month" | "year";

const BRAND = "#008822";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const MOCK = {
  week: {
    load: { total: 5200, done: 4800, pending: 400 },
    harvest: { total: 2100, done: 1800, pending: 300 },
    trend: [
      { label: "Mon", load: 700, harvest: 280 },
      { label: "Tue", load: 650, harvest: 300 },
      { label: "Wed", load: 820, harvest: 260 },
      { label: "Thu", load: 760, harvest: 310 },
      { label: "Fri", load: 690, harvest: 280 },
      { label: "Sat", load: 820, harvest: 360 },
      { label: "Sun", load: 760, harvest: 310 },
    ],
  },
  month: {
    load: { total: 21800, done: 20100, pending: 1700 },
    harvest: { total: 9200, done: 8350, pending: 850 },
    trend: [
      { label: "W1", load: 5200, harvest: 2100 },
      { label: "W2", load: 5400, harvest: 2300 },
      { label: "W3", load: 5600, harvest: 2450 },
      { label: "W4", load: 5600, harvest: 2350 },
    ],
  },
  year: {
    load: { total: 268000, done: 252500, pending: 15500 },
    harvest: { total: 112000, done: 105700, pending: 6300 },
    trend: [
      { label: "Q1", load: 64000, harvest: 26500 },
      { label: "Q2", load: 67000, harvest: 27800 },
      { label: "Q3", load: 69000, harvest: 29000 },
      { label: "Q4", load: 68000, harvest: 28600 },
    ],
  },
};

function StatCard({
  title,
  total,
  done,
  pending,
  accent,
}: {
  title: string;
  total: number;
  done: number;
  pending: number;
  accent: string;
}) {
  const donePct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="rounded-sm bg-white shadow-sm border border-slate-100 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs font-semibold text-slate-500">{total.toLocaleString()}</div>
      </div>
      <div className="mt-3">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full" style={{ width: `${donePct}%`, backgroundColor: accent }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Done: {done.toLocaleString()}</span>
          <span>Pending: {pending.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const [period, setPeriod] = useState<Period>("week");
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  });

  const data = useMemo(() => MOCK[period], [period]);
  const displayDate = useMemo(() => {
    if (!date) return "";
    if (period === "year") return date;
    if (period === "month") return dayjs(`${date}-01`).format("MMMM YYYY");
    if (period === "week") return `Week ${date.replace("W", "")}`;
    return dayjs(date).format("MMMM D, YYYY");
  }, [date, period]);

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-auto !min-h-14" : "!px-8 !h-[74px]",
        ].join(" ")}
        style={{
          backgroundColor: BRAND,
          ...(isMobile
            ? {
              paddingTop: mobileSafeAreaTop,
              height: `calc(56px + ${mobileSafeAreaTop})`,
            }
            : {}),
        }}
      >
        <div className={["flex items-center", isMobile ? "gap-2" : "gap-4"].join(" ")}>
          <Button
            type="text"
            icon={<IoMdArrowRoundBack size={20} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider type="vertical" className={["!m-0 !border-white/60", isMobile ? "!h-5" : "!h-6"].join(" ")} />
          <Button
            type="text"
            icon={<IoHome size={18} />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          {isMobile ? (
            <>
              <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
              <Title level={4} className="!m-0 !text-base !text-white">
                Reports
              </Title>
            </>
          ) : (
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Analytics</div>
              <Title level={4} className="!m-0 !text-white !text-lg">
                Production Reports
              </Title>
            </div>
          )}
        </div>
        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        {/* divider */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-4 py-4" : "px-8 py-6"}>
        {isMobile ? (
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">Reports</div>
                <h1 className="text-xl font-bold text-slate-900">Production Dashboard</h1>
              </div>
              <div className="text-xs font-semibold text-slate-500">{displayDate}</div>
            </div>

            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-3 mb-4 shadow-sm">
              <div className="text-[11px] text-emerald-700 mb-2">Date Filter</div>
              <div className="flex items-center gap-2">
                {period === "week" && (
                  <DatePicker
                    picker="week"
                    className="!w-full"
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                    onChange={(d) => setDate(d ? d.format("YYYY-[W]WW") : "")}
                  />
                )}
                {period === "month" && (
                  <DatePicker
                    picker="month"
                    className="!w-full"
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                    onChange={(d) => setDate(d ? d.format("YYYY-MM") : "")}
                  />
                )}
                {period === "year" && (
                  <DatePicker
                    picker="year"
                    className="!w-full"
                    style={{ fontSize: 16 }}
                    styles={{ input: { fontSize: 16 } }}
                    onChange={(d) => setDate(d ? d.format("YYYY") : "")}
                  />
                )}
                <button
                  type="button"
                  className="h-10 px-4 rounded-sm bg-[#008822] text-white text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
                { key: "year", label: "Year" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key as Period)}
                  className={[
                    "h-10 rounded-sm text-sm font-semibold border",
                    period === p.key
                      ? "bg-[#008822] text-white border-[#008822]"
                      : "bg-white text-slate-600 border-slate-200",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <StatCard
                title="Load Birds"
                total={data.load.total}
                done={data.load.done}
                pending={data.load.pending}
                accent={BRAND}
              />
              <StatCard
                title="Harvest"
                total={data.harvest.total}
                done={data.harvest.done}
                pending={data.harvest.pending}
                accent="#0f7aa8"
              />
            </div>

            <div className="rounded-sm bg-white shadow-sm border border-slate-100 p-4">
              <div className="text-sm font-semibold text-slate-800 mb-3">Trend</div>
              <div className="space-y-3">
                {data.trend.map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-10 text-xs font-semibold text-slate-500">{row.label}</div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full"
                          style={{ width: `${Math.min(100, (row.load / data.load.total) * 120)}%`, backgroundColor: BRAND }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 w-16 text-right">{row.load.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-2">Statuses</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-emerald-50 text-emerald-700">
                    Loading
                  </span>
                  <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-blue-50 text-blue-700">
                    Growing
                  </span>
                  <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-amber-50 text-amber-800">
                    Harvesting
                  </span>
                  <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-slate-100 text-slate-700">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6 grid grid-cols-12 gap-4">
              <div className="col-span-8 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-6 py-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Reports Snapshot</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">Production Dashboard</div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Load Total</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{data.load.total.toLocaleString()}</div>
                  </div>
                  <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Load Done</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{data.load.done.toLocaleString()}</div>
                  </div>
                  <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Harvest Total</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{data.harvest.total.toLocaleString()}</div>
                  </div>
                  <div className="rounded-sm bg-white/90 px-4 py-3 border border-emerald-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Harvest Done</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{data.harvest.done.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="col-span-4 rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Filters</div>
                <div className="mt-1 text-base font-semibold text-slate-800">Period & Date</div>
                <div className="mt-2 text-xs text-slate-500">{displayDate}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { key: "week", label: "Week" },
                    { key: "month", label: "Month" },
                    { key: "year", label: "Year" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPeriod(p.key as Period)}
                      className={[
                        "h-9 rounded-lg text-xs font-semibold border",
                        period === p.key
                          ? "bg-[#008822] text-white border-[#008822]"
                          : "bg-white text-slate-600 border-slate-200",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  {period === "week" && (
                    <DatePicker
                      picker="week"
                      className="!w-full"
                      style={{ fontSize: 16 }}
                      styles={{ input: { fontSize: 16 } }}
                      onChange={(d) => setDate(d ? d.format("YYYY-[W]WW") : "")}
                    />
                  )}
                  {period === "month" && (
                    <DatePicker
                      picker="month"
                      className="!w-full"
                      style={{ fontSize: 16 }}
                      styles={{ input: { fontSize: 16 } }}
                      onChange={(d) => setDate(d ? d.format("YYYY-MM") : "")}
                    />
                  )}
                  {period === "year" && (
                    <DatePicker
                      picker="year"
                      className="!w-full"
                      style={{ fontSize: 16 }}
                      styles={{ input: { fontSize: 16 } }}
                      onChange={(d) => setDate(d ? d.format("YYYY") : "")}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="mt-3 h-10 w-full rounded-lg bg-[#008822] text-white text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-5 space-y-4">
                <StatCard
                  title="Load Birds"
                  total={data.load.total}
                  done={data.load.done}
                  pending={data.load.pending}
                  accent={BRAND}
                />
                <StatCard
                  title="Harvest"
                  total={data.harvest.total}
                  done={data.harvest.done}
                  pending={data.harvest.pending}
                  accent="#0f7aa8"
                />
              </div>

              <div className="col-span-7 rounded-sm bg-white shadow-sm border border-slate-100 p-5">
                <div className="text-sm font-semibold text-slate-800 mb-3">Trend</div>
                <div className="space-y-3">
                  {data.trend.map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-10 text-xs font-semibold text-slate-500">{row.label}</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${Math.min(100, (row.load / data.load.total) * 120)}%`, backgroundColor: BRAND }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 w-16 text-right">{row.load.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-2">Statuses</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-emerald-50 text-emerald-700">
                      Loading
                    </span>
                    <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-blue-50 text-blue-700">
                      Growing
                    </span>
                    <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-amber-50 text-amber-800">
                      Harvesting
                    </span>
                    <span className="px-2 py-1 rounded-sm text-xs font-semibold bg-slate-100 text-slate-700">
                      Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
}
