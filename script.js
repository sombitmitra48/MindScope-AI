"use strict";
/* ============ Config ============ */
const API = (window.API_BASE_URL || "http://127.0.0.1:2200").replace(/\/$/, "");
const SCORE_MAX = 10;          // display scale for the ring; adjust if your model uses another range
const TIMEOUT_MS = 20000;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const frame = () => new Promise((r) => requestAnimationFrame(r));

/* ============ Fields (mirror the StudentData model exactly) ============ */
const sl = (label, hint, min, max, step, unit, start, x = {}) => ({ label, hint, type: "slider", min, max, step, unit, start, ...x });
const F = {
  age: sl("Age", "Your age in years", 10, 100, 1, "yrs", 20, { int: 1 }),
  gender: { label: "Gender", hint: "Options supported by the model", type: "cards", opts: ["Male", "Female"] },
  country: { label: "Country", hint: "Choose a suggestion or type your own", type: "text" },
  academic_level: { label: "Academic level", hint: "Your current level of study", type: "cards", opts: ["High School", "Undergraduate", "Graduate"] },
  most_used_patform: { label: "Most used platform", hint: "The one you spend the most time on", type: "chips", opts: ["Instagram", "TikTok", "YouTube", "Facebook", "WhatsApp", "Snapchat", "Twitter", "LinkedIn", "WeChat", "LINE", "KakaoTalk", "VKontakte"] },
  purpose_of_use: { label: "Main purpose", hint: "Why you mostly use it", type: "cards", opts: ["Entertainment", "Education", "Networking", "News"] },
  avg_daily_usage_hours: sl("Daily social media use", "Average hours per day", 0, 24, 0.5, "h", 4),
  daily_unlocks: sl("Phone unlocks", "Times you unlock your device in a day", 0, 300, 1, "×", 60, { int: 1, open: 1 }),
  study_hours: sl("Study time", "Hours per day", 0, 24, 0.5, "h", 3),
  physical_activity_hours: sl("Physical activity", "Hours per day (0 to 10)", 0, 10, 0.5, "h", 1),
  sleep_hours_per_night: sl("Sleep", "Hours per night", 0, 24, 0.5, "h", 7),
  stress_level: { label: "Stress level", hint: "How stressed you generally feel", type: "cards", opts: ["Low", "Medium", "High", "Very High"] },
};
const COUNTRIES = ["India", "USA", "Canada", "Australia", "UK", "Germany", "Mexico", "Turkey", "France", "Other"];
const STEPS = [
  { t: "About you", d: "A few basics to set the context.", k: ["age", "gender", "country", "academic_level"] },
  { t: "Digital life", d: "How you use social media day to day.", k: ["most_used_patform", "purpose_of_use", "avg_daily_usage_hours", "daily_unlocks"] },
  { t: "Daily routine", d: "Study, movement and rest.", k: ["study_hours", "physical_activity_hours", "sleep_hours_per_night"] },
  { t: "Stress & review", d: "One last question, then check your answers.", k: ["stress_level"] },
];
const KEYS = Object.keys(F);
const stepOf = (k) => STEPS.findIndex((s) => s.k.includes(k));
const A = {};
let step = 0;

/* ============ Helpers ============ */
const isSet = (k) => A[k] !== undefined && A[k] !== "";
const fmt = (k) => (!isSet(k) ? "—" : F[k].type === "slider" ? `${A[k]} ${F[k].unit}` : esc(A[k]));
const pct = (v, f) => ((Math.min(v, f.max) - f.min) / (f.max - f.min)) * 100;
function check(k) {
  const f = F[k], v = A[k];
  if (!isSet(k)) return "Please choose or enter a value.";
  if (f.type === "slider") {
    if (v < f.min) return `Must be at least ${f.min}.`;
    if (!f.open && v > f.max) return `Must be at most ${f.max}.`;
    if (f.int && !Number.isInteger(v)) return "Enter a whole number.";
  }
  return "";
}

