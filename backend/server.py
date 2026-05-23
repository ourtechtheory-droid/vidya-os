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
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
AI_MODEL_ANTHROPIC = os.environ.get('AI_MODEL_ANTHROPIC', 'claude-sonnet-4-6')
AI_MODEL_OPENAI = os.environ.get('AI_MODEL_OPENAI', 'gpt-4o-mini')
AUTO_SEED_DEMO_DATA = os.environ.get('AUTO_SEED_DEMO_DATA', 'false').lower() in ('1', 'true', 'yes', 'on')
SEED_DEFAULT_MESSAGE_TEMPLATES = os.environ.get('SEED_DEFAULT_MESSAGE_TEMPLATES', 'false').lower() in ('1', 'true', 'yes', 'on')

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
    blood_group: Optional[str] = None


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
    blood_group: Optional[str] = None

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


class TimetableGenerateRequest(BaseModel):
    class_id: str
    days: List[str] = Field(default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    periods_per_day: Optional[int] = None
    break_after_period: int = 4


class TimetableUpdate(BaseModel):
    entries: List[Dict[str, Any]]
    days: Optional[List[str]] = None
    periods_per_day: Optional[int] = None


class CommunicationCreate(BaseModel):
    audience: Literal["parents", "teachers", "students", "class", "section", "all"]
    channel: Literal["whatsapp", "sms", "zoho"] = "whatsapp"
    title: str
    body: str
    class_id: Optional[str] = None
    section: Optional[str] = None
    scheduled_at: Optional[str] = None
    category: Literal["general", "emergency", "attendance", "fees", "exam"] = "general"


# === New message platform models ===
Channel = Literal["whatsapp", "sms", "email"]
Audience = Literal["parents", "teachers", "students", "class", "section", "all", "custom"]
MessageCategory = Literal["general", "emergency", "attendance", "fees", "exam", "ptm"]


class MessageSendRequest(BaseModel):
    audience: Audience
    channel: Channel = "whatsapp"
    title: str
    body: str
    template_id: Optional[str] = None
    class_id: Optional[str] = None
    section: Optional[str] = None
    custom_recipient_ids: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    category: MessageCategory = "general"


class MessageTestRequest(BaseModel):
    to: str  # phone or email
    name: Optional[str] = "Test Recipient"


class MessageTemplateCreate(BaseModel):
    name: str
    channel: Channel = "whatsapp"
    category: MessageCategory = "general"
    body: str
    dlt_id: Optional[str] = None
    waba_id: Optional[str] = None


class MessageTemplateUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[Channel] = None
    category: Optional[MessageCategory] = None
    body: Optional[str] = None
    approval_status: Optional[Literal["approved", "pending_approval", "rejected"]] = None
    dlt_id: Optional[str] = None
    waba_id: Optional[str] = None


class OptOutCreate(BaseModel):
    channel: Channel
    contact: str  # phone or email
    reason: Optional[str] = None


class CertificateTemplateCreate(BaseModel):
    name: str
    type: Literal["achievement", "participation", "sports", "completion", "other"] = "achievement"
    design: Dict[str, Any] = Field(default_factory=dict)


class CertificateIssueRequest(BaseModel):
    template_id: str
    recipient_type: Literal["student", "teacher"] = "student"
    recipient_id: str
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    position: Optional[str] = None
    category: Optional[str] = None
    score: Optional[str] = None
    body_override: Optional[str] = None


class BulkCertificateIssueRequest(BaseModel):
    template_id: str
    recipient_type: Literal["student", "teacher"] = "student"
    recipient_ids: List[str]
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    category: Optional[str] = None
    position: Optional[str] = None
    score: Optional[str] = None
    body_override: Optional[str] = None


class CertificateRevokeRequest(BaseModel):
    reason: str


class IDCardBatchCreate(BaseModel):
    target_type: Literal["students", "teachers"] = "students"
    class_id: Optional[str] = None
    role: Optional[str] = None
    design: Dict[str, Any] = Field(default_factory=dict)


class CardReissueRequest(BaseModel):
    target_type: Literal["student", "teacher"] = "student"
    record_id: str
    reason: Optional[str] = "Lost card"


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
async def ai_complete(system: str, user_text: str, session_id: str = "default", max_tokens: int = 2048) -> str:
    """Provider-agnostic completion. Picks Anthropic first, then OpenAI.

    Returns plain text. `session_id` is accepted for API compatibility but the
    helper is stateless — callers that need conversation memory must include
    history in `user_text` themselves.
    """
    if ANTHROPIC_API_KEY:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            resp = await client.messages.create(
                model=AI_MODEL_ANTHROPIC,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user_text}],
            )
            parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
            return "\n".join(parts).strip() or "(AI returned no text.)"
        except Exception as e:
            logger.exception("Anthropic AI error")
            return f"(Anthropic call failed: {e})"

    if OPENAI_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model=AI_MODEL_OPENAI,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_text},
                ],
            )
            return (resp.choices[0].message.content or "").strip() or "(AI returned no text.)"
        except Exception as e:
            logger.exception("OpenAI AI error")
            return f"(OpenAI call failed: {e})"

    return _mock_ai_complete(system, user_text)


# ---------- Mock AI (used when no API key is configured) ----------
def _parse_after(text: str, keyword: str) -> Optional[str]:
    """Pull a quoted token after a keyword from a teacher-task prompt."""
    m = re.search(keyword + r"\s*['\"]([^'\"]+)['\"]", text, re.IGNORECASE)
    return m.group(1) if m else None


def _parse_grade_subject(text: str):
    g = re.search(r"Grade\s+([0-9A-Za-z\-]+)", text, re.IGNORECASE)
    s = re.search(r"Grade\s+[0-9A-Za-z\-]+\s+([A-Za-z ]+?)(?:\s+on|\s+topic|,|\.|$)", text, re.IGNORECASE)
    return (g.group(1) if g else "—"), (s.group(1).strip() if s else "the subject")


