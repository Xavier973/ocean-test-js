// ---- Constantes / lib ----
const SCALE = [
  ["Fortement en désaccord", 1],
  ["En désaccord", 2],
  ["Neutre", 3],
  ["D'accord", 4],
  ["Fortement d'accord", 5],
];
const LABELS = { O:"Ouverture", C:"Conscience", E:"Extraversion", A:"Agréabilité", N:"Névrosisme" };
const SCALE_MAP = Object.fromEntries(SCALE);

// Génère (texte, trait, reverse) pour 40
function expand40() {
  const order = ["O","C","E","A","N"];
  const out = [];
  for (const t of order) {
    for (const txt of BASES_40[t].pos) out.push([txt, t, false]);
    for (const txt of BASES_40[t].rev) out.push([txt, t, true]);
  }
  if (out.length !== 40) console.warn("Attendu 40 items, obtenu", out.length);
  return out;
}

// ---- Données : 120 items (résumé depuis ton Python) ----
// ... (garde la structure BASES_120 et expand120 ici, inchangée) ...


function expand120() {
  const order = ["O","C","E","A","N"];
  const out = [];
  for (const t of order) {
    for (const txt of BASES_120[t].pos) out.push([txt, t, false]);
    for (const txt of BASES_120[t].rev) out.push([txt, t, true]);
  }
  if (out.length !== 120) console.warn("Attendu 120 items, obtenu", out.length);
  return out;
}

// ---- Mécanique du test ----
const $ = sel => document.querySelector(sel);
const start = $("#screen-start");
const quiz = $("#screen-quiz");
const result = $("#screen-result");

let QUESTIONS = [];           // Array<[text, trait, reverse]>
let answers = [];             // valeurs 1..5 (ou null)
let i = 0;                    // index question courante (0-based)

const qTitle = $("#q-title");
const formScale = $("#form-scale");
const btnPrev = $("#btn-prev");
const btnNext = $("#btn-next");
const counter = $("#counter");
const progressInner = $("#progress-inner");
const titleVariant = $("#title-variant");

function scoreItem(val, reverse) { return reverse ? 6 - val : val; }
function toPercent(sum, count) { return Math.round((sum / (count * 5)) * 1000) / 10; }

function showScreen(which) {
  start.classList.toggle("hidden", which !== "start");
  quiz.classList.toggle("hidden", which !== "quiz");
  result.classList.toggle("hidden", which !== "result");
}

function renderQuestion() {
  const nb = QUESTIONS.length;
  const [text, , ] = QUESTIONS[i];
  qTitle.textContent = text;

  // radios
  formScale.innerHTML = "";
  for (const [lab, val] of SCALE) {
    const id = `scale_${val}`;
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio"; input.name = "scale"; input.value = String(val); input.id = id;
    if (answers[i] === val) input.checked = true;
    // if (answers[i] === val || (answers[i] == null && val === 3)) input.checked = true;
    label.appendChild(input);
    const s = document.createElement("span");
    s.textContent = `${val} — ${lab}`;
    label.appendChild(s);
    formScale.appendChild(label);
  }

  // compteur + progress
  counter.textContent = `${String(i+1).padStart(3,"0")}/${String(nb).padStart(3,"0")}`;
  progressInner.style.width = `${Math.round((i) / nb * 100)}%`;

  // boutons
  btnPrev.disabled = (i === 0);
  btnNext.textContent = (i === nb - 1) ? "Voir les résultats ▶" : "Suivant ▶";
  btnNext.disabled = (answers[i] == null);
  formScale.querySelectorAll('input[name="scale"]').forEach(input => {
  input.addEventListener('change', () => {
    btnNext.disabled = false;
    });
  });
}

function computeResults() {
  const sums = { O:0, C:0, E:0, A:0, N:0 };
  const counts = { O:0, C:0, E:0, A:0, N:0 };
  QUESTIONS.forEach(([_, trait, reverse], idx) => {
    const v = answers[idx];
    sums[trait] += scoreItem(v, reverse);
    counts[trait] += 1;
  });
  const res = {};
  for (const t of ["O","C","E","A","N"]) res[t] = toPercent(sums[t], counts[t]);
  return res;
}

