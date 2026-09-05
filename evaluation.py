"""
Text Evaluation Engine for StenoMaster
Performs:
1. Robust text normalization
2. Dynamic Programming (Needleman-Wunsch / Levenshtein) token sequence alignment
3. Hierarchical error classification:
   - Correct, Wrong, Missing, Extra, Matra error, Character error, Spelling error, Punctuation error, Transposition
4. Hindi-specific error analysis (matras, anusvara, chandrabindu, halant, confusable consonants)
5. Linguistic / grammar suggestions layer
6. Multi-rule scoring engine (Standard, SSC Stenographer Grade C/D, UPSSSC, High Court)
"""

import re
import difflib
import unicodedata
from typing import List, Dict, Any, Tuple
from hindi_converter import normalize_hindi_unicode, normalize_for_comparison


# Specific Hindi character & matra sets
HINDI_MATRAS = {
    '\u093E': 'ा',
    '\u093F': 'ि',
    '\u0940': 'ी',
    '\u0941': 'ु',
    '\u0942': 'ू',
    '\u0943': 'ृ',
    '\u0947': 'े',
    '\u0948': 'ै',
    '\u094B': 'ो',
    '\u094C': 'ौ',
    '\u0902': 'ं',  # Anusvara
    '\u0901': 'ँ',  # Chandrabindu
    '\u0903': 'ः',  # Visarga
    '\u094D': '्'   # Halant
}

# Common Hindi confusable letter groups
HINDI_CONFUSABLES = [
    ({'ि', 'ी'}, 'ि / ी मात्रा'),
    ({'ु', 'ू'}, 'ु / ू मात्रा'),
    ({'े', 'ै'}, 'े / ै मात्रा'),
    ({'ो', 'ौ'}, 'ो / ौ मात्रा'),
    ({'ं', 'ँ'}, 'अनुस्वार / चंद्रबिंदु'),
    ({'श', 'ष', 'स'}, 'श / ष / स अंतर'),
    ({'ब', 'व'}, 'ब / व अंतर'),
    ({'न', 'ण'}, 'न / ण अंतर'),
    ({'ड', 'ढ'}, 'ड / ढ अंतर'),
    ({'द', 'ध'}, 'द / ध अंतर'),
    ({'त', 'थ'}, 'त / थ अंतर'),
    ({'र', 'ड़', 'ढ़'}, 'र / ड़ / ढ़ अंतर'),
    ({'क', 'क़'}, 'क / क़ नुक्ता'),
    ({'ख', 'ख़'}, 'ख / ख़ नुक्ता'),
    ({'ग', 'ग़'}, 'ग / ग़ नुक्ता'),
    ({'ज', 'ज़'}, 'ज / ज़ नुक्ता'),
    ({'फ', 'फ़'}, 'फ / फ़ नुक्ता'),
]


def tokenize_text(text: str, language: str = 'hindi') -> List[str]:
    """
    Tokenizes text into words and punctuation tokens while keeping
    words intact with attached matras or apostrophes.
    """
    if not text:
        return []

    if language.lower() in ('krutidev', 'devlys'):
        # In Kruti Dev, words are whitespace separated strings preserving all keystrokes and Remington codes
        return [t.strip() for t in text.split() if t.strip()]

    # Preserve Devanagari words including viramas, matras, and nuktas
    if language.lower() == 'hindi':
        # Split by whitespace while preserving tokens
        tokens = re.findall(r'[\u0900-\u097F]+|[a-zA-Z0-9]+|[^\s\w\u0900-\u097F]', text)
    else:
        tokens = re.findall(r"[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?|[^\s\w]", text)

    return [t.strip() for t in tokens if t.strip()]


def clean_word_for_similarity(w: str, language: str = 'hindi') -> str:
    """Strip punctuation and whitespace for word content comparison."""
    if language in ('krutidev', 'devlys'):
        return w.replace('¡', 'a').rstrip(',.A"\'').strip()
    return re.sub(r'[^\w\u0900-\u097F]', '', w)


