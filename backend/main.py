import os
import json
import shutil
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import get_db, init_db
from resume_parser import ResumeParser
from ai_service import (
    generate_mcq_questions,
    generate_coding_problems,
    generate_interview_question,
    evaluate_interview_answer,
    generate_final_report,
)

# Initialize
app = FastAPI(title="SkillProctor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize database on startup
@app.on_event("startup")
async def startup():
    init_db()


# ──────────────── Pydantic Models ────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class CandidateAccess(BaseModel):
    email: str
    candidate_id: int

class SubmitMCQAnswer(BaseModel):
    candidate_id: int
    test_id: int
    answers: dict  # {question_id: selected_option_index}

class SubmitCode(BaseModel):
    candidate_id: int
    test_id: int
    problem_id: int
    code: str
    language: str

class InterviewAnswer(BaseModel):
    candidate_id: int
    interview_id: int
    answer: str

class ProctoringEvent(BaseModel):
    candidate_id: int
    test_type: str
    test_id: int
    event_type: str
    details: Optional[str] = ""
    severity: Optional[str] = "low"

class RunCode(BaseModel):
    code: str
    language: str
    input_data: Optional[str] = ""

class RunSQL(BaseModel):
    query: str


# ──────────────── Auth Routes ────────────────

@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    db = get_db()
    user = db.execute(
        "SELECT * FROM admin_users WHERE username = ? AND password = ?",
        (req.username, req.password)
    ).fetchone()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"success": True, "user": {"id": user["id"], "name": user["name"], "role": user["role"]}}


@app.post("/api/candidate/login")
async def candidate_login(req: CandidateAccess):
    db = get_db()
    candidate = db.execute(
        "SELECT * FROM candidates WHERE email = ? AND id = ?",
        (req.email, req.candidate_id)
    ).fetchone()
    db.close()
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid candidate credentials")
    return {
        "success": True,
        "candidate": {
            "id": candidate["id"],
            "name": candidate["name"],
            "email": candidate["email"],
            "status": candidate["status"],
            "skills": json.loads(candidate["skills"]),
            "sql_passed": bool(dict(candidate).get("sql_passed", 0)),
        }
    }


# ──────────────── Resume Upload & Parsing ────────────────

@app.post("/api/admin/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(None),
    email: str = Form(None),
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Save file
    file_bytes = await file.read()
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Parse resume
    parsed = ResumeParser.parse_resume(file_bytes=file_bytes)
    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])

    # Use provided name/email or extracted ones
    candidate_name = name or parsed.get("name", "Unknown")
    candidate_email = email or parsed.get("email", "")

    if not candidate_email:
        raise HTTPException(status_code=400, detail="Email is required. Please provide email or ensure it's in the resume.")

    # Save to database
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO candidates (name, email, phone, resume_path, resume_text, skills, github_url, linkedin_url, coding_platforms, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')""",
            (
                candidate_name,
                candidate_email,
                parsed.get("phone", ""),
                file_path,
                parsed.get("resume_text", ""),
                json.dumps(parsed.get("skills", [])),
                parsed.get("github_url", ""),
                parsed.get("linkedin_url", ""),
                json.dumps(parsed.get("coding_platforms", {})),
            )
        )
        db.commit()
        candidate_id = cursor.lastrowid
    except Exception as e:
        db.close()
        if "UNIQUE constraint" in str(e):
            raise HTTPException(status_code=400, detail="A candidate with this email already exists.")
        raise HTTPException(status_code=500, detail=str(e))

    db.close()
    return {
        "success": True,
        "candidate_id": candidate_id,
        "parsed_data": {
            "name": candidate_name,
            "email": candidate_email,
            "phone": parsed.get("phone", ""),
            "skills": parsed.get("skills", []),
            "github_url": parsed.get("github_url", ""),
            "linkedin_url": parsed.get("linkedin_url", ""),
            "coding_platforms": parsed.get("coding_platforms", {}),
        }
    }


# ──────────────── Candidate Management ────────────────

@app.get("/api/admin/candidates")
async def get_candidates():
    db = get_db()
    candidates = db.execute("SELECT * FROM candidates ORDER BY created_at DESC").fetchall()
    db.close()
    result = []
    for c in candidates:
        result.append({
            "id": c["id"],
            "name": c["name"],
            "email": c["email"],
            "phone": c["phone"],
            "skills": json.loads(c["skills"]),
            "github_url": c["github_url"],
            "linkedin_url": c["linkedin_url"],
            "coding_platforms": json.loads(c["coding_platforms"]),
            "status": c["status"],
            "created_at": c["created_at"],
        })
    return {"candidates": result}


