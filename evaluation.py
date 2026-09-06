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


# Common particles / stopwords in Hindi, English, and Kruti Dev to avoid accidental resynchronization
HINDI_STOPWORDS = {
    'का', 'के', 'की', 'को', 'में', 'पर', 'से', 'है', 'हैं', 'था', 'थी', 'थे',
    'और', 'या', 'तो', 'भी', 'ही', 'ने', 'हो', 'दो', 'दे', 'ना', 'नहीं', 'कर',
    'रहा', 'रही', 'रहे', 'इस', 'उस', 'यह', 'वह', 'जो', 'कि', 'एक'
}

KRUTI_STOPWORDS = {
    'dk', 'ds', 'dh', 'dks', 'esa', 'ij', 'ls', 'gS', 'gSa', 'Fkk', 'Fkh', 'Fks',
    'vkSj', ';k', 'rks', 'Hkh', 'gh', 'us', 'gks', 'nks', 'ns', 'uk', 'ugha', 'dj',
    'jgk', 'jgh', 'jgs', 'bl', 'ml', ';g', 'og', 'tks', 'fd', 'd'
}

ENGLISH_STOPWORDS = {
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is',
    'are', 'was', 'were', 'it', 'be', 'by', 'as', 'with', 'that', 'this'
}


def _is_token_match(t1: str, t2: str, language: str = 'hindi') -> bool:
    """Checks whether two tokens match exactly or are close enough to be considered the same word."""
    if not t1 or not t2:
        return False
    if t1 == t2:
        return True

    if language in ('krutidev', 'devlys'):
        n1 = t1.replace('¡', 'a').rstrip(',.A"\'')
        n2 = t2.replace('¡', 'a').rstrip(',.A"\'')
        if n1 == n2:
            return True
        if n1.replace('+', '') == n2.replace('+', ''):
            return True
        return difflib.SequenceMatcher(None, n1, n2).ratio() >= 0.82

    c1 = clean_word_for_similarity(t1, language)
    c2 = clean_word_for_similarity(t2, language)
    if not c1 or not c2:
        return t1 == t2
    if c1 == c2:
        return True
    if language == 'hindi':
        import hindi_converter
        norm1 = hindi_converter.normalize_hindi_unicode(c1)
        norm2 = hindi_converter.normalize_hindi_unicode(c2)
        if norm1 == norm2:
            return True
        if len(norm1) >= 4 and len(norm2) >= 4:
            return difflib.SequenceMatcher(None, norm1, norm2).ratio() >= 0.82
    else:
        if c1.lower() == c2.lower():
            return True
        if len(c1) >= 4 and len(c2) >= 4:
            return difflib.SequenceMatcher(None, c1.lower(), c2.lower()).ratio() >= 0.82

    return False


def _is_stopword(token: str, language: str = 'hindi') -> bool:
    c = clean_word_for_similarity(token, language).lower()
    if language in ('krutidev', 'devlys'):
        return c in KRUTI_STOPWORDS
    elif language == 'hindi':
        return c in HINDI_STOPWORDS
    else:
        return c in ENGLISH_STOPWORDS


def align_tokens_dp(official_tokens: List[str], student_tokens: List[str], language: str = 'hindi') -> List[Dict[str, Any]]:
    """
    Sequential Word-by-Word Sequence Alignment with Local Resynchronization.
    Matches student typing against official passage tokens strictly in sequence.
    Prevents jumping across distant parts of the passage when common words match.
    """
    return align_tokens_sequential(official_tokens, student_tokens, language)


