import json
import os
import re
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"


async def call_cerebras(messages: list, temperature: float = 0.7, max_tokens: int = 4096) -> str:
    """Call Cerebras API for text generation."""
    headers = {
        "Authorization": f"Bearer {CEREBRAS_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(CEREBRAS_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def parse_json_response(text: str) -> any:
    """Extract JSON from AI response text."""
    # Try to find JSON in code blocks
    json_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try to parse the entire response as JSON
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Try to find JSON array or object
    for pattern in [r'\[[\s\S]*\]', r'\{[\s\S]*\}']:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                continue

    return None


async def generate_mcq_questions(skills: list, count: int = 20) -> list:
    """Generate MCQ questions based on candidate skills."""
    skills_str = ", ".join(skills[:15])  # Limit to top 15 skills

    messages = [
        {
            "role": "system",
            "content": """You are an expert technical interviewer. Generate multiple choice questions for a technical assessment.
Each question must be relevant to the candidate's skills and test practical knowledge.
Return ONLY a valid JSON array, no other text.
Each question object must have these exact fields:
- "id": number (1, 2, 3...)
- "question": string (the question text)
- "skill": string (which skill this tests)
- "difficulty": string ("easy", "medium", or "hard")
- "options": array of exactly 4 strings
- "correct_answer": number (0-3 index of correct option)
- "explanation": string (brief explanation of correct answer)"""
        },
        {
            "role": "user",
            "content": f"""Generate {count} technical MCQ questions based on these skills: {skills_str}

Distribution:
- 30% Easy questions (fundamentals)
- 50% Medium questions (practical application)
- 20% Hard questions (advanced concepts)

Make questions practical and real-world oriented. Cover different skills proportionally.
Return ONLY a valid JSON array."""
        }
    ]

    response = await call_cerebras(messages, temperature=0.7, max_tokens=8000)
    questions = parse_json_response(response)

    if not questions or not isinstance(questions, list):
        # Fallback: generate simpler questions
        return generate_fallback_mcq(skills, count)

    # Validate and clean questions
    valid_questions = []
    for i, q in enumerate(questions):
        if isinstance(q, dict) and all(k in q for k in ["question", "options", "correct_answer"]):
            q["id"] = i + 1
            if isinstance(q["options"], list) and len(q["options"]) >= 4:
                q["options"] = q["options"][:4]
                valid_questions.append(q)

    return valid_questions if valid_questions else generate_fallback_mcq(skills, count)


def generate_fallback_mcq(skills: list, count: int) -> list:
    """Generate fallback MCQ questions if AI fails."""
    questions = []
    for i in range(min(count, len(skills) * 2)):
        skill = skills[i % len(skills)]
        questions.append({
            "id": i + 1,
            "question": f"Which of the following best describes {skill}?",
            "skill": skill,
            "difficulty": "easy",
            "options": [
                f"A programming concept related to {skill}",
                f"A framework built on {skill}",
                f"A design pattern used in {skill}",
                f"A tool used alongside {skill}"
            ],
            "correct_answer": 0,
            "explanation": f"This is a fundamental concept in {skill}."
        })
    return questions


async def generate_coding_problems(skills: list, count: int = 3) -> list:
    """Generate coding problems based on candidate skills."""
    # Pick relevant programming skills
    prog_skills = [s for s in skills if s.lower() in {
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
        "ruby", "php", "swift", "kotlin", "scala", "dsa", "data-structures", "algorithms"
    }]
    if not prog_skills:
        prog_skills = skills[:3]

    skills_str = ", ".join(prog_skills[:5])

    messages = [
        {
            "role": "system",
            "content": """You are an expert coding challenge designer. Generate coding problems for a technical assessment.
Return ONLY a valid JSON array. Each problem object must have:
- "id": number
- "title": string
- "description": string (clear problem statement with examples)
- "difficulty": "easy" | "medium" | "hard"
- "skills_tested": array of strings
- "input_format": string
- "output_format": string
- "sample_input": string
- "sample_output": string
- "test_cases": array of objects with "input" and "expected_output" strings
- "time_limit_seconds": number
- "hints": array of strings (2-3 hints)"""
        },
        {
            "role": "user",
            "content": f"""Generate {count} coding problems that test these skills: {skills_str}

- 1 Easy problem (basic logic/implementation)
- 1 Medium problem (data structures/algorithms)
- 1 Hard problem (complex problem solving)

Each problem should have at least 3 test cases.
Return ONLY a valid JSON array."""
        }
    ]

    response = await call_cerebras(messages, temperature=0.7, max_tokens=6000)
    problems = parse_json_response(response)

    if not problems or not isinstance(problems, list):
        return generate_fallback_coding_problems(skills)

    return problems


def generate_fallback_coding_problems(skills: list) -> list:
    """Fallback coding problems."""
    return [
        {
            "id": 1,
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.\n\nExample:\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]\nExplanation: nums[0] + nums[1] = 2 + 7 = 9",
            "difficulty": "easy",
            "skills_tested": ["arrays", "hash-maps"],
            "input_format": "First line: space-separated integers (array)\nSecond line: target integer",
            "output_format": "Space-separated indices",
            "sample_input": "2 7 11 15\n9",
            "sample_output": "0 1",
            "test_cases": [
                {"input": "2 7 11 15\n9", "expected_output": "0 1"},
                {"input": "3 2 4\n6", "expected_output": "1 2"},
                {"input": "3 3\n6", "expected_output": "0 1"},
            ],
            "time_limit_seconds": 5,
            "hints": ["Try using a hash map", "Store complement values"]
        },
        {
            "id": 2,
            "title": "Valid Parentheses",
            "description": "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets are closed by the same type of brackets.\n2. Open brackets are closed in the correct order.\n\nExample:\nInput: '()[]{}'\nOutput: true",
            "difficulty": "medium",
            "skills_tested": ["stacks", "string-processing"],
            "input_format": "A string of brackets",
            "output_format": "true or false",
            "sample_input": "()[]{}",
            "sample_output": "true",
            "test_cases": [
                {"input": "()", "expected_output": "true"},
                {"input": "()[]{}", "expected_output": "true"},
                {"input": "(]", "expected_output": "false"},
            ],
            "time_limit_seconds": 5,
            "hints": ["Use a stack data structure", "Push opening brackets, pop for closing"]
        },
        {
            "id": 3,
            "title": "Longest Substring Without Repeating Characters",
            "description": "Given a string s, find the length of the longest substring without repeating characters.\n\nExample:\nInput: 'abcabcbb'\nOutput: 3\nExplanation: The answer is 'abc', with length 3.",
            "difficulty": "hard",
            "skills_tested": ["sliding-window", "hash-maps"],
            "input_format": "A string",
            "output_format": "An integer",
            "sample_input": "abcabcbb",
            "sample_output": "3",
            "test_cases": [
                {"input": "abcabcbb", "expected_output": "3"},
                {"input": "bbbbb", "expected_output": "1"},
                {"input": "pwwkew", "expected_output": "3"},
            ],
            "time_limit_seconds": 5,
            "hints": ["Sliding window technique", "Use a set to track characters in current window"]
        }
    ]