/* ============ Wizard rendering ============ */
function qHTML(k) {
  const f = F[k], v = A[k];
  let body = "";
  if (f.type === "slider") {
    const val = v ?? f.start;
    body = `<input class="rng${v === undefined ? " off" : ""}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${Math.min(val, f.max)}" aria-label="${f.label}" style="--p:${pct(val, f)}%"><div class="ticks"><span>${f.min}</span><span>${f.max}${f.open ? "+" : ""}</span></div>`;
  } else if (f.type === "text") {
    body = `<div class="combo"><input class="txt" type="text" role="combobox" aria-expanded="false" aria-controls="cl" aria-autocomplete="list" value="${esc(v ?? "")}" placeholder="e.g. India" autocomplete="off" spellcheck="false" aria-label="${f.label}"><button type="button" class="combo-btn" tabindex="-1" aria-label="Show countries"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><ul class="combo-list" id="cl" role="listbox" hidden></ul></div>`;
  } else {
    body = `<div class="opts ${f.type}" role="radiogroup" aria-label="${f.label}">${f.opts.map((o) => `<button type="button" class="opt${v === o ? " on" : ""}" role="radio" aria-checked="${v === o}" data-v="${o}">${o}</button>`).join("")}</div>`;
  }
  const read = f.type === "slider"
    ? `<div class="read"><button type="button" class="stp" data-d="-1" aria-label="Decrease ${f.label}">−</button><output>${v ?? "—"}<small>${f.unit}</small></output><button type="button" class="stp" data-d="1" aria-label="Increase ${f.label}">+</button></div>` : "";
  return `<div class="q" data-k="${k}"><div class="q-head"><div><h4>${f.label}</h4><p>${f.hint}</p></div>${read}</div>${body}<p class="err"></p></div>`;
}
function renderStep() {
  const s = STEPS[step];
  $("#step-kicker").textContent = `Step ${step + 1} of ${STEPS.length}`;
  $("#step-title").textContent = s.t;
  $("#step-sub").textContent = s.d;
  $("#bar").style.width = ((step + 1) / STEPS.length) * 100 + "%";
  $("#dots").innerHTML = STEPS.map((_, i) => `<li><button type="button" data-goto="${i}" class="${i === step ? "on" : i < step ? "done" : ""}" aria-label="Go to step ${i + 1}" ${i === step ? 'aria-current="step"' : ""}>${i + 1}</button></li>`).join("");
  const body = $("#step-body");
  body.innerHTML = s.k.map(qHTML).join("") + (step === STEPS.length - 1 ? reviewHTML() : "");
  body.style.animation = "none"; void body.offsetWidth; body.style.animation = "";
  $("#back").style.visibility = step === 0 ? "hidden" : "visible";
  $("#next").textContent = step === STEPS.length - 1 ? "Estimate my score" : "Next";
  renderLive();
}
function reviewHTML() {
  return `<div class="review" id="review"><h4>Review your answers</h4>${KEYS.filter((k) => k !== "stress_level").map((k) => `<div><span>${F[k].label}</span><b>${fmt(k)}</b></div>`).join("")}</div>`;
}
function renderLive() {
  const n = KEYS.filter(isSet).length;
  $("#live-ring").style.strokeDasharray = `${(n / KEYS.length) * 100} 100`;
  $("#live-n").textContent = `${n}/${KEYS.length}`;
  $("#live-list").innerHTML = KEYS.map((k) => `<li><button type="button" data-goto="${stepOf(k)}"><span>${F[k].label}</span><b>${fmt(k)}</b></button></li>`).join("");
  const rv = $("#review");
  if (rv) rv.innerHTML = `<h4>Review your answers</h4>${KEYS.filter((k) => k !== "stress_level").map((k) => `<div><span>${F[k].label}</span><b>${fmt(k)}</b></div>`).join("")}`;
}
function setVal(k, val) {
  A[k] = val;
  const q = $(`.q[data-k="${k}"]`), f = F[k];
  if (q) {
    q.classList.remove("bad"); $(".err", q).textContent = "";
    if (f.type === "slider") {
      const r = $(".rng", q);
      r.value = Math.min(val, f.max); r.classList.remove("off"); r.style.setProperty("--p", pct(val, f) + "%");
      $("output", q).firstChild.textContent = val;
    } else if (f.type !== "text") {
      $$(".opt", q).forEach((o) => { const on = o.dataset.v === val; o.classList.toggle("on", on); o.setAttribute("aria-checked", on); });
    }
  }
  renderLive();
}
function showErr(k, msg) {
  const q = $(`.q[data-k="${k}"]`);
  if (!q) return;
  q.classList.add("bad"); $(".err", q).textContent = msg;
}
function validateStep(n) {
  let first = null;
  STEPS[n].k.forEach((k) => { const m = check(k); if (m) { showErr(k, m); first = first || k; } });
  if (first) $(`.q[data-k="${first}"]`).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  return !first;
}
function go(n) { step = Math.max(0, Math.min(STEPS.length - 1, n)); renderStep(); }

