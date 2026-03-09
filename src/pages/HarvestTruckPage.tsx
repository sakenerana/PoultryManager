import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Drawer, Form, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import {
  addHarvest,
  addHarvestTruck,
  deleteHarvestTruck,
  getHarvestById,
  loadHarvests,
  loadHarvestTrucks,
  updateHarvest,
  updateHarvestTruck,
} from "../controller/harvestCrud";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Truck = {
  status: "Loading" | "Completed";
  id: string;
  harvestId: number | null;
  name: string;
  dateTime: string;
  plateNo: string;
  weightNoLoad: number;
  birdsLoad: number;
  weightLoad: number;
  isLoaded: boolean;
};

const PRIMARY = "#008822";
const SECONDARY = "#ffa600";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Failed to add truck.";
}

const parseTruckDate = (value: string) => {
  const withTime = dayjs(value, "YYYY-MM-DD HH:mm", true);
  if (withTime.isValid()) return withTime;
  const dateOnly = dayjs(value, "YYYY-MM-DD", true);
  if (dateOnly.isValid()) return dateOnly;
  return dayjs(value);
};

const computeAvgWeight = (truck: Truck) => {
  if (truck.birdsLoad <= 0) return null;
  return (truck.weightLoad - truck.weightNoLoad) / truck.birdsLoad;
};

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] text-slate-500 leading-none">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold text-slate-900 leading-none">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Truck["status"] }) {
  const styles: Record<Truck["status"], { dot: string; text: string }> = {
    Loading: { dot: "bg-blue-500", text: "text-blue-700" },
    Completed: { dot: "bg-emerald-500", text: "text-emerald-700" },
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
      <div className="mt-3 text-sm font-semibold text-[#008822]">{title}</div>
      <div className="mt-1 text-xs text-[#008822]/80">{subtitle}</div>
    </div>
  );
}

function TruckRow({
  truck,
  isMobile,
  displayName,
  canLoad,
  onLoadClick,
}: {
  truck: Truck;
  isMobile: boolean;
  displayName: string;
  canLoad: boolean;
  onLoadClick: (truck: Truck) => void;
}) {
  const avgWeight = computeAvgWeight(truck);

  return (
    <Card
      hoverable
      className={["!border-0 shadow-sm hover:shadow-md transition", "!rounded-sm"].join(" ")}
      bodyStyle={{ padding: isMobile ? 10 : 12 }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={["flex items-center justify-center shrink-0", isMobile ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl"].join(
            " "
          )}
          style={{ backgroundColor: `${PRIMARY}22` }}
        >
          <img src="/img/truck2.svg" alt="Truck" className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-slate-900 truncate" style={{ fontSize: isMobile ? 13 : 15 }}>
              {displayName}
            </div>
            {canLoad && truck.status === "Loading" && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadClick(truck);
                }}
                className={[
                  "!font-medium shadow-sm !rounded-md",
                  isMobile ? "!px-3 !h-6 !text-[12px]" : "!px-4 !h-8 !text-[12px]",
                ].join(" ")}
                style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              >
                Load Truck
              </Button>
            )}
          </div>

          <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
            <StatPill
              label="Date & time"
              value={truck.dateTime ? parseTruckDate(truck.dateTime).format("MMMM D, YYYY HH:mm") : "N/A"}
            />
            <StatPill label="Plate No." value={truck.plateNo?.trim() ? truck.plateNo : "N/A"} />
            <StatPill
              label="Weight(No Load)"
              value={truck.weightNoLoad > 0 ? `${truck.weightNoLoad.toLocaleString()} kg` : "0 kg"}
            />
            <StatPill
              label="Weight(Load)"
              value={truck.weightLoad > 0 ? `${truck.weightLoad.toLocaleString()} kg` : "0 kg"}
            />
            <StatPill label="Birds Load" value={truck.birdsLoad > 0 ? truck.birdsLoad.toLocaleString() : "0"} />
            <StatPill
              label="Avg. Weight"
              value={avgWeight !== null ? `${avgWeight.toFixed(2)} kg/bird` : "N/A"}
            />
            <StatPill label="Status" value={<StatusBadge status={truck.status} />} />
          </div>
        </div>

        {!isMobile && <div className="text-slate-300 text-lg mt-2">{">"}</div>}
      </div>
    </Card>
  );
}

