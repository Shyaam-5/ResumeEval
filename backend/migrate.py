import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "skillproctor.db")

def migrate():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        print(f"Migrating database at {DB_PATH}")
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(candidates)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "sql_passed" not in columns:
            print("Adding sql_passed column...")
            cursor.execute("ALTER TABLE candidates ADD COLUMN sql_passed BOOLEAN DEFAULT 0")
            conn.commit()
            print("Migration successful: Added sql_passed column.")
        else:
            print("Column sql_passed already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
