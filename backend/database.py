import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "skillproctor.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            resume_path TEXT,
            resume_text TEXT,
            skills TEXT DEFAULT '[]',
            github_url TEXT,
            linkedin_url TEXT,
            coding_platforms TEXT DEFAULT '{}',
            sql_passed BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS mcq_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            questions TEXT DEFAULT '[]',
            answers TEXT DEFAULT '{}',
            score REAL DEFAULT 0,
            total_marks INTEGER DEFAULT 0,
            passing_score REAL DEFAULT 10,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            duration_minutes INTEGER DEFAULT 60,
            status TEXT DEFAULT 'pending',
            violations TEXT DEFAULT '[]',
            violation_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS coding_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            mcq_test_id INTEGER,
            problems TEXT DEFAULT '[]',
            submissions TEXT DEFAULT '{}',
            score REAL DEFAULT 0,
            total_marks INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
            FOREIGN KEY (mcq_test_id) REFERENCES mcq_tests(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS ai_interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            questions_answers TEXT DEFAULT '[]',
            current_question_index INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 10,
            overall_score REAL DEFAULT 0,
            feedback TEXT,
            status TEXT DEFAULT 'pending',
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            violations TEXT DEFAULT '[]',
            violation_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS proctoring_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            test_type TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            details TEXT,
            severity TEXT DEFAULT 'low',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL UNIQUE,
            mcq_score REAL,
            mcq_passed BOOLEAN DEFAULT 0,
            coding_score REAL,
            coding_passed BOOLEAN DEFAULT 0,
            test1_passed BOOLEAN DEFAULT 0,
            interview_score REAL,
            interview_passed BOOLEAN DEFAULT 0,
            overall_status TEXT DEFAULT 'pending',
            detailed_feedback TEXT DEFAULT '{}',
            proctoring_summary TEXT DEFAULT '{}',
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Insert default admin user
    try:
        cursor.execute(
            "INSERT OR IGNORE INTO admin_users (username, password, name) VALUES (?, ?, ?)",
            ("admin", "admin123", "Administrator")
        )
    except:
        pass

    conn.commit()
    conn.close()
    print("Database initialized successfully!")


if __name__ == "__main__":
    init_db()
