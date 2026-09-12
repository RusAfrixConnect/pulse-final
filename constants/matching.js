// ============================================================
// constants/matching.js — Taxonomie & algorithme de compatibilité
// pour le IA Matching (amitié + amour)
// Doit rester synchronisé avec INTEREST_KEYS / LOOKING_FOR_KEYS côté
// serveur (server.js) — le serveur filtre déjà toute clé absente
// de ces listes.
// ============================================================

export const INTEREST_OPTIONS = [
  { key: 'sport', emoji: '⚽', label: 'Sport' },
  { key: 'music', emoji: '🎵', label: 'Musique' },
  { key: 'travel', emoji: '✈️', label: 'Voyage' },
  { key: 'reading', emoji: '📚', label: 'Lecture' },
  { key: 'cooking', emoji: '🍳', label: 'Cuisine' },
  { key: 'gaming', emoji: '🎮', label: 'Gaming' },
  { key: 'art', emoji: '🎨', label: 'Art' },
  { key: 'nature', emoji: '🌿', label: 'Nature' },
  { key: 'fitness', emoji: '💪', label: 'Fitness' },
  { key: 'photography', emoji: '📷', label: 'Photo' },
  { key: 'dancing', emoji: '💃', label: 'Danse' },
  { key: 'tech', emoji: '💻', label: 'Tech' },
  { key: 'animals', emoji: '🐾', label: 'Animaux' },
  { key: 'fashion', emoji: '👗', label: 'Mode' },
  { key: 'movies', emoji: '🎬', label: 'Films' },
  { key: 'party', emoji: '🎉', label: 'Soirées' },
];
export const INTEREST_MAP = Object.fromEntries(INTEREST_OPTIONS.map(i => [i.key, i]));

export const LOOKING_FOR_OPTIONS = [
  { key: 'friendship', emoji: '🤝', label: 'Amitié' },
  { key: 'serious', emoji: '❤️', label: 'Relation sérieuse' },
  { key: 'casual', emoji: '✨', label: 'Rencontre' },
];
export const LOOKING_FOR_MAP = Object.fromEntries(LOOKING_FOR_OPTIONS.map(l => [l.key, l]));

// Compatibilité entre objectifs déclarés : 100 = objectif identique,
// valeurs intermédiaires = objectifs conciliables, 0 = incompatibles.
const LOOKING_FOR_COMPAT = {
  friendship: { friendship: 100, casual: 40, serious: 20 },
  casual:     { friendship: 40, casual: 100, serious: 55 },
  serious:    { friendship: 20, casual: 55, serious: 100 },
};

export const WEIGHTS = { interests: 0.40, lookingFor: 0.25, age: 0.15, proximity: 0.20 };

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Âge : score plein si même âge, dégressif jusqu'à 0 à 20 ans d'écart.
const ageScore = (ageA, ageB) => {
  if (!ageA || !ageB) return 60; // âge inconnu -> score neutre
  const diff = Math.abs(ageA - ageB);
  return clamp(Math.round(100 - diff * 6), 0, 100);
};

// Proximité : score plein si <1km, dégressif jusqu'à 0 à 50km.
const proximityScore = (distanceKm) => {
  if (distanceKm == null) return 50;
  return clamp(Math.round(100 - distanceKm * 2), 0, 100);
};

const interestsScore = (interestsA = [], interestsB = []) => {
  const setB = new Set(interestsB);
  const common = interestsA.filter(i => setB.has(i));
  const union = new Set([...interestsA, ...interestsB]);
  if (union.size === 0) return { score: 0, common: [] };
  return { score: Math.round((common.length / union.size) * 100), common };
};

const lookingForScore = (lookingForA, lookingForB) => {
  if (!lookingForA || !lookingForB) return 50;
  return LOOKING_FOR_COMPAT[lookingForA]?.[lookingForB] ?? 30;
};

// Calcule un score de compatibilité 0-100 entre l'utilisateur courant (`me`)
// et un profil candidat (`other`), avec le détail par critère pour l'affichage.
export function computeCompatibility(me, other) {
  const { score: intScore, common } = interestsScore(me?.interests, other?.interests);
  const lookScore = lookingForScore(me?.lookingFor, other?.lookingFor);
  const ageS = ageScore(me?.age, other?.age);
  const proxS = proximityScore(other?.distanceKm);

  const total = Math.round(
    intScore * WEIGHTS.interests +
    lookScore * WEIGHTS.lookingFor +
    ageS * WEIGHTS.age +
    proxS * WEIGHTS.proximity
  );

  return {
    score: clamp(total, 0, 100),
    commonInterests: common,
    breakdown: {
      interests: intScore,
      lookingFor: lookScore,
      age: ageS,
      proximity: proxS,
    },
  };
}

