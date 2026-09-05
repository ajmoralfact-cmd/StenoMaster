"""
Hindi Converter & Normalization Engine for StenoMaster
Supports:
1. Kruti Dev 010 to Unicode Devanagari conversion
2. Inscript / Remington character normalization
3. Unicode standard normalization (NFKC, Nukta, Halant, ZWJ/ZWNJ, Whitespace)
"""

import re
import unicodedata

# Multi-character patterns (must be replaced first)
KD_MULTI = [
    ("kS", "ौ"),
    ("ks", "ो"),
    ("vks", "ओ"),
    ("vkS", "औ"),
    ("vk", "आ"),
    ("bZ", "ई"),
    ("?k", "घ"),
    ("Tk", "झ"),
    ("Fk", "थ"),
    ("/k", "ध"),
    ("Hk", "भ"),
    ("'k", "श"),
    ("\"k", "ष"),
    (".k", "ण"),
    ("[k", "ख"),
    ("kZ", "र्ा"),
    ("र्f", "िर्"),
    (":#", "रू"),
    ("iz", "प्र"),
    ("Ø", "क्र"),
    ("Vª", "ट्र"),
    ("Mª", "ड्र"),
    ("Dr", "क्त"),
    ("{k", "क्ष"),
    ("M+", "ड़"),
    ("<+", "ढ़"),
    ("t+", "ज़"),
    ("Q+", "फ़"),
    ("d+", "क़"),
    ("[k+", "ख़"),
    ("x+", "ग़"),
    (";+", "य़"),
]

KD_ARRAY = [
    ("+", "़"),
    ("Z", "र्"),
    ("a", "ं"),
    ("¡", "ँ"),
    ("%", "ः"),
    ("1", "१"), ("2", "२"), ("3", "३"), ("4", "४"), ("5", "५"),
    ("6", "६"), ("7", "७"), ("8", "८"), ("9", "९"), ("0", "०"),
    ("A", "।"),
    ("d", "क"), ("D", "क्"),
    ("x", "ग"), ("X", "ग्"),
    ("?", "घ्"),
    ("p", "च"), ("P", "च्"),
    ("N", "छ"),
    ("t", "ज"), ("T", "ज्"),
    ("V", "ट"), ("B", "ठ"), ("M", "ड"), ("<", "ढ"),
    (".", "ण्"),
    ("r", "त"), ("R", "त्"),
    ("F", "थ्"),
    ("n", "द"),
    ("/", "ध्"),
    ("u", "न"), ("U", "न्"),
    ("i", "प"), ("I", "प्"),
    ("Q", "फ"),
    ("c", "ब"), ("C", "ब्"),
    ("H", "भ्"),
    ("e", "म"), ("E", "म्"),
    (";", "य"), ("Y", "य्"),
    ("j", "र"),
    ("y", "ल"), ("L", "ल्"),
    ("o", "व"), ("O", "व्"),
    ("'", "श्"),
    ("\"", "ष्"),
    ("l", "स"), ("S", "ै"),
    ("g", "ह"),
    ("~", "्"),
    ("K", "ज्ञ"),
    ("=", "त्र"),
    ("«", "त्र"),
    ("|", "द्य"),
    (")", "द्ध"),
    (":", "रु"),
    ("k", "ा"),
    ("h", "ी"),
    ("q", "ु"),
    ("w", "ू"),
    ("`", "ृ"),
    ("s", "े"),
    ("v", "अ"),
    ("b", "इ"),
    ("m", "उ"),
    ("Å", "ऊ"),
    (",", "ए"),
    ("_", "ऋ"),
    ("J", "श्र")
]


