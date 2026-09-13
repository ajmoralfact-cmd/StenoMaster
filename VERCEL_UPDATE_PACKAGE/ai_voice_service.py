"""
AI Voice Dictation Service for StenoMaster
Converts Hindi text into natural speech MP3 audio calibrated for Stenography practice (60, 80, 100, 120, 140 WPM).
Features:
- Sentence & clause tokenization for natural phrasing
- Concurrent TTS fetching for sub-second generation
- Natural exam-hall pause insertion at punctuation (viram, comma)
- Direct MP3 frame stitching without heavy external dependencies
"""

import urllib.request
import urllib.parse
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import List, Tuple

_CACHED_SILENCE = None

def get_silence_chunk() -> bytes:
    """Returns a short silence MP3 chunk for punctuation pauses."""
    global _CACHED_SILENCE
    if _CACHED_SILENCE is not None:
        return _CACHED_SILENCE
    try:
        url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + urllib.parse.quote('...') + '&tl=hi&client=tw-ob'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=5) as r:
            _CACHED_SILENCE = r.read()
            return _CACHED_SILENCE
    except Exception:
        _CACHED_SILENCE = b'\xff\xf3\x84\xc4' + (b'\x00' * 284)
        return _CACHED_SILENCE

def split_hindi_text_into_chunks(text: str, max_chars: int = 140) -> List[str]:
    """
    Cleans and splits Hindi text into logical phrases/sentences.
    Ensures no chunk exceeds max_chars (safe for TTS API limits).
    """
    if not text:
        return []

    clean = re.sub(r'\s+', ' ', text).strip()
    clean = clean.replace('|', '।').replace('।', '।\n')

    raw_sentences = [s.strip() for s in clean.split('\n') if s.strip()]
    final_chunks = []

    for sentence in raw_sentences:
        if len(sentence) <= max_chars:
            final_chunks.append(sentence)
        else:
            sub_parts = re.split(r'([,;:-])', sentence)
            current_chunk = ''
            for part in sub_parts:
                if len(current_chunk) + len(part) <= max_chars:
                    current_chunk += part
                else:
                    if current_chunk.strip():
                        final_chunks.append(current_chunk.strip())
                    if len(part) > max_chars:
                        words = part.split()
                        w_chunk = ''
                        for w in words:
                            if len(w_chunk) + len(w) + 1 <= max_chars:
                                w_chunk += (' ' if w_chunk else '') + w
                            else:
                                if w_chunk:
                                    final_chunks.append(w_chunk)
                                w_chunk = w
                        if w_chunk:
                            final_chunks.append(w_chunk)
                        current_chunk = ''
                    else:
                        current_chunk = part
            if current_chunk.strip():
                final_chunks.append(current_chunk.strip())

    return [c for c in final_chunks if c.strip()]

def _fetch_single_tts_chunk(chunk_text: str) -> bytes:
    """Fetches MP3 audio for a single Hindi chunk from Google TTS."""
    url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + urllib.parse.quote(chunk_text) + '&tl=hi&client=tw-ob'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
    }
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return resp.read()
        except Exception:
            if attempt == 1:
                break
            time.sleep(0.3)
    return b''

def generate_hindi_speech_mp3(text: str, target_wpm: int = 80, pause_mode: str = 'exam') -> Tuple[bytes, int, int]:
    """
    Generates complete natural Hindi speech MP3 from text.
    Returns:
        (mp3_bytes, word_count, estimated_duration_seconds)
    """
    text = text.strip()
    if not text:
        raise ValueError('हिंदी टेक्स्ट रिक्त नहीं हो सकता')

    words = len(text.split())
    if words == 0:
        raise ValueError('कोई शब्द नहीं मिला')

    target_wpm = max(40, min(200, int(target_wpm)))
    expected_duration = max(10, round((words / target_wpm) * 60))

    chunks = split_hindi_text_into_chunks(text, max_chars=130)
    if not chunks:
        raise ValueError('टेक्स्ट विभाजन में त्रुटि')

    max_workers = min(10, max(2, len(chunks)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        audio_chunks = list(executor.map(_fetch_single_tts_chunk, chunks))

    silence = get_silence_chunk()
    if target_wpm <= 60:
        pause_units = 2
    elif target_wpm <= 80:
        pause_units = 2
    elif target_wpm <= 100:
        pause_units = 1
    else:
        pause_units = 0

    pause_bytes = silence * pause_units if pause_units > 0 else b''

    combined_parts = []
    for i, chunk_audio in enumerate(audio_chunks):
        if not chunk_audio:
            continue
        combined_parts.append(chunk_audio)
        if i < len(chunks) - 1 and pause_bytes:
            orig_chunk = chunks[i].strip()
            if orig_chunk.endswith(('।', '!', '?', '.')):
                combined_parts.append(pause_bytes)

    final_mp3 = b''.join(combined_parts)
    if not final_mp3:
        raise RuntimeError('ऑडियो जेनरेशन विफल रहा, कृपया इंटरनेट कनेक्शन जांचें।')

    return final_mp3, words, expected_duration
