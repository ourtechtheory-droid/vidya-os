import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Calendar, FileSpreadsheet, Wallet, Megaphone,
  Bot, MessageSquareText, Sparkles, LogOut, Bell, Search, Menu, X, GraduationCap, School,
  CalendarRange, Send, Award, LifeBuoy
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  { to: "/app/help",              label: "Help Me",            icon: LifeBuoy,        roles: ["super_admin","school_admin","teacher","student","parent"] },
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

  // Dynamic system alerts state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("read_alert_ids") || "[]");
    } catch (_) {
      return [];
    }
  });

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch (_) {
      // silent fail fallback
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const t = setInterval(loadNotifications, 8000);
      return () => clearInterval(t);
    }
  }, [user]);

  const unreadAlerts = notifications.filter(n => !readAlertIds.includes(n.id));

  const markAllAsRead = () => {
    const nextReadIds = [...new Set([...readAlertIds, ...notifications.map(n => n.id)])];
    setReadAlertIds(nextReadIds);
    localStorage.setItem("read_alert_ids", JSON.stringify(nextReadIds));
  };

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
            
            {/* Functional Notifications Drawer button and dropdown overlay */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="p-2 rounded-lg hover:bg-black/5 relative transition" 
                aria-label="notifications" 
                data-testid="notifications-button"
              >
                <Bell className="w-5 h-5 text-neutral-700" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF5E3A] rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-black/10 shadow-2xl z-50 overflow-hidden anim-pop flex flex-col max-h-[420px]">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                      <span className="font-display font-bold text-sm text-[#0A1128]">Notifications</span>
                      {unreadAlerts.length > 0 && (
                        <button 
                          onClick={markAllAsRead} 
                          className="text-[10px] text-[#FF5E3A] hover:underline font-bold"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 max-h-[300px] scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-neutral-400 italic">
                          No new notifications.
                        </div>
                      ) : (
                        notifications.map((alert) => {
                          const isUnread = !readAlertIds.includes(alert.id);
                          return (
                            <div 
                              key={alert.id} 
                              className={`p-3 text-left text-xs transition-colors hover:bg-neutral-50/50 relative flex items-start gap-2.5 ${isUnread ? "bg-orange-50/20 font-semibold" : ""}`}
                            >
                              {isUnread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5E3A] shrink-0 mt-1.5 animate-pulse" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-[#0A1128] flex items-center gap-1.5">
                                  <span>{alert.title}</span>
                                  <span className="text-[9px] font-medium text-neutral-400 ml-auto shrink-0">
                                    {alert.time ? new Date(alert.time).toLocaleDateString("en-IN", {month: "short", day: "numeric"}) : ""}
                                  </span>
                                </div>
                                <p className="text-neutral-500 mt-1 leading-normal text-[11px] break-words">{alert.message}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-2 text-center bg-neutral-50/50 border-t border-neutral-100">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">VidyaOS System Alerts</span>
                    </div>
                  </div>
                </>
              )}
            </div>

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
