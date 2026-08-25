import { Button, Card, Divider, Layout, Typography } from "antd";
import { FaSignOutAlt } from "react-icons/fa";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { signOutAndRedirect } from "../utils/auth";

const BRAND = "#008822";
const { Header, Content } = Layout;
const { Title } = Typography;

export default function FeedsConsumptionReportPage() {
  const navigate = useNavigate();
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";

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
            Feeds Consumption
          </Title>
        </div>
        <Button
          type="text"
          icon={<FaSignOutAlt size={18} />}
          className="!text-white hover:!text-white/90"
          onClick={() => void signOutAndRedirect(navigate)}
          aria-label="Sign out"
        />
        <div className="absolute bottom-0 left-0 h-1 w-full bg-[#ffc700]" />
      </Header>

      <Content className="px-3 py-3 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-[420px] md:max-w-4xl">
          <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-lime-700 px-4 py-4 text-white md:mb-5 md:px-6 md:py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Reports Center
            </div>
            <div className="mt-1.5 text-xl font-bold leading-tight md:text-3xl">
              Feeds Consumption Report
            </div>
            <div className="mt-1 text-xs text-emerald-50/90 md:text-sm">
              Feed usage reporting is ready for the database form and table fields.
            </div>
          </div>

          <Card className="!rounded-sm !border !border-orange-200 shadow-sm" styles={{ body: { padding: 16 } }}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-2xl bg-[#f3d89f] p-3">
                <img src="/img/feeds.svg" alt="Feeds Consumption" className="h-12 w-12" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                  Setup Pending
                </div>
                <div className="mt-1 text-lg font-bold leading-tight text-slate-900">
                  Waiting for feeds form fields
                </div>
                <div className="mt-1 text-sm leading-relaxed text-slate-500">
                  Once the database table is provided, this page can show feed entries, totals, date filters,
                  building or grow selection, and PDF export.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  );
}
