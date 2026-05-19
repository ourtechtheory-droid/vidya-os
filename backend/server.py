"""
AI School OS - FastAPI Backend
Multi-role ERP + AI Intelligence Platform for Indian schools.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, secrets, string, re
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
    section: Optional[str] = ""
    gender: Literal["M", "F", "O"] = "M"
    dob: Optional[str] = None
    parent_email: Optional[EmailStr] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    house: Optional[str] = None
    category: Optional[str] = None
    profile_image: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    roll_no: Optional[str] = None
    class_id: Optional[str] = None
    section: Optional[str] = None
    gender: Optional[Literal["M", "F", "O"]] = None
    dob: Optional[str] = None
    parent_email: Optional[EmailStr] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    house: Optional[str] = None
    category: Optional[str] = None
    profile_image: Optional[str] = None

class ClassCreate(BaseModel):
    grade: Optional[str] = None
    section: Optional[str] = ""
    name: Optional[str] = None
    number_of_students: Optional[int] = None
    periods_per_day: Optional[int] = None
    subjects: List[str] = Field(default_factory=list)


class ClassDeleteConfirm(BaseModel):
    confirmation_sentence: str


class TeacherCreate(BaseModel):
    name: str
    phone_number: str
    gender: Literal["M", "F", "O"] = "M"
    assigned_class_id: str
    core_subject: str
    profile_image: Optional[str] = None


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[Literal["M", "F", "O"]] = None
    assigned_class_id: Optional[str] = None
    core_subject: Optional[str] = None
    profile_image: Optional[str] = None


class CalendarEvent(BaseModel):
    title: str
    date: str  # YYYY-MM-DD
    type: Literal["exam", "lesson_plan", "other"] = "other"
    description: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    type: Optional[Literal["exam", "lesson_plan", "other"]] = None
    description: Optional[str] = None

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
    class_id: str
    subject: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    syllabus: Optional[str] = None
    exam_date: Optional[str] = None
    time: Optional[str] = None
    type: Literal["unit_test", "quarterly", "half_yearly", "pre_final", "final", "practical"] = "unit_test"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ExamStatusUpdate(BaseModel):
    status: Literal["scheduled", "under_correction", "results_out"]


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


CLASS_DELETE_CONFIRMATIONS = {
    "I understand this class will be deleted from VidyaOS.",
    "Delete this class after checking all linked school records.",
    "I confirm this class deletion is intentional.",
    "This class is no longer needed in the school records.",
    "Proceed with deleting this class from the admin panel.",
}


def _temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", ".", text.lower()).strip(".")
    return cleaned or "teacher"


async def _teacher_profile_for_user(user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if user.get("role") != "teacher":
        return None
    profile = await db.teacher_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if profile:
        return profile
    meta = user.get("meta") or {}
    if meta.get("assigned_class_id"):
        return {
            "user_id": user["id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "assigned_class_id": meta.get("assigned_class_id"),
            "core_subject": meta.get("core_subject"),
            "profile_image": user.get("avatar"),
        }
    return None


async def _ensure_demo_teacher_profile():
    teacher = await db.users.find_one({"email": "teacher@aischool.io"}, {"_id": 0})
    klass = await db.classes.find_one({"id": "cls-9A"}, {"_id": 0})
    if not teacher or not klass:
        return
    existing = await db.teacher_profiles.find_one({"user_id": teacher["id"]}, {"_id": 0})
    if existing:
        return
    meta = {
        "assigned_class_id": "cls-9A",
        "phone_number": "+91-9000000001",
        "gender": "M",
        "core_subject": "Mathematics",
    }
    await db.users.update_one({"id": teacher["id"]}, {"$set": {"meta": meta}})
    await db.teacher_profiles.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": teacher["id"],
        "email": teacher["email"],
        "name": teacher["name"],
        "phone_number": meta["phone_number"],
        "gender": meta["gender"],
        "assigned_class_id": meta["assigned_class_id"],
        "core_subject": meta["core_subject"],
        "profile_image": teacher.get("avatar"),
        "created_by": teacher["id"],
        "created_at": now_iso(),
    })


async def _classes_with_summary(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    classes = await db.classes.find(query, {"_id": 0}).sort("grade", 1).to_list(500)
    out = []
    for klass in classes:
        teacher = await db.teacher_profiles.find_one({"assigned_class_id": klass["id"]}, {"_id": 0})
        count = await db.students.count_documents({"class_id": klass["id"]})
        out.append({
            **klass,
            "class_teacher": teacher,
            "students_count": count,
        })
    return out


async def _ensure_class_teachers_and_rosters():
    classes = await db.classes.find({}, {"_id": 0}).to_list(500)
    if not classes:
        return {"classes": 0, "teachers_created": 0, "students_created": 0}

    first_names = [
        "Aarav", "Vivaan", "Aditya", "Ishaan", "Ayaan", "Krishna", "Arjun", "Reyansh", "Karthik", "Aryan",
        "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Aarohi", "Anika", "Pari", "Riya", "Kiara",
    ]
    last_names = [
        "Verma", "Kapoor", "Nair", "Joshi", "Khan", "Patel", "Rao", "Singh", "Menon", "Gupta",
        "Reddy", "Iyer", "Pillai", "Bose", "Ghosh", "Kulkarni", "Das", "Sinha", "Banerjee", "Shah",
    ]
    teacher_names = [
        "Rohit Iyer", "Meera Nair", "Kabir Sharma", "Nisha Rao", "Arvind Menon",
        "Farah Khan", "Devika Pillai", "Sanjay Patel", "Leela Bose", "Harish Gupta",
    ]
    subjects = ["Mathematics", "Science", "English", "Social Studies", "Hindi", "Computer Science"]
    today = datetime.now(timezone.utc).date()
    teachers_created = 0
    students_created = 0

    admin = await db.users.find_one({"role": "school_admin"}, {"_id": 0})
    created_by = admin["id"] if admin else "system"

    for idx, klass in enumerate(classes):
        teacher = await db.teacher_profiles.find_one({"assigned_class_id": klass["id"]}, {"_id": 0})
        if not teacher:
            teacher_name = teacher_names[idx % len(teacher_names)]
            email = f"classteacher.{klass['id'].lower()}@vidyaos.teacher"
            n = 2
            base_email = email
            while await db.users.find_one({"email": email}, {"_id": 0}):
                email = base_email.replace("@", f"{n}@")
                n += 1
            user_id = str(uuid.uuid4())
            subject = subjects[idx % len(subjects)]
            await db.users.insert_one({
                "id": user_id,
                "email": email,
                "password": _hash_pwd("Pass@1234"),
                "name": teacher_name,
                "role": "teacher",
                "school_id": klass.get("school_id", "default-school"),
                "avatar": None,
                "meta": {
                    "assigned_class_id": klass["id"],
                    "phone_number": f"+91-90000{idx:05d}",
                    "gender": "F" if idx % 2 else "M",
                    "core_subject": subject,
                },
                "created_at": now_iso(),
            })
            await db.teacher_profiles.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "email": email,
                "name": teacher_name,
                "phone_number": f"+91-90000{idx:05d}",
                "gender": "F" if idx % 2 else "M",
                "assigned_class_id": klass["id"],
                "core_subject": subject,
                "profile_image": None,
                "created_by": created_by,
                "created_at": now_iso(),
            })
            teachers_created += 1

        current = await db.students.count_documents({"class_id": klass["id"]})
        if current >= 20:
            continue
        existing_students = await db.students.find({"class_id": klass["id"]}, {"_id": 0, "roll_no": 1}).to_list(100)
        existing_rolls = {str(s.get("roll_no")) for s in existing_students}
        candidate_rolls = [str(n) for n in range(1, 41) if str(n) not in existing_rolls]
        new_students = []
        for roll_no in candidate_rolls[:20 - current]:
            sid = str(uuid.uuid4())
            roll = int(roll_no)
            name = f"{first_names[(roll + idx) % len(first_names)]} {last_names[(roll + idx * 3) % len(last_names)]}"
            new_students.append({
                "id": sid,
                "name": name,
                "roll_no": roll_no,
                "class_id": klass["id"],
                "section": klass.get("section", ""),
                "gender": "F" if roll % 2 == 0 else "M",
                "dob": "2011-06-15",
                "school_id": klass.get("school_id", "default-school"),
                "parent_email": None,
                "parent_phone": "+91-9000000000",
                "address": "Hyderabad, India",
                "house": ["Eagle", "Tiger", "Lion", "Falcon"][roll % 4],
                "category": "GEN",
                "created_by": created_by,
                "created_at": now_iso(),
            })
        if new_students:
            await db.students.insert_many(new_students)
            students_created += len(new_students)
            att_docs = []
            fee_docs = []
            for d in range(14):
                day = (today - timedelta(days=d)).isoformat()
                for pos, student in enumerate(new_students):
                    status = "absent" if (pos + d) % 17 == 0 else ("late" if (pos + d) % 11 == 0 else "present")
                    att_docs.append({
                        "id": str(uuid.uuid4()),
                        "class_id": student["class_id"],
                        "date": day,
                        "student_id": student["id"],
                        "status": status,
                        "marked_by": created_by,
                        "created_at": now_iso(),
                    })
            for student in new_students:
                for term in ["Term 1", "Term 2", "Term 3"]:
                    fee_docs.append({
                        "id": str(uuid.uuid4()),
                        "student_id": student["id"],
                        "term": term,
                        "amount": 15000,
                        "due_date": "2026-03-31",
                        "type": "tuition",
                        "status": "pending",
                        "paid_at": None,
                        "method": None,
                        "receipt_no": None,
                        "created_at": now_iso(),
                    })
            if att_docs:
                await db.attendance.insert_many(att_docs)
            if fee_docs:
                await db.fees.insert_many(fee_docs)

    return {"classes": len(classes), "teachers_created": teachers_created, "students_created": students_created}


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
async def list_classes(unassigned_only: bool = False, user=Depends(get_current_user)):
    profile = await _teacher_profile_for_user(user)
    if profile:
        return await _classes_with_summary({"id": profile.get("assigned_class_id", "")})
    classes = await _classes_with_summary({})
    if unassigned_only:
        classes = [c for c in classes if not c.get("class_teacher")]
    return classes


@api.post("/classes")
async def create_class(body: ClassCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    grade = (body.grade or body.name or "").strip()
    section = (body.section or "").strip().upper()
    class_name = (body.name or "").strip()
    if not grade and not class_name:
        raise HTTPException(400, "Class name is required")
    class_id = f"cls-{re.sub(r'[^A-Za-z0-9]+', '', grade)}{section}"
    existing = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Class already exists")
    subjects = [s.strip() for s in body.subjects if s.strip()]
    c = {
        "id": class_id,
        "name": class_name or (f"Class {grade}-{section}" if section else f"Class {grade}"),
        "grade": grade,
        "section": section,
        "number_of_students": body.number_of_students or 0,
        "periods_per_day": body.periods_per_day or 0,
        "subjects": subjects,
        "school_id": user.get("school_id", "default-school"),
        "created_at": now_iso(),
    }
    await db.classes.insert_one(c)
    return {k: v for k, v in c.items() if k != "_id"}


@api.delete("/classes/{class_id}")
async def delete_class(class_id: str, body: ClassDeleteConfirm, user=Depends(require_roles("super_admin", "school_admin"))):
    if body.confirmation_sentence not in CLASS_DELETE_CONFIRMATIONS:
        raise HTTPException(400, "Confirmation sentence did not match")
    existing = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Class not found")
    await db.classes.delete_one({"id": class_id})
    return {"ok": True, "deleted_class_id": class_id}


@api.get("/teachers")
async def list_teachers(user=Depends(require_roles("super_admin", "school_admin"))):
    teachers = await db.teacher_profiles.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    classes = {c["id"]: c for c in await db.classes.find({}, {"_id": 0}).to_list(500)}
    out = []
    for t in teachers:
        class_id = t.get("assigned_class_id")
        students_count = await db.students.count_documents({"class_id": class_id})
        attendance = await db.attendance.find({"class_id": class_id}, {"_id": 0}).to_list(5000)
        total = len(attendance)
        present = sum(1 for a in attendance if a.get("status") == "present")
        out.append({
            **t,
            "assigned_class": classes.get(class_id),
            "students_count": students_count,
            "attendance_pct": round((present / total) * 100, 1) if total else 0,
            "attendance_total": total,
        })
    return out


@api.post("/teachers")
async def create_teacher(body: TeacherCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    assigned_class = await db.classes.find_one({"id": body.assigned_class_id}, {"_id": 0})
    if not assigned_class:
        raise HTTPException(404, "Assigned class not found")
    existing_teacher = await db.teacher_profiles.find_one({"assigned_class_id": body.assigned_class_id}, {"_id": 0})
    if existing_teacher:
        raise HTTPException(400, "This class already has an assigned teacher")

    base = _slug(body.name)
    domain = "vidyaos.teacher"
    email = f"{base}@{domain}"
    n = 2
    while await db.users.find_one({"email": email}, {"_id": 0}):
        email = f"{base}{n}@{domain}"
        n += 1

    password = _temp_password()
    user_id = str(uuid.uuid4())
    teacher_user = {
        "id": user_id,
        "email": email,
        "password": _hash_pwd(password),
        "name": body.name,
        "role": "teacher",
        "school_id": user.get("school_id", "default-school"),
        "avatar": body.profile_image,
        "meta": {
            "phone_number": body.phone_number,
            "gender": body.gender,
            "assigned_class_id": body.assigned_class_id,
            "core_subject": body.core_subject,
        },
        "created_at": now_iso(),
    }
    profile = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": email,
        "name": body.name,
        "phone_number": body.phone_number,
        "gender": body.gender,
        "assigned_class_id": body.assigned_class_id,
        "core_subject": body.core_subject,
        "profile_image": body.profile_image,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.users.insert_one(teacher_user)
    await db.teacher_profiles.insert_one(profile)
    public_user = {k: v for k, v in teacher_user.items() if k not in ("password", "_id")}
    return {
        "teacher": {k: v for k, v in profile.items() if k != "_id"},
        "user": public_user,
        "credentials": {"email": email, "password": password},
    }


@api.put("/teachers/{teacher_id}")
async def update_teacher(teacher_id: str, body: TeacherUpdate, user=Depends(require_roles("super_admin", "school_admin"))):
    teacher_prof = await db.teacher_profiles.find_one({"id": teacher_id})
    if not teacher_prof:
        raise HTTPException(404, "Teacher not found")
        
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        return {"ok": True}

    if "assigned_class_id" in update_data:
        assigned_class = await db.classes.find_one({"id": update_data["assigned_class_id"]}, {"_id": 0})
        if not assigned_class:
            raise HTTPException(404, "Assigned class not found")
        conflict = await db.teacher_profiles.find_one({
            "assigned_class_id": update_data["assigned_class_id"],
            "id": {"$ne": teacher_id},
        }, {"_id": 0})
        if conflict:
            raise HTTPException(400, "This class already has an assigned teacher")
        
    await db.teacher_profiles.update_one({"id": teacher_id}, {"$set": update_data})
    
    # Sync with users collection
    user_update = {}
    if "name" in update_data: user_update["name"] = update_data["name"]
    if "profile_image" in update_data: user_update["avatar"] = update_data["profile_image"]
    if "phone_number" in update_data: user_update["meta.phone_number"] = update_data["phone_number"]
    if "assigned_class_id" in update_data: user_update["meta.assigned_class_id"] = update_data["assigned_class_id"]
    if "gender" in update_data: user_update["meta.gender"] = update_data["gender"]
    if "core_subject" in update_data: user_update["meta.core_subject"] = update_data["core_subject"]
    
    if user_update:
        await db.users.update_one({"id": teacher_prof["user_id"]}, {"$set": user_update})
        
    return {"ok": True}


@api.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    teacher_prof = await db.teacher_profiles.find_one({"id": teacher_id})
    if teacher_prof:
        await db.users.delete_one({"id": teacher_prof["user_id"]})
        await db.teacher_profiles.delete_one({"id": teacher_id})
    return {"ok": True}


@api.post("/students")
async def create_student(body: StudentCreate, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    s = body.model_dump()
    assigned_profile = await _teacher_profile_for_user(user)
    if assigned_profile and s["class_id"] != assigned_profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers can add students only to their assigned class")
    cls = await db.classes.find_one({"id": s["class_id"]}, {"_id": 0})
    if not cls:
        raise HTTPException(404, "Class not found")
    if not s.get("section"):
        s["section"] = cls.get("section", "")
    s["id"] = str(uuid.uuid4())
    s["school_id"] = user.get("school_id", "default-school")
    s["created_by"] = user["id"]
    s["created_at"] = now_iso()
    await db.students.insert_one(s)
    return {k: v for k, v in s.items() if k != "_id"}


@api.get("/students")
async def list_students(class_id: Optional[str] = None, skip: int = 0, limit: int = 100, user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if class_id:
        q["class_id"] = class_id
    assigned_profile = await _teacher_profile_for_user(user)
    if assigned_profile:
        q["class_id"] = assigned_profile.get("assigned_class_id", "")
    if user["role"] == "parent":
        # parent sees only their child(ren)
        q["parent_email"] = user["email"]
    if user["role"] == "student":
        q["id"] = user.get("meta", {}).get("student_id", "")
    return await db.students.find(q, {"_id": 0}).skip(skip).limit(limit).to_list(limit)


@api.put("/students/{student_id}")
async def update_student(student_id: str, body: StudentUpdate, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(404, "Student not found")
    assigned_profile = await _teacher_profile_for_user(user)
    if assigned_profile:
        assigned_class_id = assigned_profile.get("assigned_class_id")
        if student.get("class_id") != assigned_class_id:
            raise HTTPException(403, "Teachers can edit students only in their assigned class")
        
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        return {"ok": True}
    if assigned_profile and update_data.get("class_id") and update_data["class_id"] != assigned_profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers cannot move students out of their assigned class")
    if update_data.get("class_id"):
        cls = await db.classes.find_one({"id": update_data["class_id"]}, {"_id": 0})
        if not cls:
            raise HTTPException(404, "Class not found")
        if "section" not in update_data:
            update_data["section"] = cls.get("section", "")
    if user["role"] in ("super_admin", "school_admin"):
        update_data["admin_edited"] = True
        update_data["admin_edited_by"] = user["name"]
        update_data["admin_edited_at"] = now_iso()
        
    await db.students.update_one({"id": student_id}, {"$set": update_data})
    return {"ok": True}


@api.delete("/students/{student_id}")
async def delete_student(student_id: str, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    assigned_profile = await _teacher_profile_for_user(user)
    if assigned_profile and student.get("class_id") != assigned_profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers can delete students only in their assigned class")
    await db.students.delete_one({"id": student_id})
    await db.attendance.delete_many({"student_id": student_id})
    await db.marks.delete_many({"student_id": student_id})
    await db.fees.delete_many({"student_id": student_id})
    return {"ok": True}


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
    profile = await _teacher_profile_for_user(user)
    if profile and body.class_id != profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers can mark attendance only for their assigned class")
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
    profile = await _teacher_profile_for_user(user)
    if profile:
        q["class_id"] = profile.get("assigned_class_id", "")
    if student_id:
        q["student_id"] = student_id
    return await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


# =========================================================
# Exams / Marks
# =========================================================
@api.post("/exams")
async def create_exam(body: ExamCreate, user=Depends(require_roles("school_admin", "super_admin", "teacher"))):
    e = body.model_dump()
    profile = await _teacher_profile_for_user(user)
    if profile and e["class_id"] != profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers can create exams only for their assigned class")
    if not await db.classes.find_one({"id": e["class_id"]}, {"_id": 0}):
        raise HTTPException(404, "Class not found")
    if e.get("subject") and e["subject"] not in e["subjects"]:
        e["subjects"] = [e["subject"], *e["subjects"]]
    if not e["subjects"]:
        raise HTTPException(400, "At least one subject is required")
    e["subject"] = e.get("subject") or e["subjects"][0]
    e["exam_date"] = e.get("exam_date") or e.get("start_date") or now_iso()[:10]
    e["start_date"] = e.get("start_date") or e["exam_date"]
    e["end_date"] = e.get("end_date") or e["exam_date"]
    e["id"] = str(uuid.uuid4())
    e["status"] = "scheduled"
    e["created_by"] = user["id"]
    e["created_by_name"] = user["name"]
    e["created_at"] = now_iso()
    await db.exams.insert_one(e)
    return {k: v for k, v in e.items() if k != "_id"}


@api.get("/exams")
async def list_exams(user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    profile = await _teacher_profile_for_user(user)
    if profile:
        q["class_id"] = profile.get("assigned_class_id", "")
    elif user["role"] == "student":
        sid = user.get("meta", {}).get("student_id")
        student = await db.students.find_one({"id": sid}, {"_id": 0}) if sid else None
        q["class_id"] = student.get("class_id", "") if student else ""
    elif user["role"] == "parent":
        kids = await db.students.find({"parent_email": user["email"]}, {"_id": 0}).to_list(50)
        q["class_id"] = {"$in": [k["class_id"] for k in kids]}
    return await db.exams.find(q, {"_id": 0}).sort("exam_date", -1).to_list(500)


@api.patch("/exams/{exam_id}/status")
async def update_exam_status(exam_id: str, body: ExamStatusUpdate, user=Depends(require_roles("school_admin", "super_admin", "teacher"))):
    exam = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(404, "Exam not found")
    profile = await _teacher_profile_for_user(user)
    if profile and exam.get("class_id") != profile.get("assigned_class_id"):
        raise HTTPException(403, "Teachers can update exams only for their assigned class")
    await db.exams.update_one({"id": exam_id}, {"$set": {"status": body.status, "status_updated_at": now_iso()}})
    updated = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    return updated


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
    q: Dict[str, Any] = {}
    if user["role"] == "teacher":
        q["audience"] = {"$in": ["all", "teachers"]}
    elif user["role"] == "student":
        q["audience"] = {"$in": ["all", "students"]}
    elif user["role"] == "parent":
        q["audience"] = {"$in": ["all", "parents"]}
    return await db.circulars.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


# =========================================================
# Calendar Events
# =========================================================
@api.post("/calendar")
async def create_calendar_event(body: CalendarEvent, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    ev = body.model_dump()
    ev["id"] = str(uuid.uuid4())
    ev["user_id"] = user["id"]
    ev["created_at"] = now_iso()
    await db.calendar_events.insert_one(ev)
    return {k: v for k, v in ev.items() if k != "_id"}


@api.get("/calendar")
async def list_calendar_events(user=Depends(get_current_user)):
    q = {}
    if user["role"] == "teacher":
        q["user_id"] = user["id"]
    return await db.calendar_events.find(q, {"_id": 0}).sort("date", 1).to_list(1000)


@api.put("/calendar/{event_id}")
async def update_calendar_event(event_id: str, body: CalendarEventUpdate, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    q = {"id": event_id}
    if user["role"] == "teacher":
        q["user_id"] = user["id"]
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        return {"ok": True}
    update_data["updated_at"] = now_iso()
    res = await db.calendar_events.update_one(q, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(404, "Event not found or not authorized")
    return await db.calendar_events.find_one({"id": event_id}, {"_id": 0})


@api.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: str, user=Depends(require_roles("teacher", "school_admin", "super_admin"))):
    q = {"id": event_id}
    if user["role"] == "teacher":
        q["user_id"] = user["id"]
    res = await db.calendar_events.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(404, "Event not found or not authorized")
    return {"ok": True}


# =========================================================
# Dashboard stats
# =========================================================
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    profile = await _teacher_profile_for_user(user)
    
    # Role-based query scoping
    student_query = {}
    fee_query = {}
    att_query = {}
    mark_query = {}
    if profile:
        class_id = profile.get("assigned_class_id")
        student_query = {"class_id": class_id}
        class_student_ids = [s["id"] for s in await db.students.find({"class_id": class_id}, {"_id": 0, "id": 1}).to_list(None)]
        fee_query = {"student_id": {"$in": class_student_ids}}
        att_query = {"class_id": class_id}
        mark_query = {"student_id": {"$in": class_student_ids}}

    students_count = await db.students.count_documents(student_query)
    teachers_count = await db.users.count_documents({"role": "teacher"})
    classes_count = await db.classes.count_documents({})
    
    fees_paid = await db.fees.count_documents({**fee_query, "status": "paid"})
    fees_pending = await db.fees.count_documents({**fee_query, "status": "pending"})
    
    fees_paid_amt_cur = db.fees.aggregate([
        {"$match": {**fee_query, "status": "paid"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}
    ])
    fees_paid_amt = 0
    async for d in fees_paid_amt_cur:
        fees_paid_amt = d["s"]
        
    fees_pending_amt_cur = db.fees.aggregate([
        {"$match": {**fee_query, "status": "pending"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}
    ])
    fees_pending_amt = 0
    async for d in fees_pending_amt_cur:
        fees_pending_amt = d["s"]

    # Today's attendance specific to role
    today_str = now_iso()[:10]
    today_att = await db.attendance.find({**att_query, "date": today_str}).to_list(None)
    today_present = sum(1 for a in today_att if a["status"] == "present")
    today_total = len(today_att) or students_count
    today_present_rate = round((today_present / today_total) * 100, 1) if today_total > 0 else 0

    # attendance by date (last 14 days)
    att = await db.attendance.find(att_query, {"_id": 0}).to_list(5000)
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
        {"$match": mark_query},
        {"$group": {"_id": "$subject", "avg": {"$avg": {"$multiply": [{"$divide": ["$marks", "$max_marks"]}, 100]}}}},
        {"$sort": {"avg": -1}},
    ]
    subj = []
    async for d in db.marks.aggregate(pipe):
        subj.append({"subject": d["_id"], "avg": round(d["avg"], 1)})

    merit_pipe = [
        {"$match": mark_query},
        {"$group": {"_id": "$student_id", "marks": {"$sum": "$marks"}, "max_marks": {"$sum": "$max_marks"}}},
        {"$project": {"pct": {"$multiply": [{"$divide": ["$marks", "$max_marks"]}, 100]}}},
        {"$bucket": {
            "groupBy": "$pct",
            "boundaries": [0, 40, 60, 75, 90, 101],
            "default": "Other",
            "output": {"count": {"$sum": 1}, "avg": {"$avg": "$pct"}},
        }},
    ]
    merit_labels = {
        0: "Below 40%",
        40: "40-59%",
        60: "60-74%",
        75: "75-89%",
        90: "90%+",
    }
    merit_breakdown = []
    merit_percentages = []
    async for d in db.marks.aggregate(merit_pipe):
        label = merit_labels.get(d["_id"], str(d["_id"]))
        avg = round(d.get("avg") or 0, 1)
        merit_breakdown.append({"range": label, "count": d.get("count", 0), "avg": avg})
        merit_percentages.append(avg)
    merit_percentage = round(sum(merit_percentages) / len(merit_percentages), 1) if merit_percentages else 0

    teacher_context = None
    profile = await _teacher_profile_for_user(user)
    if profile:
        assigned_class = await db.classes.find_one({"id": profile.get("assigned_class_id")}, {"_id": 0})
        teacher_context = {
            "name": profile.get("name") or user.get("name"),
            "core_subject": profile.get("core_subject"),
            "assigned_class": assigned_class,
            "profile_image": profile.get("profile_image"),
        }

    exam_query: Dict[str, Any] = {}
    if user["role"] == "student":
        sid = user.get("meta", {}).get("student_id")
        student = await db.students.find_one({"id": sid}, {"_id": 0}) if sid else None
        exam_query["class_id"] = student.get("class_id", "") if student else ""
    elif user["role"] == "parent":
        kids = await db.students.find({"parent_email": user["email"]}, {"_id": 0}).to_list(50)
        exam_query["class_id"] = {"$in": [k["class_id"] for k in kids]}
    elif profile:
        exam_query["class_id"] = profile.get("assigned_class_id", "")
    recent_exams = await db.exams.find(exam_query, {"_id": 0}).sort("exam_date", -1).to_list(5)

    return {
        "counts": {
            "students": students_count, "teachers": teachers_count, "classes": classes_count,
            "fees_paid": fees_paid, "fees_pending": fees_pending,
            "fees_paid_amount": fees_paid_amt, "fees_pending_amount": fees_pending_amt,
        },
        "today_attendance": {
            "date": today_str,
            "present": today_present,
            "total": today_total,
            "present_rate": today_present_rate,
        },
        "merit_percentage": merit_percentage,
        "merit_breakdown": merit_breakdown,
        "attendance_trend": attendance_trend,
        "subject_performance": subj,
        "teacher_context": teacher_context,
        "recent_exams": recent_exams,
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
        summary = await _ensure_class_teachers_and_rosters()
        return {"ok": True, "msg": "already-seeded", **summary}

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
    await db.users.update_one({"id": user_ids["teacher"]}, {"$set": {"meta": {
        "assigned_class_id": "cls-9A",
        "phone_number": "+91-9000000001",
        "gender": "M",
        "core_subject": "Mathematics",
    }}})
    await db.teacher_profiles.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_ids["teacher"],
        "email": "teacher@aischool.io",
        "name": "Rohit Iyer",
        "phone_number": "+91-9000000001",
        "gender": "M",
        "assigned_class_id": "cls-9A",
        "core_subject": "Mathematics",
        "profile_image": None,
        "created_by": user_ids["school_admin"],
        "created_at": now_iso(),
    })

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

    roster_summary = await _ensure_class_teachers_and_rosters()
    return {"ok": True, "msg": "seeded", "users": len(users_seed), "students": len(students) + roster_summary["students_created"], **roster_summary}


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
        await db.teacher_profiles.create_index("user_id", unique=True)
        # auto-seed if no users exist
        count = await db.users.count_documents({})
        if count == 0:
            await seed_data()
            logger.info("Auto-seeded demo data")
        else:
            await _ensure_demo_teacher_profile()
            summary = await _ensure_class_teachers_and_rosters()
            logger.info("Roster/class-teacher sync complete: %s", summary)
    except Exception as e:
        logger.exception("startup error: %s", e)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
