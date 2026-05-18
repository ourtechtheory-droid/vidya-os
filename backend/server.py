"""
AI School OS - FastAPI Backend
Multi-role ERP + AI Intelligence Platform for Indian schools.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----- DB / Config -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', '43200'))
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

ROLES = ("super_admin", "school_admin", "teacher", "student", "parent")
Role = Literal["super_admin", "school_admin", "teacher", "student", "parent"]

# ----- App -----
app = FastAPI(title="AI School OS")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ai_school_os")


# =========================================================
# Models
# =========================================================
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Role
    school_id: Optional[str] = None
    avatar: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    school_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class StudentCreate(BaseModel):
    name: str
    roll_no: str
    class_id: str
    section: str
    gender: Literal["M", "F", "O"] = "M"
    dob: Optional[str] = None
    parent_email: Optional[EmailStr] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    house: Optional[str] = None
    category: Optional[str] = None


class AttendanceMark(BaseModel):
    class_id: str
    date: str  # YYYY-MM-DD
    records: List[Dict[str, Any]]  # [{student_id, status: present|absent|late}]


class MarkEntry(BaseModel):
    exam_id: str
    student_id: str
    subject: str
    marks: float
    max_marks: float = 100


class ExamCreate(BaseModel):
    name: str
    type: Literal["unit_test", "quarterly", "half_yearly", "pre_final", "final", "practical"]
    class_id: str
    subjects: List[str]
    start_date: str
    end_date: str


class FeeCreate(BaseModel):
    student_id: str
    term: str
    amount: float
    due_date: str
    type: Literal["tuition", "transport", "hostel", "exam", "other"] = "tuition"


class FeePay(BaseModel):
    fee_id: str
    method: Literal["upi", "card", "netbanking", "cash"] = "upi"


class CircularCreate(BaseModel):
    title: str
    body: str
    audience: Literal["all", "parents", "teachers", "students"] = "all"


class AIChatRequest(BaseModel):
    session_id: str
    message: str
    context: Optional[Dict[str, Any]] = None


class AITeacherRequest(BaseModel):
    task: Literal["lesson_plan", "question_paper", "report_comment", "assignment"]
    subject: str
    grade: str
    topic: Optional[str] = None
    extra: Optional[str] = None


# =========================================================
# Helpers
# =========================================================
def _hash_pwd(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify_pwd(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def _make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Dict[str, Any]:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def _dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Forbidden for role {user['role']}")
        return user
    return _dep


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================================================
# AI helper
# =========================================================
async def ai_complete(system: str, user_text: str, session_id: str = "default") -> str:
    if not EMERGENT_LLM_KEY:
        return "AI key not configured. Please add EMERGENT_LLM_KEY to backend .env."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system,
        ).with_model("openai", "gpt-5.2")
        resp = await chat.send_message(UserMessage(text=user_text))
        return str(resp)
    except Exception as e:
        logger.exception("AI error")
        return f"(AI temporarily unavailable: {e})"


# =========================================================
# Auth
# =========================================================
@api.get("/")
async def root():
    return {"app": "AI School OS", "status": "ok", "ts": now_iso()}


@api.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "password": _hash_pwd(body.password),
        "name": body.name,
        "role": body.role,
        "school_id": body.school_id or "default-school",
        "avatar": None,
        "meta": body.meta or {},
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    public = {k: v for k, v in user.items() if k not in ("password", "_id")}
    return TokenResponse(access_token=_make_token(user["id"], user["role"]), user=public)


@api.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not _verify_pwd(body.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    public = {k: v for k, v in user.items() if k not in ("password", "_id")}
    return TokenResponse(access_token=_make_token(user["id"], user["role"]), user=public)


@api.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return UserPublic(**user)


# =========================================================
# Classes / Students
# =========================================================
@api.get("/classes")
async def list_classes(user=Depends(get_current_user)):
    return await db.classes.find({}, {"_id": 0}).to_list(500)


@api.post("/students")
async def create_student(body: StudentCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    s = body.model_dump()
    s["id"] = str(uuid.uuid4())
    s["school_id"] = user.get("school_id", "default-school")
    s["created_at"] = now_iso()
    await db.students.insert_one(s)
    return {k: v for k, v in s.items() if k != "_id"}


@api.get("/students")
async def list_students(class_id: Optional[str] = None, user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if class_id:
        q["class_id"] = class_id
    if user["role"] == "parent":
        # parent sees only their child(ren)
        q["parent_email"] = user["email"]
    if user["role"] == "student":
        q["id"] = user.get("meta", {}).get("student_id", "")
    return await db.students.find(q, {"_id": 0}).to_list(2000)


@api.get("/students/{student_id}")
async def get_student(student_id: str, user=Depends(get_current_user)):
    s = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Student not found")
    # attach attendance summary, marks, fees
    attendance = await db.attendance.find({"student_id": student_id}, {"_id": 0}).to_list(500)
    present = sum(1 for a in attendance if a["status"] == "present")
    pct = round((present / len(attendance)) * 100, 1) if attendance else 0
    marks = await db.marks.find({"student_id": student_id}, {"_id": 0}).to_list(500)
    fees = await db.fees.find({"student_id": student_id}, {"_id": 0}).to_list(500)
    return {**s, "attendance_pct": pct, "attendance_total": len(attendance),
            "marks": marks, "fees": fees}


# =========================================================
# Attendance
# =========================================================
@api.post("/attendance/mark")
async def mark_attendance(body: AttendanceMark, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    docs = []
    for r in body.records:
        docs.append({
            "id": str(uuid.uuid4()),
            "class_id": body.class_id,
            "date": body.date,
            "student_id": r["student_id"],
            "status": r.get("status", "present"),
            "marked_by": user["id"],
            "created_at": now_iso(),
        })
    if docs:
        # remove previous entries for same date+class+student to keep idempotent
        for d in docs:
            await db.attendance.delete_many({"class_id": d["class_id"], "date": d["date"], "student_id": d["student_id"]})
        await db.attendance.insert_many(docs)
    return {"saved": len(docs)}


@api.get("/attendance")
async def get_attendance(class_id: Optional[str] = None, student_id: Optional[str] = None,
                         user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if class_id:
        q["class_id"] = class_id
    if student_id:
        q["student_id"] = student_id
    return await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


# =========================================================
# Exams / Marks
# =========================================================
@api.post("/exams")
async def create_exam(body: ExamCreate, user=Depends(require_roles("school_admin", "super_admin", "teacher"))):
    e = body.model_dump()
    e["id"] = str(uuid.uuid4())
    e["created_at"] = now_iso()
    await db.exams.insert_one(e)
    return {k: v for k, v in e.items() if k != "_id"}


@api.get("/exams")
async def list_exams(user=Depends(get_current_user)):
    return await db.exams.find({}, {"_id": 0}).to_list(500)


@api.post("/marks")
async def add_mark(body: MarkEntry, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    m = body.model_dump()
    m["id"] = str(uuid.uuid4())
    m["created_at"] = now_iso()
    # upsert one per (exam, student, subject)
    await db.marks.delete_many({"exam_id": m["exam_id"], "student_id": m["student_id"], "subject": m["subject"]})
    await db.marks.insert_one(m)
    return {k: v for k, v in m.items() if k != "_id"}


@api.get("/marks")
async def list_marks(student_id: Optional[str] = None, exam_id: Optional[str] = None,
                     user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if student_id:
        q["student_id"] = student_id
    if exam_id:
        q["exam_id"] = exam_id
    return await db.marks.find(q, {"_id": 0}).to_list(2000)


# =========================================================
# Fees
# =========================================================
@api.post("/fees")
async def create_fee(body: FeeCreate, user=Depends(require_roles("school_admin", "super_admin"))):
    f = body.model_dump()
    f["id"] = str(uuid.uuid4())
    f["status"] = "pending"
    f["paid_at"] = None
    f["method"] = None
    f["receipt_no"] = None
    f["created_at"] = now_iso()
    await db.fees.insert_one(f)
    return {k: v for k, v in f.items() if k != "_id"}


@api.get("/fees")
async def list_fees(student_id: Optional[str] = None, status_filter: Optional[str] = None,
                    user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if student_id:
        q["student_id"] = student_id
    if status_filter:
        q["status"] = status_filter
    if user["role"] == "parent":
        # restrict to their children
        kids = await db.students.find({"parent_email": user["email"]}, {"_id": 0}).to_list(50)
        q["student_id"] = {"$in": [k["id"] for k in kids]}
    return await db.fees.find(q, {"_id": 0}).sort("due_date", 1).to_list(1000)


@api.post("/fees/pay")
async def pay_fee(body: FeePay, user=Depends(get_current_user)):
    # MOCKED payment gateway
    fee = await db.fees.find_one({"id": body.fee_id}, {"_id": 0})
    if not fee:
        raise HTTPException(404, "Fee not found")
    receipt = f"RCPT-{uuid.uuid4().hex[:8].upper()}"
    await db.fees.update_one({"id": body.fee_id}, {"$set": {
        "status": "paid", "paid_at": now_iso(), "method": body.method, "receipt_no": receipt
    }})
    return {"ok": True, "receipt_no": receipt, "method": body.method}


# =========================================================
# Circulars
# =========================================================
@api.post("/circulars")
async def create_circular(body: CircularCreate, user=Depends(require_roles("school_admin", "super_admin", "teacher"))):
    c = body.model_dump()
    c["id"] = str(uuid.uuid4())
    c["author"] = user["name"]
    c["author_role"] = user["role"]
    c["created_at"] = now_iso()
    await db.circulars.insert_one(c)
    return {k: v for k, v in c.items() if k != "_id"}


@api.get("/circulars")
async def list_circulars(user=Depends(get_current_user)):
    return await db.circulars.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# =========================================================
# Dashboard stats
# =========================================================
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    students_count = await db.students.count_documents({})
    teachers_count = await db.users.count_documents({"role": "teacher"})
    classes_count = await db.classes.count_documents({})
    fees_paid = await db.fees.count_documents({"status": "paid"})
    fees_pending = await db.fees.count_documents({"status": "pending"})
    fees_paid_amt_cur = db.fees.aggregate([
        {"$match": {"status": "paid"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}
    ])
    fees_paid_amt = 0
    async for d in fees_paid_amt_cur:
        fees_paid_amt = d["s"]
    fees_pending_amt_cur = db.fees.aggregate([
        {"$match": {"status": "pending"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}
    ])
    fees_pending_amt = 0
    async for d in fees_pending_amt_cur:
        fees_pending_amt = d["s"]

    # attendance by date (last 7 days mock)
    att = await db.attendance.find({}, {"_id": 0}).to_list(5000)
    by_date: Dict[str, Dict[str, int]] = {}
    for a in att:
        d = a["date"]
        by_date.setdefault(d, {"present": 0, "absent": 0, "late": 0})
        by_date[d][a["status"]] = by_date[d].get(a["status"], 0) + 1
    attendance_trend = sorted(
        [{"date": k, **v} for k, v in by_date.items()],
        key=lambda x: x["date"]
    )[-14:]

    # subject performance (avg from marks)
    pipe = [
        {"$group": {"_id": "$subject", "avg": {"$avg": {"$multiply": [{"$divide": ["$marks", "$max_marks"]}, 100]}}}},
        {"$sort": {"avg": -1}},
    ]
    subj = []
    async for d in db.marks.aggregate(pipe):
        subj.append({"subject": d["_id"], "avg": round(d["avg"], 1)})

    return {
        "counts": {
            "students": students_count, "teachers": teachers_count, "classes": classes_count,
            "fees_paid": fees_paid, "fees_pending": fees_pending,
            "fees_paid_amount": fees_paid_amt, "fees_pending_amount": fees_pending_amt,
        },
        "attendance_trend": attendance_trend,
        "subject_performance": subj,
    }


# =========================================================
# AI endpoints
# =========================================================
@api.post("/ai/teacher")
async def ai_teacher(body: AITeacherRequest, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    sys_msg = (
        "You are an expert Indian school teaching assistant. Generate concise, structured, classroom-ready content "
        "aligned with CBSE/ICSE/State board patterns and Bloom's taxonomy. Use clear headings and bullets. "
        "Keep responses focused and actionable."
    )
    if body.task == "lesson_plan":
        prompt = f"Generate a 40-minute lesson plan for Grade {body.grade} {body.subject} on the topic '{body.topic}'. Include objectives, prerequisites, teaching aids, step-by-step activities (warm-up, main, practice, wrap-up), Bloom's taxonomy levels, formative assessment ideas, and homework. {body.extra or ''}"
    elif body.task == "question_paper":
        prompt = f"Create a question paper for Grade {body.grade} {body.subject}, topic '{body.topic or 'full syllabus'}', total 50 marks. Sections: A (MCQ, 10x1), B (Short, 5x2), C (Long, 3x5), D (Application, 3x5). Mark difficulty (Easy/Med/Hard). Provide answer key at the end. {body.extra or ''}"
    elif body.task == "assignment":
        prompt = f"Create a homework assignment for Grade {body.grade} {body.subject} on '{body.topic}'. 8 questions of mixed difficulty, ~30 minutes. {body.extra or ''}"
    else:  # report_comment
        prompt = f"Write 5 personalized, encouraging report card comments for a Grade {body.grade} student in {body.subject}. Cover: strengths, areas to improve, behavioral note, parent suggestion. Topic context: {body.topic or 'general performance'}. {body.extra or ''}"
    out = await ai_complete(sys_msg, prompt, session_id=f"teacher-{user['id']}")
    return {"output": out, "task": body.task}


@api.post("/ai/parent-chat")
async def ai_parent(body: AIChatRequest, user=Depends(get_current_user)):
    # Build small context: fetch parent's children + last attendance + fees
    ctx_lines = []
    if user["role"] == "parent":
        kids = await db.students.find({"parent_email": user["email"]}, {"_id": 0}).to_list(10)
        for k in kids:
            att = await db.attendance.find({"student_id": k["id"]}, {"_id": 0}).to_list(200)
            present = sum(1 for a in att if a["status"] == "present")
            pct = round((present / len(att)) * 100, 1) if att else 0
            fees = await db.fees.find({"student_id": k["id"], "status": "pending"}, {"_id": 0}).to_list(20)
            pending = sum(f["amount"] for f in fees)
            ctx_lines.append(f"- {k['name']} (Class {k['class_id']}-{k['section']}, Roll {k['roll_no']}): attendance {pct}% ({len(att)} days), pending fees ₹{pending}")
    elif user["role"] == "student":
        sid = user.get("meta", {}).get("student_id")
        if sid:
            s = await db.students.find_one({"id": sid}, {"_id": 0})
            if s:
                ctx_lines.append(f"- You: {s['name']}, Class {s['class_id']}-{s['section']}, Roll {s['roll_no']}")
    ctx = "\n".join(ctx_lines) if ctx_lines else "(no specific child context available)"
    sys_msg = (
        "You are AI Saathi, a warm, helpful school assistant for Indian parents and students. "
        "Answer in a friendly, concise manner. If asked about academics, attendance, or fees, "
        "use the provided context. If info is missing, say so politely. Keep answers under 120 words."
    )
    prompt = f"Context:\n{ctx}\n\nQuestion: {body.message}"
    out = await ai_complete(sys_msg, prompt, session_id=body.session_id)
    # store
    await db.ai_chats.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "session_id": body.session_id,
        "q": body.message, "a": out, "created_at": now_iso(),
    })
    return {"reply": out}


@api.post("/ai/insights")
async def ai_insights(payload: Dict[str, Any], user=Depends(require_roles("school_admin", "super_admin", "teacher"))):
    # generates an executive summary from current school stats
    stats = await dashboard_stats(user)
    sys_msg = "You are an Indian school operations analyst. Produce a crisp executive intelligence brief in 5 bullet points + 1 risk flag. Use plain English suitable for a principal."
    prompt = f"Analyze this school data JSON and produce insights:\n{stats}"
    out = await ai_complete(sys_msg, prompt, session_id=f"insights-{user['id']}")
    return {"insights": out, "stats": stats}


# =========================================================
# Seed
# =========================================================
@api.post("/seed")
async def seed_data():
    """Idempotent seed of demo accounts, classes, students, marks, attendance, fees, circulars."""
    # If already seeded skip
    has_admin = await db.users.find_one({"email": "admin@aischool.io"})
    if has_admin:
        return {"ok": True, "msg": "already-seeded"}

    SCHOOL = "default-school"

    # Users
    users_seed = [
        ("super@aischool.io", "Pass@1234", "Aarav Mehta", "super_admin"),
        ("admin@aischool.io", "Pass@1234", "Priya Sharma", "school_admin"),
        ("teacher@aischool.io", "Pass@1234", "Rohit Iyer", "teacher"),
        ("student@aischool.io", "Pass@1234", "Ananya Reddy", "student"),
        ("parent@aischool.io", "Pass@1234", "Sunita Reddy", "parent"),
    ]
    user_ids: Dict[str, str] = {}
    for email, pwd, name, role in users_seed:
        uid = str(uuid.uuid4())
        user_ids[role] = uid
        await db.users.insert_one({
            "id": uid, "email": email, "password": _hash_pwd(pwd),
            "name": name, "role": role, "school_id": SCHOOL, "avatar": None,
            "meta": {}, "created_at": now_iso(),
        })

    # Classes
    classes = []
    for cls in ["6", "7", "8", "9", "10"]:
        for sec in ["A", "B"]:
            classes.append({
                "id": f"cls-{cls}{sec}", "name": f"Class {cls}-{sec}",
                "grade": cls, "section": sec, "school_id": SCHOOL,
            })
    await db.classes.insert_many(classes)

    # Students (sample 30)
    sample_names = [
        "Aarav Verma","Vivaan Kapoor","Aditya Nair","Ishaan Joshi","Ayaan Khan",
        "Krishna Patel","Arjun Rao","Reyansh Singh","Karthik Menon","Aryan Gupta",
        "Ananya Reddy","Diya Iyer","Saanvi Pillai","Aadhya Bose","Myra Ghosh",
        "Aarohi Kulkarni","Anika Das","Pari Sinha","Riya Banerjee","Kiara Joshi",
        "Vihaan Shah","Atharv Pandey","Dhruv Mehta","Kabir Rao","Yash Naidu",
        "Tara Mukherjee","Navya Sen","Ira Bhat","Kavya Hegde","Sara Khanna",
    ]
    students = []
    for i, n in enumerate(sample_names):
        cls = ["6","7","8","9","10"][i % 5]
        sec = ["A","B"][i % 2]
        sid = str(uuid.uuid4())
        students.append({
            "id": sid, "name": n, "roll_no": str(i+1),
            "class_id": f"cls-{cls}{sec}", "section": sec,
            "gender": "F" if i % 2 == 0 else "M",
            "dob": "2010-06-15", "school_id": SCHOOL,
            "parent_email": "parent@aischool.io" if n == "Ananya Reddy" else None,
            "parent_phone": "+91-9000000000", "address": "Hyderabad, India",
            "house": ["Eagle","Tiger","Lion","Falcon"][i % 4],
            "category": "GEN",
            "created_at": now_iso(),
        })
    await db.students.insert_many(students)
    ananya = next(s for s in students if s["name"] == "Ananya Reddy")
    # link student account -> ananya
    await db.users.update_one({"id": user_ids["student"]}, {"$set": {"meta": {"student_id": ananya["id"]}}})

    # Attendance (last 14 days x all students, mostly present)
    import random
    today = datetime.now(timezone.utc).date()
    att_docs = []
    for d in range(14):
        day = (today - timedelta(days=d)).isoformat()
        for s in students:
            r = random.random()
            status = "present" if r < 0.88 else ("late" if r < 0.94 else "absent")
            att_docs.append({
                "id": str(uuid.uuid4()), "class_id": s["class_id"], "date": day,
                "student_id": s["id"], "status": status, "marked_by": user_ids["teacher"],
                "created_at": now_iso(),
            })
    await db.attendance.insert_many(att_docs)

    # Exams + marks
    subjects = ["Mathematics", "Science", "English", "Social Studies", "Hindi"]
    exam = {
        "id": "exam-q1", "name": "Quarterly Exam - 2026", "type": "quarterly",
        "class_id": "cls-9A", "subjects": subjects,
        "start_date": "2026-01-15", "end_date": "2026-01-25", "created_at": now_iso(),
    }
    await db.exams.insert_one(exam)
    mark_docs = []
    for s in students:
        for sub in subjects:
            mark_docs.append({
                "id": str(uuid.uuid4()), "exam_id": "exam-q1",
                "student_id": s["id"], "subject": sub,
                "marks": round(random.uniform(55, 95), 1), "max_marks": 100,
                "created_at": now_iso(),
            })
    await db.marks.insert_many(mark_docs)

    # Fees
    fee_docs = []
    for s in students:
        for term in ["Term 1", "Term 2", "Term 3"]:
            paid = random.random() < 0.55
            fee_docs.append({
                "id": str(uuid.uuid4()), "student_id": s["id"], "term": term,
                "amount": 15000, "due_date": "2026-03-31", "type": "tuition",
                "status": "paid" if paid else "pending",
                "paid_at": now_iso() if paid else None,
                "method": "upi" if paid else None,
                "receipt_no": f"RCPT-{uuid.uuid4().hex[:8].upper()}" if paid else None,
                "created_at": now_iso(),
            })
    await db.fees.insert_many(fee_docs)

    # Circulars
    circs = [
        {"title": "Annual Day Celebration", "body": "Annual Day will be held on Feb 28, 2026. All students must report by 4pm in school uniform.", "audience": "all"},
        {"title": "Quarterly Exam Schedule Released", "body": "Quarterly Exam timetable is now available in the Exams module. Please review and prepare accordingly.", "audience": "students"},
        {"title": "PTM This Saturday", "body": "Parent-Teacher Meeting on Saturday between 10am – 1pm. Please book a slot.", "audience": "parents"},
    ]
    for c in circs:
        await db.circulars.insert_one({
            "id": str(uuid.uuid4()), **c,
            "author": "Priya Sharma", "author_role": "school_admin",
            "created_at": now_iso(),
        })

    return {"ok": True, "msg": "seeded", "users": len(users_seed), "students": len(students)}


# =========================================================
# Mount + middleware + startup
# =========================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    # auto-seed once
    try:
        await db.users.create_index("email", unique=True)
        await db.students.create_index("id", unique=True)
        # auto-seed if no users exist
        count = await db.users.count_documents({})
        if count == 0:
            await seed_data()
            logger.info("Auto-seeded demo data")
    except Exception as e:
        logger.exception("startup error: %s", e)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