def _mock_lesson_plan(prompt: str) -> str:
    grade, subject = _parse_grade_subject(prompt)
    topic = _parse_after(prompt, "topic") or "the topic"
    return f"""# Lesson Plan — {subject} (Grade {grade})
**Topic:** {topic}  ·  **Duration:** 40 minutes

## Learning Objectives
By the end of the lesson, students will be able to:
- Explain the core idea of *{topic}* in their own words.
- Apply at least two strategies/methods related to *{topic}* in worked examples.
- Connect *{topic}* to one real-world situation relevant to a Grade {grade} learner.

## Prerequisites
- Familiarity with the previous chapter's vocabulary.
- Comfort with class-discussion routines.

## Teaching Aids
- Whiteboard / smart-board, marker, eraser
- A 1-page handout with 4 worked examples
- Optional: short 2-minute video clip if available

## Lesson Flow
| Phase | Time | Activity |
| --- | --- | --- |
| Warm-up | 5 min | 3-question recap of previous lesson; cold-call 2 students. |
| Introduction | 8 min | Hook with a real-life example of *{topic}*; introduce key terms on the board. |
| Main teaching | 12 min | Live-solve 2 worked examples, narrating reasoning. Pause for questions. |
| Guided practice | 10 min | Pair-work on 3 problems from the handout. Teacher circulates. |
| Wrap-up | 5 min | Whole-class debrief; one student summarises learning in 30 seconds. |

## Bloom's Taxonomy Mapping
- **Remember**: key vocabulary check (warm-up)
- **Understand**: paraphrase the concept (introduction)
- **Apply**: solve worked examples (guided practice)
- **Analyse**: spot the wrong step in a deliberately flawed example

## Formative Assessment
- 3-question exit ticket on *{topic}* (anonymous).
- Thumbs up/down on confidence before leaving the class.

## Homework
- 5 questions of mixed difficulty from the textbook on *{topic}*.
- One real-world example of *{topic}* observed at home or in the news.

---
*Generated by VidyaOS mock AI (no API key set). Add ANTHROPIC_API_KEY to backend/.env for live AI responses.*"""


def _mock_question_paper(prompt: str) -> str:
    grade, subject = _parse_grade_subject(prompt)
    topic = _parse_after(prompt, "topic") or "full syllabus"
    return f"""# Question Paper — {subject}
**Class:** Grade {grade}  ·  **Topic:** {topic}  ·  **Total Marks:** 50  ·  **Time:** 2 hours

## Section A — Multiple Choice (10 × 1 = 10 marks)  [Easy]
1. State the correct definition of *{topic}* from the options below.
2. Which of the following is NOT an example of *{topic}*?
3. The standard unit/notation used for *{topic}* is …
4. Identify the diagram that best represents *{topic}*.
5. Which formula is most directly used when working with *{topic}*?
6. Which scientist / writer / historical figure is most associated with *{topic}*?
7. Which year / period is relevant to the development of *{topic}*?
8. Match the term to the description (one out of four).
9. Choose the correctly spelt / correctly written option.
10. True or false: *{topic}* and its inverse always cancel out.

## Section B — Short Answer (5 × 2 = 10 marks)  [Medium]
1. Define *{topic}* in two lines.
2. Give one example of *{topic}* from daily life.
3. State two properties of *{topic}*.
4. Differentiate between *{topic}* and the related concept covered in the previous chapter.
5. Why is *{topic}* important in {subject}?

## Section C — Long Answer (3 × 5 = 15 marks)  [Medium–Hard]
1. Explain *{topic}* in your own words and illustrate with a diagram. [5]
2. Solve a worked problem involving *{topic}* showing each step. [5]
3. Describe one real-world application of *{topic}* and the value it provides. [5]

## Section D — Application / HOTS (3 × 5 = 15 marks)  [Hard]
1. Given a scenario involving *{topic}*, analyse and propose a solution. [5]
2. Compare two approaches to a *{topic}*-related problem and justify which is better. [5]
3. Predict the outcome of a *{topic}*-based experiment / situation, defending your reasoning. [5]

---
## Answer Key (Indicative)
- Section A: 1-B  2-D  3-C  4-A  5-B  6-A  7-C  8-D  9-B  10-True
- Section B: model two-line answers covering key terms.
- Section C: full-step worked solutions, partial credit for each step.
- Section D: rubric — analysis (2) + reasoning (2) + presentation (1).

*Generated by VidyaOS mock AI. Add ANTHROPIC_API_KEY to backend/.env for live AI responses.*"""


def _mock_assignment(prompt: str) -> str:
    grade, subject = _parse_grade_subject(prompt)
    topic = _parse_after(prompt, "on") or "the topic"
    return f"""# Homework Assignment — {subject} (Grade {grade})
**Topic:** {topic}  ·  **Estimated time:** 30 minutes  ·  **Total questions:** 8

**Easy (warm-up):**
1. Define *{topic}* in one sentence.
2. Give two examples of *{topic}* from your surroundings.

**Medium (practice):**
3. Solve / explain a worked example involving *{topic}*. Show your working.
4. Compare *{topic}* with the topic studied in the previous chapter — list 2 similarities and 2 differences.
5. List 3 properties of *{topic}*.

**Hard (apply):**
6. Read the short scenario in the textbook on page X. Identify where *{topic}* applies and justify.
7. Create your own example/problem involving *{topic}* and solve it.

**Reflect:**
8. In 3 lines: what was the hardest part of *{topic}* and what helped you understand it?

*Submit by next class. Marks: 16 (2 marks each).*

---
*Generated by VidyaOS mock AI. Add ANTHROPIC_API_KEY to backend/.env for live AI responses.*"""


def _mock_report_comments(prompt: str) -> str:
    grade, subject = _parse_grade_subject(prompt)
    return f"""# Report-card Comments — {subject} (Grade {grade})

**Comment 1 — High performer**
> A consistently focused and curious student. Shows strong grasp of {subject} concepts and asks insightful questions. Could stretch further by attempting application-level problems and helping peers in group work.

**Comment 2 — Steady performer**
> Demonstrates solid effort and reliable understanding of the core {subject} curriculum. Would benefit from spending more time on conceptual practice problems to push from "good" to "very good".

**Comment 3 — Needs improvement**
> Shows promise but inconsistency in homework submissions has affected progress. Encourage a steady daily routine of 20 minutes of {subject} practice; happy to coordinate with parents on a short plan.

**Comment 4 — Behavioural note**
> Engaged in class and respectful to teachers and peers. Could contribute more in group discussions; we will create more low-stakes participation opportunities next term.

**Comment 5 — Parent suggestion**
> Please continue the encouragement at home. A short weekly conversation about what was learned in {subject} this week will reinforce confidence and retention.

---
*Generated by VidyaOS mock AI. Add ANTHROPIC_API_KEY to backend/.env for live AI responses.*"""