@app.get("/api/admin/candidates/{candidate_id}")
async def get_candidate(candidate_id: int):
    db = get_db()
    c = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not c:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get test results
    mcq = db.execute("SELECT * FROM mcq_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    coding = db.execute("SELECT * FROM coding_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    interview = db.execute("SELECT * FROM ai_interviews WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    report = db.execute("SELECT * FROM reports WHERE candidate_id = ?", (candidate_id,)).fetchone()
    violations = db.execute("SELECT * FROM proctoring_logs WHERE candidate_id = ? ORDER BY timestamp DESC", (candidate_id,)).fetchall()

    db.close()

    return {
        "candidate": {
            "id": c["id"],
            "name": c["name"],
            "email": c["email"],
            "phone": c["phone"],
            "skills": json.loads(c["skills"]),
            "github_url": c["github_url"],
            "linkedin_url": c["linkedin_url"],
            "coding_platforms": json.loads(c["coding_platforms"]),
            "status": c["status"],
            "resume_text": c["resume_text"],
            "created_at": c["created_at"],
        },
        "mcq_test": dict(mcq) if mcq else None,
        "coding_test": dict(coding) if coding else None,
        "interview": dict(interview) if interview else None,
        "report": dict(report) if report else None,
        "violations": [dict(v) for v in violations],
    }


@app.delete("/api/admin/candidates/{candidate_id}")
async def delete_candidate(candidate_id: int):
    db = get_db()
    db.execute("DELETE FROM candidates WHERE id = ?", (candidate_id,))
    db.commit()
    db.close()
    return {"success": True}


# ──────────────── Test Generation ────────────────

@app.post("/api/admin/generate-test/{candidate_id}")
async def generate_test(candidate_id: int):
    """Generate MCQ + Coding test for a candidate."""
    db = get_db()
    candidate = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not candidate:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")

    skills = json.loads(candidate["skills"])
    if not skills:
        db.close()
        raise HTTPException(status_code=400, detail="No skills found. Please ensure resume has extractable skills.")

    # Generate MCQ questions
    mcq_questions = await generate_mcq_questions(skills, count=20)

    # Generate coding problems
    coding_problems = await generate_coding_problems(skills, count=3)

    # Save MCQ test
    cursor = db.execute(
        """INSERT INTO mcq_tests (candidate_id, questions, total_marks, passing_score, status)
           VALUES (?, ?, ?, 10, 'pending')""",
        (candidate_id, json.dumps(mcq_questions), len(mcq_questions))
    )
    mcq_test_id = cursor.lastrowid

    # Save coding test
    cursor = db.execute(
        """INSERT INTO coding_tests (candidate_id, mcq_test_id, problems, total_marks, status)
           VALUES (?, ?, ?, ?, 'pending')""",
        (candidate_id, mcq_test_id, json.dumps(coding_problems), len(coding_problems) * 10)
    )
    coding_test_id = cursor.lastrowid

    # Update candidate status
    db.execute("UPDATE candidates SET status = 'test1_ready' WHERE id = ?", (candidate_id,))
    db.commit()
    db.close()

    return {
        "success": True,
        "mcq_test_id": mcq_test_id,
        "coding_test_id": coding_test_id,
        "mcq_count": len(mcq_questions),
        "coding_count": len(coding_problems),
    }


# ──────────────── Student Test Routes ────────────────

@app.get("/api/student/test-info/{candidate_id}")
async def get_test_info(candidate_id: int):
    """Get test information for a candidate."""
    db = get_db()
    candidate = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not candidate:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")

    mcq = db.execute(
        "SELECT * FROM mcq_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1",
        (candidate_id,)
    ).fetchone()

    coding = db.execute(
        "SELECT * FROM coding_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1",
        (candidate_id,)
    ).fetchone()

    interview = db.execute(
        "SELECT * FROM ai_interviews WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1",
        (candidate_id,)
    ).fetchone()

    db.close()

    return {
        "candidate": {
            "id": candidate["id"],
            "name": candidate["name"],
            "status": candidate["status"],
            "skills": json.loads(candidate["skills"]),
            "sql_passed": bool(dict(candidate).get("sql_passed", 0)),
        },
        "mcq_test": {
            "id": mcq["id"],
            "status": mcq["status"],
            "total_marks": mcq["total_marks"],
            "duration_minutes": mcq["duration_minutes"],
            "score": mcq["score"],
        } if mcq else None,
        "coding_test": {
            "id": coding["id"],
            "status": coding["status"],
            "total_marks": coding["total_marks"],
            "score": coding["score"],
        } if coding else None,
        "interview": {
            "id": interview["id"],
            "status": interview["status"],
            "total_questions": interview["total_questions"],
            "current_question_index": interview["current_question_index"],
            "overall_score": interview["overall_score"],
        } if interview else None,
    }


@app.post("/api/student/start-mcq/{test_id}")
async def start_mcq_test(test_id: int):
    """Start (or resume) MCQ test and return questions."""
    db = get_db()
    test = db.execute("SELECT * FROM mcq_tests WHERE id = ?", (test_id,)).fetchone()
    if not test:
        db.close()
        raise HTTPException(status_code=404, detail="Test not found")

    if test["status"] in ["completed", "passed", "failed"]:
        db.close()
        raise HTTPException(status_code=400, detail="Test already completed")

    now = datetime.utcnow().isoformat()
    if test["status"] == "pending":
        end_time = (datetime.utcnow() + timedelta(minutes=test["duration_minutes"])).isoformat()
        db.execute(
            "UPDATE mcq_tests SET status = 'in_progress', start_time = ?, end_time = ? WHERE id = ?",
            (now, end_time, test_id)
        )
        db.execute("UPDATE candidates SET status = 'test1_in_progress' WHERE id = ?", (test["candidate_id"],))
        db.commit()
    else:
        end_time = test["end_time"]

    questions = json.loads(test["questions"])
    # Remove correct answers from questions sent to student
    safe_questions = []
    for q in questions:
        safe_q = {k: v for k, v in q.items() if k not in ["correct_answer", "explanation"]}
        safe_questions.append(safe_q)

    db.close()
    return {
        "test_id": test_id,
        "questions": safe_questions,
        "duration_minutes": test["duration_minutes"],
        "end_time": end_time,
        "existing_answers": json.loads(test["answers"]) if test["answers"] != "{}" else {},
    }


@app.post("/api/student/submit-mcq")
async def submit_mcq(data: SubmitMCQAnswer):
    """Submit MCQ answers and calculate score."""
    db = get_db()
    test = db.execute("SELECT * FROM mcq_tests WHERE id = ?", (data.test_id,)).fetchone()
    if not test:
        db.close()
        raise HTTPException(status_code=404, detail="Test not found")

    if test["status"] in ["completed", "passed", "failed"]:
        db.close()
        raise HTTPException(status_code=400, detail="Test already submitted")

    questions = json.loads(test["questions"])
    correct = 0
    total = len(questions)

    for q in questions:
        q_id = str(q["id"])
        if q_id in data.answers:
            if data.answers[q_id] == q.get("correct_answer"):
                correct += 1

    score = (correct / total * 100) if total > 0 else 0
    passed = score >= test["passing_score"]
    status = "passed" if passed else "failed"

    db.execute(
        "UPDATE mcq_tests SET answers = ?, score = ?, status = ? WHERE id = ?",
        (json.dumps(data.answers), score, status, data.test_id)
    )

    # Update candidate status
    if passed:
        db.execute("UPDATE candidates SET status = 'test1_mcq_passed' WHERE id = ?", (data.candidate_id,))
    else:
        db.execute("UPDATE candidates SET status = 'test1_failed' WHERE id = ?", (data.candidate_id,))

    db.commit()
    db.close()

    return {
        "success": True,
        "score": score,
        "correct": correct,
        "total": total,
        "passed": passed,
        "status": status,
    }


@app.post("/api/student/start-coding/{test_id}")
async def start_coding_test(test_id: int):
    """Start coding test and return problems."""
    db = get_db()
    test = db.execute("SELECT * FROM coding_tests WHERE id = ?", (test_id,)).fetchone()
    if not test:
        db.close()
        raise HTTPException(status_code=404, detail="Test not found")

    if test["status"] in ["completed", "passed", "failed"]:
        db.close()
        raise HTTPException(status_code=400, detail="Test already completed")

    if test["status"] == "pending":
        db.execute("UPDATE coding_tests SET status = 'in_progress' WHERE id = ?", (test_id,))
        db.commit()

    problems = json.loads(test["problems"])
    # Remove test case expected outputs (keep only sample)
    safe_problems = []
    for p in problems:
        safe_p = dict(p)
        if "test_cases" in safe_p:
            # Only show first test case as sample
            safe_p["test_cases"] = safe_p["test_cases"][:1]
        safe_problems.append(safe_p)

    db.close()
    return {
        "test_id": test_id,
        "problems": safe_problems,
        "existing_submissions": json.loads(test["submissions"]) if test["submissions"] != "{}" else {},
    }


@app.post("/api/student/submit-code")
async def submit_code(data: SubmitCode):
    """Submit code solution for a coding problem with test case evaluation."""
    import subprocess
    import tempfile

    db = get_db()
    test = db.execute("SELECT * FROM coding_tests WHERE id = ?", (data.test_id,)).fetchone()
    if not test:
        db.close()
        raise HTTPException(status_code=404, detail="Test not found")

    # Get test cases from problems
    problems = json.loads(test["problems"])
    problem = None
    for p in problems:
        pid = p.get("id", problems.index(p) + 1)
        if pid == data.problem_id or str(pid) == str(data.problem_id):
            problem = p
            break

    test_case_results = []
    total_passed = 0
    total_cases = 0

    if problem and problem.get("test_cases"):
        test_cases = problem["test_cases"]
        total_cases = len(test_cases)

        # Determine language settings
        if data.language == "python":
            suffix = ".py"
            cmd_prefix = ["python"]
        elif data.language == "javascript":
            suffix = ".js"
            cmd_prefix = ["node"]
        else:
            suffix = ".py"
            cmd_prefix = ["python"]

        for idx, tc in enumerate(test_cases):
            tc_input = tc.get("input", "")
            tc_expected = str(tc.get("output", tc.get("expected_output", ""))).strip()

            try:
                with tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False) as f:
                    f.write(data.code)
                    temp_path = f.name

                run_result = subprocess.run(
                    cmd_prefix + [temp_path],
                    input=str(tc_input), capture_output=True, text=True, timeout=10
                )

                os.unlink(temp_path)

                actual_output = run_result.stdout.strip()
                error_output = run_result.stderr.strip()

                if run_result.returncode != 0:
                    test_case_results.append({
                        "test_case": idx + 1,
                        "passed": False,
                        "input": str(tc_input)[:100],
                        "expected": tc_expected[:100],
                        "actual": error_output[:200] or "Runtime Error",
                        "error": True,
                    })
                else:
                    passed = actual_output == tc_expected
                    if passed:
                        total_passed += 1
                    test_case_results.append({
                        "test_case": idx + 1,
                        "passed": passed,
                        "input": str(tc_input)[:100],
                        "expected": tc_expected[:100],
                        "actual": actual_output[:100],
                        "error": False,
                    })
            except subprocess.TimeoutExpired:
                try: os.unlink(temp_path)
                except: pass
                test_case_results.append({
                    "test_case": idx + 1,
                    "passed": False,
                    "input": str(tc_input)[:100],
                    "expected": tc_expected[:100],
                    "actual": "Time Limit Exceeded (10s)",
                    "error": True,
                })
            except Exception as e:
                test_case_results.append({
                    "test_case": idx + 1,
                    "passed": False,
                    "input": str(tc_input)[:100],
                    "expected": tc_expected[:100],
                    "actual": str(e)[:200],
                    "error": True,
                })

    # Save submission with results
    submissions = json.loads(test["submissions"]) if test["submissions"] != "{}" else {}
    submissions[str(data.problem_id)] = {
        "code": data.code,
        "language": data.language,
        "submitted_at": datetime.utcnow().isoformat(),
        "test_results": test_case_results,
        "passed_count": total_passed,
        "total_count": total_cases,
    }

    db.execute(
        "UPDATE coding_tests SET submissions = ? WHERE id = ?",
        (json.dumps(submissions), data.test_id)
    )
    db.commit()
    db.close()

    return {
        "success": True,
        "test_results": test_case_results,
        "passed_count": total_passed,
        "total_count": total_cases,
        "all_passed": total_passed == total_cases and total_cases > 0,
    }


@app.post("/api/student/finish-coding/{test_id}")
async def finish_coding_test(test_id: int):
    """Finish coding test and calculate score."""
    db = get_db()
    test = db.execute("SELECT * FROM coding_tests WHERE id = ?", (test_id,)).fetchone()
    if not test:
        db.close()
        raise HTTPException(status_code=404, detail="Test not found")

    submissions = json.loads(test["submissions"]) if test["submissions"] != "{}" else {}
    problems = json.loads(test["problems"])
    solved = len(submissions)
    total = len(problems)
    score = (solved / total * 100) if total > 0 else 0
    passed = score >= 10  # Reduced pass mark for easier testing

    status = "passed" if passed else "failed"
    db.execute(
        "UPDATE coding_tests SET score = ?, status = ? WHERE id = ?",
        (score, status, test_id)
    )

    # Check if MCQ also passed
    mcq = db.execute(
        "SELECT * FROM mcq_tests WHERE candidate_id = (SELECT candidate_id FROM coding_tests WHERE id = ?) ORDER BY created_at DESC LIMIT 1",
        (test_id,)
    ).fetchone()

    candidate_id = test["candidate_id"]
    mcq_passed = mcq and mcq["status"] == "passed"

    if mcq_passed and passed:
        db.execute("UPDATE candidates SET status = 'test1_passed' WHERE id = ?", (candidate_id,))
        # Create AI interview
        cursor = db.execute(
            "INSERT INTO ai_interviews (candidate_id, status) VALUES (?, 'pending')",
            (candidate_id,)
        )
        interview_id = cursor.lastrowid
    elif passed:
        db.execute("UPDATE candidates SET status = 'test1_coding_passed' WHERE id = ?", (candidate_id,))
    else:
        db.execute("UPDATE candidates SET status = 'test1_failed' WHERE id = ?", (candidate_id,))

    db.commit()
    db.close()

    return {
        "success": True,
        "score": score,
        "solved": solved,
        "total": total,
        "passed": passed,
        "test1_fully_passed": mcq_passed and passed,
    }


# ──────────────── AI Interview Routes ────────────────

@app.post("/api/student/start-interview/{interview_id}")
async def start_interview(interview_id: int):
    """Start AI interview and get first question."""
    db = get_db()
    interview = db.execute("SELECT * FROM ai_interviews WHERE id = ?", (interview_id,)).fetchone()
    if not interview:
        db.close()
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview["status"] in ["completed", "passed", "failed"]:
        db.close()
        raise HTTPException(status_code=400, detail="Interview already completed")

    candidate = db.execute(
        "SELECT * FROM candidates WHERE id = ?", (interview["candidate_id"],)
    ).fetchone()

    skills = json.loads(candidate["skills"])
    coding_platforms = json.loads(candidate["coding_platforms"]) if candidate["coding_platforms"] else {}

    # Generate first question
    question_data = await generate_interview_question(
        skills=skills,
        resume_text=candidate["resume_text"] or "",
        previous_qa=[],
        question_number=1,
        total_questions=interview["total_questions"],
        github_url=candidate["github_url"] or "",
        coding_platforms=coding_platforms,
    )

    qa_list = [{"question_data": question_data, "question": question_data["question"], "answer": None, "score": None, "evaluation": None}]

    now = datetime.utcnow().isoformat()
    db.execute(
        "UPDATE ai_interviews SET status = 'in_progress', start_time = ?, questions_answers = ?, current_question_index = 0 WHERE id = ?",
        (now, json.dumps(qa_list), interview_id)
    )
    db.execute("UPDATE candidates SET status = 'test2_in_progress' WHERE id = ?", (interview["candidate_id"],))
    db.commit()
    db.close()

    return {
        "interview_id": interview_id,
        "question": question_data["question"],
        "category": question_data.get("category", ""),
        "difficulty": question_data.get("difficulty", "medium"),
        "question_number": 1,
        "total_questions": interview["total_questions"],
    }


@app.post("/api/student/answer-interview")
async def answer_interview(data: InterviewAnswer):
    """Submit answer and get next question or finish."""
    db = get_db()
    interview = db.execute("SELECT * FROM ai_interviews WHERE id = ?", (data.interview_id,)).fetchone()
    if not interview:
        db.close()
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.execute(
        "SELECT * FROM candidates WHERE id = ?", (data.candidate_id,)
    ).fetchone()

    skills = json.loads(candidate["skills"])
    coding_platforms = json.loads(candidate["coding_platforms"]) if candidate["coding_platforms"] else {}

    qa_list = json.loads(interview["questions_answers"])
    current_idx = interview["current_question_index"]

    # Evaluate the answer
    current_qa = qa_list[current_idx]
    evaluation = await evaluate_interview_answer(
        question=current_qa["question"],
        answer=data.answer,
        expected_key_points=current_qa.get("question_data", {}).get("expected_key_points", []),
        skill_category=current_qa.get("question_data", {}).get("category", "general"),
    )

    # Update current Q&A
    qa_list[current_idx]["answer"] = data.answer
    qa_list[current_idx]["score"] = evaluation.get("score", 5)
    qa_list[current_idx]["evaluation"] = evaluation

    next_idx = current_idx + 1
    is_complete = next_idx >= interview["total_questions"]

    if not is_complete:
        # Generate next question
        question_data = await generate_interview_question(
            skills=skills,
            resume_text=candidate["resume_text"] or "",
            previous_qa=qa_list,
            question_number=next_idx + 1,
            total_questions=interview["total_questions"],
            github_url=candidate["github_url"] or "",
            coding_platforms=coding_platforms,
        )

        qa_list.append({
            "question_data": question_data,
            "question": question_data["question"],
            "answer": None,
            "score": None,
            "evaluation": None,
        })

        db.execute(
            "UPDATE ai_interviews SET questions_answers = ?, current_question_index = ? WHERE id = ?",
            (json.dumps(qa_list), next_idx, data.interview_id)
        )
        db.commit()
        db.close()

        return {
            "evaluation": evaluation,
            "is_complete": False,
            "next_question": question_data["question"],
            "next_category": question_data.get("category", ""),
            "next_difficulty": question_data.get("difficulty", "medium"),
            "question_number": next_idx + 1,
            "total_questions": interview["total_questions"],
        }
    else:
        # Interview complete - calculate overall score
        scores = [qa.get("score", 0) for qa in qa_list if qa.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        passed = avg_score >= 1  # Reduced pass mark for easier testing

        now = datetime.utcnow().isoformat()
        status = "passed" if passed else "failed"

        db.execute(
            "UPDATE ai_interviews SET questions_answers = ?, overall_score = ?, status = ?, end_time = ? WHERE id = ?",
            (json.dumps(qa_list), avg_score, status, now, data.interview_id)
        )

        candidate_status = "completed" if passed else "test2_failed"
        db.execute("UPDATE candidates SET status = ? WHERE id = ?", (candidate_status, data.candidate_id))

        # Generate report
        mcq = db.execute("SELECT * FROM mcq_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (data.candidate_id,)).fetchone()
        coding = db.execute("SELECT * FROM coding_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (data.candidate_id,)).fetchone()
        violations = db.execute("SELECT * FROM proctoring_logs WHERE candidate_id = ?", (data.candidate_id,)).fetchall()

        # Proctoring summary
        proctoring_summary = {
            "total_violations": len(violations),
            "tab_switches": sum(1 for v in violations if v["event_type"] == "tab_switch"),
            "face_not_detected": sum(1 for v in violations if v["event_type"] == "face_not_detected"),
            "phone_detected": sum(1 for v in violations if v["event_type"] == "phone_detected"),
            "eye_violations": sum(1 for v in violations if v["event_type"] == "eye_movement"),
        }

        mcq_results = {
            "score": mcq["score"] if mcq else 0,
            "total": mcq["total_marks"] if mcq else 0,
            "percentage": mcq["score"] if mcq else 0,
            "passed": mcq["status"] == "passed" if mcq else False,
        }

        coding_results = {
            "score": coding["score"] if coding else 0,
            "total": coding["total_marks"] if coding else 0,
            "solved": len(json.loads(coding["submissions"])) if coding and coding["submissions"] != "{}" else 0,
            "total_problems": len(json.loads(coding["problems"])) if coding else 0,
            "passed": coding["status"] == "passed" if coding else False,
        }

        interview_results = {
            "avg_score": avg_score,
            "answered": len(scores),
            "total": interview["total_questions"],
            "passed": passed,
            "highlights": [
                {"q": qa["question"][:100], "score": qa.get("score", 0)}
                for qa in qa_list[:5]
            ],
        }

        report_data = await generate_final_report(
            candidate_info={"name": candidate["name"], "skills": skills},
            mcq_results=mcq_results,
            coding_results=coding_results,
            interview_results=interview_results,
            proctoring_summary=proctoring_summary,
        )

        # Save report
        test1_passed = mcq_results["passed"] and coding_results["passed"]
        overall_status = "passed" if test1_passed and passed else ("partial" if test1_passed or passed else "failed")

        try:
            db.execute(
                """INSERT OR REPLACE INTO reports
                   (candidate_id, mcq_score, mcq_passed, coding_score, coding_passed, test1_passed,
                    interview_score, interview_passed, overall_status, detailed_feedback, proctoring_summary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    data.candidate_id,
                    mcq_results["score"],
                    mcq_results["passed"],
                    coding_results["score"],
                    coding_results["passed"],
                    test1_passed,
                    avg_score,
                    passed,
                    overall_status,
                    json.dumps(report_data),
                    json.dumps(proctoring_summary),
                )
            )
        except:
            pass

        db.commit()
        db.close()

        return {
            "evaluation": evaluation,
            "is_complete": True,
            "overall_score": avg_score,
            "passed": passed,
            "status": status,
        }


# ──────────────── Proctoring Routes ────────────────

@app.post("/api/proctoring/log")
async def log_proctoring_event(event: ProctoringEvent):
    """Log a proctoring violation event."""
    db = get_db()

    db.execute(
        """INSERT INTO proctoring_logs (candidate_id, test_type, test_id, event_type, details, severity)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (event.candidate_id, event.test_type, event.test_id, event.event_type, event.details, event.severity)
    )

    # Update violation count on the test
    if event.test_type == "mcq":
        db.execute(
            "UPDATE mcq_tests SET violation_count = violation_count + 1 WHERE id = ?",
            (event.test_id,)
        )
    elif event.test_type == "interview":
        db.execute(
            "UPDATE ai_interviews SET violation_count = violation_count + 1 WHERE id = ?",
            (event.test_id,)
        )

    db.commit()
    db.close()
    return {"success": True}


@app.get("/api/proctoring/logs/{candidate_id}")
async def get_proctoring_logs(candidate_id: int):
    db = get_db()
    logs = db.execute(
        "SELECT * FROM proctoring_logs WHERE candidate_id = ? ORDER BY timestamp DESC",
        (candidate_id,)
    ).fetchall()
    db.close()
    return {"logs": [dict(l) for l in logs]}


# ──────────────── Report Routes ────────────────

@app.get("/api/admin/reports")
async def get_all_reports():
    db = get_db()
    reports = db.execute("""
        SELECT r.*, c.name, c.email, c.skills, c.status as candidate_status
        FROM reports r
        JOIN candidates c ON r.candidate_id = c.id
        ORDER BY r.generated_at DESC
    """).fetchall()
    db.close()

    result = []
    for r in reports:
        result.append({
            "id": r["id"],
            "candidate_id": r["candidate_id"],
            "candidate_name": r["name"],
            "candidate_email": r["email"],
            "skills": json.loads(r["skills"]),
            "mcq_score": r["mcq_score"],
            "mcq_passed": bool(r["mcq_passed"]),
            "coding_score": r["coding_score"],
            "coding_passed": bool(r["coding_passed"]),
            "test1_passed": bool(r["test1_passed"]),
            "interview_score": r["interview_score"],
            "interview_passed": bool(r["interview_passed"]),
            "overall_status": r["overall_status"],
            "detailed_feedback": json.loads(r["detailed_feedback"]) if r["detailed_feedback"] else {},
            "proctoring_summary": json.loads(r["proctoring_summary"]) if r["proctoring_summary"] else {},
            "generated_at": r["generated_at"],
        })
    return {"reports": result}


@app.get("/api/admin/report/{candidate_id}")
async def get_candidate_report(candidate_id: int):
    db = get_db()
    report = db.execute("SELECT * FROM reports WHERE candidate_id = ?", (candidate_id,)).fetchone()
    if not report:
        db.close()
        raise HTTPException(status_code=404, detail="Report not found")

    candidate = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    interview = db.execute("SELECT * FROM ai_interviews WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    mcq = db.execute("SELECT * FROM mcq_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    violations = db.execute("SELECT * FROM proctoring_logs WHERE candidate_id = ?", (candidate_id,)).fetchall()

    db.close()

    return {
        "report": dict(report),
        "candidate": {
            "name": candidate["name"],
            "email": candidate["email"],
            "skills": json.loads(candidate["skills"]),
            "github_url": candidate["github_url"],
            "linkedin_url": candidate["linkedin_url"],
            "coding_platforms": json.loads(candidate["coding_platforms"]) if candidate["coding_platforms"] else {},
        },
        "interview_qa": json.loads(interview["questions_answers"]) if interview else [],
        "mcq_details": {
            "score": mcq["score"],
            "total": mcq["total_marks"],
            "violations": mcq["violation_count"],
        } if mcq else None,
        "violations": [dict(v) for v in violations],
    }


# ──────────────── Dashboard Stats ────────────────

@app.get("/api/admin/dashboard")
async def get_dashboard():
    db = get_db()
    total = db.execute("SELECT COUNT(*) as count FROM candidates").fetchone()["count"]
    pending = db.execute("SELECT COUNT(*) as count FROM candidates WHERE status = 'pending'").fetchone()["count"]
    in_test = db.execute("SELECT COUNT(*) as count FROM candidates WHERE status LIKE '%in_progress%'").fetchone()["count"]
    completed = db.execute("SELECT COUNT(*) as count FROM candidates WHERE status = 'completed'").fetchone()["count"]
    passed_all = db.execute("SELECT COUNT(*) as count FROM reports WHERE overall_status = 'passed'").fetchone()["count"]
    failed = db.execute("SELECT COUNT(*) as count FROM reports WHERE overall_status = 'failed'").fetchone()["count"]

    recent = db.execute("""
        SELECT c.name, c.email, c.status, c.created_at
        FROM candidates c ORDER BY c.created_at DESC LIMIT 5
    """).fetchall()

    db.close()
    return {
        "stats": {
            "total_candidates": total,
            "pending": pending,
            "in_test": in_test,
            "completed": completed,
            "passed": passed_all,
            "failed": failed,
        },
        "recent_candidates": [dict(r) for r in recent],
    }


# ──────────────── Reset Database ────────────────

@app.post("/api/admin/reset-database")
async def reset_database():
    """Reset all data in the database."""
    db = get_db()
    try:
        # Delete in proper order to avoid FK issues
        db.execute("DELETE FROM proctoring_logs")
        db.execute("DELETE FROM reports")
        db.execute("DELETE FROM interview_questions")
        db.execute("DELETE FROM ai_interviews")
        db.execute("DELETE FROM coding_submissions")
        db.execute("DELETE FROM coding_tests")
        db.execute("DELETE FROM mcq_tests")
        db.execute("DELETE FROM candidates")
        db.commit()
    except Exception as e:
        # Some tables might not exist - just ignore
        db.rollback()
        # Try simpler approach
        for table in ["proctoring_logs", "reports", "ai_interviews", "coding_tests", "mcq_tests", "candidates"]:
            try:
                db.execute(f"DELETE FROM {table}")
            except:
                pass
        db.commit()
    finally:
        db.close()

    # Clean uploaded files
    import glob
    for f in glob.glob(os.path.join(UPLOAD_DIR, "*")):
        try:
            os.remove(f)
        except:
            pass

    return {"success": True, "message": "Database reset successfully"}


# ──────────────── Code Execution ────────────────

@app.post("/api/student/run-code")
async def run_code(data: RunCode):
    """Run code with custom input and return output."""
    import subprocess
    import tempfile

    if data.language == "python":
        suffix = ".py"
        cmd_prefix = ["python"]
    elif data.language == "javascript":
        suffix = ".js"
        cmd_prefix = ["node"]
    elif data.language == "java":
        # For Java, we need to handle compilation
        suffix = ".java"
        cmd_prefix = None
    else:
        return {"success": False, "output": "", "error": f"Unsupported language: {data.language}"}

    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False) as f:
            f.write(data.code)
            temp_path = f.name

        if data.language == "java":
            # Extract class name and compile
            class_name = "Main"
            compile_result = subprocess.run(
                ["javac", temp_path],
                capture_output=True, text=True, timeout=10
            )
            if compile_result.returncode != 0:
                os.unlink(temp_path)
                return {"success": False, "output": "", "error": compile_result.stderr}

            run_result = subprocess.run(
                ["java", "-cp", os.path.dirname(temp_path), class_name],
                input=data.input_data, capture_output=True, text=True, timeout=10
            )
        else:
            run_result = subprocess.run(
                cmd_prefix + [temp_path],
                input=data.input_data, capture_output=True, text=True, timeout=10
            )

        os.unlink(temp_path)

        if run_result.returncode != 0:
            return {
                "success": False,
                "output": run_result.stdout,
                "error": run_result.stderr,
            }

        return {
            "success": True,
            "output": run_result.stdout,
            "error": run_result.stderr if run_result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        try:
            os.unlink(temp_path)
        except:
            pass
        return {"success": False, "output": "", "error": "Execution timed out (10s limit)"}
    except FileNotFoundError:
        try:
            os.unlink(temp_path)
        except:
            pass
        return {"success": False, "output": "", "error": f"Runtime for {data.language} not found. Make sure it's installed."}
    except Exception as e:
        try:
            os.unlink(temp_path)
        except:
            pass
        return {"success": False, "output": "", "error": str(e)}


# ──────────────── SQL Execution ────────────────

@app.post("/api/student/run-sql")
async def run_sql(data: RunSQL):
    """Execute SQL query in a sandbox database and return results."""
    import sqlite3

    # Create sandbox database with sample tables
    try:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Create sample tables if they don't exist
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                salary REAL,
                hire_date TEXT,
                manager_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                budget REAL,
                location TEXT
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department_id INTEGER,
                start_date TEXT,
                end_date TEXT,
                status TEXT DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY,
                customer_name TEXT,
                product TEXT,
                quantity INTEGER,
                price REAL,
                order_date TEXT
            );

            -- Insert sample data if empty
            INSERT OR IGNORE INTO employees VALUES
                (1, 'Alice Johnson', 'Engineering', 95000, '2020-01-15', NULL),
                (2, 'Bob Smith', 'Engineering', 85000, '2021-03-20', 1),
                (3, 'Carol Williams', 'Marketing', 75000, '2019-06-10', NULL),
                (4, 'David Brown', 'Engineering', 92000, '2020-08-05', 1),
                (5, 'Eve Davis', 'Marketing', 70000, '2022-01-08', 3),
                (6, 'Frank Miller', 'HR', 80000, '2021-09-15', NULL),
                (7, 'Grace Wilson', 'Engineering', 98000, '2018-03-22', 1),
                (8, 'Henry Taylor', 'Marketing', 72000, '2023-02-14', 3),
                (9, 'Ivy Anderson', 'HR', 68000, '2022-07-01', 6),
                (10, 'Jack Thomas', 'Engineering', 88000, '2021-11-30', 1);

            INSERT OR IGNORE INTO departments VALUES
                (1, 'Engineering', 500000, 'Building A'),
                (2, 'Marketing', 200000, 'Building B'),
                (3, 'HR', 150000, 'Building C'),
                (4, 'Sales', 300000, 'Building B');

            INSERT OR IGNORE INTO projects VALUES
                (1, 'Project Alpha', 1, '2023-01-01', '2023-12-31', 'active'),
                (2, 'Project Beta', 1, '2023-06-01', '2024-06-01', 'active'),
                (3, 'Campaign X', 2, '2023-03-01', '2023-09-30', 'completed'),
                (4, 'HR Portal', 3, '2023-04-01', NULL, 'active');

            INSERT OR IGNORE INTO orders VALUES
                (1, 'John Doe', 'Laptop', 2, 999.99, '2023-01-15'),
                (2, 'Jane Roe', 'Mouse', 5, 29.99, '2023-02-20'),
                (3, 'John Doe', 'Keyboard', 1, 79.99, '2023-03-10'),
                (4, 'Alice Cooper', 'Monitor', 3, 349.99, '2023-03-15'),
                (5, 'Jane Roe', 'Laptop', 1, 999.99, '2023-04-01'),
                (6, 'Bob Builder', 'Mouse', 10, 29.99, '2023-04-10'),
                (7, 'Alice Cooper', 'Keyboard', 2, 79.99, '2023-05-20');
        """)
        conn.commit()

        # Execute user query
        query = data.query.strip()

        # Security: block dangerous operations
        dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE']
        query_upper = query.upper()
        for d in dangerous:
            if query_upper.startswith(d):
                return {
                    "success": False,
                    "columns": [],
                    "rows": [],
                    "error": f"'{d}' operations are not allowed in the sandbox. Only SELECT queries are permitted.",
                    "row_count": 0,
                }

        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = [list(row) for row in cursor.fetchall()]

        conn.close()

        return {
            "success": True,
            "columns": columns,
            "rows": rows[:100],  # Limit to 100 rows
            "error": "",
            "row_count": len(rows),
        }
    except Exception as e:
        return {
            "success": False,
            "columns": [],
            "rows": [],
            "error": str(e),
            "row_count": 0,
        }


class EvaluateSQL(BaseModel):
    query: str
    reference_query: str


@app.post("/api/student/evaluate-sql")
async def evaluate_sql(data: EvaluateSQL):
    """Evaluate a SQL query by comparing its result to a reference query."""
    import sqlite3 as sql3
    try:
        conn = sql3.connect(":memory:")
        cursor = conn.cursor()

        # Create and seed the sandbox database (same as run_sql)
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY,
                name TEXT, department TEXT, salary REAL,
                hire_date TEXT, manager_id INTEGER
            );
            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY, name TEXT, budget REAL, location TEXT
            );
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY, name TEXT, department_id INTEGER,
                start_date TEXT, end_date TEXT, status TEXT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY, customer_name TEXT, product TEXT,
                quantity INTEGER, price REAL, order_date TEXT
            );
            INSERT OR IGNORE INTO employees VALUES
                (1, 'Alice Johnson', 'Engineering', 95000, '2020-01-15', NULL),
                (2, 'Bob Smith', 'Engineering', 85000, '2021-03-20', 1),
                (3, 'Carol Williams', 'Marketing', 75000, '2019-06-10', NULL),
                (4, 'David Brown', 'Engineering', 92000, '2020-08-05', 1),
                (5, 'Eve Davis', 'Marketing', 70000, '2022-01-08', 3),
                (6, 'Frank Miller', 'HR', 80000, '2021-09-15', NULL),
                (7, 'Grace Wilson', 'Engineering', 98000, '2018-03-22', 1),
                (8, 'Henry Taylor', 'Marketing', 72000, '2023-02-14', 3),
                (9, 'Ivy Anderson', 'HR', 68000, '2022-07-01', 6),
                (10, 'Jack Thomas', 'Engineering', 88000, '2021-11-30', 1);
            INSERT OR IGNORE INTO departments VALUES
                (1, 'Engineering', 500000, 'Building A'),
                (2, 'Marketing', 200000, 'Building B'),
                (3, 'HR', 150000, 'Building C'),
                (4, 'Sales', 300000, 'Building B');
            INSERT OR IGNORE INTO projects VALUES
                (1, 'Project Alpha', 1, '2023-01-01', '2023-12-31', 'active'),
                (2, 'Project Beta', 1, '2023-06-01', '2024-06-01', 'active'),
                (3, 'Campaign X', 2, '2023-03-01', '2023-09-30', 'completed'),
                (4, 'HR Portal', 3, '2023-04-01', NULL, 'active');
            INSERT OR IGNORE INTO orders VALUES
                (1, 'John Doe', 'Laptop', 2, 999.99, '2023-01-15'),
                (2, 'Jane Roe', 'Mouse', 5, 29.99, '2023-02-20'),
                (3, 'John Doe', 'Keyboard', 1, 79.99, '2023-03-10'),
                (4, 'Alice Cooper', 'Monitor', 3, 349.99, '2023-03-15'),
                (5, 'Jane Roe', 'Laptop', 1, 999.99, '2023-04-01'),
                (6, 'Bob Builder', 'Mouse', 10, 29.99, '2023-04-10'),
                (7, 'Alice Cooper', 'Keyboard', 2, 79.99, '2023-05-20');
        """)
        conn.commit()

        # Run reference query
        try:
            cursor.execute(data.reference_query.strip())
            ref_columns = [desc[0] for desc in cursor.description] if cursor.description else []
            ref_rows = [list(row) for row in cursor.fetchall()]
        except Exception as e:
            conn.close()
            return {"success": False, "error": f"Reference query error: {str(e)}", "passed": False}

        # Run user query
        try:
            cursor.execute(data.query.strip())
            user_columns = [desc[0] for desc in cursor.description] if cursor.description else []
            user_rows = [list(row) for row in cursor.fetchall()]
        except Exception as e:
            conn.close()
            return {
                "success": False,
                "error": str(e),
                "passed": False,
                "expected_columns": ref_columns,
                "expected_row_count": len(ref_rows),
                "actual_columns": [],
                "actual_row_count": 0,
            }

        conn.close()

        # Compare results
        # Normalize: convert to strings for comparison
        ref_rows_str = sorted([tuple(str(v) for v in row) for row in ref_rows])
        user_rows_str = sorted([tuple(str(v) for v in row) for row in user_rows])

        columns_match = len(ref_columns) == len(user_columns)
        rows_match = ref_rows_str == user_rows_str
        passed = columns_match and rows_match

        return {
            "success": True,
            "passed": passed,
            "expected_columns": ref_columns,
            "expected_row_count": len(ref_rows),
            "expected_rows": ref_rows[:5],  # Show first 5 expected rows
            "actual_columns": user_columns,
            "actual_row_count": len(user_rows),
            "actual_rows": user_rows[:5],  # Show first 5 actual rows
            "columns_match": columns_match,
            "rows_match": rows_match,
            "error": "",
        }

    except Exception as e:
        return {"success": False, "error": str(e), "passed": False}


@app.post("/api/student/finish-sql/{candidate_id}")
async def finish_sql_test(candidate_id: int):
    """Mark SQL test as passed."""
    db = get_db()
    candidate = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not candidate:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")

    db.execute("UPDATE candidates SET sql_passed = 1 WHERE id = ?", (candidate_id,))
    db.commit()
    db.close()
    return {"success": True}


# ──────────────── On-Demand Report Generation ────────────────

@app.post("/api/admin/generate-report/{candidate_id}")
async def generate_report_for_candidate(candidate_id: int):
    """Generate report for any candidate, regardless of status."""
    db = get_db()
    candidate = db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not candidate:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")

    skills = json.loads(candidate["skills"])

    mcq = db.execute("SELECT * FROM mcq_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    coding = db.execute("SELECT * FROM coding_tests WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    interview = db.execute("SELECT * FROM ai_interviews WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1", (candidate_id,)).fetchone()
    violations = db.execute("SELECT * FROM proctoring_logs WHERE candidate_id = ?", (candidate_id,)).fetchall()

    proctoring_summary = {
        "total_violations": len(violations),
        "tab_switches": sum(1 for v in violations if v["event_type"] == "tab_switch"),
        "face_not_detected": sum(1 for v in violations if v["event_type"] == "face_not_detected"),
        "phone_detected": sum(1 for v in violations if v["event_type"] == "phone_detected"),
        "eye_violations": sum(1 for v in violations if v["event_type"] == "eye_movement"),
    }

    mcq_results = {
        "score": mcq["score"] if mcq else 0,
        "total": mcq["total_marks"] if mcq else 0,
        "percentage": mcq["score"] if mcq else 0,
        "passed": mcq["status"] == "passed" if mcq else False,
    }

    coding_results = {
        "score": coding["score"] if coding else 0,
        "total": coding["total_marks"] if coding else 0,
        "solved": len(json.loads(coding["submissions"])) if coding and coding["submissions"] != "{}" else 0,
        "total_problems": len(json.loads(coding["problems"])) if coding else 0,
        "passed": coding["status"] == "passed" if coding else False,
    }

    interview_results = {
        "avg_score": interview["overall_score"] if interview else 0,
        "answered": interview["current_question_index"] + 1 if interview and interview["current_question_index"] else 0,
        "total": interview["total_questions"] if interview else 10,
        "passed": interview["status"] == "passed" if interview else False,
        "highlights": [],
    }

    if interview and interview["questions_answers"]:
        qa_list = json.loads(interview["questions_answers"])
        interview_results["highlights"] = [
            {"q": qa["question"][:100], "score": qa.get("score", 0)}
            for qa in qa_list[:5] if qa.get("question")
        ]

    report_data = await generate_final_report(
        candidate_info={"name": candidate["name"], "skills": skills},
        mcq_results=mcq_results,
        coding_results=coding_results,
        interview_results=interview_results,
        proctoring_summary=proctoring_summary,
    )

    test1_passed = mcq_results["passed"] and coding_results["passed"]
    interview_passed = interview_results["passed"]
    if test1_passed and interview_passed:
        overall_status = "passed"
    elif test1_passed or interview_passed:
        overall_status = "partial"
    else:
        overall_status = "failed"

    try:
        db.execute(
            """INSERT OR REPLACE INTO reports
               (candidate_id, mcq_score, mcq_passed, coding_score, coding_passed, test1_passed,
                interview_score, interview_passed, overall_status, detailed_feedback, proctoring_summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                candidate_id,
                mcq_results["score"],
                mcq_results["passed"],
                coding_results["score"],
                coding_results["passed"],
                test1_passed,
                interview_results["avg_score"] or 0,
                interview_passed,
                overall_status,
                json.dumps(report_data),
                json.dumps(proctoring_summary),
            )
        )
        db.commit()
    except Exception as e:
        print(f"Error saving report: {e}")

    db.close()

    return {
        "success": True,
        "report": report_data,
        "overall_status": overall_status,
    }


# ──────────────── Health Check ────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
