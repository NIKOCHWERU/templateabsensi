import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
    Users,
    Clock,
    CalendarDays,
    History,
    FileText,
    MessageSquare,
    LogOut,
    Image as ImageIcon,
    ShieldCheck,
    UserCog,
    UserMinus,
    Megaphone,
    Calendar,
    ChevronDown,
    ChevronRight,
    Bell,
    AlertTriangle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useState, useRef, useEffect, ComponentType } from "react";
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarFooter,
    SidebarRail,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarInset,
    SidebarTrigger,
    useSidebar,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton
} from "@/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface NavLink {
    title: string;
    url: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
}

interface NavCollapsible {
    title: string;
    url: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
    items: NavLink[];
}

type NavItem = NavLink | NavCollapsible;

function checkIsActive(location: string, item: NavItem): boolean {
    if ('items' in item) {
        return item.items.some(sub => location === sub.url);
    }
    return location === item.url;
}

// Brand Header block
function AdminSidebarHeader() {
    const { state } = useSidebar();
    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT ABC";
    const logoUrl = config?.logoUrl || config?.logoUrl !== "/logo_elok_buah.jpg" ? config?.logoUrl : null;
    const logoInisial = config?.logoInisial || import.meta.env.VITE_LOGO_INISIAL || namaPt.charAt(0);

    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sidebar-border bg-white min-h-[4rem]">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0 select-none overflow-hidden text-center uppercase">
                {logoUrl && logoUrl !== "/logo_elok_buah.jpg" ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain bg-white p-0.5 rounded-lg" />
                ) : (
                    logoInisial
                )}
            </div>
            {state === "expanded" && (
                <div className="flex flex-col min-w-0 transition-opacity duration-200">
                    <h1 className="text-sm font-black text-gray-900 tracking-tight leading-tight truncate uppercase">
                        {namaPt}
                    </h1>
                    <p className="text-[10px] text-primary font-bold tracking-wider leading-none">
                        PANEL ADMIN
                    </p>
                </div>
            )}
        </div>
    );
}

// Premium Profile & Action Dropdown Footer
function AdminSidebarFooter() {
    const { user, logout } = useAuth();
    const [, setLocation] = useLocation();
    const { state, isMobile } = useSidebar();

    const userInitial = user?.fullName
        ? user.fullName.charAt(0).toUpperCase()
        : user?.username
        ? user.username.charAt(0).toUpperCase()
        : "A";

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground text-left flex items-center gap-3 cursor-pointer py-1.5"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 select-none">
                                {userInitial}
                            </div>
                            {state === "expanded" && (
                                <div className="grid flex-1 text-start text-sm leading-tight min-w-0">
                                    <span className="truncate font-semibold text-gray-800">
                                        {user?.fullName || user?.username || "Admin"}
                                    </span>
                                    <span className="truncate text-xs text-gray-400 font-bold uppercase tracking-wider">
                                        {user?.role === "superadmin" ? "Super Admin" : "Admin"}
                                    </span>
                                </div>
                            )}
                            {state === "expanded" && (
                                <ChevronDown className="ms-auto size-4 text-gray-400 shrink-0" />
                            )}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-4 py-2 text-start text-sm border-b border-gray-50">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                    {userInitial}
                                </div>
                                <div className="grid flex-1 text-start text-sm leading-tight min-w-0">
                                    <span className="truncate font-semibold text-gray-800">
                                        {user?.fullName || user?.username || "Admin"}
                                    </span>
                                    <span className="truncate text-xs text-gray-400 font-bold uppercase tracking-wider">
                                        {user?.role === "superadmin" ? "Super Admin" : "Admin"}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => setLocation("/admin/profile")}
                            className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900"
                        >
                            <UserCog className="w-4 h-4 text-gray-400" />
                            <span>Profil Admin</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => logoutMutation.mutate()}
                            className="flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700 font-semibold"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Keluar</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

