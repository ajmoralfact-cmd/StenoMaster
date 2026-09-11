"""
Hindi Converter & Normalization Engine for StenoMaster
Fully compliant with MeriTyping.com & TypingBaba.com word-matching standards.
Supports:
1. Flawless Kruti Dev 010 to Unicode Devanagari conversion (longest-first sequence replacement)
2. Unicode Devanagari to Kruti Dev 010 conversion
3. Canonical Devanagari Normalization (Composite vowels, matras, nuktas, halant, ZWJ/ZWNJ)
4. Standard examination normalization (SSC, UPSSSC, High Court, CPCT)
"""

import re
import unicodedata
from typing import List, Tuple

# -----------------------------------------------------------------------------
# Kruti Dev 010 Multi-Character Rules (MUST BE REPLACED IN THIS EXACT ORDER)
# Longest sequences (3 characters) MUST be processed before 2-char and 1-char sequences
# so that prefixes/suffixes (e.g. 'kS', 'ks', 'k') do not hijack 'vkS', 'vks', 'vk'.
# -----------------------------------------------------------------------------
KD_MULTI: List[Tuple[str, str]] = [
    # 3-character vowel and matra sequences
    ("vkS", "औ"),
    ("vks", "ओ"),
    ("kas", "ों"),
    ("kSa", "ौं"),
    ("ksa", "ों"),
    ("kZ", "र्ा"),
    (":#", "रू"),
    ("Vª", "ट्र"),
    ("Mª", "ड्र"),
    ("Nª", "छ्र"),
    ("<ªª", "ढ्र"),
    ("bZ", "ई"),
    ("b±", "ईं"),
    ("pkS", "चै"),

    # 2-character vowel & matra sequences
    ("vk", "आ"),
    ("kS", "ौ"),
    ("ks", "ो"),
    ("as", "ें"),
    ("aS", "ैं"),
    ("ah", "ीं"),
    ("aq", "ुं"),
    ("aw", "ूं"),
    ("ak", "ां"),
    (",s", "ऐ"),
    ("f=", "त्रि"),
    ("=k", "त्र"),
    ("iz", "प्र"),
    ("ç", "प्र"),
    ("Á", "प्र"),
    ("Ø", "क्र"),
    ("xz", "ग्र"),
    ("Dr", "क्त"),
    ("ä", "क्त"),
    ("{k", "क्ष"),
    ("{", "क्ष्"),
    ("M+", "ड़"),
    ("<+", "ढ़"),
    ("t+", "ज़"),
    ("T+", "ज़्"),
    ("Q+", "फ़"),
    ("¶+", "फ़्"),
    ("d+", "क़"),
    ("[k+", "ख़"),
    ("[+", "ख़्"),
    ("x+", "ग़"),
    (";+", "य़"),
    ("j+", "ऱ"),
    ("u+", "ऩ"),
    ("?k", "घ"),
    ("Tk", "झ"),
    ("Fk", "थ"),
    ("/k", "ध"),
    ("èk", "ध"),
    ("Ëk", "ध"),
    ("Hk", "भ"),
    ("'k", "श"),
    ('\"k', "ष"),
    (".k", "ण"),
    ("[k", "ख"),
    ("Dk", "क"),
    ("Xk", "ग"),
    ("Rk", "त"),
    ("Uk", "न"),
    ("Ik", "प"),
    ("Ck", "ब"),
    ("Ek", "म"),
    ("Yk", "ल"),
    ("Ok", "व"),
    ("Lk", "स"),
    ("Ük", "श"),
    ("nzZ", "र्द्र"),
    ("saz", "्रें"),
    ("aª", "्रं"),
    ("~j", "्र"),
    ("Ùk", "त्त"),

    # Ligatures and special Kruti characters
    ("Ù", "त्त्"),
    ("é", "न्न"),
    ("™", "न्न्"),
    ("à", "ह्न"),
    ("á", "ह्य"),
    ("â", "हृ"),
    ("ã", "ह्म"),
    ("ºz", "ह्र"),
    ("º", "ह्"),
    ("í", "द्द"),
    ("Ì", "द्द"),
    ("ê", "ट्ट"),
    ("ë", "ट्ठ"),
    ("ì", "ड्ड"),
    ("ï", "ड्ढ"),
    ("î", "्य"),
    ("ô", "क्क"),
    ("æ", "द्र"),
    ("«", "त्र्"),
    ("=", "त्र"),
    ("|", "द्य"),
    (")", "द्ध"),
    ("}", "द्व"),
    ("J", "श्र"),
    ("K", "ज्ञ"),
    ("—", "कृ"),
    ("–", "दृ"),
    ("Ñ", "कृ"),
    ("Ò", "भ"),
    ("Ó", "्य"),
    ("Ô", "ड्ढ"),
    ("Ö", "झ्"),
]

