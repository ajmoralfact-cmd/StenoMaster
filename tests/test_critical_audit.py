#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StenoMaster — Phase 1 Critical Audit Automated Test Suite (15 Mandatory Tests)
Covers Section 33 specifications:
1.  Test 1: Student login -> student dashboard/role
2.  Test 2: Admin login -> admin dashboard/role
3.  Test 3: Student -> /admin route redirection/forbidden (403)
4.  Test 4: Student token -> /api/admin/users returns 403
5.  Test 5: Unauthenticated -> /api/admin/users returns 401
6.  Test 6: Admin token -> /api/admin/users returns 200 with users list
7.  Test 7: Student loads practice -> official_text is NOT present
8.  Test 8: Missing word detected (MISSING_WORD)
9.  Test 9: Matra error detected (MATRA_ERROR / spelling)
10. Test 10: Extra word detected (EXTRA_WORD)
11. Test 11: Wrong word detected (WRONG_WORD)
12. Test 12: Double submit within 5s window creates only 1 attempt record
13. Test 13: Logout -> login -> history shows persisted attempt
14. Test 14: Kruti Dev input converted to Unicode Devanagari accurately before evaluation
15. Test 15: Score tampering -> server ignores client-provided net_wpm/accuracy and computes real metrics
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import time
import urllib.request
import urllib.error

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


