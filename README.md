# StenoMaster — Professional Stenographer Practice & Typing Platform

> *"Listen. Type. Improve. Master Steno."*

A complete, production-ready web application and PWA tailored for students preparing for Hindi & English Stenographer examinations (SSC Stenographer Grade C & D, UPSSSC, High Court / District Court, and Departmental stenography tests).

---

## 🚀 Quick Start (Running the Application)

### Option 1: Double-Click Batch File (Windows)
Double-click `run.bat` in this folder. It launches the Python server on port `8085` and automatically opens your browser at:
`http://localhost:8085`

### Option 2: Command Line
```powershell
cd "d:\harsh khare\stenomaster"
python server.py 8085
```

### 🔑 Default Credentials
- **Student Demo Account**:
  - Email / Username: `student@stenomaster.com` / `StenoStudent`
  - Password: `student123`
- **Admin Account**:
  - Email / Username: `admin@stenomaster.com` / `Admin`
  - Password: `admin123`

---

## 🛠️ Technology Stack & Architecture

- **Backend**: Python 3 standard library (`http.server`, `socketserver`, `sqlite3`, `hashlib`, `unicodedata`, `difflib`). Zero external dependencies or `pip install` required.
- **Frontend**: Clean, modern responsive Vanilla JavaScript (ES6+), HTML5, and CSS3 with custom design system variables, light/dark themes, and high-readiness typography for Devanagari and Latin scripts.
- **PWA**: Installable web app with `manifest.json`, offline app shell caching via `service-worker.js`, and SVG application icons.
- **Audio Engine**: Custom HTML5 audio controller with HTTP 206 partial content streaming, variable speed chips (0.5x to 2.0x), ±5s scrubbing, and automatic Web Speech API synthesis fallback for passages without pre-recorded audio.
- **Typing Engine**: Distraction-free typing area supporting:
  1. Mangal / Unicode Hindi
  2. Kruti Dev 010 (converted to Unicode on submission)
  3. Inscript Layout
  4. Remington-Style Hindi
  - Live character/word counts, elapsed timer, 5-second draft auto-save, and accidental leave warning modal.
- **Evaluation Engine**: Dynamic Programming (Needleman-Wunsch / Levenshtein sequence alignment) token comparison, Hindi matra error diagnostics, confusable letter detection, weak area recommendation generator, and separate non-penalizing linguistic suggestion layer.

---

## 📊 Database Architecture (`stenomaster.db`)

SQLite database with 15 structured tables:
1. `users`: Credentials, roles (`student`, `admin`), referral codes.
2. `profiles`: Display name, target exam, target WPM, streak, points, leaderboard privacy.
3. `categories`: Hierarchical categories with custom icons and sort orders.
4. `passages`: Official texts, instructions, target speed, audio file references, tags, publish status. *(Security: Official text is strictly concealed from students before submission).*
5. `audio_files`: Uploaded MP3/WAV/M4A metadata.
6. `practice_attempts`: Historical attempt scores, Net/Gross WPM, accuracy %, typing mode, time taken, raw input, JSON evaluation reports.
7. `practice_errors`: Normalized token-level error log for diagnostic aggregation.
8. `bookmarks`: Student saved passages.
9. `notifications`: In-app alerts, daily goal reminders, and achievements.
10. `referrals`: Referral tracking and reward allocations.
11. `rewards`: Points ledger.
12. `leaderboard_records`: Multi-period performance cache.
13. `user_settings`: User theme, default typing mode, and audio preferences.
14. `admin_settings`: Dynamic branding (name, tagline), daily target goals, and exam scoring rules.
15. `achievements`: Unlocked milestone badges.

---

## 🔍 How the Evaluation Engine Works

1. **Normalization (`hindi_converter.py`)**:
   - Both official and typed text undergo NFKC normalization, nukta standardization (e.g. ड़, ढ़, क़, ज़, फ़), halant formatting, zero-width space/joiner removal, and punctuation standardization.
   - For **Kruti Dev 010**, preceding 'f' (chhoti 'i' matra) and reph ('Z') are accurately re-ordered into canonical Devanagari Unicode.
2. **Sequence Alignment (`evaluation.py`)**:
   - Uses dynamic programming to align official tokens against student typed tokens globally without index drift when tokens are omitted or added.
3. **Error Classification**:
   - **Correct**: Exact match.
   - **Matra Errors**: Detects `ि` vs `ी`, `ु` vs `ू`, `े` vs `ै`, `ो` vs `ौ`, अनुस्वार vs चंद्रबिंदु.
   - **Letter Errors**: Confusables like `श/ष/स`, `ब/व`, `न/ण`, `ड/ढ`, `द/ध`, `त/थ`, `र/ड़/ढ़`, half-letters and halant.
   - **Missing Words**: Tokens omitted by the student.
   - **Extra Words**: Unsolicited tokens inserted by the student.
   - **Spelling Errors**: Phonetic or high-similarity deviations.
   - **Punctuation**: Full stop / danda (।) and comma discrepancies.
4. **Scoring Formulas**:
   - Gross WPM = `(Typed Characters / 5) / Time (min)`
   - Net WPM and Penalties configured per exam preset:
     - **Standard Mode**: Full mistake (omission/addition/wrong word) = 1.0; Half mistake (matra/spelling/punctuation) = 0.5.
     - **SSC Stenographer Mode**: Standard SSC Grade C/D penalty weighting.
     - **High Court Strict Mode**: 1.0 deduction for all errors.
   - Accuracy % = `Max(0, (1 - Weighted Errors / Total Official Words) * 100)`.

---

## 🛠️ Admin Features

1. **Passage Management**:
   - Create, edit, delete, and publish/unpublish passages.
   - Audio file uploader: Upload MP3/WAV files directly from the browser (auto-saved to `/uploads/`).
   - Enter official reference text (never revealed to students).
2. **Bulk Import**:
   - Paste JSON arrays of passages to import dozens of dictations at once.
3. **Scoring Preset Configurator**:
   - Switch between Standard, SSC Steno, and Court evaluation rules.
4. **Branding & Target Settings**:
   - Rename platform name and tagline in real-time.
   - Configure daily dictation count and time targets.