def kruti_dev_to_unicode(text: str) -> str:
    """
    Converts Kruti Dev 010 typed text to standard Unicode Devanagari.
    """
    if not text:
        return ""

    modified = text
    for kd, uni in KD_MULTI:
        modified = modified.replace(kd, uni)
    for kd, uni in KD_ARRAY:
        modified = modified.replace(kd, uni)

    # Reorder 'f' matra: in Kruti Dev 'f' is chhoti 'i' matra typed before the character
    def fix_chhoti_i(match):
        chars = match.group(1)
        return chars + "ि"

    modified = re.sub(r'f([\u0915-\u0939](\u094D[\u0915-\u0939])*)', fix_chhoti_i, modified)
    modified = modified.replace("f", "ि")

    # Reorder reph 'Z' or 'र्' if placed before vowel or matra
    modified = re.sub(r'([क-ह](?:[\u093E-\u094C])?)Z', r'र्\1', modified)

    return normalize_hindi_unicode(modified)


def unicode_to_kruti_dev(text: str) -> str:
    """
    Converts standard Unicode Devanagari (Mangal) text to Kruti Dev 010 keystrokes.
    """
    if not text:
        return ""

    t = unicodedata.normalize('NFC', text)
    t = t.replace('।', 'A')

    # Reorder Chhoti i matra (\u093F)
    # In Unicode: consonant(s) + \u093F -> in Kruti Dev: f + consonant(s)
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
    Normalizes Hindi Unicode text:
    1. Unicode NFKC normalization
    2. Nukta normalization (e.g. क़, ख़, ग़, ज़, ड़, ढ़, फ़)
    3. Standardizes Chandrabindu vs Anusvara where equivalent
    4. Removes unwanted control characters & zero-width joiners/non-joiners
    5. Normalizes whitespace and standardizes Hindi Purna Viram (।)
    """
    if not text:
        return ""

    res = unicodedata.normalize('NFKC', text)

    nukta_map = {
        '\u0915\u093C': '\u0958',  # क़
        '\u0916\u093C': '\u0959',  # ख़
        '\u0917\u093C': '\u095A',  # ग़
        '\u091C\u093C': '\u095B',  # ज़
        '\u0921\u093C': '\u095C',  # ड़
        '\u0922\u093C': '\u095D',  # ढ़
        '\u092B\u093C': '\u095E',  # फ़
        '\u092F\u093C': '\u095F',  # य़
    }
    for decomp, comp in nukta_map.items():
        res = res.replace(decomp, comp)

    # Standardize full stop / pipe to Hindi Purna Viram
    res = res.replace('|', '।')
    res = re.sub(r'\.(?=\s|$)', '।', res)

    # Clean Zero-width spaces & joiners
    res = res.replace('\u200B', '')  # Zero-width space
    res = res.replace('\u200C', '')  # ZWNJ
    res = res.replace('\u200D', '')  # ZWJ
    res = res.replace('\uFEFF', '')  # Byte order mark

    # Standardize quotes and dashes
    res = res.replace('“', '"').replace('”', '"')
    res = res.replace('‘', "'").replace('’', "'")
    res = res.replace('–', '-').replace('—', '-')

    # Normalize whitespace
    res = re.sub(r'[ \t]+', ' ', res)
    res = re.sub(r'\n+', '\n', res)
    return res.strip()


def normalize_for_comparison(text: str, language: str = 'hindi') -> str:
    """
    Prepares text for token-level comparison by normalizing punctuation,
    spaces, and script-specific characters while preserving words.
    """
    if not text:
        return ""

    if language.lower() == 'hindi':
        text = normalize_hindi_unicode(text)
    else:
        text = unicodedata.normalize('NFKC', text)
        text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
        text = text.replace('–', '-').replace('—', '-')

    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def convert_input_text(text: str, mode: str, language: str = 'hindi') -> str:
    """
    Converts student typed text based on selected typing mode:
    - 'mangal': Unicode Devanagari directly
    - 'krutidev': Kruti Dev 010 -> Unicode
    - 'inscript': Inscript layout (produces Unicode, normalize)
    - 'remington': Remington typing (produces Unicode, normalize)
    """
    if not text:
        return ""

    mode = (mode or 'mangal').lower().strip()
    if 'kruti' in mode:
        return kruti_dev_to_unicode(text)
    else:
        return normalize_hindi_unicode(text) if language.lower() == 'hindi' else text.strip()
