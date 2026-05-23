import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";

const DEMO = [
  { role: "Super Admin",  email: "super@aischool.io",   pw: "Pass@1234" },
  { role: "School Admin", email: "admin@aischool.io",   pw: "Pass@1234" },
  { role: "Teacher",      email: "teacher@aischool.io", pw: "Pass@1234" },
  { role: "Student",      email: "student@aischool.io", pw: "Pass@1234" },
  { role: "Parent",       email: "parent@aischool.io",  pw: "Pass@1234" },
];

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@aischool.io");
  const [password, setPassword] = useState("Pass@1234");
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}`);
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    }
  };

  const quickFill = (d) => { setEmail(d.email); setPassword(d.pw); };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background" data-testid="login-page">
      {/* Left side: form */}
      <div className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-12" data-testid="login-brand">
            <div className="w-9 h-9 rounded-xl bg-[#FF5E3A] grid place-items-center text-white font-display font-bold">Vi</div>
            <div className="font-display text-xl font-semibold tracking-tight">Vidya<span className="text-[#FF5E3A]">OS</span></div>
          </Link>
          <div className="label-eyebrow">Sign in</div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Welcome back.</h1>
          <p className="mt-3 text-neutral-600">Sign in to your school's command center.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]/30 focus:border-[#FF5E3A] transition"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Password</label>
              <div className="mt-2 relative">
                <input
                  type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]/30 focus:border-[#FF5E3A] transition"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700" aria-label="toggle password" data-testid="toggle-password">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60" data-testid="login-submit-button">
              {loading ? "Signing in…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-10">
            <div className="label-eyebrow flex items-center gap-2"><Sparkles className="w-3 h-3" /> Demo accounts (one click)</div>
            <div className="mt-3 grid gap-2">
              {DEMO.map((d) => (
                <button key={d.email} onClick={() => quickFill(d)}
                  className="text-left px-4 py-3 rounded-xl border border-black/5 bg-white hover:border-[#FF5E3A] hover:shadow-sm transition flex items-center justify-between"
                  data-testid={`demo-${d.role.toLowerCase().replace(/\s+/g,'-')}`}>
                  <div>
                    <div className="text-sm font-medium">{d.role}</div>
                    <div className="text-xs text-neutral-500 font-mono">{d.email}</div>
                  </div>
                  <span className="text-xs text-[#FF5E3A] font-medium">Use →</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">Password is <code className="font-mono">Pass@1234</code> for all demo accounts.</p>
          </div>
        </div>
      </div>

      {/* Right side: hero panel */}
      <div className="hidden lg:flex items-center justify-center p-12 relative bg-[#0A1128] text-white overflow-hidden">
        <div className="absolute inset-0 grain opacity-30" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-[#FF5E3A]/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] bg-[#10B981]/20 rounded-full blur-3xl" />
        <div className="relative max-w-md">
          <div className="label-eyebrow text-white/60">VidyaOS · Demo</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight leading-tight">Run your school like the world's best companies run themselves.</h2>
          <p className="mt-5 text-white/70 leading-relaxed">A loaded demo school is ready for you — 30 students, attendance, fees, exams, AI insights, and more.</p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              ["120+", "Schools onboard"],
              ["8", "Indian languages"],
              ["62%", "Teacher hours saved"],
              ["₹4.2 Cr", "Fees auto-collected /mo"],
            ].map(([k, v]) => (
              <div key={v} className="border border-white/10 rounded-xl p-4">
                <div className="font-display text-2xl font-semibold">{k}</div>
                <div className="text-xs text-white/60 mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
