import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Divider, Grid, DatePicker, Drawer, Form, Input } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type Truck = {
  status: "Loading" | "Completed";
  id: string;
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

const TRUCKS: Truck[] = [
  {
    status: "Loading",
    id: "1",
    name: "Truck 1",
    dateTime: "2026-03-03 08:30",
    plateNo: "ABC-1234",
    weightNoLoad: 3750,
    birdsLoad: 850,
    weightLoad: 6520,
    isLoaded: true,
  },
  {
    status: "Completed",
    id: "2",
    name: "Truck 2",
    dateTime: "2026-03-03 09:15",
    plateNo: "DEF-4567",
    weightNoLoad: 3920,
    birdsLoad: 900,
    weightLoad: 6880,
    isLoaded: true,
  },
  {
    status: "Completed",
    id: "3",
    name: "Truck 3",
    dateTime: "2026-03-03 10:00",
    plateNo: "GHI-7890",
    weightNoLoad: 3600,
    birdsLoad: 780,
    weightLoad: 6215,
    isLoaded: true,
  },
];

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [trucks, setTrucks] = useState<Truck[]>(TRUCKS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoadDrawerOpen, setIsLoadDrawerOpen] = useState(false);
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null);
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
    return trucks.filter((truck) => parseTruckDate(truck.dateTime).format("YYYY-MM-DD") === selectedDate);
  }, [trucks, selectedDate]);

  const totals = useMemo(() => {
    const totalBirdsLoad = filteredTrucks.reduce((sum, t) => sum + t.birdsLoad, 0);
    const totalWeightLoad = filteredTrucks.reduce((sum, t) => sum + t.weightLoad, 0);
    return { totalBirdsLoad, totalWeightLoad };
  }, [filteredTrucks]);

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
    try {
      const values = await addForm.validateFields();
      const nextId = (Math.max(0, ...trucks.map((truck) => Number(truck.id) || 0)) + 1).toString();
      const newTruck: Truck = {
        status: "Loading",
        id: nextId,
        name: values.name,
        dateTime: `${dayjs(values.dateTime).format("YYYY-MM-DD")} ${dayjs().format("HH:mm")}`,
        plateNo: values.plateNo,
        weightNoLoad: Number(values.weightNoLoad) || 0,
        birdsLoad: 0,
        weightLoad: 0,
        isLoaded: false,
      };
      setTrucks((prev) => [...prev, newTruck]);
      handleCloseAdd();
      setToastMessage(`Successfully added ${values.name}`);
      setIsToastOpen(true);
    } catch {
      // validation handled by antd
    }
  };

  const handleOpenLoadDrawer = (truck: Truck) => {
    setActiveTruckId(truck.id);
    loadForm.setFieldsValue({
      weightLoad: truck.weightLoad || 0,
      birdsLoad: truck.birdsLoad || 0,
    });
    setIsLoadDrawerOpen(true);
  };

  const handleCloseLoadDrawer = () => {
    setIsLoadDrawerOpen(false);
    setActiveTruckId(null);
    loadForm.resetFields();
  };

  const handleSubmitLoad = async () => {
    try {
      if (!activeTruckId) return;
      const values = await loadForm.validateFields();
      const payload = {
        weightLoad: Number(values.weightLoad) || 0,
        birdsLoad: Number(values.birdsLoad) || 0,
        status: "Completed" as const,
        isLoaded: true,
      };
      setTrucks((prev) =>
        prev.map((truck) =>
          truck.id === activeTruckId
            ? {
              ...truck,
              ...payload,
            }
            : truck
        )
      );
      handleCloseLoadDrawer();
      setToastMessage("Truck loaded successfully.");
      setIsToastOpen(true);
    } catch {
      // validation handled by antd
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
        <div
          className={[
            "bg-white shadow-sm",
            isMobile ? "rounded-lg px-3 py-3 mb-3" : "rounded-xl px-4 py-4 mb-4",
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
          <div className={["bg-[#ffa6001f]", isMobile ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"].join(" ")}>
            <div className={["font-semibold text-slate-700", isMobile ? "text-xs" : "text-sm"].join(" ")}>
              Active Trucks ({filteredTrucks.length})
            </div>
          </div>

          <Divider className={isMobile ? "!my-2" : "!my-3"} />

          <div className="bg-white rounded-xl shadow-sm p-3 mb-3 flex items-center justify-between text-sm">
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
              disabled={!isLoadFormValid}
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
