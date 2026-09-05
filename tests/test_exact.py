import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Login
req = urllib.request.Request('http://localhost:8085/api/auth/login',
    data=json.dumps({'email_or_username': 'student@stenomaster.com', 'password': 'student123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST')
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode('utf-8'))['token']

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Get admin passage with full official text
req = urllib.request.Request('http://localhost:8085/api/admin/passages',
    headers={'Authorization': f'Bearer {token}'})
# Use admin login to fetch official text of passage 2
admin_req = urllib.request.Request('http://localhost:8085/api/auth/login',
    data=json.dumps({'email_or_username': 'admin@stenomaster.com', 'password': 'admin123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST')
with urllib.request.urlopen(admin_req) as resp:
    admin_token = json.loads(resp.read().decode('utf-8'))['token']

admin_headers = {'Authorization': f'Bearer {admin_token}'}
req = urllib.request.Request('http://localhost:8085/api/admin/passages', headers=admin_headers)
with urllib.request.urlopen(req) as resp:
    passages = json.loads(resp.read().decode('utf-8'))['passages']
    gandhi_passage = next(p for p in passages if p['id'] == 2)
    official_text = gandhi_passage['official_text']

print(f"Official text word count: {len(official_text.split())}")

# Submit EXACT official text in 120 seconds (~45 WPM)
req = urllib.request.Request('http://localhost:8085/api/practice/submit',
    data=json.dumps({
        'passage_id': 2,
        'typed_text': official_text,
        'typing_mode': 'mangal',
        'time_taken_seconds': 120
    }).encode('utf-8'),
    headers=headers,
    method='POST')

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    m = res['metrics']
    print("=== EXACT MATCH SUBMISSION RESULT ===")
    print(f"Gross WPM: {m['gross_wpm']}")
    print(f"Net WPM:   {m['net_wpm']}")
    print(f"Accuracy:  {m['accuracy']}%")
    print(f"Total Errors: {m['total_errors']}")
    print(f"Correct Words: {m['correct_words']}")
    print(f"Total Words Official: {m['total_words_official']}")
    assert m['accuracy'] >= 99.0, f"Expected 100% accuracy, got {m['accuracy']}%"
    assert m['net_wpm'] > 35.0, f"Expected net WPM > 35, got {m['net_wpm']}"
    print("PERFECT 100% ACCURACY TEST PASSED!")