const body = $("#step-body");
body.addEventListener("input", (e) => {
  const q = e.target.closest(".q"); if (!q) return;
  const k = q.dataset.k;
  if (e.target.matches(".rng")) setVal(k, Number(e.target.value));
  else if (e.target.matches(".txt")) { const v = e.target.value.trim(); if (v) setVal(k, v); else { delete A[k]; renderLive(); } comboFilter(q); comboOpen(q, true); }
});
body.addEventListener("click", (e) => {
  const q = e.target.closest(".q"); if (!q) return;
  const k = q.dataset.k, f = F[k];
  const opt = e.target.closest(".opt"), stp = e.target.closest(".stp");
  if (opt) setVal(k, opt.dataset.v);
  const co = e.target.closest(".combo-opt"), cb = e.target.closest(".combo-btn");
  if (co) comboPick(q, co.dataset.v);
  else if (cb) { if (q.classList.contains("open")) comboOpen(q, false); else { $(".txt", q).focus(); comboFilter(q); comboOpen(q, true); } }
  else if (e.target.matches(".txt")) { comboFilter(q); comboOpen(q, true); }
  if (stp) {
    const dec = (String(f.step).split(".")[1] || "").length;
    let v = +((A[k] ?? f.start) + Number(stp.dataset.d) * f.step).toFixed(dec);
    v = Math.max(f.min, f.open ? v : Math.min(f.max, v));
    setVal(k, v);
  }
});
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto]");
  if (g) { go(Number(g.dataset.goto)); $("#assess").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
});
$("#back").addEventListener("click", () => go(step - 1));
$("#next").addEventListener("click", () => {
  if (!validateStep(step)) return;
  if (step < STEPS.length - 1) go(step + 1); else submit();
});


/* ---- Themed country combobox ---- */
function comboOpen(q, show) {
  const l = $(".combo-list", q), i = $(".txt", q);
  if (!l) return;
  l.hidden = !show; i.setAttribute("aria-expanded", show); q.classList.toggle("open", show);
  if (!show) $$(".active", l).forEach((x) => x.classList.remove("active"));
}
function comboFilter(q) {
  const i = $(".txt", q), l = $(".combo-list", q), raw = i.value.trim(), t = raw.toLowerCase();
  const items = COUNTRIES.filter((c) => c.toLowerCase().includes(t));
  const exact = COUNTRIES.some((c) => c.toLowerCase() === t);
  l.innerHTML = items.map((c) => `<li role="option" class="combo-opt${A.country === c ? " sel" : ""}" data-v="${c}">${c}</li>`).join("")
    + (t && !exact ? `<li role="option" class="combo-opt custom" data-v="${esc(raw)}">Use “${esc(raw)}”</li>` : "");
}
function comboPick(q, v) { $(".txt", q).value = v; setVal("country", v); comboOpen(q, false); }
body.addEventListener("keydown", (e) => {
  if (!e.target.matches(".txt")) return;
  const q = e.target.closest(".q"), l = $(".combo-list", q), opts = $$(".combo-opt", l);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (l.hidden) { comboFilter(q); comboOpen(q, true); return; }
    const cur = opts.findIndex((o) => o.classList.contains("active"));
    opts.forEach((o) => o.classList.remove("active"));
    const nxt = opts[(cur + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length];
    if (nxt) { nxt.classList.add("active"); nxt.scrollIntoView({ block: "nearest" }); }
  } else if (e.key === "Enter") {
    const a = $(".combo-opt.active", l); if (a) { e.preventDefault(); comboPick(q, a.dataset.v); } else comboOpen(q, false);
  } else if (e.key === "Escape" || e.key === "Tab") comboOpen(q, false);
});
document.addEventListener("click", (e) => { $$(".q.open").forEach((q) => { if (!q.contains(e.target)) comboOpen(q, false); }); });