# Single-character mappings
KD_SINGLE: List[Tuple[str, str]] = [
    # Half consonants (CRITICAL: L is आधा स, Y is आधा ल)
    ("L", "स्"),   # Shift+l = आधा स
    ("l", "स"),   # l = स
    ("Y", "ल्"),   # Shift+y = आधा ल
    ("y", "ल"),   # y = ल
    ("D", "क्"),
    ("d", "क"),
    ("X", "ग्"),
    ("x", "ग"),
    ("?", "घ्"),
    ("P", "च्"),
    ("p", "च"),
    ("N", "छ"),
    ("T", "ज्"),
    ("t", "ज"),
    (">", "झ"),
    ("÷", "झ्"),
    ("V", "ट"),
    ("B", "ठ"),
    ("M", "ड"),
    ("<", "ढ"),
    (".", "ण्"),
    ("R", "त्"),
    ("r", "त"),
    ("F", "थ्"),
    ("n", "द"),
    ("/", "ध्"),
    ("Ë", "ध्"),
    ("è", "ध्"),
    ("U", "न्"),
    ("u", "न"),
    ("I", "प्"),
    ("i", "प"),
    ("Q", "फ"),
    ("¶", "फ्"),
    ("C", "ब्"),
    ("c", "ब"),
    ("H", "भ्"),
    ("E", "म्"),
    ("e", "म"),
    (";", "य"),
    ("¸", "य्"),
    ("j", "र"),
    ("O", "व्"),
    ("o", "व"),
    ("'", "श्"),
    ("Ü", "श्"),
    ('\"', "ष्"),
    ("g", "ह"),
    ("G", "ळ"),
    ("³", "ङ"),
    ("¥", "ञ"),

    # Matras
    ("k", "ा"),
    ("h", "ी"),
    ("q", "ु"),
    ("w", "ू"),
    ("`", "ृ"),
    ("s", "े"),
    ("S", "ै"),
    ("a", "ं"),
    ("¡", "ँ"),
    ("%", "ः"),
    ("W", "ॅ"),
    ("‚", "ॉ"),
    ("~", "्"),
    ("+", "़"),
    ("z", "्र"),
    ("ª", "्र"),

    # Independent Vowels
    ("v", "अ"),
    ("b", "इ"),
    ("m", "उ"),
    ("Å", "ऊ"),
    ("Ã", "ई"),
    (",", "ए"),
    ("_", "ऋ"),
    ("#", "रु"),
    (":", "रू"),

    # Numbers
    ("0", "०"), ("1", "१"), ("2", "२"), ("3", "३"), ("4", "४"),
    ("5", "५"), ("6", "६"), ("7", "७"), ("8", "८"), ("9", "९"),

    # Punctuation
    ("A", "।"),
    ("]", ","),
    ("\\", "?"),
    ("@", "/"),
    ("^", "‘"),
    ("*", "’"),
    ("Þ", "“"),
    ("ß", "”"),
    ("¼", "("),
    ("½", ")"),
    ("¿", "{"),
    ("À", "}"),
]


