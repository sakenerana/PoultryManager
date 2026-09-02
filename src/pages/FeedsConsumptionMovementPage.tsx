import { Button, DatePicker, Divider, Form, Grid, Input, InputNumber, Layout, Modal, Popconfirm, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { IoHome } from "react-icons/io5";
import { IoMdArrowRoundBack } from "react-icons/io";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";

const BRAND = "#008822";
const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";
const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const FEED_RECEIVED_TABLE = import.meta.env.VITE_SUPABASE_FEED_RECEIVED_TABLE ?? "FeedReceived";
const FEED_TRANSFER_IN_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_IN_TABLE ?? "FeedTransferIn";
const FEED_TRANSFER_OUT_TABLE = import.meta.env.VITE_SUPABASE_FEED_TRANSFER_OUT_TABLE ?? "FeedTransferOut";
const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type SectionKey = "received" | "transfer-in" | "transfer-out";
type AppRole = "Admin" | "Supervisor" | "Staff" | null;

type MovementRow = {
  key: string;
  id: number;
  date: string;
  documentNo: string | null;
  issueNo: string | null;
  feedCode: string | null;
  quantityBags: number;
  farmName: string | null;
  remarks: string | null;
};

type MovementFormValues = {
  date: Dayjs;
  documentNo?: string;
  issueNo?: string;
  feedCode?: string;
  qtyBags?: number;
  farmName?: string;
  remarks?: string;
};

const SECTION_META: Record<SectionKey, { title: string; subtitle: string; addLabel: string; emptyTitle: string; emptyDescription: string; tableName: string; dateColumn: string; select: string }> = {
  received: {
    title: "Feed Received",
    subtitle: "Feed deliveries and document numbers.",
    addLabel: "Add Feed Received",
    emptyTitle: "No received feed yet.",
    emptyDescription: "Add delivery records with document number, feed code, bags, and remarks.",
    tableName: FEED_RECEIVED_TABLE,
    dateColumn: "received_date",
    select: "id, received_date, document_no, feed_code, qty_bags, remarks",
  },
  "transfer-in": {
    title: "Feed Transfer In",
    subtitle: "Feed moved into this building.",
    addLabel: "Add Transfer In",
    emptyTitle: "No transfer in records yet.",
    emptyDescription: "Add feed moved into this building with issue number, feed code, bags, and farm name.",
    tableName: FEED_TRANSFER_IN_TABLE,
    dateColumn: "transfer_date",
    select: "id, transfer_date, issue_no, feed_code, qty_bags, farm_name",
  },
  "transfer-out": {
    title: "Feed Transfer Out",
    subtitle: "Feed moved out of this building.",
    addLabel: "Add Transfer Out",
    emptyTitle: "No transfer out records yet.",
    emptyDescription: "Add feed moved out of this building with issue number, feed code, bags, and farm name.",
    tableName: FEED_TRANSFER_OUT_TABLE,
    dateColumn: "transfer_date",
    select: "id, transfer_date, issue_no, feed_code, qty_bags, farm_name",
  },
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string): string => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM DD, YYYY") : "-";
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
};