function renderResults() {
  const res = computeResults();
  const wrap = document.getElementById("results");
  wrap.innerHTML = "";
  for (const t of ["O","C","E","A","N"]) {
    const row = document.createElement("div");
    row.className = "result-row";
    const label = document.createElement("div");
    label.style.width = "120px"; label.textContent = LABELS[t];
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.style.width = "0%";
    bar.appendChild(fill);
    const num = document.createElement("div");
    num.className = "res-num"; num.textContent = res[t].toFixed(1) + " %";
    row.appendChild(label); row.appendChild(bar); row.appendChild(num);
    wrap.appendChild(row);
    // animation
    requestAnimationFrame(()=> { fill.style.width = res[t] + "%"; });
  }

  // --- Profil interprété ---
  const profilDiv = document.getElementById("profil");
  const interpretation = generateInterpretation(res);
  profilDiv.innerHTML = `
    <div class="card" style="margin:24px 0;">
      <h2 style="margin-top:0">${interpretation.title}</h2>
      <p>${interpretation.text}</p>
    </div>
  `;

  // --- Radar Chart ---

  // ---- THEME COLORS for Chart.js ----
  const styles = getComputedStyle(document.documentElement);
  const FG = styles.getPropertyValue('--fg').trim() || '#e5e7eb';
  const FG_MUTED = styles.getPropertyValue('--fg-muted').trim() || '#9ca3af';
  const BORDER = styles.getPropertyValue('--border').trim() || '#1f2937';
  
  const ctx = document.getElementById('radarChart').getContext('2d');
  if (window.radarChartInstance) window.radarChartInstance.destroy(); // Nettoie l'ancien graphique si besoin
  window.radarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ["Ouverture", "Conscience", "Extraversion", "Agréabilité", "Névrosisme"],
      datasets: [{
        label: 'Votre profil',
        data: [res.O, res.C, res.E, res.A, res.N],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)'
      }]
    },
    options: {
      responsive: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20 }
        }
      }
    }
  });

  // --- Bouton PDF ---
  const btnPdf = document.getElementById("btn-pdf");
  btnPdf.onclick = async () => {
    const resultSection = document.getElementById("screen-result");
    btnPdf.style.visibility = "hidden";
    document.getElementById("btn-restart").style.visibility = "hidden";
    const canvas = await html2canvas(resultSection, {backgroundColor: "#fff", scale: 2});
    btnPdf.style.visibility = "";
    document.getElementById("btn-restart").style.visibility = "";
    const imgData = canvas.toDataURL("image/png");
    const pdf = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
    pdf.save("ocean_resultats.pdf");
  };
}

// ---- Événements ----
document.querySelectorAll("[data-start]").forEach(btn => {
  btn.addEventListener("click", () => {
    const n = Number(btn.getAttribute("data-start"));
    QUESTIONS = (n === 40) ? expand40() : expand120();
    answers = Array(QUESTIONS.length).fill(null);
    i = 0;
    titleVariant.textContent = `${n} items`;
    showScreen("quiz");
    renderQuestion();
  });
});

btnPrev.addEventListener("click", () => { if (i>0) { i--; renderQuestion(); }});

btnNext.addEventListener("click", () => {
  const sel = quiz.querySelector('input[name="scale"]:checked');
  if (!sel) { alert("Merci de sélectionner une réponse (1 à 5) avant de continuer."); return; }
  answers[i] = Number(sel.value);
  if (i < QUESTIONS.length - 1) {
    i++; renderQuestion();
  } else {
    // dernière question répondu
    progressInner.style.width = "100%";
    showScreen("result");
    renderResults();
  }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  showScreen("start");
});
// ---- Thème clair/sombre ----
(function(){
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);
  const btn = document.getElementById("btn-theme");
  if (btn) {
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", cur);
      localStorage.setItem("theme", cur);
    });
  }
})();