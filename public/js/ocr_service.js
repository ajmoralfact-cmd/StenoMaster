/**
 * StenoMaster OCR Service (v1.0)
 * Extracts Hindi and English text from photos of books, newspapers, or handwritten notes.
 * Supports image preprocessing (canvas scaling, contrast enhancement) and real-time progress.
 */

class StenoOcrService {
  constructor() {
    this.isLoaded = false;
    this.worker = null;
    this.cdnUrl = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  }

  async loadLibrary() {
    if (window.Tesseract) {
      this.isLoaded = true;
      return window.Tesseract;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.cdnUrl;
      script.async = true;
      script.onload = () => {
        this.isLoaded = true;
        resolve(window.Tesseract);
      };
      script.onerror = () => {
        reject(new Error('OCR इंजन लोड करने में असमर्थ। कृपया इंटरनेट कनेक्शन जांचें।'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Preprocess image on HTML5 Canvas:
   * - Constrains max dimension to 2048px (optimal OCR speed & memory)
   * - Enhances contrast for sharp Hindi character recognition
   */
  async preprocessImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 2048;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          // Draw image
          ctx.drawImage(img, 0, 0, w, h);

          // Mild contrast enhancement
          try {
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;
            const contrast = 1.15;
            const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
            for (let i = 0; i < d.length; i += 4) {
              d[i] = factor * (d[i] - 128) + 128;
              d[i + 1] = factor * (d[i + 1] - 128) + 128;
              d[i + 2] = factor * (d[i + 2] - 128) + 128;
            }
            ctx.putImageData(imgData, 0, 0);
          } catch (err) {
            // Ignore if cross-origin or canvas filter unsupported
          }

          resolve(canvas);
        };
        img.onerror = () => reject(new Error('अमान्य इमेज फाइल'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('इमेज पढ़ने में त्रुटि'));
      reader.readAsDataURL(fileOrBlob);
    });
  }

  /**
   * Clean and normalize extracted Devanagari text
   */
  cleanHindiOcrText(raw) {
    if (!raw) return '';

    let text = raw;

    // Normalize carriage returns and line feeds
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Replace common OCR errors for Hindi Purnaviram
    text = text.replace(/\|/g, '।');
    text = text.replace(/\.{2,}/g, ' । ');
    text = text.replace(/(?<=[\u0900-\u097F0-9])\.(?=\s|$)/g, ' ।');

    // Remove noise symbols common in page scans
    text = text.replace(/[_~^{}\[\]\\<>«»]/g, ' ');

    // Normalize multiple dashes or bullet dots
    text = text.replace(/^[\s•\-\*]+/gm, '');

    // Combine hyphenated words split across lines
    text = text.replace(/(\w)-\n(\w)/g, '');

    // Collapse multiple spaces into single space
    text = text.replace(/[ \t]+/g, ' ');

    // Fix punctuation spacing
    text = text.replace(/\s+([।!?])/g, '');
    text = text.replace(/([।!?])(?!\s)/g, ' ');

    // Trim lines and collapse 3+ newlines to 2
    text = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');

    return text.trim();
  }

  /**
   * Main recognize method
   * @param {File|Blob} file Image file
   * @param {Function} progressCallback ({ status, percent })
   */
  async extractText(file, progressCallback = () => {}) {
    progressCallback({ status: 'OCR इंजन लोड हो रहा है...', percent: 5 });
    await this.loadLibrary();

    progressCallback({ status: 'इमेज प्रोसेस हो रही है...', percent: 15 });
    const canvas = await this.preprocessImage(file);

    progressCallback({ status: 'अक्षरों की पहचान हो रही है (OCR)...', percent: 30 });

    try {
      const worker = await window.Tesseract.createWorker(['hin', 'eng'], 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress != null) {
            const pct = 30 + Math.round(m.progress * 65);
            progressCallback({ status: 'हिंदी अक्षरों की पहचान हो रही है...', percent: pct });
          } else if (m.status === 'loading language traineddata') {
            progressCallback({ status: 'हिंदी भाषा मॉडल लोड हो रहा है...', percent: 20 });
          } else if (m.status === 'initializing api') {
            progressCallback({ status: 'स्कैनर प्रारंभ हो रहा है...', percent: 28 });
          }
        }
      });

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      progressCallback({ status: 'टेक्स्ट साफ़ और व्यवस्थित किया जा रहा है...', percent: 98 });
      const cleanText = this.cleanHindiOcrText(ret.data.text);
      const words = cleanText ? cleanText.split(/\s+/).filter(w => w.length > 0).length : 0;

      progressCallback({ status: 'पूर्ण!', percent: 100 });

      return {
        text: cleanText,
        wordCount: words,
        confidence: ret.data.confidence
      };
    } catch (err) {
      console.error('Tesseract recognition error:', err);
      throw new Error(OCR स्कैन में त्रुटि: );
    }
  }
}

window.stenoOcr = new StenoOcrService();
