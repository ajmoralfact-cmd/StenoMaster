"""
Database Layer for StenoMaster
Manages SQLite schema, migrations, queries, and realistic seed data.
"""

import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stenomaster.db')


try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


class PostgresCursorWrapper:
    def __init__(self, cur):
        self._cur = cur
        self.lastrowid = None

    def execute(self, sql, params=None):
        pg_sql = sql.replace('?', '%s')
        if params is not None:
            self._cur.execute(pg_sql, params)
        else:
            self._cur.execute(pg_sql)
        return self

    def executemany(self, sql, seq_of_params):
        pg_sql = sql.replace('?', '%s')
        self._cur.executemany(pg_sql, seq_of_params)
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def fetchmany(self, size=None):
        return self._cur.fetchmany(size) if size else self._cur.fetchmany()

    @property
    def rowcount(self):
        return self._cur.rowcount

    def close(self):
        self._cur.close()


class PostgresConnWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return PostgresCursorWrapper(self._conn.cursor())

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def get_db():
    database_url = os.environ.get('DATABASE_URL')
    if database_url and HAS_PSYCOPG2:
        try:
            conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
            return PostgresConnWrapper(conn)
        except Exception as e:
            # Fall back to sqlite if network error
            print(f"Postgres connection warning, falling back to SQLite: {e}")

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def init_db():
    """Creates all database tables and inserts default initial data."""
    conn = get_db()
    c = conn.cursor()

    # 1. Users
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        referral_code TEXT UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    )
    """)

    # 2. Profiles
    c.execute("""
    CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar TEXT DEFAULT 'user-default',
        target_exam TEXT DEFAULT 'SSC Stenographer',
        preferred_language TEXT DEFAULT 'hindi',
        preferred_typing_mode TEXT DEFAULT 'mangal',
        target_wpm INTEGER DEFAULT 50,
        show_on_leaderboard INTEGER DEFAULT 1,
        points INTEGER DEFAULT 50,
        streak_days INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_practice_date TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 3. Categories
    c.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        language TEXT DEFAULT 'both',
        icon TEXT DEFAULT 'book',
        sort_order INTEGER DEFAULT 0
    )
    """)

    # 4. Passages
    c.execute("""
    CREATE TABLE IF NOT EXISTS passages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        official_text TEXT NOT NULL,
        official_text_krutidev TEXT,
        instructions TEXT,
        target_wpm INTEGER DEFAULT 40,
        duration_seconds INTEGER DEFAULT 300,
        audio_url TEXT,
        audio_filename TEXT,
        thumbnail TEXT,
        tags TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        view_count INTEGER DEFAULT 0,
        attempt_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    """)

    # 5. Audio Files
    c.execute("""
    CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passage_id INTEGER,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT DEFAULT 'audio/mpeg',
        created_at TEXT NOT NULL,
        FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE SET NULL
    )
    """)

    # 6. Practice Attempts
    c.execute("""
    CREATE TABLE IF NOT EXISTS practice_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        passage_id INTEGER NOT NULL,
        gross_wpm REAL NOT NULL,
        net_wpm REAL NOT NULL,
        accuracy REAL NOT NULL,
        spelling_accuracy REAL NOT NULL,
        error_rate REAL NOT NULL,
        total_words INTEGER NOT NULL,
        correct_words INTEGER NOT NULL,
        total_errors INTEGER NOT NULL,
        weighted_errors REAL NOT NULL,
        time_taken_seconds INTEGER NOT NULL,
        typing_mode TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        normalized_input TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
    )
    """)

    # 7. Practice Errors (normalized list)
    c.execute("""
    CREATE TABLE IF NOT EXISTS practice_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        your_text TEXT,
        correct_text TEXT,
        error_type TEXT NOT NULL,
        category TEXT NOT NULL,
        detail TEXT,
        FOREIGN KEY (attempt_id) REFERENCES practice_attempts(id) ON DELETE CASCADE
    )
    """)

    # 8. Bookmarks
    c.execute("""
    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        passage_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, passage_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
    )
    """)

    # 9. Notifications
    c.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 10. Referrals
    c.execute("""
    CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_user_id INTEGER NOT NULL,
        referred_user_id INTEGER NOT NULL,
        referral_code TEXT NOT NULL,
        reward_points INTEGER DEFAULT 100,
        status TEXT DEFAULT 'completed',
        created_at TEXT NOT NULL,
        FOREIGN KEY (referrer_user_id) REFERENCES users(id),
        FOREIGN KEY (referred_user_id) REFERENCES users(id)
    )
    """)

    # 11. Rewards & Points Ledger
    c.execute("""
    CREATE TABLE IF NOT EXISTS rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        points INTEGER NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 12. User Settings
    c.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        theme TEXT DEFAULT 'light',
        default_typing_mode TEXT DEFAULT 'mangal',
        default_playback_speed REAL DEFAULT 1.0,
        sound_enabled INTEGER DEFAULT 1,
        email_notifications INTEGER DEFAULT 1,
        practice_reminders INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 13. Admin Settings
    c.execute("""
    CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # 14. Achievements
    c.execute("""
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        badge_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        UNIQUE(user_id, badge_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 15. Sessions table (with Single Device Enforcement & IP Tracking)
    c.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        device_name TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_active_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        invalidated_reason TEXT,
        superseded_by_ip TEXT,
        superseded_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # Migration: Add IP and device tracking columns if upgrading existing sessions table
    c.execute("PRAGMA table_info(sessions)")
    existing_session_cols = {row["name"] for row in c.fetchall()}
    session_cols_to_add = [
        ("ip_address", "TEXT"),
        ("user_agent", "TEXT"),
        ("device_name", "TEXT"),
        ("last_active_at", "TEXT"),
        ("is_active", "INTEGER NOT NULL DEFAULT 1"),
        ("invalidated_reason", "TEXT"),
        ("superseded_by_ip", "TEXT"),
        ("superseded_at", "TEXT")
    ]
    for col_name, col_def in session_cols_to_add:
        if col_name not in existing_session_cols:
            try:
                c.execute(f"ALTER TABLE sessions ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass

    # 16. Immutable Reward Transactions (Strict Source of Truth for Points)
    c.execute("""
    CREATE TABLE IF NOT EXISTS reward_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        points INTEGER NOT NULL,
        type TEXT NOT NULL,
        reference_id TEXT,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, type, reference_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 17. Subscription Payment Requests & Verifications
    c.execute("""
    CREATE TABLE IF NOT EXISTS payment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_name TEXT NOT NULL,
        amount REAL NOT NULL,
        transaction_id TEXT NOT NULL,
        screenshot_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 18. Cashfree PG Online Orders & Subscriptions
    c.execute("""
    CREATE TABLE IF NOT EXISTS cashfree_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        cf_order_id TEXT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 100.0,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'CREATED',
        payment_session_id TEXT,
        cf_payment_id TEXT,
        payment_method TEXT,
        payment_time TEXT,
        plan_days INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # --- Migrations for Existing Tables ---
    c.execute("PRAGMA table_info(users)")
    u_cols = {col['name'] for col in c.fetchall()}
    if 'phone' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    if 'student_code' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN student_code TEXT")
    if 'subscription_status' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free'")
    if 'subscription_plan' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN subscription_plan TEXT")
    if 'subscription_start' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN subscription_start TEXT")
    if 'subscription_end' not in u_cols:
        c.execute("ALTER TABLE users ADD COLUMN subscription_end TEXT")

    c.execute("PRAGMA table_info(passages)")
    p_cols = {col['name'] for col in c.fetchall()}
    if 'is_premium' not in p_cols:
        c.execute("ALTER TABLE passages ADD COLUMN is_premium INTEGER DEFAULT 0")
    if 'official_text_krutidev' not in p_cols:
        c.execute("ALTER TABLE passages ADD COLUMN official_text_krutidev TEXT")

    # Backfill Kruti Dev reference text for any Hindi passages lacking it
    try:
        import hindi_converter
        c.execute("SELECT id, official_text, language FROM passages WHERE (official_text_krutidev IS NULL OR official_text_krutidev = '')")
        rows_to_backfill = c.fetchall()
        for row in rows_to_backfill:
            if row['language'] == 'hindi' and row['official_text']:
                kd_text = hindi_converter.unicode_to_kruti_dev(row['official_text'])
                c.execute("UPDATE passages SET official_text_krutidev = ? WHERE id = ?", (kd_text, row['id']))
    except Exception as e:
        print(f"Warning during Kruti Dev backfill: {e}")

    conn.commit()
    conn.close()

    # Run initial seed
    seed_initial_data()


def seed_initial_data():
    """Seeds default admin, categories, admin settings, and sample passages."""
    conn = get_db()
    c = conn.cursor()

    now_iso = datetime.now().isoformat()

    # 1. Admin Settings
    default_settings = [
        ('app_name', 'StenoMaster'),
        ('tagline', 'Listen. Type. Improve. Master Steno.'),
        ('daily_target_dictations', '3'),
        ('daily_target_minutes', '15'),
        ('daily_target_wpm', '40'),
        ('scoring_mode', 'standard'),
        ('ssc_error_factor', '1.0'),
        ('court_error_factor', '1.2'),
        ('referral_bonus_points', '100'),
        ('allow_public_leaderboard', '1'),
        ('subscription_qr_url', '/assets/qr_payment.png'),
        ('subscription_plan_name', 'StenoMaster Pro — 1 Month (₹100/माह)'),
        ('subscription_plan_price', '100'),
        ('cashfree_app_id', ''),
        ('cashfree_secret_key', ''),
        ('cashfree_env', 'SANDBOX'),
        ('reward_points_practice', '10'),
        ('reward_points_daily_goal', '20'),
        ('reward_points_streak_7', '50')
    ]
    for k, v in default_settings:
        c.execute("INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)", (k, v, now_iso))

    # Migrate existing subscription pricing to ₹100
    c.execute("UPDATE admin_settings SET value = '100' WHERE key = 'subscription_plan_price' AND value = '299'")
    c.execute("UPDATE admin_settings SET value = 'StenoMaster Pro — 1 Month (₹100/माह)' WHERE key = 'subscription_plan_name' AND value = 'StenoMaster Pro — 1 Month'")

    # Backfill student codes for existing users if any missing
    c.execute("SELECT id, created_at, student_code FROM users WHERE student_code IS NULL OR student_code = ''")
    for row in c.fetchall():
        yr = row['created_at'][:4] if row['created_at'] else str(datetime.now().year)
        code = f"STM-{yr}-{row['id']:06d}"
        c.execute("UPDATE users SET student_code = ? WHERE id = ?", (code, row['id']))

    # Seed initial payment QR placeholder file if missing
    qr_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'assets')
    os.makedirs(qr_dir, exist_ok=True)
    qr_path = os.path.join(qr_dir, 'qr_payment.png')
    if not os.path.exists(qr_path):
        logo_path = os.path.join(qr_dir, 'logo.png')
        if os.path.exists(logo_path):
            import shutil
            shutil.copyfile(logo_path, qr_path)

    # Mark select passages as premium for access control testing
    c.execute("UPDATE passages SET is_premium = 1 WHERE id IN (10, 13, 15)")

    # 2. Default Admin User
    admin_email = "admin@stenomaster.com"
    c.execute("SELECT id FROM users WHERE email = ?", (admin_email,))
    admin = c.fetchone()
    if not admin:
        admin_ref = "STENOADM"
        c.execute("""
            INSERT INTO users (username, email, password_hash, role, referral_code, is_active, created_at)
            VALUES (?, ?, ?, 'admin', ?, 1, ?)
        """, ("Admin", admin_email, hash_password("admin123"), admin_ref, now_iso))
        admin_id = c.lastrowid
        admin_code = f"STM-{datetime.now().year}-{admin_id:06d}"
        c.execute("UPDATE users SET student_code = ? WHERE id = ?", (admin_code, admin_id))
        c.execute("""
            INSERT INTO profiles (user_id, display_name, avatar, target_exam, preferred_language, preferred_typing_mode, target_wpm, points)
            VALUES (?, 'Chief Instructor', 'shield-admin', 'All Stenographer Exams', 'hindi', 'mangal', 60, 500)
        """, (admin_id,))
        c.execute("INSERT INTO user_settings (user_id) VALUES (?)", (admin_id,))

    # 3. Default Demo Student
    student_email = "student@stenomaster.com"
    c.execute("SELECT id FROM users WHERE email = ?", (student_email,))
    student = c.fetchone()
    if not student:
        student_ref = "STENO101"
        c.execute("""
            INSERT INTO users (username, email, password_hash, role, referral_code, is_active, created_at)
            VALUES (?, ?, ?, 'student', ?, 1, ?)
        """, ("StenoStudent", student_email, hash_password("student123"), student_ref, now_iso))
        student_id = c.lastrowid
        c.execute("""
            INSERT INTO profiles (user_id, display_name, avatar, target_exam, preferred_language, preferred_typing_mode, target_wpm, points, streak_days)
            VALUES (?, 'Harsh Khare', 'user-steno', 'SSC Stenographer Grade C & D', 'hindi', 'mangal', 45, 150, 3)
        """, (student_id,))
        c.execute("INSERT INTO user_settings (user_id) VALUES (?)", (student_id,))
        c.execute("""
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, 'स्वागतम् StenoMaster पर!', 'आपकी पहली स्टेनोग्राफर डिक्टेशन तैयार है। दैनिक लक्ष्य पूरा करें और अपनी गति सुधारें।', 'info', ?)
        """, (student_id, now_iso))

    # 4. Categories
    categories_data = [
        ("रामधारी सिंह दिनकर", "ramdhari-singh-dinkar", "दिनकर जी की प्रसिद्ध रचनाएं एवं ओजस्वी काव्य गद्य", "hindi", "feather", 1),
        ("महात्मा गांधी", "mahatma-gandhi", "गांधी जी के विचार, आत्मकथा एवं स्वतंत्रता आंदोलन", "hindi", "user-check", 2),
        ("भारतीय संविधान", "indian-constitution", "संविधान की प्रस्तावना, मूल अधिकार एवं राजव्यवस्था", "both", "book-open", 3),
        ("भारत का इतिहास", "indian-history", "प्राचीन, मध्यकालीन और आधुनिक भारत का गौरवशाली इतिहास", "both", "landmark", 4),
        ("विज्ञान एवं प्रौद्योगिकी", "science-technology", "डिजिटल क्रांति, अंतरिक्ष अनुसंधान और विज्ञान आधारित डिक्टेशन", "both", "cpu", 5),
        ("सामान्य ज्ञान", "general-knowledge", "समसामयिक, भूगोल एवं भारतीय अर्थव्यवस्था", "both", "globe", 6),
        ("करंट अफेयर्स", "current-affairs", "राष्ट्रीय एवं अंतर्राष्ट्रीय महत्वपूर्ण घटनाक्रम", "both", "trending-up", 7),
        ("समाचार सम्पादकीय", "editorial-passages", "प्रमुख राष्ट्रीय समाचार पत्रों के संपादकीय आलेख", "both", "newspaper", 8),
        ("SSC Stenographer", "ssc-steno", "कर्मचारी चयन आयोग ग्रेड 'सी' और 'डी' मॉडल टेस्ट", "both", "award", 9),
        ("UPSSSC Steno", "upsssc-steno", "उत्तर प्रदेश अधीनस्थ सेवा चयन आयोग आशुलिपिक परीक्षा", "hindi", "briefcase", 10),
        ("High Court Steno", "court-steno", "उच्च न्यायालय एवं जिला न्यायालय आशुलिपिक विधिक डिक्टेशन", "both", "scale", 11),
    ]

    for name, slug, desc, lang, icon, order in categories_data:
        c.execute("""
            INSERT OR IGNORE INTO categories (name, slug, description, language, icon, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, slug, desc, lang, icon, order))

    conn.commit()

    # Get category id map
    c.execute("SELECT slug, id FROM categories")
    cat_map = {row['slug']: row['id'] for row in c.fetchall()}

    # 5. Seed Passages (10 Hindi + 5 English)
    passages_data = [
        # 1. Hindi - Ramdhari Singh Dinkar
        {
            "title": "रामधारी सिंह दिनकर — रश्मिरथी (कृष्ण की चेतावनी)",
            "category_slug": "ramdhari-singh-dinkar",
            "language": "hindi",
            "difficulty": "medium",
            "target_wpm": 45,
            "duration_seconds": 180,
            "official_text": "वर्षों तक वन में घूम-घूम, बाधा-विघ्नों को चूम-चूम, सह धूप-घाम, पानी-पत्थर, पांडव आये कुछ और निखर। सौभाग्य न सब दिन सोता है, देखें, आगे क्या होता है। मैत्री की राह बताने को, सबको सुमार्ग पर लाने को, दुर्योधन को समझाने को, भीषण विध्वंस बचाने को, भगवान हस्तिनापुर आये, पांडव का संदेशा लाये। दो न्याय अगर तो आधा दो, पर, इसमें भी यदि बाधा हो, तो दे दो केवल पाँच ग्राम, रक्खो अपनी धरती तमाम। हम वहीं खुशी से खायेंगे, परिजन पर असि न उठायेंगे। दुर्योधन वह भी दे न सका, आशीष समाज की ले न सका, उलटे, हरि को बाँधने चला, जो था असाध्य, साधने चला। जब नाश मनुज पर छाता है, पहले विवेक मर जाता है।",
            "instructions": "यह पद्यांश रामधारी सिंह दिनकर के प्रसिद्ध महाकाव्य रश्मिरथी से है। ध्यानपूर्वक सुनकर शुद्ध मात्राओं और विराम चिह्नों के साथ टाइप करें।",
            "tags": "दिनकर,रश्मिरथी,साहित्य,ओज"
        },
        # 2. Hindi - Mahatma Gandhi
        {
            "title": "महात्मा गांधी — सत्य और अहिंसा का अमर संदेश",
            "category_slug": "mahatma-gandhi",
            "language": "hindi",
            "difficulty": "easy",
            "target_wpm": 40,
            "duration_seconds": 210,
            "official_text": "सत्य ही ईश्वर है और अहिंसा उसका सर्वोच्च व्यावहारिक स्वरूप है। जब मनुष्य सत्य के मार्ग पर दृढ़तापूर्वक चलता है, तब किसी भी प्रकार का भय उसके मन को विचलित नहीं कर सकता। हमारे देश की स्वतंत्रता केवल एक राजनीतिक विजय नहीं थी, अपितु यह नैतिक सिद्धांतों और आत्मबल की महान विजय थी। साध्य की पवित्रता के साथ साधनों की शुचिता भी अनिवार्य है। गलत साधनों के प्रयोग से प्राप्त की गई सफलता कभी स्थायी नहीं हो सकती। खादी और स्वदेशी का विचार केवल आर्थिक स्वावलंबन नहीं, बल्कि राष्ट्र के प्रति समर्पण का प्रतीक था। हमें अपने विचारों, वचनों और कर्मों में पूर्ण सामंजस्य स्थापित करना होगा तभी हम एक समरस और आदर्श समाज की रचना कर पाएंगे।",
            "instructions": "गांधीवादी दर्शन पर आधारित इस गद्यांश में संयुक्त अक्षरों एवं अनुस्वारों की शुद्धता का ध्यान रखें।",
            "tags": "गांधी,अहिंसा,सत्य,स्वतंत्रता"
        },
        # 3. Hindi - Indian Constitution
        {
            "title": "भारतीय संविधान — उद्देशिका और मूलभूत अधिकार",
            "category_slug": "indian-constitution",
            "language": "hindi",
            "difficulty": "hard",
            "target_wpm": 50,
            "duration_seconds": 240,
            "official_text": "हम, भारत के लोग, भारत को एक संपूर्ण प्रभुत्व-संपन्न, समाजवादी, पंथनिरपेक्ष, लोकतंत्रात्मक गणराज्य बनाने के लिए तथा उसके समस्त नागरिकों को सामाजिक, आर्थिक और राजनीतिक न्याय, विचार, अभिव्यक्ति, विश्वास, धर्म और उपासना की स्वतंत्रता, प्रतिष्ठा और अवसर की समता प्राप्त कराने के लिए तथा उन सब में व्यक्ति की गरिमा और राष्ट्र की एकता और अखंडता सुनिश्चित करने वाली बंधुता बढ़ाने के लिए दृढ़संकल्प होकर अपनी इस संविधान सभा में आज तारीख छब्बीस नवंबर उन्नीस सौ उनचास ईस्वी को एतद्द्वारा इस संविधान को अंगीकृत, अधिनियमित और आत्मार्पित करते हैं। प्रत्येक नागरिक का यह पुनीत कर्तव्य है कि वह विधि के शासन का सम्मान करे।",
            "instructions": "संविधान की उद्देशिका के तकनीकी विधिक शब्दों का सही प्रतिलेखन करें।",
            "tags": "संविधान,उद्देशिका,विधि,नागरिक"
        },
        # 4. Hindi - History
        {
            "title": "भारत का स्वर्णिम इतिहास — सम्राट अशोक और मौर्य वंश",
            "category_slug": "indian-history",
            "language": "hindi",
            "difficulty": "medium",
            "target_wpm": 45,
            "duration_seconds": 200,
            "official_text": "प्राचीन भारत का इतिहास गौरवशाली परंपराओं, अद्भुत स्थापत्य और आदर्श शासन व्यवस्था का अनूठा संगम है। मौर्य साम्राज्य के महान शासक सम्राट अशोक ने कलिंग युद्ध के उपरांत शस्त्र त्याग कर धम्म विजय का मार्ग अपनाया। उनके शिलालेख और स्तंभ आज भी संपूर्ण भारतवर्ष में अहिंसा, सहिष्णुता, जनकल्याण और नैतिक आचरण का संदेश देते हैं। पाटलिपुत्र की भव्यता और चाणक्य की अर्थनीति ने भारतीय राजनीति को एक संगठित और सुदृढ़ आधार प्रदान किया। नालंदा और तक्षशिला जैसे प्राचीन विश्वविद्यालयों में विश्व भर से जिज्ञासु ज्ञानार्जन के लिए आते थे। इतिहास हमें अपनी जड़ों को समझने और भविष्य के लिए विवेकपूर्ण निर्णय लेने की प्रेरणा देता है।",
            "instructions": "ऐतिहासिक नामों, स्थानों और तिथियों की शुद्धता पर ध्यान दें।",
            "tags": "इतिहास,मौर्य,अशोक,चाणक्य"
        },
        # 5. Hindi - Science & Tech
        {
            "title": "आधुनिक विज्ञान — डिजिटल भारत और अंतरिक्ष अनुसंधान",
            "category_slug": "science-technology",
            "language": "hindi",
            "difficulty": "medium",
            "target_wpm": 40,
            "duration_seconds": 220,
            "official_text": "इक्कीसवीं सदी विज्ञान और तकनीकी नवाचारों की सदी है। भारत ने अंतरिक्ष अनुसंधान के क्षेत्र में चंद्रयान और गगनयान जैसे महत्वाकांक्षी अभियानों के माध्यम से वैश्विक स्तर पर अपनी तकनीकी दक्षता सिद्ध की है। भारतीय अंतरिक्ष अनुसंधान संगठन के वैज्ञानिकों का समर्पण देश के युवाओं के लिए महान प्रेरणा का स्रोत है। साथ ही, डिजिटल इंडिया अभियान ने सुदूर ग्रामीण क्षेत्रों तक बैंकिंग, शिक्षा और स्वास्थ्य सेवाओं की पहुंच को अत्यंत सुलभ बना दिया है। कृत्रिम बुद्धिमत्ता और आधुनिक डेटा विश्लेषण भविष्य के उद्योगों की दिशा तय कर रहे हैं। विज्ञान का अंतिम उद्देश्य मानव जीवन को सरल, समृद्ध और पर्यावरण-अनुकूल बनाना होना चाहिए।",
            "instructions": "वैज्ञानिक शब्दावली और तकनीकी शब्दों के स्पेलिंग पर ध्यान केंद्रित करें।",
            "tags": "विज्ञान,इसरो,अंतरिक्ष,डिजिटल"
        },
        # 6. Hindi - General Knowledge
        {
            "title": "सामान्य ज्ञान — भारत की समृद्ध नदियां और जल संसाधन",
            "category_slug": "general-knowledge",
            "language": "hindi",
            "difficulty": "easy",
            "target_wpm": 35,
            "duration_seconds": 180,
            "official_text": "भारत एक नदी प्रधान देश है जहां नदियां केवल जल का स्रोत नहीं, बल्कि सभ्यता और संस्कृति की संवाहक रही हैं। उत्तर भारत में हिमालय से निकलने वाली गंगा, यमुना, सिंधु और ब्रह्मपुत्र नदियां वर्ष भर जल से परिपूर्ण रहती हैं और उपजाऊ मैदानों का निर्माण करती हैं। वहीं दक्षिण भारत की गोदावरी, कृष्णा, कावेरी और नर्मदा नदियां पठारी क्षेत्रों को जीवनदायिनी ऊर्जा प्रदान करती हैं। जल का संरक्षण आज के समय की सबसे बड़ी आवश्यकता बन चुका है। वर्षा जल संचयन, बांधों का समुचित प्रबंधन और नदियों की स्वच्छता के प्रति जन-जागरूकता फैलाना प्रत्येक जिम्मेदार नागरिक का परम कर्तव्य है।",
            "instructions": "नदियों के नामों और भौगोलिक शब्दों को शुद्ध रूप में टाइप करें।",
            "tags": "भूगोल,नदियां,जल,संसाधन"
        },
        # 7. Hindi - Current Affairs
        {
            "title": "करंट अफेयर्स — नवीकरणीय ऊर्जा और हरित विकास लक्ष्य",
            "category_slug": "current-affairs",
            "language": "hindi",
            "difficulty": "medium",
            "target_wpm": 45,
            "duration_seconds": 190,
            "official_text": "वर्तमान वैश्विक परिदृश्य में सतत विकास और हरित ऊर्जा का महत्व निरंतर बढ़ता जा रहा है। भारत ने वर्ष दो हजार सत्तर तक शून्य कार्बन उत्सर्जन का महत्वाकांक्षी लक्ष्य निर्धारित किया है। सौर ऊर्जा, पवन ऊर्जा और हरित हाइड्रोजन के उत्पादन में देश ने उल्लेखनीय प्रगति दर्ज की है। अंतर्राष्ट्रीय सौर गठबंधन में भारत की अग्रणी भूमिका विश्व पटल पर सराही गई है। इलेक्ट्रिक वाहनों के प्रोत्साहन और पारंपरिक जीवाश्म ईंधनों पर निर्भरता कम करने के लिए सरकार द्वारा व्यापक नीतियां लागू की गई हैं। पर्यावरण संतुलन बनाए रखते हुए आर्थिक संवृद्धि हासिल करना ही वास्तविक प्रगति का मूल मंत्र है।",
            "instructions": "समसामयिक आर्थिक और पर्यावरणीय शब्दों को सावधानीपूर्वक टाइप करें।",
            "tags": "पर्यावरण,हरित ऊर्जा,सौर,नीति"
        },
        # 8. Hindi - Editorial
        {
            "title": "समाचार सम्पादकीय — ग्रामीण अर्थव्यवस्था और आत्मनिर्भर कृषि",
            "category_slug": "editorial-passages",
            "language": "hindi",
            "difficulty": "medium",
            "target_wpm": 42,
            "duration_seconds": 210,
            "official_text": "ग्रामीण भारत देश की अर्थव्यवस्था की रीढ़ है। यदि गांव समृद्ध होंगे, तभी राष्ट्र वास्तव में स्वावलंबी बन सकेगा। कृषि क्षेत्र में आधुनिक तकनीकों, जैविक उर्वरकों और ड्रिप सिंचाई प्रणाली का विस्तार किसानों की आय बढ़ाने में मील का पत्थर साबित हो रहा है। इसके साथ ही खाद्य प्रसंस्करण उद्योगों और स्थानीय कुटीर उद्योगों को बढ़ावा देने से ग्रामीण युवाओं के लिए रोजगार के नए द्वार खुल रहे हैं। डिजिटल मंडियों के माध्यम से किसान अब अपनी उपज का उचित मूल्य सीधे प्राप्त कर रहे हैं। बिचौलियों की भूमिका समाप्त होने से पारदर्शिता आई है। ग्रामीण सशक्तिकरण ही समग्र राष्ट्रीय विकास का आधार स्तंभ है।",
            "instructions": "संपादकीय शैली के गंभीर वाक्यों का स्पष्ट श्रुतलेख और टंकण करें।",
            "tags": "संपादकीय,कृषि,अर्थव्यवस्था,ग्राम"
        },
        # 9. Hindi - SSC Stenographer
        {
            "title": "SSC Stenographer विशेष — प्रशासनिक दक्षता और जनसेवा",
            "category_slug": "ssc-steno",
            "language": "hindi",
            "difficulty": "hard",
            "target_wpm": 50,
            "duration_seconds": 250,
            "official_text": "संसदीय प्रजातंत्र में लोक प्रशासन का मूल उद्देश्य नागरिकों को समयबद्ध, पारदर्शी और भ्रष्टाचार-मुक्त सेवाएं प्रदान करना है। शासकीय अधिकारियों और कर्मचारियों को अपने पदीय दायित्वों का निर्वहन पूरी निष्ठा, निष्पक्षता और संवेदनशीलता के साथ करना चाहिए। फाइलों के त्वरित निस्तारण, ई-ऑफिस प्रणाली के प्रभावी क्रियान्वयन और जनता की शिकायतों के निवारण हेतु एक मजबूत तंत्र की स्थापना अत्यंत आवश्यक है। जब तक प्रशासनिक निर्णयों में जनहित को सर्वोच्च प्राथमिकता नहीं दी जाएगी, तब तक विकास की योजनाएं अंतिम पंक्ति के व्यक्ति तक नहीं पहुंच सकतीं। आशुलिपिक इस शासकीय कार्यप्रणाली में महत्वपूर्ण सेतु के रूप में कार्य करते हैं।",
            "instructions": "एसएससी आशुलिपिक ग्रेड सी एवं डी परीक्षा स्तर का गद्यांश। 50 शब्द प्रति मिनट की गति अपेक्षित है।",
            "tags": "एसएससी,प्रशासन,स्टेनो,परीक्षा"
        },
        # 10. Hindi - Court Steno
        {
            "title": "उच्च न्यायालय विधिक डिक्टेशन — आपराधिक प्रक्रिया एवं साक्ष्य विधि",
            "category_slug": "court-steno",
            "language": "hindi",
            "difficulty": "hard",
            "target_wpm": 55,
            "duration_seconds": 240,
            "official_text": "न्यायालय के समक्ष प्रस्तुत साक्ष्यों एवं गवाहों के बयानों के सूक्ष्म परीक्षण के उपरांत यह स्पष्ट होता है कि अभियोजन पक्ष अपने मामले को युक्तियुक्त संदेह से परे साबित करने में असफल रहा है। भारतीय साक्ष्य अधिनियम की सुसंगत धाराओं के अंतर्गत मौखिक एवं दस्तावेजी साक्ष्य में परस्पर विरोधाभास पाया गया है। दंड प्रक्रिया संहिता के स्थापित प्रावधानों के अनुसार जब तक किसी अभियुक्त के विरुद्ध ठोस और विश्वसनीय साक्ष्य उपलब्ध न हों, तब तक उसे संदेहास्पद परिस्थितियों के आधार पर दोषी नहीं ठहराया जा सकता। नैसर्गिक न्याय का यह सर्वमान्य सिद्धांत है कि सौ दोषी भले छूट जाएं, पर एक भी निर्दोष को सजा नहीं होनी चाहिए। तदनुसार अपील स्वीकार की जाती है।",
            "instructions": "हाईकोर्ट और जिला न्यायालयों की स्टेनो परीक्षा के लिए विधिक डिक्टेशन। पूर्णविराम एवं कानूनी शब्दों पर विशेष ध्यान दें।",
            "tags": "कोर्ट,विधिक,कानून,न्यायालय"
        },
        # 11. English - Constitutional Law
        {
            "title": "Constitutional Law — Preamble and Democratic Principles",
            "category_slug": "indian-constitution",
            "language": "english",
            "difficulty": "medium",
            "target_wpm": 50,
            "duration_seconds": 200,
            "official_text": "We, the people of India, having solemnly resolved to constitute India into a Sovereign Socialist Secular Democratic Republic and to secure to all its citizens justice, social, economic and political; liberty of thought, expression, belief, faith and worship; equality of status and of opportunity; and to promote among them all fraternity assuring the dignity of the individual and the unity and integrity of the Nation. The Constitution stands as the supreme law of the land, safeguarding fundamental freedoms and establishing institutional accountability across executive, legislative, and judicial branches.",
            "instructions": "Official English preamble dictation. Maintain proper capitalization and punctuation throughout.",
            "tags": "Constitution,Democracy,Law,Preamble"
        },
        # 12. English - Parliamentary Debates
        {
            "title": "Parliamentary Debates — Sustainable Economic Reforms",
            "category_slug": "general-knowledge",
            "language": "english",
            "difficulty": "medium",
            "target_wpm": 45,
            "duration_seconds": 210,
            "official_text": "Madam Speaker, I rise today to emphasize the critical imperative of structural economic reforms geared toward long-term sustainability and equitable wealth generation. Industrial expansion must be harmonized with environmental safeguards and renewable energy mandates. Small and medium enterprises represent the vibrant backbone of our domestic economy, creating employment opportunities for millions of young graduates. Fiscal prudence combined with targeted infrastructure investments will ensure macroeconomic stability and reinforce investor confidence in our domestic manufacturing corridors.",
            "instructions": "Parliamentary style speech dictation. Watch for formal terminology and hyphenated compounds.",
            "tags": "Parliament,Economy,Reforms,Finance"
        },
        # 13. English - Technology & AI
        {
            "title": "Technology & Innovation — The Era of Artificial Intelligence",
            "category_slug": "science-technology",
            "language": "english",
            "difficulty": "hard",
            "target_wpm": 55,
            "duration_seconds": 220,
            "official_text": "The advent of artificial intelligence and advanced machine learning models represents a watershed moment in human civilizational history. From healthcare diagnostics and genomic sequencing to automated transportation and renewable grid optimization, computational intelligence is fundamentally transforming productivity paradigms. However, technological acceleration necessitates robust ethical governance frameworks to mitigate algorithmic bias, ensure data privacy, and protect digital sovereignty. Education systems must evolve dynamically to equip the forthcoming workforce with analytical dexterity and continuous adaptability.",
            "instructions": "High-speed technology dictation with advanced vocabulary. Target speed 55 WPM.",
            "tags": "AI,Technology,MachineLearning,Future"
        },
        # 14. English - Editorial
        {
            "title": "Editorial Column — Climate Action and Environmental Stewardship",
            "category_slug": "editorial-passages",
            "language": "english",
            "difficulty": "easy",
            "target_wpm": 40,
            "duration_seconds": 180,
            "official_text": "Global climate change is no longer an abstract future projection; it is an undeniable reality confronting ecosystems across every continent. Rising sea levels, prolonged droughts, and erratic weather patterns severely threaten agricultural food security and municipal water reserves. Decarbonizing industrial supply chains and investing in afforestation are essential imperatives. Genuine environmental stewardship demands collective civic action alongside bold legislative initiatives. Preserving our planet for future generations is our most sacred intergenerational obligation.",
            "instructions": "Clean editorial passage. Suitable for beginners and intermediate stenographers.",
            "tags": "Climate,Environment,Editorial,Nature"
        },
        # 15. English - SSC Stenographer Practice
        {
            "title": "SSC Stenographer Grade C & D — Public Governance and Ethics",
            "category_slug": "ssc-steno",
            "language": "english",
            "difficulty": "hard",
            "target_wpm": 50,
            "duration_seconds": 240,
            "official_text": "In a democratic administrative framework, public servants are entrusted with the constitutional duty of upholding the rule of law with unyielding integrity and moral rectitude. Effective governance demands not merely procedural adherence, but a profound empathy for marginalized segments of society. Bureaucratic inertia must yield to proactive grievance redressal mechanisms facilitated by modern digital workflows. Transparency in governmental disbursements fosters public trust and fortifies institutional legitimacy. Stenographers and secretarial officers constitute the operational backbone of this administrative machinery.",
            "instructions": "Standard SSC Stenographer Grade C/D examination style test passage. 50 words per minute.",
            "tags": "SSC,Administration,Governance,Exam"
        }
    ]

    for p in passages_data:
        cat_id = cat_map.get(p["category_slug"], 1)
        # Check if already exists
        c.execute("SELECT id FROM passages WHERE title = ?", (p["title"],))
        existing = c.fetchone()
        if not existing:
            c.execute("""
                INSERT INTO passages (
                    title, category_id, language, difficulty, official_text, instructions,
                    target_wpm, duration_seconds, tags, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
            """, (
                p["title"], cat_id, p["language"], p["difficulty"], p["official_text"],
                p["instructions"], p["target_wpm"], p["duration_seconds"], p["tags"],
                now_iso, now_iso
            ))

    conn.commit()
    conn.close()


# ==========================================
# Authentication & Sessions
# ==========================================

def create_user(username: str, email: str, password: str, display_name: str = None, target_exam: str = "SSC Stenographer", ref_code: str = None, phone: str = "") -> Dict[str, Any]:
    conn = get_db()
    c = conn.cursor()
    try:
        user_ref = f"SM{secrets.token_hex(3).upper()}"
        now = datetime.now().isoformat()
        year = datetime.now().year
        pwd_hash = hash_password(password)

        c.execute("""
            INSERT INTO users (username, email, phone, password_hash, role, referral_code, subscription_status, created_at)
            VALUES (?, ?, ?, ?, 'student', ?, 'free', ?)
        """, (username, email.lower().strip(), phone.strip() if phone else None, pwd_hash, user_ref, now))
        user_id = c.lastrowid

        student_code = f"STM-{year}-{user_id:06d}"
        c.execute("UPDATE users SET student_code = ? WHERE id = ?", (student_code, user_id))

        d_name = display_name or username
        # Strict Rule: New users always start with points = 0
        c.execute("""
            INSERT INTO profiles (user_id, display_name, target_exam, points, streak_days)
            VALUES (?, ?, ?, 0, 0)
        """, (user_id, d_name, target_exam))

        c.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))

        # Process referral code if provided
        if ref_code:
            c.execute("SELECT id FROM users WHERE referral_code = ?", (ref_code.strip().upper(),))
            referrer = c.fetchone()
            if referrer and referrer['id'] != user_id:
                referrer_id = referrer['id']
                c.execute("""
                    INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, reward_points, created_at)
                    VALUES (?, ?, ?, 50, ?)
                """, (referrer_id, user_id, ref_code.strip().upper(), now))
                c.execute("UPDATE profiles SET points = points + 50 WHERE user_id = ?", (referrer_id,))
                c.execute("""
                    INSERT INTO reward_transactions (user_id, points, type, reference_id, description, created_at)
                    VALUES (?, 50, 'referral_bonus', ?, 'Referral reward for inviting new student', ?)
                """, (referrer_id, f"ref:{user_id}", now))

        conn.commit()
        return {"success": True, "user_id": user_id, "username": username, "email": email, "student_code": student_code}
    except sqlite3.IntegrityError as e:
        conn.rollback()
        err_msg = str(e)
        if 'users.email' in err_msg:
            return {"success": False, "error": "इस ईमेल से खाता पहले से मौजूद है। (Email already registered)"}
        elif 'users.username' in err_msg:
            return {"success": False, "error": "यह यूज़रनेम पहले से उपयोग में है। (Username already taken)"}
        elif 'users.phone' in err_msg:
            return {"success": False, "error": "यह फ़ोन नंबर पहले से उपयोग में है। (Phone number already registered)"}
        return {"success": False, "error": "खाता निर्माण में त्रुटि।"}
    finally:
        conn.close()


def create_student_registration(
    full_name: str,
    phone: str,
    email: str,
    password: str,
    target_exam: str = "SSC Stenographer",
    preferred_language: str = "hindi",
    preferred_typing_mode: str = "mangal",
    referral_code: str = ""
) -> Dict[str, Any]:
    """Production Student Registration: validates all inputs, ensures starting points = 0, generates Student ID."""
    clean_name = full_name.strip()
    clean_phone = phone.strip().replace(" ", "").replace("-", "")
    clean_email = email.lower().strip()

    if not clean_name:
        return {"success": False, "error": "पूरा नाम आवश्यक है (Full name is required)"}
    if not clean_email or '@' not in clean_email or '.' not in clean_email:
        return {"success": False, "error": "मान्य ईमेल पता आवश्यक है (Valid email is required)"}
    if not clean_phone or len(clean_phone) < 10:
        return {"success": False, "error": "मान्य 10-अंकीय फ़ोन नंबर आवश्यक है (Valid 10-digit phone number is required)"}
    if not password or len(password) < 6:
        return {"success": False, "error": "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए (Password minimum 6 characters)"}

    # Generate clean unique username
    base_user = "".join(ch for ch in clean_name.lower() if ch.isalnum()) or "student"
    username = base_user
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
    if c.fetchone():
        conn.close()
        return {"success": False, "error": "इस ईमेल से खाता पहले से मौजूद है। (Email already registered)"}
    c.execute("SELECT id FROM users WHERE phone = ?", (clean_phone,))
    if c.fetchone():
        conn.close()
        return {"success": False, "error": "इस फ़ोन नंबर से खाता पहले से मौजूद है। (Phone number already registered)"}

    idx = 1
    while True:
        c.execute("SELECT id FROM users WHERE username = ?", (username,))
        if not c.fetchone():
            break
        idx += 1
        username = f"{base_user}{idx}"
    conn.close()

    res = create_user(
        username=username,
        email=clean_email,
        password=password,
        display_name=clean_name,
        target_exam=target_exam,
        ref_code=referral_code,
        phone=clean_phone
    )

    if res.get("success"):
        # Update preferences in profile
        conn = get_db()
        c = conn.cursor()
        c.execute("""
            UPDATE profiles
            SET preferred_language = ?, preferred_typing_mode = ?
            WHERE user_id = ?
        """, (preferred_language, preferred_typing_mode, res["user_id"]))
        conn.commit()
        conn.close()
        res["display_name"] = clean_name
        res["phone"] = clean_phone

    return res


def authenticate_user(email_or_username: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    clean_identifier = email_or_username.lower().strip()
    c.execute("""
        SELECT u.id, u.username, u.email, u.phone, u.student_code, u.password_hash, u.role, u.is_active,
               u.subscription_status, u.subscription_plan, u.subscription_start, u.subscription_end,
               p.display_name, p.avatar, p.target_exam, p.preferred_language, p.preferred_typing_mode,
               p.target_wpm, p.points, p.streak_days, p.show_on_leaderboard
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE (u.email = ? OR u.username = ? OR u.phone = ?) AND u.is_active = 1
    """, (clean_identifier, email_or_username.strip(), clean_identifier))
    user = c.fetchone()

    if not user:
        conn.close()
        return None

    if user['password_hash'] != hash_password(password):
        conn.close()
        return None

    user_dict = dict(user)

    # Check subscription expiration
    if user_dict.get('subscription_status') == 'active' and user_dict.get('subscription_end'):
        try:
            exp_date = datetime.fromisoformat(user_dict['subscription_end'])
            if datetime.now() > exp_date:
                c.execute("UPDATE users SET subscription_status = 'expired' WHERE id = ?", (user_dict['id'],))
                conn.commit()
                user_dict['subscription_status'] = 'expired'
        except Exception:
            pass

    conn.close()
    return user_dict


def create_session(user_id: int, ip_address: Optional[str] = None, user_agent: Optional[str] = None, device_name: Optional[str] = None) -> str:
    token = secrets.token_hex(32)
    now = datetime.now()
    now_iso = now.isoformat()
    expires = (now + timedelta(days=30)).isoformat()
    ip_clean = (ip_address or 'Unknown IP').strip()
    device_clean = (device_name or 'Web Browser').strip()

    conn = get_db()
    c = conn.cursor()

    # Single-Device Concurrent Login Prevention:
    # Invalidate any previously active sessions for this user with details of the new login
    c.execute("""
        UPDATE sessions
        SET is_active = 0,
            invalidated_reason = 'concurrent_login',
            superseded_by_ip = ?,
            superseded_at = ?
        WHERE user_id = ? AND is_active = 1
    """, (ip_clean, now_iso, user_id))

    # Insert new active session
    c.execute("""
        INSERT INTO sessions (
            token, user_id, ip_address, user_agent, device_name,
            created_at, expires_at, last_active_at, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (token, user_id, ip_clean, user_agent or '', device_clean, now_iso, expires, now_iso))
    conn.commit()
    conn.close()
    return token


def verify_session(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    conn = get_db()
    c = conn.cursor()

    # Check session record state
    c.execute("""
        SELECT token, user_id, is_active, invalidated_reason, superseded_by_ip, superseded_at, expires_at
        FROM sessions
        WHERE token = ?
    """, (token,))
    s_row = c.fetchone()

    if not s_row:
        conn.close()
        return None

    # Check if session was terminated/superseded due to concurrent login from another device
    if not s_row['is_active']:
        conn.close()
        return {
            "_session_error": "concurrent_login",
            "invalidated_reason": s_row['invalidated_reason'] or 'concurrent_login',
            "superseded_by_ip": s_row['superseded_by_ip'] or 'Another Device',
            "superseded_at": s_row['superseded_at'] or datetime.now().isoformat(),
            "user_id": s_row['user_id']
        }

    # Check expiration
    if s_row['expires_at'] <= datetime.now().isoformat():
        conn.close()
        return None

    c.execute("""
        SELECT s.user_id, s.ip_address as session_ip, s.device_name as session_device,
               u.username, u.email, u.phone, u.student_code, u.role,
               u.subscription_status, u.subscription_plan, u.subscription_start, u.subscription_end,
               p.display_name, p.avatar, p.target_exam, p.preferred_language, p.preferred_typing_mode,
               p.target_wpm, p.points, p.streak_days, p.show_on_leaderboard, u.referral_code
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE s.token = ? AND s.is_active = 1
    """, (token,))
    row = c.fetchone()

    if not row:
        conn.close()
        return None

    res = dict(row)

    # Touch last_active_at
    try:
        c.execute("UPDATE sessions SET last_active_at = ? WHERE token = ?", (datetime.now().isoformat(), token))
        conn.commit()
    except Exception:
        pass

    # Check subscription expiry
    if res.get('subscription_status') == 'active' and res.get('subscription_end'):
        try:
            exp_date = datetime.fromisoformat(res['subscription_end'])
            if datetime.now() > exp_date:
                c.execute("UPDATE users SET subscription_status = 'expired' WHERE id = ?", (res['user_id'],))
                conn.commit()
                res['subscription_status'] = 'expired'
        except Exception:
            pass

    conn.close()
    return res


def get_session_status(token: str) -> Dict[str, Any]:
    if not token:
        return {"status": "invalid"}
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT token, user_id, is_active, invalidated_reason, superseded_by_ip, superseded_at, expires_at, ip_address, device_name
        FROM sessions
        WHERE token = ?
    """, (token,))
    row = c.fetchone()
    conn.close()

    if not row:
        return {"status": "invalid"}
    if not row['is_active']:
        return {
            "status": "terminated",
            "error": "concurrent_login",
            "reason": row['invalidated_reason'] or 'concurrent_login',
            "superseded_by_ip": row['superseded_by_ip'] or 'Another Device',
            "superseded_at": row['superseded_at'] or datetime.now().isoformat()
        }
    if row['expires_at'] <= datetime.now().isoformat():
        return {"status": "expired"}
    return {
        "status": "active",
        "ip_address": row['ip_address'],
        "device_name": row['device_name']
    }


def delete_session(token: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ==========================================
# Passages & Categories
# ==========================================

def get_free_passage_ids(limit: int = 2) -> List[int]:
    """Returns the IDs of the first 2 published passages that are completely free for everyone."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM passages WHERE status = 'published' ORDER BY id ASC LIMIT ?", (limit,))
    rows = [r["id"] for r in c.fetchall()]
    conn.close()
    return rows


def is_passage_accessible(user_id: Optional[int], passage_id: int) -> bool:
    """
    Checks if a passage is accessible by the user.
    - Exactly 2 published classes/passages are completely free for all users.
    - All other passages require an active Pro subscription or admin access.
    """
    free_ids = get_free_passage_ids(2)
    if passage_id in free_ids:
        return True
    if not user_id:
        return False
    return is_user_premium(user_id)


def get_categories():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT c.*, COUNT(p.id) as passage_count
        FROM categories c
        LEFT JOIN passages p ON c.id = p.category_id AND p.status = 'published'
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
    """)
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_passages(
    language: Optional[str] = None,
    difficulty: Optional[str] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    user_id: Optional[int] = None,
    include_official_text: bool = False
) -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()

    query = """
        SELECT p.id, p.title, p.category_id, p.language, p.difficulty, p.instructions,
               p.target_wpm, p.duration_seconds, p.audio_url, p.thumbnail, p.tags, p.status, p.is_premium,
               p.view_count, p.attempt_count, p.created_at,
               c.name as category_name, c.slug as category_slug
    """
    if include_official_text:
        query += ", p.official_text, p.official_text_krutidev "

    if user_id:
        query += """,
            (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = ? AND b.passage_id = p.id) as is_bookmarked,
            (SELECT MAX(pa.net_wpm) FROM practice_attempts pa WHERE pa.user_id = ? AND pa.passage_id = p.id) as best_wpm,
            (SELECT MAX(pa.accuracy) FROM practice_attempts pa WHERE pa.user_id = ? AND pa.passage_id = p.id) as best_accuracy,
            (SELECT COUNT(*) FROM practice_attempts pa WHERE pa.user_id = ? AND pa.passage_id = p.id) as user_attempts
        """
        params = [user_id, user_id, user_id, user_id]
    else:
        query += """, 0 as is_bookmarked, NULL as best_wpm, NULL as best_accuracy, 0 as user_attempts """
        params = []

    query += """
        FROM passages p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published'
    """

    if language and language != 'all':
        query += " AND p.language = ? "
        params.append(language.lower())
    if difficulty and difficulty != 'all':
        query += " AND p.difficulty = ? "
        params.append(difficulty.lower())
    if category_id:
        query += " AND p.category_id = ? "
        params.append(category_id)
    if search:
        query += " AND (p.title LIKE ? OR p.tags LIKE ?) "
        like_str = f"%{search}%"
        params.extend([like_str, like_str])

    query += " ORDER BY p.id ASC "

    c.execute(query, params)
    rows = c.fetchall()
    conn.close()

    free_ids = set(get_free_passage_ids(2))
    user_has_pro = is_user_premium(user_id) if user_id else False

    result = []
    for r in rows:
        item = dict(r)
        item['is_free_tier'] = item['id'] in free_ids
        item['is_locked'] = False if user_has_pro else (item['id'] not in free_ids)
        result.append(item)
    return result


def get_passage_detail(passage_id: int, user_id: Optional[int] = None, include_official: bool = False, is_admin: bool = False) -> Optional[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()

    query = """
        SELECT p.id, p.title, p.category_id, p.language, p.difficulty, p.instructions,
               p.target_wpm, p.duration_seconds, p.audio_url, p.thumbnail, p.tags, p.status, p.is_premium,
               p.view_count, p.attempt_count, p.created_at,
               c.name as category_name, c.slug as category_slug
    """
    if include_official or is_admin:
        query += ", p.official_text, p.official_text_krutidev "

    if user_id:
        query += """,
            (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = ? AND b.passage_id = p.id) as is_bookmarked,
            (SELECT MAX(pa.net_wpm) FROM practice_attempts pa WHERE pa.user_id = ? AND pa.passage_id = p.id) as best_wpm,
            (SELECT MAX(pa.accuracy) FROM practice_attempts pa WHERE pa.user_id = ? AND pa.passage_id = p.id) as best_accuracy
        """
        params = [user_id, user_id, user_id, passage_id]
    else:
        query += ", 0 as is_bookmarked, NULL as best_wpm, NULL as best_accuracy "
        params = [passage_id]

    query += """
        FROM passages p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
    """
    if not is_admin:
        query += " AND p.status = 'published' "

    c.execute(query, params)
    row = c.fetchone()

    if row:
        c.execute("UPDATE passages SET view_count = view_count + 1 WHERE id = ?", (passage_id,))
        conn.commit()
        res_dict = dict(row)
        free_ids = set(get_free_passage_ids(2))
        user_has_pro = is_user_premium(user_id) if user_id else False
        res_dict['is_free_tier'] = res_dict['id'] in free_ids
        res_dict['is_locked'] = False if user_has_pro else (res_dict['id'] not in free_ids)
        conn.close()
        return res_dict

    conn.close()
    return None


def get_recent_duplicate_attempt(user_id: int, passage_id: int, raw_input: str, max_age_seconds: int = 5) -> Optional[Dict[str, Any]]:
    """Checks if a user submitted identical text for the same passage within the last few seconds to prevent duplicates."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT id, report_json, created_at
        FROM practice_attempts
        WHERE user_id = ? AND passage_id = ? AND raw_input = ?
        ORDER BY id DESC
        LIMIT 1
    """, (user_id, passage_id, raw_input))
    row = c.fetchone()
    conn.close()
    if not row:
        return None

    try:
        created_time = datetime.fromisoformat(row['created_at'])
        delta = (datetime.now() - created_time).total_seconds()
        if delta <= max_age_seconds:
            res = json.loads(row['report_json'])
            res['attempt_id'] = row['id']
            return res
    except Exception:
        pass
    return None


# ==========================================
# Practice Attempts & Streak Updates
# ==========================================

def save_practice_attempt(
    user_id: int,
    passage_id: int,
    eval_result: Dict[str, Any],
    typing_mode: str,
    raw_input: str,
    normalized_input: str
) -> int:
    conn = get_db()
    c = conn.cursor()
    now_iso = datetime.now().isoformat()
    today_str = date.today().isoformat()

    metrics = eval_result["metrics"]
    gross_wpm = metrics["gross_wpm"]
    net_wpm = metrics["net_wpm"]
    accuracy = metrics["accuracy"]
    spelling_accuracy = metrics["spelling_accuracy"]
    error_rate = metrics["error_rate"]
    total_words = metrics["total_words_typed"]
    correct_words = metrics["correct_words"]
    total_errors = metrics["total_errors"]
    weighted_errors = metrics["weighted_errors"]
    time_taken = metrics["time_taken_seconds"]
    report_json_str = json.dumps(eval_result, ensure_ascii=False, default=str)
    c.execute("""
        INSERT INTO practice_attempts (
            user_id, passage_id, gross_wpm, net_wpm, accuracy, spelling_accuracy,
            error_rate, total_words, correct_words, total_errors, weighted_errors,
            time_taken_seconds, typing_mode, raw_input, normalized_input, report_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, passage_id, gross_wpm, net_wpm, accuracy, spelling_accuracy,
        error_rate, total_words, correct_words, total_errors, weighted_errors,
        time_taken, typing_mode, raw_input, normalized_input, report_json_str, now_iso
    ))
    attempt_id = c.lastrowid

    # Insert individual error rows for fast aggregation
    for err in eval_result.get("error_table", []):
        c.execute("""
            INSERT INTO practice_errors (attempt_id, user_id, your_text, correct_text, error_type, category, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (attempt_id, user_id, err["your_text"], err["correct_text"], err["error_type"], err["category"], err["detail"]))

    # Increment passage attempt count
    c.execute("UPDATE passages SET attempt_count = attempt_count + 1 WHERE id = ?", (passage_id,))

    # Read point settings from admin_settings
    c.execute("SELECT key, value FROM admin_settings WHERE key IN ('reward_points_practice', 'reward_points_daily_goal', 'reward_points_streak_7', 'daily_target_dictations')")
    setting_map = {r['key']: r['value'] for r in c.fetchall()}
    practice_pts = int(setting_map.get('reward_points_practice', 10))
    daily_goal_pts = int(setting_map.get('reward_points_daily_goal', 20))
    streak_7_pts = int(setting_map.get('reward_points_streak_7', 50))
    target_dictations = int(setting_map.get('daily_target_dictations', 3))

    # Update Streak & Profile
    c.execute("SELECT streak_days, longest_streak, last_practice_date, points FROM profiles WHERE user_id = ?", (user_id,))
    prof = c.fetchone()
    cur_streak = 1
    longest_streak = 1
    if prof:
        cur_streak = prof['streak_days'] or 0
        longest_streak = prof['longest_streak'] or 0
        last_date = prof['last_practice_date']

        # Streak calculation
        if last_date:
            last_dt = date.fromisoformat(last_date)
            diff = (date.today() - last_dt).days
            if diff == 0:
                # Same day practice, maintain streak
                pass
            elif diff == 1:
                cur_streak += 1
            else:
                cur_streak = 1
        else:
            cur_streak = 1

        if cur_streak > longest_streak:
            longest_streak = cur_streak

    # 1. Practice Attempt Reward (Idempotent per attempt_id)
    c.execute("""
        INSERT OR IGNORE INTO reward_transactions (user_id, points, type, reference_id, description, created_at)
        VALUES (?, ?, 'practice', ?, ?, ?)
    """, (user_id, practice_pts, f"attempt:{attempt_id}", f"डिक्टेशन अभ्यास #{attempt_id} पूर्ण", now_iso))

    # 2. Daily Goal Reward
    c.execute("SELECT COUNT(*) as count FROM practice_attempts WHERE user_id = ? AND date(created_at) = date(?)", (user_id, now_iso))
    today_count = c.fetchone()['count']
    if today_count >= target_dictations:
        c.execute("""
            INSERT OR IGNORE INTO reward_transactions (user_id, points, type, reference_id, description, created_at)
            VALUES (?, ?, 'daily_goal', ?, ?, ?)
        """, (user_id, daily_goal_pts, f"goal:{today_str}", f"दैनिक लक्ष्य ({target_dictations} डिक्टेशन) पूर्ण", now_iso))

    # 3. 7-Day Streak Milestone Reward
    if cur_streak >= 7 and cur_streak % 7 == 0:
        c.execute("""
            INSERT OR IGNORE INTO reward_transactions (user_id, points, type, reference_id, description, created_at)
            VALUES (?, ?, 'streak_7', ?, ?, ?)
        """, (user_id, streak_7_pts, f"streak_7:{today_str}", f"{cur_streak}-दिवसीय अभ्यास स्ट्रीक बोनस", now_iso))

    # Recalculate total points strictly from immutable reward ledger
    c.execute("SELECT COALESCE(SUM(points), 0) as total_pts FROM reward_transactions WHERE user_id = ?", (user_id,))
    total_ledger_pts = c.fetchone()['total_pts']

    c.execute("""
        UPDATE profiles
        SET streak_days = ?, longest_streak = ?, last_practice_date = ?, points = ?
        WHERE user_id = ?
    """, (cur_streak, longest_streak, today_str, total_ledger_pts, user_id))

    # Check and unlock achievements
    check_and_unlock_achievements(c, user_id, net_wpm, accuracy, cur_streak)

    conn.commit()
    conn.close()
    return attempt_id


def check_and_unlock_achievements(cursor, user_id: int, net_wpm: float, accuracy: float, streak: int):
    """Evaluates and awards achievements based on milestone triggers."""
    now_iso = datetime.now().isoformat()
    cursor.execute("SELECT COUNT(*) as total FROM practice_attempts WHERE user_id = ?", (user_id,))
    total_attempts = cursor.fetchone()['total']

    rules = [
        ("first_practice", "प्रथम डिक्टेशन (First Practice)", "अपनी पहली स्टेनोग्राफी डिक्टेशन सफलतापूर्ण पूर्ण की।", "compass", total_attempts >= 1),
        ("practice_10", "10 डिक्टेशन क्लब (10 Practices)", "10 डिक्टेशन अभ्यास पूरे किए।", "target", total_attempts >= 10),
        ("practice_50", "स्टेनो योद्धा (50 Practices)", "50 डिक्टेशन अभ्यास सफलतापूर्ण पूरे किए।", "shield", total_attempts >= 50),
        ("accuracy_90", "90% सटीकता स्टार (90% Accuracy)", "एक डिक्टेशन में 90% से अधिक सटीकता प्राप्त की।", "star", accuracy >= 90.0),
        ("accuracy_95", "95% सटीकता मास्टर (95% Accuracy)", "95% या अधिक उत्कृष्ट सटीकता प्राप्त की।", "award", accuracy >= 95.0),
        ("speed_40", "40 WPM गति पार (40 WPM)", "40 शब्द प्रति मिनट की स्टेनो गति पार की।", "zap", net_wpm >= 40.0),
        ("speed_50", "50 WPM गति पार (50 WPM)", "50 शब्द प्रति मिनट की गति पार की।", "trending-up", net_wpm >= 50.0),
        ("streak_7", "7-दिवसीय अभ्यास स्ट्रीक (7 Day Streak)", "लगातार 7 दिन नियमित अभ्यास किया।", "flame", streak >= 7),
    ]

    for key, title, desc, icon, cond in rules:
        if cond:
            cursor.execute("""
                INSERT OR IGNORE INTO achievements (user_id, badge_key, title, description, icon, unlocked_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, key, title, desc, icon, now_iso))


def get_practice_history(user_id: int, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT pa.id, pa.passage_id, pa.gross_wpm, pa.net_wpm, pa.accuracy, pa.spelling_accuracy,
               pa.error_rate, pa.total_words, pa.correct_words, pa.total_errors, pa.weighted_errors,
               pa.time_taken_seconds, pa.typing_mode, pa.created_at,
               p.title as passage_title, p.language, p.difficulty, c.name as category_name
        FROM practice_attempts pa
        JOIN passages p ON pa.passage_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE pa.user_id = ?
        ORDER BY pa.id DESC
        LIMIT ? OFFSET ?
    """, (user_id, limit, offset))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_attempt_detail(attempt_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    query = """
        SELECT pa.*, p.title as passage_title, p.language, p.difficulty, p.target_wpm,
               c.name as category_name
        FROM practice_attempts pa
        JOIN passages p ON pa.passage_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE pa.id = ?
    """
    params = [attempt_id]
    if user_id:
        query += " AND pa.user_id = ? "
        params.append(user_id)

    c.execute(query, params)
    row = c.fetchone()
    conn.close()
    if not row:
        return None

    res = dict(row)
    try:
        res["report"] = json.loads(res["report_json"])
    except Exception:
        res["report"] = {}
    return res


# ==========================================
# User Progress & Analytics
# ==========================================

def get_user_progress_summary(user_id: int) -> Dict[str, Any]:
    conn = get_db()
    c = conn.cursor()

    # Overall attempt stats
    c.execute("""
        SELECT
            COUNT(*) as total_practices,
            COALESCE(SUM(time_taken_seconds), 0) as total_seconds,
            COALESCE(AVG(gross_wpm), 0) as avg_gross_wpm,
            COALESCE(MAX(gross_wpm), 0) as best_gross_wpm,
            COALESCE(AVG(net_wpm), 0) as avg_net_wpm,
            COALESCE(MAX(net_wpm), 0) as best_net_wpm,
            COALESCE(AVG(accuracy), 0) as avg_accuracy,
            COALESCE(MAX(accuracy), 0) as best_accuracy,
            COALESCE(SUM(total_words), 0) as total_words_typed,
            COALESCE(SUM(total_errors), 0) as total_errors_count
        FROM practice_attempts
        WHERE user_id = ?
    """, (user_id,))
    stats = dict(c.fetchone())

    # Profile & Streak
    c.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    prof = dict(c.fetchone() or {})

    # Today's goal progress
    today_str = date.today().isoformat()
    c.execute("""
        SELECT COUNT(*) as today_count,
               COALESCE(SUM(time_taken_seconds), 0) as today_seconds,
               COALESCE(MAX(net_wpm), 0) as today_best_wpm
        FROM practice_attempts
        WHERE user_id = ? AND date(created_at) = date('now')
    """, (user_id,))
    today_stats = dict(c.fetchone())

    # Weak areas aggregated across all errors
    c.execute("""
        SELECT category, COUNT(*) as count
        FROM practice_errors
        WHERE user_id = ?
        GROUP BY category
        ORDER BY count DESC
    """, (user_id,))
    error_freq = [dict(r) for r in c.fetchall()]

    # Speed & accuracy progression over the last 15 attempts
    c.execute("""
        SELECT id, net_wpm, gross_wpm, accuracy, date(created_at) as practice_date
        FROM practice_attempts
        WHERE user_id = ?
        ORDER BY id ASC
        LIMIT 20
    """, (user_id,))
    trend_history = [dict(r) for r in c.fetchall()]

    # Unlocked achievements
    c.execute("""
        SELECT badge_key, title, description, icon, unlocked_at
        FROM achievements
        WHERE user_id = ?
        ORDER BY id ASC
    """, (user_id,))
    achievements = [dict(r) for r in c.fetchall()]

    conn.close()

    total_secs = stats["total_seconds"]
    hours = total_secs // 3600
    minutes = (total_secs % 3600) // 60

    return {
        "stats": {
            "total_practices": stats["total_practices"],
            "total_time_formatted": f"{hours}h {minutes}m" if hours > 0 else f"{minutes} mins",
            "avg_wpm": round(stats["avg_net_wpm"], 1),
            "best_wpm": round(stats["best_net_wpm"], 1),
            "avg_accuracy": round(stats["avg_accuracy"], 1),
            "best_accuracy": round(stats["best_accuracy"], 1),
            "total_words": stats["total_words_typed"],
            "total_errors": stats["total_errors_count"],
            "streak_days": prof.get("streak_days", 0),
            "longest_streak": prof.get("longest_streak", 0),
            "target_wpm": prof.get("target_wpm", 50),
            "points": prof.get("points") if prof.get("points") is not None else 0
        },
        "today_goal": {
            "target_dictations": 3,
            "completed_dictations": today_stats["today_count"],
            "target_minutes": 15,
            "completed_minutes": round(today_stats["today_seconds"] / 60.0, 1),
            "target_speed": prof.get("target_wpm", 40),
            "today_best_wpm": round(today_stats["today_best_wpm"], 1),
            "percent_completed": min(100, int((today_stats["today_count"] / 3.0) * 100))
        },
        "error_frequency": error_freq,
        "trends": trend_history,
        "achievements": achievements
    }


# ==========================================
# Leaderboard
# ==========================================

def get_leaderboard(period: str = 'all', limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()

    time_filter = ""
    if period == 'today':
        time_filter = " AND date(pa.created_at) = date('now') "
    elif period == 'week':
        time_filter = " AND date(pa.created_at) >= date('now', '-7 days') "
    elif period == 'month':
        time_filter = " AND date(pa.created_at) >= date('now', '-30 days') "

    query = f"""
        SELECT u.id as user_id,
               CASE WHEN p.show_on_leaderboard = 1 THEN p.display_name ELSE 'Anonymous Steno' END as display_name,
               p.avatar, p.target_exam, p.points,
               COUNT(pa.id) as attempts_count,
               COALESCE(MAX(pa.net_wpm), 0) as best_wpm,
               COALESCE(AVG(pa.accuracy), 0) as avg_accuracy
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN practice_attempts pa ON u.id = pa.user_id {time_filter}
        WHERE u.is_active = 1
        GROUP BY u.id
        HAVING attempts_count > 0 OR p.points > 0
        ORDER BY best_wpm DESC, avg_accuracy DESC, p.points DESC
        LIMIT ?
    """
    c.execute(query, (limit,))
    rows = c.fetchall()
    conn.close()

    result = []
    for rank, row in enumerate(rows, 1):
        item = dict(row)
        item['rank'] = rank
        item['best_wpm'] = round(item['best_wpm'], 1)
        item['avg_accuracy'] = round(item['avg_accuracy'], 1)
        result.append(item)
    return result


# ==========================================
# Bookmarks
# ==========================================

def toggle_bookmark(user_id: int, passage_id: int) -> bool:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM bookmarks WHERE user_id = ? AND passage_id = ?", (user_id, passage_id))
    existing = c.fetchone()
    if existing:
        c.execute("DELETE FROM bookmarks WHERE id = ?", (existing['id'],))
        is_bookmarked = False
    else:
        c.execute("INSERT INTO bookmarks (user_id, passage_id, created_at) VALUES (?, ?, ?)",
                  (user_id, passage_id, datetime.now().isoformat()))
        is_bookmarked = True
    conn.commit()
    conn.close()
    return is_bookmarked


def get_user_bookmarks(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT p.id, p.title, p.language, p.difficulty, p.duration_seconds, p.target_wpm,
               c.name as category_name,
               COALESCE(MAX(pa.net_wpm), 0) as best_wpm,
               COALESCE(MAX(pa.accuracy), 0) as best_accuracy,
               b.created_at as bookmarked_at
        FROM bookmarks b
        JOIN passages p ON b.passage_id = p.id
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN practice_attempts pa ON pa.user_id = b.user_id AND pa.passage_id = p.id
        WHERE b.user_id = ?
        GROUP BY p.id
        ORDER BY b.id DESC
    """, (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ==========================================
# Admin Functions & Analytics
# ==========================================

def get_admin_overview() -> Dict[str, Any]:
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'")
    total_users = c.fetchone()['count']

    c.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND is_active = 1")
    active_users = c.fetchone()['count']

    c.execute("SELECT COUNT(*) as count FROM passages")
    total_passages = c.fetchone()['count']

    c.execute("SELECT COUNT(*) as count FROM passages WHERE status = 'published'")
    published_passages = c.fetchone()['count']

    c.execute("SELECT COUNT(*) as count FROM practice_attempts")
    total_practices = c.fetchone()['count']

    c.execute("SELECT COUNT(*) as count FROM practice_attempts WHERE date(created_at) = date('now')")
    practices_today = c.fetchone()['count']

    c.execute("SELECT COALESCE(AVG(net_wpm), 0) as avg_wpm, COALESCE(AVG(accuracy), 0) as avg_accuracy FROM practice_attempts")
    row = c.fetchone()
    avg_wpm = round(row['avg_wpm'], 1)
    avg_accuracy = round(row['avg_accuracy'], 1)

    c.execute("""
        SELECT p.title, COUNT(pa.id) as attempts, AVG(pa.net_wpm) as avg_wpm, AVG(pa.accuracy) as avg_accuracy
        FROM passages p
        LEFT JOIN practice_attempts pa ON p.id = pa.passage_id
        GROUP BY p.id
        ORDER BY attempts DESC
        LIMIT 5
    """)
    popular_passages = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT p.title, AVG(pa.accuracy) as avg_accuracy, COUNT(pa.id) as attempts
        FROM passages p
        JOIN practice_attempts pa ON p.id = pa.passage_id
        GROUP BY p.id
        HAVING attempts >= 2
        ORDER BY avg_accuracy ASC
        LIMIT 5
    """)
    difficult_passages = [dict(r) for r in c.fetchall()]

    conn.close()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_passages": total_passages,
        "published_passages": published_passages,
        "total_practices": total_practices,
        "practices_today": practices_today,
        "avg_wpm": avg_wpm,
        "avg_accuracy": avg_accuracy,
        "popular_passages": popular_passages,
        "difficult_passages": difficult_passages
    }


def admin_save_passage(data: Dict[str, Any]) -> int:
    conn = get_db()
    c = conn.cursor()
    now_iso = datetime.now().isoformat()

    p_id = data.get("id")
    official_text = (data.get("official_text") or "").strip()
    official_text_kruti = (data.get("official_text_krutidev") or "").strip()

    import re, hindi_converter

    # If Kruti Dev text contains Devanagari Unicode, convert to genuine Kruti Dev
    if official_text_kruti and re.search(r'[\u0900-\u097F]', official_text_kruti):
        try:
            official_text_kruti = hindi_converter.unicode_to_kruti_dev(official_text_kruti)
        except Exception:
            pass

    # If Kruti Dev text not explicitly given for Hindi, auto-generate from Unicode
    if not official_text_kruti and data.get("language") == "hindi" and official_text:
        try:
            official_text_kruti = hindi_converter.unicode_to_kruti_dev(official_text)
        except Exception:
            official_text_kruti = ""

    # If official_text is Kruti Dev ASCII without Devanagari characters, convert to Unicode
    if official_text and not re.search(r'[\u0900-\u097F]', official_text) and data.get("language") == "hindi":
        try:
            official_text = hindi_converter.kruti_dev_to_unicode(official_text)
        except Exception:
            pass

    if p_id:
        c.execute("""
            UPDATE passages
            SET title = ?, category_id = ?, language = ?, difficulty = ?,
                official_text = ?, official_text_krutidev = ?, instructions = ?, target_wpm = ?, duration_seconds = ?,
                audio_url = ?, tags = ?, status = ?, updated_at = ?
            WHERE id = ?
        """, (
            data["title"], data["category_id"], data["language"], data["difficulty"],
            official_text, official_text_kruti, data.get("instructions", ""), data.get("target_wpm", 40),
            data.get("duration_seconds", 180), data.get("audio_url", ""), data.get("tags", ""),
            data.get("status", "published"), now_iso, p_id
        ))
        passage_id = p_id
    else:
        c.execute("""
            INSERT INTO passages (
                title, category_id, language, difficulty, official_text, official_text_krutidev, instructions,
                target_wpm, duration_seconds, audio_url, tags, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["title"], data["category_id"], data["language"], data["difficulty"],
            official_text, official_text_kruti, data.get("instructions", ""), data.get("target_wpm", 40),
            data.get("duration_seconds", 180), data.get("audio_url", ""), data.get("tags", ""),
            data.get("status", "published"), now_iso, now_iso
        ))
        passage_id = c.lastrowid

    conn.commit()
    conn.close()
    return passage_id


def admin_delete_passage(passage_id: int) -> bool:
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM passages WHERE id = ?", (passage_id,))
    conn.commit()
    conn.close()
    return True


def get_admin_settings() -> Dict[str, str]:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT key, value FROM admin_settings")
    rows = c.fetchall()
    conn.close()
    return {r['key']: r['value'] for r in rows}


def update_admin_settings(settings: Dict[str, str]):
    conn = get_db()
    c = conn.cursor()
    now_iso = datetime.now().isoformat()
    for k, v in settings.items():
        c.execute("""
            INSERT INTO admin_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (k, str(v), now_iso))
    conn.commit()
    conn.close()


def admin_toggle_passage_status(passage_id: int) -> str:
    """Toggles status between 'published' and 'draft'."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT status FROM passages WHERE id = ?", (passage_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return "not_found"

    new_status = "draft" if row['status'] == 'published' else "published"
    c.execute("UPDATE passages SET status = ?, updated_at = ? WHERE id = ?", (new_status, datetime.now().isoformat(), passage_id))
    conn.commit()
    conn.close()
    return new_status


def admin_save_category(name: str, slug: str, description: str = "", language: str = "both", icon: str = "book", sort_order: int = 0) -> int:
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO categories (name, slug, description, language, icon, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, language = excluded.language
    """, (name, slug, description, language, icon, sort_order))
    cat_id = c.lastrowid
    conn.commit()
    conn.close()
    return cat_id


def admin_delete_category(category_id: int) -> bool:
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    conn.commit()
    conn.close()
    return True


def get_admin_users() -> List[Dict[str, Any]]:
    """Returns a list of all registered users with their profiles, subscription info, and attempt counts."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT u.id, u.username, u.email, u.phone, u.student_code, u.role, u.is_active, u.created_at,
               u.subscription_status, u.subscription_plan, u.subscription_end,
               p.display_name, p.target_exam, p.preferred_language, p.target_wpm, p.points, p.streak_days,
               (SELECT COUNT(*) FROM practice_attempts WHERE user_id = u.id) as attempts_count
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        ORDER BY u.id ASC
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


# ==========================================
# Phase 3: Reward Transactions & Subscriptions
# ==========================================

def get_user_reward_history(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches immutable reward ledger entries for a user."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT id, points, type, reference_id, description, created_at
        FROM reward_transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
    """, (user_id, limit))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_all_reward_transactions(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetches all system reward transactions for admin auditing."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT rt.*, u.username, u.email, u.student_code, p.display_name
        FROM reward_transactions rt
        JOIN users u ON rt.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        ORDER BY rt.id DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def create_payment_request(user_id: int, plan_name: str, amount: float, transaction_id: str, screenshot_url: str = "") -> int:
    """Submits a student payment proof for admin approval."""
    conn = get_db()
    c = conn.cursor()
    now_iso = datetime.now().isoformat()
    c.execute("""
        INSERT INTO payment_requests (user_id, plan_name, amount, transaction_id, screenshot_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
    """, (user_id, plan_name, amount, transaction_id.strip(), screenshot_url.strip(), now_iso))
    req_id = c.lastrowid
    conn.commit()
    conn.close()
    return req_id


def get_user_payment_requests(user_id: int) -> List[Dict[str, Any]]:
    """Fetches a student's payment history and statuses."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT id, plan_name, amount, transaction_id, screenshot_url, status, admin_notes, reviewed_at, created_at
        FROM payment_requests
        WHERE user_id = ?
        ORDER BY id DESC
    """, (user_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_all_payment_requests(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetches all payment requests for admin review."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT pr.*, u.username, u.email, u.phone, u.student_code, p.display_name
        FROM payment_requests pr
        JOIN users u ON pr.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        ORDER BY pr.id DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def admin_review_payment(request_id: int, action: str, admin_id: int, notes: str = "") -> Dict[str, Any]:
    """Admin approves or rejects a student payment request."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM payment_requests WHERE id = ?", (request_id,))
    req = c.fetchone()
    if not req:
        conn.close()
        return {"success": False, "error": "भुगतान अनुरोध नहीं मिला (Payment request not found)"}

    now_dt = datetime.now()
    now_iso = now_dt.isoformat()
    status = "approved" if action == "approve" else "rejected"

    c.execute("""
        UPDATE payment_requests
        SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?
    """, (status, notes, admin_id, now_iso, request_id))

    if status == "approved":
        # Activate student subscription for 30 days
        expiry_dt = now_dt + timedelta(days=30)
        c.execute("""
            UPDATE users
            SET subscription_status = 'active',
                subscription_plan = ?,
                subscription_start = ?,
                subscription_end = ?
            WHERE id = ?
        """, (req["plan_name"], now_iso, expiry_dt.isoformat(), req["user_id"]))

        # Send notification to student
        c.execute("""
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, 'सदस्यता सक्रिय! (Subscription Activated)', ?, 'success', ?)
        """, (
            req["user_id"],
            f"आपकी {req['plan_name']} सदस्यता सक्रिय कर दी गई है। वैधता: 30 दिन।",
            now_iso
        ))

    conn.commit()
    conn.close()
    return {"success": True, "status": status}


def is_user_premium(user_id: int) -> bool:
    """Verifies whether a user has active premium access. Automatically expires in DB if period ended."""
    if not user_id:
        return False
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT role, subscription_status, subscription_end FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    if not user:
        conn.close()
        return False
    if user["role"] == "admin":
        conn.close()
        return True
    if user["subscription_status"] == "active":
        if not user["subscription_end"]:
            conn.close()
            return True
        try:
            exp_dt = datetime.fromisoformat(user["subscription_end"])
            if exp_dt > datetime.now():
                conn.close()
                return True
            else:
                # Subscription expired! Auto-expire in database immediately
                c.execute("UPDATE users SET subscription_status = 'expired' WHERE id = ?", (user_id,))
                conn.commit()
                conn.close()
                return False
        except Exception:
            conn.close()
            return False
    conn.close()
    return False


def get_user_subscription_info(user_id: int) -> Dict[str, Any]:
    """Returns detailed subscription information for user including remaining days."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT role, subscription_status, subscription_plan, subscription_start, subscription_end FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    if not user:
        return {"is_premium": False, "status": "free", "days_left": 0}
    user = dict(user)

    is_admin = user["role"] == "admin"
    is_active = is_user_premium(user_id)
    days_left = 0
    if is_admin:
        return {
            "is_premium": True,
            "status": "admin",
            "plan": "System Administrator",
            "days_left": 9999,
            "end_date": None
        }

    if is_active and user["subscription_end"]:
        try:
            exp = datetime.fromisoformat(user["subscription_end"])
            delta = exp - datetime.now()
            days_left = max(1, delta.days + (1 if delta.seconds > 0 else 0))
        except Exception:
            days_left = 30

    return {
        "is_premium": is_active,
        "status": "active" if is_active else user.get("subscription_status", "free"),
        "plan": user.get("subscription_plan") or "StenoMaster Pro — 1 Month (₹100/माह)",
        "start_date": user.get("subscription_start"),
        "end_date": user.get("subscription_end"),
        "days_left": days_left
    }


# =========================================================================
# Cashfree PG Orders DB Management
# =========================================================================

def create_cashfree_order(
    order_id: str,
    cf_order_id: str,
    user_id: int,
    amount: float = 100.0,
    payment_session_id: str = "",
    plan_days: int = 30
) -> int:
    conn = get_db()
    c = conn.cursor()
    now_iso = datetime.now().isoformat()
    c.execute("""
        INSERT INTO cashfree_orders (order_id, cf_order_id, user_id, amount, payment_session_id, plan_days, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (order_id, cf_order_id, user_id, amount, payment_session_id, plan_days, now_iso))
    order_db_id = c.lastrowid
    conn.commit()
    conn.close()
    return order_db_id


def get_cashfree_order(order_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM cashfree_orders WHERE order_id = ?", (order_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def mark_cashfree_order_paid(
    order_id: str,
    cf_payment_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    payment_time: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM cashfree_orders WHERE order_id = ?", (order_id,))
    order = c.fetchone()
    if not order:
        conn.close()
        return {"success": False, "error": "Order not found"}

    now_dt = datetime.now()
    now_iso = now_dt.isoformat()
    pay_time = payment_time or now_iso

    # Update order to PAID
    c.execute("""
        UPDATE cashfree_orders
        SET status = 'PAID', cf_payment_id = ?, payment_method = ?, payment_time = ?
        WHERE order_id = ?
    """, (cf_payment_id or '', payment_method or 'Cashfree PG', pay_time, order_id))

    user_id = order["user_id"]
    plan_days = order["plan_days"] or 30

    # Calculate new expiry: if user already has an active future end date, extend from there; otherwise now + plan_days
    c.execute("SELECT subscription_status, subscription_end FROM users WHERE id = ?", (user_id,))
    u = c.fetchone()
    base_dt = now_dt
    if u and u["subscription_status"] == "active" and u["subscription_end"]:
        try:
            curr_end = datetime.fromisoformat(u["subscription_end"])
            if curr_end > now_dt:
                base_dt = curr_end
        except Exception:
            pass

    new_end_dt = base_dt + timedelta(days=plan_days)
    new_end_iso = new_end_dt.isoformat()

    c.execute("""
        UPDATE users
        SET subscription_status = 'active',
            subscription_plan = 'StenoMaster Pro — 1 Month (₹100/माह)',
            subscription_start = ?,
            subscription_end = ?
        WHERE id = ?
    """, (now_iso, new_end_iso, user_id))

    # Add celebratory notification for student
    c.execute("""
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES (?, '👑 प्रो सदस्यता सक्रिय (Pro Activated)!', ?, 'success', ?)
    """, (
        user_id,
        f"आपका ₹{order['amount']:.0f} का भुगतान सफल रहा! आपकी 30 दिन की प्रो सदस्यता सक्रिय कर दी गई है। वैधता: {new_end_dt.strftime('%d %b %Y')} तक।",
        now_iso
    ))

    conn.commit()
    conn.close()
    return {
        "success": True,
        "order_id": order_id,
        "subscription_status": "active",
        "subscription_end": new_end_iso,
        "plan_days": plan_days
    }


def get_user_cashfree_orders(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM cashfree_orders WHERE user_id = ? ORDER BY id DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_cashfree_orders() -> List[Dict[str, Any]]:
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT co.*, u.username, u.email, u.display_name, u.student_code
        FROM cashfree_orders co
        JOIN users u ON co.user_id = u.id
        ORDER BY co.id DESC
    """)
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]