export default function HarvestTruckPage() {
  const navigate = useNavigate();
  const { id: buildingIdParam } = useParams<{ id: string }>();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [isLoadingTrucks, setIsLoadingTrucks] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [isLoadDrawerOpen, setIsLoadDrawerOpen] = useState(false);
  const [isSavingLoad, setIsSavingLoad] = useState(false);
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null);
  const [activeHarvestRemaining, setActiveHarvestRemaining] = useState<number | null>(null);
  const [activeTruckPreviousBirdsLoad, setActiveTruckPreviousBirdsLoad] = useState(0);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addForm] = Form.useForm();
  const [loadForm] = Form.useForm();
  const loadFormValues = Form.useWatch([], loadForm);

  const isTodaySelected = selectedDate === dayjs().format("YYYY-MM-DD");
  const isLoadFormValid =
    Number(loadFormValues?.weightLoad) > 0 &&
    Number(loadFormValues?.birdsLoad) > 0;

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
  };

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    const nextDate = date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(nextDate);
    setToastMessage(`Filtered date: ${dayjs(nextDate).format("MMM D, YYYY")}`);
    setIsToastOpen(true);
  };

  const filteredTrucks = useMemo(() => {
    const getTrailingNumber = (name: string): number | null => {
      const match = name.match(/(\d+)\s*$/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    };

    return trucks
      .filter((truck) => parseTruckDate(truck.dateTime).format("YYYY-MM-DD") === selectedDate)
      .sort((a, b) => {
        const aNum = getTrailingNumber(a.name);
        const bNum = getTrailingNumber(b.name);

        if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
        if (aNum != null && bNum == null) return -1;
        if (aNum == null && bNum != null) return 1;

        const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        if (nameOrder !== 0) return nameOrder;

        return parseTruckDate(a.dateTime).valueOf() - parseTruckDate(b.dateTime).valueOf();
      });
  }, [trucks, selectedDate]);

  const activeTruck = useMemo(() => {
    if (!activeTruckId) return null;
    return trucks.find((truck) => truck.id === activeTruckId) ?? null;
  }, [activeTruckId, trucks]);

  const loadDrawerAvgWeight = useMemo(() => {
    if (!activeTruck) return null;
    const weightLoad = Number(loadFormValues?.weightLoad) || 0;
    const birdsLoad = Number(loadFormValues?.birdsLoad) || 0;
    if (birdsLoad <= 0) return null;
    return (weightLoad - activeTruck.weightNoLoad) / birdsLoad;
  }, [activeTruck, loadFormValues?.birdsLoad, loadFormValues?.weightLoad]);

  const totals = useMemo(() => {
    const totalBirdsLoad = filteredTrucks.reduce((sum, t) => sum + t.birdsLoad, 0);
    const totalWeightLoad = filteredTrucks.reduce((sum, t) => sum + t.weightLoad, 0);
    return { totalBirdsLoad, totalWeightLoad };
  }, [filteredTrucks]);

  const getGrowTotalAnimals = async (growId: number | null, fallbackBuildingId: number): Promise<number | null> => {
    if (growId !== null) {
      const { data, error } = await supabase
        .from(GROWS_TABLE)
        .select("total_animals")
        .eq("id", growId)
        .single();

      if (error) throw error;
      return Math.max(0, Math.floor(Number(data?.total_animals ?? 0)));
    }

    const { data, error } = await supabase
      .from(GROWS_TABLE)
      .select("total_animals, created_at")
      .eq("building_id", fallbackBuildingId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return Math.max(0, Math.floor(Number(data[0]?.total_animals ?? 0)));
  };

  const fetchTrucksFromSupabase = async () => {
    const buildingId = Number(buildingIdParam);
    if (!Number.isFinite(buildingId) || buildingId <= 0) {
      setTrucks([]);
      return;
    }

    setIsLoadingTrucks(true);
    try {
      const selectedDayStart = `${selectedDate}T00:00:00+00:00`;
      const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;

      const harvests = await loadHarvests({ buildingId, limit: 500 });
      if (harvests.length === 0) {
        setTrucks([]);
        return;
      }

      const byHarvest = await Promise.all(
        harvests.map((harvest) =>
          loadHarvestTrucks({
            harvestId: Number(harvest.id),
            createdFrom: selectedDayStart,
            createdTo: selectedDayEnd,
            ascending: false,
            limit: 500,
          })
        )
      );

      const merged = byHarvest
        .flat()
        .map<Truck>((row) => {
          const normalizedStatus = (row.status ?? "").toLowerCase();
          const status: Truck["status"] = normalizedStatus === "completed" || normalizedStatus === "complete"
            ? "Completed"
            : "Loading";
          return {
            id: row.id,
            harvestId: row.harvestId,
            name: row.name || "Truck",
            dateTime: dayjs(row.createdAt).format("YYYY-MM-DD HH:mm"),
            plateNo: row.plateNo || "",
            weightNoLoad: Number(row.weightNoLoad) || 0,
            birdsLoad: Number(row.animalsLoaded) || 0,
            weightLoad: Number(row.weightWithLoad) || 0,
            status,
            isLoaded: status === "Completed",
          };
        })
        .sort((a, b) => parseTruckDate(b.dateTime).valueOf() - parseTruckDate(a.dateTime).valueOf());

      setTrucks(merged);
    } catch (error) {
      console.error("Failed to load trucks from Supabase:", error);
      setTrucks([]);
    } finally {
      setIsLoadingTrucks(false);
    }
  };

  useEffect(() => {
    void fetchTrucksFromSupabase();
  }, [buildingIdParam, selectedDate]);

  const handleOpenAdd = () => {
    const nextIndex = filteredTrucks.length + 1;
    addForm.setFieldsValue({
      name: `Truck ${nextIndex}`,
      dateTime: dayjs(),
      plateNo: "",
      weightNoLoad: 0,
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    addForm.resetFields();
  };

  const handleSubmitAdd = async () => {
    let createdTruckId: string | null = null;
    setIsSavingAdd(true);
    try {
      const values = await addForm.validateFields();
      const buildingId = Number(buildingIdParam);
      if (!Number.isFinite(buildingId) || buildingId <= 0) {
        throw new Error("Invalid building id.");
      }

      // 1) Insert to HarvestTrucks first, default status = Loading.
      const createdTruck = await addHarvestTruck({
        harvestId: null,
        name: values.name,
        plateNo: values.plateNo,
        weightNoLoad: Number(values.weightNoLoad) || 0,
        weightWithLoad: 0,
        animalsLoaded: 0,
        status: "Loading",
      });
      createdTruckId = createdTruck.id;

      // 2) Upsert Harvests with default status = Loading.
      const { data: growRows, error: growError } = await supabase
        .from(GROWS_TABLE)
        .select("id, created_at")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (growError) throw growError;
      const grow = (growRows?.[0] ?? null) as { id: number } | null;

      const growId = grow ? Number(grow.id) : null;

      const existingHarvests = await loadHarvests({
        ...(growId !== null ? { growId } : { buildingId }),
        limit: 1,
      });
      const harvestRecord = existingHarvests.length > 0
        ? await updateHarvest(existingHarvests[0].id, {
            buildingId,
            growId,
            status: "Loading",
          })
        : await addHarvest({
            buildingId,
            growId,
            totalAnimals: 0,
            status: "Loading",
          });

      // Keep relation after Harvest is available.
      await updateHarvestTruck(createdTruck.id, {
        harvestId: Number(harvestRecord.id),
        status: "Loading",
      });

      await fetchTrucksFromSupabase();
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch (error) {
      if (createdTruckId) {
        await deleteHarvestTruck(createdTruckId).catch(() => undefined);
      }
      const message = getErrorMessage(error);
      console.error("Failed to add truck:", error);
      setToastMessage(message);
      setIsToastOpen(true);
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleOpenLoadDrawer = (truck: Truck) => {
    const buildingId = Number(buildingIdParam);
    setActiveTruckId(truck.id);
    setActiveTruckPreviousBirdsLoad(truck.birdsLoad || 0);
    setActiveHarvestRemaining(null);

    if (truck.harvestId !== null && Number.isFinite(buildingId) && buildingId > 0) {
      void getHarvestById(truck.harvestId)
        .then(async (harvest) => {
          const growTotalAnimals = await getGrowTotalAnimals(harvest.growId, buildingId);
          if (growTotalAnimals === null) {
            setActiveHarvestRemaining(null);
            return;
          }

          const remaining = Math.max(0, growTotalAnimals - harvest.totalAnimals);
          setActiveHarvestRemaining(remaining);
        })
        .catch(() => {
          setActiveHarvestRemaining(null);
        });
    }

    loadForm.setFieldsValue({
      weightLoad: truck.weightLoad || 0,
      birdsLoad: truck.birdsLoad || 0,
    });
    setIsLoadDrawerOpen(true);
  };

  const handleCloseLoadDrawer = () => {
    setIsLoadDrawerOpen(false);
    setActiveTruckId(null);
    setActiveHarvestRemaining(null);
    setActiveTruckPreviousBirdsLoad(0);
    loadForm.resetFields();
  };

  const handleSubmitLoad = async () => {
    setIsSavingLoad(true);
    try {
      if (!activeTruckId) return;
      const values = await loadForm.validateFields();

      const nextWeightLoad = Number(values.weightLoad) || 0;
      const nextAnimalsLoaded = Number(values.birdsLoad) || 0;
      const animalsLoadedDelta = nextAnimalsLoaded - activeTruckPreviousBirdsLoad;

      const updatedTruck = await updateHarvestTruck(activeTruckId, {
        weightWithLoad: nextWeightLoad,
        animalsLoaded: nextAnimalsLoaded,
        status: "Completed",
      });

      if (updatedTruck.harvestId !== null) {
        const buildingId = Number(buildingIdParam);
        if (!Number.isFinite(buildingId) || buildingId <= 0) {
          throw new Error("Invalid building id.");
        }

        const harvest = await getHarvestById(updatedTruck.harvestId);
        const nextTotalAnimalsOut = Math.max(0, harvest.totalAnimals + animalsLoadedDelta);
        const growTotalAnimals = await getGrowTotalAnimals(harvest.growId, buildingId);
        const remainingAfterLoad = growTotalAnimals === null
          ? null
          : Math.max(0, growTotalAnimals - nextTotalAnimalsOut);

        const shouldMarkHarvestCompleted = remainingAfterLoad !== null && remainingAfterLoad <= 0;
        const shouldUpdateTotalAnimalsOut = animalsLoadedDelta !== 0;

        if (shouldUpdateTotalAnimalsOut || shouldMarkHarvestCompleted) {
          await updateHarvest(harvest.id, {
            ...(shouldUpdateTotalAnimalsOut ? { totalAnimals: nextTotalAnimalsOut } : {}),
            ...(shouldMarkHarvestCompleted ? { status: "Completed" } : {}),
          });
        }

        if (shouldMarkHarvestCompleted && harvest.growId !== null) {
          const { error: growUpdateError } = await supabase
            .from(GROWS_TABLE)
            .update({
              status: "Harvested",
              is_harvested: true,
            })
            .eq("id", harvest.growId);

          if (growUpdateError) throw growUpdateError;
        }
      }

      await fetchTrucksFromSupabase();
      handleCloseLoadDrawer();
      setToastMessage("Truck loaded successfully.");
      setIsToastOpen(true);
    } catch {
      // validation handled by antd
    } finally {
      setIsSavingLoad(false);
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
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
            Truck
          </Title>
        </div>

        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={handleSignOut}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-3 py-3 pb-28" : "px-4 py-4"}>
        {isLoadingTrucks ? (
          <ChickenState title="Loading..." subtitle="" fullScreen />
        ) : (
          <>
            <div
              className={[
                "bg-white shadow-sm",
                isMobile ? "rounded-sm px-3 py-3 mb-3" : "rounded-sm px-4 py-4 mb-4",
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
                onChange={handleDateChange}
                style={{ fontSize: 16 }}
                styles={{ input: { fontSize: 16 } }}
              />
            </div>

            <div>
              <div className={["bg-[#ffa6001f]", isMobile ? "rounded-sm px-3 py-2" : "rounded-sm px-4 py-3"].join(" ")}>
                <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
                  Active Trucks ({filteredTrucks.length})
                </div>
              </div>

              <Divider className={isMobile ? "!my-2" : "!my-3"} />

              <div className="bg-white rounded-sm shadow-sm p-3 mb-3 flex items-center justify-between text-sm">
                <div className="text-slate-600">
                  Total Birds Load: <span className="font-semibold text-slate-900">{totals.totalBirdsLoad.toLocaleString()}</span>
                </div>
                <div className="text-slate-600">
                  Total Weight (Load):{" "}
                  <span className="font-semibold text-slate-900">{totals.totalWeightLoad.toLocaleString()} kg</span>
                </div>
              </div>

              <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
                {filteredTrucks.map((truck) => (
                  <TruckRow
                    key={truck.id}
                    truck={truck}
                    isMobile={isMobile}
                    displayName={truck.name}
                    canLoad={isTodaySelected}
                    onLoadClick={handleOpenLoadDrawer}
                  />
                ))}
              </div>
            </div>

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
          </>
        )}
      </Content>

      <Drawer
        open={isAddModalOpen}
        onClose={handleCloseAdd}
        placement="bottom"
        height={isMobile ? "70%" : 540}
        className="add-truck-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Add Truck
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter the details to add a truck record.
          </div>
        </div>

        <Form form={addForm} layout="vertical" requiredMark={false}>
          <Form.Item label="Truck Name" name="name" rules={[{ required: true, message: "Please enter truck name" }]}>
            <Input placeholder="e.g., Truck 4" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Date"
            name="dateTime"
            rules={[{ required: true, message: "Please enter date and time" }]}
          >
            <DatePicker
              format="MMMM D, YYYY"
              className="!w-full"
              size="large"
              placeholder="Select date"
            />
          </Form.Item>
          <Form.Item
            label="Plate No."
            name="plateNo"
            rules={[
              { required: true },
              {
                validator: (_, value) =>
                  typeof value === "string" && value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("Please enter plate no.")),
              },
            ]}
          >
            <Input placeholder="e.g., ABC-1234" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Weight of Truck(No Load)"
            name="weightNoLoad"
            rules={[
              { required: true, message: "Please enter weight (no load)" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
            ]}
          >
            <Input min={0} type="number" inputMode="decimal" size="large" className="!text-base" />
          </Form.Item>
          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              className="!w-full !rounded-lg !h-12"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleSubmitAdd}
              loading={isSavingAdd}
              disabled={isSavingAdd}
            >
              Load Truck
            </Button>
          </div>
        </Form>
      </Drawer>

      <Drawer
        open={isLoadDrawerOpen}
        onClose={handleCloseLoadDrawer}
        placement="right"
        width={isMobile ? "100%" : 420}
        className="load-truck-drawer"
        bodyStyle={{ padding: 16 }}
      >
        <div className="mb-4">
          <Title level={4} className="!m-0">
            Load Truck
          </Title>
          <div className="text-slate-500 text-sm mt-1">
            Enter load details for this truck.
          </div>
          <div className="text-slate-600 text-sm mt-2">
            Remaining:{" "}
            <span className="font-semibold text-slate-900">
              {activeHarvestRemaining !== null ? activeHarvestRemaining.toLocaleString() : "N/A"}
            </span>
          </div>
          <div className="text-slate-600 text-sm mt-1">
            Avg. Weight Truck:{" "}
            <span className="font-semibold text-slate-900">
              {loadDrawerAvgWeight !== null ? `${loadDrawerAvgWeight.toFixed(2)} kg/bird` : "N/A"}
            </span>
          </div>
        </div>

        <Form form={loadForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Weight of Truck(Loaded)"
            name="weightLoad"
            rules={[
              { required: true, message: "Please enter weight (loaded)" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
            ]}
          >
            <Input min={0} type="number" inputMode="decimal" size="large" className="!text-base" />
          </Form.Item>
          <Form.Item
            label="Birds Load"
            name="birdsLoad"
            rules={[
              { required: true, message: "Please enter birds load" },
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error("Value must be greater than 0")),
              },
              {
                validator: (_, value) => {
                  if (activeHarvestRemaining === null) return Promise.resolve();
                  const maxAllowed = activeHarvestRemaining + activeTruckPreviousBirdsLoad;
                  if (Number(value) <= maxAllowed) return Promise.resolve();
                  return Promise.reject(
                    new Error(
                      `Birds load cannot exceed ${maxAllowed.toLocaleString()} (remaining + current truck load).`
                    )
                  );
                },
              },
            ]}
          >
            <Input min={0} type="number" inputMode="numeric" size="large" className="!text-base" />
          </Form.Item>

          <div className="mt-4 flex gap-2">
            <Button className="!flex-1" onClick={handleCloseLoadDrawer}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!flex-1"
              style={{ backgroundColor: SECONDARY, borderColor: SECONDARY }}
              onClick={handleSubmitLoad}
              disabled={!isLoadFormValid || isSavingLoad}
              loading={isSavingLoad}
            >
              Save
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
