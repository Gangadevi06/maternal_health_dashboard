document.addEventListener("DOMContentLoaded", () => {
  const KEY = "shecare_data_final";
  let appState = JSON.parse(localStorage.getItem(KEY) || '{"profile":{},"readings":[]}');

  const q = id => document.getElementById(id);

  // canvas context
  const canvas = q("trendChart");
  const ctx = canvas ? canvas.getContext("2d") : null;

  // normal ranges
  const ranges = {
    glucose:[70,140], cortisol:[5,25], hb:[11,17],
    hr:[60,100], bp:[90,140], spo2:[95,100], temp:[36,37.5]
  };

  let chart = null;

  function save(){ localStorage.setItem(KEY, JSON.stringify(appState)); }
  function parseNumber(v){ if(v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isNaN(n) ? null : n; }
  function inRange(k,v){ if(v == null) return false; const r = ranges[k]; if(!r) return false; return v >= r[0] && v <= r[1]; }
  function hasAnyNumeric(r){ return ["glucose","cortisol","hb","hr","bp","spo2","temp"].some(k => r[k] != null); }

  // Profile
  if(q("saveProfile")) q("saveProfile").onclick = () => {
    appState.profile = {
      name: q("profileName")?.value || "",
      age: q("profileAge")?.value || "",
      week: q("profileWeek")?.value || ""
    };
    save();
    alert("Profile saved.");
  };
  if(q("clearProfile")) q("clearProfile").onclick = () => {
    if(!confirm("Clear profile?")) return;
    appState.profile = {};
    save();
    if(q("profileName")) q("profileName").value = "";
    if(q("profileAge")) q("profileAge").value = "";
    if(q("profileWeek")) q("profileWeek").value = "";
  };

  // Submit
  if(q("submitReading")) q("submitReading").onclick = () => {
    const r = {
      time: new Date().toISOString(),
      glucose: parseNumber(q("inpGlucose")?.value),
      cortisol: parseNumber(q("inpCortisol")?.value),
      hb: parseNumber(q("inpHb")?.value),
      hr: parseNumber(q("inpHR")?.value),
      bp: parseNumber(q("inpBP")?.value),
      spo2: parseNumber(q("inpSpO2")?.value),
      temp: parseNumber(q("inpTemp")?.value)
    };

    if(!hasAnyNumeric(r)){ alert("Please enter at least one numeric value before submitting."); return; }

    appState.readings.unshift(r);
    if(appState.readings.length > 500) appState.readings.length = 500;
    save();
    renderAll();

    // Clear inputs
    ["inpGlucose","inpCortisol","inpHb","inpHR","inpBP","inpSpO2","inpTemp"].forEach(id => { if(q(id)) q(id).value = ""; });

    // popups: require the 4 vitals hr, bp, spo2, temp to be present & normal for heart popup
    if(r.hr != null && r.bp != null && r.spo2 != null && r.temp != null && inRange("hr", r.hr) && inRange("bp", r.bp) && inRange("spo2", r.spo2) && inRange("temp", r.temp)) {
      showNormalPopup();
    } else {
      showAbnormalPopup();
    }
  };

  // Preset
  if(q("presetNormal")) q("presetNormal").onclick = () => {
    if(q("inpGlucose")) q("inpGlucose").value = 98;
    if(q("inpCortisol")) q("inpCortisol").value = 12;
    if(q("inpHb")) q("inpHb").value = 13;
    if(q("inpHR")) q("inpHR").value = 82;
    if(q("inpBP")) q("inpBP").value = 118;
    if(q("inpSpO2")) q("inpSpO2").value = 98;
    if(q("inpTemp")) q("inpTemp").value = 36.6;
  };

  // Clear history
  if(q("clearHistory")) q("clearHistory").onclick = () => {
    if(!confirm("Clear all history?")) return;
    appState.readings = [];
    save();
    renderAll();
  };

  // Export CSV
  if(q("exportCsv")) q("exportCsv").onclick = () => {
    if(!appState.readings.length){ alert("No data to export."); return; }
    const rows = [["time","glucose","cortisol","hb","hr","bp","spo2","temp"]];
    for(const r of appState.readings) rows.push([r.time, r.glucose ?? "", r.cortisol ?? "", r.hb ?? "", r.hr ?? "", r.bp ?? "", r.spo2 ?? "", r.temp ?? ""]);
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "shecare_history.csv"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 500);
  };

  // Render Latest
  function renderLatest(){
    const latest = appState.readings[0] || null;
    if(q("val-glucose")) q("val-glucose").textContent = latest && latest.glucose != null ? `${latest.glucose} mg/dL` : "--";
    if(q("stat-glucose")) q("stat-glucose").textContent = latest && latest.glucose != null ? (inRange("glucose", latest.glucose) ? "Normal" : "Abnormal") : "No Data";

    if(q("val-cortisol")) q("val-cortisol").textContent = latest && latest.cortisol != null ? `${latest.cortisol} µg/dL` : "--";
    if(q("stat-cortisol")) q("stat-cortisol").textContent = latest && latest.cortisol != null ? (inRange("cortisol", latest.cortisol) ? "Normal" : "Abnormal") : "No Data";

    if(q("val-hb")) q("val-hb").textContent = latest && latest.hb != null ? `${latest.hb} g/dL` : "--";
    if(q("stat-hb")) q("stat-hb").textContent = latest && latest.hb != null ? (inRange("hb", latest.hb) ? "Normal" : "Abnormal") : "No Data";

    // small vitals
    const small = q("smallVitals");
    if(!small) return;
    small.innerHTML = "";
    const tiles = [
      {k:"hr", label:"Heart Rate", unit:" bpm"},
      {k:"bp", label:"Blood Pressure", unit:" mmHg"},
      {k:"spo2", label:"SpO₂", unit:" %"},
      {k:"temp", label:"Temperature", unit:" °C"}
    ];
    tiles.forEach(t => {
      const div = document.createElement("div"); div.className = "small-card";
      let display = "--", stat = "No Data";
      if(latest){
        const v = (t.k === "bp") ? latest.bp : latest[t.k];
        display = (v == null) ? "--" : `${v}${t.unit}`;
        stat = (v == null) ? "No Data" : (inRange(t.k, v) ? "Normal" : "Abnormal");
      }
      div.innerHTML = `<div class="label">${t.label}</div><div class="val">${display}</div><div class="sub">${stat}</div>`;
      small.appendChild(div);
    });
  }

  // Render Table
  function renderTable(){
    const tbody = q("historyTable")?.querySelector("tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    appState.readings.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td>
        <td>${new Date(r.time).toLocaleString()}</td>
        <td>${r.glucose ?? ""}</td>
        <td>${r.cortisol ?? ""}</td>
        <td>${r.hb ?? ""}</td>
        <td>${r.hr ?? ""}</td>
        <td>${r.bp ?? ""}</td>
        <td>${r.spo2 ?? ""}</td>
        <td>${r.temp ?? ""}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Render Chart (Glucose, Cortisol, Hb)
  function renderChart(){
    if(!ctx) return;
    const readings = appState.readings.slice().reverse();
    const labels = readings.map(r => new Date(r.time).toLocaleTimeString());
    const glucose = readings.map(r => r.glucose == null ? null : r.glucose);
    const cortisol = readings.map(r => r.cortisol == null ? null : r.cortisol);
    const hb = readings.map(r => r.hb == null ? null : r.hb);

    const datasets = [
      { label: "Glucose (mg/dL)", data: glucose, borderColor: "#1f9d55", backgroundColor: "rgba(31,157,85,0.06)", fill: true, tension: 0.3, spanGaps: true },
      { label: "Cortisol (µg/dL)", data: cortisol, borderColor: "#f5a623", backgroundColor: "rgba(245,166,35,0.06)", fill: true, tension: 0.3, spanGaps: true },
      { label: "Hemoglobin (g/dL)", data: hb, borderColor: "#ff4d4f", backgroundColor: "rgba(255,77,79,0.06)", fill: true, tension: 0.3, spanGaps: true }
    ];

    if(chart){
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.update();
      return;
    }

    chart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false } },
        interaction: { mode: "index", intersect: false },
        scales: { y: { beginAtZero: false, ticks: { maxTicksLimit: 8 } }, x: { display: true } }
      }
    });
  }

  // Normal popup (matches your screenshot)
  function showNormalPopup(){
    // overlay with soft pink tint (like your screenshot)
    const overlay = document.createElement("div"); overlay.className = "popup-overlay";
    const box = document.createElement("div"); box.className = "popup-box";

    // build content: check circle + title + subtitle + bottom heart row
    box.innerHTML = `
      <div class="popup-top">
        <div class="check-circle">✔</div>
        <div style="text-align:left">
          <h2>All vitals are normal!</h2>
          <p style="margin:4px 0 0 0;">Keep monitoring regularly</p>
        </div>
      </div>
      <div style="height:30px"></div>
      <div class="heart-row"></div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // create multiple hearts in the heart-row with different delays/size to replicate the visual
    const row = box.querySelector(".heart-row");
    const heartCount = 10;
    for(let i=0;i<heartCount;i++){
      const h = document.createElement("div");
      h.className = "heart";
      h.textContent = "💗";
      // staggered animation: smaller hearts more centered, larger at sides
      const size = 14 + Math.round(Math.random()*18);
      h.style.fontSize = size + "px";
      h.style.animationDelay = (i * 0.08) + "s";
      // small horizontal random offset to spread hearts
      h.style.transform = `translateX(${(i - heartCount/2) * 6}px)`;
      row.appendChild(h);
      // slight additional per-heart float using inline animation-delay already set
    }

    // auto close
    setTimeout(()=>{ overlay.style.opacity = "0"; setTimeout(()=>overlay.remove(), 320); }, 3800);
  }

  // Abnormal popup (sorrow + tips)
  function showAbnormalPopup(){
    const overlay = document.createElement("div"); overlay.className = "sad-popup-overlay";
    const box = document.createElement("div"); box.className = "sad-popup-box";
    box.innerHTML = `
      <h2>😢 Your vitals seem abnormal!</h2>
      <p>Please take care of yourself 💙</p>
      <ul>
        <li>Stay Hydrated</li>
        <li>Relax Mind</li>
        <li>Deep Breathe</li>
        <li>Sleep Well</li>
        <li>Call Doctor</li>
      </ul>
    `;
    overlay.appendChild(box); document.body.appendChild(overlay);
    setTimeout(()=>{ overlay.style.opacity = "0"; setTimeout(()=>overlay.remove(),300); }, 5000);
  }

  // Initial seed if empty
  if(!appState.readings || !appState.readings.length){
    const now = Date.now();
    appState.readings = [
      { time: new Date(now - 1000*60*60*3).toISOString(), glucose: 98, cortisol: 8, hb: 14, hr: 78, bp: 118, spo2: 98, temp: 36.6 },
      { time: new Date(now - 1000*60*60*2).toISOString(), glucose: 96, cortisol: 10, hb: 13.8, hr: 80, bp: 120, spo2: 98, temp: 36.6 },
      { time: new Date(now - 1000*60*60*1).toISOString(), glucose: 100, cortisol: 12, hb: 13.6, hr: 82, bp: 119, spo2: 97, temp: 36.7 }
    ];
    save();
  }

  // Render all
  function renderAll(){ renderLatest(); renderTable(); renderChart(); }
  renderAll();

  // debug helper
  window.shecare = { appState, save, renderAll };
  console.log("[SheCare] Ready — try Preset Normal -> Submit to test the popup.");
});

