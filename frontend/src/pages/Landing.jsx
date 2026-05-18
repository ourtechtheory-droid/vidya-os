import { Link } from "react-router-dom";
import {
  Sparkles, BookOpen, Users, BarChart3, MessageSquare, Wallet, Bus,
  ShieldCheck, ArrowRight, Languages, Bot, GraduationCap, FileText
} from "lucide-react";

// Tiny inline anim helper using CSS classes (no framer-motion dep)
const FadeUp = ({ children, delay = 0, className = "" }) => (
  <div className={`anim-pop ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</div>
);

const HERO_IMG = "https://images.unsplash.com/photo-1770832501247-f8de2a392550?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBmdXR1cmlzdGljJTIwc2Nob29sJTIwYnVpbGRpbmd8ZW58MHx8fHwxNzc4MzIzOTk5fDA&ixlib=rb-4.1.0&q=85";
const TEACHER_IMG = "https://images.unsplash.com/photo-1601655781320-205e34c94eb1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwyfHxpbmRpYW4lMjB0ZWFjaGVyJTIwcHJvZmVzc2lvbmFsJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc4MzIzOTc3fDA&ixlib=rb-4.1.0&q=85";
const STUDENT_IMG = "https://images.pexels.com/photos/18012464/pexels-photo-18012464.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const GLASS_IMG = "https://images.unsplash.com/photo-1678535903460-51c27a661969?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBhYnN0cmFjdCUyMGdsYXNzfGVufDB8fHx8MTc3ODMyMzk5OXww&ixlib=rb-4.1.0&q=85";

const MODULES = [
  { icon: Users, title: "Smart Student Profile", desc: "AI-driven 360° student intelligence with risk alerts." },
  { icon: BarChart3, title: "Academic Intelligence", desc: "Heatmaps, dropout prediction, subject weakness detection." },
  { icon: Bot, title: "AI Teacher Copilot", desc: "Lesson plans, question papers, report comments — in seconds." },
  { icon: MessageSquare, title: "AI Parent Saathi", desc: "Natural-language answers on attendance, fees, performance." },
  { icon: Wallet, title: "Fees & Finance", desc: "UPI, installments, scholarships, automated reminders." },
  { icon: Bus, title: "Transport & Hostel", desc: "GPS routes, allocation, visitor logs, food tracking." },
  { icon: FileText, title: "Exams & Report Cards", desc: "Hall tickets, GPA/CGPA, AI-personalized remarks." },
  { icon: ShieldCheck, title: "Enterprise Security", desc: "RBAC, audit logs, school-level data isolation." },
];

export default function Landing() {
  return (
    <div className="min-h-screen !bg-[#F9FAFB] text-[#0A1128]" data-testid="landing-page">
      {/* GLASS NAV */}
      <header className="sticky top-0 z-50 glass" data-testid="landing-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-4">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-9 h-9 rounded-xl !bg-[#E05236] grid place-items-center text-white font-display font-bold">Vi</div>
            <div className="font-display text-xl font-semibold tracking-tight">Vidya<span className="text-[#E05236]">OS</span></div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <a href="#modules" className="hover:text-[#0A1128]" data-testid="nav-modules">Modules</a>
            <a href="#ai" className="hover:text-[#0A1128]" data-testid="nav-ai">AI Engine</a>
            <a href="#boards" className="hover:text-[#0A1128]" data-testid="nav-boards">Boards</a>
            <a href="#pricing" className="hover:text-[#0A1128]" data-testid="nav-pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline text-sm font-medium hover:text-[#E05236]" data-testid="nav-signin">Sign in</Link>
            <Link to="/login" className="btn-primary text-sm py-2" data-testid="nav-cta">Open Console <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </header>

      {/* HERO BENTO */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-24">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: copy */}
          <FadeUp className="col-span-12 lg:col-span-7">
            <div className="card-soft p-10 md:p-14 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-72 h-72 !bg-[#FBE9E3] rounded-full blur-3xl opacity-70" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full !bg-[#0A1128] text-white text-xs px-3 py-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5" /> AI-native School OS · Built for Indian schools
                </div>
                <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-balance">
                  The operating system for <span className="text-[#E05236]">21<sup className="text-2xl">st</sup>-century</span> schools.
                </h1>
                <p className="mt-6 text-lg text-neutral-600 max-w-xl leading-relaxed">
                  ERP + AI intelligence + parent communication in one platform — deeply tuned for CBSE, ICSE, State Boards and Junior Colleges.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/login" className="btn-primary" data-testid="hero-cta-primary">Try the live demo <ArrowRight className="w-4 h-4" /></Link>
                  <a href="#modules" className="btn-ghost" data-testid="hero-cta-secondary">Explore modules</a>
                </div>
                <div className="mt-10 flex items-center gap-6 text-sm text-neutral-500">
                  <div className="flex items-center gap-2"><Languages className="w-4 h-4" /> 8 Indian languages</div>
                  <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> CBSE · ICSE · State</div>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Right: image */}
          <FadeUp delay={120} className="col-span-12 lg:col-span-5">
            <div className="card-soft overflow-hidden h-full min-h-[360px] relative">
              <img src={HERO_IMG} alt="Modern school" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1128]/70 via-[#0A1128]/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="label-eyebrow text-white/70">Live demo</div>
                <div className="font-display text-2xl mt-1">Greenwood International School, Hyderabad</div>
                <div className="mt-3 flex gap-3 text-xs">
                  <span className="px-2 py-1 rounded-full bg-white/20 backdrop-blur">2,418 students</span>
                  <span className="px-2 py-1 rounded-full bg-white/20 backdrop-blur">93.4% attendance</span>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* KPI tiles */}
          {[
            { k: "₹4.2 Cr", v: "Fees collected automatically /month", c: "!bg-[#0A1128] text-white", plain: true },
            { k: "62%", v: "Time saved by teachers per week", c: "bg-white" },
            { k: "8.4×", v: "Faster parent-school response time", c: "!bg-[#FBE9E3]", plain: true },
            { k: "120+", v: "Schools across 9 states", c: "bg-white" },
          ].map((s, i) => (
            <FadeUp key={i} delay={200 + i * 80} className="col-span-6 md:col-span-3">
              <div className={`${s.plain ? "card-plain" : "card-soft"} p-6 h-full ${s.c}`}>
                <div className="text-3xl md:text-4xl font-display font-semibold tracking-tight">{s.k}</div>
                <div className="mt-2 text-sm opacity-80">{s.v}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* MODULES GRID */}
      <section id="modules" className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <div className="label-eyebrow">25 modules · one platform</div>
            <h2 className="mt-2 font-display text-3xl md:text-5xl font-semibold tracking-tight max-w-2xl text-balance">Everything your school runs on, finally in one place.</h2>
          </div>
          <p className="text-neutral-600 max-w-md">Replace 12 disconnected tools with a single AI-native operating system that automates the boring and amplifies the brilliant.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((m, i) => (
            <FadeUp key={m.title} delay={i * 60}>
              <div className="card-soft p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-300 h-full" data-testid={`module-${m.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}>
                <div className="w-10 h-10 rounded-xl bg-[#0A1128] text-white grid place-items-center"><m.icon className="w-5 h-5" strokeWidth={1.5} /></div>
                <h3 className="mt-5 font-display text-lg font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{m.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* AI ENGINE */}
      <section id="ai" className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <div className="grid grid-cols-12 gap-6">
          <FadeUp className="col-span-12 lg:col-span-5">
            <div className="card-soft p-8 lg:p-10 h-full !bg-[#0A1128] text-white relative overflow-hidden">
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-[#E05236]/30 rounded-full blur-3xl" />
              <div className="relative">
                <div className="label-eyebrow text-white/60">AI Intelligence Engine</div>
                <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">From data to decisions, automatically.</h2>
                <ul className="mt-6 space-y-4 text-white/80 text-sm">
                  <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#E05236] mt-2" /> Detect dropout & stress risk before it happens</li>
                  <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#E05236] mt-2" /> Auto-generate report card comments per student</li>
                  <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#E05236] mt-2" /> Parent chatbot answers in 8 Indian languages</li>
                  <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#E05236] mt-2" /> Principal's daily intelligence brief, on autopilot</li>
                </ul>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={100} className="col-span-12 lg:col-span-7 grid grid-cols-2 gap-6">
            <div className="card-soft p-6 col-span-2">
              <div className="aspect-[16/9] rounded-xl overflow-hidden mb-5">
                <img src={TEACHER_IMG} alt="AI teacher copilot" className="w-full h-full object-cover" />
              </div>
              <div className="label-eyebrow">For Teachers</div>
              <h3 className="font-display text-2xl mt-2">A copilot that does the paperwork — so teachers can teach.</h3>
            </div>
            <div className="card-soft p-6 !bg-[#E5EFE8]">
              <BookOpen className="w-8 h-8 text-[#4A7C59]" strokeWidth={1.5} />
              <h4 className="font-display text-xl mt-4">Lesson plans</h4>
              <p className="text-sm text-neutral-700 mt-2">Bloom-aligned, NEP-ready, generated in 4s.</p>
            </div>
            <div className="card-soft p-6">
              <FileText className="w-8 h-8 text-[#E05236]" strokeWidth={1.5} />
              <h4 className="font-display text-xl mt-4">Question papers</h4>
              <p className="text-sm text-neutral-600 mt-2">CBSE/ICSE patterns with answer keys.</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* TWO COLUMN STUDENT/PARENT */}
      <section id="boards" className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <div className="grid grid-cols-12 gap-6">
          <FadeUp className="col-span-12 md:col-span-7">
            <div className="card-soft overflow-hidden h-full">
              <img src={STUDENT_IMG} alt="Students" className="w-full h-72 object-cover" />
              <div className="p-8">
                <div className="label-eyebrow">Student Intelligence</div>
                <h3 className="font-display text-3xl mt-2">Every student, finally seen.</h3>
                <p className="mt-3 text-neutral-600">Behavioural patterns, learning style, weak topics, exam readiness — surfaced as gentle nudges, not noise.</p>
              </div>
            </div>
          </FadeUp>
          <FadeUp delay={100} className="col-span-12 md:col-span-5 grid gap-6">
            <div className="card-soft p-8 !bg-[#FBE9E3]">
              <div className="label-eyebrow">For parents</div>
              <h3 className="font-display text-2xl mt-2">"Has my daughter paid this term's fees?"</h3>
              <p className="mt-3 text-sm text-neutral-700">AI Saathi answers instantly — in Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Malayalam or English.</p>
            </div>
            <div className="card-soft p-8 relative overflow-hidden">
              <img src={GLASS_IMG} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="" />
              <div className="relative">
                <div className="label-eyebrow">For administrators</div>
                <h3 className="font-display text-2xl mt-2">An ERP that doesn't feel like 2009.</h3>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* PRICING TEASE / CTA */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="card-soft p-12 lg:p-16 text-center !bg-[#0A1128] text-white relative overflow-hidden">
          <div className="absolute inset-0 grain opacity-30" />
          <div className="relative max-w-3xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">Ready to run your school like a tech company?</h2>
            <p className="mt-5 text-white/70 text-lg">Spin up a fully-loaded demo school in 30 seconds. No card. No setup.</p>
            <Link to="/login" className="btn-primary mt-8 inline-flex" data-testid="footer-cta">Open the demo console <ArrowRight className="w-4 h-4" /></Link>
            <div className="mt-6 text-xs text-white/50">Demo accounts available for Super Admin, School Admin, Teacher, Student, Parent.</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-wrap items-center justify-between gap-4 text-sm text-neutral-500">
          <div>© 2026 VidyaOS · Built in Bharat for the world.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#0A1128]">Privacy</a>
            <a href="#" className="hover:text-[#0A1128]">Terms</a>
            <a href="#" className="hover:text-[#0A1128]">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
