// LandingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input } from "antd";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { addBuilding, deleteBuilding, loadBuildings } from "../controller/buildingCrud";
import { addSubBuildings } from "../controller/subbuildingsCrud";
import type { BuildingRecord } from "../type/building.type";
import { signOutAndRedirect } from "../utils/auth";
import supabase from "../utils/supabase";
import { checkForAppUpdate } from "../serviceWorkerRegistration";
import { APP_VERSION } from "../generated/appVersion";

type TileKey =
    | "inventory"
    | "harvest"
    | "reports"
    | "userAccess"
    | "settings"
    | "signOut";

type Tile = {
    key: TileKey;
    title: string;
    accent: string;
    borderColor: string;
    icon: React.ReactNode;
    largeText: string;
    link?: string;
};

const tiles: Tile[] = [
    {
        key: "inventory",
        title: "My Growers",
        accent: "text-[#008822]",
        borderColor: "#22c55e",
        icon: (
            <img
                src="/img/chicken-head.svg"
                alt="My Growers"
                className="h-10 w-10"
            />
        ),
        largeText: "My Growers",
        link: "/buildings",
    },
    {
        key: "harvest",
        title: "My Harvest",
        accent: "text-[#008822]",
        borderColor: "#84cc16",
        icon: (
            <img
                src="/img/chicken-harvest.svg"
                alt="My Harvest"
                className="h-10 w-10"
            />
        ),
        largeText: "My Harvest",
        link: "/harvest",
    },
    {
        key: "reports",
        title: "Reports",
        accent: "text-[#008822]",
        borderColor: "#0ea5e9",
        icon: (
            <img
                src="/img/report.svg"
                alt="Reports"
                className="h-10 w-10"
            />
        ),
        largeText: "Reports",
        link: "/reports",
    },
    {
        key: "userAccess",
        title: "Accounts",
        accent: "text-[#008822]",
        borderColor: "#a855f7",
        icon: <img
            src="/img/accounts.svg"
            alt="Accounts"
            className="h-10 w-10"
        />,
        largeText: "Accounts",
        link: "/accounts",
    },
    {
        key: "settings",
        title: "Settings",
        accent: "text-[#008822]",
        borderColor: "#f59e0b",
        icon: (
            <img
                src="/img/settings.svg"
                alt="Settings"
                className="h-10 w-10"
            />
        ),
        largeText: "Settings",
        link: "/settings",
    },
    {
        key: "signOut",
        title: "Sign Out",
        accent: "text-[#d97706]",
        borderColor: "#f97316",
        icon: (
            <img
                src="/img/logout.svg"
                alt="Sign Out"
                className="h-10 w-10"
            />
        ),
        largeText: "Sign Out",
    },
];

const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
type AppRole = "Admin" | "Supervisor" | "Staff" | null;