def run_all_15_tests():
    print("=" * 75)
    print("   STENOMASTER PHASE 1 CRITICAL AUDIT — 15 MANDATORY TEST SUITE")
    print("=" * 75)
    passed_count = 0
    total_count = 15

    # -------------------------------------------------------------------------
    # Test 1: Student login -> student role
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Student login -> student dashboard/role")
    s1, r1 = http_req('/api/auth/login', 'POST', {'email': 'student@stenomaster.com', 'password': 'student123'})
    if s1 == 200 and r1.get('user', {}).get('role') == 'student' and r1.get('token'):
        student_token = r1['token']
        print(f"  PASS: Student authenticated successfully. Role='{r1['user']['role']}', Token issued.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected 200 with role='student', got {s1}, {r1}")
        student_token = None

    # -------------------------------------------------------------------------
    # Test 2: Admin login -> admin role
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Admin login -> admin dashboard/role")
    s2, r2 = http_req('/api/auth/login', 'POST', {'email': 'admin@stenomaster.com', 'password': 'admin123'})
    if s2 == 200 and r2.get('user', {}).get('role') == 'admin' and r2.get('token'):
        admin_token = r2['token']
        print(f"  PASS: Admin authenticated successfully. Role='{r2['user']['role']}', Token issued.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected 200 with role='admin', got {s2}, {r2}")
        admin_token = None

    # -------------------------------------------------------------------------
    # Test 3: Student -> /admin route forbidden (403)
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Student -> /admin route forbidden")
    s3, r3 = http_req('/api/admin/overview', 'GET', token=student_token)
    if s3 == 403:
        print("  PASS: Student access to admin route /api/admin/overview blocked with HTTP 403.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected HTTP 403 for student accessing admin route, got {s3}, {r3}")

    # -------------------------------------------------------------------------
    # Test 4: Student token -> /api/admin/users returns 403
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Student token -> /api/admin/users returns 403")
    s4, r4 = http_req('/api/admin/users', 'GET', token=student_token)
    if s4 == 403:
        print("  PASS: Student token querying /api/admin/users strictly returns HTTP 403.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected 403 for student accessing /api/admin/users, got {s4}, {r4}")

    # -------------------------------------------------------------------------
    # Test 5: Unauthenticated -> /api/admin/users returns 401
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Unauthenticated -> /api/admin/users returns 401")
    s5, r5 = http_req('/api/admin/users', 'GET')
    if s5 == 401:
        print("  PASS: Unauthenticated request to /api/admin/users strictly returns HTTP 401.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected 401 for unauthenticated access to /api/admin/users, got {s5}, {r5}")

    # -------------------------------------------------------------------------
    # Test 6: Admin token -> /api/admin/users returns 200 with users list
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Admin token -> /api/admin/users returns 200 with users list")
    s6, r6 = http_req('/api/admin/users', 'GET', token=admin_token)
    if s6 == 200 and isinstance(r6.get('users'), list) and len(r6['users']) >= 2:
        print(f"  PASS: Admin successfully retrieved user list. Count={len(r6['users'])} users.")
        passed_count += 1
    else:
        print(f"  FAIL: Expected 200 with list of users, got {s6}, {r6}")

    # -------------------------------------------------------------------------
    # Test 7: Student loads practice -> official_text is NOT present
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Student loads practice -> official_text is NOT present")
    s7, r7 = http_req('/api/passages/1', 'GET', token=student_token)
    passage = r7.get('passage', {})
    if s7 == 200 and ('official_text' not in passage or passage.get('official_text') == ''):
        print("  PASS: Anti-cheat active. 'official_text' is completely omitted from student practice payload.")
        passed_count += 1
    else:
        print(f"  FAIL: Leak detected or request failed! s7={s7}, official_text present={'official_text' in passage}")

    # -------------------------------------------------------------------------
    # Evaluation Unit Tests (Tests 8, 9, 10, 11)
    # -------------------------------------------------------------------------
    import evaluation
    settings = {"half_mistake_weight": 0.5, "full_mistake_weight": 1.0}

    # Test 8: Missing word detected
    print("\n[TEST 8] Missing word detected (MISSING_WORD)")
    ref8 = "भारत एक महान और समृद्ध देश है"
    typed8 = "भारत एक महान समृद्ध देश है"  # 'और' is missing
    eval8 = evaluation.evaluate_practice_attempt(ref8, typed8, 60, "hindi", "standard", settings)
    missing_errors = [e for e in eval8['error_table'] if 'MISSING' in e['error_type'].upper()]
    if len(missing_errors) > 0 and eval8['metrics']['total_errors'] >= 1:
        print(f"  PASS: Missing word correctly identified. Detected: {missing_errors[0]['error_type']} ('{missing_errors[0]['correct_text']}')")
        passed_count += 1
    else:
        print(f"  FAIL: Expected MISSING_WORD error, got errors: {eval8['error_table']}")

    # Test 9: Matra error detected
    print("\n[TEST 9] Matra error detected (MATRA_ERROR / spelling)")
    ref9 = "उसने कहा कि वह जाएगा"
    typed9 = "उसने कहा की वह जाएगा"  # 'की' instead of 'कि'
    eval9 = evaluation.evaluate_practice_attempt(ref9, typed9, 60, "hindi", "standard", settings)
    matra_errors = [e for e in eval9['error_table'] if 'MATRA' in e['error_type'].upper() or 'SPELLING' in e['error_type'].upper() or e['category'] == 'half']
    if len(matra_errors) > 0:
        print(f"  PASS: Matra error detected. Type='{matra_errors[0]['error_type']}', Category='{matra_errors[0]['category']}' (Half mistake weight).")
        passed_count += 1
    else:
        print(f"  FAIL: Expected MATRA_ERROR, got errors: {eval9['error_table']}")

    # Test 10: Extra word detected
    print("\n[TEST 10] Extra word detected (EXTRA_WORD)")
    ref10 = "संसद के दोनों सदनों में विधेयक पारित हुआ"
    typed10 = "संसद के दोनों सदनों में नया विधेयक पारित हुआ"  # 'नया' is extra
    eval10 = evaluation.evaluate_practice_attempt(ref10, typed10, 60, "hindi", "standard", settings)
    extra_errors = [e for e in eval10['error_table'] if 'EXTRA' in e['error_type'].upper()]
    if len(extra_errors) > 0:
        print(f"  PASS: Extra word detected. Type='{extra_errors[0]['error_type']}', Word='{extra_errors[0]['your_text']}'")
        passed_count += 1
    else:
        print(f"  FAIL: Expected EXTRA_WORD, got errors: {eval10['error_table']}")

    # Test 11: Wrong word detected
    print("\n[TEST 11] Wrong word detected (WRONG_WORD)")
    ref11 = "हमारा राष्ट्रीय ध्वज तिरंगा है"
    typed11 = "हमारा राष्ट्रीय झंडा तिरंगा है"  # 'झंडा' instead of 'ध्वज'
    eval11 = evaluation.evaluate_practice_attempt(ref11, typed11, 60, "hindi", "standard", settings)
    wrong_errors = [e for e in eval11['error_table'] if 'WRONG' in e['error_type'].upper() or 'SUBSTITUTION' in e['error_type'].upper()]
    if len(wrong_errors) > 0:
        print(f"  PASS: Wrong word detected. Type='{wrong_errors[0]['error_type']}', Typed='{wrong_errors[0]['your_text']}', Correct='{wrong_errors[0]['correct_text']}'")
        passed_count += 1
    else:
        print(f"  FAIL: Expected WRONG_WORD, got errors: {eval11['error_table']}")

    # -------------------------------------------------------------------------
    # Test 12: Double submit within 5s window creates only 1 attempt record
    # -------------------------------------------------------------------------
    print("\n[TEST 12] Double submit within 5s window creates only 1 attempt record")
    payload12 = {
        "passage_id": 1,
        "typed_text": f"अध्यक्ष महोदय मैं आपका अत्यंत आभारी हूँ कि आपने मुझे बोलने का अवसर दिया। #{int(time.time())}",
        "typing_mode": "mangal",
        "time_taken_seconds": 60
    }
    s12_1, r12_1 = http_req('/api/practice/submit', 'POST', payload12, token=student_token)
    s12_2, r12_2 = http_req('/api/practice/submit', 'POST', payload12, token=student_token)

    att1 = r12_1.get('attempt_id')
    att2 = r12_2.get('attempt_id')
    if s12_1 == 200 and s12_2 == 200 and att1 is not None and att1 == att2:
        print(f"  PASS: Double submit deduplicated. First ID={att1}, Second ID={att2} (Reused original record).")
        passed_count += 1
    else:
        print(f"  FAIL: Expected duplicate prevention, got att1={att1}, att2={att2}, s1={s12_1}, s2={s12_2}")

    # -------------------------------------------------------------------------
    # Test 13: Logout -> login -> history shows persisted attempt
    # -------------------------------------------------------------------------
    print("\n[TEST 13] Logout -> login -> history shows persisted attempt")
    s13_out, _ = http_req('/api/auth/logout', 'POST', token=student_token)
    s13_in, r13_in = http_req('/api/auth/login', 'POST', {'email': 'student@stenomaster.com', 'password': 'student123'})
    new_token = r13_in.get('token')
    s13_hist, r13_hist = http_req('/api/practice/history', 'GET', token=new_token)
    history = r13_hist.get('history', [])
    if s13_in == 200 and s13_hist == 200 and len(history) >= 1:
        latest = history[0]
        print(f"  PASS: Persisted history retrieved after re-auth. Latest Attempt ID={latest['id']}, WPM={latest['net_wpm']}, Accuracy={latest['accuracy']}%. Total records={len(history)}.")
        passed_count += 1
    else:
        print(f"  FAIL: History failed to persist or load. Status={s13_hist}, History len={len(history)}")

    # -------------------------------------------------------------------------
    # Test 14: Kruti Dev input converted to Unicode Devanagari accurately before evaluation
    # -------------------------------------------------------------------------
    print("\n[TEST 14] Kruti Dev input converted to Unicode Devanagari accurately")
    import hindi_converter
    converted = hindi_converter.convert_input_text("Hkkjr", "krutidev", "hindi")
    if converted == "भारत":
        print(f"  PASS: Kruti Dev 010 'Hkkjr' successfully converted to Unicode '{converted}'.")
        passed_count += 1
    else:
        print(f"  FAIL: Kruti Dev conversion mismatch. Expected 'भारत', got '{converted}'")

    # -------------------------------------------------------------------------
    # Test 15: Score tampering -> server ignores client-provided net_wpm/accuracy and computes real metrics
    # -------------------------------------------------------------------------
    print("\n[TEST 15] Score tampering protection (server calculates metrics)")
    tampered_payload = {
        "passage_id": 1,
        "typed_text": "गलत शब्द एक दो तीन चार पाँच",
        "typing_mode": "mangal",
        "time_taken_seconds": 60,
        "net_wpm": 999.0,
        "accuracy": 100.0,
        "gross_wpm": 999.0,
        "total_errors": 0
    }
    s15, r15 = http_req('/api/practice/submit', 'POST', tampered_payload, token=new_token)
    metrics15 = r15.get('metrics', {})
    ret_net_wpm = metrics15.get('net_wpm')
    ret_acc = metrics15.get('accuracy')
    if s15 == 200 and ret_net_wpm != 999.0 and ret_acc != 100.0:
        print(f"  PASS: Server rejected client-forged scores. Evaluated Net WPM={ret_net_wpm} (not 999.0), Accuracy={ret_acc}% (not 100.0%).")
        passed_count += 1
    else:
        print(f"  FAIL: Score tampering check failed. s15={s15}, returned net_wpm={ret_net_wpm}, accuracy={ret_acc}")

    # -------------------------------------------------------------------------
    # Final Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 75)
    print(f"   TEST SUMMARY: {passed_count}/{total_count} PASSED ({(passed_count/total_count)*100:.1f}%)")
    print("=" * 75)
    return passed_count == total_count


if __name__ == '__main__':
    success = run_all_15_tests()
    sys.exit(0 if success else 1)