export default function FeedsConsumptionMovementPage() {
  const navigate = useNavigate();
  const { buildingId, section } = useParams();
  const { user } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
  const sectionKey = section as SectionKey;
  const meta = SECTION_META[sectionKey] ?? SECTION_META.received;
  const parsedBuildingId = Number(buildingId);
  const safeBuildingId = Number.isFinite(parsedBuildingId) ? parsedBuildingId : null;
  const [buildingName, setBuildingName] = useState("Building");
  const [growId, setGrowId] = useState<number | null>(null);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<MovementRow | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<AppRole>(null);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [form] = Form.useForm<MovementFormValues>();
  const canDeleteFeedEntries = userRole === "Admin";

  const loadRows = useCallback(
    async (active = true) => {
      if (safeBuildingId == null) {
        setRows([]);
        return;
      }

      try {
        setIsLoading(true);
        const [buildingResult, growResult, movementResult] = await Promise.all([
          supabase.from(BUILDINGS_TABLE).select("id, name").eq("id", safeBuildingId).maybeSingle(),
          supabase
            .from(GROWS_TABLE)
            .select("id")
            .eq("building_id", safeBuildingId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from(meta.tableName)
            .select(meta.select)
            .eq("building_id", safeBuildingId)
            .order(meta.dateColumn, { ascending: false }),
        ]);

        if (!active) return;
        if (buildingResult.error) throw buildingResult.error;
        if (growResult.error) throw growResult.error;
        if (movementResult.error) throw movementResult.error;

        const building = buildingResult.data as { name: string | null } | null;
        const grow = growResult.data as { id: number | null } | null;
        setBuildingName(building?.name ?? `Building ${safeBuildingId}`);
        setGrowId(grow?.id ?? null);

        const mapped = ((movementResult.data ?? []) as unknown as Array<{
          id: number | null;
          received_date?: string | null;
          transfer_date?: string | null;
          document_no?: string | null;
          issue_no?: string | null;
          feed_code?: string | null;
          qty_bags?: number | null;
          farm_name?: string | null;
          remarks?: string | null;
        }>).map((row, index) => ({
          key: String(row.id ?? index),
          id: row.id ?? 0,
          date: row.received_date ?? row.transfer_date ?? "",
          documentNo: row.document_no ?? null,
          issueNo: row.issue_no ?? null,
          feedCode: row.feed_code ?? null,
          quantityBags: toNumber(row.qty_bags),
          farmName: row.farm_name ?? null,
          remarks: row.remarks ?? null,
        }));
        setRows(mapped);
      } catch (error) {
        console.error(`Failed to load ${meta.title}:`, error);
        setRows([]);
      } finally {
        if (active) setIsLoading(false);
      }
    },
    [meta.dateColumn, meta.select, meta.tableName, meta.title, safeBuildingId]
  );

  useEffect(() => {
    let active = true;

    const loadUserRole = async () => {
      if (!user?.id) {
        setUserRole(null);
        return;
      }

      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select("role, status")
        .eq("user_uuid", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error("Failed to load feed delete access:", error.message);
        setUserRole(null);
        return;
      }

      const role = data?.role === "Admin" || data?.role === "Supervisor" || data?.role === "Staff" ? data.role : null;
      setUserRole(data?.status === "Inactive" ? null : role);
    };

    void loadUserRole();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    void loadRows(active);
    return () => {
      active = false;
    };
  }, [loadRows]);

  const openEntryModal = (row?: MovementRow) => {
    if (safeBuildingId == null || growId == null) {
      setToastMessage("This building needs a grow batch before adding feed records.");
      setIsToastOpen(true);
      return;
    }

    setEditingRow(row ?? null);
    form.setFieldsValue({
      date: row?.date ? dayjs(row.date) : dayjs(),
      documentNo: row?.documentNo ?? "",
      issueNo: row?.issueNo ?? "",
      feedCode: row?.feedCode ?? "",
      qtyBags: row?.quantityBags ?? 0,
      farmName: row?.farmName ?? "",
      remarks: row?.remarks ?? "",
    });
    setIsEntryModalOpen(true);
  };

  const saveEntry = async () => {
    if (safeBuildingId == null || growId == null) return;

    try {
      setIsSaving(true);
      const values = await form.validateFields();
      const basePayload = {
        building_id: safeBuildingId,
        grow_id: growId,
        feed_code: values.feedCode?.trim() || null,
        qty_bags: values.qtyBags ?? 0,
      };
      const payload =
        sectionKey === "received"
          ? {
              ...basePayload,
              received_date: values.date.format("YYYY-MM-DD"),
              document_no: values.documentNo?.trim() || null,
              remarks: values.remarks?.trim() || null,
            }
          : {
              ...basePayload,
              transfer_date: values.date.format("YYYY-MM-DD"),
              issue_no: values.issueNo?.trim() || null,
              farm_name: values.farmName?.trim() || null,
            };

      const query = editingRow
        ? supabase.from(meta.tableName).update(payload).eq("id", editingRow.id)
        : supabase.from(meta.tableName).insert(payload);
      const { error } = await query;
      if (error) throw error;

      setIsEntryModalOpen(false);
      setEditingRow(null);
      form.resetFields();
      setToastMessage(`${meta.title} entry ${editingRow ? "updated" : "saved"}.`);
      setIsToastOpen(true);
      await loadRows();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      setToastMessage(`Failed to save entry: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntry = async (row: MovementRow) => {
    if (!canDeleteFeedEntries) {
      setToastMessage("Only Admin users can delete feed entries.");
      setIsToastOpen(true);
      return;
    }

    try {
      setDeletingRowId(row.id);
      const { error } = await supabase.from(meta.tableName).delete().eq("id", row.id);
      if (error) throw error;
      setToastMessage(`${meta.title} entry deleted.`);
      setIsToastOpen(true);
      await loadRows();
    } catch (error) {
      setToastMessage(`Failed to delete entry: ${getErrorMessage(error)}`);
      setIsToastOpen(true);
    } finally {
      setDeletingRowId(null);
    }
  };

  const totalBags = useMemo(() => rows.reduce((sum, row) => sum + row.quantityBags, 0), [rows]);

  const columns: ColumnsType<MovementRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (value: string) => formatDate(value) },
    {
      title: sectionKey === "received" ? "Document No." : "Issue No.",
      key: "reference",
      render: (_, record) => record.documentNo ?? record.issueNo ?? "-",
    },
    { title: "Feed Code", dataIndex: "feedCode", key: "feedCode", render: (value: string | null) => value || "-" },
    {
      title: "Qty Bags",
      dataIndex: "quantityBags",
      key: "quantityBags",
      align: "right",
      render: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
    ...(sectionKey === "received"
      ? [{ title: "Remarks", dataIndex: "remarks", key: "remarks", render: (value: string | null) => value || "-" }]
      : [{ title: "Farm Name", dataIndex: "farmName", key: "farmName", render: (value: string | null) => value || "-" }]),
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <div className="flex justify-end gap-2">
          <Button size="small" icon={<FiEdit2 size={13} />} onClick={() => openEntryModal(record)}>
            Edit
          </Button>
          {canDeleteFeedEntries && (
            <Popconfirm
              title={`Delete ${meta.title} entry?`}
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingRowId === record.id }}
              onConfirm={() => deleteEntry(record)}
            >
              <Button size="small" danger icon={<FiTrash2 size={13} />} loading={deletingRowId === record.id}>
                Delete
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

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
          <Button type="text" icon={<IoMdArrowRoundBack size={20} />} className="!text-white hover:!text-white/90" onClick={() => navigate(-1)} aria-label="Back" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Button type="text" icon={<IoHome size={18} />} className="!text-white hover:!text-white/90" onClick={() => navigate("/landing-page")} aria-label="Home" />
          <Divider type="vertical" className="!m-0 !h-5 !border-white/60" />
          <Title level={4} className="!m-0 !text-base !text-white">
            {meta.title}
          </Title>
        </div>
        <Button type="text" icon={<FaSignOutAlt size={18} />} className="!text-white hover:!text-white/90" onClick={() => void signOutAndRedirect(navigate)} aria-label="Sign out" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
      </Header>

      <Content className="px-4 py-5 md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-5 rounded-xl bg-gradient-to-r from-emerald-950 via-emerald-800 to-lime-700 px-5 py-6 text-white shadow-sm md:px-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">{buildingName}</div>
                <Title level={isMobile ? 3 : 2} className="!m-0 !mt-2 !text-white">
                  {meta.title}
                </Title>
                <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">{meta.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                  disabled={safeBuildingId == null}
                  onClick={() => safeBuildingId != null && navigate(`/feeds-consumption/building/${safeBuildingId}`)}
                >
                  Record Types
                </Button>
                <Button
                  icon={<MdOutlinePictureAsPdf size={17} />}
                  className="!rounded-lg !border-white/30 !bg-white/10 !text-white hover:!border-white/50 hover:!bg-white/20"
                  onClick={() => navigate("/reports/feeds-consumption")}
                >
                  Open Report
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em]">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Grow {growId ? `#${growId}` : "-"}</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{rows.length.toLocaleString()} records</div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{totalBags.toLocaleString(undefined, { maximumFractionDigits: 2 })} bags</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">{meta.title} List</div>
                <div className="mt-1 text-sm text-slate-500">{buildingName} | Grow {growId ? `#${growId}` : "-"}</div>
              </div>
              <Button type="primary" disabled={growId == null} onClick={() => openEntryModal()}>
                {meta.addLabel}
              </Button>
            </div>
            {isMobile ? (
              <div className="space-y-3">
                {rows.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                    <div className="font-semibold text-slate-700">{meta.emptyTitle}</div>
                    <div className="mt-1">{meta.emptyDescription}</div>
                  </div>
                )}
                {rows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{formatDate(row.date)}</div>
                        <div className="mt-1 text-sm text-slate-500">Feed {row.feedCode || "-"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-950">{row.quantityBags.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-slate-500">bags</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {sectionKey === "received" ? row.documentNo || row.remarks || "No reference" : row.issueNo || row.farmName || "No reference"}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="small" icon={<FiEdit2 size={13} />} onClick={() => openEntryModal(row)}>
                        Edit
                      </Button>
                      {canDeleteFeedEntries && (
                        <Popconfirm
                          title={`Delete ${meta.title} entry?`}
                          description="This cannot be undone."
                          okText="Delete"
                          okButtonProps={{ danger: true, loading: deletingRowId === row.id }}
                          onConfirm={() => deleteEntry(row)}
                        >
                          <Button size="small" danger icon={<FiTrash2 size={13} />} loading={deletingRowId === row.id}>
                            Delete
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table<MovementRow>
                columns={columns}
                dataSource={rows}
                loading={isLoading}
                pagination={{ pageSize: 8 }}
                locale={{
                  emptyText: (
                    <div className="px-3 py-8 text-center text-sm text-slate-500">
                      <div className="font-semibold text-slate-700">{meta.emptyTitle}</div>
                      <div className="mt-1">{meta.emptyDescription}</div>
                    </div>
                  ),
                }}
              />
            )}
          </div>
        </div>
      </Content>
      <Modal
        title={`${editingRow ? "Edit" : "Add"} ${meta.title}`}
        open={isEntryModalOpen}
        onCancel={() => {
          setIsEntryModalOpen(false);
          setEditingRow(null);
        }}
        onOk={saveEntry}
        okText="Save Entry"
        confirmLoading={isSaving}
        destroyOnHidden
      >
        <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 px-3 py-3 text-xs text-orange-900">
          <div className="font-semibold">{buildingName}</div>
          <div className="mt-1 text-orange-800">Grow {growId ? `#${growId}` : "-"} saves to {meta.tableName}.</div>
        </div>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: "Select date" }]}>
            <DatePicker className="!w-full" />
          </Form.Item>
          {sectionKey === "received" ? (
            <Form.Item name="documentNo" label="Document No.">
              <Input placeholder="Document number" />
            </Form.Item>
          ) : (
            <Form.Item name="issueNo" label="Issue No.">
              <Input placeholder="Issue number" />
            </Form.Item>
          )}
          <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
            <Form.Item name="feedCode" label="Feed Code">
              <Input placeholder="510, 511, 512..." />
            </Form.Item>
            <Form.Item name="qtyBags" label="Qty Bags">
              <InputNumber className="!w-full" min={0} precision={2} />
            </Form.Item>
          </div>
          {sectionKey === "received" ? (
            <Form.Item name="remarks" label="Remarks">
              <Input.TextArea rows={3} placeholder="Optional notes" />
            </Form.Item>
          ) : (
            <Form.Item name="farmName" label="Farm Name">
              <Input placeholder="Farm name" />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <NotificationToast open={isToastOpen} message={toastMessage} type="success" onClose={() => setIsToastOpen(false)} />
    </Layout>
  );
}
