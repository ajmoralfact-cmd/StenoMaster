"""
Production HTTP Server & REST API for StenoMaster
Built with Python standard library (http.server, socketserver).
Provides:
- Multi-threaded HTTP request handling
- Session authentication & role-based access control (Student / Admin)
- RESTful JSON APIs for typing practice, audio handling, bookmarks, leaderboard, referrals
- Strict server-side evaluation & score computation (reference text never leaked)
- Audio upload & static file serving with Range header support for seeking
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import http.server
import socketserver
import urllib.parse
import json
import os
import mimetypes
import socket
import re
from datetime import datetime

import db
import hindi_converter
import evaluation
from cashfree_service import CashfreeService

PORT = 8085
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'public')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')

try:
    os.makedirs(STATIC_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
except Exception:
    pass

# Register font mime types so browsers properly load TTF/WOFF/WOFF2 fonts
mimetypes.add_type('font/ttf', '.ttf')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('font/otf', '.otf')


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1.0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class StenoMasterHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    # -------------------------------------------------------------------------
    # Response Helpers
    # -------------------------------------------------------------------------
    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True
        try:
            cl = int(self.headers.get('Content-Length', 0))
            if cl > 0 and not hasattr(self, '_cached_json_body'):
                self.rfile.read(cl)
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def _get_client_ip(self):
        """Extracts visitor's public internet IP address, supporting Cloudflare Tunnel and proxies."""
        if 'CF-Connecting-IP' in self.headers:
            return self.headers['CF-Connecting-IP'].strip()
        if 'X-Forwarded-For' in self.headers:
            return self.headers['X-Forwarded-For'].split(',')[0].strip()
        if 'X-Real-IP' in self.headers:
            return self.headers['X-Real-IP'].strip()
        if hasattr(self, 'client_address') and self.client_address:
            return self.client_address[0]
        return '127.0.0.1'

    def _parse_device_name(self, user_agent: str) -> str:
        """Parses a human-readable operating system and browser name from User-Agent string."""
        if not user_agent:
            return "Web Browser"
        ua = user_agent.lower()
        os_str = "Computer"
        if "windows" in ua:
            os_str = "Windows PC"
        elif "android" in ua:
            os_str = "Android Mobile"
        elif "iphone" in ua or "ipad" in ua or "ios" in ua:
            os_str = "iOS Device"
        elif "macintosh" in ua or "mac os" in ua:
            os_str = "Mac"
        elif "linux" in ua:
            os_str = "Linux PC"

        browser_str = "Browser"
        if "chrome" in ua and "edg" not in ua and "opr" not in ua:
            browser_str = "Chrome"
        elif "edg" in ua:
            browser_str = "Edge"
        elif "firefox" in ua:
            browser_str = "Firefox"
        elif "safari" in ua and "chrome" not in ua:
            browser_str = "Safari"
        elif "opera" in ua or "opr" in ua:
            browser_str = "Opera"

        return f"{os_str} • {browser_str}"

    def _get_auth_token(self):
        auth_header = self.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split('Bearer ')[1].strip()
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        token = params.get('token', [None])[0]
        return token

    def _get_auth_user(self):
        """Extracts Bearer token from header or query string and returns authenticated user."""
        token = self._get_auth_token()
        if not token:
            return None
        res = db.verify_session(token)
        if isinstance(res, dict) and res.get('_session_error') == 'concurrent_login':
            self._session_evicted_info = res
            return None
        return res

    def _send_auth_required(self):
        """Sends 401 Unauthorized, distinguishing concurrent login eviction from missing tokens."""
        if hasattr(self, '_session_evicted_info') and self._session_evicted_info:
            self._send_json(401, {
                "error": "concurrent_login",
                "code": "CONCURRENT_LOGIN_DETECTED",
                "message": "आपका खाता किसी अन्य कंप्यूटर अथवा डिवाइस पर लॉगिन कर लिया गया है।",
                "superseded_by_ip": self._session_evicted_info.get("superseded_by_ip", "Other Device"),
                "superseded_at": self._session_evicted_info.get("superseded_at")
            })
        else:
            self._send_json(401, {"error": "Authentication required", "code": "UNAUTHORIZED"})

    def _read_json_body(self):
        if hasattr(self, '_cached_json_body'):
            return self._cached_json_body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            self._cached_json_body = {}
            return {}
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            self._cached_json_body = json.loads(body)
        except Exception:
            self._cached_json_body = {}
        return self._cached_json_body

    # -------------------------------------------------------------------------
    # GET Handlers
    # -------------------------------------------------------------------------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)
        user = self._get_auth_user()
        user_id = user['user_id'] if user else None

        # Serve uploaded audio files with Range support
        if path.startswith('/uploads/'):
            filename = os.path.basename(path)
            file_path = os.path.join(UPLOADS_DIR, filename)
            if os.path.exists(file_path):
                self._serve_audio_file(file_path)
                return
            else:
                self.send_error(404, "File not found")
                return

        # API Routes
        if path == '/api/auth/session-status':
            token = self._get_auth_token()
            if not token:
                self._send_json(401, {"status": "invalid", "error": "No token provided"})
                return
            st = db.get_session_status(token)
            if st.get("status") == "terminated" or st.get("error") == "concurrent_login":
                self._send_json(401, {
                    "status": "terminated",
                    "error": "concurrent_login",
                    "code": "CONCURRENT_LOGIN_DETECTED",
                    "message": "यह खाता किसी अन्य डिवाइस अथवा कंप्यूटर पर लॉगिन हो गया है।",
                    "superseded_by_ip": st.get("superseded_by_ip", "Another Device"),
                    "superseded_at": st.get("superseded_at")
                })
            elif st.get("status") == "active":
                self._send_json(200, {"status": "active", "ip": st.get("ip_address"), "device": st.get("device_name")})
            else:
                self._send_json(401, {"status": "invalid", "error": "Session expired or invalid"})
            return

        if path == '/api/auth/me':
            if not user:
                self._send_auth_required()
            else:
                sub_info = db.get_user_subscription_info(user['user_id'])
                user_dict = dict(user)
                user_dict['subscription_status'] = sub_info['status']
                user_dict['subscription_plan'] = sub_info['plan']
                user_dict['subscription_start'] = sub_info['start_date']
                user_dict['subscription_end'] = sub_info['end_date']
                user_dict['subscription_days_left'] = sub_info['days_left']
                user_dict['is_premium'] = sub_info['is_premium']
                self._send_json(200, {"user": user_dict, "subscription": sub_info})
            return

        if path == '/api/categories':
            cats = db.get_categories()
            self._send_json(200, {"categories": cats})
            return

        if path == '/api/passages':
            lang = params.get('language', [None])[0]
            diff = params.get('difficulty', [None])[0]
            cat_id = params.get('category_id', [None])[0]
            search = params.get('search', [None])[0]
            if cat_id:
                try:
                    cat_id = int(cat_id)
                except ValueError:
                    cat_id = None

            passages = db.get_passages(
                language=lang,
                difficulty=diff,
                category_id=cat_id,
                search=search,
                user_id=user_id,
                include_official_text=False  # Security: never expose to student
            )
            self._send_json(200, {"passages": passages})
            return

        if path.startswith('/api/passages/'):
            try:
                p_id = int(path.split('/')[-1])
                is_admin = bool(user and user.get('role') == 'admin')

                # Strict Freemium Access Control (First 2 classes free, all others locked)
                if not is_admin and not db.is_passage_accessible(user_id, p_id):
                    self._send_json(403, {
                        "error": "PRO_SUBSCRIPTION_REQUIRED",
                        "is_locked": True,
                        "message": "यह आलेख केवल प्रो सदस्यों के लिए उपलब्ध है। अभ्यास जारी रखने के लिए कृपया ₹100 प्रति माह सदस्यता सक्रिय करें।"
                    })
                    return

                passage = db.get_passage_detail(p_id, user_id=user_id, include_official=False, is_admin=is_admin)
                if not passage:
                    self._send_json(404, {"error": "Passage not found or not published"})
                else:
                    self._send_json(200, {"passage": passage})
            except ValueError:
                self._send_json(400, {"error": "Invalid passage ID"})
            return

        if path == '/api/bookmarks':
            if not user:
                self._send_auth_required()
                return
            bookmarks = db.get_user_bookmarks(user['user_id'])
            self._send_json(200, {"bookmarks": bookmarks})
            return

        if path == '/api/practice/history':
            if not user:
                self._send_auth_required()
                return
            history = db.get_practice_history(user['user_id'])
            self._send_json(200, {"history": history})
            return

        if path.startswith('/api/practice/attempt/'):
            if not user:
                self._send_auth_required()
                return
            try:
                att_id = int(path.split('/')[-1])
                attempt = db.get_attempt_detail(att_id, user_id=user['user_id'] if user['role'] != 'admin' else None)
                if not attempt:
                    self._send_json(404, {"error": "Attempt not found"})
                else:
                    self._send_json(200, {"attempt": attempt})
            except ValueError:
                self._send_json(400, {"error": "Invalid attempt ID"})
            return

        if path == '/api/progress/summary':
            if not user:
                self._send_auth_required()
                return
            summary = db.get_user_progress_summary(user['user_id'])
            self._send_json(200, summary)
            return

        if path == '/api/leaderboard':
            period = params.get('period', ['all'])[0]
            leaderboard = db.get_leaderboard(period=period)
            self._send_json(200, {"leaderboard": leaderboard, "period": period})
            return

        if path == '/api/settings':
            admin_settings = dict(db.get_admin_settings())
            # Redact payment gateway credentials for students / public visitors
            if not user or user.get('role') != 'admin':
                admin_settings.pop('cashfree_secret_key', None)
                admin_settings.pop('cashfree_app_id', None)
            self._send_json(200, {"settings": admin_settings})
            return

        if path == '/api/notifications':
            if not user:
                self._send_auth_required()
                return
            conn = db.get_db()
            c = conn.cursor()
            c.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20", (user['user_id'],))
            notes = [dict(r) for r in c.fetchall()]
            conn.close()
            self._send_json(200, {"notifications": notes})
            return

        if path == '/api/referrals/stats':
            if not user:
                self._send_auth_required()
                return
            conn = db.get_db()
            c = conn.cursor()
            c.execute("""
                SELECT r.id, r.referral_code, r.reward_points, r.status, r.created_at,
                       u.username as referred_username
                FROM referrals r
                JOIN users u ON r.referred_user_id = u.id
                WHERE r.referrer_user_id = ?
                ORDER BY r.id DESC
            """, (user['user_id'],))
            referrals = [dict(r) for r in c.fetchall()]

            c.execute("SELECT points FROM profiles WHERE user_id = ?", (user['user_id'],))
            prof = c.fetchone()
            points = prof['points'] if prof else 0
            conn.close()

            self._send_json(200, {
                "referral_code": user.get("referral_code", ""),
                "total_referrals": len(referrals),
                "points_earned": sum(r["reward_points"] for r in referrals),
                "total_points": points,
                "history": referrals
            })
            return

        # Phase 3: Rewards History
        if path == '/api/rewards/history':
            if not user:
                self._send_auth_required()
                return
            history = db.get_user_reward_history(user['user_id'])
            self._send_json(200, {"history": history, "transactions": history})
            return

        # Phase 3: Subscription Details & Plans
        if path == '/api/subscription/plans':
            self._send_json(200, {"plans": db.get_subscription_plans()})
            return

        if path == '/api/subscription/details':
            admin_settings = db.get_admin_settings()
            sub_info = db.get_user_subscription_info(user['user_id']) if user else {
                "is_premium": False,
                "status": "free",
                "days_left": 0
            }
            cf_cfg = CashfreeService.get_config()
            self._send_json(200, {
                "plan_name": admin_settings.get('subscription_plan_name', 'StenoMaster Pro — 1 Month (₹100/माह)'),
                "plan_price": admin_settings.get('subscription_plan_price', '100'),
                "qr_url": admin_settings.get('subscription_qr_url', '/assets/qr_payment.png'),
                "upi_id": admin_settings.get('subscription_upi_id', 'stenomaster@upi'),
                "plans": db.get_subscription_plans(),
                "subscription_status": sub_info.get("status", "free"),
                "subscription_plan": sub_info.get("plan"),
                "subscription_start": sub_info.get("start_date"),
                "subscription_end": sub_info.get("end_date"),
                "days_left": sub_info.get("days_left", 0),
                "subscription_days_left": sub_info.get("days_left", 0),
                "is_premium": sub_info.get("is_premium", False),
                "free_passages_count": 2,
                "cashfree_configured": CashfreeService.is_configured(),
                "cashfree_env": cf_cfg.get("env", "SANDBOX")
            })
            return

        # Phase 3: Student's Payment Proof Submissions (Manual UPI)
        if path == '/api/subscription/my-requests':
            if not user:
                self._send_auth_required()
                return
            requests = db.get_user_payment_requests(user['user_id'])
            self._send_json(200, {"requests": requests})
            return

        # Cashfree Student Payment History
        if path == '/api/payment/cashfree/history':
            if not user:
                self._send_auth_required()
                return
            orders = db.get_user_cashfree_orders(user['user_id'])
            self._send_json(200, {"orders": orders})
            return

        # ------------------ Admin Routes ------------------
        if path.startswith('/api/admin/'):
            if not user:
                self._send_auth_required()
                return
            if user['role'] != 'admin':
                self._send_json(403, {"error": "Admin access required"})
                return

            if path == '/api/admin/overview':
                data = db.get_admin_overview()
                self._send_json(200, data)
                return

            if path == '/api/admin/passages':
                passages = db.get_passages(include_official_text=True)
                self._send_json(200, {"passages": passages})
                return

            if path == '/api/admin/users':
                users = db.get_admin_users()
                self._send_json(200, {"users": users})
                return

            if path == '/api/admin/payments':
                payments = db.get_all_payment_requests()
                self._send_json(200, {"payments": payments})
                return

            if path == '/api/admin/rewards':
                txs = db.get_all_reward_transactions()
                self._send_json(200, {"transactions": txs})
                return

            self._send_json(404, {"error": "Admin endpoint not found"})
            return

        # Fall back to serving static files from public directory
        super().do_GET()

    # -------------------------------------------------------------------------
    # POST Handlers
    # -------------------------------------------------------------------------
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        self._read_json_body()
        user = self._get_auth_user()

        # 1. User Authentication
        if path == '/api/auth/register-student':
            data = self._read_json_body()
            name = data.get('full_name', '').strip()
            phone = data.get('phone', '').strip()
            email = data.get('email', '').strip()
            password = data.get('password', '').strip()
            confirm_password = data.get('confirm_password', '').strip()
            target_exam = data.get('target_exam', 'SSC Stenographer')
            pref_lang = data.get('preferred_language', 'hindi')
            pref_mode = data.get('preferred_typing_mode', 'mangal')
            ref_code = data.get('referral_code', '').strip()

            if password != confirm_password:
                self._send_json(400, {"error": "पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते (Passwords do not match)"})
                return

            res = db.create_student_registration(
                full_name=name,
                phone=phone,
                email=email,
                password=password,
                target_exam=target_exam,
                preferred_language=pref_lang,
                preferred_typing_mode=pref_mode,
                referral_code=ref_code
            )
            if not res.get("success"):
                self._send_json(400, res)
                return

            client_ip = self._get_client_ip()
            user_agent = self.headers.get('User-Agent', '')
            device_name = self._parse_device_name(user_agent)

            token = db.create_session(
                res["user_id"],
                ip_address=client_ip,
                user_agent=user_agent,
                device_name=device_name
            )
            user_obj = db.verify_session(token)
            self._send_json(201, {
                "token": token,
                "user": user_obj,
                "credentials": {
                    "username": res.get("username"),
                    "student_code": res.get("student_code"),
                    "email": res.get("email"),
                    "password": password
                },
                "login_ip": client_ip,
                "login_device": device_name
            })
            return

        if path == '/api/auth/forgot-password':
            data = self._read_json_body()
            email = data.get('email', '').strip().lower()
            if not email:
                self._send_json(400, {"error": "कृपया मान्य ईमेल दर्ज करें। (Please enter a valid email)"})
                return
            conn = db.get_db()
            c = conn.cursor()
            c.execute("SELECT id, username, email, student_code FROM users WHERE LOWER(email) = ?", (email,))
            u_row = c.fetchone()
            conn.close()
            if not u_row:
                self._send_json(404, {"error": "इस ईमेल से कोई खाता पंजीकृत नहीं है। कृपया सही ईमेल दर्ज करें।"})
                return
            self._send_json(200, {
                "success": True,
                "email": email,
                "username": u_row["username"],
                "student_code": u_row["student_code"],
                "message": f"पासवर्ड रीसेट लिंक आपके पंजीकृत ईमेल ({email}) पर भेज दिया गया है। कृपया अपना इनबॉक्स या स्पैम फ़ोल्डर चेक करें।"
            })
            return

        if path == '/api/auth/register':
            data = self._read_json_body()
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            password = data.get('password', '').strip()
            display_name = data.get('display_name', '').strip()
            target_exam = data.get('target_exam', 'SSC Stenographer')
            ref_code = data.get('referral_code', '').strip()

            if not username or not email or not password:
                self._send_json(400, {"error": "सभी आवश्यक फ़ील्ड भरें (All fields required)"})
                return

            res = db.create_user(username, email, password, display_name, target_exam, ref_code)
            if not res["success"]:
                self._send_json(400, res)
                return

            client_ip = self._get_client_ip()
            user_agent = self.headers.get('User-Agent', '')
            device_name = self._parse_device_name(user_agent)

            token = db.create_session(
                res["user_id"],
                ip_address=client_ip,
                user_agent=user_agent,
                device_name=device_name
            )
            user_obj = db.verify_session(token)
            self._send_json(201, {
                "token": token,
                "user": user_obj,
                "login_ip": client_ip,
                "login_device": device_name
            })
            return

        if path == '/api/auth/login':
            data = self._read_json_body()
            email_or_user = (data.get('email_or_username') or data.get('email') or data.get('username') or '').strip()
            password = data.get('password', '').strip()

            user_row = db.authenticate_user(email_or_user, password)
            if not user_row:
                self._send_json(401, {"error": "गलत ईमेल/यूज़रनेम अथवा पासवर्ड (Invalid credentials)"})
                return

            client_ip = self._get_client_ip()
            user_agent = self.headers.get('User-Agent', '')
            device_name = self._parse_device_name(user_agent)

            token = db.create_session(
                user_row['id'],
                ip_address=client_ip,
                user_agent=user_agent,
                device_name=device_name
            )
            user_obj = db.verify_session(token)
            self._send_json(200, {
                "token": token,
                "user": user_obj,
                "login_ip": client_ip,
                "login_device": device_name
            })
            return

        if path == '/api/auth/logout':
            token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if token:
                db.delete_session(token)
            self._send_json(200, {"message": "Logged out successfully"})
            return

        # 2. Bookmarks
        if path == '/api/bookmarks/toggle':
            if not user:
                self._send_auth_required()
                return
            data = self._read_json_body()
            passage_id = data.get("passage_id")
            if not passage_id:
                self._send_json(400, {"error": "Missing passage_id"})
                return
            is_bookmarked = db.toggle_bookmark(user['user_id'], passage_id)
            self._send_json(200, {"is_bookmarked": is_bookmarked})
            return

        # Phase 3: Subscription Payment Request Submission
        if path == '/api/subscription/request-payment':
            if not user:
                self._send_auth_required()
                return
            data = self._read_json_body()
            txn_id = data.get('transaction_id', '').strip()
            plan_name = data.get('plan_name', 'StenoMaster Pro — 1 Month (₹100/माह)')
            amount = float(data.get('amount', 100))
            screenshot_url = data.get('screenshot_url', '')

            if not txn_id:
                self._send_json(400, {"error": "यूटीआर / ट्रांजेक्शन आईडी आवश्यक है (Transaction ID is required)"})
                return

            req_id = db.create_payment_request(user['user_id'], plan_name, amount, txn_id, screenshot_url)
            self._send_json(201, {
                "success": True,
                "request_id": req_id,
                "message": "भुगतान अनुरोध सफलतापूर्वक जमा किया गया। एडमिन सत्यापन के बाद सदस्यता सक्रिय होगी।"
            })
            return

        # Phase 3 / Cashfree PG Payment Endpoints
        if path == '/api/payment/cashfree/create-order':
            if not user:
                self._send_auth_required()
                return
            data = self._read_json_body()
            plans = db.get_subscription_plans()
            plan_id = str(data.get('plan_id') or '').strip()
            plan_days_req = int(data.get('plan_days') or 30)

            # Match plan strictly against server-defined tiers to prevent client-side price tampering
            matched_plan = next((p for p in plans if p.get('id') == plan_id or p.get('days') == plan_days_req), None)
            if matched_plan:
                amount = float(matched_plan['price'])
                plan_days = int(matched_plan['days'])
            else:
                first_plan = plans[0] if plans else {'price': 100.0, 'days': 30}
                amount = float(first_plan['price'])
                plan_days = int(first_plan['days'])

            return_url = data.get('return_url')

            res = CashfreeService.create_order(user, amount=amount, plan_days=plan_days, return_url=return_url)
            if res.get("success"):
                self._send_json(200, res)
            else:
                self._send_json(400, res)
            return

        if path == '/api/payment/cashfree/verify':
            if not user:
                self._send_auth_required()
                return
            data = self._read_json_body()
            order_id = (data.get('order_id') or '').strip()
            if not order_id:
                self._send_json(400, {"error": "Missing order_id"})
                return

            order = db.get_cashfree_order(order_id)
            if not order:
                self._send_json(404, {"error": "Order not found"})
                return
            # Strict ownership verification: student cannot verify or tamper with another student's order
            if order.get("user_id") != user["user_id"] and user.get("role") != "admin":
                self._send_json(403, {"error": "Unauthorized: This order belongs to another student account."})
                return

            res = CashfreeService.verify_order(order_id)
            if "status" in res and "order_status" not in res:
                res["order_status"] = res["status"]
            if res.get("success"):
                self._send_json(200, res)
            else:
                self._send_json(400, res)
            return

        if path == '/api/payment/cashfree/webhook':
            try:
                data = self._read_json_body()
                order_data = data.get("data", {}).get("order", {}) or data.get("order", {})
                order_id = order_data.get("order_id")
                payment_data = data.get("data", {}).get("payment", {}) or data.get("payment", {})
                if order_id and (payment_data.get("payment_status") == "SUCCESS" or data.get("type") == "PAYMENT_SUCCESS_WEBHOOK"):
                    db.mark_cashfree_order_paid(
                        order_id=order_id,
                        cf_payment_id=payment_data.get("cf_payment_id"),
                        payment_method=payment_data.get("payment_group") or "Cashfree Webhook"
                    )
            except Exception as e:
                print("Cashfree webhook error:", e)
            self._send_json(200, {"status": "OK"})
            return

        # 3. Practice Submission & Evaluation Engine (CRITICAL)
        if path == '/api/practice/submit':
            data = self._read_json_body()
            passage_id = data.get('passage_id')
            raw_input = data.get('typed_text', '')
            typing_mode = data.get('typing_mode', 'mangal')
            selected_typing_system = (data.get('selected_typing_system') or '').strip().lower()
            time_taken = int(data.get('time_taken_seconds', 60))

            if not passage_id or not raw_input.strip():
                self._send_json(400, {"error": "Passage and typed text are required"})
                return

            # Strict Access Check (First 2 free passages accessible without login, others require Pro)
            user_id = user['user_id'] if user else None
            is_admin = bool(user and user.get('role') == 'admin')
            if not is_admin and not db.is_passage_accessible(user_id, passage_id):
                if not user:
                    self._send_auth_required()
                else:
                    self._send_json(403, {
                        "error": "PRO_SUBSCRIPTION_REQUIRED",
                        "is_locked": True,
                        "message": "यह डिक्टेशन अभ्यास केवल प्रो सदस्यों के लिए उपलब्ध है। कृपया ₹100 का मासिक प्लान सक्रिय करें।"
                    })
                return

            # Deduplication: Prevent duplicate attempts within 5s (logged in users)
            if user:
                recent = db.get_recent_duplicate_attempt(user['user_id'], passage_id, raw_input, max_age_seconds=5)
                if recent:
                    self._send_json(200, recent)
                    return

            # Retrieve official text securely from DB (Security: never trust client reference text)
            passage = db.get_passage_detail(passage_id, include_official=True, is_admin=True)
            if not passage:
                self._send_json(404, {"error": "Passage not found"})
                return

            # Students cannot practice on draft passages
            if passage.get('status') != 'published' and not is_admin:
                self._send_json(403, {"error": "This passage is in draft mode and not yet published."})
                return

            official_text = passage.get('official_text', '')
            official_text_krutidev = passage.get('official_text_krutidev', '')
            language = passage.get('language', 'hindi')
            passage_system = passage.get('typing_system') or 'dual'

            # Canonical Typing System & Reference Selection (Phase 8 & 10)
            if passage_system == 'mangal_unicode':
                effective_typing_system = 'mangal_unicode'
                eval_official_text = official_text
            elif passage_system == 'kruti_dev_010':
                effective_typing_system = 'kruti_dev_010'
                eval_official_text = official_text_krutidev
            elif passage_system == 'dual':
                if selected_typing_system in ('kruti_dev_010', 'krutidev', 'kruti'):
                    effective_typing_system = 'kruti_dev_010'
                    eval_official_text = official_text_krutidev
                else:
                    effective_typing_system = 'mangal_unicode'
                    eval_official_text = official_text
            else:
                effective_typing_system = 'mangal_unicode'
                eval_official_text = official_text

            eval_language = language
            eval_student_text = raw_input

            # Hindi Evaluation: Match real Hindi words to real Hindi words
            if language == 'hindi':
                eval_language = 'hindi'
                if effective_typing_system == 'kruti_dev_010':
                    eval_official_text = hindi_converter.kruti_dev_to_unicode(eval_official_text)
                else:
                    eval_official_text = eval_official_text or hindi_converter.kruti_dev_to_unicode(official_text_krutidev)
                if typing_mode in ('krutidev', 'devlys'):
                    if re.search(r'[\u0900-\u097F]', raw_input):
                        eval_student_text = hindi_converter.normalize_hindi_unicode(raw_input)
                    else:
                        eval_student_text = hindi_converter.kruti_dev_to_unicode(raw_input)
                else:
                    eval_student_text = hindi_converter.convert_input_text(raw_input, typing_mode, language)
                normalized_student_text = eval_student_text
            else:
                eval_student_text = raw_input
                normalized_student_text = raw_input
                eval_official_text = official_text

            # Retrieve configured scoring rule & target exam mode
            admin_settings = db.get_admin_settings()
            requested_exam_rule = data.get('exam_rule')
            if not requested_exam_rule:
                user_target = (user.get('target_exam') if user else '').lower()
                if 'upsssc' in user_target:
                    requested_exam_rule = 'upsssc'
                else:
                    requested_exam_rule = admin_settings.get('scoring_mode', 'ssc_steno')

            # Run dynamic token evaluation
            eval_result = evaluation.evaluate_practice_attempt(
                official_text=eval_official_text,
                student_text=eval_student_text,
                time_taken_seconds=max(5, time_taken),
                language=eval_language,
                scoring_mode=requested_exam_rule,
                scoring_config=admin_settings,
                exam_rule=requested_exam_rule
            )

            # Save historical attempt in DB (for logged-in students)
            if user:
                attempt_id = db.save_practice_attempt(
                    user_id=user['user_id'],
                    passage_id=passage_id,
                    eval_result=eval_result,
                    typing_mode=typing_mode,
                    raw_input=raw_input,
                    normalized_input=normalized_student_text
                )
            else:
                attempt_id = None

            eval_result["attempt_id"] = attempt_id
            eval_result["passage_title"] = passage["title"]
            eval_result["language"] = eval_language
            eval_result["typing_mode"] = typing_mode
            eval_result["typing_system"] = passage_system
            eval_result["selected_typing_system"] = effective_typing_system
            eval_result["exam_rule"] = eval_result.get("exam_rule", requested_exam_rule)
            eval_result["difficulty"] = passage["difficulty"]
            eval_result["official_text"] = passage.get("official_text", "")
            eval_result["official_text_krutidev"] = passage.get("official_text_krutidev", "")
            eval_result["student_text"] = raw_input
            eval_result["steno_notes_url"] = passage.get("steno_notes_url", "")
            eval_result["steno_notes_type"] = passage.get("steno_notes_type", "")

            self._send_json(200, eval_result)
            return

        # 4. Profile Update
        if path == '/api/profile/update':
            if not user:
                self._send_auth_required()
                return
            data = self._read_json_body()
            conn = db.get_db()
            c = conn.cursor()
            c.execute("""
                UPDATE profiles
                SET display_name = ?, target_exam = ?, preferred_language = ?,
                    preferred_typing_mode = ?, target_wpm = ?, show_on_leaderboard = ?
                WHERE user_id = ?
            """, (
                data.get("display_name", user.get("display_name")),
                data.get("target_exam", user.get("target_exam")),
                data.get("preferred_language", user.get("preferred_language")),
                data.get("preferred_typing_mode", user.get("preferred_typing_mode")),
                int(data.get("target_wpm", 50)),
                1 if data.get("show_on_leaderboard", True) else 0,
                user['user_id']
            ))
            conn.commit()
            conn.close()
            self._send_json(200, {"message": "Profile updated successfully"})
            return

        # 5. Mark notifications read
        if path == '/api/notifications/mark-read':
            if not user:
                self._send_auth_required()
                return
            conn = db.get_db()
            c = conn.cursor()
            c.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user['user_id'],))
            conn.commit()
            conn.close()
            self._send_json(200, {"message": "Notifications marked as read"})
            return

        # 6. Admin Actions
        if path.startswith('/api/admin/'):
            if not user:
                self._send_auth_required()
                return
            if user['role'] != 'admin':
                self._send_json(403, {"error": "Admin access required"})
                return

            if path == '/api/admin/passages/save':
                data = self._read_json_body()
                try:
                    passage_id = db.admin_save_passage(data)
                    self._send_json(200, {"success": True, "passage_id": passage_id})
                except ValueError as ve:
                    self._send_json(400, {"error": str(ve)})
                except Exception as e:
                    self._send_json(500, {"error": f"Internal server error: {e}"})
                return

            if path == '/api/admin/convert-font':
                data = self._read_json_body()
                text = data.get("text", "")
                direction = data.get("direction", "to_kruti")  # 'to_kruti' or 'to_mangal'
                if direction == 'to_kruti':
                    result = hindi_converter.unicode_to_kruti_dev(text)
                else:
                    result = hindi_converter.kruti_dev_to_unicode(text)
                self._send_json(200, {"success": True, "result": result})
                return

            if path == '/api/admin/passages/delete':
                data = self._read_json_body()
                p_id = data.get("id")
                if p_id:
                    db.admin_delete_passage(p_id)
                self._send_json(200, {"success": True})
                return

            if path == '/api/admin/passages/toggle-status':
                data = self._read_json_body()
                p_id = data.get("id")
                if not p_id:
                    self._send_json(400, {"error": "Missing passage id"})
                    return
                new_status = db.admin_toggle_passage_status(int(p_id))
                self._send_json(200, {"success": True, "status": new_status})
                return

            if path == '/api/admin/categories/save':
                data = self._read_json_body()
                name = data.get("name", "").strip()
                slug = data.get("slug", "").strip()
                if not name or not slug:
                    self._send_json(400, {"error": "Category name and slug are required"})
                    return
                desc = data.get("description", "")
                lang = data.get("language", "both")
                icon = data.get("icon", "book")
                order = int(data.get("sort_order", 0))
                cat_id = db.admin_save_category(name, slug, desc, lang, icon, order)
                self._send_json(200, {"success": True, "category_id": cat_id})
                return

            if path == '/api/admin/categories/delete':
                data = self._read_json_body()
                cat_id = data.get("id")
                if cat_id:
                    db.admin_delete_category(int(cat_id))
                self._send_json(200, {"success": True})
                return

            if path == '/api/admin/settings/update':
                data = self._read_json_body()
                db.update_admin_settings(data)
                self._send_json(200, {"message": "Settings updated successfully"})
                return

            if path == '/api/admin/bulk-import':
                data = self._read_json_body()
                items = data.get("passages", [])
                imported_count = 0
                for item in items:
                    if item.get("title") and item.get("official_text"):
                        db.admin_save_passage(item)
                        imported_count += 1
                self._send_json(200, {"imported_count": imported_count})
                return

            if path == '/api/admin/audio-upload':
                self._handle_audio_upload()
                return

            if path == '/api/admin/steno-notes-upload':
                self._handle_steno_notes_upload()
                return

            # Phase 3: Admin Review Payment Requests
            if path == '/api/admin/payments/review':
                data = self._read_json_body()
                req_id = data.get('request_id')
                action = data.get('action')  # 'approve' or 'reject'
                notes = data.get('notes', '')
                if not req_id or action not in ('approve', 'reject'):
                    self._send_json(400, {"error": "मान्य request_id एवं action ('approve' अथवा 'reject') आवश्यक है"})
                    return
                res = db.admin_review_payment(int(req_id), action, user['user_id'], notes)
                self._send_json(200, res)
                return

            # Admin Manual Subscriber Management: Grant / Extend Pro
            if path == '/api/admin/users/grant-subscription':
                data = self._read_json_body()
                target_user_id = data.get('user_id')
                plan_name = data.get('plan_name', 'StenoMaster Pro')
                days = int(data.get('days', 30))
                notes = data.get('notes', '')
                if not target_user_id:
                    self._send_json(400, {"error": "user_id आवश्यक है"})
                    return
                res = db.admin_grant_subscription(int(target_user_id), plan_name, days, user['user_id'], notes)
                self._send_json(200 if res.get('success') else 400, res)
                return

            # Admin Revoke / Expire Pro
            if path == '/api/admin/users/revoke-subscription':
                data = self._read_json_body()
                target_user_id = data.get('user_id')
                reason = data.get('reason', '')
                if not target_user_id:
                    self._send_json(400, {"error": "user_id आवश्यक है"})
                    return
                res = db.admin_revoke_subscription(int(target_user_id), user['user_id'], reason)
                self._send_json(200 if res.get('success') else 400, res)
                return

            # Admin Toggle Free Access (All 24+ Exercises Free for Student)
            if path == '/api/admin/users/toggle-free-access':
                data = self._read_json_body()
                target_user_id = data.get('user_id')
                is_free = bool(data.get('is_free_access'))
                if not target_user_id:
                    self._send_json(400, {"error": "user_id आवश्यक है"})
                    return
                res = db.admin_toggle_free_access(int(target_user_id), is_free, user['user_id'])
                self._send_json(200 if res.get('success') else 400, res)
                return

            # Phase 3: Admin Subscription & Cashfree Settings Update
            if path == '/api/admin/subscription/settings':
                data = self._read_json_body()
                plan_name = data.get('plan_name') or data.get('subscription_plan_name')
                plan_price = data.get('plan_price') or data.get('subscription_plan_price')
                p1m = data.get('subscription_price_1m')
                p3m = data.get('subscription_price_3m')
                p6m = data.get('subscription_price_6m')
                p1y = data.get('subscription_price_1y')
                upi_id = data.get('subscription_upi_id')
                qr_url = data.get('qr_url') or data.get('subscription_qr_url')
                cf_app_id = data.get('cashfree_app_id')
                cf_secret = data.get('cashfree_secret_key')
                cf_env = data.get('cashfree_env')

                updates = {}
                if plan_name: updates['subscription_plan_name'] = str(plan_name).strip()
                if plan_price: updates['subscription_plan_price'] = str(plan_price).strip()
                if p1m is not None: updates['subscription_price_1m'] = str(p1m).strip()
                if p3m is not None: updates['subscription_price_3m'] = str(p3m).strip()
                if p6m is not None: updates['subscription_price_6m'] = str(p6m).strip()
                if p1y is not None: updates['subscription_price_1y'] = str(p1y).strip()
                if upi_id is not None: updates['subscription_upi_id'] = str(upi_id).strip()
                if qr_url: updates['subscription_qr_url'] = str(qr_url).strip()
                if cf_app_id is not None: updates['cashfree_app_id'] = str(cf_app_id).strip()
                if cf_secret is not None: updates['cashfree_secret_key'] = str(cf_secret).strip()
                if cf_env is not None: updates['cashfree_env'] = str(cf_env).strip().upper()

                if updates:
                    db.update_admin_settings(updates)
                self._send_json(200, {"success": True, "message": "सदस्यता एवं Cashfree सेटिंग्स सफलतापूर्वक सुरक्षित की गईं!"})
                return

            # Phase 3: Admin Upload Payment QR Code
            if path == '/api/admin/subscription/upload-qr':
                self._handle_qr_upload()
                return

            self._send_json(404, {"error": "Admin endpoint not found"})
            return

        self.send_error(404, "Endpoint not found")

    # -------------------------------------------------------------------------
    # Audio Upload Handling (Base64 JSON or Multipart)
    # -------------------------------------------------------------------------
    def _handle_audio_upload(self):
        content_type = self.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            data = self._read_json_body()
            import base64
            filename = data.get('filename', f"audio_{int(datetime.now().timestamp())}.mp3")
            b64_data = data.get('data', '')
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]
            raw_bytes = base64.b64decode(b64_data)
            save_path = os.path.join(UPLOADS_DIR, filename)
            with open(save_path, 'wb') as f:
                f.write(raw_bytes)
            audio_url = f"/uploads/{filename}"
            self._send_json(200, {"audio_url": audio_url, "filename": filename})
        else:
            self._send_json(400, {"error": "Please provide audio payload in JSON base64 format"})

    def _handle_steno_notes_upload(self):
        content_type = self.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            data = self._read_json_body()
            import base64
            orig_filename = data.get('filename', f"steno_{int(datetime.now().timestamp())}.png")
            clean_name = os.path.basename(orig_filename).replace(' ', '_')
            ext = os.path.splitext(clean_name)[1].lower()
            if ext not in ('.png', '.jpg', '.jpeg', '.webp', '.pdf'):
                self._send_json(400, {"error": "अनुमति प्राप्त फ़ाइल प्रकार: .png, .jpg, .jpeg, .webp, .pdf"})
                return
            b64_data = data.get('data', '')
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]
            try:
                raw_bytes = base64.b64decode(b64_data)
            except Exception as e:
                self._send_json(400, {"error": f"Base64 decode failed: {e}"})
                return
            timestamp_prefix = int(datetime.now().timestamp())
            final_filename = f"steno_{timestamp_prefix}_{clean_name}"
            save_path = os.path.join(UPLOADS_DIR, final_filename)
            with open(save_path, 'wb') as f:
                f.write(raw_bytes)
            file_type = 'pdf' if ext == '.pdf' else 'image'
            file_url = f"/uploads/{final_filename}"
            self._send_json(200, {
                "success": True,
                "file_url": file_url,
                "filename": final_filename,
                "file_type": file_type
            })
        else:
            self._send_json(400, {"error": "Please provide steno notes file in JSON base64 format"})

    def _handle_qr_upload(self):
        content_type = self.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            data = self._read_json_body()
            import base64
            filename = data.get('filename', f"qr_{int(datetime.now().timestamp())}.png")
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ('.png', '.jpg', '.jpeg', '.webp'):
                self._send_json(400, {"error": "अनुमति प्राप्त फ़ाइल प्रकार: .png, .jpg, .jpeg, .webp"})
                return
            b64_data = data.get('data', '')
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]
            raw_bytes = base64.b64decode(b64_data)
            assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'assets')
            os.makedirs(assets_dir, exist_ok=True)
            clean_filename = f"qr_payment{ext}"
            save_path = os.path.join(assets_dir, clean_filename)
            with open(save_path, 'wb') as f:
                f.write(raw_bytes)
            qr_url = f"/assets/{clean_filename}"
            db.update_admin_settings({"subscription_qr_url": qr_url})
            self._send_json(200, {"qr_url": qr_url, "filename": clean_filename, "message": "QR Code updated successfully"})
        else:
            self._send_json(400, {"error": "Please provide QR image payload in JSON base64 format"})

    # -------------------------------------------------------------------------
    # Audio File Streaming with HTTP 206 Partial Content (Range Support)
    # -------------------------------------------------------------------------
    def _serve_audio_file(self, file_path: str):
        file_size = os.path.getsize(file_path)
        range_header = self.headers.get('Range', None)
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            fp_lower = file_path.lower()
            if fp_lower.endswith('.pdf'):
                mime_type = 'application/pdf'
            elif fp_lower.endswith(('.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            elif fp_lower.endswith('.png'):
                mime_type = 'image/png'
            elif fp_lower.endswith('.webp'):
                mime_type = 'image/webp'
            else:
                mime_type = 'audio/mpeg'

        if not range_header:
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(file_size))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
            return

        # HTTP Range header parsing: bytes=START-END
        try:
            byte_range = range_header.replace('bytes=', '').strip()
            parts = byte_range.split('-')
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

            if start >= file_size or end >= file_size:
                self.send_error(416, "Requested Range Not Satisfiable")
                return

            length = end - start + 1
            self.send_response(206)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Range', f"bytes {start}-{end}/{file_size}")
            self.send_header('Content-Length', str(length))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()

            with open(file_path, 'rb') as f:
                f.seek(start)
                self.wfile.write(f.read(length))
        except Exception as e:
            self.send_error(500, f"Error streaming audio: {str(e)}")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def run_server(port=PORT):
    db.init_db()
    server_address = ('', port)
    httpd = ThreadedHTTPServer(server_address, StenoMasterHandler)
    local_ip = get_local_ip()
    print("=" * 65)
    print("   [*] STENOMASTER - Professional Stenographer Platform")
    print("   Tagline: Listen. Type. Improve. Master Steno.")
    print("=" * 65)
    print(f"   Local Access:      http://localhost:{port}")
    print(f"   Network / Mobile:  http://{local_ip}:{port}")
    print("   Default Admin:     admin@stenomaster.com / admin123")
    print("   Default Student:   student@stenomaster.com / student123")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
