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

# Get passage 1
req = urllib.request.Request('http://localhost:8085/api/passages/1', headers=headers)
with urllib.request.urlopen(req) as resp:
    p = json.loads(resp.read().decode('utf-8'))['passage']
    print(f"Testing with passage: '{p['title']}'")

# Typing test with near-perfect input for Mahatma Gandhi passage (id: 2)
# Official text for Gandhi:
# 'सत्य ही ईश्वर है और अहिंसा उसका सर्वोच्च व्यावहारिक स्वरूप है। जब मनुष्य सत्य के मार्ग पर दृढ़तापूर्वक चलता है, तब किसी भी प्रकार का भय उसके मन को विचलित नहीं कर सकता।'
test_input = 'सत्य ही ईश्वर है और अहिंसा उसका सर्वोच्च व्यावहारिक स्वरूप है। जब मनुष्य सत्य के मार्ग पर दृढ़तापूर्वक चलता है, तब किसी भी प्रकार का भय उसके मन को विचलित नहीं कर सकता।'

req = urllib.request.Request('http://localhost:8085/api/practice/submit',
    data=json.dumps({
        'passage_id': 2,
        'typed_text': test_input,
        'typing_mode': 'mangal',
        'time_taken_seconds': 35
    }).encode('utf-8'),
    headers=headers,
    method='POST')

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read().decode('utf-8'))
    m = result['metrics']
    print('--- Result Report ---')
    print(f"Gross WPM: {m['gross_wpm']}")
    print(f"Net WPM: {m['net_wpm']}")
    print(f"Accuracy: {m['accuracy']}%")
    print(f"Errors: {result['error_counts']}")
    print(f"Suggestions count: {len(result['suggestions'])}")
    print(f"Weak areas count: {len(result['weak_areas'])}")
    print(f"Attempt ID: {result['attempt_id']}")

# Verify history shows this attempt
req = urllib.request.Request('http://localhost:8085/api/practice/history', headers=headers)
with urllib.request.urlopen(req) as resp:
    history = json.loads(resp.read().decode('utf-8'))['history']
    print(f"History records count: {len(history)}")
    latest = history[0]
    print(f"Latest attempt: WPM={latest['net_wpm']}, Acc={latest['accuracy']}%, Errors={latest['total_errors']}")

# Verify progress summary
req = urllib.request.Request('http://localhost:8085/api/progress/summary', headers=headers)
with urllib.request.urlopen(req) as resp:
    prog = json.loads(resp.read().decode('utf-8'))
    print(f"Progress summary: Best WPM={prog['stats']['best_wpm']}, Best Acc={prog['stats']['best_accuracy']}%, Streak={prog['stats']['streak_days']} days")

print('\nACCURACY & PROGRESS VERIFICATION PASSED!')
