#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StenoMaster — Phase 2 QA & Professionalization Test Suite
Validates:
1. Logo and asset availability (/assets/logo.png, /manifest.json)
2. Login Gateway & Auth UI structure
3. Student vs Admin Role-Based Access Control (RBAC) server-side enforcement
4. Admin Overview Metrics (All 8 metrics)
5. Anti-cheat official text concealment
6. Full end-to-end dictation, evaluation, and attempt persistence
7. Logout and session invalidation
"""

import sys
import os
import json
import urllib.request
import urllib.error

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:8085'

def http_request(path, method='GET', body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"

    data = json.dumps(body).encode('utf-8') if body else None
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

def http_raw_request(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method='GET')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.headers.get('Content-Type'), len(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, None, 0

def run_phase2_tests():
    print("=" * 70)
    print("  STENOMASTER PHASE 2 QA & PROFESSIONALIZATION SUITE")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # TEST 1: Logo & Manifest Asset Verification
    # -------------------------------------------------------------------------
    status, ctype, size = http_raw_request('/assets/logo.png')
    assert status == 200, f"Expected 200 for logo.png, got {status}"
    assert size > 5000, f"Logo size too small: {size} bytes"
    print(f"✅ TEST 1 PASSED: Brand Logo (/assets/logo.png) is accessible ({size} bytes, HTTP {status}).")

    status, ctype, size = http_raw_request('/manifest.json')
    assert status == 200, f"Expected 200 for manifest.json, got {status}"
    print(f"✅ TEST 1b PASSED: PWA Manifest (/manifest.json) is accessible.")

    # -------------------------------------------------------------------------
    # TEST 2: HTML UI Structure (Auth Gateway, Role Tabs, Brand Logo)
    # -------------------------------------------------------------------------
    status, ctype, size = http_raw_request('/')
    assert status == 200
    req = urllib.request.Request(f"{BASE_URL}/", method='GET')
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')

    assert 'authGatewayView' in html, "Missing #authGatewayView in HTML"
    assert 'tabStudentBtn' in html, "Missing #tabStudentBtn in HTML"
    assert 'tabAdminBtn' in html, "Missing #tabAdminBtn in HTML"
    assert 'studentLoginPanel' in html, "Missing #studentLoginPanel in HTML"
    assert 'adminLoginPanel' in html, "Missing #adminLoginPanel in HTML"
    assert '/assets/logo.png' in html, "Missing logo reference in HTML"
    assert 'areaIndicatorBadge' in html, "Missing #areaIndicatorBadge in HTML"
    assert 'forgotPasswordModal' in html, "Missing #forgotPasswordModal in HTML"
    print("✅ TEST 2 PASSED: New Login Gateway, Segmented Tabs, and Brand Logo present in app shell.")

    # -------------------------------------------------------------------------
    # TEST 3: Student Authentication Flow
    # -------------------------------------------------------------------------
    status, stu_res = http_request('/api/auth/login', 'POST', {
        'email_or_username': 'student@stenomaster.com',
        'password': 'student123'
    })
    assert status == 200, f"Student login failed: {stu_res}"
    assert stu_res['user']['role'] == 'student'
    student_token = stu_res['token']
    print(f"✅ TEST 3 PASSED: Student login authenticated (User: {stu_res['user']['username']}, Role: {stu_res['user']['role']}).")

    # -------------------------------------------------------------------------
    # TEST 4: Student RBAC Protection (Forbidden from all Admin Endpoints)
    # -------------------------------------------------------------------------
    admin_endpoints = [
        ('/api/admin/overview', 'GET', None),
        ('/api/admin/passages', 'GET', None),
        ('/api/admin/passages/save', 'POST', {'title': 'Hacked'}),
        ('/api/admin/passages/toggle-status', 'POST', {'passage_id': 1}),
        ('/api/admin/categories/save', 'POST', {'name': 'Hacked', 'slug': 'hacked'}),
        ('/api/admin/settings/update', 'POST', {'app_name': 'Hacked'}),
        ('/api/admin/bulk-import', 'POST', {'passages': []}),
    ]

    for ep, meth, payload in admin_endpoints:
        st, res = http_request(ep, meth, payload, token=student_token)
        assert st == 403, f"Security Breach! Student accessed {ep} with status {st}"
        assert 'Admin access required' in res.get('error', '')
    print("✅ TEST 4 PASSED: Student RBAC verified: All 7 Admin API endpoints returned HTTP 403 Forbidden.")

    # -------------------------------------------------------------------------
    # TEST 5: Admin Authentication Flow & 8 Overview Metrics
    # -------------------------------------------------------------------------
    status, adm_res = http_request('/api/auth/login', 'POST', {
        'email_or_username': 'admin@stenomaster.com',
        'password': 'admin123'
    })
    assert status == 200, f"Admin login failed: {adm_res}"
    assert adm_res['user']['role'] == 'admin'
    admin_token = adm_res['token']
    print(f"✅ TEST 5 PASSED: Admin login authenticated (Role: {adm_res['user']['role']}).")

    status, overview = http_request('/api/admin/overview', 'GET', token=admin_token)
    assert status == 200, f"Admin overview failed: {overview}"
    required_metrics = [
        'total_users', 'active_users', 'total_passages', 'published_passages',
        'total_practices', 'practices_today', 'avg_wpm', 'avg_accuracy'
    ]
    for metric in required_metrics:
        assert metric in overview, f"Missing metric {metric} in overview response"
    print(f"✅ TEST 5b PASSED: Admin Overview returned all 8 required metrics:")
    print(f"   Users: {overview['total_users']} (Active: {overview['active_users']}) | "
          f"Passages: {overview['total_passages']} (Published: {overview['published_passages']}) | "
          f"Practices: {overview['total_practices']} (Today: {overview['practices_today']}) | "
          f"Avg WPM: {overview['avg_wpm']}, Avg Acc: {overview['avg_accuracy']}%")

    # -------------------------------------------------------------------------
    # TEST 6: Student Practice Anti-Cheat Official Text Concealment
    # -------------------------------------------------------------------------
    status, passages_res = http_request('/api/passages', 'GET', token=student_token)
    assert status == 200
    passage_list = passages_res.get('passages', [])
    assert len(passage_list) > 0
    test_passage_id = passage_list[0]['id']

    status, detail_res = http_request(f'/api/passages/{test_passage_id}', 'GET', token=student_token)
    assert status == 200, f"Failed to get passage detail: {detail_res}"
    passage_data = detail_res.get('passage', {})
    assert 'official_text' not in passage_data or not passage_data['official_text'], \
        "Security Leak! official_text leaked to student before submission"
    assert 'audio_url' in passage_data, "Audio URL field missing from passage detail"
    print("✅ TEST 6 PASSED: Anti-Cheat verified: Passage detail omits official_text for student.")

    # -------------------------------------------------------------------------
    # TEST 7: End-to-End Dictation Submission & Evaluation
    # -------------------------------------------------------------------------
    status, sub_res = http_request('/api/practice/submit', 'POST', {
        'passage_id': test_passage_id,
        'typed_text': 'यह एक प्रामाणिक परीक्षा अभ्यास परीक्षण है।',
        'typing_mode': 'mangal',
        'time_taken_seconds': 45
    }, token=student_token)
    assert status == 200, f"Practice submission failed: {sub_res}"
    assert 'metrics' in sub_res and 'error_counts' in sub_res and 'attempt_id' in sub_res
    print(f"✅ TEST 7 PASSED: Practice submission evaluated (Attempt ID: {sub_res['attempt_id']}, Accuracy: {sub_res['metrics']['accuracy']}%).")

    # -------------------------------------------------------------------------
    # TEST 8: Session Logout & Invalidation
    # -------------------------------------------------------------------------
    status, logout_res = http_request('/api/auth/logout', 'POST', token=student_token)
    assert status == 200, f"Logout failed: {logout_res}"

    status, me_res = http_request('/api/auth/me', 'GET', token=student_token)
    assert status == 401, f"Session still active after logout: {me_res}"
    print("✅ TEST 8 PASSED: Logout successfully invalidated session token.")

    print("\n" + "=" * 70)
    print("  ALL PHASE 2 QA TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    run_phase2_tests()
