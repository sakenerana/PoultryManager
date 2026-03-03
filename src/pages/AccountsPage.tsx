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
  Empty,
} from "antd";
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined, PlusOutlined, UserAddOutlined } from "@ant-design/icons";
import NotificationToast from "../components/NotificationToast";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const PRIMARY = "#008822";
const ACCENT = "#ffa600";
const STORAGE_KEY = "ggdc_accounts";

type Role = "Admin" | "Staff";
type Status = "Active" | "Inactive";

type UserAccount = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  buildingAccess: string;
  role: Role;
  status: Status;
  createdAt: string;
};

const roleColors: Record<Role, string> = {
  Admin: "red",
  Staff: "green",
};

const statusColors: Record<Status, string> = {
  Active: "success",
  Inactive: "default",
};

const BUILDING_OPTIONS = [
  { label: "Building 1", value: "Building 1" },
  { label: "Building 2", value: "Building 2" },
  { label: "Building 3", value: "Building 3" },
  { label: "Building 4", value: "Building 4" },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

function createUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const userListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<UserAccount & { role?: string; password?: string; buildingAccess?: string | string[] }>;
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((user) => ({
          ...user,
          role: (user.role === "Admin" ? "Admin" : "Staff") as Role,
          password: typeof user.password === "string" ? user.password : "",
          buildingAccess: Array.isArray(user.buildingAccess)
            ? user.buildingAccess[0] ?? ""
            : typeof user.buildingAccess === "string"
              ? user.buildingAccess
              : "",
        }));
        setUsers(normalized);
      }
    } catch {
      // Keep empty list when parsing fails.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  const totals = useMemo(() => {
    const active = users.filter((u) => u.status === "Active").length;
    const admins = users.filter((u) => u.role === "Admin").length;
    return { total: users.length, active, admins };
  }, [users]);

  const openAdd = () => {
    setEditingUserId(null);
    form.setFieldsValue({ role: "Staff", status: "Active", buildingAccess: undefined });
    setIsAddOpen(true);
  };

  const openEdit = (user: UserAccount) => {
    setEditingUserId(user.id);
    form.setFieldsValue({
      fullName: user.fullName,
      email: user.email,
      password: "",
      confirmPassword: "",
      buildingAccess: user.buildingAccess ?? [],
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
      const email = String(values.email).trim().toLowerCase();
      const enteredPassword = String(values.password ?? "");
      const exists = users.some(
        (user) => user.email.toLowerCase() === email && user.id !== editingUserId
      );

      if (exists) {
        setToastType("error");
        setToastMessage("Email already exists.");
        setIsToastOpen(true);
        return;
      }

      if (editingUserId) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingUserId
              ? {
                  ...user,
                  fullName: String(values.fullName).trim(),
                  email: String(values.email).trim(),
                  password: enteredPassword ? enteredPassword : user.password,
                  buildingAccess: String(values.buildingAccess ?? ""),
                  role: values.role as Role,
                  status: values.status as Status,
                }
              : user
          )
        );
        setHighlightedUserId(editingUserId);
        closeAdd();
        setToastType("success");
        setToastMessage("User information updated successfully.");
        setIsToastOpen(true);
        setTimeout(() => {
          userListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
        const newUser: UserAccount = {
          id: createUserId(),
          fullName: String(values.fullName).trim(),
          email: String(values.email).trim(),
          password: enteredPassword,
          buildingAccess: String(values.buildingAccess ?? ""),
          role: values.role as Role,
          status: values.status as Status,
          createdAt: new Date().toISOString(),
        };

        setUsers((prev) => [newUser, ...prev]);
        setHighlightedUserId(newUser.id);
        closeAdd();
        setToastType("success");
        setToastMessage(`User "${newUser.fullName}" was added and listed in User List.`);
        setIsToastOpen(true);
        setTimeout(() => {
          userListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch {
      setToastType("error");
      setToastMessage("Unable to add user. Please check the form and try again.");
      setIsToastOpen(true);
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
            Accounts
          </Title>
        </div>

        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="!text-white hover:!text-white/90"
          onClick={() => console.log("sign out")}
        />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className={isMobile ? "px-2 py-2 pb-24" : "px-4 py-4"}>
        <div className="max-w-[430px] mx-auto">
          <div className={isMobile ? "space-y-3" : "rounded-[28px] bg-slate-50 shadow-xl p-3 space-y-3"}>
            <Card className="!rounded-sm !border-0 shadow-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-100 p-2">
                  <div className="text-[10px] text-slate-500">Total</div>
                  <div className="text-lg font-bold text-slate-900">{totals.total}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2">
                  <div className="text-[10px] text-emerald-700">Users</div>
                  <div className="text-lg font-bold text-emerald-700">{totals.active}</div>
                </div>
                <div className="rounded-xl bg-red-50 p-2">
                  <div className="text-[10px] text-red-700">Admins</div>
                  <div className="text-lg font-bold text-red-700">{totals.admins}</div>
                </div>
              </div>
            </Card>

            <div ref={userListRef} className="px-1 mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">User List</div>
              <div className="space-y-2">
                {users.length === 0 && (
                  <Card className="!rounded-sm !border-0 shadow-sm">
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No users yet"
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

                {users.map((user) => (
                  <Card
                    key={user.id}
                    className={[
                      "!rounded-2xl !border-0 shadow-sm transition-all !mt-2 cursor-pointer",
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

                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                        <div className="mt-2">
                          {!user.buildingAccess && (
                            <Tag className="!mr-0">No Building Access</Tag>
                          )}
                          {user.buildingAccess && (
                            <Tag className="!mr-0" color="geekblue">
                              {user.buildingAccess}
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

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Please enter email" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input size="large" placeholder="e.g., jdelacruz@ggdc.com" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              {
                required: !editingUserId,
                message: "Please enter password",
              },
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
            <Input.Password size="large" placeholder={editingUserId ? "Leave blank to keep current password" : "Enter password"} />
          </Form.Item>

          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const password = getFieldValue("password");
                  if (!password && !value) return Promise.resolve();
                  if (!value) return Promise.reject(new Error("Please confirm password"));
                  return value === password
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password size="large" placeholder={editingUserId ? "Confirm new password" : "Confirm password"} />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Please choose role" }]}
          >
            <Select
              size="large"
              options={[
                { label: "Admin", value: "Admin" },
                { label: "Staff", value: "Staff" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Building Access"
            name="buildingAccess"
            rules={[{ required: true, message: "Please choose building access" }]}
          >
            <Select
              size="large"
              options={BUILDING_OPTIONS}
              placeholder="Select building access"
            />
          </Form.Item>

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