def _mock_parent_chat(prompt: str) -> str:
    # The /ai/parent-chat endpoint formats prompt as "Context:\n{ctx}\n\nQuestion: {message}"
    ctx_match = re.search(r"Context:\s*(.+?)\s*Question:", prompt, re.DOTALL)
    q_match = re.search(r"Question:\s*(.+)$", prompt, re.DOTALL)
    ctx = (ctx_match.group(1).strip() if ctx_match else "").lower()
    question = (q_match.group(1).strip() if q_match else "").lower()

    name_m = re.search(r"-\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b", ctx_match.group(1) if ctx_match else "")
    name = name_m.group(1) if name_m else "your child"

    if any(w in question for w in ["fee", "fees", "due", "pending"]):
        amt = re.search(r"pending fees ₹([0-9]+)", ctx)
        if amt and int(amt.group(1)) > 0:
            return f"Namaste! {name} currently has ₹{amt.group(1)} in pending fees. You can clear them from the Fees tab in the parent portal — UPI, card, and net-banking are accepted. Let me know if you would like a payment plan; the school office is happy to help."
        return f"Namaste! {name}'s fees look up to date right now. If anything changes, the Fees tab in your portal will show the breakdown. Is there a specific term or category you would like to check?"

    if any(w in question for w in ["attendance", "absent", "present"]):
        pct = re.search(r"attendance\s+([0-9.]+)%", ctx)
        if pct:
            v = float(pct.group(1))
            if v >= 90:
                return f"{name} has an excellent attendance of {v}% this term — well above the 75% minimum. Keep up the consistency; it really helps with continuity of learning."
            if v >= 75:
                return f"{name} is at {v}% attendance, which is above the 75% threshold. Try to keep absences to genuine health reasons so the curriculum pace isn't disrupted."
            return f"{name}'s attendance is {v}%, which is below the 75% recommended minimum. Please get in touch with the class teacher so we can understand what is going on and support {name} together."
        return "I don't have an exact attendance figure for that period yet, but I can pull the daily register from the Attendance tab in your portal if you'd like."

    if any(w in question for w in ["exam", "test", "marks", "result", "grade", "performance"]):
        return f"For {name}'s exam performance, the Results section in your portal has the latest breakdown by subject, along with class average and rank percentile. If a specific subject has dipped, your class teacher can recommend targeted practice."

    if any(w in question for w in ["homework", "assignment", "study"]):
        return f"You can find {name}'s pending homework in the Assignments tab, sorted by due date. We recommend a fixed 30-minute study slot at home and reaching out to the class teacher if more than two assignments are overdue."

    return f"I'm happy to help! I can answer questions about {name}'s attendance, exam results, fees, homework, and school events. What would you like to know about?"


def _mock_insights(prompt: str) -> str:
    # Try to pull a few numbers out of the JSON-ish stats dump in the prompt
    students = re.search(r"['\"]?students['\"]?:\s*([0-9]+)", prompt)
    fees_pending = re.search(r"['\"]?fees_pending_amount['\"]?:\s*([0-9.]+)", prompt)
    fees_paid = re.search(r"['\"]?fees_paid_amount['\"]?:\s*([0-9.]+)", prompt)
    present_rate = re.search(r"['\"]?present_rate['\"]?:\s*([0-9.]+)", prompt)
    merit = re.search(r"['\"]?merit_percentage['\"]?:\s*([0-9.]+)", prompt)

    sv = students.group(1) if students else "—"
    fpd = float(fees_paid.group(1)) if fees_paid else 0
    fpn = float(fees_pending.group(1)) if fees_pending else 0
    total = fpd + fpn
    coll = round((fpd / total) * 100, 1) if total else 0
    pr = present_rate.group(1) if present_rate else "—"
    mp = merit.group(1) if merit else "—"

    return f"""# Executive Brief — School Operations

- **Roster size:** {sv} students currently active on the platform.
- **Today's attendance:** {pr}% of marked-students are present. Watch for any class trending below 80% over 5 consecutive days.
- **Academic merit:** average {mp}% across the most recent marks captured. Subject-wise variation is the place to dig deeper.
- **Fee collection:** {coll}% of dues collected so far (₹{int(fpd):,} paid · ₹{int(fpn):,} pending). At your current cadence, plan a parent-reminder push this week.
- **Operational health:** roster + class-teacher mapping is in sync; ID-card and certificate modules are usable; no critical alerts.

⚠️ **Risk flag:** Pending fee receivables (₹{int(fpn):,}) are the single largest financial exposure. If they slip past Q-end, cash flow will tighten — schedule a structured reminder + payment-plan offer to defaulter parents now.

---
*Generated by VidyaOS mock AI. Add ANTHROPIC_API_KEY to backend/.env for live AI responses.*"""