/* ============ Prediction ============ */
const stages = () => $$("#stages li");
function setStage(i) {
  stages().forEach((li, j) => { li.className = j < i ? "done" : j === i ? "act" : ""; });
  $("#ov-bar").style.width = (i / stages().length) * 100 + "%";
}
let netCtl = null;
function overlay(show) {
  $("#overlay").hidden = !show;
  document.body.style.overflow = show ? "hidden" : "";
  if (show) { $("#ov-run").hidden = false; $("#ov-err").hidden = true; netCtl.start(); } else netCtl.stop();
}
function payload() {
  return Object.fromEntries(KEYS.map((k) => [k, F[k].type === "text" ? String(A[k]).trim() : A[k]]));
}
async function submit() {
  const bad = KEYS.find((k) => check(k));
  if (bad) { go(stepOf(bad)); validateStep(step); return; }
  overlay(true); setStage(0); await frame(); setStage(1);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()), signal: ctrl.signal });
    let data = null; try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) { const e = new Error("http"); e.status = res.status; e.body = data; throw e; }
    if (!data || typeof data.predicted_mental_health_score !== "number") { const e = new Error("shape"); e.status = res.status; throw e; }
    setStage(2); await frame(); setStage(3);
    renderResults(data.predicted_mental_health_score);
    await frame(); setStage(4);
    overlay(false);
    $("#results").hidden = false; $("#nav-results").hidden = false;
    $$("#results-body .rv:not(.in)").forEach((el) => revealIO.observe(el));
    $("#results").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    animateResults();
  } catch (err) { showError(err); } finally { clearTimeout(timer); }
}
let errFields = [];
function showError(err) {
  const list = $("#ov-err-list"); list.innerHTML = ""; errFields = [];
  let title = "Can't reach the model", msg = `Make sure the API is running at ${API} (uvicorn main:app --reload --port 2200).`;
  if (err.name === "AbortError") { title = "The request timed out"; msg = "The server took too long to answer. Please try again."; }
  else if (err.status === 422 && err.body && Array.isArray(err.body.detail)) {
    title = "Some answers need fixing"; msg = "The server rejected these values:";
    err.body.detail.forEach((d) => {
      const k = (d.loc || []).slice(-1)[0]; if (F[k]) errFields.push([k, d.msg]);
      const li = document.createElement("li"); li.textContent = `${F[k] ? F[k].label : k}: ${d.msg}`; list.appendChild(li);
    });
  } else if (err.status >= 500) { title = "The model couldn't process this"; msg = "The server hit an error while predicting. Check the uvicorn terminal. An unfamiliar country value is one common cause."; }
  else if (err.status) { title = `Request failed (${err.status})`; msg = "Unexpected response from the server."; }
  $("#ov-err-title").textContent = title; $("#ov-err-msg").textContent = msg;
  $("#ov-run").hidden = true; $("#ov-err").hidden = false;
}
$("#ov-retry").addEventListener("click", submit);
$("#ov-edit").addEventListener("click", () => {
  overlay(false);
  if (errFields.length) { go(stepOf(errFields[0][0])); errFields.forEach(([k, m]) => showErr(k, m)); }
});