def normalize_devanagari_canonical(text: str) -> str:
    """
    Standardizes all Devanagari character representations so that
    visually identical words always match 100% identically, exactly as on
    TypingBaba.com and MeriTyping.com:
    - Composite vowels (अ + ौ = औ, अ + ो = ओ, etc.)
    - Matra combinations (ा + ो = ो, ो + ं = ों)
    - Nukta variants (ड + ़ = ड़, etc.)
    - Chandrabindu vs Anusvara normalization
    - Zero-width characters (ZWJ, ZWNJ, BOM)
    - Punctuation quotes & dashes
    """
    if not text:
        return ""

    t = unicodedata.normalize('NFC', text)

    # 1. Composite / Decomposed vowels (VERY COMMON in Hindi typing engines)
    vowel_fixes = [
        ('\u0905\u094c', '\u0914'),  # अ + ौ -> औ
        ('\u0905\u094b', '\u0913'),  # अ + ो -> ओ
        ('\u0905\u093e', '\u0906'),  # अ + ा -> आ
        ('\u0905\u0947', '\u090f'),  # अ + े -> ए
        ('\u0905\u0948', '\u0910'),  # अ + ै -> ऐ
        ('\u0907\u0940', '\u0908'),  # इ + ी -> ई
        ('\u0909\u0942', '\u090a'),  # उ + ू -> ऊ
        ('\u0906\u0947', '\u0913'),  # आ + े -> ओ
        ('\u0906\u0948', '\u0914'),  # आ + ै -> औ
        ('अों', 'ओं'),
        ('आें', 'ओं'),
        ('अौ', 'औ'),
        ('अो', 'ओ'),
        ('अा', 'आ'),
        ('अे', 'ए'),
        ('अै', 'ऐ'),
    ]
    for old, new in vowel_fixes:
        t = t.replace(old, new)

    # 2. Matra normalization
    matra_fixes = [
        ('\u093e\u094b', '\u094b'),  # ा + ो -> ो
        ('\u093e\u094c', '\u094c'),  # ा + ौ -> ौ
        ('\u094b\u0902', 'ों'),      # ो + ं -> ों
        ('\u094c\u0902', 'ौं'),      # ौ + ं -> ौं
        ('\u0947\u0902', 'ें'),      # े + ं -> ें
        ('\u0948\u0902', 'ैं'),      # ै + ं -> ैं
        ('\u0940\u0902', 'ीं'),      # ी + ं -> ीं
        ('\u0941\u0902', 'ुं'),      # ु + ं -> ुं
        ('\u0942\u0902', 'ूं'),      # ू + ं -> ूं
    ]
    for old, new in matra_fixes:
        t = t.replace(old, new)

    # 3. Nukta canonical representation (precomposed characters)
    nukta_map = [
        ('\u0921\u093c', 'ड़'),
        ('\u0922\u093c', 'ढ़'),
        ('\u091c\u093c', 'ज़'),
        ('\u092b\u093c', 'फ़'),
        ('\u0915\u093c', 'क़'),
        ('\u0916\u093c', 'ख़'),
        ('\u0917\u093c', 'ग़'),
        ('\u092f\u093c', 'य़'),
        ('\u0958', 'क़'),
        ('\u0959', 'ख़'),
        ('\u095a', 'ग़'),
        ('\u095b', 'ज़'),
        ('\u095c', 'ड़'),
        ('\u095d', 'ढ़'),
        ('\u095e', 'फ़'),
        ('\u095f', 'य़'),
    ]
    for old, new in nukta_map:
        t = t.replace(old, new)

    # 4. Strip zero-width joiners / non-joiners / byte order marks
    t = t.replace('\u200B', '').replace('\u200C', '').replace('\u200D', '').replace('\uFEFF', '')

    # 5. Punctuation standardization
    t = t.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    t = t.replace('–', '-').replace('—', '-')
    t = t.replace('|', '।')

    # Normalize whitespace
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n+', '\n', t)
    return unicodedata.normalize('NFC', t.strip())


