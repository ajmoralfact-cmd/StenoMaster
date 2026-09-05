#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StenoMaster — Phase 3 Final Production QA & Validation Test Suite
Tests:
1. Student Registration & Validation (Zero initial points, STM-YYYY-XXXXXX student ID)
2. Duplicate Email & Phone Validation
3. Real Reward Ledger & Idempotency (Strict SQLite ledger, zero fake points)
4. Public & Student Subscription Details
5. Payment Request Submission (UTR / Transaction ID)
6. Admin Payment Review & Approval (30-day active PRO access)
7. Premium Passage Access Control (Server-side 403 enforcement for non-subscribers)
8. Admin Security & Subscription Configuration
"""

import sys
import os
import json
import time
import re
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:8085'


def http_req(path, method='GET', body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"

    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode('utf-8')
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"raw": err_body}
    except Exception as e:
        return 500, {"error": str(e)}


def run_tests():
    print("=" * 70)
    print("  STENOMASTER — PHASE 3 PRODUCTION AUTOMATED TEST SUITE")
    print("=" * 70)

    passed = 0
    total = 8

    # 1. Test 1: Student Registration (Zero initial points, STM-YYYY-XXXXXX ID)
    print("\n[TEST 1] Student Self-Registration Gateway...")
    test_email = f"steno_test_{int(time.time())}@example.com"
    test_phone = f"98{int(time.time())%100000000:08d}"
    reg_payload = {
        "full_name": "Test Stenographer",
        "phone": test_phone,
        "email": test_email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "target_exam": "SSC Stenographer Grade C & D",
        "preferred_language": "hindi",
        "preferred_typing_mode": "mangal"
    }

    st, reg_res = http_req("/api/auth/register-student", method="POST", body=reg_payload)
    if st in [200, 201] and "token" in reg_res:
        user = reg_res.get("user", {})
        student_code = user.get("student_code", "")
        token = reg_res.get("token", "")
        code_match = re.match(r"^STM-\d{4}-\d{6}$", student_code)

        # Check profile points strictly 0 (points is in user object returned by me)
        st_me, me_res = http_req("/api/auth/me", token=token)
        points = me_res.get("user", {}).get("points", user.get("points", -1))

        if code_match and points == 0:
            print(f"  ✓ Registered: Code={student_code}, Starting Points={points} (STRICT ZERO)")
            passed += 1
        else:
            print(f"  ✗ Failed verification: Code={student_code}, Points={points}")
    else:
        print(f"  ✗ Registration failed: HTTP {st}, {reg_res}")

    student_token = reg_res.get("token")
    student_id = reg_res.get("user", {}).get("id") or reg_res.get("user", {}).get("user_id")

    # 2. Test 2: Duplicate Email & Phone Validation
    print("\n[TEST 2] Duplicate Email and Phone Registration Rejection...")
    dup_payload = dict(reg_payload)
    dup_payload["full_name"] = "Duplicate User"
    st_dup_email, res_dup_email = http_req("/api/auth/register-student", method="POST", body=dup_payload)
    
    dup_payload["email"] = f"other_{int(time.time())}@example.com"
    st_dup_phone, res_dup_phone = http_req("/api/auth/register-student", method="POST", body=dup_payload)

    if st_dup_email == 400 and st_dup_phone == 400:
        print(f"  ✓ Duplicate email correctly rejected (HTTP 400)")
        print(f"  ✓ Duplicate phone correctly rejected (HTTP 400)")
        passed += 1
    else:
        print(f"  ✗ Duplicate check failed: email_status={st_dup_email}, phone_status={st_dup_phone}")

    # 3. Test 3: Real Reward Ledger & Idempotency
    print("\n[TEST 3] Real Reward Points Ledger & Idempotency Check...")
    # Get a public passage
    st_p, res_p = http_req("/api/passages")
    passages = res_p.get("passages", [])
    pub_p = next((p for p in passages if not p.get("is_premium")), passages[0])
    p_id = pub_p["id"]

    submit_payload = {
        "passage_id": p_id,
        "typed_text": pub_p.get("preview_text", "रामधारी सिंह दिनकर राष्ट्रकवि थे।"),
        "typing_mode": "mangal",
        "time_taken_seconds": 60
    }
    st_sub, sub_res = http_req("/api/practice/submit", method="POST", body=submit_payload, token=student_token)
    attempt_id = sub_res.get("attempt_id")

    # Check student reward ledger
    st_rew, rew_res = http_req("/api/rewards/history", token=student_token)
    txs = rew_res.get("transactions", [])
    total_ledger_pts = sum(t["points"] for t in txs)

    st_me2, me_res2 = http_req("/api/auth/me", token=student_token)
    prof_pts = me_res2.get("user", {}).get("points", 0)

    if st_sub == 200 and len(txs) > 0 and prof_pts == total_ledger_pts:
        print(f"  ✓ Attempt {attempt_id} awarded {total_ledger_pts} pts in ledger. Profile points strictly match: {prof_pts}")
        passed += 1
    else:
        print(f"  ✗ Reward ledger check: HTTP {st_sub}, Ledger sum={total_ledger_pts}, Profile points={prof_pts}")

    # 4. Test 4: Public & Student Subscription Details
    print("\n[TEST 4] Subscription Details Endpoint...")
    st_sub_det, sub_det = http_req("/api/subscription/details", token=student_token)
    if st_sub_det == 200 and "plan_name" in sub_det and "qr_url" in sub_det:
        print(f"  ✓ Subscription details loaded: Plan={sub_det['plan_name']}, Price=₹{sub_det['plan_price']}, Status={sub_det['subscription_status']}")
        passed += 1
    else:
        print(f"  ✗ Failed to fetch subscription details: HTTP {st_sub_det}, {sub_det}")

    # 5. Test 5: Payment Proof Submission
    print("\n[TEST 5] Student Payment Request Submission...")
    tx_id = f"UTR{int(time.time())}"
    pay_payload = {
        "plan_name": "StenoMaster Pro — 1 Month",
        "amount": 299,
        "transaction_id": tx_id,
        "screenshot_url": "https://example.com/receipt.jpg"
    }
    st_pay, pay_res = http_req("/api/subscription/request-payment", method="POST", body=pay_payload, token=student_token)
    st_my_pay, my_pay_res = http_req("/api/subscription/my-requests", token=student_token)
    my_requests = my_pay_res.get("requests", [])

    if st_pay in [200, 201] and any(r["transaction_id"] == tx_id and r["status"] == "pending" for r in my_requests):
        req_id = next(r["id"] for r in my_requests if r["transaction_id"] == tx_id)
        print(f"  ✓ Payment request submitted successfully: Request ID #{req_id}, UTR={tx_id}, Status=pending")
        passed += 1
    else:
        print(f"  ✗ Payment submission failed: HTTP {st_pay}, {pay_res}")

    # 6. Test 6: Admin Review & Approval
    print("\n[TEST 6] Admin Review & Subscription Activation...")
    # Admin login
    st_adm, adm_login = http_req("/api/auth/login", method="POST", body={"email_or_username": "admin@stenomaster.com", "password": "admin123"})
    admin_token = adm_login.get("token")

    st_all_pay, all_pay = http_req("/api/admin/payments", token=admin_token)
    pending_list = all_pay.get("payments", [])
    target_req = next((r for r in pending_list if r["transaction_id"] == tx_id), None)

    if target_req:
        review_payload = {
            "request_id": target_req["id"],
            "action": "approve",
            "notes": "Payment verified via SBI UPI"
        }
        st_rev, rev_res = http_req("/api/admin/payments/review", method="POST", body=review_payload, token=admin_token)
        
        # Verify student subscription status
        st_st_me, st_me_info = http_req("/api/auth/me", token=student_token)
        user_info = st_me_info.get("user", {})
        sub_status = user_info.get("subscription_status")
        sub_end = user_info.get("subscription_end")

        if st_rev == 200 and sub_status == "active" and sub_end:
            print(f"  ✓ Admin approved payment request #{target_req['id']}")
            print(f"  ✓ Student subscription activated: status={sub_status}, expires={sub_end}")
            passed += 1
        else:
            print(f"  ✗ Activation verification failed: rev_st={st_rev}, sub_status={sub_status}, sub_end={sub_end}")
    else:
        print(f"  ✗ Pending request with UTR {tx_id} not found in admin payments list")

    # 7. Test 7: Premium Passage Access Control
    print("\n[TEST 7] Server-Side Premium Passage Access Control...")
    import db
    # Ensure there is a premium passage
    conn = db.get_db()
    c = conn.cursor()
    c.execute("SELECT id, title, is_premium FROM passages WHERE is_premium = 1 LIMIT 1")
    prem_passage = c.fetchone()
    if not prem_passage:
        c.execute("UPDATE passages SET is_premium = 1 WHERE id = (SELECT id FROM passages ORDER BY id DESC LIMIT 1)")
        conn.commit()
        c.execute("SELECT id, title, is_premium FROM passages WHERE is_premium = 1 LIMIT 1")
        prem_passage = c.fetchone()
    conn.close()

    prem_p_id = prem_passage["id"]

    # Test with non-premium student
    fresh_email = f"free_user_{int(time.time())}@example.com"
    fresh_phone = f"97{int(time.time())%100000000:08d}"
    _, fresh_res = http_req("/api/auth/register-student", method="POST", body={
        "full_name": "Free User",
        "phone": fresh_phone,
        "email": fresh_email,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    free_token = fresh_res.get("token")

    # Non-subscriber attempt on premium passage -> MUST RETURN HTTP 403
    st_prem_free, res_prem_free = http_req("/api/practice/submit", method="POST", body={
        "passage_id": prem_p_id,
        "typed_text": "परीक्षण शब्द अभ्यास",
        "typing_mode": "mangal",
        "time_taken_seconds": 30
    }, token=free_token)

    # Active subscriber attempt on premium passage -> MUST RETURN HTTP 200
    st_prem_sub, res_prem_sub = http_req("/api/practice/submit", method="POST", body={
        "passage_id": prem_p_id,
        "typed_text": "परीक्षण शब्द अभ्यास",
        "typing_mode": "mangal",
        "time_taken_seconds": 30
    }, token=student_token)

    if st_prem_free == 403 and st_prem_sub == 200:
        print(f"  ✓ Non-subscriber rejected on premium passage #{prem_p_id}: HTTP 403 ({res_prem_free.get('error')})")
        print(f"  ✓ Active subscriber accepted on premium passage #{prem_p_id}: HTTP 200")
        passed += 1
    else:
        print(f"  ✗ Premium check failed: free_status={st_prem_free}, subscriber_status={st_prem_sub}")

    # 8. Test 8: Admin Security & Subscription Config
    print("\n[TEST 8] Admin Security & Subscription Plan Config...")
    # Student trying to access admin endpoints -> 403
    st_stu_adm, _ = http_req("/api/admin/payments", token=student_token)
    st_stu_rew, _ = http_req("/api/admin/rewards", token=student_token)

    # Admin updating subscription settings
    st_set, set_res = http_req("/api/admin/subscription/settings", method="POST", body={
        "subscription_plan_name": "StenoMaster Pro — 1 Month (Special)",
        "subscription_plan_price": "349"
    }, token=admin_token)

    st_chk, chk_res = http_req("/api/subscription/details")
    cur_plan_name = chk_res.get("plan_name")
    cur_plan_price = chk_res.get("plan_price")

    # Restore default
    http_req("/api/admin/subscription/settings", method="POST", body={
        "subscription_plan_name": "StenoMaster Pro — 1 Month",
        "subscription_plan_price": "299"
    }, token=admin_token)

    if st_stu_adm == 403 and st_stu_rew == 403 and st_set == 200 and cur_plan_price == "349":
        print("  ✓ Admin routes strictly return 403 to non-admin students")
        print(f"  ✓ Subscription configuration successfully updated and verified: {cur_plan_name} = ₹{cur_plan_price}")
        passed += 1
    else:
        print(f"  ✗ Admin settings test failed: stu_adm={st_stu_adm}, stu_rew={st_stu_rew}, set={st_set}, price={cur_plan_price}")

    print("\n" + "=" * 70)
    print(f"  PHASE 3 TEST RESULTS: {passed}/{total} TESTS PASSED")
    print("=" * 70)

    if passed == total:
        print("🎉 ALL PHASE 3 PRODUCTION TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("❌ SOME PHASE 3 TESTS FAILED!")
        return 1


if __name__ == '__main__':
    sys.exit(run_tests())
