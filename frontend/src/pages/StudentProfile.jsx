import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowLeft, GraduationCap, Calendar, Wallet, Sparkles } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function StudentProfile() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/students/${id}`).then(({ data }) => setS(data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-neutral-500">Loading profile…</div>;
  if (!s) return <div className="text-neutral-500">Student not found.</div>;

  // build subject perf from marks
  const subj = {};
  (s.marks || []).forEach((m) => {
    const pct = (m.marks / m.max_marks) * 100;
    subj[m.subject] = subj[m.subject] ? (subj[m.subject] + pct) / 2 : pct;
  });
  const radar = Object.entries(subj).map(([subject, score]) => ({ subject, score: Math.round(score) }));

  const pendingFees = (s.fees || []).filter((f) => f.status === "pending");
  const paidFees = (s.fees || []).filter((f) => f.status === "paid");

  return (
    <div className="space-y-6" data-testid="student-profile-page">
      <Link to="/app/students" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-[#0A1128]" data-testid="back-to-students">
        <ArrowLeft className="w-4 h-4" /> Back to roster
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header card */}
        <div className="card-soft p-8 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 !bg-[#FFF3F0] rounded-full blur-3xl opacity-70" />
          {s.admin_edited && <div className="absolute right-6 bottom-6 rotate-[-12deg] rounded-lg border-2 border-[#FF5E3A]/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#FF5E3A]/50">Admin edited</div>}
          <div className="relative flex items-start gap-6">
            {s.profile_image ? <img src={s.profile_image} alt="" className="w-20 h-20 rounded-2xl object-cover" /> : <div className="w-20 h-20 rounded-2xl !bg-[#0A1128] text-white grid place-items-center font-display text-3xl">{s.name.charAt(0)}</div>}
            <div className="flex-1">
              <div className="label-eyebrow">Student profile</div>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{s.name}</h1>
              <div className="mt-2 text-sm text-neutral-600">Class {s.class_id?.replace("cls-", "")} · Roll {s.roll_no} · House {s.house || "—"}</div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full !bg-[#E6F8F3] text-[#10B981] font-medium">Attendance {s.attendance_pct}%</span>
                <span className="px-2.5 py-1 rounded-full !bg-[#FFF3F0] text-[#FF5E3A] font-medium">{paidFees.length} paid · {pendingFees.length} pending</span>
                <span className="px-2.5 py-1 rounded-full bg-black/[0.04] text-neutral-700 font-medium">{s.category || "GEN"}</span>
                {s.admin_edited && <span className="px-2.5 py-1 rounded-full !bg-[#FFF3F0] text-[#FF5E3A] font-medium">Edited by {s.admin_edited_by || "admin"}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card-soft p-6 !bg-[#0A1128] text-white">
          <div className="label-eyebrow text-white/60">Family</div>
          <div className="mt-3 text-sm space-y-2">
            <div><span className="text-white/60">Parent email:</span> {s.parent_email || "—"}</div>
            <div><span className="text-white/60">Phone:</span> {s.parent_phone || "—"}</div>
            <div><span className="text-white/60">Address:</span> {s.address || "—"}</div>
            <div><span className="text-white/60">DOB:</span> {s.dob || "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject radar */}
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="label-eyebrow">Quarterly Exam</div>
              <h3 className="font-display text-xl font-semibold mt-1">Subject mastery</h3>
            </div>
            <Sparkles className="w-5 h-5 text-[#FF5E3A]" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="75%">
                <PolarGrid stroke="#eee" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#0A1128" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name={s.name} dataKey="score" stroke="#FF5E3A" fill="#FF5E3A" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fees */}
        <div className="card-soft p-6">
          <div className="label-eyebrow">Fees</div>
          <h3 className="font-display text-xl font-semibold mt-1">Family ledger</h3>
          <div className="mt-4 space-y-2">
            {(s.fees || []).map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">{f.term}</div>
                  <div className="text-xs text-neutral-500">{f.type} · due {f.due_date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{fmtINR(f.amount)}</div>
                  <div className={`text-xs font-medium ${f.status === "paid" ? "text-[#10B981]" : "text-[#FF5E3A]"}`}>{f.status}</div>
                </div>
              </div>
            ))}
            {(s.fees || []).length === 0 && <div className="text-sm text-neutral-500">No fee records.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
