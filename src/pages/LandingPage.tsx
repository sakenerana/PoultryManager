// LandingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import supabase from "../utils/supabase";

type TileKey = "inventory" | "harvest" | "reports" | "userAccess" | "settings";

type Tile = {
    key: TileKey;
    title: string;
    accent: string;
    icon: React.ReactNode;
    largeText: string;
    link: string;
};

const tiles: Tile[] = [
    {
        key: "inventory",
        title: "Inventory",
        accent: "text-[#008822]",
        icon: (
            <img
                src="/img/chicken-head.svg"
                alt="Inventory"
                className="h-10 w-10"
            />
        ),
        largeText: "Inventory",
        link: "/buildings",
    },
    {
        key: "harvest",
        title: "Harvest",
        accent: "text-[#008822]",
        icon: (
            <img
                src="/img/chicken-harvest.svg"
                alt="Harvest"
                className="h-10 w-10"
            />
        ),
        largeText: "Harvest",
        link: "/harvest",
    },
    {
        key: "reports",
        title: "Reports",
        accent: "text-[#008822]",
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
];

const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";
type AppRole = "Admin" | "Supervisor" | "Staff" | null;

export default function LandingPage() {
    const [syncing, setSyncing] = useState(false);
    const [active, setActive] = useState<TileKey | null>(null);
    const [role, setRole] = useState<AppRole>(null);
    const navigate = useNavigate();
    const { user } = useAuth();
    const headerHeight = 64;

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

    const handleTileClick = (tile: Tile) => {
        setActive(tile.key);
        navigate(tile.link);
        console.log("clicked:", tile.key);
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            // TODO: call your sync API here
            await new Promise((r) => setTimeout(r, 900));
            console.log("synced!");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* HEADER */}
            <header
                className="relative text-white"
                style={{ height: headerHeight }}
            >
                {/* gradient like the screenshot */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#008822] to-[#006e1b]" />
                <div className="relative h-full px-4 flex items-center justify-between">
                    <button
                        type="button"
                        aria-label="Open menu"
                        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 transition grid place-items-center"
                    >
                        <Menu size={22} />
                    </button>

                    <div className="text-center leading-tight">
                        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/75 font-medium">
                            Operations Dashboard
                        </p>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                            GGDC Poultry Manager
                        </h1>
                    </div>

                    {/* spacer to keep title centered */}
                    <div className="h-10 w-10" />
                </div>

                {/* divider */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ffc700]" />
            </header>

            {/* CONTENT */}
            <main className="flex-1 px-4 py-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {visibleTiles.map((tile) => (
                        <button
                            key={tile.key}
                            type="button"
                            onClick={() => handleTileClick(tile)}
                            className={[
                                "cursor-pointer",
                                "text-left bg-white rounded-sm shadow-sm",
                                "p-4 sm:p-6",
                                "min-h-[150px] sm:min-h-[230px]",
                                "transition-all duration-200",
                                "hover:shadow-md hover:-translate-y-0.5",
                                "active:translate-y-0 active:scale-[0.99]",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008822]/50",
                                active === tile.key
                                    ? "ring-2 ring-[#008822]/40"
                                    : "ring-0",
                            ].join(" ")}
                        >
                            {/* icon card */}
                            <div className="flex justify-center">
                                <div className="bg-[#ffa600]/40 p-3 sm:p-4 rounded-2xl shadow-inner">
                                    {tile.icon}
                                </div>
                            </div>

                            <div className="mt-3 sm:mt-4 text-center">
                                <div
                                    className={[
                                        "text-[22px] sm:text-[34px] font-bold tracking-tight leading-none",
                                        tile.accent,
                                    ].join(" ")}
                                >
                                    {tile.largeText}
                                </div>
                            </div>

                            {/* subtle bottom gradient accent */}
                            <div className="mt-3 sm:mt-4 h-2 w-full rounded-full bg-gradient-to-r from-[#008822]/0 via-[#008822]/10 to-[#008822]/0" />
                        </button>
                    ))}
                </div>
            </main>

            {/* FLOATING SYNC BUTTON */}
            <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className={[
                    "fixed bottom-6 right-6 z-50",
                    "rounded-full px-4 py-2",
                    "text-sm text-white font-semibold",
                    "bg-[#ffa600] hover:bg-[#006e1b]",
                    "shadow-xl shadow-[#008822]/25",
                    "flex items-center gap-2",
                    "transition active:scale-95",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                ].join(" ")}
            >
                <RefreshCw
                    size={15}
                    className={syncing ? "animate-spin" : ""}
                />
                {syncing ? "Syncing..." : "Sync data"}
            </button>
        </div>
    );
}