async def generate_interview_question(
    skills: list,
    resume_text: str,
    previous_qa: list,
    question_number: int,
    total_questions: int,
    github_url: str = "",
    coding_platforms: dict = None
) -> dict:
    """Generate a single AI interview question based on context."""
    prev_context = ""
    if previous_qa:
        prev_context = "\n".join([
            f"Q{i+1}: {qa.get('question', '')}\nA{i+1}: {qa.get('answer', '')}\nScore: {qa.get('score', 'N/A')}/10"
            for i, qa in enumerate(previous_qa[-3:])  # Last 3 Q&A for context
        ])

    platform_info = ""
    if coding_platforms:
        platform_info = f"\nCoding Platform Profiles: {json.dumps(coding_platforms)}"

    github_info = ""
    if github_url:
        github_info = f"\nGitHub Profile: {github_url}"

    messages = [
        {
            "role": "system",
            "content": """You are a senior technical interviewer conducting an AI-powered interview.
Ask one focused, insightful question at a time. Your questions should:
1. Start with fundamental concepts and progressively get harder
2. Be based on the candidate's actual skills and experience
3. Include follow-up questions based on previous answers
4. Test both theoretical knowledge and practical experience
5. Reference the candidate's projects or experience when relevant

Return a JSON object with:
- "question": string (the interview question)
- "category": string (skill category being tested)
- "difficulty": "easy" | "medium" | "hard"
- "expected_key_points": array of strings (key points a good answer should cover)
- "follow_up_context": string (why this question was chosen)"""
        },
        {
            "role": "user",
            "content": f"""Candidate Skills: {', '.join(skills)}
{github_info}
{platform_info}

Resume Summary (key parts):
{resume_text[:1500]}

Question {question_number} of {total_questions}.

Previous Q&A Context:
{prev_context if prev_context else 'This is the first question.'}

Generate the next interview question. Make it progressively more challenging.
For early questions (1-3), ask foundational questions.
For middle questions (4-7), ask practical and project-based questions.
For later questions (8+), ask complex scenario-based questions.

Return ONLY valid JSON."""
        }
    ]

    response = await call_cerebras(messages, temperature=0.8, max_tokens=2000)
    question_data = parse_json_response(response)

    if not question_data or not isinstance(question_data, dict):
        return {
            "question": f"Can you explain your experience with {skills[question_number % len(skills)]} and describe a project where you used it?",
            "category": skills[question_number % len(skills)],
            "difficulty": "medium",
            "expected_key_points": ["Technical depth", "Practical experience", "Problem-solving approach"],
            "follow_up_context": "Fallback question"
        }

    return question_data