/* ============ Results dashboard ============ */
const AXES = [["Sleep", "sleep_hours_per_night", 12, "h"], ["Study", "study_hours", 12, "h"], ["Social media", "avg_daily_usage_hours", 12, "h"], ["Activity", "physical_activity_hours", 4, "h"], ["Unlocks", "daily_unlocks", 200, "×"], ["Stress", "stress_level", 4, ""]];
const val = (k) => (k === "stress_level" ? F.stress_level.opts.indexOf(A[k]) + 1 : A[k]);
const nrm = (k, max) => Math.min(val(k) / max, 1);
const band = (s) => { const r = s / SCORE_MAX; return r < 0.4 ? "Lower part of the scale" : r < 0.7 ? "Middle of the scale" : "Upper part of the scale"; };
function recs() {
  const r = [];
  if (A.sleep_hours_per_night < 7) r.push(["Sleep", "Rest & routine", "Many adults feel better with a steady sleep schedule of around 7 to 9 hours. A consistent wind-down routine can help."]);
  if (A.avg_daily_usage_hours >= 5) r.push(["Screens", "Mindful breaks", "Short breaks from social media, or turning off non-essential notifications, can make scrolling feel more intentional."]);
  if (A.physical_activity_hours < 1) r.push(["Movement", "Gentle activity", "Even a short daily walk can lift energy and mood for many people. Start small and build slowly."]);
  if (A.stress_level === "High" || A.stress_level === "Very High") r.push(["Stress", "Pause and decompress", "Slow breathing, time outdoors, or talking things through with someone you trust can ease day-to-day stress."]);
  if (A.study_hours >= 8) r.push(["Study", "Protect your focus", "Regular short breaks between study blocks often help concentration and reduce fatigue."]);
  r.push(["Support", "Reach out when you need to", "If things feel heavy, a counsellor, doctor or trusted person can help. This tool cannot assess you and is not a substitute."]);
  const support = r.pop();
  return r.slice(0, 3).concat([support]);
}
function radarSVG() {
  const cx = 150, cy = 150, R = 100, n = AXES.length;
  const pt = (i, f) => [cx + Math.sin((i / n) * 6.2832) * R * f, cy - Math.cos((i / n) * 6.2832) * R * f];
  const ring = (f) => AXES.map((_, i) => pt(i, f).join(",")).join(" ");
  const poly = AXES.map((a, i) => pt(i, nrm(a[1], a[2])).join(",")).join(" ");
  return `<svg viewBox="0 0 300 300" role="img" aria-label="Radar chart of your habits scaled for display"><defs><linearGradient id="rd" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#28D7D5"/><stop offset="1" stop-color="#9474FF"/></linearGradient></defs>
  ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}" fill="none" stroke="rgba(28,42,61,.1)"/>`).join("")}
  ${AXES.map((a, i) => { const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(28,42,61,.08)"/><text x="${lx}" y="${ly}" fill="#55657a" font-size="11" text-anchor="middle" dominant-baseline="middle">${a[0]}</text>`; }).join("")}
  <polygon class="rpoly" points="${poly}" fill="url(#rd)" fill-opacity=".22" stroke="url(#rd)" stroke-width="2.5" stroke-linejoin="round"/>
  ${AXES.map((a, i) => { const [x, y] = pt(i, nrm(a[1], a[2])); const t = a[1] === "stress_level" ? A.stress_level : `${A[a[1]]} ${a[3]}`; return `<circle class="pt" cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#0f9d9a" stroke-width="3" data-r="${a[0]}: ${t}" tabindex="0"/>`; }).join("")}</svg>`;
}
function donutHTML() {
  const parts = [["Sleep", A.sleep_hours_per_night, "#28D7D5"], ["Study", A.study_hours, "#368BFF"], ["Activity", A.physical_activity_hours, "#9474FF"], ["Social media", A.avg_daily_usage_hours, "#5bb8e6"]];
  const used = parts.reduce((s, p) => s + p[1], 0);
  if (used < 24) parts.push(["Other", +(24 - used).toFixed(1), "#d8e2ec"]);
  const tot = Math.max(used, 24); let cum = 0;
  const segs = parts.map((p) => { const v = (p[1] / tot) * 100, d = Math.max(v - 0.8, 0); const s = `<circle cx="100" cy="100" r="70" stroke="${p[2]}" pathLength="100" stroke-dasharray="${d} ${100 - d}" stroke-dashoffset="${-cum}" data-r="${p[0]}" data-v="${p[1]} h"/>`; cum += v; return s; }).join("");
  return `<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="Donut chart of your reported hours in a day">${segs}</svg><div class="donut-c"><b id="dn-v">${+used.toFixed(1)} h</b><span id="dn-l">reported</span></div></div>
  <ul class="leg">${parts.map((p) => `<li><i style="background:${p[2]}"></i>${p[0]}<b>${p[1]} h</b></li>`).join("")}</ul></div>
  <p class="note-s">Social media may overlap with other activities, so totals can pass 24 h.</p>`;
}
function renderResults(score) {
  const pctScore = Math.max(0, Math.min(score / SCORE_MAX, 1)) * 100;
  const color = `hsl(${175 + pctScore * 1.1} 60% 38%)`;
  $("#results-body").innerHTML = `<div class="res">
  <div class="card w12 rv in" style="--i:0"><div class="score">
    <div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#28D7D5"/><stop offset=".55" stop-color="#368BFF"/><stop offset="1" stop-color="#9474FF"/></linearGradient></defs><circle class="trk" cx="50" cy="50" r="42" pathLength="100"/><circle class="fill" id="r-fill" cx="50" cy="50" r="42" pathLength="100" stroke="url(#rg)" data-p="${pctScore}"/></svg>
      <div class="ring-c"><b id="r-num" data-s="${score}" style="color:${color}">0.00</b><span>out of ${SCORE_MAX}</span></div></div>
    <div><span class="band">${band(score)}</span><h3>Your estimated score is ${score.toFixed(2)}</h3>
      <p>This number is the model's estimate based on the 12 answers you gave, shown on a 0 to ${SCORE_MAX} scale. It describes a statistical pattern and does not say anything about your worth or your future.</p>
      <div class="acts"><button class="btn" id="retake" type="button">Retake assessment</button><button class="btn btn-ghost" id="print" type="button">Save as PDF</button></div></div></div></div>
  <div class="card w5 rv" style="--i:1"><h3>Habits at a glance</h3><div class="hb">${AXES.map((a) => `<div class="hb-row"><span>${a[0]}</span><div class="track"><i data-w="${nrm(a[1], a[2]) * 100}"></i></div><b>${a[1] === "stress_level" ? A.stress_level : A[a[1]] + " " + a[3]}</b></div>`).join("")}</div><p class="note-s">Bars use a fixed display scale (e.g. 0 to 12 h). They are not targets or recommendations.</p></div>
  <div class="card w7 rv chart" style="--i:2"><h3 style="justify-self:start">Habit profile</h3>${radarSVG()}<div class="readout" id="radar-read">Hover or focus a point for details</div></div>
  <div class="card w12 rv" style="--i:3"><h3>A day in your reported hours</h3>${donutHTML()}</div>
  <div class="card w12 rv" style="--i:4"><h3>Your submitted answers</h3><div class="sum">${KEYS.map((k) => `<div><span>${F[k].label}</span><b>${fmt(k)}</b></div>`).join("")}</div></div>
  <div class="w12 rv" style="--i:5"><h3 style="margin:10px 0 16px;font-size:1.3rem">General wellness suggestions</h3><div class="recs">${recs().map((r) => `<article class="card rec"><small>${r[0]} · general suggestion</small><h3>${r[1]}</h3><p>${r[2]}</p></article>`).join("")}</div></div>
  <div class="card w12 figure-card rv disc" style="--i:6"><img src="data:image/jpeg;base64,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" alt="Illustration of a calm figure beside a rising chart" loading="lazy"><div><h3>Important to remember</h3><p>This is an experimental, educational estimate produced by a machine learning model. It is not a diagnosis, cannot see your full situation, and does not replace advice from a qualified mental health professional. Suggestions above are general ideas based on your answers, not outputs of the model. Your answers are sent only to the prediction API and are not stored by this page.</p></div></div></div>`;
  $("#retake").onclick = () => { $("#results").hidden = true; $("#nav-results").hidden = true; $("#results-body").innerHTML = ""; KEYS.forEach((k) => delete A[k]); go(0); $("#assess").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  $("#print").onclick = () => window.print();
  $$(".chart .pt").forEach((p) => { const show = () => { $("#radar-read").textContent = p.dataset.r; }; p.addEventListener("mouseenter", show); p.addEventListener("focus", show); });
  $$(".donut circle").forEach((c) => { c.addEventListener("mouseenter", () => { $("#dn-v").textContent = c.dataset.v; $("#dn-l").textContent = c.dataset.r; }); });
}
function animateResults() {
  const fill = $("#r-fill"), num = $("#r-num");
  if (!fill) return;
  requestAnimationFrame(() => {
    fill.style.strokeDasharray = `${fill.dataset.p} 100`;
    $$(".track i").forEach((i) => { i.style.width = i.dataset.w + "%"; });
    const target = Number(num.dataset.s), t0 = performance.now(), dur = reduce ? 1 : 1600;
    (function tick(now) { const t = Math.min((now - t0) / dur, 1); num.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(2); if (t < 1) requestAnimationFrame(tick); })(t0);
  });
}

/* ============ Canvas: ambient particles + layered network ============ */
function particles(canvas, { density, link }) {
  const c = canvas.getContext("2d"); let w, h, pts = [], raf = 0, run = false; const m = { x: -999, y: -999 };
  function size() {
    const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; canvas.width = w * d; canvas.height = h * d; c.setTransform(d, 0, 0, d, 0, 0);
    pts = Array.from({ length: Math.round((w * h) / density) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.5 + 0.9 }));
  }
  function draw() {
    c.clearRect(0, 0, w, h);
    for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]; c.fillStyle = "rgba(20,115,145,.8)"; c.beginPath(); c.arc(a.x, a.y, a.r, 0, 6.283); c.fill();
      for (let j = i + 1; j < pts.length; j++) { const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy); if (d < link) { c.strokeStyle = `rgba(60,110,190,${(1 - d / link) * 0.4})`; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } }
      if (Math.hypot(a.x - m.x, a.y - m.y) < 140) { c.strokeStyle = "rgba(15,157,154,.55)"; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(m.x, m.y); c.stroke(); }
    }
    if (run && !reduce) raf = requestAnimationFrame(draw);
  }
  addEventListener("resize", () => { size(); if (!run) draw(); });
  canvas.parentElement.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; });
  size();
  return { start() { if (run) return; run = true; draw(); }, stop() { run = false; cancelAnimationFrame(raf); } };
}
function layered(canvas) {
  const c = canvas.getContext("2d"); const L = [5, 7, 7, 5, 1]; let w, h, nodes = [], edges = [], pulses = [], raf = 0, run = false;
  function size() {
    const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height; canvas.width = w * d; canvas.height = h * d; c.setTransform(d, 0, 0, d, 0, 0);
    nodes = L.map((n, li) => Array.from({ length: n }, (_, i) => ({ x: w * (0.14 + 0.72 * (li / (L.length - 1))), y: h * (0.5 + (i - (n - 1) / 2) * (0.62 / 7)) })));
    edges = []; for (let l = 0; l < L.length - 1; l++) nodes[l].forEach((a) => nodes[l + 1].forEach((b) => edges.push([a, b])));
  }
  function draw() {
    c.clearRect(0, 0, w, h); c.lineWidth = 1;
    edges.forEach(([a, b]) => { c.strokeStyle = "rgba(63,130,228,.16)"; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
    if (Math.random() < 0.35) pulses.push({ e: edges[(Math.random() * edges.length) | 0], t: 0 });
    pulses = pulses.filter((p) => p.t < 1);
    pulses.forEach((p) => { p.t += 0.018; const [a, b] = p.e, x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t; c.fillStyle = "#0f9d9a"; c.shadowColor = "#0f9d9a"; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, 2.4, 0, 6.283); c.fill(); c.shadowBlur = 0; });
    nodes.flat().forEach((n) => { c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(125,105,226,.85)"; c.lineWidth = 1.5; c.beginPath(); c.arc(n.x, n.y, 5, 0, 6.283); c.fill(); c.stroke(); });
    if (run && !reduce) raf = requestAnimationFrame(draw);
  }
  addEventListener("resize", () => { if (run) size(); });
  return { start() { if (run) return; run = true; size(); draw(); }, stop() { run = false; cancelAnimationFrame(raf); } };
}
const bgNet = particles($("#bg-canvas"), { density: 13000, link: 130 });
bgNet.start();
document.addEventListener("visibilitychange", () => (document.hidden ? bgNet.stop() : bgNet.start()));
netCtl = layered($("#net-canvas"));

/* ============ Page interactions ============ */
const nav = $("#nav"), burger = $("#burger"), links = $("#links");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 10), { passive: true });
burger.addEventListener("click", () => { const o = links.classList.toggle("open"); burger.setAttribute("aria-expanded", o); });
links.addEventListener("click", () => { links.classList.remove("open"); burger.setAttribute("aria-expanded", false); });
const revealIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); } }), { threshold: 0.12 });
$$(".rv").forEach((el) => revealIO.observe(el));
const secIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) $$(".links a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
$$("main section").forEach((s) => secIO.observe(s));
document.addEventListener("pointermove", (e) => { const c = e.target.closest && e.target.closest(".card"); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); });

renderStep();