def align_tokens_sequential(official_tokens: List[str], student_tokens: List[str], language: str = 'hindi') -> List[Dict[str, Any]]:
    """
    Sequential Word-by-Word Alignment Algorithm:
    - Compares student words sequentially word-by-word against official words.
    - Local resynchronization: Checks up to 3 words lookahead for omission or insertion,
      requiring anchor confirmation (next word match or non-stopword content match)
      to completely avoid false jumps on common particles.
    - Untyped passage words appear cleanly at the end as missing words.
    """
    n = len(official_tokens)
    m = len(student_tokens)
    i = 0
    j = 0
    aligned = []
    MAX_LOOKAHEAD = 3

    def build_comparison_item(off_t: str, stu_t: str) -> Dict[str, Any]:
        """Analyzes a word pair at the current sequential position."""
        if off_t == stu_t:
            return {
                "status": "correct",
                "official": off_t,
                "student": stu_t,
                "error_type": "none",
                "detail": "बिल्कुल सही" if language in ('hindi', 'krutidev', 'devlys') else "Exact match"
            }

        if language in ('krutidev', 'devlys'):
            n1 = off_t.replace('¡', 'a').rstrip(',.A"\'')
            n2 = stu_t.replace('¡', 'a').rstrip(',.A"\'')
            if n1 == n2:
                return {
                    "status": "correct",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "none",
                    "detail": "बिल्कुल सही"
                }
            if n1.replace('+', '') == n2.replace('+', ''):
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "character",
                    "detail": f"नुक्ता (+) अंतर (अपेक्षित: '{off_t}')"
                }
            import hindi_converter
            off_u = hindi_converter.kruti_dev_to_unicode(off_t)
            stu_u = hindi_converter.kruti_dev_to_unicode(stu_t)
            ratio = difflib.SequenceMatcher(None, off_t, stu_t).ratio()
            if off_u == stu_u:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "matra",
                    "detail": f"कीस्ट्रोक अशुद्धि (अपेक्षित: '{off_t}' [{off_u}])"
                }
            elif ratio >= 0.7:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "spelling",
                    "detail": f"वर्तनी त्रुटि (अपेक्षित: '{off_t}' [{off_u}])"
                }
            else:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "wrong",
                    "detail": f"गलत शब्द (अपेक्षित: '{off_t}' [{off_u}])"
                }

        elif language == 'hindi':
            err_type, detail = analyze_hindi_word_difference(off_t, stu_t)
            status = "correct" if err_type == "none" else "wrong"
            return {
                "status": status,
                "official": off_t,
                "student": stu_t,
                "error_type": err_type,
                "detail": detail
            }
        else:
            c1 = clean_word_for_similarity(off_t, language).lower()
            c2 = clean_word_for_similarity(stu_t, language).lower()
            if c1 == c2:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "punctuation",
                    "detail": f"Punctuation error (Expected '{off_t}')"
                }
            elif difflib.SequenceMatcher(None, c1, c2).ratio() >= 0.7:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "spelling",
                    "detail": f"Spelling error (Expected '{off_t}')"
                }
            else:
                return {
                    "status": "wrong",
                    "official": off_t,
                    "student": stu_t,
                    "error_type": "wrong",
                    "detail": f"Wrong word (Expected '{off_t}')"
                }

    while i < n and j < m:
        off = official_tokens[i]
        stu = student_tokens[j]

        # 1. Exact or High-Similarity Direct Sequential Match
        if _is_token_match(off, stu, language):
            aligned.append(build_comparison_item(off, stu))
            i += 1
            j += 1
            continue

        # 2. Check Transposition (Adjacent Words Inverted / Swapped)
        if i + 1 < n and j + 1 < m:
            if _is_token_match(official_tokens[i], student_tokens[j + 1], language) and \
               _is_token_match(official_tokens[i + 1], student_tokens[j], language):
                aligned.append({
                    "status": "wrong",
                    "official": official_tokens[i],
                    "student": student_tokens[j],
                    "error_type": "transposition",
                    "detail": f"शब्द क्रम उलट गया (अपेक्षित: '{official_tokens[i]}')" if language == 'hindi' else f"Transposed word (Expected: '{official_tokens[i]}')"
                })
                aligned.append({
                    "status": "wrong",
                    "official": official_tokens[i + 1],
                    "student": student_tokens[j + 1],
                    "error_type": "transposition",
                    "detail": f"शब्द क्रम उलट गया (अपेक्षित: '{official_tokens[i + 1]}')" if language == 'hindi' else f"Transposed word (Expected: '{official_tokens[i + 1]}')"
                })
                i += 2
                j += 2
                continue

        # 3. Check Local Omission (Student skipped 1 to MAX_LOOKAHEAD words in official)
        found_omission = False
        for k in range(1, MAX_LOOKAHEAD + 1):
            if i + k < n and _is_token_match(official_tokens[i + k], stu, language):
                # Anchor confirmation: next word also matches OR it is a non-stopword content word
                has_anchor = False
                if j + 1 < m and i + k + 1 < n and _is_token_match(official_tokens[i + k + 1], student_tokens[j + 1], language):
                    has_anchor = True
                elif not _is_stopword(stu, language) and len(clean_word_for_similarity(stu, language)) >= 4:
                    has_anchor = True

                if has_anchor:
                    for skip_idx in range(i, i + k):
                        off_val = official_tokens[skip_idx]
                        if not clean_word_for_similarity(off_val, language):
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
                    i += k
                    found_omission = True
                    break

        if found_omission:
            continue

        # 4. Check Local Insertion (Student inserted 1 to MAX_LOOKAHEAD extra words)
        found_insertion = False
        for k in range(1, MAX_LOOKAHEAD + 1):
            if j + k < m and _is_token_match(off, student_tokens[j + k], language):
                has_anchor = False
                if j + k + 1 < m and i + 1 < n and _is_token_match(official_tokens[i + 1], student_tokens[j + k + 1], language):
                    has_anchor = True
                elif not _is_stopword(off, language) and len(clean_word_for_similarity(off, language)) >= 4:
                    has_anchor = True

                if has_anchor:
                    for extra_idx in range(j, j + k):
                        stu_val = student_tokens[extra_idx]
                        if not clean_word_for_similarity(stu_val, language):
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
                    j += k
                    found_insertion = True
                    break

        if found_insertion:
            continue

        # 5. Sequential Substitution (Word-by-word mismatch at current position)
        aligned.append(build_comparison_item(off, stu))
        i += 1
        j += 1

    # Remaining student tokens -> Extra words at the end
    while j < m:
        stu_val = student_tokens[j]
        if not clean_word_for_similarity(stu_val, language):
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
        j += 1

    # Remaining official tokens -> Missing / Untyped words at the end
    while i < n:
        off_val = official_tokens[i]
        if not clean_word_for_similarity(off_val, language):
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
        i += 1

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
    scoring_config: Dict[str, Any] = None,
    exam_rule: str = 'ssc_steno'
) -> Dict[str, Any]:
    """
    Main evaluation pipeline:
    1. Normalizes texts
    2. Tokenizes
    3. DP Sequence Alignment
    4. Categorizes errors (Full vs Half mistakes)
    5. Calculates Gross WPM, Net WPM, Accuracy, Error Rate
    6. Applies Exam-Specific Qualifying Rules (SSC Stenographer vs UPSSSC Skill Test)
    7. Generates side-by-side comparison, error table, weak areas & suggestions
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

    # -------------------------------------------------------------------------
    # Scoring & Exam Rules Engine (SSC Stenographer vs UPSSSC Skill Test)
    # -------------------------------------------------------------------------
    config = scoring_config or {}
    resolved_rule = (exam_rule or scoring_mode or 'ssc_steno').lower().strip()
    if 'upsssc' in resolved_rule:
        exam_key = 'upsssc'
    elif 'court' in resolved_rule:
        exam_key = 'court'
    elif 'standard' in resolved_rule:
        exam_key = 'standard'
    else:
        exam_key = 'ssc_steno'

    # Error definitions common across Indian Steno examinations:
    # Full Mistakes (1.0x): Omission, Substitution, Addition
    full_mistakes = missing_count + extra_count + wrong_count
    # Half Mistakes (0.5x): Matra errors, Character/letter confusions, Spelling errors, Punctuation errors
    half_mistakes = matra_count + char_count + spelling_count + punct_count

    # Weighted errors according to exam
    if exam_key == 'court':
        weighted_errors = float(total_errors)
        error_penalty_factor = float(config.get("court_error_factor", 1.2))
    elif exam_key == 'upsssc':
        # UPSSSC: Full mistake = 1.0, Half mistake = 0.5
        weighted_errors = (full_mistakes * 1.0) + (half_mistakes * 0.5)
        error_penalty_factor = float(config.get("upsssc_error_factor", 1.0))
    else:
        # SSC Stenographer (Default) & Standard:
        weighted_errors = (full_mistakes * 1.0) + (half_mistakes * 0.5)
        error_penalty_factor = float(config.get("ssc_error_factor", 1.0))

    # Net WPM = max(0, Gross WPM - (Penalty Errors / Minutes))
    wpm_deduction = round((weighted_errors * error_penalty_factor) / minutes, 1)
    net_wpm = max(0.0, round(gross_wpm - wpm_deduction, 1))

    # Accuracy percentage: Max(0, (1 - (Weighted Errors / Total Official Words)) * 100)
    denom = max(1, total_official_tokens)
    accuracy = max(0.0, min(100.0, round((1.0 - (weighted_errors / denom)) * 100.0, 1)))

    # Error Rate percentage
    error_rate = round(min(100.0, (weighted_errors / denom) * 100.0), 1)

    # Official Mistake Percentage
    mistake_percent = round((weighted_errors / denom) * 100.0, 2)

    # Spelling Accuracy
    non_spelling_words = max(1, total_student_tokens)
    spelling_errors = matra_count + char_count + spelling_count
    spelling_accuracy = max(0.0, min(100.0, round((1.0 - (spelling_errors / non_spelling_words)) * 100.0, 1)))

    # -------------------------------------------------------------------------
    # Official Qualification Logic: SSC vs UPSSSC
    # -------------------------------------------------------------------------
    # SSC Thresholds
    ssc_c_ur = float(config.get("ssc_grade_c_cutoff_ur", 5.0))
    ssc_c_res = float(config.get("ssc_grade_c_cutoff_res", 7.0))
    ssc_d_ur = float(config.get("ssc_grade_d_cutoff_ur", 7.0))
    ssc_d_res = float(config.get("ssc_grade_d_cutoff_res", 10.0))

    ssc_eval = {
        "grade_c_ur": {"cutoff": ssc_c_ur, "is_qualified": mistake_percent <= ssc_c_ur},
        "grade_c_res": {"cutoff": ssc_c_res, "is_qualified": mistake_percent <= ssc_c_res},
        "grade_d_ur": {"cutoff": ssc_d_ur, "is_qualified": mistake_percent <= ssc_d_ur},
        "grade_d_res": {"cutoff": ssc_d_res, "is_qualified": mistake_percent <= ssc_d_res},
        "is_qualified_any": mistake_percent <= max(ssc_c_res, ssc_d_res)
    }

    # UPSSSC Thresholds
    upsssc_min_wpm = float(config.get("upsssc_min_wpm_hindi", 25.0) if language == 'hindi' else config.get("upsssc_min_wpm_english", 30.0))
    upsssc_max_err = float(config.get("upsssc_max_error_percent", 5.0))

    upsssc_speed_ok = net_wpm >= upsssc_min_wpm
    upsssc_err_ok = mistake_percent <= upsssc_max_err
    upsssc_is_qualified = upsssc_speed_ok and upsssc_err_ok

    if upsssc_is_qualified:
        upsssc_reason = f"बधाई! आपकी नेट गति ({net_wpm} WPM) न्यूनतम आवश्यक {upsssc_min_wpm} WPM से अधिक है और त्रुटियां ({mistake_percent}%) अनुमन्य सीमा ({upsssc_max_err}%) के भीतर हैं।"
    elif not upsssc_speed_ok and not upsssc_err_ok:
        upsssc_reason = f"गति ({net_wpm} WPM < {upsssc_min_wpm} WPM) और त्रुटियां ({mistake_percent}% > {upsssc_max_err}%) दोनों मानक पर खरे नहीं उतरे।"
    elif not upsssc_speed_ok:
        upsssc_reason = f"गति अपर्याप्त है। आपकी नेट गति {net_wpm} WPM है जबकि न्यूनतम {upsssc_min_wpm} WPM आवश्यक है।"
    else:
        upsssc_reason = f"त्रुटियां अनुमन्य सीमा से अधिक हैं ({mistake_percent}% > {upsssc_max_err}%)।"

    upsssc_eval = {
        "required_wpm": upsssc_min_wpm,
        "achieved_wpm": net_wpm,
        "speed_qualified": upsssc_speed_ok,
        "max_mistake_percent": upsssc_max_err,
        "achieved_mistake_percent": mistake_percent,
        "mistake_qualified": upsssc_err_ok,
        "is_qualified": upsssc_is_qualified,
        "verdict": "सफल (QUALIFIED)" if upsssc_is_qualified else "असफल (NOT QUALIFIED)",
        "status_reason": upsssc_reason
    }

    exam_summary = {
        "active_rule": exam_key,
        "rule_title": "UPSSSC Skill Test (आशुलिपिक / कनिष्ठ सहायक)" if exam_key == 'upsssc' else ("High Court Strict Mode" if exam_key == 'court' else "SSC Stenographer Grade C & D"),
        "total_official_words": total_official_tokens,
        "total_words_typed": total_student_tokens,
        "full_mistakes": full_mistakes,
        "half_mistakes": half_mistakes,
        "total_equivalent_mistakes": round(weighted_errors, 2),
        "mistake_percent": mistake_percent,
        "ssc": ssc_eval,
        "upsssc": upsssc_eval
    }

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
            "mistake_percent": mistake_percent,
            "time_taken_seconds": time_taken_seconds,
            "time_formatted": f"{int(time_taken_seconds // 60):02d}:{int(time_taken_seconds % 60):02d}",
            "total_words_official": total_official_tokens,
            "total_words_typed": total_student_tokens,
            "typed_characters": typed_characters,
            "correct_words": correct_count,
            "total_errors": total_errors,
            "weighted_errors": round(weighted_errors, 1)
        },
        "exam_rule": exam_key,
        "exam_summary": exam_summary,
        "error_counts": error_counts,
        "aligned_tokens": aligned_tokens,
        "error_table": error_table,
        "weak_areas": weak_areas,
        "suggestions": suggestions,
        "official_text": official_text,
        "student_text": student_text,
        "normalized_student_text": norm_student
    }
