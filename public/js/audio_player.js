/**
 * Audio Player & Dictation Controller for StenoMaster
 * Supports:
 * - HTML5 Audio playback with Range/Streaming
 * - Play/Pause, ±5s jump, Scrubbing
 * - Speeds: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x (persists)
 * - Volume & Mute
 * - Web Speech Synthesis fallback for dictation when audio file is not uploaded
 * - Audio End event notification (without auto-submit)
 */

class StenoAudioPlayer {
  constructor() {
    this.audioElement = new Audio();
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackSpeed = parseFloat(localStorage.getItem('stenomaster_audio_speed') || '1.0');
    this.isMuted = false;
    this.volume = 1.0;
    this.isSpeechSynthesis = false;
    this.speechUtterance = null;
    this.speechText = '';
    this.speechLang = 'hi-IN';
    this.onEndedCallback = null;
    this.onTimeUpdateCallback = null;

    this.isCountingDown = false;
    this.countdownTimer = null;
    this.countdownSeconds = 5;
    this.audioCtx = null;
    this.countdownAudioMap = null;

    this.initListeners();
    this.initCountdownAudios();
  }

  initListeners() {
    this.audioElement.addEventListener('timeupdate', () => {
      this.currentTime = this.audioElement.currentTime;
      this.duration = this.audioElement.duration || this.duration;
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.currentTime, this.duration);
      }
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      const playBtn = document.getElementById('audioPlayBtn');
      if (playBtn) playBtn.innerHTML = '▶️';
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.duration = this.audioElement.duration || this.duration;
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.currentTime, this.duration);
      }
    });

    this.audioElement.addEventListener('error', (e) => {
      console.warn('Audio element error, falling back to Web Speech Synthesis if text available');
      if (this.speechText) {
        this.startSpeechSynthesisFallback();
      }
    });
  }

  loadAudio(audioUrl, durationSeconds = 180, fallbackText = '', language = 'hindi') {
    this.stop();
    this.duration = durationSeconds;
    this.currentTime = 0;
    this.speechText = fallbackText;
    this.speechLang = language.toLowerCase() === 'hindi' ? 'hi-IN' : 'en-US';

    if (audioUrl && audioUrl.trim() !== '') {
      this.isSpeechSynthesis = false;
      this.audioElement.src = audioUrl;
      this.audioElement.playbackRate = this.playbackSpeed;
      this.audioElement.volume = this.isMuted ? 0 : this.volume;
      this.audioElement.load();
    } else {
      // Use dynamic Speech Synthesis
      this.isSpeechSynthesis = true;
    }
  }

  play(forceDirect = false) {
    if (!forceDirect && this.currentTime === 0 && !this.isCountingDown) {
      this.startCountdown();
      return;
    }
    this.startActualPlayback();
  }

  initCountdownAudios() {
    if (this.countdownAudioMap) return;
    try {
      this.countdownAudioMap = {
        5: new Audio('/assets/audio/count_5.wav'),
        4: new Audio('/assets/audio/count_4.wav'),
        3: new Audio('/assets/audio/count_3.wav'),
        2: new Audio('/assets/audio/count_2.wav'),
        1: new Audio('/assets/audio/count_1.wav'),
        0: new Audio('/assets/audio/count_start.wav')
      };
      Object.values(this.countdownAudioMap).forEach(aud => {
        aud.preload = 'auto';
        aud.volume = 1.0;
      });
    } catch (e) {
      console.warn('Countdown audio preload warning:', e);
    }
  }

  stopCountdownAudios() {
    if (this.countdownAudioMap) {
      Object.values(this.countdownAudioMap).forEach(a => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch (e) {}
      });
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  playCountdownVoice(count) {
    this.initCountdownAudios();
    this.stopCountdownAudios();

    // 1. High-quality sweet natural voice (Microsoft Zira / Pre-rendered clean audio)
    if (this.countdownAudioMap && this.countdownAudioMap[count]) {
      const aud = this.countdownAudioMap[count];
      aud.currentTime = 0;
      const promise = aud.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn('Audio play blocked, using sweet speech fallback:', err);
          this.speakCountdownFallback(count);
        });
        return;
      }
    }

    // 2. Sweet speech synthesis fallback
    this.speakCountdownFallback(count);
  }

  speakCountdownFallback(count) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const words = {
        5: 'Five',
        4: 'Four',
        3: 'Three',
        2: 'Two',
        1: 'One',
        0: 'Start!'
      };
      const utt = new SpeechSynthesisUtterance(words[count] || String(count));
      utt.lang = 'en-US';
      utt.rate = 0.95; // Sweet, gentle, natural rate
      utt.pitch = 1.1; // Gentle, sweet pitch

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const sweetVoice = voices.find(v => 
          (v.name.includes('Zira') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Female')) && v.lang.startsWith('en')
        ) || voices.find(v => v.lang.startsWith('en'));
        if (sweetVoice) utt.voice = sweetVoice;
      }

      window.speechSynthesis.speak(utt);
    } catch (e) {
      // Ignore speech synthesis issues
    }
  }

  togglePlay() {
    if (this.isCountingDown) {
      this.cancelCountdown();
      return false;
    }
    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      if (this.currentTime === 0) {
        this.startCountdown();
        return true;
      } else {
        this.startActualPlayback();
        return true;
      }
    }
  }

  startCountdown() {
    this.cancelCountdown();
    this.isCountingDown = true;
    this.countdownSeconds = 5;

    const overlay = document.getElementById('stenoCountdownOverlay');
    const playBtn = document.getElementById('audioPlayBtn');

    if (playBtn) playBtn.innerHTML = '⏳';
    if (overlay) {
      overlay.style.display = 'flex';
      void overlay.offsetWidth; // Force layout
      overlay.classList.add('active');
    }

    this.runCountdownTick();
  }

  runCountdownTick() {
    if (!this.isCountingDown) return;

    const badge = document.getElementById('countdownNumberBadge');
    const title = document.getElementById('countdownTitle');
    const sub = document.getElementById('countdownSubtitle');
    const ambient = document.getElementById('countdownGlowAmbient');
    const ring1 = document.getElementById('countdownRing1');
    const ring2 = document.getElementById('countdownRing2');
    const ring3 = document.getElementById('countdownRing3');

    const config = {
      5: {
        badgeClass: 'countdown-number-badge count-5',
        glow: 'rgba(139, 92, 246, 0.55)',
        ringColor: 'rgba(168, 85, 247, 0.65)',
        text: '5',
        title: 'स्टेनो डिक्टेशन प्रारंभ होने वाली है...',
        sub: 'Five • तैयार हो जाइए ✍️'
      },
      4: {
        badgeClass: 'countdown-number-badge count-4',
        glow: 'rgba(6, 182, 212, 0.55)',
        ringColor: 'rgba(56, 189, 248, 0.65)',
        text: '4',
        title: 'स्टेनो डिक्टेशन प्रारंभ होने वाली है...',
        sub: 'Four • नोटबुक और पेंसिल हाथ में लें ✍️'
      },
      3: {
        badgeClass: 'countdown-number-badge count-3',
        glow: 'rgba(16, 185, 129, 0.55)',
        ringColor: 'rgba(52, 211, 153, 0.65)',
        text: '3',
        title: 'स्टेनो डिक्टेशन प्रारंभ होने वाली है...',
        sub: 'Three • ध्यान केंद्रित करें 🎧'
      },
      2: {
        badgeClass: 'countdown-number-badge count-2',
        glow: 'rgba(245, 158, 11, 0.55)',
        ringColor: 'rgba(251, 146, 60, 0.65)',
        text: '2',
        title: 'स्टेनो डिक्टेशन प्रारंभ होने वाली है...',
        sub: 'Two • बस शुरू होने वाला है...'
      },
      1: {
        badgeClass: 'countdown-number-badge count-1',
        glow: 'rgba(239, 68, 68, 0.55)',
        ringColor: 'rgba(251, 113, 133, 0.65)',
        text: '1',
        title: 'स्टेनो डिक्टेशन प्रारंभ होने वाली है...',
        sub: 'One • तैयार रहें!'
      },
      0: {
        badgeClass: 'countdown-number-badge count-go',
        glow: 'rgba(234, 179, 8, 0.65)',
        ringColor: 'rgba(250, 204, 21, 0.75)',
        text: 'START!',
        title: '🎉 डिक्टेशन प्रारंभ!',
        sub: 'Start • शॉर्टहैंड आउटलाइन बनाना शुरू करें! ✍️'
      }
    };

    const cur = config[this.countdownSeconds];
    if (cur) {
      if (badge) {
        badge.textContent = cur.text;
        badge.className = cur.badgeClass;
        badge.style.animation = 'none';
        void badge.offsetWidth;
        badge.style.animation = 'countPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
      }
      if (ambient) {
        ambient.style.background = `radial-gradient(circle, ${cur.glow} 0%, transparent 70%)`;
      }
      if (ring1) ring1.style.borderColor = cur.ringColor;
      if (ring2) ring2.style.borderColor = cur.ringColor;
      if (ring3) ring3.style.borderColor = cur.ringColor;
      if (title) title.textContent = cur.title;
      if (sub) sub.textContent = cur.sub;
    }

    this.playCountdownVoice(this.countdownSeconds);

    if (this.countdownSeconds > 0) {
      this.countdownTimer = setTimeout(() => {
        if (!this.isCountingDown) return;
        this.countdownSeconds--;
        this.runCountdownTick();
      }, 1000);
    } else {
      setTimeout(() => {
        this.finishCountdownAndPlay();
      }, 700);
    }
  }

  finishCountdownAndPlay() {
    this.isCountingDown = false;
    this.stopCountdownAudios();
    const overlay = document.getElementById('stenoCountdownOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 250);
    }
    this.startActualPlayback();
  }

  skipCountdown() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.stopCountdownAudios();
    this.finishCountdownAndPlay();
  }

  cancelCountdown() {
    this.isCountingDown = false;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.stopCountdownAudios();
    const overlay = document.getElementById('stenoCountdownOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
    const playBtn = document.getElementById('audioPlayBtn');
    if (playBtn) playBtn.innerHTML = '▶️';
  }

  startActualPlayback() {
    const playBtn = document.getElementById('audioPlayBtn');
    if (this.isSpeechSynthesis) {
      this.playSpeechSynthesis();
    } else {
      this.audioElement.playbackRate = this.playbackSpeed;
      this.audioElement.play()
        .then(() => {
          this.isPlaying = true;
          if (playBtn) playBtn.innerHTML = '⏸️';
        })
        .catch((err) => {
          console.warn('HTML5 audio play blocked, using fallback:', err);
          if (this.speechText) {
            this.isSpeechSynthesis = true;
            this.playSpeechSynthesis();
          }
        });
    }
    this.isPlaying = true;
    if (playBtn) playBtn.innerHTML = '⏸️';
  }

  pause() {
    this.cancelCountdown();
    this.isPlaying = false;
    if (this.isSpeechSynthesis) {
      if (window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
    } else {
      this.audioElement.pause();
    }
    const playBtn = document.getElementById('audioPlayBtn');
    if (playBtn) playBtn.innerHTML = '▶️';
  }

  stop() {
    this.cancelCountdown();
    this.isPlaying = false;
    this.currentTime = 0;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    const playBtn = document.getElementById('audioPlayBtn');
    if (playBtn) playBtn.innerHTML = '▶️';
  }

  seek(seconds) {
    seconds = Math.max(0, Math.min(seconds, this.duration));
    this.currentTime = seconds;
    if (!this.isSpeechSynthesis && this.audioElement) {
      this.audioElement.currentTime = seconds;
    }
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.currentTime, this.duration);
    }
  }

  seekRelative(deltaSeconds) {
    const target = this.currentTime + deltaSeconds;
    this.seek(target);
  }

  setSpeed(speed) {
    this.playbackSpeed = parseFloat(speed);
    localStorage.setItem('stenomaster_audio_speed', this.playbackSpeed.toString());
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackSpeed;
    }
    if (this.isSpeechSynthesis && this.speechUtterance) {
      this.speechUtterance.rate = this.playbackSpeed;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, parseFloat(vol)));
    this.isMuted = this.volume === 0;
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.audioElement) {
      this.audioElement.muted = this.isMuted;
    }
    return this.isMuted;
  }

  playSpeechSynthesis() {
    if (!window.speechSynthesis) return;

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isPlaying = true;
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = this.speechText || 'स्टेनो डिक्टेशन प्रारंभ।';
    this.speechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    this.speechUtterance.lang = this.speechLang;
    this.speechUtterance.rate = this.playbackSpeed;

    // Pick appropriate voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(this.speechLang.substring(0, 2))) || voices[0];
    if (voice) {
      this.speechUtterance.voice = voice;
    }

    // Estimate duration based on word count
    const words = textToSpeak.split(/\s+/).length;
    // Avg speaking rate is ~120 words per minute
    this.duration = Math.max(30, Math.round((words / 120) * 60 / this.playbackSpeed));

    // Progress ticker
    if (this.speechTimer) clearInterval(this.speechTimer);
    this.speechTimer = setInterval(() => {
      if (this.isPlaying) {
        this.currentTime += 0.5;
        if (this.currentTime >= this.duration) {
          this.currentTime = this.duration;
        }
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(this.currentTime, this.duration);
        }
      }
    }, 500);

    this.speechUtterance.onend = () => {
      this.isPlaying = false;
      if (this.speechTimer) clearInterval(this.speechTimer);
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    window.speechSynthesis.speak(this.speechUtterance);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

window.stenoAudioPlayer = new StenoAudioPlayer();
