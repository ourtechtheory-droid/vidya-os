import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowUpRight, BookOpen, Calendar, FileSpreadsheet, Plus, Save, Sparkles, TrendingUp, Trash2, Users, Wallet, CheckCircle, AlertCircle, GraduationCap, MessageSquareText } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend
} from "recharts";
import { Link } from "react-router-dom";

const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

const EXAM_STATUS = {
  scheduled: "Scheduled",
  under_correction: "Under correction",
  results_out: "Results are out",
};

const KPI = ({ label, value, sub, icon: Icon, accent = "bg-[#0A1128] text-white", onClick }) => (
  <button type="button" onClick={onClick} className={`card-soft p-6 text-left ${onClick ? "hover:-translate-y-0.5 transition" : "cursor-default"}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,'-')}`}>
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${accent}`}><Icon className="w-5 h-5" strokeWidth={1.5} /></div>
      <ArrowUpRight className="w-4 h-4 text-neutral-400" />
    </div>
    <div className="mt-5 text-3xl font-display font-semibold tracking-tight">{value}</div>
    <div className="mt-1 text-sm text-neutral-500">{label}</div>
    {sub && <div className="mt-2 text-xs text-[#10B981] font-medium">{sub}</div>}
  </button>
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [circulars, setCirculars] = useState([]);
  const [events, setEvents] = useState([]);
  const [showMerit, setShowMerit] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: new Date().toISOString().slice(0, 10), type: "lesson_plan", description: "" });
  const [resetting, setResetting] = useState(false);

  const loadDashboardData = () => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/circulars").then(({ data }) => setCirculars(data.slice(0, 4))).catch(() => {});
    if (["teacher", "school_admin", "super_admin"].includes(user?.role)) {
      api.get("/calendar").then(({ data }) => setEvents(data)).catch(() => {});
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleResetSystem = async () => {
    const confirmed = window.confirm(
      "WARNING: This will wipe all transactional placeholder data (fake rosters, placeholder marks, fake fees, and attendance logs) and restore VidyaOS to a clean core state.\n\nAre you sure you want to proceed?"
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await api.post("/admin/reset-system");
      toast.success("Database successfully reset to pristine core state!");
      setTimeout(() => {
        logout();
        window.location.href = "/login";
      }, 1500);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to reset database");
      setResetting(false);
    }
  };

  const c = stats?.counts || {};
  const trend = (stats?.attendance_trend || []).map((d) => ({
    date: d.date.slice(5),
    Present: d.present || 0, Absent: d.absent || 0, Late: d.late || 0,
  }));
  const subj = stats?.subject_performance || [];
  const teacherContext = stats?.teacher_context;
  const recentExams = stats?.recent_exams || [];
  const todayAttendance = stats?.today_attendance || {};
  const meritBreakdown = stats?.merit_breakdown || [];

  const isParent = user?.role === "parent";
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";
  const canUseCalendar = ["teacher", "school_admin", "super_admin"].includes(user?.role);

  const createEvent = async (e) => {
    e.preventDefault();
    const { data } = await api.post("/calendar", eventForm);
    setEvents((items) => [...items, data].sort((a, b) => a.date.localeCompare(b.date)));
    setEventForm({ title: "", date: eventForm.date, type: "lesson_plan", description: "" });
  };

  const deleteEvent = async (id) => {
    await api.delete(`/calendar/${id}`);
    setEvents((items) => items.filter((item) => item.id !== id));
  };

  const selectedDate = new Date(`${eventForm.date}T00:00:00`);
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthDays = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array(monthStart.getDay()).fill(null),
    ...Array.from({ length: monthDays }, (_, i) => i + 1),
  ];
  const eventDates = new Set(events.map((event) => event.date));
  const pickCalendarDate = (day) => {
    if (!day) return;
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setEventForm((v) => ({ ...v, date: date.toISOString().slice(0, 10) }));
  };

  // ==========================================
  // STUDENT DASHBOARD RENDER
  // ==========================================
  if (isStudent) {
    const sProfile = stats?.student_profile || {};
    const avgMarks = subj.length > 0 ? Math.round(subj.reduce((acc, curr) => acc + curr.avg, 0) / subj.length) : 0;
    
    return (
      <div className="space-y-6" data-testid="dashboard-student-home">
        {/* Welcome Card */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0A1128] text-white p-8 shadow-xl">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-[#FF5E3A]/40 to-transparent rounded-full blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/10 text-white grid place-items-center text-3xl font-display font-semibold border border-white/20">
              {user?.name?.charAt(0)}
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="text-xs uppercase tracking-widest text-[#FF5E3A] font-semibold">Welcome back to school</div>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Namaste, {user?.name}</h1>
              <p className="mt-1 text-sm text-neutral-300">
                Class {sProfile.class_name || "N/A"} · Roll No: {sProfile.roll_no || "N/A"} · {sProfile.house ? `${sProfile.house} House` : ""}
              </p>
            </div>
            {sProfile.class_teacher && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm shrink-0">
                <div className="text-white/60 text-xs">Class Teacher</div>
                <div className="font-semibold mt-1 text-white">{sProfile.class_teacher.name}</div>
                <div className="text-xs text-neutral-300">{sProfile.class_teacher.core_subject}</div>
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPI label="My Attendance" value={`${stats?.cumulative_attendance_rate ?? 0}%`} sub="Target: 75%+" icon={Calendar} accent="bg-[#E6F8F3] text-[#10B981]" />
          <KPI label="My Exam Average" value={`${avgMarks}%`} sub="Across all subjects" icon={TrendingUp} accent="bg-[#FFF3F0] text-[#FF5E3A]" />
          <KPI label="Pending Dues" value={fmtINR(c.fees_pending_amount)} sub={c.fees_pending > 0 ? "Pay online" : "All cleared!"} icon={Wallet} accent="bg-neutral-50 text-[#0A1128] border border-black/10" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Marks Summary */}
          <div className="card-soft p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="label-eyebrow">Performance</div>
                <h3 className="font-display text-xl font-semibold mt-1">My Subject Averages</h3>
              </div>
              <Link to="/app/exams" className="text-xs text-[#FF5E3A] font-semibold">View exam details →</Link>
            </div>
            {subj.length === 0 ? (
              <div className="text-sm text-neutral-500 py-12 text-center">No exam marks uploaded yet.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={subj}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="subject" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <Bar dataKey="avg" name="My Marks %" fill="#FF5E3A" radius={[8, 8, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card-soft p-6 bg-[#0A1128] text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-[#FF5E3A]/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="label-eyebrow text-white/60">AI Companion & Leave</div>
              <h3 className="font-display text-xl font-semibold mt-1">My Quick Desk</h3>
              <div className="mt-5 space-y-2">
                <Link to="/app/ai/parent" className="flex items-center justify-between rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3.5 transition">
                  <span className="text-sm font-medium">Ask AI Saathi</span>
                  <MessageSquareText className="w-4 h-4 text-[#FF5E3A]" />
                </Link>
                <Link to="/app/attendance" className="flex items-center justify-between rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3.5 transition">
                  <span className="text-sm font-medium">Apply Leave Letter</span>
                  <Calendar className="w-4 h-4 text-[#FF5E3A]" />
                </Link>
                <Link to="/app/fees" className="flex items-center justify-between rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3.5 transition">
                  <span className="text-sm font-medium">Fee Desk</span>
                  <Wallet className="w-4 h-4 text-[#FF5E3A]" />
                </Link>
              </div>
            </div>
            <div className="relative mt-8 pt-4 border-t border-white/10 text-xs text-neutral-400">
              Need assistance? Chat with AI Saathi for instantly answered school operations.
            </div>
          </div>
        </div>

        {/* Circulars */}
        <div className="card-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Announcements</div>
              <h3 className="font-display text-xl font-semibold mt-1">Circulars for you</h3>
            </div>
            <Link to="/app/circulars" className="text-xs text-[#FF5E3A] font-semibold">View all circulars</Link>
          </div>
          <div className="divide-y divide-black/5">
            {circulars.length === 0 && <div className="text-sm text-neutral-500 py-6 text-center">No circulars posted yet.</div>}
            {circulars.map((cc) => (
              <div key={cc.id} className="py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#FFF3F0] text-[#FF5E3A] grid place-items-center text-xs font-semibold uppercase shrink-0">{cc.audience.slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[#0A1128]">{cc.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{cc.body}</div>
                  <div className="text-[10px] text-neutral-400 mt-1">by {cc.author} · {new Date(cc.created_at).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PARENT DASHBOARD RENDER
  // ==========================================
  if (isParent) {
    const parentKids = stats?.parent_kids || [];
    
    return (
      <div className="space-y-6" data-testid="dashboard-parent-home">
        {/* Welcome */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0A1128] text-white p-8 shadow-xl">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-[#FF5E3A]/40 to-transparent rounded-full blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#FF5E3A] font-semibold">Parent Portal</div>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Namaste, {user?.name}</h1>
              <p className="mt-1 text-sm text-neutral-300">Monitor your children's learning journey, attendance, and dues in real-time.</p>
            </div>
            <Link to="/app/ai/parent" className="btn-primary shrink-0 py-3 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Ask AI Saathi
            </Link>
          </div>
        </div>

        {/* Children details */}
        <div>
          <div className="label-eyebrow mb-3">Your Children</div>
          {parentKids.length === 0 ? (
            <div className="card-soft p-8 text-sm text-neutral-500 text-center">No children linked to this email address.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {parentKids.map((kid) => (
                <div key={kid.id} className="card-soft p-6 space-y-4 border border-black/5 bg-white shadow-sm hover:border-black/10 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FFF3F0] text-[#FF5E3A] grid place-items-center text-xl font-display font-semibold">
                      {kid.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#0A1128]">{kid.name}</h3>
                      <p className="text-xs text-neutral-500">
                        Class {kid.class_name} · Roll No: {kid.roll_no} · {kid.house ? `${kid.house} House` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Visual metrics bar */}
                  <div className="grid grid-cols-3 gap-2 bg-neutral-50 rounded-xl p-3 text-center">
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase font-semibold">Attendance</div>
                      <div className="text-sm font-semibold mt-0.5 text-emerald-600">{kid.attendance_rate}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase font-semibold">Academic Avg</div>
                      <div className="text-sm font-semibold mt-0.5 text-[#FF5E3A]">{kid.academic_average}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase font-semibold">Pending Fees</div>
                      <div className="text-sm font-semibold mt-0.5 text-[#0A1128]">{fmtINR(kid.pending_fees)}</div>
                    </div>
                  </div>

                  {kid.class_teacher && (
                    <div className="text-xs border-t border-black/5 pt-3 flex items-center justify-between text-neutral-600">
                      <span>Class Teacher: <strong>{kid.class_teacher.name}</strong></span>
                      <span className="text-neutral-400">{kid.class_teacher.core_subject}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link to="/app/exams" className="btn-ghost text-xs py-2 text-center border border-black/5 hover:border-black/10 bg-white">View Marks</Link>
                    <Link to="/app/attendance" className="btn-ghost text-xs py-2 text-center border border-black/5 hover:border-black/10 bg-white">Attendance Logs</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Circulars */}
        <div className="card-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Announcements</div>
              <h3 className="font-display text-xl font-semibold mt-1">Important circulars for parents</h3>
            </div>
            <Link to="/app/circulars" className="text-xs text-[#FF5E3A] font-semibold">View all circulars</Link>
          </div>
          <div className="divide-y divide-black/5">
            {circulars.length === 0 && <div className="text-sm text-neutral-500 py-6 text-center">No circulars posted yet.</div>}
            {circulars.map((cc) => (
              <div key={cc.id} className="py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#FFF3F0] text-[#FF5E3A] grid place-items-center text-xs font-semibold uppercase shrink-0">{cc.audience.slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[#0A1128]">{cc.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{cc.body}</div>
                  <div className="text-[10px] text-neutral-400 mt-1">by {cc.author} · {new Date(cc.created_at).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // ADMIN/TEACHER RENDER (ORIGINAL OVERHAULED)
  // ==========================================
  return (
    <div className="space-y-6" data-testid="dashboard-home">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Hello, {user?.name?.split(" ")[0]}</div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight">Today at a glance</h1>
          <p className="mt-1 text-sm text-neutral-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === "school_admin" || user?.role === "super_admin") && (
            <button 
              disabled={resetting}
              onClick={handleResetSystem} 
              className={`btn-ghost border ${resetting ? "border-neutral-200 text-neutral-400 cursor-not-allowed" : "border-red-200 text-red-600 hover:bg-red-50"} text-sm py-2.5 flex items-center gap-2`} 
              data-testid="reset-system-cta"
            >
              <Trash2 className="w-4 h-4" /> {resetting ? "Resetting System..." : "Reset System Data"}
            </button>
          )}
          <Link to="/app/ai/insights" className="btn-primary text-sm py-2.5" data-testid="open-insights-cta">
            <Sparkles className="w-4 h-4" /> Generate AI brief
          </Link>
        </div>
      </div>

      {user?.role === "teacher" && teacherContext && (
        <div className="card-soft p-6 !bg-[#E6F8F3] border-[#10B981]/10" data-testid="teacher-context-card">
          <div className="flex items-center gap-4">
            {teacherContext.profile_image ? (
              <img src={teacherContext.profile_image} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#10B981] text-white grid place-items-center text-xl font-display font-semibold">
                {(teacherContext.name || user?.name || "T").charAt(0)}
              </div>
            )}
            <div>
              <div className="label-eyebrow text-[#10B981]/80">Teacher workspace</div>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                {teacherContext.name || user?.name}
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                Class Teacher: {teacherContext.assigned_class?.name || "Not assigned"} {teacherContext.core_subject ? `- ${teacherContext.core_subject}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label={isTeacher ? "Class students" : "Students"} value={c.students ?? 0} sub={isTeacher ? teacherContext?.assigned_class?.name || "Assigned class" : "+12 this month"} icon={Users} accent="bg-[#0A1128] text-white" />
        <KPI label="Today present rate" value={`${todayAttendance.present_rate ?? 0}%`} sub={todayAttendance.date ? new Date(todayAttendance.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "Today"} icon={Calendar} accent="bg-[#FFF3F0] text-[#FF5E3A]" />
        <KPI label="Merit percentage" value={`${stats?.merit_percentage ?? 0}%`} sub="Click for exam stats" icon={TrendingUp} accent="bg-[#E6F8F3] text-[#10B981]" onClick={() => setShowMerit((v) => !v)} />
        <KPI label="Pending dues" value={fmtINR(c.fees_pending_amount)} sub={`${c.fees_pending || 0} families`} icon={FileSpreadsheet} accent="bg-white text-[#0A1128] border border-black/10" />
      </div>

      {showMerit && (
        <div className="card-soft p-6" data-testid="merit-breakdown-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Exam stats</div>
              <h3 className="font-display text-xl font-semibold mt-1">Merit distribution</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={meritBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="range" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {canUseCalendar && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="teacher-calendar">
          <div className="card-soft p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-eyebrow">Calendar</div>
                <h3 className="font-display text-xl font-semibold mt-1">{selectedDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
              </div>
              <input type="month" value={eventForm.date.slice(0, 7)} onChange={(e) => setEventForm((v) => ({ ...v, date: `${e.target.value}-01` }))} className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm" />
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs text-neutral-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarCells.map((day, index) => {
                const iso = day ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day).toISOString().slice(0, 10) : "";
                const active = iso === eventForm.date;
                return (
                  <button key={`${day || "blank"}-${index}`} type="button" disabled={!day} onClick={() => pickCalendarDate(day)} className={`aspect-square rounded-lg border text-sm relative ${active ? "border-[#FF5E3A] bg-[#FFF3F0] text-[#FF5E3A] font-semibold" : "border-black/5 bg-white hover:border-black/20"} disabled:bg-transparent disabled:border-transparent`}>
                    {day}
                    {eventDates.has(iso) && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#FF5E3A]" />}
                  </button>
                );
              })}
            </div>
          </div>
          <form onSubmit={createEvent} className="card-soft p-6 space-y-3">
            <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#FF5E3A]" /><div className="label-eyebrow">Teacher calendar</div></div>
            <h3 className="font-display text-xl font-semibold">Event details</h3>
            <input required value={eventForm.title} onChange={(e) => setEventForm((v) => ({ ...v, title: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Exam, lesson plan, meeting" />
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" value={eventForm.date} onChange={(e) => setEventForm((v) => ({ ...v, date: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
              <select value={eventForm.type} onChange={(e) => setEventForm((v) => ({ ...v, type: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="exam">Exam</option>
                <option value="lesson_plan">Lesson plan</option>
                <option value="other">Other</option>
              </select>
            </div>
            <textarea value={eventForm.description} onChange={(e) => setEventForm((v) => ({ ...v, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm resize-none" rows={3} placeholder="Notes" />
            <button type="submit" className="btn-primary text-sm py-2.5"><Plus className="w-4 h-4" /> Add Date</button>
          </form>
          <div className="card-soft p-6 lg:col-span-3">
            <div className="label-eyebrow">Upcoming</div>
            <div className="mt-4 divide-y divide-black/5">
              {events.length === 0 && <div className="text-sm text-neutral-500 py-6">No dates marked yet.</div>}
              {events.map((event) => (
                <div key={event.id} className="py-3 flex items-start gap-3">
                  <div className="w-14 shrink-0 rounded-lg bg-[#FFF3F0] text-[#FF5E3A] px-2 py-2 text-center">
                    <div className="text-xs font-semibold">{new Date(event.date).toLocaleDateString("en-IN", { month: "short" })}</div>
                    <div className="font-display text-lg font-semibold leading-none">{new Date(event.date).getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-neutral-500 capitalize">{event.type.replace("_", " ")}</div>
                    {event.description && <div className="mt-1 text-sm text-neutral-600 line-clamp-2">{event.description}</div>}
                  </div>
                  <button onClick={() => deleteEvent(event.id)} className="p-2 rounded-lg text-neutral-400 hover:text-[#FF5E3A] hover:bg-[#FFF3F0]" aria-label={`delete ${event.title}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance trend */}
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Last 14 days</div>
              <h3 className="font-display text-xl font-semibold mt-1">Attendance pulse</h3>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#10B981] font-medium"><TrendingUp className="w-4 h-4" /> Healthy</div>
          </div>
          <div className="h-64" data-testid="chart-attendance">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5E3A" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF5E3A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area dataKey="Present" stroke="#10B981" fill="url(#gp)" strokeWidth={2} />
                <Area dataKey="Absent"  stroke="#FF5E3A" fill="url(#ga)" strokeWidth={2} />
                <Area dataKey="Late"    stroke="#F59E0B" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject performance */}
        <div className="card-soft p-6">
          <div className="label-eyebrow">Class average</div>
          <h3 className="font-display text-xl font-semibold mt-1">Subject performance</h3>
          <div className="h-64 mt-4" data-testid="chart-subjects">
            <ResponsiveContainer>
              <BarChart data={subj} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="subject" tickLine={false} axisLine={false} fontSize={11} width={90} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Bar dataKey="avg" fill="#FF5E3A" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {recentExams.length > 0 && (
        <div className="card-soft p-6" data-testid="dashboard-exam-posts">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="label-eyebrow">Exam posts</div>
              <h3 className="font-display text-xl font-semibold mt-1">Latest exam updates</h3>
            </div>
            <Link to="/app/exams" className="text-xs text-[#FF5E3A] font-medium">View exams</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {recentExams.map((exam) => (
              <div key={exam.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{exam.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">{exam.subject} - {exam.exam_date || exam.start_date} - {exam.time || "Time TBA"}</div>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded-full bg-[#FFF3F0] text-[#FF5E3A] text-[11px] font-semibold">
                    {EXAM_STATUS[exam.status || "scheduled"]}
                  </span>
                </div>
                {exam.syllabus && <div className="mt-3 text-sm text-neutral-600 line-clamp-2">{exam.syllabus}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Recent</div>
              <h3 className="font-display text-xl font-semibold mt-1">Circulars & announcements</h3>
            </div>
            <Link to="/app/circulars" className="text-xs text-[#FF5E3A] font-medium" data-testid="view-all-circulars">View all →</Link>
          </div>
          <div className="divide-y divide-black/5">
            {circulars.length === 0 && <div className="text-sm text-neutral-500 py-6">No announcements yet.</div>}
            {circulars.map((cc) => (
              <div key={cc.id} className="py-4 flex items-start gap-4" data-testid={`circular-${cc.id}`}>
                <div className="w-9 h-9 rounded-lg bg-[#FFF3F0] text-[#FF5E3A] grid place-items-center text-xs font-semibold uppercase">{cc.audience.slice(0,2)}</div>
                <div className="flex-1">
                  <div className="font-medium">{cc.title}</div>
                  <div className="text-sm text-neutral-600 mt-0.5 line-clamp-2">{cc.body}</div>
                  <div className="text-xs text-neutral-400 mt-1">by {cc.author} · {new Date(cc.created_at).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-6 !bg-[#0A1128] text-white relative overflow-hidden">
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-[#FF5E3A]/30 rounded-full blur-3xl" />
          <div className="relative">
            <div className="label-eyebrow text-white/60">Quick actions</div>
            <h3 className="font-display text-xl font-semibold mt-1">Run your day</h3>
            <div className="mt-4 grid gap-2 text-sm">
              <Link to="/app/ai/teacher" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-ai-teacher">Generate lesson plan</Link>
              <Link to="/app/attendance" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-attendance">Mark attendance</Link>
              <Link to="/app/circulars" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-circular">Post a circular</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
