-- ============================================================================
-- StenoMaster Pro — Supabase Cloud PostgreSQL Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    referral_code TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT,
    student_code TEXT UNIQUE,
    subscription_status TEXT DEFAULT 'free',
    subscription_plan TEXT DEFAULT 'Free Tier',
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar TEXT,
    target_exam TEXT DEFAULT 'SSC Stenographer',
    preferred_language TEXT DEFAULT 'hindi',
    preferred_typing_mode TEXT DEFAULT 'mangal',
    target_wpm INTEGER DEFAULT 50,
    show_on_leaderboard INTEGER DEFAULT 1,
    points INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_practice_date DATE
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    language TEXT DEFAULT 'hindi',
    icon TEXT,
    sort_order INTEGER DEFAULT 0
);

-- 4. Passages Table (with Dual-Font Reference Text)
CREATE TABLE IF NOT EXISTS passages (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    language TEXT DEFAULT 'hindi',
    difficulty TEXT DEFAULT 'medium',
    official_text TEXT NOT NULL,
    instructions TEXT,
    target_wpm INTEGER DEFAULT 80,
    duration_seconds INTEGER DEFAULT 300,
    audio_url TEXT,
    audio_filename TEXT,
    thumbnail TEXT,
    tags TEXT,
    status TEXT DEFAULT 'published',
    view_count INTEGER DEFAULT 0,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_premium INTEGER DEFAULT 0,
    official_text_krutidev TEXT
);

-- 5. Audio Files Table
CREATE TABLE IF NOT EXISTS audio_files (
    id BIGSERIAL PRIMARY KEY,
    passage_id BIGINT REFERENCES passages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT,
    duration_seconds INTEGER,
    file_size BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Practice Attempts / Live Dashboard Reports Table
CREATE TABLE IF NOT EXISTS practice_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    passage_id BIGINT REFERENCES passages(id) ON DELETE CASCADE,
    gross_wpm DOUBLE PRECISION DEFAULT 0.0,
    net_wpm DOUBLE PRECISION DEFAULT 0.0,
    accuracy DOUBLE PRECISION DEFAULT 0.0,
    spelling_accuracy DOUBLE PRECISION DEFAULT 0.0,
    error_rate DOUBLE PRECISION DEFAULT 0.0,
    total_words INTEGER DEFAULT 0,
    correct_words INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    weighted_errors DOUBLE PRECISION DEFAULT 0.0,
    time_taken_seconds INTEGER DEFAULT 0,
    typing_mode TEXT DEFAULT 'mangal',
    raw_input TEXT,
    normalized_input TEXT,
    report_json TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Practice Detailed Errors Log Table
CREATE TABLE IF NOT EXISTS practice_errors (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT REFERENCES practice_attempts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    your_text TEXT,
    correct_text TEXT,
    error_type TEXT,
    category TEXT,
    detail TEXT
);

-- 8. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    passage_id BIGINT REFERENCES passages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, passage_id)
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    reward_points INTEGER DEFAULT 50,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Rewards & Transactions Tables
CREATE TABLE IF NOT EXISTS rewards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    description TEXT,
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light',
    default_typing_mode TEXT DEFAULT 'mangal',
    default_playback_speed DOUBLE PRECISION DEFAULT 1.0,
    sound_enabled INTEGER DEFAULT 1,
    email_notifications INTEGER DEFAULT 1,
    practice_reminders INTEGER DEFAULT 1
);

-- 13. Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Single-Device Sessions Table (Concurrent Eviction)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_name TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    is_active INTEGER DEFAULT 1,
    invalidated_reason TEXT,
    superseded_by_ip TEXT,
    superseded_at TIMESTAMPTZ
);

-- 16. Manual Offline Payment Requests
CREATE TABLE IF NOT EXISTS payment_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    transaction_id TEXT NOT NULL,
    screenshot_url TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Cashfree Online PG Orders Table
CREATE TABLE IF NOT EXISTS cashfree_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    cf_order_id TEXT,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'ACTIVE',
    payment_session_id TEXT,
    cf_payment_id TEXT,
    payment_method TEXT,
    payment_time TIMESTAMPTZ,
    plan_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user ON practice_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_passage ON practice_attempts(passage_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_passages_category ON passages(category_id);
CREATE INDEX IF NOT EXISTS idx_cashfree_orders_user ON cashfree_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cashfree_orders_order_id ON cashfree_orders(order_id);
