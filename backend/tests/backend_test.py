"""
AI School OS — Backend regression tests.

Covers: auth (5 demo accounts), RBAC, students, attendance, exams/marks,
fees + mock pay, circulars, dashboard stats, AI endpoints.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bharat-erp-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "Pass@1234"

DEMOS = {
    "super_admin":  "super@aischool.io",
    "school_admin": "admin@aischool.io",
    "teacher":      "teacher@aischool.io",
    "student":      "student@aischool.io",
    "parent":       "parent@aischool.io",
}


# ------------------ Fixtures ------------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def tokens(session):
    out = {}
    for role, email in DEMOS.items():
        r = session.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD}, timeout=20)
        assert r.status_code == 200, f"login failed for {role}: {r.status_code} {r.text}"
        data = r.json()
        assert data["user"]["role"] == role
        out[role] = data["access_token"]
    return out


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------ Auth ------------------
class TestAuth:
    def test_health(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    @pytest.mark.parametrize("role,email", list(DEMOS.items()))
    def test_login_demo(self, session, role, email):
        r = session.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 20
        assert data["user"]["role"] == role
        assert data["user"]["email"] == email

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "admin@aischool.io", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, session, tokens):
        r = session.get(f"{API}/auth/me", headers=auth(tokens["school_admin"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "school_admin"

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ------------------ Dashboard stats ------------------
class TestDashboard:
    def test_stats(self, session, tokens):
        r = session.get(f"{API}/dashboard/stats", headers=auth(tokens["school_admin"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        c = d["counts"]
        assert c["students"] >= 30
        assert c["classes"] >= 1
        assert isinstance(d["attendance_trend"], list)
        assert len(d["attendance_trend"]) >= 1
        assert isinstance(d["subject_performance"], list)
        assert len(d["subject_performance"]) >= 1


# ------------------ Students ------------------
class TestStudents:
    def test_admin_lists_30(self, session, tokens):
        r = session.get(f"{API}/students", headers=auth(tokens["school_admin"]), timeout=20)
        assert r.status_code == 200
        students = r.json()
        assert len(students) >= 30

    def test_parent_only_child(self, session, tokens):
        r = session.get(f"{API}/students", headers=auth(tokens["parent"]), timeout=20)
        assert r.status_code == 200
        kids = r.json()
        assert len(kids) == 1
        assert kids[0]["name"] == "Ananya Reddy"

    def test_student_only_self(self, session, tokens):
        r = session.get(f"{API}/students", headers=auth(tokens["student"]), timeout=20)
        assert r.status_code == 200
        recs = r.json()
        assert len(recs) == 1
        assert recs[0]["name"] == "Ananya Reddy"

    def test_student_profile_detail(self, session, tokens):
        # find ananya id
        r = session.get(f"{API}/students", headers=auth(tokens["parent"]), timeout=20)
        sid = r.json()[0]["id"]
        r2 = session.get(f"{API}/students/{sid}", headers=auth(tokens["school_admin"]), timeout=20)
        assert r2.status_code == 200
        d = r2.json()
        assert "attendance_pct" in d
        assert isinstance(d["marks"], list) and len(d["marks"]) >= 1
        assert isinstance(d["fees"], list) and len(d["fees"]) >= 1

    def test_rbac_student_cannot_create(self, session, tokens):
        r = session.post(f"{API}/students", headers=auth(tokens["student"]),
                         json={"name": "TEST_x", "roll_no": "999", "class_id": "cls-9A", "section": "A"}, timeout=15)
        assert r.status_code == 403


# ------------------ Attendance ------------------
class TestAttendance:
    def test_mark_idempotent(self, session, tokens):
        # get students of cls-9A
        r = session.get(f"{API}/students?class_id=cls-9A", headers=auth(tokens["teacher"]), timeout=20)
        assert r.status_code == 200
        cls_students = r.json()
        assert len(cls_students) >= 1
        records = [{"student_id": s["id"], "status": "present"} for s in cls_students[:3]]
        body = {"class_id": "cls-9A", "date": "2026-02-01", "records": records}
        r1 = session.post(f"{API}/attendance/mark", headers=auth(tokens["teacher"]), json=body, timeout=20)
        assert r1.status_code == 200
        assert r1.json()["saved"] == len(records)
        # remark same date — should overwrite, not duplicate
        r2 = session.post(f"{API}/attendance/mark", headers=auth(tokens["teacher"]), json=body, timeout=20)
        assert r2.status_code == 200
        # verify only N records for that date+class
        r3 = session.get(f"{API}/attendance?class_id=cls-9A", headers=auth(tokens["teacher"]), timeout=20)
        assert r3.status_code == 200
        same_day = [a for a in r3.json() if a["date"] == "2026-02-01"]
        assert len(same_day) == len(records)

    def test_rbac_parent_cannot_mark(self, session, tokens):
        r = session.post(f"{API}/attendance/mark", headers=auth(tokens["parent"]),
                         json={"class_id": "cls-9A", "date": "2026-02-01", "records": []}, timeout=15)
        assert r.status_code == 403


# ------------------ Exams & Marks ------------------
class TestExamsMarks:
    def test_exams_list(self, session, tokens):
        r = session.get(f"{API}/exams", headers=auth(tokens["school_admin"]), timeout=15)
        assert r.status_code == 200
        exams = r.json()
        assert len(exams) >= 1
        assert any(e["type"] == "quarterly" for e in exams)

    def test_marks_count(self, session, tokens):
        r = session.get(f"{API}/marks", headers=auth(tokens["school_admin"]), timeout=20)
        assert r.status_code == 200
        marks = r.json()
        # 30 students * 5 subjects = 150
        assert len(marks) >= 140


# ------------------ Fees ------------------
class TestFees:
    def test_admin_sees_all(self, session, tokens):
        r = session.get(f"{API}/fees", headers=auth(tokens["school_admin"]), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 80  # ~90

    def test_parent_sees_only_own(self, session, tokens):
        r = session.get(f"{API}/fees", headers=auth(tokens["parent"]), timeout=20)
        assert r.status_code == 200
        fees = r.json()
        # Ananya has 3 fee terms
        assert 1 <= len(fees) <= 5

    def test_pay_mock(self, session, tokens):
        r = session.get(f"{API}/fees?status_filter=pending", headers=auth(tokens["school_admin"]), timeout=20)
        pending = r.json()
        if not pending:
            pytest.skip("no pending fee available to pay")
        fee_id = pending[0]["id"]
        r2 = session.post(f"{API}/fees/pay", headers=auth(tokens["school_admin"]),
                          json={"fee_id": fee_id, "method": "upi"}, timeout=20)
        assert r2.status_code == 200
        d = r2.json()
        assert d["ok"] is True
        assert d["receipt_no"].startswith("RCPT-")
        # verify status
        r3 = session.get(f"{API}/fees", headers=auth(tokens["school_admin"]), timeout=20)
        match = [f for f in r3.json() if f["id"] == fee_id]
        assert match and match[0]["status"] == "paid"


# ------------------ Circulars ------------------
class TestCirculars:
    def test_create_and_list(self, session, tokens):
        body = {"title": "TEST_Circular", "body": "Backend test circular body", "audience": "all"}
        r = session.post(f"{API}/circulars", headers=auth(tokens["school_admin"]), json=body, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = session.get(f"{API}/circulars", headers=auth(tokens["parent"]), timeout=15)
        assert r2.status_code == 200
        assert any(c["id"] == cid for c in r2.json())

    def test_rbac_student_cannot_create(self, session, tokens):
        r = session.post(f"{API}/circulars", headers=auth(tokens["student"]),
                         json={"title": "x", "body": "y"}, timeout=10)
        assert r.status_code == 403


# ------------------ AI ------------------
class TestAI:
    def test_ai_teacher_lesson_plan(self, session, tokens):
        body = {"task": "lesson_plan", "subject": "Math", "grade": "9", "topic": "Quadratic Equations"}
        r = session.post(f"{API}/ai/teacher", headers=auth(tokens["teacher"]), json=body, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("output"), str)
        assert len(d["output"]) > 20

    def test_ai_parent_chat(self, session, tokens):
        body = {"session_id": "test-parent-1", "message": "How is my child doing in attendance?"}
        r = session.post(f"{API}/ai/parent-chat", headers=auth(tokens["parent"]), json=body, timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json().get("reply"), str)
        assert len(r.json()["reply"]) > 10

    def test_ai_insights(self, session, tokens):
        r = session.post(f"{API}/ai/insights", headers=auth(tokens["school_admin"]), json={}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "insights" in d and isinstance(d["insights"], str)
        assert "stats" in d and "counts" in d["stats"]