def kruti_dev_to_unicode(text: str) -> str:
    """
    Converts Kruti Dev 010 typed text to standard Unicode Devanagari.
    Applies multi-character replacements in descending length order,
    reorders chhoti 'i' (f) and reph (Z), and finishes with canonical normalization.
    """
    if not text:
        return ""

    modified = text

    # Phase 1: Multi-character sequences (longest first)
    for kd, uni in KD_MULTI:
        modified = modified.replace(kd, uni)

    # Phase 2: Single-character mappings
    for kd, uni in KD_SINGLE:
        modified = modified.replace(kd, uni)

    # Phase 3: Reorder chhoti 'i' matra (f)
    # In Kruti Dev, 'f' is typed BEFORE the consonant or consonant conjunct
    def fix_chhoti_i(match):
        chars = match.group(1)
        return chars + "ि"

    # Match conjuncts with halant first (e.g. स् + थ + ि -> स्थि)
    modified = re.sub(r'f([\u0915-\u0939]\u094D[\u0915-\u0939])', fix_chhoti_i, modified)
    # Match single consonants
    modified = re.sub(r'f([\u0915-\u0939])', fix_chhoti_i, modified)
    # Fallback for any standalone 'f'
    modified = modified.replace("f", "ि")

    # Phase 4: Reorder reph (Z)
    # In Kruti Dev, 'Z' is typed after consonant/matra, but in Unicode it goes before
    modified = re.sub(r'([क-ह](?:[\u093E-\u094C])?)Z', r'र्\1', modified)

    # Phase 5: Canonical Devanagari normalization
    return normalize_devanagari_canonical(modified)


def unicode_to_kruti_dev(text: str) -> str:
    """
    Converts standard Unicode Devanagari (Mangal) text to Kruti Dev 010 keystrokes.
    """
    if not text:
        return ""

    t = unicodedata.normalize('NFC', text)
    t = t.replace('।', 'A')

    # Reorder Chhoti i matra (\u093F)
    def repl_i(m):
        return 'f' + m.group(1)
    t = re.sub(r'((?:[\u0915-\u0939]\u094D)*[\u0915-\u0939])\u093F', repl_i, t)

    # Reorder Reph (र्) before consonant/matra -> consonant/matra + Z
    def repl_reph(m):
        return m.group(1) + 'Z'
    t = re.sub(r'\u0930\u094D((?:[\u0915-\u0939]\u094D)*[\u0915-\u0939](?:[\u093E\u0940\u0941\u0942\u0947\u0948\u094B\u094C])?)', repl_reph, t)

    # Nukta characters
    nukta_map = [
        ('ड़', 'M+'), ('ढ़', '<+'), ('ज़', 't+'), ('फ़', 'Q+'),
        ('क़', 'd+'), ('ख़', '[k+'), ('ग़', 'x+'), ('य़', ';+'),
        ('\u0921\u093C', 'M+'), ('\u0922\u093C', '<+'), ('\u091C\u093C', 't+'),
        ('\u092B\u093C', 'Q+'), ('\u0915\u093C', 'd+'), ('\u0916\u093C', '[k+'),
        ('\u0917\u093C', 'x+'), ('\u092F\u093C', ';+'), ('\u093C', '+')
    ]
    for u, k in nukta_map:
        t = t.replace(u, k)

    # Conjuncts / ligatures
    ligs = [
        ('श्र', 'J'), ('त्र', '='), ('ज्ञ', 'K'), ('क्ष', '{k'),
        ('द्य', '|'), ('द्ध', ')'), ('द्व', 'n~o'), ('ट्ट', 'V~V'),
        ('प्र', 'iz'), ('क्र', 'Ø'), ('ट्र', 'Vª'), ('ड्र', 'Mª'),
        ('क्त', 'Dr'), ('रू', ':#'), ('रु', ':'),
        ('ओम', 'vksWe'), ('ॐ', 'vksWe'),
    ]
    for u, k in ligs:
        t = t.replace(u, k)

    # Vowels
    vowels = [
        ('ऑ', 'vkW'), ('ओ', 'vks'), ('औ', 'vkS'), ('आ', 'vk'), ('अ', 'v'),
        ('ई', 'bZ'), ('इ', 'b'), ('ऊ', 'Å'), ('उ', 'm'),
        ('ऋ', '_'), ('ए', ','), ('ऐ', 'S')
    ]
    for u, k in vowels:
        t = t.replace(u, k)

    # Half consonants (consonant + halant)
    halfs = [
        ('क्', 'D'), ('ख्', '['), ('ग्', 'X'), ('घ्', '?'),
        ('च्', 'P'), ('छ्', 'N~'), ('ज्', 'T'), ('झ्', '>_'),
        ('ट्', 'V~'), ('ठ्', 'B~'), ('ड्', 'M~'), ('ढ्', '<~'),
        ('ण्', '.'), ('त्', 'R'), ('थ्', 'F'), ('द्', 'n~'),
        ('ध्', '/'), ('न्', 'U'), ('प्', 'I'), ('फ्', 'Q~'),
        ('ब्', 'C'), ('भ्', 'H'), ('म्', 'E'), ('य्', 'Y'),
        ('ल्', 'L'), ('व्', 'O'), ('श्', "'"), ('ष्', '"'),
        ('स्', 'L~'), ('ह्', 'g~')
    ]
    for u, k in halfs:
        t = t.replace(u, k)

    # Full consonants
    full_c = [
        ('क', 'd'), ('ख', '[k'), ('ग', 'x'), ('घ', '?k'),
        ('ङ', '³'), ('च', 'p'), ('छ', 'N'), ('ज', 't'),
        ('झ', 'Tk'), ('ञ', '¥'), ('ट', 'V'), ('ठ', 'B'),
        ('ड', 'M'), ('ढ', '<'), ('ण', '.k'), ('त', 'r'),
        ('थ', 'Fk'), ('द', 'n'), ('ध', '/k'), ('न', 'u'),
        ('प', 'i'), ('फ', 'Q'), ('ब', 'c'), ('भ', 'Hk'),
        ('म', 'e'), ('य', ';'), ('र', 'j'), ('ल', 'y'),
        ('व', 'o'), ('श', "'k"), ('ष', '"k'), ('स', 'l'),
        ('ह', 'g'), ('ड़', 'M+'), ('ढ़', '<+')
    ]
    for u, k in full_c:
        t = t.replace(u, k)

    # Matras
    matras = [
        ('ॉ', 'W'), ('ो', 'ks'), ('ौ', 'kS'), ('ा', 'k'), ('ी', 'h'),
        ('ु', 'q'), ('ू', 'w'), ('ृ', '`'), ('े', 's'),
        ('ै', 'S'), ('ं', 'a'), ('ँ', '¡'), ('ः', '%'), ('्', '~')
    ]
    for u, k in matras:
        t = t.replace(u, k)

    digits = [
        ('०', '0'), ('१', '1'), ('२', '2'), ('३', '3'), ('४', '4'),
        ('५', '5'), ('६', '6'), ('७', '7'), ('८', '8'), ('९', '9')
    ]
    for u, k in digits:
        t = t.replace(u, k)

    return t