def analyze_hindi_word_difference(official_word: str, student_word: str) -> Tuple[str, str]:
    """
    Analyzes specific phonetic, matra, or character differences between
    official Hindi word and student typed word.
    Returns: (error_type, detailed_explanation)
    """
    if official_word == student_word:
        return ("correct", "बिलकुल सही")

    clean_off = clean_word_for_similarity(official_word)
    clean_stu = clean_word_for_similarity(student_word)

    # Check for pure punctuation error if base words are identical
    if clean_off == clean_stu:
        return ("punctuation", f"विराम चिह्न त्रुटि (अपेक्षित: '{official_word}', आपने टाइप किया: '{student_word}')")

    # Check for Matra / Confusable pairs
    diff_chars = (set(clean_off) - set(clean_stu)) | (set(clean_stu) - set(clean_off))
    for group, name in HINDI_CONFUSABLES:
        # Check if the difference intersects this confusable set
        if diff_chars & group:
            sim = difflib.SequenceMatcher(None, clean_off, clean_stu).ratio()
            min_sim = 0.45 if max(len(clean_off), len(clean_stu)) <= 3 else 0.6
            if sim >= min_sim:
                if 'मात्रा' in name or 'अनुस्वार' in name:
                    return ("matra", f"{name} की अशुद्धि (अपेक्षित: '{official_word}')")
                else:
                    return ("character", f"{name} का भ्रम (अपेक्षित: '{official_word}')")

    # Check for Halant / Half-character error
    if ('्' in clean_off) != ('्' in clean_stu):
        sim = difflib.SequenceMatcher(None, clean_off, clean_stu).ratio()
        if sim >= 0.65:
            return ("character", f"आधे अक्षर / हलंत की अशुद्धि (अपेक्षित: '{official_word}')")

    # Similarity check: if high similarity, it is a spelling / letter error
    similarity = difflib.SequenceMatcher(None, clean_off, clean_stu).ratio()
    if similarity >= 0.7:
        return ("spelling", f"वर्तनी त्रुटि (सटीक शब्द: '{official_word}')")
    elif similarity >= 0.4:
        return ("wrong", f"गलत शब्द (अपेक्षित शब्द: '{official_word}')")
    else:
        return ("wrong", f"भिन्न शब्द (अपेक्षित शब्द: '{official_word}')")