export default function LandingPage() {
    const [active, setActive] = useState<TileKey | null>(null);
    const [role, setRole] = useState<AppRole>(null);
    const [isSyncingUpdate, setIsSyncingUpdate] = useState(false);
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [isAddSubmitting, setIsAddSubmitting] = useState(false);
    const [isToastOpen, setIsToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [nextBuildingSequence, setNextBuildingSequence] = useState(1);
    const [addForm] = Form.useForm();
    const navigate = useNavigate();
    const { user } = useAuth();
    const mobileSafeAreaTop = "env(safe-area-inset-top, 0px)";
    const headerHeight = `calc(64px + ${mobileSafeAreaTop})`;
    const footerHeight = "calc(56px + env(safe-area-inset-bottom, 0px))";
    const canManageBuildings = role === "Admin" || role === "Supervisor";

    useEffect(() => {
        let isMounted = true;

        const loadRole = async () => {
            if (!user?.id) {
                if (isMounted) setRole(null);
                return;
            }

            const { data, error } = await supabase
                .from(USERS_TABLE)
                .select("role")
                .eq("user_uuid", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("Failed to load user role:", error.message);
                if (isMounted) setRole(null);
                return;
            }

            if (!isMounted) return;
            if (data?.role === "Admin" || data?.role === "Supervisor") {
                setRole(data.role);
            } else if (data?.role === "Staff") {
                setRole("Staff");
            } else {
                setRole(null);
            }
        };

        void loadRole();
        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const visibleTiles = useMemo(() => {
        if (role === "Admin" || role === "Supervisor") return tiles;
        return tiles.filter((tile) => tile.key !== "userAccess");
    }, [role]);

    const isTileDisabled = (tile: Tile): boolean => role === "Staff" && tile.key === "harvest";

    const handleTileClick = (tile: Tile) => {
        if (isTileDisabled(tile)) return;
        setActive(tile.key);
        if (tile.key === "signOut") {
            void signOutAndRedirect(navigate);
            return;
        }
        if (tile.link) {
            navigate(tile.link);
        }
        console.log("clicked:", tile.key);
    };

    const handleSyncUpdate = async () => {
        if (isSyncingUpdate) return;
        try {
            setIsSyncingUpdate(true);
            await checkForAppUpdate();
        } finally {
            window.setTimeout(() => {
                setIsSyncingUpdate(false);
            }, 1200);
        }
    };

    const handleOpenAddDrawer = () => {
        if (!canManageBuildings) {
            setToastMessage("Please contact an Admin or Supervisor to add a new building.");
            setIsToastOpen(true);
            return;
        }

        void (async () => {
            try {
                const buildings = await loadBuildings();
                const nextIndex = buildings.length + 1;
                setNextBuildingSequence(nextIndex);
                addForm.setFieldsValue({ name: `Bldg ${nextIndex}` });
            } catch (error) {
                console.error("Failed to load buildings for naming suggestion:", error);
                setNextBuildingSequence(1);
                addForm.setFieldsValue({ name: "Bldg 1" });
            } finally {
                setIsAddDrawerOpen(true);
            }
        })();
    };

    const handleCloseAddDrawer = () => {
        setIsAddDrawerOpen(false);
        addForm.resetFields();
    };

    const handleSubmitAdd = async () => {
        let createdBuilding: BuildingRecord | null = null;

        try {
            setIsAddSubmitting(true);
            const values = await addForm.validateFields();
            createdBuilding = await addBuilding({ name: values.name });
            const createdBuildingId = Number(createdBuilding.id);

            await addSubBuildings(
                Array.from({ length: 6 }, (_, index) => ({
                    buildingId: createdBuildingId,
                    name: `Cage ${index + 1}`,
                }))
            );

            handleCloseAddDrawer();
            setToastMessage(`Successfully added ${values.name}`);
            setIsToastOpen(true);
            navigate("/buildings");
        } catch (error) {
            if (error && typeof error === "object" && "errorFields" in error) return;

            const message =
                error instanceof Error ? error.message : "Unknown error";

            if (createdBuilding) {
                try {
                    await deleteBuilding(createdBuilding.id);
                } catch (rollbackError) {
                    const rollbackMessage =
                        rollbackError instanceof Error
                            ? rollbackError.message
                            : "Unknown rollback error";
                    setToastMessage(
                        `Failed to add building: ${message}. Rollback also failed: ${rollbackMessage}`
                    );
                    setIsToastOpen(true);
                    return;
                }
            }

            setToastMessage(`Failed to add building: ${message}`);
            setIsToastOpen(true);
        } finally {
            setIsAddSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* HEADER */}
            <header
                className="relative text-white"
                style={{
                    height: headerHeight,
                    paddingTop: mobileSafeAreaTop,
                }}
            >
                {/* gradient like the screenshot */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#008822] to-[#006e1b]" />
                <div className="relative h-full px-4 flex items-center justify-center">
                    <div className="text-center leading-tight">
                        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/75 font-medium">
                            Operations Dashboard
                        </p>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                            GGDC Poultry Manager
                        </h1>
                    </div>

                </div>

                {/* divider */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
            </header>

            {/* CONTENT */}
            <main
                className="px-3 py-3 pb-20 sm:px-4 sm:py-4 sm:pb-24"
                style={{
                    minHeight: `calc(100dvh - ${headerHeight} - ${footerHeight})`,
                }}
            >
                <div className="grid h-full grid-cols-2 auto-rows-fr gap-2.5 sm:gap-4">
                    {visibleTiles.map((tile) => (
                        <button
                            key={tile.key}
                            type="button"
                            disabled={isTileDisabled(tile)}
                            onClick={() => handleTileClick(tile)}
                            style={{ borderColor: tile.borderColor }}
                            className={[
                                isTileDisabled(tile) ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                "text-left bg-white rounded-sm shadow-sm border-2",
                                "p-3 sm:p-6",
                                "h-full min-h-[118px] sm:h-[clamp(180px,24vh,230px)]",
                                "transition-all duration-200",
                                isTileDisabled(tile) ? "" : "hover:shadow-md hover:-translate-y-0.5",
                                "active:translate-y-0 active:scale-[0.99]",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008822]/50",
                                active === tile.key
                                    ? "ring-2 ring-[#008822]/40"
                                    : "ring-0",
                            ].join(" ")}
                        >
                            {/* icon card */}
                            <div className="flex justify-center">
                                <div className="bg-[#ffa600]/40 p-2.5 sm:p-4 rounded-2xl shadow-inner">
                                    {tile.icon}
                                </div>
                            </div>

                            <div className="mt-2.5 sm:mt-4 text-center">
                                <div
                                    className={[
                                        "text-[20px] sm:text-[34px] font-bold tracking-tight leading-none",
                                        tile.accent,
                                    ].join(" ")}
                                >
                                    {tile.largeText}
                                </div>
                            </div>

                            {/* subtle bottom gradient accent */}
                            <div className="mt-2.5 sm:mt-4 h-1.5 sm:h-2 w-full rounded-full bg-gradient-to-r from-[#008822]/0 via-[#008822]/10 to-[#008822]/0" />
                        </button>
                    ))}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm">
                <div className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-500 bg-transparent">
                    Version {APP_VERSION}
                </div>
                <div className={`grid ${canManageBuildings ? "grid-cols-2" : "grid-cols-1"}`}>
                        {canManageBuildings && (
                            <button
                                type="button"
                                onClick={handleOpenAddDrawer}
                                className={[
                                    "flex min-h-[56px] items-center justify-center gap-2 px-3 py-2 text-[#008822] transition-all duration-200",
                                    "hover:bg-[#008822]/5 active:scale-[0.99]",
                                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008822]/30 focus-visible:ring-inset",
                                ].join(" ")}
                                aria-label="Add building"
                                title="Add building"
                            >
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#008822]/10">
                                    <PlusOutlined className="text-sm" />
                                </span>
                                <span className="text-sm font-semibold leading-none">
                                    Add Building
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleSyncUpdate}
                            disabled={isSyncingUpdate}
                            className={[
                                "flex min-h-[56px] items-center justify-center gap-2 px-3 py-2 text-[#008822] transition-all duration-200",
                                canManageBuildings ? "border-l border-slate-200" : "",
                                isSyncingUpdate ? "cursor-wait opacity-80" : "hover:bg-[#008822]/5 active:scale-[0.99]",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008822]/30 focus-visible:ring-inset",
                            ].join(" ")}
                            aria-label={isSyncingUpdate ? "Syncing latest update" : "Sync latest update"}
                            title={isSyncingUpdate ? "Syncing latest update" : "Sync latest update"}
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#008822]/10">
                                <SyncOutlined spin={isSyncingUpdate} className="text-sm" />
                            </span>
                            <span className="text-sm font-semibold leading-none">
                                {isSyncingUpdate ? "Syncing" : "Update"}
                            </span>
                        </button>
                </div>
            </div>

            <Drawer
                open={isAddDrawerOpen}
                onClose={handleCloseAddDrawer}
                placement="bottom"
                height="56%"
                className="add-building-drawer"
                bodyStyle={{ padding: 16 }}
            >
                <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                        Add New Building
                    </h2>
                    <div className="mt-1 text-sm text-slate-500">
                        Enter the building name to create a new record.
                    </div>
                </div>

                <Form form={addForm} layout="vertical" requiredMark={false}>
                    <Form.Item
                        label="Building Name"
                        name="name"
                        rules={[{ required: true, message: "Please enter building name" }]}
                    >
                        <Input
                            placeholder={`e.g., Bldg ${nextBuildingSequence}`}
                            size="large"
                            className="!text-base"
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        size="large"
                        className="!mt-4 !h-12 !w-full !rounded-lg !font-semibold"
                        style={{ backgroundColor: "#008822", borderColor: "#008822" }}
                        onClick={handleSubmitAdd}
                        loading={isAddSubmitting}
                    >
                        Add Building
                    </Button>
                </Form>
            </Drawer>

            <NotificationToast
                open={isToastOpen}
                message={toastMessage}
                type="success"
                onClose={() => setIsToastOpen(false)}
            />
        </div>
    );
}