def _mock_ai_complete(system: str, user_text: str) -> str:
    sys_low = (system or "").lower()
    text_low = (user_text or "").lower()
    if "saathi" in sys_low or "parent" in sys_low and "school assistant" in sys_low:
        return _mock_parent_chat(user_text)
    if "analyst" in sys_low or "executive intelligence" in sys_low:
        return _mock_insights(user_text)
    if "lesson plan" in text_low:
        return _mock_lesson_plan(user_text)
    if "question paper" in text_low:
        return _mock_question_paper(user_text)
    if "homework assignment" in text_low or "assignment" in text_low:
        return _mock_assignment(user_text)
    if "report card" in text_low or "report card comments" in text_low:
        return _mock_report_comments(user_text)
    return (
        "AI is in mock mode (no API key configured). For real responses, add "
        "ANTHROPIC_API_KEY or OPENAI_API_KEY to backend/.env and restart the server."
    )


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
# Timetable / Communication / Documents
# =========================================================
@api.post("/timetable/generate")
async def generate_timetable(body: TimetableGenerateRequest, user=Depends(require_roles("super_admin", "school_admin"))):
    klass = await db.classes.find_one({"id": body.class_id}, {"_id": 0})
    if not klass:
        raise HTTPException(404, "Class not found")
    teachers = await db.teacher_profiles.find({}, {"_id": 0}).to_list(500)
    subjects = klass.get("subjects") or ["English", "Hindi", "Telugu", "Maths", "Science", "Social"]
    periods = body.periods_per_day or klass.get("periods_per_day") or 8
    teacher_busy: Dict[str, set] = {}
    entries = []
    labs = {"Science", "Computer Science", "Physics", "Chemistry", "Biology"}
    for day in body.days:
        subject_index = 0
        for period in range(1, periods + 1):
            slot = f"{day}-{period}"
            if period == body.break_after_period:
                entries.append({"id": str(uuid.uuid4()), "day": day, "period": period, "type": "break", "title": "Break", "subject": "", "teacher_id": "", "teacher_name": "", "room": "Campus"})
                continue
            subject = subjects[subject_index % len(subjects)]
            subject_index += 1
            candidates = [t for t in teachers if (t.get("core_subject") or "").lower() == subject.lower()] or teachers
            teacher = next((t for t in candidates if slot not in teacher_busy.setdefault(t.get("user_id") or t.get("id"), set())), candidates[0] if candidates else {})
            teacher_key = teacher.get("user_id") or teacher.get("id") or ""
            if teacher_key:
                teacher_busy.setdefault(teacher_key, set()).add(slot)
            is_lab = subject in labs and period in (2, 6)
            entries.append({
                "id": str(uuid.uuid4()),
                "day": day,
                "period": period,
                "type": "lab" if is_lab else "class",
                "title": f"{subject} Lab" if is_lab else subject,
                "subject": subject,
                "teacher_id": teacher_key,
                "teacher_name": teacher.get("name") or "Unassigned",
                "room": "Lab" if is_lab else klass.get("name", "Classroom"),
            })
    doc = {
        "id": str(uuid.uuid4()),
        "class_id": body.class_id,
        "class_name": klass.get("name"),
        "days": body.days,
        "periods_per_day": periods,
        "entries": entries,
        "created_by": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.timetables.delete_many({"class_id": body.class_id})
    await db.timetables.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/timetable")
async def list_timetables(class_id: Optional[str] = None, teacher_id: Optional[str] = None, user=Depends(get_current_user)):
    q: Dict[str, Any] = {}
    profile = await _teacher_profile_for_user(user)
    if profile:
        teacher_id = profile.get("user_id")
    if class_id:
        q["class_id"] = class_id
    timetables = await db.timetables.find(q, {"_id": 0}).sort("updated_at", -1).to_list(200)
    if teacher_id:
        filtered = []
        for t in timetables:
            entries = [e for e in t.get("entries", []) if e.get("teacher_id") == teacher_id]
            if entries:
                filtered.append({**t, "entries": entries})
        return filtered
    return timetables


@api.put("/timetable/{class_id}")
async def update_timetable(class_id: str, body: TimetableUpdate, user=Depends(require_roles("super_admin", "school_admin"))):
    klass = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not klass:
        raise HTTPException(404, "Class not found")
    updates = {
        "entries": body.entries,
        "days": body.days or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "periods_per_day": body.periods_per_day or klass.get("periods_per_day") or 8,
        "class_name": klass.get("name"),
        "updated_at": now_iso(),
    }
    await db.timetables.update_one(
        {"class_id": class_id},
        {
            "$set": updates,
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "class_id": class_id,
                "created_by": user["id"],
                "created_at": now_iso(),
            },
        },
        upsert=True,
    )
    return await db.timetables.find_one({"class_id": class_id}, {"_id": 0})


