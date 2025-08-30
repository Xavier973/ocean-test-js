// ---------- 1) Discrétisation des scores ----------
function levelOf(pct) {
  // seuils simples : [0–39]=low, [40–69]=mid, [70–100]=high
  if (pct < 40) return "low";
  if (pct < 70) return "mid";
  return "high";
}

function levelsFromResults(res) {
  // res attendu: { O:0-100, C:..., E:..., A:..., N:... }
  return {
    O: levelOf(res.O),
    C: levelOf(res.C),
    E: levelOf(res.E),
    A: levelOf(res.A),
    N: levelOf(res.N),
  };
}

// petit util utile pour comparer des niveaux (low=0, mid=1, high=2)
const LV = { low: 0, mid: 1, high: 2 };

// ---------- 2) Table de profils composés ----------
// Chaque profil définit des conditions par trait (tableau de niveaux acceptés)
// + une fonction description(res) qui crée le paragraphe final.
const PROFILES = [
  {
    key: "exemplaire",
    name: "Exemplaire",
    // Ouverture, Conscience, Extraversion, Agréabilité élevés, Névrosisme faible
    cond: { O:["high"], C:["high"], E:["high"], A:["high"], N:["low"] },
    description: (r) => (
      "Votre profil combine curiosité, rigueur, sociabilité et bienveillance, " +
      "avec une bonne stabilité émotionnelle. Vous avez souvent des qualités " +
      "de leader naturel : fiable, ouvert aux idées nouvelles et capable de " +
      "coordonner les autres. Attention toutefois au perfectionnisme et au " +
      "surchargement si vous acceptez trop de responsabilités."
    )
  },
  {
    key: "explorateur_serein",
    name: "Explorateur serein",
    // Ouverture haute + Névrosisme faible ; le reste plutôt moyen (souple)
    cond: { O:["high"], C:["mid","high"], E:["mid"], A:["mid","high"], N:["low"] },
    description: (r) => (
      "Créatif, curieux et à l’aise avec la nouveauté, vous gardez un bon " +
      "sang-froid face à l’imprévu. Votre équilibre entre structure et " +
      "souplesse favorise l’adaptabilité. Le risque : vous éparpiller si " +
      "trop de pistes excitantes s’ouvrent en même temps."
    )
  },
  {
    key: "consciencieux_pragmatique",
    name: "Consciencieux pragmatique",
    // Conscience haute ; Ouverture moyenne/baixa ; Névrosisme moyen/low ; E et A au milieu
    cond: { O:["low","mid"], C:["high"], E:["mid"], A:["mid","high"], N:["low","mid"] },
    description: (r) => (
      "Organisé et fiable, vous privilégiez l’efficacité et la méthode. " +
      "Plutôt terre-à-terre, vous aimez les procédures claires et les objectifs " +
      "bien définis. À surveiller : une possible réticence au changement ou " +
      "aux idées trop théoriques."
    )
  },
  {
    key: "introverti_anxieux",
    name: "Introverti anxieux",
    // Extraversion basse, Névrosisme haut ; Conscience et Agréabilité plutôt hautes ; Ouverture plutôt basse
    cond: { O:["low","mid"], C:["mid","high"], E:["low"], A:["mid","high"], N:["high"] },
    description: (r) => (
      "Réservé, sensible au stress et très consciencieux, vous anticipez " +
      "beaucoup pour éviter l’imprévu. Vous êtes bienveillant et fiable, " +
      "mais pouvez vous freiner par excès d’inquiétude. Travailler l’exposition " +
      "graduelle et l’auto-compassion peut aider."
    )
  },
  {
    key: "reserve",
    name: "Réservé",
    // Extraversion basse, Névrosisme bas ; Conscience et Agréabilité plutôt hautes ; Ouverture plutôt basse
    cond: { O:["low","mid"], C:["mid","high"], E:["low"], A:["mid","high"], N:["low"] },
    description: (r) => (
      "Calme, posé et fiable, vous préférez écouter que vous exposer. " +
      "Vous appréciez les environnements stables et coopératifs. " +
      "Le revers : passer sous le radar ou refuser des opportunités par excès de discrétion."
    )
  },
  {
    key: "egocentrique",
    name: "Égocentrique",
    // Extraversion haute, Agréabilité basse, Conscience basse, Ouverture plutôt basse/mid, Névrosisme médian
    cond: { O:["low","mid"], C:["low"], E:["high"], A:["low"], N:["mid","low"] },
    description: (r) => (
      "À l’aise pour vous mettre en avant, direct et compétitif, vous " +
      "avancez vite… parfois sans filet. L’impact social peut pâtir d’un " +
      "style trop centré sur vous ou d’un manque de fiabilité. Un peu " +
      "plus d’empathie et de planification ferait des miracles."
    )
  },
  {
    key: "equilibre",
    name: "Équilibré",
    // Tous dans la fourchette moyenne (aucun extrême)
    cond: { O:["mid"], C:["mid"], E:["mid"], A:["mid"], N:["mid"] },
    description: (r) => (
      "Profil versatile et adaptable, sans traits extrêmes. Vous pouvez " +
      "vous ajuster à beaucoup de contextes et équipes. Le point d’attention : " +
      "définir une direction claire pour éviter la dispersion."
    )
  },
  {
    key: "creatif_sensible",
    name: "Créatif sensible",
    // Ouverture haute, Névrosisme haut ; Extraversion basse/mid ; Conscience et Agréabilité mid
    cond: { O:["high"], C:["mid"], E:["low","mid"], A:["mid","high"], N:["high"] },
    description: (r) => (
      "Imaginatif et profond, vous ressentez intensément. Votre richesse " +
      "d’idées est un atout majeur, mais la surcharge émotionnelle peut " +
      "vous freiner. Ritualiser l’hygiène mentale aide à canaliser la créativité."
    )
  },
];

// ---------- 3) Moteur d’appariement ----------
// On calcule un score de match (plus c’est grand, mieux c’est) et un coût de distance (plus c’est petit, mieux c’est).
function matchScore(levels, profile) {
  let hits = 0;
  let distance = 0;
  for (const t of ["O","C","E","A","N"]) {
    const accepted = profile.cond[t];              // ex: ["mid","high"]
    const my = levels[t];                          // ex: "mid"
    // correspondance binaire
    if (accepted.includes(my)) hits += 1;
    // coût de distance minimal si pas dans la liste (tolérance)
    const dMin = Math.min(...accepted.map(a => Math.abs(LV[a] - LV[my])));
    distance += dMin;
  }
  // renvoie un score global : d’abord nombre d’items qui matchent, puis distance inversée
  return { hits, distance };
}

function bestProfile(res) {
  const lv = levelsFromResults(res);
  let best = null;
  for (const p of PROFILES) {
    const s = matchScore(lv, p);
    if (!best) best = { p, ...s };
    else {
      // priorité : plus de hits ; à égalité, distance plus faible
      if (s.hits > best.hits || (s.hits === best.hits && s.distance < best.distance)) {
        best = { p, ...s };
      }
    }
  }
  return best.p;
}

// ---------- 4) Génération du paragraphe ----------
// Appelle ceci après ton rendu (une fois que tu as `res = {O,C,E,A,N}`)
function generateInterpretation(res) {
  const p = bestProfile(res);
  const header = `Profil suggéré : ${p.name}`;
  const text = p.description(res);
  return { key: p.key, title: header, text };
}