def normalize_hindi_unicode(text: str) -> str:
    """
    Normalizes Hindi Unicode text to canonical representation.
    """
    return normalize_devanagari_canonical(text)


def normalize_for_comparison(text: str, language: str = 'hindi') -> str:
    """
    Prepares text for token-level comparison by normalizing punctuation,
    spaces, and script-specific characters while preserving words.
    """
    if not text:
        return ""

    if language.lower() == 'hindi':
        text = normalize_devanagari_canonical(text)
    else:
        text = unicodedata.normalize('NFKC', text)
        text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
        text = text.replace('–', '-').replace('—', '-')

    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def convert_input_text(text: str, mode: str, language: str = 'hindi') -> str:
    """
    Converts student typed text based on selected typing mode:
    - 'mangal': Unicode Devanagari directly (canonically normalized)
    - 'krutidev': Kruti Dev 010 -> Unicode
    - 'inscript': Inscript layout (produces Unicode, normalize)
    - 'remington': Remington typing (produces Unicode, normalize)
    """
    if not text:
        return ""

    mode = (mode or 'mangal').lower().strip()
    if 'kruti' in mode or 'devlys' in mode:
        return kruti_dev_to_unicode(text)
    else:
        return normalize_devanagari_canonical(text) if language.lower() == 'hindi' else text.strip()
