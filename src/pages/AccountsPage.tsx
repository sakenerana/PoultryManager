import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layout,
  Typography,
  Button,
  Divider,
  Grid,
  Card,
  Form,
  Input,
  Select,
  Tag,
  Drawer,
} from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined, UserAddOutlined } from "@ant-design/icons";
import NotificationToast from "../components/NotificationToast";
import { signOutAndRedirect } from "../utils/auth";
import { loadBuildings } from "../controller/buildingCrud";
import type { Role, Status, UserAccount } from "../type/user.types";
import type { BuildingRecord } from "../type/building.type";
import { addUser, loadUsers, updateUser } from "../controller/userCrud";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const PRIMARY = "#008822";
const ACCENT = "#ffa600";
const roleColors: Record<Role, string> = {
  Admin: "red",
  Supervisor: "blue",
  Staff: "green",
};

const statusColors: Record<Status, string> = {
  Active: "success",
  Inactive: "default",
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

function ChickenState({
  title,
  subtitle,
  titleClassName,
  subtitleClassName,
}: {
  title: string;
  subtitle: string;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center">
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
      <div className={["mt-3 text-sm font-semibold", titleClassName ?? "text-slate-700"].join(" ")}>{title}</div>
      <div className={["mt-1 text-xs", subtitleClassName ?? "text-slate-500"].join(" ")}>{subtitle}</div>
    </div>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch("role", form) as Role | undefined;

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const userListRef = useRef<HTMLDivElement | null>(null);

  const refreshFromSupabase = async (showLoading = false) => {
    if (showLoading) setIsLoadingUsers(true);
    try {
      const [userData, buildingData] = await Promise.all([loadUsers(), loadBuildings()]);
      setUsers(userData);
      setBuildings(buildingData);
    } catch {
      setToastType("error");
      setToastMessage("Unable to load users/buildings from Supabase.");
      setIsToastOpen(true);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    void refreshFromSupabase(true);
  }, []);

  useEffect(() => {
    if (selectedRole === "Staff") return;
    form.setFieldValue("buildingId", undefined);
  }, [selectedRole, form]);

  const totals = useMemo(() => {
    const active = users.filter((u) => u.status === "Active").length;
    const admins = users.filter((u) => u.role === "Admin").length;
    const supervisors = users.filter((u) => u.role === "Supervisor").length;
    return { total: users.length, active, admins, supervisors };
  }, [users]);

  const buildingOptions = useMemo(
    () =>
      buildings
        .map((building) => {
          const id = Number(building.id);
          if (!Number.isFinite(id)) return null;
          return { label: building.name, value: id };
        })
        .filter((option): option is { label: string; value: number } => option !== null),
    [buildings]
  );

  const buildingNameById = useMemo(
    () =>
      new Map(
        buildingOptions.map((option) => [option.value, option.label] as const)
      ),
    [buildingOptions]
  );

  const openAdd = () => {
    setEditingUserId(null);
    form.setFieldsValue({
      role: "Staff",
      status: "Active",
      buildingId: undefined,
      email: "",
      password: "",
      confirmPassword: "",
    });
    setIsAddOpen(true);
  };

  const openEdit = (user: UserAccount) => {
    setEditingUserId(user.id);
    form.setFieldsValue({
      fullName: user.fullName,
      buildingId: user.buildingId ?? undefined,
      role: user.role,
      status: user.status,
    });
    setIsAddOpen(true);
  };

  const closeAdd = () => {
    setIsAddOpen(false);
    setEditingUserId(null);
    form.resetFields();
  };

  const handleAddUser = async () => {
    try {
      const values = await form.validateFields();
      const buildingId = values.role === "Staff" ? Number(values.buildingId) : null;

      if (editingUserId) {
        await updateUser(editingUserId, {
          fullName: String(values.fullName),
          buildingId,
          role: values.role as Role,
          status: values.status as Status,
        });
        await refreshFromSupabase();
        setHighlightedUserId(editingUserId);
        closeAdd();
        setToastType("success");
        setToastMessage("User information updated successfully.");
        setIsToastOpen(true);
        setTimeout(() => {
          userListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
      const newUser = await addUser({
        fullName: String(values.fullName),
        email: String(values.email),
        password: String(values.password),
        buildingId,
        role: values.role as Role,
        status: values.status as Status,
      });
        await refreshFromSupabase();
        setHighlightedUserId(newUser.id);
        closeAdd();
        setToastType("success");
        setToastMessage(`User "${newUser.fullName}" was added and listed in User List.`);
        setIsToastOpen(true);
        setTimeout(() => {
          userListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (error) {
      setToastType("error");
      const fallbackMessage = editingUserId ? "Unable to update user." : "Unable to add user.";
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : fallbackMessage;
      setToastMessage(message);
      setIsToastOpen(true);
    }
  };

  const handleSignOut = () => {
    void signOutAndRedirect(navigate);
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
            Accounts
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

      <Content className={isMobile ? "px-2 py-2 pb-24" : "px-4 py-4"}>
        <div className="max-w-[430px] mx-auto">
          <div className={isMobile ? "space-y-3" : "rounded-[28px] bg-slate-50 shadow-xl p-3 space-y-3"}>
            <Card className="!rounded-sm !border-0 shadow-sm" bodyStyle={{ padding: 12 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overview</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">Accounts Summary</div>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Updated live</div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                  <div className="text-[11px] text-slate-500">Total Accounts</div>
                  <div className="text-xl leading-none font-bold text-slate-900 mt-1">{totals.total}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                  <div className="text-[11px] text-emerald-700">Active Users</div>
                  <div className="text-xl leading-none font-bold text-emerald-700 mt-1">{totals.active}</div>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-100 p-2">
                  <div className="text-[11px] text-red-700">Admins</div>
                  <div className="text-xl leading-none font-bold text-red-700 mt-1">{totals.admins}</div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-2">
                  <div className="text-[11px] text-blue-700">Supervisors</div>
                  <div className="text-xl leading-none font-bold text-blue-700 mt-1">{totals.supervisors}</div>
                </div>
              </div>
            </Card>

            <div ref={userListRef} className="px-1 mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">User List</div>
              <div className="space-y-2">
                {isLoadingUsers && (
                  <Card className="!rounded-sm !border-0 shadow-sm">
                    <ChickenState
                      title="Loading..."
                      subtitle="Please wait while we fetch the latest records."
                      titleClassName="text-[#008822]"
                      subtitleClassName="text-[#008822]/80"
                    />
                  </Card>
                )}

                {!isLoadingUsers && users.length === 0 && (
                  <Card className="!rounded-sm !border-0 shadow-sm">
                    <ChickenState
                      title="No data yet"
                      subtitle="No users yet."
                    />
                    <Button
                      type="primary"
                      block
                      icon={<UserAddOutlined />}
                      style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
                      onClick={openAdd}
                    >
                      Add First User
                    </Button>
                  </Card>
                )}

                {!isLoadingUsers && users.map((user) => (
                  <Card
                    key={user.id}
                    className={[
                      "!rounded-sm !border-0 shadow-sm transition-all !mt-2 cursor-pointer",
                      highlightedUserId === user.id ? "!ring-2 !ring-[#008822]/40" : "",
                    ].join(" ")}
                    bodyStyle={{ padding: 12 }}
                    onClick={() => openEdit(user)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#00882220] text-[#006e1b] font-bold grid place-items-center">
                        {initialsOf(user.fullName)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900 truncate">{user.fullName}</div>
                          <Tag color={statusColors[user.status]} className="!mr-0">
                            {user.status}
                          </Tag>
                        </div>

                        {user.userUuid && (
                          <div className="text-[11px] text-slate-400 truncate">UUID: {user.userUuid}</div>
                        )}
                        <div className="mt-2">
                          {user.buildingId === null && (
                            <Tag className="!mr-0">All Building Access</Tag>
                          )}
                          {user.buildingId !== null && (
                            <Tag className="!mr-0" color="geekblue">
                              {buildingNameById.get(user.buildingId) ?? `Building ${user.buildingId}`}
                            </Tag>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <Tag color={roleColors[user.role]} className="!mr-0">
                            {user.role}
                          </Tag>
                          <Text className="!text-[11px] !text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Content>

      {users.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            type="primary"
            size="large"
            className="!rounded-full !h-11 !px-4 shadow-lg"
            icon={<PlusOutlined />}
            style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
            onClick={openAdd}
          >
            Add User
          </Button>
        </div>
      )}

      <Drawer
        open={isAddOpen}
        onClose={closeAdd}
        placement="right"
        width={isMobile ? "100%" : 460}
        title={editingUserId ? "Edit User Account" : "Add User Account"}
        className="add-user-drawer"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: "Staff", status: "Active" }}
          requiredMark={false}
        >
          <Form.Item
            label="Full Name"
            name="fullName"
            rules={[{ required: true, message: "Please enter full name" }]}
          >
            <Input size="large" placeholder="e.g., Juan Dela Cruz" />
          </Form.Item>

          {!editingUserId && (
            <>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: "Please enter email" },
                  { type: "email", message: "Please enter a valid email address" },
                ]}
              >
                <Input size="large" placeholder="e.g., juan@email.com" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: "Please enter password" },
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      return String(value).length >= 6
                        ? Promise.resolve()
                        : Promise.reject(new Error("Password must be at least 6 characters"));
                    },
                  },
                ]}
              >
                <Input.Password size="large" placeholder="Enter password" />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Please confirm password" },
                  ({ getFieldValue }) => ({
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      return value === getFieldValue("password")
                        ? Promise.resolve()
                        : Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
              >
                <Input.Password size="large" placeholder="Confirm password" />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Please choose role" }]}
          >
            <Select
              size="large"
              options={[
                { label: "Admin", value: "Admin" },
                { label: "Supervisor", value: "Supervisor" },
                { label: "Staff", value: "Staff" },
              ]}
            />
          </Form.Item>

          {selectedRole === "Staff" && (
            <Form.Item
              label="Building Access"
              name="buildingId"
              rules={[{ required: true, message: "Please choose building access" }]}
            >
              <Select
                size="large"
                options={buildingOptions}
                placeholder="Select building access"
              />
            </Form.Item>
          )}

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Please choose status" }]}
          >
            <Select
              size="large"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>

          <div className="mt-4 flex gap-2">
            <Button className="!flex-1 !h-11" onClick={closeAdd}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              className="!flex-1 !h-11"
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
              onClick={handleAddUser}
            >
              {editingUserId ? "Update User" : "Save User"}
            </Button>
          </div>
        </Form>
      </Drawer>

      <NotificationToast
        open={isToastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setIsToastOpen(false)}
      />
    </Layout>
  );
}