// Estime l'âge à partir d'une date de naissance "JJ/MM/AAAA". Retourne null si invalide.
export function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const parts = birthdate.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

// Profils enrichis pour le matching (indépendants des marqueurs de carte MOCK_USERS) :
// âge, "photos" (emojis façon carrousel), bio, ville, distance, objectif recherché.
export const MATCH_PROFILES = [
  { id: 101, name: 'Sofia', age: 27, avatar: '👩', photos: ['🧘', '🌅', '📷'],
    city: 'Paris', distanceKm: 0.3, verified: true, zndScore: 890, friends: 89,
    bio: 'Prof de yoga, amoureuse du soleil levant et des grands voyages 🌍',
    lookingFor: 'serious', interests: ['sport', 'nature', 'travel', 'photography'] },
  { id: 102, name: 'Alex', age: 29, avatar: '👨', photos: ['🏃', '⚽', '🎮'],
    city: 'Paris', distanceKm: 0.5, verified: true, zndScore: 1240, friends: 124,
    bio: 'Passionné de sport et de crypto 🚀 Toujours partant pour un match.',
    lookingFor: 'friendship', interests: ['sport', 'gaming', 'tech'] },
  { id: 103, name: 'Marcus', age: 31, avatar: '🧑', photos: ['⚽', '💼', '🎬'],
    city: 'Paris', distanceKm: 1.2, verified: false, zndScore: 2100, friends: 256,
    bio: 'Football le week-end, blockchain la semaine 🔥',
    lookingFor: 'casual', interests: ['sport', 'movies', 'tech'] },
  { id: 104, name: 'Priya', age: 26, avatar: '👩', photos: ['💻', '☕', '🎨'],
    city: 'Mumbai', distanceKm: 3.5, verified: true, zndScore: 3400, friends: 412,
    bio: 'Dev React Native le jour, artiste la nuit 🎨 Fan de crypto.',
    lookingFor: 'serious', interests: ['tech', 'art', 'cooking'] },
  { id: 105, name: 'Léa', age: 24, avatar: '👩', photos: ['💃', '🎉', '🎵'],
    city: 'Paris', distanceKm: 0.8, verified: true, zndScore: 640, friends: 73,
    bio: "J'adore danser et sortir ! À la recherche de bons moments ✨",
    lookingFor: 'casual', interests: ['dancing', 'music', 'party', 'fashion'] },
  { id: 106, name: 'Diego', age: 28, avatar: '🧑', photos: ['🍳', '📚', '🌿'],
    city: 'Madrid', distanceKm: 12, verified: false, zndScore: 780, friends: 58,
    bio: 'Cuisinier amateur, toujours un livre sous le bras 📖',
    lookingFor: 'friendship', interests: ['cooking', 'reading', 'nature'] },
  { id: 107, name: 'Amara', age: 30, avatar: '👩', photos: ['🐾', '🌿', '📷'],
    city: 'Lagos', distanceKm: 25, verified: true, zndScore: 1560, friends: 187,
    bio: 'Vétérinaire, deux chiens, mille voyages 🐾✈️',
    lookingFor: 'serious', interests: ['animals', 'nature', 'travel', 'photography'] },
  { id: 108, name: 'Nina', age: 25, avatar: '👩', photos: ['🎨', '🎬', '🎵'],
    city: 'Moscou', distanceKm: 18, verified: false, zndScore: 520, friends: 41,
    bio: 'Étudiante en art, cinéphile assumée 🎬',
    lookingFor: 'casual', interests: ['art', 'movies', 'music'] },
  { id: 109, name: 'Karim', age: 33, avatar: '🧑', photos: ['💪', '⚽', '🎮'],
    city: 'Paris', distanceKm: 2.1, verified: true, zndScore: 1980, friends: 203,
    bio: 'Coach fitness, compétiteur dans l\'âme 💪',
    lookingFor: 'friendship', interests: ['fitness', 'sport', 'gaming'] },
  { id: 110, name: 'Yuki', age: 26, avatar: '👩', photos: ['📷', '✈️', '🍳'],
    city: 'Delhi', distanceKm: 7, verified: true, zndScore: 990, friends: 96,
    bio: 'Photographe de voyage, toujours entre deux avions 📸',
    lookingFor: 'serious', interests: ['photography', 'travel', 'cooking'] },
];