@api.post("/communications")
async def create_communication(body: CommunicationCreate, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    msg = body.model_dump()
    recipient_count = 0
    if body.audience == "teachers":
        recipient_count = await db.users.count_documents({"role": "teacher"})
    elif body.audience == "students":
        recipient_count = await db.students.count_documents({})
    elif body.audience == "parents":
        recipient_count = len(await db.students.distinct("parent_email", {"parent_email": {"$ne": None}}))
    elif body.audience in ("class", "section"):
        q = {"class_id": body.class_id} if body.class_id else {}
        if body.section:
            q["section"] = body.section
        recipient_count = await db.students.count_documents(q)
    else:
        recipient_count = await db.users.count_documents({})
    statuses = ["delivered", "read", "queued"] if body.scheduled_at else ["sent", "delivered", "read"]
    msg.update({
        "id": str(uuid.uuid4()),
        "recipient_count": recipient_count,
        "delivery_status": statuses[min(1, len(statuses) - 1)],
        "read_status": "pending" if body.scheduled_at else "partial",
        "sent_at": None if body.scheduled_at else now_iso(),
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    })
    await db.communications.insert_one(msg)
    return {k: v for k, v in msg.items() if k != "_id"}


@api.get("/communications")
async def list_communications(user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    return await db.communications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/communication-templates")
async def communication_templates(user=Depends(get_current_user)):
    return [
        {"title": "Attendance Alert", "category": "attendance", "body": "Your child was marked absent today. Please contact the class teacher for clarification."},
        {"title": "Fee Reminder", "category": "fees", "body": "This is a gentle reminder to clear pending school fee dues before the due date."},
        {"title": "Exam Notification", "category": "exam", "body": "Exam schedule has been published. Please check the timetable and prepare accordingly."},
        {"title": "Emergency Announcement", "category": "emergency", "body": "Important school announcement: please read this message immediately."},
    ]


# =========================================================
# Messaging platform — real delivery model with mock provider
# =========================================================
import asyncio
import random

PROVIDER_RATES = {  # ₹ per message, India market rates (approximate)
    "whatsapp": 0.78,  # WhatsApp Business utility template
    "sms": 0.20,  # transactional SMS via DLT
    "email": 0.04,
}
PROVIDER_LABEL = {
    "whatsapp": "Gupshup WhatsApp",
    "sms": "MSG91 SMS",
    "email": "AWS SES Email",
}


def _render_body(body: str, vars: Dict[str, Any]) -> str:
    out = body or ""
    for k, v in (vars or {}).items():
        out = out.replace("{" + k + "}", "" if v is None else str(v))
    return out


def _contact_for(channel: str, source: Dict[str, Any], kind: str) -> Optional[str]:
    """Pick the right contact field for the channel + recipient kind."""
    if channel == "email":
        if kind == "parent":
            return source.get("parent_email")
        return source.get("email")
    # phone-based channels (whatsapp/sms)
    if kind == "parent":
        return source.get("parent_phone")
    if kind == "teacher":
        return source.get("phone_number") or (source.get("meta") or {}).get("phone_number")
    if kind == "student":
        return (source.get("meta") or {}).get("phone_number")
    return None


async def _resolve_recipients(req: MessageSendRequest) -> List[Dict[str, Any]]:
    """Return list of {kind, recipient_id, recipient_name, contact, vars}."""
    out: List[Dict[str, Any]] = []
    today = datetime.now(timezone.utc).date().isoformat()

    if req.audience == "custom" and req.custom_recipient_ids:
        students = await db.students.find({"id": {"$in": req.custom_recipient_ids}}, {"_id": 0}).to_list(None)
        for s in students:
            contact = _contact_for(req.channel, s, "parent" if req.channel != "email" or s.get("parent_email") else "student")
            kind = "parent" if req.channel in ("whatsapp", "sms") else ("parent" if s.get("parent_email") else "student")
            out.append({
                "kind": kind,
                "recipient_id": s["id"],
                "recipient_name": s.get("name"),
                "contact": contact,
                "vars": {
                    "student_name": s.get("name"),
                    "parent_name": "Parent",
                    "class": s.get("class_id"),
                    "roll_no": s.get("roll_no"),
                    "date": today,
                },
            })
        return out

    if req.audience == "teachers":
        teachers = await db.teacher_profiles.find({}, {"_id": 0}).to_list(None)
        for t in teachers:
            out.append({
                "kind": "teacher",
                "recipient_id": t.get("user_id") or t.get("id"),
                "recipient_name": t.get("name"),
                "contact": _contact_for(req.channel, t, "teacher"),
                "vars": {
                    "teacher_name": t.get("name"),
                    "subject": t.get("core_subject"),
                    "class": t.get("assigned_class_id"),
                    "date": today,
                },
            })
        return out

    # student-scoped audiences (parents / students / class / section / all)
    q: Dict[str, Any] = {}
    if req.class_id:
        q["class_id"] = req.class_id
    if req.section:
        q["section"] = req.section
    students = await db.students.find(q, {"_id": 0}).to_list(None)
    # "students" sends directly to the student; everything else (parents/class/section) goes to parents
    kind = "student" if req.audience == "students" else "parent"
    for s in students:
        out.append({
            "kind": kind,
            "recipient_id": s["id"],
            "recipient_name": s.get("name"),
            "contact": _contact_for(req.channel, s, kind),
            "vars": {
                "student_name": s.get("name"),
                "parent_name": "Parent",
                "class": s.get("class_id"),
                "roll_no": s.get("roll_no"),
                "house": s.get("house"),
                "date": today,
            },
        })

    if req.audience == "all":
        # Include teachers too
        teachers = await db.teacher_profiles.find({}, {"_id": 0}).to_list(None)
        for t in teachers:
            out.append({
                "kind": "teacher",
                "recipient_id": t.get("user_id") or t.get("id"),
                "recipient_name": t.get("name"),
                "contact": _contact_for(req.channel, t, "teacher"),
                "vars": {
                    "teacher_name": t.get("name"),
                    "class": t.get("assigned_class_id"),
                    "date": today,
                },
            })
    return out


async def _walk_delivery(delivery_id: str):
    """Mock provider: walk a delivery through queued -> sent -> delivered -> read,
    with realistic random failures and read-ratios."""
    try:
        await asyncio.sleep(random.uniform(0.1, 0.4))
        # 3% chance of invalid contact (caught at sent step)
        if random.random() < 0.03:
            await db.message_deliveries.update_one(
                {"id": delivery_id},
                {"$set": {"status": "failed", "failed_at": now_iso(), "failure_reason": "invalid_contact"}},
            )
            return
        await db.message_deliveries.update_one(
            {"id": delivery_id},
            {"$set": {"status": "sent", "sent_at": now_iso()}},
        )
        # 2% opted out / DND
        if random.random() < 0.02:
            await asyncio.sleep(random.uniform(0.1, 0.4))
            await db.message_deliveries.update_one(
                {"id": delivery_id},
                {"$set": {"status": "opted_out", "failed_at": now_iso(), "failure_reason": "DND/opted out"}},
            )
            return
        # 4% delivery failure (provider, network, etc.)
        await asyncio.sleep(random.uniform(0.8, 2.5))
        if random.random() < 0.04:
            reason = random.choice(["network_timeout", "provider_rejected", "rate_limited"])
            await db.message_deliveries.update_one(
                {"id": delivery_id},
                {"$set": {"status": "failed", "failed_at": now_iso(), "failure_reason": reason}},
            )
            return
        await db.message_deliveries.update_one(
            {"id": delivery_id},
            {"$set": {"status": "delivered", "delivered_at": now_iso()}},
        )
        # 55% read within 30s for the demo to feel alive
        if random.random() < 0.55:
            await asyncio.sleep(random.uniform(3, 25))
            await db.message_deliveries.update_one(
                {"id": delivery_id},
                {"$set": {"status": "read", "read_at": now_iso()}},
            )
    except Exception:
        logger.exception("walk_delivery failed for %s", delivery_id)


async def _dispatch_message(message: Dict[str, Any]):
    """Build per-recipient deliveries for an already-persisted message and start the mock provider."""
    req = MessageSendRequest(**{
        "audience": message["audience"],
        "channel": message["channel"],
        "title": message["title"],
        "body": message["body"],
        "class_id": message.get("class_id"),
        "section": message.get("section"),
        "custom_recipient_ids": message.get("custom_recipient_ids"),
        "category": message.get("category", "general"),
    })
    recipients = await _resolve_recipients(req)
    # Filter opt-outs
    opt_outs = await db.opt_outs.find({"channel": message["channel"]}, {"_id": 0, "contact": 1}).to_list(None)
    opted_out = {o["contact"] for o in opt_outs}

    delivery_docs = []
    delivery_ids = []
    for r in recipients:
        contact = r["contact"]
        if not contact:
            # Skip silently with a failed delivery row so admin can see "missing contact"
            doc = {
                "id": str(uuid.uuid4()),
                "message_id": message["id"],
                "channel": message["channel"],
                "kind": r["kind"],
                "recipient_id": r["recipient_id"],
                "recipient_name": r["recipient_name"],
                "contact": None,
                "body_rendered": _render_body(message["body"], r.get("vars") or {}),
                "status": "failed",
                "failure_reason": "no_contact_on_file",
                "queued_at": now_iso(),
                "failed_at": now_iso(),
            }
            delivery_docs.append(doc)
            continue
        if contact in opted_out:
            doc = {
                "id": str(uuid.uuid4()),
                "message_id": message["id"],
                "channel": message["channel"],
                "kind": r["kind"],
                "recipient_id": r["recipient_id"],
                "recipient_name": r["recipient_name"],
                "contact": contact,
                "body_rendered": _render_body(message["body"], r.get("vars") or {}),
                "status": "opted_out",
                "failure_reason": "previously opted out",
                "queued_at": now_iso(),
                "failed_at": now_iso(),
            }
            delivery_docs.append(doc)
            continue
        did = str(uuid.uuid4())
        doc = {
            "id": did,
            "message_id": message["id"],
            "channel": message["channel"],
            "kind": r["kind"],
            "recipient_id": r["recipient_id"],
            "recipient_name": r["recipient_name"],
            "contact": contact,
            "body_rendered": _render_body(message["body"], r.get("vars") or {}),
            "status": "queued",
            "queued_at": now_iso(),
        }
        delivery_docs.append(doc)
        delivery_ids.append(did)

    if delivery_docs:
        await db.message_deliveries.insert_many(delivery_docs)

    await db.messages.update_one(
        {"id": message["id"]},
        {"$set": {
            "status": "sending",
            "recipient_count": len(delivery_docs),
            "sent_at": now_iso(),
        }},
    )

    # Walk each delivery in a background task
    for did in delivery_ids:
        asyncio.create_task(_walk_delivery(did))


async def _scheduler_loop():
    while True:
        try:
            await asyncio.sleep(15)
            now = datetime.now(timezone.utc).isoformat()
            due = await db.messages.find({"status": "scheduled", "scheduled_at": {"$lte": now}}, {"_id": 0}).to_list(50)
            for msg in due:
                logger.info("Scheduler firing message %s", msg["id"])
                await _dispatch_message(msg)
        except Exception:
            logger.exception("scheduler loop error")


async def _seed_message_templates_if_empty():
    count = await db.message_templates.count_documents({})
    if count > 0:
        return
    defaults = [
        {
            "name": "Attendance alert (WhatsApp)",
            "channel": "whatsapp",
            "category": "attendance",
            "body": "Dear {parent_name}, {student_name} (Class {class}, Roll {roll_no}) was marked absent on {date}. Please contact the class teacher if this is unexpected.\n— {school}",
            "approval_status": "approved",
            "waba_id": "vidya_attendance_v1",
        },
        {
            "name": "Fee reminder (WhatsApp)",
            "channel": "whatsapp",
            "category": "fees",
            "body": "Dear {parent_name}, fee for {student_name} (Class {class}) is pending. Please clear dues before the deadline to avoid late charges.\n— {school}",
            "approval_status": "approved",
            "waba_id": "vidya_fees_v1",
        },
        {
            "name": "Exam notification (SMS)",
            "channel": "sms",
            "category": "exam",
            "body": "VIDYAOS: {student_name} - exam schedule for {class} is published. Visit the parent portal. -{school}",
            "approval_status": "approved",
            "dlt_id": "1107171234567890123",
        },
        {
            "name": "Emergency announcement (SMS)",
            "channel": "sms",
            "category": "emergency",
            "body": "VIDYAOS URGENT: Please check the parent portal for an important announcement from {school}.",
            "approval_status": "approved",
            "dlt_id": "1107171234567890124",
        },
        {
            "name": "PTM invite (Email)",
            "channel": "email",
            "category": "ptm",
            "body": "Dear {parent_name},\n\nYou are invited to the Parent–Teacher Meeting for {student_name} (Class {class}) on {date}.\n\nRegards,\n{school}",
            "approval_status": "approved",
        },
    ]
    for d in defaults:
        d.update({
            "id": str(uuid.uuid4()),
            "created_by": "system",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    await db.message_templates.insert_many(defaults)


# ----- Templates CRUD -----
@api.get("/message-templates")
async def list_message_templates(user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    return await db.message_templates.find({}, {"_id": 0}).sort("updated_at", -1).to_list(200)


@api.post("/message-templates")
async def create_message_template(body: MessageTemplateCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "approval_status": "pending_approval",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.message_templates.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.patch("/message-templates/{template_id}")
async def update_message_template(template_id: str, body: MessageTemplateUpdate, user=Depends(require_roles("super_admin", "school_admin"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return await db.message_templates.find_one({"id": template_id}, {"_id": 0})
    updates["updated_at"] = now_iso()
    res = await db.message_templates.update_one({"id": template_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Template not found")
    return await db.message_templates.find_one({"id": template_id}, {"_id": 0})


@api.delete("/message-templates/{template_id}")
async def delete_message_template(template_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.message_templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


# ----- Cost preview -----
@api.post("/messages/cost-preview")
async def preview_cost(req: MessageSendRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    recipients = await _resolve_recipients(req)
    deliverable = sum(1 for r in recipients if r.get("contact"))
    missing = len(recipients) - deliverable
    rate = PROVIDER_RATES.get(req.channel, 0)
    subtotal = deliverable * rate
    gst = subtotal * 0.18
    return {
        "channel": req.channel,
        "provider": PROVIDER_LABEL.get(req.channel),
        "rate_per_message": rate,
        "total_audience": len(recipients),
        "deliverable": deliverable,
        "missing_contact": missing,
        "subtotal": round(subtotal, 2),
        "gst": round(gst, 2),
        "total": round(subtotal + gst, 2),
    }


# ----- Send / schedule -----
@api.post("/messages")
async def send_message(req: MessageSendRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    # If a template is referenced, ensure it's approved
    if req.template_id:
        tpl = await db.message_templates.find_one({"id": req.template_id}, {"_id": 0})
        if not tpl:
            raise HTTPException(404, "Template not found")
        if tpl.get("approval_status") != "approved":
            raise HTTPException(400, f"Template is {tpl.get('approval_status')}; cannot send yet")

    message = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "body": req.body,
        "channel": req.channel,
        "audience": req.audience,
        "class_id": req.class_id,
        "section": req.section,
        "custom_recipient_ids": req.custom_recipient_ids,
        "category": req.category,
        "template_id": req.template_id,
        "scheduled_at": req.scheduled_at,
        "status": "scheduled" if req.scheduled_at else "queued",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
        "recipient_count": 0,
        "sent_at": None,
    }
    await db.messages.insert_one(message)

    if not req.scheduled_at:
        asyncio.create_task(_dispatch_message({k: v for k, v in message.items() if k != "_id"}))

    return {k: v for k, v in message.items() if k != "_id"}


@api.get("/messages")
async def list_messages(user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    msgs = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Inline aggregate counts
    for m in msgs:
        pipe = [
            {"$match": {"message_id": m["id"]}},
            {"$group": {"_id": "$status", "n": {"$sum": 1}}},
        ]
        counts = {"queued": 0, "sent": 0, "delivered": 0, "read": 0, "failed": 0, "opted_out": 0}
        async for d in db.message_deliveries.aggregate(pipe):
            counts[d["_id"]] = d["n"]
        m["delivery_counts"] = counts
    return msgs


@api.get("/messages/{message_id}")
async def get_message(message_id: str, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    m = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Message not found")
    return m


@api.get("/messages/{message_id}/deliveries")
async def list_message_deliveries(
    message_id: str,
    status_filter: Optional[str] = None,
    user=Depends(require_roles("super_admin", "school_admin", "teacher")),
):
    q: Dict[str, Any] = {"message_id": message_id}
    if status_filter:
        q["status"] = status_filter
    return await db.message_deliveries.find(q, {"_id": 0}).sort("queued_at", -1).to_list(2000)


@api.post("/messages/{message_id}/cancel")
async def cancel_message(message_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.messages.update_one(
        {"id": message_id, "status": "scheduled"},
        {"$set": {"status": "cancelled", "cancelled_by": user["id"], "cancelled_by_name": user["name"], "cancelled_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(400, "Only scheduled messages can be cancelled")
    return await db.messages.find_one({"id": message_id}, {"_id": 0})


@api.post("/messages/{message_id}/retry-failed")
async def retry_failed(message_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    failed = await db.message_deliveries.find({"message_id": message_id, "status": "failed"}, {"_id": 0}).to_list(1000)
    if not failed:
        return {"retried": 0}
    retried = 0
    for d in failed:
        # Don't retry "no_contact_on_file" — that's the user's problem
        if d.get("failure_reason") == "no_contact_on_file":
            continue
        await db.message_deliveries.update_one(
            {"id": d["id"]},
            {
                "$set": {"status": "queued", "queued_at": now_iso()},
                "$unset": {"failed_at": "", "failure_reason": ""},
            },
        )
        asyncio.create_task(_walk_delivery(d["id"]))
        retried += 1
    return {"retried": retried}


@api.post("/messages/{message_id}/send-test")
async def send_test(message_id: str, body: MessageTestRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Message not found")
    did = str(uuid.uuid4())
    doc = {
        "id": did,
        "message_id": message_id,
        "channel": msg["channel"],
        "kind": "test",
        "recipient_id": "test",
        "recipient_name": body.name or "Test recipient",
        "contact": body.to,
        "body_rendered": _render_body(msg["body"], {
            "student_name": "Test Student",
            "parent_name": "Test Parent",
            "class": "Test-Class",
            "roll_no": "00",
            "date": datetime.now(timezone.utc).date().isoformat(),
            "school": (msg.get("design") or {}).get("schoolName", "Vidya Public School"),
        }),
        "status": "queued",
        "is_test": True,
        "queued_at": now_iso(),
    }
    await db.message_deliveries.insert_one(doc)
    asyncio.create_task(_walk_delivery(did))
    return {k: v for k, v in doc.items() if k != "_id"}


# ----- Opt-outs -----
@api.get("/opt-outs")
async def list_opt_outs(user=Depends(require_roles("super_admin", "school_admin"))):
    return await db.opt_outs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/opt-outs")
async def create_opt_out(body: OptOutCreate, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    existing = await db.opt_outs.find_one({"channel": body.channel, "contact": body.contact}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "channel": body.channel,
        "contact": body.contact,
        "reason": body.reason,
        "recorded_by": user["id"],
        "recorded_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.opt_outs.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/opt-outs/{opt_out_id}")
async def delete_opt_out(opt_out_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.opt_outs.delete_one({"id": opt_out_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Opt-out not found")
    return {"ok": True}


@api.post("/certificate-templates")
async def create_certificate_template(body: CertificateTemplateCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_by": user["id"], "created_at": now_iso(), "updated_at": now_iso()})
    await db.certificate_templates.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/certificate-templates")
async def list_certificate_templates(user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    return await db.certificate_templates.find({}, {"_id": 0}).sort("updated_at", -1).to_list(200)


@api.delete("/certificate-templates/{template_id}")
async def delete_certificate_template(template_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.certificate_templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


@api.patch("/certificate-templates/{template_id}")
async def update_certificate_template(template_id: str, body: CertificateTemplateCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    updates = body.model_dump()
    updates["updated_at"] = now_iso()
    res = await db.certificate_templates.update_one({"id": template_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Template not found")
    return await db.certificate_templates.find_one({"id": template_id}, {"_id": 0})


async def _next_cert_no(year: int, prefix: str = "VPS") -> str:
    res = await db.certificate_counters.find_one_and_update(
        {"_id": f"cert/{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (res or {}).get("seq", 1)
    return f"{prefix}-{year}-{seq:04d}"


async def _find_recipient(recipient_type: str, recipient_id: str) -> Optional[Dict[str, Any]]:
    if recipient_type == "teacher":
        return await db.teacher_profiles.find_one({"user_id": recipient_id}, {"_id": 0})
    return await db.students.find_one({"id": recipient_id}, {"_id": 0})


def _build_issuance_doc(template: Dict[str, Any], recipient: Dict[str, Any], cert_no: str,
                       recipient_type: str, body: Any, user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "cert_no": cert_no,
        "template_id": template["id"],
        "template_name": template.get("name"),
        "template_type": template.get("type"),
        "design_snapshot": template.get("design", {}),
        "recipient_type": recipient_type,
        "recipient_id": recipient.get("user_id") if recipient_type == "teacher" else recipient.get("id"),
        "recipient_name": recipient.get("name"),
        "recipient_class_id": recipient.get("class_id") or recipient.get("assigned_class_id"),
        "recipient_roll_no": recipient.get("roll_no"),
        "event_name": getattr(body, "event_name", None),
        "event_date": getattr(body, "event_date", None),
        "position": getattr(body, "position", None),
        "category": getattr(body, "category", None),
        "score": getattr(body, "score", None),
        "body_override": getattr(body, "body_override", None),
        "school_id": user.get("school_id", "default-school"),
        "school_name_snapshot": (template.get("design") or {}).get("schoolName"),
        "issued_by": user["id"],
        "issued_by_name": user["name"],
        "issued_at": now_iso(),
        "status": "issued",
    }


@api.post("/certificate-issuances")
async def issue_certificate(body: CertificateIssueRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    template = await db.certificate_templates.find_one({"id": body.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    recipient = await _find_recipient(body.recipient_type, body.recipient_id)
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    year = datetime.now(timezone.utc).year
    cert_no = await _next_cert_no(year)
    doc = _build_issuance_doc(template, recipient, cert_no, body.recipient_type, body, user)
    await db.certificate_issuances.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/certificate-issuances/bulk")
async def bulk_issue_certificates(body: BulkCertificateIssueRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    if not body.recipient_ids:
        raise HTTPException(400, "recipient_ids cannot be empty")
    template = await db.certificate_templates.find_one({"id": body.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    year = datetime.now(timezone.utc).year
    issuances: List[Dict[str, Any]] = []
    for rid in body.recipient_ids:
        recipient = await _find_recipient(body.recipient_type, rid)
        if not recipient:
            continue
        cert_no = await _next_cert_no(year)
        doc = _build_issuance_doc(template, recipient, cert_no, body.recipient_type, body, user)
        issuances.append(doc)
    if not issuances:
        raise HTTPException(404, "No valid recipients found")
    await db.certificate_issuances.insert_many(issuances)
    clean = [{k: v for k, v in d.items() if k != "_id"} for d in issuances]
    return {"issued": len(clean), "items": clean}


@api.get("/certificate-issuances")
async def list_certificate_issuances(
    template_id: Optional[str] = None,
    recipient_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if template_id:
        q["template_id"] = template_id
    if recipient_id:
        q["recipient_id"] = recipient_id
    if status_filter:
        q["status"] = status_filter
    if user["role"] == "student":
        q["recipient_id"] = user.get("meta", {}).get("student_id", "")
    elif user["role"] == "parent":
        kids = await db.students.find({"parent_email": user["email"]}, {"_id": 0}).to_list(50)
        q["recipient_id"] = {"$in": [k["id"] for k in kids]}
    elif user["role"] == "teacher":
        profile = await _teacher_profile_for_user(user)
        if profile:
            cls = profile.get("assigned_class_id")
            class_students = await db.students.find({"class_id": cls}, {"_id": 0, "id": 1}).to_list(None)
            ids = [s["id"] for s in class_students] + [profile.get("user_id")]
            q["recipient_id"] = {"$in": [i for i in ids if i]}
    return await db.certificate_issuances.find(q, {"_id": 0}).sort("issued_at", -1).to_list(500)


@api.get("/certificate-issuances/{issuance_id}")
async def get_certificate_issuance(issuance_id: str, user=Depends(get_current_user)):
    issuance = await db.certificate_issuances.find_one({"id": issuance_id}, {"_id": 0})
    if not issuance:
        raise HTTPException(404, "Certificate not found")
    return issuance


@api.post("/certificate-issuances/{issuance_id}/revoke")
async def revoke_certificate(issuance_id: str, body: CertificateRevokeRequest, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.certificate_issuances.update_one(
        {"id": issuance_id},
        {"$set": {
            "status": "revoked",
            "revoked_by": user["id"],
            "revoked_by_name": user["name"],
            "revoked_at": now_iso(),
            "revoked_reason": body.reason,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Certificate not found")
    return await db.certificate_issuances.find_one({"id": issuance_id}, {"_id": 0})


# Public verification (no auth) — for QR scans
@api.get("/certificate-verify/{issuance_id}")
async def verify_certificate(issuance_id: str):
    issuance = await db.certificate_issuances.find_one({"id": issuance_id}, {"_id": 0, "issued_by": 0})
    if not issuance:
        return {"valid": False, "message": "Certificate not found"}
    return {
        "valid": issuance.get("status") == "issued",
        "status": issuance.get("status"),
        "cert_no": issuance.get("cert_no"),
        "recipient_name": issuance.get("recipient_name"),
        "template_name": issuance.get("template_name"),
        "event_name": issuance.get("event_name"),
        "event_date": issuance.get("event_date"),
        "position": issuance.get("position"),
        "issued_at": issuance.get("issued_at"),
        "school_name": issuance.get("school_name_snapshot"),
        "revoked_reason": issuance.get("revoked_reason") if issuance.get("status") == "revoked" else None,
    }


@api.post("/id-card-batches")
async def create_id_card_batch(body: IDCardBatchCreate, user=Depends(require_roles("super_admin", "school_admin"))):
    q: Dict[str, Any] = {}
    records: List[Dict[str, Any]] = []
    if body.target_type == "students":
        if body.class_id:
            q["class_id"] = body.class_id
        records = await db.students.find(q, {"_id": 0}).to_list(1000)
    elif body.target_type == "teachers":
        records = await db.teacher_profiles.find({}, {"_id": 0}).to_list(1000)
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "record_count": len(records),
        "records": records,
        "status": "pending_approval",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    })
    await db.id_card_batches.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/id-card-batches")
async def list_id_card_batches(user=Depends(require_roles("super_admin", "school_admin"))):
    return await db.id_card_batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.get("/id-card-batches/{batch_id}")
async def get_id_card_batch(batch_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    batch = await db.id_card_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch


@api.patch("/id-card-batches/{batch_id}/approve")
async def approve_id_card_batch(batch_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.id_card_batches.update_one(
        {"id": batch_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["id"],
            "approved_by_name": user["name"],
            "approved_at": now_iso(),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Batch not found")
    return await db.id_card_batches.find_one({"id": batch_id}, {"_id": 0})


@api.delete("/id-card-batches/{batch_id}")
async def delete_id_card_batch(batch_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.id_card_batches.delete_one({"id": batch_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Batch not found")
    return {"ok": True, "deleted_batch_id": batch_id}


@api.post("/id-card-reissues")
async def create_card_reissue(body: CardReissueRequest, user=Depends(require_roles("super_admin", "school_admin", "teacher"))):
    doc = {
        "id": str(uuid.uuid4()),
        "target_type": body.target_type,
        "record_id": body.record_id,
        "reason": body.reason or "Lost card",
        "status": "pending",
        "requested_by": user["id"],
        "requested_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.card_reissues.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/id-card-reissues")
async def list_card_reissues(user=Depends(require_roles("super_admin", "school_admin"))):
    return await db.card_reissues.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.patch("/id-card-reissues/{reissue_id}/mark-printed")
async def mark_reissue_printed(reissue_id: str, user=Depends(require_roles("super_admin", "school_admin"))):
    res = await db.card_reissues.update_one(
        {"id": reissue_id},
        {"$set": {"status": "printed", "printed_by": user["id"], "printed_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Reissue request not found")
    return await db.card_reissues.find_one({"id": reissue_id}, {"_id": 0})


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


async def _backfill_id_card_fields():
    blood_groups = ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"]
    missing = await db.students.find({"blood_group": {"$exists": False}}, {"_id": 0, "id": 1, "roll_no": 1}).to_list(None)
    for s in missing:
        try:
            idx = int(str(s.get("roll_no") or "0"))
        except ValueError:
            idx = 0
        await db.students.update_one(
            {"id": s["id"]},
            {"$set": {"blood_group": blood_groups[idx % len(blood_groups)]}},
        )


@app.on_event("startup")
async def _startup():
    # auto-seed once
    try:
        await db.users.create_index("email", unique=True)
        await db.students.create_index("id", unique=True)
        await db.teacher_profiles.create_index("user_id", unique=True)
        count = await db.users.count_documents({})
        if count == 0 and AUTO_SEED_DEMO_DATA:
            await seed_data()
            logger.info("Auto-seeded demo data")
        elif count > 0:
            await _ensure_demo_teacher_profile()
            summary = await _ensure_class_teachers_and_rosters()
            logger.info("Roster/class-teacher sync complete: %s", summary)
        await _backfill_id_card_fields()
        if SEED_DEFAULT_MESSAGE_TEMPLATES:
            await _seed_message_templates_if_empty()
        # Spawn the background scheduler exactly once per process
        if not getattr(app.state, "scheduler_started", False):
            asyncio.create_task(_scheduler_loop())
            app.state.scheduler_started = True
    except Exception as e:
        logger.exception("startup error: %s", e)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
