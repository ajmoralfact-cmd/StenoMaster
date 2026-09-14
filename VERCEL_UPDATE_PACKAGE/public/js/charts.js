/**
 * Canvas Interactive Charts Renderer for StenoMaster
 * Zero-dependency, lightweight, high-DPI crisp rendering
 */

class StenoCharts {
  static drawLineChart(canvas, dataPoints, labelY = 'WPM', lineColor = '#2563eb', fillColor = 'rgba(37,99,235,0.12)') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (!dataPoints || dataPoints.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📊 कोई अभ्यास डेटा उपलब्ध नहीं है (No practice completed yet)', w / 2, h / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('पहला डिक्टेशन पूरा करने के बाद आपका स्पीड ग्राफ यहाँ प्रदर्शित होगा।', w / 2, h / 2 + 14);
      return;
    }

    const padding = { top: 20, right: 24, bottom: 32, left: 44 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxVal = Math.max(60, Math.ceil(Math.max(...dataPoints.map(p => p.val)) * 1.2));
    const minVal = 0;

    // Grid lines & Y axis
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round(minVal + ((maxVal - minVal) / ySteps) * i);
      const y = padding.top + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${val}`, padding.left - 8, y + 4);
    }

    // Coordinates calculation
    const points = dataPoints.map((p, idx) => {
      const x = padding.left + (dataPoints.length === 1 ? chartW / 2 : (idx / (dataPoints.length - 1)) * chartW);
      const y = padding.top + chartH - ((p.val - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, val: p.val, label: p.label };
    });

    // Area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Circles and X labels
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';

    points.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (idx % Math.ceil(points.length / 6) === 0 || idx === points.length - 1) {
        ctx.fillStyle = '#64748b';
        ctx.fillText(p.label || `#${idx + 1}`, p.x, h - 10);
        ctx.fillStyle = '#ffffff';
      }
    });
  }

  static drawBarChart(canvas, categories, dataVals, barColor = '#3b82f6') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (!dataVals || dataVals.length === 0 || Math.max(...dataVals) === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎯 त्रुटि विश्लेषण डेटा (Error Distribution)', w / 2, h / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('अभ्यास सबमिट करने के बाद आपकी मात्रा व वर्तनी गलतियों का विश्लेषण यहाँ दिखाई देगा।', w / 2, h / 2 + 14);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxVal = Math.max(5, Math.ceil(Math.max(...dataVals) * 1.25));

    // Y Axis
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal / 4) * i);
      const y = padding.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${val}`, padding.left - 6, y + 4);
    }

    const barWidth = Math.min(46, (chartW / categories.length) * 0.65);
    const step = chartW / categories.length;

    categories.forEach((cat, idx) => {
      const val = dataVals[idx] || 0;
      const barH = (val / maxVal) * chartH;
      const x = padding.left + idx * step + (step - barWidth) / 2;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Value on top
      if (val > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${val}`, x + barWidth / 2, y - 6);
      }

      // X Label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cat, x + barWidth / 2, h - 14);
    });
  }

  static drawDualTrendChart(canvas, trends) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = (rect.width || 600) * dpr;
    canvas.height = (rect.height || 240) * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width || 600;
    const h = rect.height || 240;
    ctx.clearRect(0, 0, w, h);

    if (!trends || trends.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📊 कोई टेस्ट डेटा उपलब्ध नहीं है', w / 2, h / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('पहला डिक्टेशन टेस्ट पूरा करने के बाद आपकी गति व गलती दर का वक्र यहाँ दिखेगा।', w / 2, h / 2 + 14);
      return;
    }

    const padding = { top: 26, right: 42, bottom: 36, left: 46 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxSpeed = Math.max(60, Math.ceil(Math.max(...trends.map(t => t.net_wpm || 0)) * 1.25));
    const maxErr = Math.max(20, Math.ceil(Math.max(...trends.map(t => t.error_rate || 0)) * 1.25));

    // Horizontal Grid lines & dual axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Left Axis (Speed WPM - Blue)
      const valSpeed = Math.round((maxSpeed / ySteps) * i);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2563eb';
      ctx.fillText(`${valSpeed}`, padding.left - 8, y + 4);

      // Right Axis (Mistake % - Red)
      const valErr = Math.round((maxErr / ySteps) * i);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`${valErr}%`, w - padding.right + 8, y + 4);
    }

    const n = trends.length;
    const getX = (idx) => n === 1 ? padding.left + chartW / 2 : padding.left + (idx / (n - 1)) * chartW;
    const getYSpeed = (val) => padding.top + chartH - ((val || 0) / maxSpeed) * chartH;
    const getYErr = (val) => padding.top + chartH - ((val || 0) / maxErr) * chartH;

    // Draw Speed Area (Soft Blue fill)
    ctx.beginPath();
    ctx.moveTo(getX(0), padding.top + chartH);
    trends.forEach((t, i) => ctx.lineTo(getX(i), getYSpeed(t.net_wpm)));
    ctx.lineTo(getX(n - 1), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.fill();

    // Draw Speed Line (Solid Blue)
    ctx.beginPath();
    ctx.moveTo(getX(0), getYSpeed(trends[0].net_wpm));
    trends.forEach((t, i) => ctx.lineTo(getX(i), getYSpeed(t.net_wpm)));
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Mistake Line (Dashed Red)
    ctx.beginPath();
    ctx.moveTo(getX(0), getYErr(trends[0].error_rate));
    trends.forEach((t, i) => ctx.lineTo(getX(i), getYErr(t.error_rate)));
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Data Points and X Labels
    trends.forEach((t, i) => {
      const x = getX(i);
      const ySpeed = getYSpeed(t.net_wpm);
      const yErr = getYErr(t.error_rate);

      // Speed Dot (Blue)
      ctx.beginPath();
      ctx.arc(x, ySpeed, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Mistake Dot (Red)
      ctx.beginPath();
      ctx.arc(x, yErr, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // X Axis Label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const lbl = t.label || `T${i + 1}`;
      ctx.fillText(lbl, x, h - 12);
    });
  }
}

window.stenoCharts = StenoCharts;
