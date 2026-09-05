import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Login as student
admin_req = urllib.request.Request('http://localhost:8085/api/auth/login',
    data=json.dumps({'email_or_username': 'student@stenomaster.com', 'password': 'student123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST')
with urllib.request.urlopen(admin_req) as resp:
    token = json.loads(resp.read().decode('utf-8'))['token']

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Official: 'वर्षों तक वन में घूम-घूम, बाधा-विघ्नों को चूम-चूम, सह धूप-घाम, पानी-पत्थर, पांडव आये कुछ और निखर। सौभाग्य न सब दिन सोता है, देखें, आगे क्या होता है।'
# Intentional modifications:
# 1. 'घूम' -> 'घुम' (मात्रा अशुद्धि: ु vs ू)
# 2. 'दिन' -> 'दीन' (मात्रा अशुद्धि: ि vs ी)
# 3. 'बाधा' -> 'बधा' (मात्रा अशुद्धि: ा)
# 4. 'पांडव' omitted (छूटा हुआ शब्द)
# 5. 'अत्यधिक' inserted (अतिरिक्त शब्द)
# 6. 'होता' -> 'होगा' (गलत शब्द)
student_test_text = 'वर्षों तक वन में घुम-घूम, बधा-विघ्नों को चूम-चूम, अत्यधिक सह धूप-घाम, पानी-पत्थर, आये कुछ और निखर। सौभाग्य न सब दीन सोता है, देखें, आगे क्या होगा है।'

req = urllib.request.Request('http://localhost:8085/api/practice/submit',
    data=json.dumps({
        'passage_id': 1,
        'typed_text': student_test_text,
        'typing_mode': 'mangal',
        'time_taken_seconds': 60
    }).encode('utf-8'),
    headers=headers,
    method='POST')

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    m = res['metrics']
    ec = res['error_counts']
    print("=== ERROR CLASSIFICATION VERIFICATION ===")
    print(f"Gross WPM: {m['gross_wpm']}")
    print(f"Net WPM:   {m['net_wpm']}")
    print(f"Accuracy:  {m['accuracy']}%")
    print("Detailed Error Counts:", ec)
    print(f"Total Errors detected: {ec['total']}")
    print("\nSample Error Table Rows:")
    for err in res['error_table'][:6]:
        print(f"  #{err['id']}: '{err['your_text']}' vs '{err['correct_text']}' -> {err['error_type']} ({err['detail']})")

    print("\nDetected Weak Areas:")
    for wa in res['weak_areas']:
        print(f"  • [{wa['severity']}] {wa['topic']} -> {wa['recommendation']}")

    print("\nLinguistic Suggestions:")
    for s in res['suggestions']:
        print(f"  • {s['title']}: {s['description']}")

    # Assertions
    assert ec['matra'] >= 1, "Matra errors should be detected"
    assert ec['missing'] >= 1, "Missing word should be detected"
    assert ec['extra'] >= 1, "Extra word should be detected"
    print("\nALL ERROR CLASSIFICATION TESTS PASSED!")
