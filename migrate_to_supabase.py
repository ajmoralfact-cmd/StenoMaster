"""
Data Migration Script: SQLite (stenomaster.db) -> Supabase PostgreSQL
"""
import os
import sys
import sqlite3
import psycopg2

def migrate(pg_connection_string):
    print("Connecting to Supabase PostgreSQL...")
    pg_conn = psycopg2.connect(pg_connection_string)
    pg_cur = pg_conn.cursor()

    sqlite_conn = sqlite3.connect('stenomaster.db')
    sqlite_conn.row_factory = sqlite3.Row
    sq_cur = sqlite_conn.cursor()

    print("Applying Supabase schema...")
    with open('supabase_schema.sql', 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    pg_cur.execute(schema_sql)
    pg_conn.commit()
    print("Schema applied successfully!")

    print("Migrating categories...")
    sq_cur.execute("SELECT * FROM categories")
    cats = sq_cur.fetchall()
    for c in cats:
        pg_cur.execute("""
            INSERT INTO categories (id, name, slug, description, language, icon, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                language = EXCLUDED.language,
                icon = EXCLUDED.icon,
                sort_order = EXCLUDED.sort_order;
        """, (c['id'], c['name'], c['slug'], c['description'], c['language'], c['icon'], c['sort_order']))
    pg_cur.execute("SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));")
    pg_conn.commit()
    print(f"  Migrated {len(cats)} categories.")

    print("Migrating users...")
    sq_cur.execute("SELECT * FROM users")
    users = sq_cur.fetchall()
    for u in users:
        pg_cur.execute("""
            INSERT INTO users (id, username, email, password_hash, role, referral_code, is_active, phone, student_code, subscription_status, subscription_plan, subscription_start, subscription_end)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                subscription_status = EXCLUDED.subscription_status,
                subscription_end = EXCLUDED.subscription_end;
        """, (u['id'], u['username'], u['email'], u['password_hash'], u['role'], u['referral_code'], u['is_active'], u['phone'], u['student_code'], u['subscription_status'], u['subscription_plan'], u['subscription_start'], u['subscription_end']))
    pg_cur.execute("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));")
    pg_conn.commit()
    print(f"  Migrated {len(users)} users.")

    print("Migrating profiles...")
    sq_cur.execute("SELECT * FROM profiles")
    profiles = sq_cur.fetchall()
    for p in profiles:
        pg_cur.execute("""
            INSERT INTO profiles (user_id, display_name, avatar, target_exam, preferred_language, preferred_typing_mode, target_wpm, show_on_leaderboard, points, streak_days, longest_streak)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                target_wpm = EXCLUDED.target_wpm;
        """, (p['user_id'], p['display_name'], p['avatar'], p['target_exam'], p['preferred_language'], p['preferred_typing_mode'], p['target_wpm'], p['show_on_leaderboard'], p['points'], p['streak_days'], p['longest_streak']))
    pg_conn.commit()
    print(f"  Migrated {len(profiles)} profiles.")

    print("Migrating passages...")
    sq_cur.execute("SELECT * FROM passages")
    passages = sq_cur.fetchall()
    for p in passages:
        pg_cur.execute("""
            INSERT INTO passages (id, title, category_id, language, difficulty, official_text, instructions, target_wpm, duration_seconds, audio_url, audio_filename, thumbnail, tags, status, view_count, attempt_count, is_premium, official_text_krutidev)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                official_text = EXCLUDED.official_text,
                official_text_krutidev = EXCLUDED.official_text_krutidev,
                is_premium = EXCLUDED.is_premium;
        """, (p['id'], p['title'], p['category_id'], p['language'], p['difficulty'], p['official_text'], p['instructions'], p['target_wpm'], p['duration_seconds'], p['audio_url'], p['audio_filename'], p['thumbnail'], p['tags'], p['status'], p['view_count'], p['attempt_count'], p['is_premium'], p['official_text_krutidev']))
    pg_cur.execute("SELECT setval('passages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM passages));")
    pg_conn.commit()
    print(f"  Migrated {len(passages)} passages.")

    print("Migrating admin settings...")
    sq_cur.execute("SELECT * FROM admin_settings")
    settings = sq_cur.fetchall()
    for s in settings:
        pg_cur.execute("""
            INSERT INTO admin_settings (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        """, (s['key'], s['value']))
    pg_conn.commit()
    print(f"  Migrated {len(settings)} admin settings.")

    print("\n=======================================================")
    print("🎉 MIGRATION TO SUPABASE COMPLETED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        conn_str = sys.argv[1]
    else:
        conn_str = os.environ.get("DATABASE_URL")
    
    if not conn_str:
        print("Usage: python migrate_to_supabase.py \"postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres\"")
        sys.exit(1)
    
    migrate(conn_str)
