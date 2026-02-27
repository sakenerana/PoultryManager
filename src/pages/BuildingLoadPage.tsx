import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Layout, Button, Divider, Grid, Typography } from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;
const BRAND = "#008822";

export default function BuildingLoadPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const todayKey = dayjs().format("YYYY-MM-DD");
  const todayDisplay = dayjs().format("MMMM D, YYYY");
  const [historyEntries, setHistoryEntries] = useState<
    Array<{ date: string; dateTime: string; total: number }>
  >([]);
  const [totalInput, setTotalInput] = useState("");
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const todayTotal = useMemo(() => {
    const entriesToday = historyEntries.filter((entry) => entry.date === todayKey);
    return entriesToday.length > 0 ? entriesToday[entriesToday.length - 1].total : 0;
  }, [historyEntries, todayKey]);

  const hasTodayRecord = todayTotal > 0;

  const history = useMemo(() => {
    return [...historyEntries].reverse();
  }, [historyEntries]);

  const grandTotal = useMemo(() => {
    return historyEntries.reduce((sum, entry) => sum + entry.total, 0);
  }, [historyEntries]);

  const handleSaveOrUpdate = () => {
    const parsed = Number(totalInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const total = Math.floor(parsed);
    const actionLabel = hasTodayRecord ? "updated" : "saved";

    const now = dayjs();
    setHistoryEntries((prev) => [
      ...prev,
      { date: todayKey, dateTime: now.format("MMMM D, YYYY h:mm A"), total },
    ]);
    setTotalInput("");
    setToastMessage(`Building load ${actionLabel} successfully.`);
    setIsToastOpen(true);
  };

  const isTotalValid = totalInput.trim() !== "" && Number.isFinite(Number(totalInput)) && Number(totalInput) >= 0;

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header
        className={[
          "sticky top-0 z-40",
          "flex items-center justify-between",
          isMobile ? "!px-3 !h-14" : "!px-4 !h-16",
        ].join(" ")}
        style={{ backgroundColor: BRAND }}
      >
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate(-1)}
            aria-label="Back"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Button
            type="text"
            icon={<HomeOutlined />}
            className="!text-white hover:!text-white/90"
            onClick={() => navigate("/landing-page")}
            aria-label="Home"
          />
          <Divider
            type="vertical"
            className="!m-0 !h-5 !border-white/60"
          />
          <Title level={4} className={["!m-0 !text-white", isMobile ? "!text-base" : ""].join(" ")}>
            Building Load
          </Title>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={() => console.log("sign out")}
        />
      </Header>

      <Content className={["flex-1 flex", isMobile ? "px-3 py-3 pb-10" : "px-4 py-4"].join(" ")}>
        <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1 className="text-md pl-2 font-bold text-[#0f7aa8]">Building # {id ?? ""}</h1>
            </div>
            <div className="text-md pr-2 font-semibold text-slate-500">
              {todayDisplay}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex-1 min-h-0">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              History
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-slate-500">No history yet.</div>
            ) : (
              <ul className="text-sm text-slate-700 space-y-1">
                {history.map((item, index) => (
                  <li key={`${item.dateTime}-${index}`} className="flex items-center gap-3">
                    <span className="w-10 text-slate-500">#{history.length - index}</span>
                    <span className="flex-1">{item.dateTime}</span>
                    <span className="font-semibold">{item.total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Total Encoded (All)</span>
              <span className="font-semibold text-slate-900">{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mt-auto">
            <div className="text-[11px] text-slate-500 mb-2">Total Birds Loaded</div>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[#008822]/30"
                placeholder="Enter total count"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                inputMode="numeric"
              />
            <button
              type="button"
              className="text-base mt-3 w-full rounded-lg h-11 bg-[#008822] text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSaveOrUpdate}
              disabled={!isTotalValid}
            >
              {hasTodayRecord ? "Update" : "Save"}
            </button>
          </div>
        </div>
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
