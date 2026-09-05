import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Login as admin
admin_req = urllib.request.Request('http://localhost:8085/api/auth/login',
    data=json.dumps({'email_or_username': 'admin@stenomaster.com', 'password': 'admin123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST')
with urllib.request.urlopen(admin_req) as resp:
    token = json.loads(resp.read().decode('utf-8'))['token']

admin_headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# 1. Create a new passage
new_passage = {
    'title': 'उत्तर प्रदेश अधीनस्थ सेवा चयन आयोग — आशुलिपिक विशेष अभ्यास',
    'category_id': 10,
    'language': 'hindi',
    'difficulty': 'medium',
    'target_wpm': 45,
    'duration_seconds': 180,
    'instructions': 'यूपीएसएसएससी आशुलिपिक परीक्षा स्तर का गद्यांश।',
    'official_text': 'उत्तर प्रदेश में ग्रामीण विकास योजनाओं के त्वरित क्रियान्वयन हेतु पंचायती राज संस्थाओं को सुदृढ़ किया जा रहा है। ग्राम पंचायतों में डिजिटल सेवा केंद्रों की स्थापना से ग्रामीणों को सरकारी प्रमाण पत्र और कल्याणकारी योजनाओं का लाभ गांव में ही प्राप्त हो रहा है।',
    'tags': 'यूपीएसएसएससी,ग्राम,पंचायत'
}

req = urllib.request.Request('http://localhost:8085/api/admin/passages/save',
    data=json.dumps(new_passage).encode('utf-8'),
    headers=admin_headers,
    method='POST')
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    new_id = res['passage_id']
    print(f"1. Admin created new passage with ID: {new_id}")

# 2. Verify passage appears in student list
search_q = urllib.parse.quote('यूपीएसएसएससी')
req = urllib.request.Request(f'http://localhost:8085/api/passages?search={search_q}')
with urllib.request.urlopen(req) as resp:
    search_res = json.loads(resp.read().decode('utf-8'))['passages']
    print(f"2. Student search found {len(search_res)} passages matching search.")
    assert any(p['id'] == new_id for p in search_res), "New passage not found in student search!"

# 3. Update branding settings
req = urllib.request.Request('http://localhost:8085/api/admin/settings/update',
    data=json.dumps({
        'app_name': 'StenoMaster Pro',
        'tagline': 'Listen. Type. Improve. Master Steno.'
    }).encode('utf-8'),
    headers=admin_headers,
    method='POST')
with urllib.request.urlopen(req) as resp:
    print("3. Admin branding settings updated.")

# 4. Verify settings API
req = urllib.request.Request('http://localhost:8085/api/settings')
with urllib.request.urlopen(req) as resp:
    settings = json.loads(resp.read().decode('utf-8'))['settings']
    print(f"4. Retrieved app_name: '{settings['app_name']}', tagline: '{settings['tagline']}'")
    assert settings['app_name'] == 'StenoMaster Pro'

print("\nADMIN WORKFLOW VERIFICATION PASSED!")
