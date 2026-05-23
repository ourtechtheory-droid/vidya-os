import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Calendar, FileSpreadsheet, Wallet, Megaphone,
  Bot, MessageSquareText, Sparkles, LogOut, Bell, Search, Menu, X, GraduationCap, School,
  CalendarRange, Send, Award, IdCard
} from "lucide-react";
import { useState } from "react";

const ALL_ITEMS = [
  { to: "/app",                   label: "Dashboard",          icon: LayoutDashboard, roles: ["super_admin","school_admin","teacher","student","parent"], end: true },
  { to: "/app/teachers",          label: "Teachers",           icon: GraduationCap,   roles: ["super_admin","school_admin"] },
  { to: "/app/classes",           label: "Classes",            icon: School,          roles: ["super_admin","school_admin"] },
  { to: "/app/students",          label: "Students",           icon: Users,           roles: ["super_admin","school_admin","teacher","parent"] },
  { to: "/app/attendance",        label: "Attendance",         icon: Calendar,        roles: ["super_admin","school_admin","teacher","student","parent"] },
  { to: "/app/exams",             label: "Exams & Marks",      icon: FileSpreadsheet, roles: ["super_admin","school_admin","teacher","student","parent"] },
  { to: "/app/fees",              label: "Fees",               icon: Wallet,          roles: ["super_admin","school_admin","parent","student"] },
  { to: "/app/circulars",         label: "Circulars",          icon: Megaphone,       roles: ["super_admin","school_admin","teacher","student","parent"] },
  { to: "/app/timetable",         label: "Timetable",          icon: CalendarRange,   roles: ["super_admin","school_admin"] },
  { to: "/app/communication",     label: "Communication",      icon: Send,            roles: ["super_admin","school_admin","teacher"] },
  { to: "/app/certificates",      label: "Certificates",       icon: Award,           roles: ["super_admin","school_admin"] },
  { to: "/app/id-cards",          label: "ID Cards",           icon: IdCard,          roles: ["super_admin","school_admin"] },
  { to: "/app/ai/teacher",        label: "AI Teacher Copilot", icon: Bot,             roles: ["super_admin","school_admin","teacher"] },
  { to: "/app/ai/parent",         label: "AI Saathi",          icon: MessageSquareText,roles: ["super_admin","school_admin","parent","student"] },
  { to: "/app/ai/insights",       label: "AI Insights",        icon: Sparkles,        roles: ["super_admin","school_admin","teacher"] },
];

const ROLE_LABEL = {
  super_admin: "Super Admin", school_admin: "School Admin",
  teacher: "Teacher", student: "Student", parent: "Parent",
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const items = ALL_ITEMS.filter((i) => i.roles.includes(user?.role));

  const onLogout = () => { logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-layout">
      {/* Glass top bar */}
      <header className="glass sticky top-0 z-40">
        <div className="px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-black/5" aria-label="menu" data-testid="mobile-menu-toggle">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/app" className="flex items-center gap-2" data-testid="dashboard-brand">
              <div className="w-8 h-8 rounded-lg bg-[#FF5E3A] grid place-items-center text-white font-display font-bold text-sm">Vi</div>
              <div className="font-display text-lg font-semibold tracking-tight hidden sm:block">Vidya<span className="text-[#FF5E3A]">OS</span></div>
            </Link>
            <span className="hidden md:inline text-xs px-2 py-1 rounded-full bg-[#0A1128] text-white font-medium ml-2">{ROLE_LABEL[user?.role] || user?.role}</span>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.04] w-96">
            <Search className="w-4 h-4 text-neutral-400" />
            <input className="bg-transparent text-sm w-full outline-none" placeholder="Search students, classes, circulars…" data-testid="global-search" />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-black/5 relative" aria-label="notifications" data-testid="notifications-button">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF5E3A] rounded-full" />
            </button>
            <div className="hidden sm:flex items-center gap-3 pl-3 ml-1 border-l border-black/10">
              <div className="text-right">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-neutral-500">{user?.email}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0A1128] text-white grid place-items-center font-medium">
                {(user?.name || "U").charAt(0)}
              </div>
            </div>
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-black/5" aria-label="logout" data-testid="logout-button">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${open ? "fixed inset-y-16 left-0 w-64 z-30 bg-white" : "hidden"} md:block md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-64 border-r border-black/[0.06] bg-white`} data-testid="sidebar">
          <nav className="p-4 space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.to} to={item.to} end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive ? "bg-[#0A1128] text-white" : "text-neutral-600 hover:bg-black/5 hover:text-[#0A1128]"
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