def align_tokens_dp(official_tokens: List[str], student_tokens: List[str], language: str = 'hindi') -> List[Dict[str, Any]]:
    """
    Needleman-Wunsch / Levenshtein Dynamic Programming Sequence Alignment
    to align official and student token sequences globally.
    Prevents offset drift when tokens are omitted or inserted.
    """
    n = len(official_tokens)
    m = len(student_tokens)

    # DP cost matrix
    # dp[i][j] = (min_cost, operation)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]

    # Scoring constants
    MATCH_COST = 0.0
    INSERTION_COST = 1.0   # Student inserted extra word
    DELETION_COST = 1.0    # Student missed a word

    for i in range(1, n + 1):
        dp[i][0] = i * DELETION_COST
    for j in range(1, m + 1):
        dp[0][j] = j * INSERTION_COST

    def token_diff_cost(t1: str, t2: str) -> float:
        if t1 == t2:
            return MATCH_COST
        if language in ('krutidev', 'devlys'):
            n1 = t1.replace('¡', 'a').rstrip(',.A"\'')
            n2 = t2.replace('¡', 'a').rstrip(',.A"\'')
            if n1 == n2:
                return 0.1  # Punctuation or Chandrabindu tolerance
            if n1.replace('+', '') == n2.replace('+', ''):
                return 0.2  # Nukta difference
            ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
            return 1.0 - (ratio * 0.7)

        c1 = clean_word_for_similarity(t1, language)
        c2 = clean_word_for_similarity(t2, language)
        if c1 == c2:
            return 0.3  # Punctuation difference only
        # Word similarity
        ratio = difflib.SequenceMatcher(None, c1, c2).ratio()
        return 1.0 - (ratio * 0.7)  # Higher similarity = lower substitution cost

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub_cost = dp[i - 1][j - 1] + token_diff_cost(official_tokens[i - 1], student_tokens[j - 1])
            del_cost = dp[i - 1][j] + DELETION_COST
            ins_cost = dp[i][j - 1] + INSERTION_COST

            dp[i][j] = min(sub_cost, del_cost, ins_cost)

    # Backtracking to build aligned token sequence
    aligned = []
    i = n
    j = m

    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sub_cost = token_diff_cost(official_tokens[i - 1], student_tokens[j - 1])
            if abs(dp[i][j] - (dp[i - 1][j - 1] + sub_cost)) < 1e-5:
                off_t = official_tokens[i - 1]
                stu_t = student_tokens[j - 1]

                if off_t == stu_t:
                    aligned.append({
                        "status": "correct",
                        "official": off_t,
                        "student": stu_t,
                        "error_type": "none",
                        "detail": "बिल्कुल सही" if language in ('hindi', 'krutidev', 'devlys') else "Exact match"
                    })
                elif language in ('krutidev', 'devlys') and off_t.replace('¡', 'a').rstrip(',.A"\'') == stu_t.replace('¡', 'a').rstrip(',.A"\''):
                    aligned.append({
                        "status": "correct",
                        "official": off_t,
                        "student": stu_t,
                        "error_type": "none",
                        "detail": "बिल्कुल सही"
                    })
                elif language in ('krutidev', 'devlys') and off_t.replace('+', '').replace('¡', 'a').rstrip(',.A"\'') == stu_t.replace('+', '').replace('¡', 'a').rstrip(',.A"\''):
                    aligned.append({
                        "status": "wrong",
                        "official": off_t,
                        "student": stu_t,
                        "error_type": "character",
                        "detail": f"नुक्ता (+) अंतर (अपेक्षित: '{off_t}')"
                    })
                else:
                    if language in ('krutidev', 'devlys'):
                        ratio = difflib.SequenceMatcher(None, off_t, stu_t).ratio()
                        import hindi_converter
                        off_u = hindi_converter.kruti_dev_to_unicode(off_t)
                        stu_u = hindi_converter.kruti_dev_to_unicode(stu_t)
                        if off_u == stu_u:
                            err_type = "matra"
                            detail = f"कीस्ट्रोक अशुद्धि (अपेक्षित: '{off_t}' [{off_u}])"
                        elif ratio >= 0.7:
                            err_type = "spelling"
                            detail = f"वर्तनी त्रुटि (अपेक्षित: '{off_t}' [{off_u}])"
                        else:
                            err_type = "wrong"
                            detail = f"गलत शब्द (अपेक्षित: '{off_t}' [{off_u}])"
                    elif language == 'hindi':
                        err_type, detail = analyze_hindi_word_difference(off_t, stu_t)
                    else:
                        c1 = clean_word_for_similarity(off_t, language).lower()
                        c2 = clean_word_for_similarity(stu_t, language).lower()
                        if c1 == c2:
                            err_type = "punctuation"
                            detail = f"Punctuation error (Expected '{off_t}')"
                        elif difflib.SequenceMatcher(None, c1, c2).ratio() >= 0.7:
                            err_type = "spelling"
                            detail = f"Spelling error (Expected '{off_t}')"
                        else:
                            err_type = "wrong"
                            detail = f"Wrong word (Expected '{off_t}')"

                    aligned.append({
                        "status": "wrong",
                        "official": off_t,
                        "student": stu_t,
                        "error_type": err_type,
                        "detail": detail
                    })
                i -= 1
                j -= 1
                continue

        if i > 0 and (j == 0 or abs(dp[i][j] - (dp[i - 1][j] + DELETION_COST)) < 1e-5):
            # Missing token (present in official, skipped by student)
            off_val = official_tokens[i - 1]
            if not clean_word_for_similarity(off_val):
                aligned.append({
                    "status": "wrong",
                    "official": off_val,
                    "student": "",
                    "error_type": "punctuation",
                    "detail": f"विराम चिह्न छूटा (अपेक्षित: '{off_val}')" if language == 'hindi' else f"Missing punctuation (Expected: '{off_val}')"
                })
            else:
                aligned.append({
                    "status": "missing",
                    "official": off_val,
                    "student": "",
                    "error_type": "missing",
                    "detail": f"छूटा हुआ शब्द (अपेक्षित: '{off_val}')" if language == 'hindi' else f"Missing word (Expected: '{off_val}')"
                })
            i -= 1
        else:
            # Extra token (typed by student, not in official)
            stu_val = student_tokens[j - 1]
            if not clean_word_for_similarity(stu_val):
                aligned.append({
                    "status": "wrong",
                    "official": "",
                    "student": stu_val,
                    "error_type": "punctuation",
                    "detail": f"अनावश्यक विराम चिह्न ('{stu_val}')" if language == 'hindi' else f"Unnecessary punctuation ('{stu_val}')"
                })
            else:
                aligned.append({
                    "status": "extra",
                    "official": "",
                    "student": stu_val,
                    "error_type": "extra",
                    "detail": f"अतिरिक्त शब्द ('{stu_val}')" if language == 'hindi' else f"Extra word ('{stu_val}')"
                })
            j -= 1

    aligned.reverse()
    return aligned


