import { useMemo, useState } from "react";
import { Button, Checkbox, Divider, Dropdown, Input, Typography } from "antd";
import { AppleFilled, FacebookOutlined, DownOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

type Lang = { key: string; label: string; flag: string };

const LANGS: Lang[] = [
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "ph", label: "Filipino", flag: "🇵🇭" },
];

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>(LANGS[0]);
  const [loginWithPhone, setLoginWithPhone] = useState(false);

  const navigate = useNavigate();

  const menuItems = useMemo(
    () =>
      LANGS.map((l) => ({
        key: l.key,
        label: (
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{l.flag}</span>
            <span>{l.label}</span>
          </div>
        ),
        onClick: () => setLang(l),
      })),
    []
  );

  return (
    <div className="min-h-screen w-full bg-slate-100">
      {/* Full-width desktop layout: split screen (50/50) */}
      <div className="min-h-screen w-full flex flex-col lg:flex-row">
        {/* LEFT - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-gradient-to-br from-[#008822] to-[#006e1b] px-10 xl:px-16 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full translate-y-48 -translate-x-48"></div>

          <div className="relative z-10">
            <div className="text-2xl xl:text-3xl font-semibold tracking-wide">
              GPM
            </div>
            <div className="mt-6 text-4xl xl:text-6xl font-bold leading-tight">
              Welcome Back <span className="inline-block animate-wave">👋</span>
            </div>
            <div className="mt-4 text-white/90 max-w-xl text-base xl:text-lg">
              Manage your poultry business easily across desktop, tablet and mobile.
            </div>

            {/* Feature list */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <span>Real-time inventory tracking</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <span>Sales and revenue analytics</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <span>Multi-device synchronization</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT - Full width on all devices */}
        <div className="w-full lg:w-1/2 bg-white">
          {/* Remove all padding constraints and make it truly full width */}
          <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-0">
            <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
              {/* Logo for mobile - visible only on mobile */}
              <div className="lg:hidden text-center mb-6">
                <div className="text-2xl font-semibold text-[#008822]">
                  GPM
                </div>
                <Text className="text-gray-500 text-sm">
                  Sign in to your account
                </Text>
              </div>

              {/* Language selector - repositioned for mobile */}
              <div className="flex justify-end mb-4 lg:hidden">
                <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 rounded-md px-3 py-2 border border-gray-200 bg-white"
                  >
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span className="text-sm">{lang.label}</span>
                    <DownOutlined className="text-xs" />
                  </button>
                </Dropdown>
              </div>

              {/* Main card - no shadow on desktop to blend with background */}
              <div className="bg-white lg:bg-transparent rounded-2xl lg:rounded-none shadow-sm lg:shadow-none border border-gray-100 lg:border-0 overflow-hidden">
                {/* Desktop language selector - hidden on mobile */}
                <div className="hidden lg:block mb-6">
                  <div className="flex items-center justify-end">
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 rounded-md px-3 py-1.5 border border-gray-200 bg-white text-sm"
                      >
                        <span className="text-base leading-none">{lang.flag}</span>
                        <span>{lang.label}</span>
                        <DownOutlined className="text-xs" />
                      </button>
                    </Dropdown>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 lg:p-0">
                  {/* Desktop title */}
                  <div className="mb-6">
                    <Title level={2} className="!mb-2 !text-3xl lg:!text-4xl !font-bold">
                      Welcome back
                    </Title>
                    <Text className="text-gray-500 text-base">
                      Sign in to your account to continue
                    </Text>
                  </div>

                  <div className="space-y-5">
                    {/* Social login buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        size="large"
                        icon={<FacebookOutlined />}
                        className="!h-12 !rounded-lg !border-[#008822]/25 !text-[#008822] !font-semibold hover:!bg-[#008822]/5 !text-base"
                        block
                      >
                        Facebook
                      </Button>

                      <Button
                        size="large"
                        icon={<AppleFilled />}
                        className="!h-12 !rounded-lg !bg-gray-900 !text-white !border-gray-900 hover:!bg-gray-800 !text-base"
                        block
                      >
                        Apple
                      </Button>
                    </div>

                    <Divider plain className="!my-6">
                      <span className="text-gray-400 text-sm">or continue with email</span>
                    </Divider>

                    {/* Login form */}
                    <div className="space-y-4">
                      <div>
                        <Text className="text-sm font-medium text-gray-700 block mb-1">
                          {loginWithPhone ? "Phone number" : "Email address"}
                        </Text>
                        <Input
                          size="large"
                          placeholder={loginWithPhone ? "+1 (555) 000-9999" : "name@example.com"}
                          className="!h-12 !rounded-lg !border-gray-300 hover:!border-[#008822]/60 focus:!border-[#008822] focus:!shadow-none !text-base"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Text className="text-sm font-medium text-gray-700">
                            Password
                          </Text>
                          <button
                            type="button"
                            className="text-sm text-[#008822] hover:text-[#006e1b] font-medium"
                          >
                            Forgot?
                          </button>
                        </div>
                        <Input.Password
                          size="large"
                          placeholder="Enter your password"
                          className="!h-12 !rounded-lg !border-gray-300 hover:!border-[#008822]/60 focus:!border-[#008822] focus:!shadow-none !text-base"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Checkbox
                          checked={loginWithPhone}
                          onChange={(e) => setLoginWithPhone(e.target.checked)}
                          className="text-sm"
                        >
                          <span className="text-gray-600">
                            Use phone instead
                          </span>
                        </Checkbox>
                      </div>

                      <Button
                        type="primary"
                        block
                        size="large"
                        className="!h-12 !rounded-lg !bg-[#008822] hover:!bg-[#006e1b] !border-none !font-semibold !text-base shadow-sm !mt-6"
                        onClick={() => navigate("/landing-page")}
                      >
                        Sign In
                      </Button>

                      <div className="text-center text-base text-gray-500 !mt-8">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          className="text-[#008822] hover:text-[#006e1b] font-semibold"
                          onClick={() => navigate("/register")}
                        >
                          Register
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile footer */}
              <div className="mt-8 text-center lg:hidden">
                <Text className="text-gray-400 text-xs">
                  © 2024 123POULTRY. All rights reserved.
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
        }
        .animate-wave {
          animation: wave 2s infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
