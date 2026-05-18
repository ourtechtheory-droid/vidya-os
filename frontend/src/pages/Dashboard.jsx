import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowUpRight, Users, Wallet, Calendar, FileSpreadsheet, TrendingUp, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import { Link } from "react-router-dom";

const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

const KPI = ({ label, value, sub, icon: Icon, accent = "bg-[#0A1128] text-white" }) => (
  <div className="card-soft p-6" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,'-')}`}>
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${accent}`}><Icon className="w-5 h-5" strokeWidth={1.5} /></div>
      <ArrowUpRight className="w-4 h-4 text-neutral-400" />
    </div>
    <div className="mt-5 text-3xl font-display font-semibold tracking-tight">{value}</div>
    <div className="mt-1 text-sm text-neutral-500">{label}</div>
    {sub && <div className="mt-2 text-xs text-[#4A7C59] font-medium">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [circulars, setCirculars] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/circulars").then(({ data }) => setCirculars(data.slice(0, 4))).catch(() => {});
  }, []);

  const c = stats?.counts || {};
  const trend = (stats?.attendance_trend || []).map((d) => ({
    date: d.date.slice(5),
    Present: d.present || 0, Absent: d.absent || 0, Late: d.late || 0,
  }));
  const subj = stats?.subject_performance || [];
  const teacherContext = stats?.teacher_context;

  const isParent = user?.role === "parent";
  const isStudent = user?.role === "student";

  return (
    <div className="space-y-6" data-testid="dashboard-home">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Hello, {user?.name?.split(" ")[0]}</div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight">Today at a glance</h1>
          <p className="mt-1 text-sm text-neutral-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Link to="/app/ai/insights" className="btn-primary text-sm py-2.5" data-testid="open-insights-cta">
          <Sparkles className="w-4 h-4" /> Generate AI brief
        </Link>
      </div>

      {user?.role === "teacher" && teacherContext && (
        <div className="card-soft p-6 !bg-[#E5EFE8] border-[#4A7C59]/10" data-testid="teacher-context-card">
          <div className="flex items-center gap-4">
            {teacherContext.profile_image ? (
              <img src={teacherContext.profile_image} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#4A7C59] text-white grid place-items-center text-xl font-display font-semibold">
                {(teacherContext.name || user?.name || "T").charAt(0)}
              </div>
            )}
            <div>
              <div className="label-eyebrow text-[#4A7C59]/80">Teacher workspace</div>
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
        <KPI label="Students" value={c.students ?? 0} sub="+12 this month" icon={Users} accent="bg-[#0A1128] text-white" />
        <KPI label="Teachers" value={c.teachers ?? 0} sub="all active" icon={Calendar} accent="bg-[#FBE9E3] text-[#E05236]" />
        <KPI label="Fees collected" value={fmtINR(c.fees_paid_amount)} sub={`${c.fees_paid || 0} receipts`} icon={Wallet} accent="bg-[#E5EFE8] text-[#4A7C59]" />
        <KPI label="Pending dues" value={fmtINR(c.fees_pending_amount)} sub={`${c.fees_pending || 0} families`} icon={FileSpreadsheet} accent="bg-white text-[#0A1128] border border-black/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance trend */}
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Last 14 days</div>
              <h3 className="font-display text-xl font-semibold mt-1">Attendance pulse</h3>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#4A7C59] font-medium"><TrendingUp className="w-4 h-4" /> Healthy</div>
          </div>
          <div className="h-64" data-testid="chart-attendance">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A7C59" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#4A7C59" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E05236" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#E05236" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area dataKey="Present" stroke="#4A7C59" fill="url(#gp)" strokeWidth={2} />
                <Area dataKey="Absent"  stroke="#E05236" fill="url(#ga)" strokeWidth={2} />
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
                <Bar dataKey="avg" fill="#E05236" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Recent</div>
              <h3 className="font-display text-xl font-semibold mt-1">Circulars & announcements</h3>
            </div>
            <Link to="/app/circulars" className="text-xs text-[#E05236] font-medium" data-testid="view-all-circulars">View all →</Link>
          </div>
          <div className="divide-y divide-black/5">
            {circulars.length === 0 && <div className="text-sm text-neutral-500 py-6">No announcements yet.</div>}
            {circulars.map((cc) => (
              <div key={cc.id} className="py-4 flex items-start gap-4" data-testid={`circular-${cc.id}`}>
                <div className="w-9 h-9 rounded-lg bg-[#FBE9E3] text-[#E05236] grid place-items-center text-xs font-semibold uppercase">{cc.audience.slice(0,2)}</div>
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
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-[#E05236]/30 rounded-full blur-3xl" />
          <div className="relative">
            <div className="label-eyebrow text-white/60">Quick actions</div>
            <h3 className="font-display text-xl font-semibold mt-1">{isParent ? "Stay close to your child" : isStudent ? "Stay on top" : "Run your day"}</h3>
            <div className="mt-4 grid gap-2 text-sm">
              {(isParent || isStudent) ? (
                <>
                  <Link to="/app/ai/parent" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-ai-parent">Ask AI Saathi</Link>
                  <Link to="/app/fees" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-fees">Pay pending fees</Link>
                  <Link to="/app/exams" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-exams">View latest marks</Link>
                </>
              ) : (
                <>
                  <Link to="/app/ai/teacher" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-ai-teacher">Generate lesson plan</Link>
                  <Link to="/app/attendance" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-attendance">Mark attendance</Link>
                  <Link to="/app/circulars" className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 transition" data-testid="qa-circular">Post a circular</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
