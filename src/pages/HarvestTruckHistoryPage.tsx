import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout, Typography, Button, Divider, Grid } from "antd";
import dayjs from "dayjs";
import { FaSignOutAlt } from "react-icons/fa";
import { IoMdArrowRoundBack } from "react-icons/io";
import { IoHome } from "react-icons/io5";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import { loadHarvests, loadHarvestTrucks } from "../controller/harvestCrud";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const PRIMARY = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";

type HistoryRow = {
  date: string;
  dayNumber: number;
  truckCount: number;
  birdsLoaded: number;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

function ChickenState({
  title,
  subtitle,
  fullScreen,
}: {
  title: string;
  subtitle: string;
  fullScreen?: boolean;
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
      <div className="mt-3 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

export default function HarvestTruckHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const selectedDate = searchParams.get("date") ?? dayjs().format("YYYY-MM-DD");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const buildingId = Number(id);
      if (!Number.isFinite(buildingId) || buildingId <= 0) {
        setBuildingName("");
        setHistoryRows([]);
        return;
      }

      setIsLoading(true);
      try {
        const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
        const [{ data: buildingRow, error: buildingError }, { data: growRows, error: growError }] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("name").eq("id", buildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id")
            .eq("building_id", buildingId)
            .lt("created_at", selectedDayEnd)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (buildingError) throw buildingError;
        if (growError) throw growError;

        setBuildingName(buildingRow?.name ?? `Building ${buildingId}`);

        const activeGrowId = ((growRows ?? []) as Array<{ id: number | null }>)[0]?.id ?? null;
        const harvests =
          activeGrowId != null
            ? await loadHarvests({ growId: activeGrowId, limit: 1 })
            : await loadHarvests({ buildingId, limit: 1 });
        const harvest = harvests[0] ?? null;

        if (!harvest) {
          setHistoryRows([]);
          return;
        }

        const trucks = await loadHarvestTrucks({ harvestId: Number(harvest.id), ascending: true, limit: 500 });
        const trucksUntilSelectedDate = trucks.filter(
          (truck) => dayjs(truck.createdAt).valueOf() < dayjs(selectedDayEnd).valueOf()
        );

        if (trucksUntilSelectedDate.length === 0) {
          setHistoryRows([]);
          return;
        }

        const firstTruckDate = dayjs(trucksUntilSelectedDate[0].createdAt).startOf("day");
        const endDate = dayjs(selectedDate, "YYYY-MM-DD").startOf("day");
        const truckSummaryByDate = trucksUntilSelectedDate.reduce<Record<string, { trucks: number; birds: number }>>((acc, truck) => {
          const dateKey = dayjs(truck.createdAt).format("YYYY-MM-DD");
          acc[dateKey] = acc[dateKey] ?? { trucks: 0, birds: 0 };
          acc[dateKey].trucks += 1;
          acc[dateKey].birds += Math.max(0, Math.floor(Number(truck.animalsLoaded ?? 0)));
          return acc;
        }, {});

        const nextRows: HistoryRow[] = [];
        for (let cursor = firstTruckDate; cursor.isBefore(endDate) || cursor.isSame(endDate, "day"); cursor = cursor.add(1, "day")) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const summary = truckSummaryByDate[dateKey] ?? { trucks: 0, birds: 0 };
          nextRows.push({
            date: dateKey,
            dayNumber: cursor.diff(firstTruckDate, "day") + 1,
            truckCount: summary.trucks,
            birdsLoaded: summary.birds,
          });
        }

        setHistoryRows(nextRows);
      } catch (error) {
        setHistoryRows([]);
        setToastMessage(`Failed to load truck history: ${getErrorMessage(error)}`);
        setIsToastOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistory();
  }, [id, selectedDate]);

  const totalTrucks = useMemo(
    () => historyRows.reduce((sum, row) => sum + row.truckCount, 0),
    [historyRows]
  );

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-auto !min-h-14" : "!px-8 !h-[74px]",
        ].join(" ")}
        style={{
          backgroundColor: PRIMARY,
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
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">Harvest</div>
            <Title level={4} className="!m-0 !text-white !text-base md:!text-lg">
              Truck History
            </Title>
          </div>
        </div>

        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-8" : "px-8 py-6"}>
        {isLoading ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
        ) : historyRows.length === 0 ? (
          <ChickenState
            title="No truck history yet"
            subtitle={`No truck data found from day 1 up to ${dayjs(selectedDate).format("MMMM D, YYYY")}.`}
            fullScreen
          />
        ) : (
          <>
            <div className="rounded-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {buildingName || `Bldg ${id}`}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">Truck Daily History</div>
              <div className="mt-2 text-sm text-slate-600">
                Showing day 1 to {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days Listed</span>
                  <span className="text-sm font-bold text-slate-900">{historyRows.length}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trucks</span>
                  <span className="text-sm font-bold text-slate-900">{totalTrucks}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {historyRows.map((row) => (
                <div
                  key={row.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/truck/${id}?date=${row.date}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/truck/${id}?date=${row.date}`);
                    }
                  }}
                  className="cursor-pointer rounded-sm border border-emerald-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            row.truckCount > 0 ? "bg-emerald-500" : "bg-slate-300",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <div className="text-sm font-semibold text-slate-900">Day {row.dayNumber}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{dayjs(row.date).format("MMMM D, YYYY")}</div>
                    </div>
                    <div className="min-w-[132px] text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Trucks</div>
                      <div className="mt-0.5 text-2xl font-bold leading-none text-slate-900">
                        {row.truckCount.toLocaleString()}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Birds Loaded <span className="font-bold text-slate-700">{row.birdsLoaded.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Content>

      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type="success"
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