async def evaluate_interview_answer(
    question: str,
    answer: str,
    expected_key_points: list,
    skill_category: str
) -> dict:
    """Evaluate a candidate's interview answer."""
    messages = [
        {
            "role": "system",
            "content": """You are a technical interview evaluator. Evaluate the candidate's answer objectively.
Return a JSON object with:
- "score": number (0-10)
- "feedback": string (constructive feedback)
- "strengths": array of strings
- "weaknesses": array of strings
- "key_points_covered": array of strings (which expected points were addressed)
- "suggestion": string (what could be improved)"""
        },
        {
            "role": "user",
            "content": f"""Question: {question}
Skill Category: {skill_category}

Expected Key Points: {json.dumps(expected_key_points)}

Candidate's Answer: {answer}

Evaluate this answer. Be fair but thorough.
If the answer is empty or clearly irrelevant, give a low score.
Return ONLY valid JSON."""
        }
    ]

    response = await call_cerebras(messages, temperature=0.3, max_tokens=2000)
    evaluation = parse_json_response(response)

    if not evaluation or not isinstance(evaluation, dict):
        return {
            "score": 5,
            "feedback": "Answer received. Unable to perform detailed evaluation.",
            "strengths": [],
            "weaknesses": [],
            "key_points_covered": [],
            "suggestion": "Try to provide more detailed technical explanations."
        }

    return evaluation


async def generate_final_report(
    candidate_info: dict,
    mcq_results: dict,
    coding_results: dict,
    interview_results: dict,
    proctoring_summary: dict
) -> dict:
    """Generate a comprehensive assessment report."""
    messages = [
        {
            "role": "system",
            "content": """You are a hiring assessment analyst. Generate a comprehensive candidate evaluation report.
Return a JSON object with:
- "overall_rating": string ("Excellent" | "Good" | "Average" | "Below Average" | "Not Recommended")
- "summary": string (2-3 paragraph executive summary)
- "strengths": array of strings (top strengths)
- "areas_for_improvement": array of strings
- "skill_assessment": object with skill names as keys and ratings (1-10) as values
- "recommendation": string (detailed hiring recommendation)
- "interview_highlights": array of strings
- "concerns": array of strings (any red flags)
- "suggested_role_fit": array of strings (suitable roles)"""
        },
        {
            "role": "user",
            "content": f"""Candidate: {candidate_info.get('name', 'Unknown')}
Skills: {json.dumps(candidate_info.get('skills', []))}

MCQ Test Results:
- Score: {mcq_results.get('score', 0)}/{mcq_results.get('total', 0)}
- Percentage: {mcq_results.get('percentage', 0)}%
- Passed: {mcq_results.get('passed', False)}

Coding Test Results:
- Score: {coding_results.get('score', 0)}/{coding_results.get('total', 0)}
- Problems Solved: {coding_results.get('solved', 0)}/{coding_results.get('total_problems', 0)}
- Passed: {coding_results.get('passed', False)}

AI Interview Results:
- Average Score: {interview_results.get('avg_score', 0)}/10
- Questions Answered: {interview_results.get('answered', 0)}/{interview_results.get('total', 0)}
- Passed: {interview_results.get('passed', False)}
- Key Q&A highlights: {json.dumps(interview_results.get('highlights', []))}

Proctoring Summary:
- Total Violations: {proctoring_summary.get('total_violations', 0)}
- Tab Switches: {proctoring_summary.get('tab_switches', 0)}
- Face Not Detected Count: {proctoring_summary.get('face_not_detected', 0)}
- Phone Detected Count: {proctoring_summary.get('phone_detected', 0)}
- Eye Movement Violations: {proctoring_summary.get('eye_violations', 0)}

Generate a comprehensive report. Return ONLY valid JSON."""
        }
    ]

    response = await call_cerebras(messages, temperature=0.5, max_tokens=4000)
    report = parse_json_response(response)

    if not report or not isinstance(report, dict):
        return {
            "overall_rating": "Average",
            "summary": "Report generation encountered an issue. Please review individual test results.",
            "strengths": [],
            "areas_for_improvement": [],
            "skill_assessment": {},
            "recommendation": "Manual review recommended.",
            "interview_highlights": [],
            "concerns": [],
            "suggested_role_fit": []
        }

    return report