def generate_linguistic_suggestions(aligned_tokens: List[Dict[str, Any]], language: str = 'hindi') -> List[Dict[str, str]]:
    """
    Generates non-penalizing language & grammar suggestions from the student's text.
    These are recommendations, not deducted marks.
    """
    suggestions = []
    seen = set()

    for item in aligned_tokens:
        err = item.get("error_type")
        stu = item.get("student")
        off = item.get("official")

        if err in ["matra", "character", "spelling"] and stu and off:
            key = f"{stu}->{off}"
            if key not in seen and len(suggestions) < 6:
                seen.add(key)
                if language == 'hindi':
                    if err == "matra":
                        title = "संभावित मात्रा सुझाव"
                        desc = f"'{stu}' के स्थान पर मानक रूप '{off}' का उपयोग करने का अभ्यास करें।"
                    elif err == "character":
                        title = "संभावित वर्ण चयन सुझाव"
                        desc = f"'{stu}' में वर्ण भ्रम है, परीक्षा में मानक रूप '{off}' मान्य है।"
                    else:
                        title = "संभावित वर्तनी सुझाव"
                        desc = f"'{stu}' की मानक शुद्ध वर्तनी '{off}' है।"
                else:
                    title = "Spelling / Style Suggestion"
                    desc = f"Consider using '{off}' instead of '{stu}' for standardized evaluation."

                suggestions.append({
                    "title": title,
                    "description": desc,
                    "student_word": stu,
                    "recommended_word": off,
                    "type": err
                })

    return suggestions


def analyze_weak_areas(error_counts: Dict[str, int], total_words: int, language: str = 'hindi') -> List[Dict[str, Any]]:
    """
    Analyzes student error patterns and generates dynamic weak-area diagnostics
    with severity and targeted recommendations.
    """
    weak_areas = []

    matra_err = error_counts.get("matra", 0)
    spelling_err = error_counts.get("spelling", 0)
    missing_err = error_counts.get("missing", 0)
    extra_err = error_counts.get("extra", 0)
    wrong_err = error_counts.get("wrong", 0)
    punct_err = error_counts.get("punctuation", 0)
    char_err = error_counts.get("character", 0)

    # Matra Mistakes
    if matra_err > 0:
        severity = "High" if matra_err >= 4 else ("Medium" if matra_err >= 2 else "Low")
        rec = "ि/ी तथा ु/ू के अंतर पर विशेष ध्यान दें। धीमी गति से श्रुतलेख लिखने का अभ्यास करें।" if language == 'hindi' else "Pay attention to vowel accents and spelling patterns."
        weak_areas.append({
            "topic": "मात्रा अशुद्धि (Matra Mistakes)" if language == 'hindi' else "Vowel / Accent Errors",
            "count": matra_err,
            "severity": severity,
            "recommendation": rec
        })

    # Character confusion
    if char_err > 0:
        severity = "High" if char_err >= 3 else "Medium"
        rec = "श/ष/स, ब/व और न/ण के सही कुंजी संयोजन का बार-बार अभ्यास करें।" if language == 'hindi' else "Review confusable consonant letter keystrokes."
        weak_areas.append({
            "topic": "वर्ण भेद भ्रम (Confusable Letters)" if language == 'hindi' else "Confusable Characters",
            "count": char_err,
            "severity": severity,
            "recommendation": rec
        })

    # Missing Words (Omissions)
    if missing_err > 0:
        severity = "High" if missing_err >= 4 else ("Medium" if missing_err >= 2 else "Low")
        rec = "श्रवण गति में सुधार करें। गति को 0.75x पर रखकर डिक्टेशन पकड़ने की क्षमता बढ़ाएं।" if language == 'hindi' else "Practice at 0.75x speed to reduce audio listening omissions."
        weak_areas.append({
            "topic": "छूटे हुए शब्द (Omission / Missing Words)",
            "count": missing_err,
            "severity": severity,
            "recommendation": rec
        })

    # Wrong / Substitutions
    if wrong_err > 0:
        severity = "High" if wrong_err >= 5 else "Medium"
        rec = "स्टेनो आउटलाइन को सावधानीपूर्वक पढ़ें ताकि शब्द प्रतिस्थापन से बचा जा सके।" if language == 'hindi' else "Carefully transcribe shorthand outlines to prevent word substitutions."
        weak_areas.append({
            "topic": "गलत शब्द (Substitutions)",
            "count": wrong_err,
            "severity": severity,
            "recommendation": rec
        })

    # Extra words
    if extra_err > 0:
        severity = "Medium" if extra_err >= 3 else "Low"
        weak_areas.append({
            "topic": "अतिरिक्त शब्द (Unnecessary Additions)",
            "count": extra_err,
            "severity": severity,
            "recommendation": "अनुमान से शब्द न जोड़ें, केवल उच्चारित ऑडियो का ही प्रतिलेखन करें।" if language == 'hindi' else "Transcribe strictly what was spoken without guessing."
        })

    # Punctuation
    if punct_err > 0:
        severity = "Medium" if punct_err >= 4 else "Low"
        weak_areas.append({
            "topic": "विराम चिह्न (Punctuation Errors)",
            "count": punct_err,
            "severity": severity,
            "recommendation": "पूर्ण विराम (।), कॉमा (,) के उपयोग की सही समझ विकसित करें।" if language == 'hindi' else "Review proper punctuation placement and capitalization."
        })

    # If no major errors
    if not weak_areas:
        weak_areas.append({
            "topic": "उत्कृष्ट प्रदर्शन (Consistent Accuracy)",
            "count": 0,
            "severity": "Low",
            "recommendation": "आपकी सटीकता बहुत अच्छी है! अब गति (Target WPM) बढ़ाने का अभ्यास करें।" if language == 'hindi' else "Great accuracy! Keep pushing for higher WPM."
        })

    # Sort by severity
    sev_order = {"High": 0, "Medium": 1, "Low": 2}
    weak_areas.sort(key=lambda x: sev_order.get(x["severity"], 3))
    return weak_areas