// Single Link Component
function SidebarMenuLink({ item, location }: { item: NavLink; location: string }) {
    const [, setLocation] = useLocation();
    const isActive = checkIsActive(location, item);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                onClick={() => setLocation(item.url)}
                className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}
            >
                {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                <span>{item.title}</span>
                {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {item.badge}
                    </span>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

// Collapsible Group component when sidebar is expanded
function SidebarMenuCollapsible({ item, location }: { item: NavCollapsible; location: string }) {
    const [, setLocation] = useLocation();
    const isAnySubActive = checkIsActive(location, item);

    return (
        <Collapsible
            defaultOpen={isAnySubActive}
            className="group/collapsible w-full"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={item.title}
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                        {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                        <span>{item.title}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto mr-1 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {item.badge}
                            </span>
                        )}
                        <ChevronRight className="ms-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {item.items.map((subItem) => {
                            const isSubActive = location === subItem.url;
                            return (
                                <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton
                                        isActive={isSubActive}
                                        onClick={() => setLocation(subItem.url)}
                                        className={isSubActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}
                                    >
                                        {subItem.icon && <subItem.icon className="h-4 w-4 shrink-0" />}
                                        <span>{subItem.title}</span>
                                        {subItem.badge !== undefined && subItem.badge > 0 && (
                                            <span className="ml-auto bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                {subItem.badge}
                                            </span>
                                        )}
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

// Dropdown component when sidebar is collapsed (icon only mode)
function SidebarMenuCollapsedDropdown({ item, location }: { item: NavCollapsible; location: string }) {
    const [, setLocation] = useLocation();
    const isAnySubActive = checkIsActive(location, item);

    return (
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isAnySubActive}
                        className={isAnySubActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}
                    >
                        {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                        <span>{item.title}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-primary ring-2 ring-white animate-pulse" />
                        )}
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" sideOffset={4} className="w-56">
                    <DropdownMenuLabel className="font-bold text-gray-800">
                        {item.title} {item.badge !== undefined && item.badge > 0 ? `(${item.badge})` : ""}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {item.items.map((subItem) => {
                        const isSubActive = location === subItem.url;
                        return (
                            <DropdownMenuItem
                                key={subItem.title}
                                onClick={() => setLocation(subItem.url)}
                                className={`flex items-center gap-2 cursor-pointer ${isSubActive ? "bg-orange-50 text-primary font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                            >
                                {subItem.icon && <subItem.icon className="h-4 w-4 shrink-0" />}
                                <span>{subItem.title}</span>
                                {subItem.badge !== undefined && subItem.badge > 0 && (
                                    <span className="ml-auto bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {subItem.badge}
                                    </span>
                                )}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [location, setLocation] = useLocation();
    const { logoutMutation, user } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    // Polling counts for notifications in sidebar
    const { data: complaintsStats } = useQuery<{ pendingCount: number }>({
        queryKey: ["/api/admin/complaints/stats"],
        refetchInterval: 5000,
    });

    const { data: leaveRequests } = useQuery<{ status: string }[]>({
        queryKey: ["/api/admin/attendance/leave/list"],
        refetchInterval: 5000,
    });

    const { data: unverifiedEmployees } = useQuery<any[]>({
        queryKey: ["/api/admin/unverified-employees"],
        refetchInterval: 10000,
    });

    const pendingLeaveCount = leaveRequests?.filter((r) => r.status === 'pending').length || 0;
    const pendingComplaintsCount = complaintsStats?.pendingCount || 0;
    const pendingVerificationCount = unverifiedEmployees?.filter((e) => e.registrationStatus === 'pending').length || 0;

    const totalNotifications = pendingLeaveCount + pendingComplaintsCount + pendingVerificationCount;

    // Close header dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Filter sidebarData dynamically based on configured features
    const sidebarData = [
        {
            title: "Menu Utama",
            items: [
                {
                    title: "Dashboard",
                    url: "/admin/dashboard",
                    icon: CalendarDays,
                },
            ],
        },
        {
            title: "Manajemen Tenaga Kerja",
            items: [
                {
                    title: "Daftar Tenaga Kerja",
                    url: "/admin/employees",
                    icon: Users,
                },
                {
                    title: "Verifikasi Registrasi",
                    url: "/admin/verification",
                    icon: ShieldCheck,
                    badge: pendingVerificationCount,
                },
                ...(config?.features?.warningLetter !== false ? [
                    {
                        title: "Surat Peringatan (SP)",
                        url: "/admin/warning-letters",
                        icon: AlertTriangle,
                    }
                ] : []),
                ...(user?.role === 'superadmin' ? [
                    {
                        title: "Kelola Admin",
                        url: "/admin/manage-admins",
                        icon: UserCog,
                    }
                ] : []),
            ],
        },
        ...((config?.features?.resignation !== false || config?.features?.mutation !== false) ? [
            {
                title: "Resign & Karir",
                items: [
                    ...(config?.features?.resignation !== false ? [
                        {
                            title: "Resign",
                            url: "#resign",
                            icon: UserMinus,
                            items: [
                                {
                                    title: "Manajemen Resign",
                                    url: "/admin/resign-management",
                                    icon: UserMinus,
                                },
                                {
                                    title: "Riwayat Resign",
                                    url: "/admin/resign-history",
                                    icon: History,
                                },
                            ]
                        }
                    ] : []),
                    ...(config?.features?.mutation !== false ? [
                        {
                            title: "Mutasi & Promosi",
                            url: "#mutation",
                            icon: UserCog,
                            items: [
                                {
                                    title: "Manajemen Karir",
                                    url: "/admin/mutations",
                                    icon: UserCog,
                                },
                                {
                                    title: "Riwayat Karir",
                                    url: "/admin/mutations-history",
                                    icon: History,
                                },
                            ]
                        }
                    ] : [])
                ]
            }
        ] : []),
        {
            title: "Manajemen Absensi",
            items: [
                ...(config?.features?.leave !== false ? [
                    {
                        title: "Kelola Cuti",
                        url: "#leave",
                        icon: CalendarDays,
                        badge: pendingLeaveCount,
                        items: [
                            {
                                title: "Pengajuan Cuti",
                                url: "/admin/leaves",
                                icon: CalendarDays,
                                badge: pendingLeaveCount,
                            },
                            {
                                title: "Riwayat Cuti",
                                url: "/admin/leaves-history",
                                icon: History,
                            },
                        ]
                    }
                ] : []),
                {
                    title: "Rekap & Riwayat",
                    url: "#attendance",
                    icon: Clock,
                    items: [
                        ...(config?.features?.recap !== false ? [
                            {
                                title: "Rekap Absensi",
                                url: "/admin/recap",
                                icon: Clock,
                            }
                        ] : []),
                        {
                            title: "Riwayat Absensi (Foto)",
                            url: "/admin/attendance",
                            icon: ImageIcon,
                        },
                        {
                            title: "Ringkasan Absensi",
                            url: "/admin/summary",
                            icon: FileText,
                        },
                        ...(config?.features?.shift !== false ? [
                            {
                                title: "Kelola Shift",
                                url: "/admin/shifts",
                                icon: Calendar,
                            }
                        ] : []),
                    ]
                }
            ]
        },
        ...((config?.features?.info !== false || config?.features?.complaint !== false) ? [
            {
                title: "Papan Informasi",
                items: [
                    ...(config?.features?.info !== false ? [
                        {
                            title: "Papan Informasi",
                            url: "/admin/info-board",
                            icon: Megaphone,
                        }
                    ] : []),
                    ...((config?.features?.complaint !== false && (user?.role === 'superadmin' || user?.role === 'admin')) ? [
                        {
                            title: "Pengaduan Tenaga Kerja",
                            url: "/admin/complaints",
                            icon: MessageSquare,
                            badge: pendingComplaintsCount,
                        }
                    ] : []),
                ],
            }
        ] : []),
    ];

    return (
        <SidebarProvider defaultOpen={true}>
            <div className="flex h-screen w-full overflow-hidden bg-gray-50/50">
                {/* Sidebar Component */}
                <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-white">
                    <AdminSidebarHeader />
                    <SidebarContent className="p-2">
                        {sidebarData.map((group) => (
                            <SidebarGroup key={group.title}>
                                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                                <SidebarMenu>
                                    {group.items.map((item) => {
                                        const key = `${item.title}-${item.url}`;
                                        
                                        if (!('items' in item)) {
                                            return <SidebarMenuLink key={key} item={item} location={location} />;
                                        }

                                        // Collapsible when sidebar is expanded, dropdown when collapsed
                                        return (
                                            <CollapsibleWrapper key={key} item={item} location={location} />
                                        );
                                    })}
                                </SidebarMenu>
                            </SidebarGroup>
                        ))}
                    </SidebarContent>
                    <SidebarFooter className="border-t border-sidebar-border p-2">
                        <AdminSidebarFooter />
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>

                {/* Main Content Area */}
                <SidebarInset className="relative flex flex-grow flex-col overflow-y-hidden overflow-x-hidden bg-gray-50/50">
                    {/* Header */}
                    <header className="sticky top-0 z-30 flex w-full bg-white border-b border-gray-100 px-4 sm:px-6 h-16 shrink-0 items-center justify-between shadow-xs">
                        <div className="flex items-center gap-3">
                            <SidebarTrigger className="h-9 w-9 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer" />
                            <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block" />
                            <div className="hidden lg:flex items-center">
                                <span className="text-xs font-black text-primary bg-orange-50/80 border border-orange-100 px-3 py-1 rounded-full uppercase tracking-wider">
                                    {import.meta.env.VITE_NAMA_PT || "PT ABC"}
                                </span>
                            </div>
                        </div>

                        {/* Elegent Date Indicator */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100/70 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium text-gray-600 shadow-inner">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span className="capitalize">{format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</span>
                        </div>

                        {/* Right Area */}
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* Notifications Bell */}
                            <div className="relative">
                                <button
                                    onClick={() => setLocation("/admin/complaints")}
                                    className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-100 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-all hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
                                >
                                    <Bell className="w-5 h-5" />
                                    {totalNotifications > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                                            {totalNotifications}
                                        </span>
                                    )}
                                </button>
                            </div>

                            <div className="h-6 w-px bg-gray-200" />

                            {/* Profile Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 p-1.5 rounded-lg sm:rounded-xl transition-all duration-200 focus:outline-none cursor-pointer"
                                >
                                    <div className="hidden text-right sm:block">
                                        <p className="text-xs font-black text-gray-800 tracking-tight leading-none truncate max-w-[120px]">
                                            {user?.fullName || user?.username || "Admin"}
                                        </p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                            {user?.role === "superadmin" ? "Super Admin" : "Admin"}
                                        </p>
                                    </div>
                                    <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center font-bold text-sm shadow-xs hover:scale-105 transition-all">
                                        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : "A")}
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200" style={{ transform: dropdownOpen ? "rotate(180deg)" : "none" }} />
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-gray-100 shadow-2xl py-2 z-50 transition-all origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-4 py-2 border-b border-gray-50 mb-1.5">
                                            <p className="text-xs font-bold text-gray-800 truncate">
                                                {user?.fullName || "User Admin"}
                                            </p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                                {user?.role === "superadmin" ? "Super Admin" : "Admin"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                setLocation("/admin/profile");
                                            }}
                                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <UserCog className="w-4 h-4 text-gray-400" />
                                            <span>Profil Admin</span>
                                        </button>
                                        <div className="h-px bg-gray-50 my-1" />
                                        <button
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                logoutMutation.mutate();
                                            }}
                                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50/50 transition-colors font-semibold text-left"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>Keluar</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Viewport content */}
                    <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-gray-50/40 p-4 md:p-6 lg:p-8">
                        {children}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}

// Helper wrapper to switch between collapsible and dropdown on sidebar state
function CollapsibleWrapper({ item, location }: { item: NavCollapsible; location: string }) {
    const { state, isMobile } = useSidebar();

    if (state === "collapsed" && !isMobile) {
        return <SidebarMenuCollapsedDropdown item={item} location={location} />;
    }

    return <SidebarMenuCollapsible item={item} location={location} />;
}