def evaluate_practice_attempt(
    official_text: str,
    student_text: str,
    time_taken_seconds: int,
    language: str = 'hindi',
    scoring_mode: str = 'standard',
    scoring_config: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Main evaluation pipeline:
    1. Normalizes texts
    2. Tokenizes
    3. DP Sequence Alignment
    4. Categorizes errors
    5. Calculates Gross WPM, Net WPM, Accuracy, Error Rate
    6. Generates side-by-side comparison, error table, weak areas & suggestions
    """
    # 1. Normalize both passages
    norm_official = normalize_for_comparison(official_text, language)
    norm_student = normalize_for_comparison(student_text, language)

    # 2. Tokenize into individual words & symbols
    official_tokens = tokenize_text(norm_official, language)
    student_tokens = tokenize_text(norm_student, language)

    # 3. Dynamic Programming token sequence alignment
    aligned_tokens = align_tokens_dp(official_tokens, student_tokens, language)

    # 4. Count error categories
    total_official_tokens = len(official_tokens)
    total_student_tokens = len(student_tokens)

    correct_count = 0
    wrong_count = 0
    missing_count = 0
    extra_count = 0
    matra_count = 0
    char_count = 0
    spelling_count = 0
    punct_count = 0

    error_table = []
    error_idx = 1

    for token in aligned_tokens:
        status = token["status"]
        err_type = token["error_type"]
        off_val = token["official"]
        stu_val = token["student"]
        detail = token["detail"]

        if status == "correct":
            correct_count += 1
        elif status == "missing":
            missing_count += 1
            error_table.append({
                "id": error_idx,
                "your_text": "—",
                "correct_text": off_val,
                "error_type": "Missing Word (छूटा हुआ)",
                "category": "missing",
                "detail": detail
            })
            error_idx += 1
        elif status == "extra":
            extra_count += 1
            error_table.append({
                "id": error_idx,
                "your_text": stu_val,
                "correct_text": "—",
                "error_type": "Extra Word (अतिरिक्त)",
                "category": "extra",
                "detail": detail
            })
            error_idx += 1
        else:
            # Substitution / Variation
            if err_type == "matra":
                matra_count += 1
                cat_label = "Matra Error (मात्रा)"
            elif err_type == "character":
                char_count += 1
                cat_label = "Letter Error (वर्ण भेद)"
            elif err_type == "spelling":
                spelling_count += 1
                cat_label = "Spelling (वर्तनी)"
            elif err_type == "punctuation":
                punct_count += 1
                cat_label = "Punctuation (विराम चिह्न)"
            else:
                wrong_count += 1
                cat_label = "Wrong Word (गलत शब्द)"

            error_table.append({
                "id": error_idx,
                "your_text": stu_val,
                "correct_text": off_val,
                "error_type": cat_label,
                "category": err_type,
                "detail": detail
            })
            error_idx += 1

    total_errors = missing_count + extra_count + wrong_count + matra_count + char_count + spelling_count + punct_count

    # 5. Calculate Characters & Words
    typed_characters = len(student_text.replace('\n', ' '))
    official_characters = len(official_text.replace('\n', ' '))

    minutes = max(0.1, time_taken_seconds / 60.0)

    # Standard formula: Gross WPM = (Typed Characters / 5) / minutes
    gross_wpm = round((typed_characters / 5.0) / minutes, 1)

    # Scoring Rules:
    # SSC Stenographer Rule:
    # - Full mistake = Omission, Substitution, Addition (Weight 1.0)
    # - Half mistake = Spelling, Punctuation, Matra, Capitalization (Weight 0.5)
    # Court Rule:
    # - Strict: All mistakes penalized at 1.0
    config = scoring_config or {}
    mode = scoring_mode.lower()

    if 'ssc' in mode:
        full_penalty = (missing_count + extra_count + wrong_count) * 1.0
        half_penalty = (matra_count + char_count + spelling_count + punct_count) * 0.5
        weighted_errors = full_penalty + half_penalty
        error_penalty_factor = config.get("ssc_error_factor", 1.0)
    elif 'court' in mode:
        weighted_errors = float(total_errors)
        error_penalty_factor = config.get("court_error_factor", 1.2)
    else:
        # Standard
        full_penalty = (missing_count + extra_count + wrong_count) * 1.0
        half_penalty = (matra_count + char_count + spelling_count + punct_count) * 0.5
        weighted_errors = full_penalty + half_penalty
        error_penalty_factor = 1.0

    # Net WPM = max(0, Gross WPM - (Penalty Errors / Minutes))
    wpm_deduction = round((weighted_errors * error_penalty_factor) / minutes, 1)
    net_wpm = max(0.0, round(gross_wpm - wpm_deduction, 1))

    # Accuracy percentage: Max(0, (1 - (Weighted Errors / Total Official Words)) * 100)
    denom = max(1, total_official_tokens)
    accuracy = max(0.0, min(100.0, round((1.0 - (weighted_errors / denom)) * 100.0, 1)))

    # Error Rate percentage
    error_rate = round(min(100.0, (weighted_errors / denom) * 100.0), 1)

    # Spelling Accuracy
    non_spelling_words = max(1, total_student_tokens)
    spelling_errors = matra_count + char_count + spelling_count
    spelling_accuracy = max(0.0, min(100.0, round((1.0 - (spelling_errors / non_spelling_words)) * 100.0, 1)))

    # Error breakdown counts dictionary
    error_counts = {
        "wrong": wrong_count,
        "missing": missing_count,
        "extra": extra_count,
        "matra": matra_count,
        "character": char_count,
        "spelling": spelling_count,
        "punctuation": punct_count,
        "total": total_errors,
        "weighted": round(weighted_errors, 1)
    }

    # 6. Weak area diagnostics
    weak_areas = analyze_weak_areas(error_counts, total_official_tokens, language)

    # 7. Grammar & Linguistic suggestions
    suggestions = generate_linguistic_suggestions(aligned_tokens, language)

    return {
        "metrics": {
            "gross_wpm": gross_wpm,
            "net_wpm": net_wpm,
            "accuracy": accuracy,
            "spelling_accuracy": spelling_accuracy,
            "error_rate": error_rate,
            "time_taken_seconds": time_taken_seconds,
            "time_formatted": f"{int(time_taken_seconds // 60):02d}:{int(time_taken_seconds % 60):02d}",
            "total_words_official": total_official_tokens,
            "total_words_typed": total_student_tokens,
            "typed_characters": typed_characters,
            "correct_words": correct_count,
            "total_errors": total_errors,
            "weighted_errors": round(weighted_errors, 1)
        },
        "error_counts": error_counts,
        "aligned_tokens": aligned_tokens,
        "error_table": error_table,
        "weak_areas": weak_areas,
        "suggestions": suggestions,
        "official_text": official_text,
        "student_text": student_text,
        "normalized_student_text": norm_student
    }
