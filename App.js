import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform, StatusBar, ScrollView,
  TextInput, Modal, FlatList, KeyboardAvoidingView
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Linking } from 'react-native';
import VALTDashboard from './screens/VALTDashboard';
import CreatePledgeScreen from './screens/CreatePledgeScreen';
import { GenerateQRScreen, ScanQRScreen } from './screens/QRScreen';
import MatchingScreen from './screens/MatchingScreen';
import { walletService } from './services/valtService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'pulse_auth_token';
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
// Persiste l'adresse wallet VALT côté serveur (users.wallet_address) une fois résolue,
// pour qu'elle survienne à une reconnexion sur un autre appareil.
const persistWalletAddress = async (walletAddress) => {
  try {
    await fetch(`${API_URL}/users/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ walletAddress }),
    });
  } catch (err) {
    console.log('[persistWalletAddress] échec :', err.message);
  }
};
// Appelle les routes /economy/* server-authoritative (bug #13) : le serveur calcule/valide
// les montants ZND, le client ne fait plus confiance à son propre state pour créditer/débiter.
const callEconomy = async (path, body) => {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(body || {}),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const translations = {
  fr: {
    live: 'EN DIRECT', nearYou: 'Près de toi', events: 'Events',
    treasures: 'Trésors', createEvent: '+ Créer', joinEarn: 'Rejoindre — Gagner',
    add: 'Ajouter', all: '🌍 Tout',
    sport: 'Sport', social: 'Social', music: 'Musique', food: 'Food',
    treasure: 'Trésor ZND', job: 'Job', participants: 'participants',
    zndToday: 'ZND/auj.', search: 'Rechercher activités, jobs, annonces...',
    profile: 'Profil', messages: 'Messages', groups: 'Groupes',
    shop: 'Acheter', map: 'Carte', sendMessage: 'Envoyer un message',
    createGroup: 'Créer un groupe', buyZnd: 'Acheter ZND',
    friends: 'Amis', activities: 'Activités',
    join: 'Rejoindre', send: 'Envoyer',
    newGroup: 'Nouveau groupe', groupName: 'Nom du groupe',
    noResults: 'Aucun résultat',
    wallet: 'Portefeuille', balance: 'Solde',
    tagline: 'Rencontre, explore & gagne des ZND',
    login: 'Se connecter', register: 'Créer un compte',
    name: 'Ton prénom', email: 'Email', password: 'Mot de passe',
    confirmPwd: 'Confirmer le mot de passe',
    haveAccount: 'Déjà un compte ?', noAccount: 'Pas encore de compte ?',
    orWith: 'Ou continuer avec', terms: 'En continuant, tu acceptes nos CGU',
    nameError: 'Prénom requis', emailError: 'Email invalide',
    passwordError: '6 caractères minimum',
    confirmError: 'Les mots de passe ne correspondent pas',
    walletCreated: '✅ Wallet ZND créé automatiquement !',
    joinNow: 'Rejoindre Pulse', logout: 'Déconnexion',
    forgotPassword: 'Mot de passe oublié ?',
  },
  en: {
    live: 'LIVE', nearYou: 'Near you', events: 'Events',
    treasures: 'Treasures', createEvent: '+ Create', joinEarn: 'Join — Earn',
    add: 'Add friend', all: '🌍 All',
    sport: 'Sport', social: 'Social', music: 'Music', food: 'Food',
    treasure: 'ZND Treasure', job: 'Job', participants: 'participants',
    zndToday: 'ZND/today', search: 'Search activities, jobs, ads...',
    profile: 'Profile', messages: 'Messages', groups: 'Groups',
    shop: 'Shop', map: 'Map', sendMessage: 'Send a message',
    createGroup: 'Create group', buyZnd: 'Buy ZND',
    friends: 'Friends', activities: 'Activities',
    join: 'Join', send: 'Send',
    newGroup: 'New group', groupName: 'Group name',
    noResults: 'No results',
    wallet: 'Wallet', balance: 'Balance',
    tagline: 'Meet, explore & earn ZND',
    login: 'Log in', register: 'Create account',
    name: 'Your first name', email: 'Email', password: 'Password',
    confirmPwd: 'Confirm password',
    haveAccount: 'Already have an account?', noAccount: 'No account yet?',
    orWith: 'Or continue with', terms: 'By continuing, you agree to our Terms',
    nameError: 'First name required', emailError: 'Invalid email',
    passwordError: 'Minimum 6 characters',
    confirmError: 'Passwords do not match',
    walletCreated: '✅ ZND Wallet created automatically!',
    joinNow: 'Join Pulse', logout: 'Log out',
    forgotPassword: 'Forgot password?',
  },
  it: {
    live: 'IN DIRETTA', nearYou: 'Vicino a te', events: 'Eventi',
    treasures: 'Tesori', createEvent: '+ Crea', joinEarn: 'Unisciti — Guadagna',
    add: 'Aggiungi', all: '🌍 Tutto',
    sport: 'Sport', social: 'Sociale', music: 'Musica', food: 'Cibo',
    treasure: 'Tesoro ZND', job: 'Lavoro', participants: 'partecipanti',
    zndToday: 'ZND/oggi', search: 'Cerca attività, lavori, annunci...',
    profile: 'Profilo', messages: 'Messaggi', groups: 'Gruppi',
    shop: 'Compra', map: 'Mappa', sendMessage: 'Invia un messaggio',
    createGroup: 'Crea gruppo', buyZnd: 'Compra ZND',
    friends: 'Amici', activities: 'Attività',
    join: 'Unisciti', send: 'Invia',
    newGroup: 'Nuovo gruppo', groupName: 'Nome del gruppo',
    noResults: 'Nessun risultato',
    wallet: 'Portafoglio', balance: 'Saldo',
    tagline: 'Incontra, esplora e guadagna ZND',
    login: 'Accedi', register: 'Crea un account',
    name: 'Il tuo nome', email: 'Email', password: 'Password',
    confirmPwd: 'Conferma password',
    haveAccount: 'Hai già un account?', noAccount: 'Non hai ancora un account?',
    orWith: 'Oppure continua con', terms: 'Continuando, accetti i nostri Termini',
    nameError: 'Nome richiesto', emailError: 'Email non valida',
    passwordError: 'Minimo 6 caratteri',
    confirmError: 'Le password non corrispondono',
    walletCreated: '✅ Wallet ZND creato automaticamente!',
    joinNow: 'Unisciti a Pulse', logout: 'Esci',
    forgotPassword: 'Password dimenticata?',
  },
  hi: {
    live: 'लाइव', nearYou: 'पास में', events: 'इवेंट',
    treasures: 'खजाने', createEvent: '+ बनाएं', joinEarn: 'जुड़ें — कमाएं',
    add: 'जोड़ें', all: '🌍 सभी',
    sport: 'खेल', social: 'सामाजिक', music: 'संगीत', food: 'खाना',
    treasure: 'ZND खजाना', job: 'नौकरी', participants: 'प्रतिभागी',
    zndToday: 'ZND/आज', search: 'गतिविधियां, नौकरी खोजें...',
    profile: 'प्रोफ़ाइल', messages: 'संदेश', groups: 'समूह',
    shop: 'खरीदें', map: 'नक्शा', sendMessage: 'संदेश भेजें',
    createGroup: 'समूह बनाएं', buyZnd: 'ZND खरीदें',
    friends: 'दोस्त', activities: 'गतिविधियां',
    join: 'जुड़ें', send: 'भेजें',
    newGroup: 'नया समूह', groupName: 'समूह का नाम',
    noResults: 'कोई परिणाम नहीं',
    wallet: 'वॉलेट', balance: 'शेष',
    tagline: 'मिलें, खोजें और ZND कमाएं',
    login: 'लॉग इन करें', register: 'खाता बनाएं',
    name: 'आपका नाम', email: 'ईमेल', password: 'पासवर्ड',
    confirmPwd: 'पासवर्ड की पुष्टि करें',
    haveAccount: 'पहले से खाता है?', noAccount: 'अभी खाता नहीं है?',
    orWith: 'या इसके साथ जारी रखें',
    terms: 'जारी रखने पर आप हमारी शर्तें स्वीकार करते हैं',
    nameError: 'नाम आवश्यक है', emailError: 'अमान्य ईमेल',
    passwordError: 'न्यूनतम 6 अक्षर',
    confirmError: 'पासवर्ड मेल नहीं खाते',
    walletCreated: '✅ ZND वॉलेट स्वतः बनाया गया!',
    joinNow: 'Pulse से जुड़ें', logout: 'लॉग आउट',
    forgotPassword: 'पासवर्ड भूल गए?',
  },
  ru: {
    live: 'ПРЯМОЙ ЭФИР', nearYou: 'Рядом с тобой', events: 'События',
    treasures: 'Клады', createEvent: '+ Создать', joinEarn: 'Присоединиться — Заработать',
    add: 'Добавить', all: '🌍 Все',
    sport: 'Спорт', social: 'Общение', music: 'Музыка', food: 'Еда',
    treasure: 'Клад ZND', job: 'Работа', participants: 'участников',
    zndToday: 'ZND/сег.', search: 'Поиск активностей, работы, объявлений...',
    profile: 'Профиль', messages: 'Сообщения', groups: 'Группы',
    shop: 'Магазин', map: 'Карта', sendMessage: 'Отправить сообщение',
    createGroup: 'Создать группу', buyZnd: 'Купить ZND',
    friends: 'Друзья', activities: 'Активности',
    join: 'Присоединиться', send: 'Отправить',
    newGroup: 'Новая группа', groupName: 'Название группы',
    noResults: 'Ничего не найдено',
    wallet: 'Кошелёк', balance: 'Баланс',
    tagline: 'Знакомься, исследуй и зарабатывай ZND',
    login: 'Войти', register: 'Создать аккаунт',
    name: 'Твоё имя', email: 'Email', password: 'Пароль',
    confirmPwd: 'Подтвердить пароль',
    haveAccount: 'Уже есть аккаунт?', noAccount: 'Ещё нет аккаунта?',
    orWith: 'Или продолжить через', terms: 'Продолжая, ты принимаешь наши Условия',
    nameError: 'Имя обязательно', emailError: 'Неверный email',
    passwordError: 'Минимум 6 символов',
    confirmError: 'Пароли не совпадают',
    walletCreated: '✅ Кошелёк ZND создан автоматически!',
    joinNow: 'Присоединиться к Pulse', logout: 'Выйти',
    forgotPassword: 'Забыли пароль?',
  },
};

const EVENT_TYPES = {
  sport:    { emoji: '⚽', color: '#10b981', label: 'sport'    },
  social:   { emoji: '🎉', color: '#6B21A8', label: 'social'   },
  music:    { emoji: '🎵', color: '#f59e0b', label: 'music'    },
  food:     { emoji: '🍕', color: '#ef4444', label: 'food'     },
  treasure: { emoji: '💎', color: '#C9A84C', label: 'treasure' },
  job:      { emoji: '💼', color: '#3b82f6', label: 'job'      },
};

const MOCK_EVENTS = [
  { id: 1, type: 'sport', title: 'Match de foot',
    description: '5v5 au parc !', city: 'Paris',
    lat: 48.858, lng: 2.354, participants: 7, maxP: 10, zndReward: 50, distance: '200m' },
  { id: 2, type: 'social', title: 'Apéro rooftop',
    description: 'Soirée détente', city: 'Paris',
    lat: 48.855, lng: 2.350, participants: 12, maxP: 20, zndReward: 30, distance: '450m' },
  { id: 3, type: 'music', title: 'Session Jam',
    description: 'Musiciens bienvenus', city: 'Londres',
    lat: 51.505, lng: -0.090, participants: 4, maxP: 8, zndReward: 40, distance: '800m' },
  { id: 4, type: 'treasure', title: 'Trésor ZND 💎',
    description: '200 ZND cachés ici !', city: 'Mumbai',
    lat: 19.076, lng: 72.877, participants: 0, maxP: 1, zndReward: 200, distance: '1.2km' },
  { id: 5, type: 'job', title: 'Développeur React Native',
    description: 'Mission 3 mois, 500 ZND/semaine', city: 'Remote',
    lat: 48.857, lng: 2.345, participants: 0, maxP: 2, zndReward: 500, distance: '300m' },
  { id: 6, type: 'sport', title: 'Yoga matinal',
    description: 'Session yoga au lever du soleil', city: 'Delhi',
    lat: 28.613, lng: 77.209, participants: 8, maxP: 15, zndReward: 30, distance: '1km' },
  { id: 7, type: 'job', title: 'Livreur vélo',
    description: 'Livraisons locales, 20 ZND/heure', city: 'Madrid',
    lat: 40.416, lng: -3.703, participants: 0, maxP: 5, zndReward: 80, distance: '500m' },
  { id: 8, type: 'social', title: 'Cours de français',
    description: 'Échange linguistique FR/EN', city: 'Moscou',
    lat: 55.751, lng: 37.618, participants: 3, maxP: 6, zndReward: 25, distance: '2km' },
];

const MOCK_USERS = [
  { id: 1, name: 'Alex', avatar: '👨', activity: 'Running 🏃', zndScore: 1240,
    lat: 48.8570, lng: 2.3510, distance: '150m', bio: 'Passionné de sport et crypto 🚀',
    friends: 124, interests: ['sport', 'music'] },
  { id: 2, name: 'Sofia', avatar: '👩', activity: 'Yoga 🧘', zndScore: 890,
    lat: 48.8550, lng: 2.3540, distance: '320m', bio: 'Yoga teacher & ZND holder 💜',
    friends: 89, interests: ['sport', 'social'] },
  { id: 3, name: 'Marcus', avatar: '🧑', activity: 'Cherche équipe ⚽', zndScore: 2100,
    lat: 48.8580, lng: 2.3530, distance: '500m', bio: 'Football & blockchain 🔥',
    friends: 256, interests: ['sport', 'job'] },
  { id: 4, name: 'Priya', avatar: '👩', activity: 'Coding 💻', zndScore: 3400,
    lat: 19.076, lng: 72.877, distance: '1km', bio: 'Dev React Native & crypto fan 🇮🇳',
    friends: 412, interests: ['job', 'social'] },
];

const MOCK_GROUPS = [
  { id: 1, name: 'Crypto Paris 🇫🇷', members: 234, emoji: '💎', description: 'Communauté crypto parisienne' },
  { id: 2, name: 'Sport Mumbai 🏏', members: 567, emoji: '⚽', description: 'Sport et activités à Mumbai' },
  { id: 3, name: 'ZND Holders 🚀', members: 1203, emoji: '🌍', description: 'Communauté ZND mondiale' },
  { id: 4, name: 'Jobs Remote 💼', members: 89, emoji: '💼', description: "Offres d'emploi remote payées en ZND" },
];

const MOCK_MESSAGES = [
  { id: 1, user: 'Alex', avatar: '👨', text: 'Salut, tu viens au match ce soir ?', time: '14:32', unread: 2 },
  { id: 2, user: 'Sofia', avatar: '👩', text: "J'ai reçu mes 50 ZND, merci !", time: '13:15', unread: 0 },
  { id: 3, user: 'Priya', avatar: '👩', text: 'Tu connais un bon dev React Native ?', time: '12:00', unread: 1 },
  { id: 4, user: 'Marcus', avatar: '🧑', text: 'Le trésor ZND est encore dispo !', time: '11:45', unread: 0 },
];

const SHOP_ITEMS = [
  { id: 1, name: '100 ZND', price: 0.5, emoji: '💎', description: 'Pack débutant' },
  { id: 2, name: '500 ZND', price: 2.5, emoji: '💎', description: 'Pack standard' },
  { id: 3, name: '2000 ZND', price: 9, emoji: '💎', description: 'Pack premium' },
  { id: 4, name: '10000 ZND', price: 40, emoji: '💎', description: 'Pack whale 🐋' },
  { id: 5, name: 'Boost 24h', price: 50, emoji: '🚀', description: 'Visibilité x2' },
  { id: 6, name: 'Badge Gold', price: 200, emoji: '👑', description: 'Statut premium' },
];

const MOCK_BUSINESSES = [
  { id: 1, name: 'Café Pulse ☕', type: 'food', lat: 48.856, lng: 2.353,
    description: 'Café cosy, -10% en ZND', zndDiscount: 10, emoji: '☕',
    revenue: 1240, orders: 47, rating: 4.8 },
  { id: 2, name: 'FitZone 🏋️', type: 'sport', lat: 48.859, lng: 2.349,
    description: 'Salle de sport, abonnement en ZND', zndDiscount: 15, emoji: '🏋️',
    revenue: 3200, orders: 89, rating: 4.6 },
  { id: 3, name: 'Pizza Crypto 🍕', type: 'food', lat: 19.077, lng: 72.876,
    description: 'Pizza livrée, paiement ZND', zndDiscount: 20, emoji: '🍕',
    revenue: 890, orders: 34, rating: 4.9 },
  { id: 4, name: 'Tech Store 💻', type: 'job', lat: 28.612, lng: 77.210,
    description: 'Réparations et accessoires', zndDiscount: 5, emoji: '💻',
    revenue: 450, orders: 12, rating: 4.7 },
];

// ── WALLET BSC RÉEL ──────────────────────────
const API_URL      = 'https://pulse-backend-9zpb.onrender.com';

export default function App() {
  const [screen, setScreen]         = useState('map_preview');
  const [authUser, setAuthUser]     = useState(null);
  const [form, setForm] = useState({ 
  name: '', 
  email: '', 
  password: '', 
  confirmPassword: '',
  birthdate: '',
  country: '',
  city: '',
});
  const [errors, setErrors]         = useState({});
  const [lang, setLang]             = useState('fr');
  const [activeTab, setActiveTab]   = useState('map');
  const [filterActive, setFilter]   = useState('all');
  const [selectedItem, setSelected] = useState(null);
  const [searchQuery, setSearch]    = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName]   = useState('');
  const [chatUser, setChatUser]     = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [mapRegion, setMapRegion]   = useState({
    latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80,
  });
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', type: 'sport', maxP: '10', zndReward: '50'
  });
  const [userLocation, setUserLocation] = useState(null);
  const [steps, setSteps]           = useState(0);
  const [zndEarned, setZndEarned]   = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const earnInterval                = useRef(null);
  const trackingStartedAt           = useRef(null);
  const liveSessionId               = useRef(null);
  const [treasures, setTreasures]   = useState([
    { id: 1, lat: 48.860, lng: 2.352, znd: 200, found: false, emoji: '💎' },
    { id: 2, lat: 19.078, lng: 72.879, znd: 500, found: false, emoji: '🏆' },
    { id: 3, lat: 28.615, lng: 77.211, znd: 150, found: false, emoji: '⭐' },
    { id: 4, lat: 51.507, lng: -0.088, znd: 300, found: false, emoji: '🎁' },
  ]);
  const [treasureFound, setTreasureFound] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showBusinessDash, setShowBusinessDash] = useState(false);
  const [activeBusiness, setActiveBusiness]     = useState(MOCK_BUSINESSES[0]);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'message', text: "Alex t'a envoyé un message 💬", time: '2min', read: false },
    { id: 2, type: 'treasure', text: 'Un trésor de 200 ZND est près de toi ! 💎', time: '5min', read: false },
    { id: 3, type: 'event', text: 'Nouveau event Sport près de toi ⚽', time: '10min', read: true },
    { id: 4, type: 'znd', text: '+50 ZND crédités sur ton wallet 🎉', time: '1h', read: true },
    { id: 5, type: 'match', text: 'Sofia correspond à tes intérêts ! 👋', time: '2h', read: true },
  ]);
 const [showMatching, setShowMatching]   = useState(false);
 const [showNotifs, setShowNotifs] = useState(false);
 // STORIES
const [stories, setStories]               = useState([
  { id: 1, user: 'Alex', avatar: '👨', text: 'Au parc ! 🌳', emoji: '🌳',
    lat: 48.857, lng: 2.351, time: '10min', reactions: 5 },
  { id: 2, user: 'Sofia', avatar: '👩', text: 'Yoga du matin 🧘', emoji: '🧘',
    lat: 48.856, lng: 2.353, time: '25min', reactions: 12 },
  { id: 3, user: 'Priya', avatar: '👩', text: 'Coding session ☕', emoji: '☕',
    lat: 19.077, lng: 72.878, time: '1h', reactions: 8 },
]);
const [showCreateStory, setShowCreateStory] = useState(false);
const [showStory, setShowStory]             = useState(null);
const [newStory, setNewStory]               = useState({ text: '', emoji: '😊' });
 const [importInput, setImportInput]             = useState('');
const [showWalletConnect, setShowWalletConnect] = useState(false);
const [matchSuggestions, setMatchSuggestions] = useState([]);
// CERCLES D'AMIS
const [friendsLocations, setFriendsLocations] = useState([
  { id: 1, name: 'Alex', avatar: '👨', lat: 48.857, lng: 2.351, activity: 'Running 🏃', online: true },
  { id: 2, name: 'Sofia', avatar: '👩', lat: 48.854, lng: 2.355, activity: 'Yoga 🧘', online: true },
  { id: 3, name: 'Marcus', avatar: '🧑', lat: 48.860, lng: 2.348, activity: 'Football ⚽', online: false },
]);
const [showFriendsMap, setShowFriendsMap] = useState(false);
const [sharingLocation, setSharingLocation] = useState(false);
// PULSE SCORE
const [pulseScore, setPulseScore] = useState(0);

const calculatePulseScore = (user) => {
  let score = 0;
  score += Math.min((user?.znd || 0) / 100, 300);
  score += myTerritories.length * 50;
  score += stories.length * 20;
  score += jobs.filter(j => j.userId === user?.id).length * 30;
  return Math.min(Math.round(score), 1000);
};
// TERRITOIRES
const [territories, setTerritories] = useState([
  { id: 1, name: 'Zone Paris Centre', owner: 'Marcus', avatar: '🧑',
    lat: 48.857, lng: 2.352, radius: 300, zndPerHour: 5,
    color: 'rgba(107,33,168,0.3)', captured: false },
  { id: 2, name: 'Zone Montmartre', owner: null,
    lat: 48.886, lng: 2.343, radius: 300, zndPerHour: 3,
    color: 'rgba(201,168,76,0.2)', captured: false },
  { id: 3, name: 'Zone Mumbai', owner: 'Priya', avatar: '👩',
    lat: 19.076, lng: 72.877, radius: 500, zndPerHour: 8,
    color: 'rgba(239,68,68,0.2)', captured: false },
  { id: 4, name: 'Zone Delhi', owner: null,
    lat: 28.613, lng: 77.209, radius: 400, zndPerHour: 4,
    color: 'rgba(201,168,76,0.2)', captured: false },
  { id: 5, name: 'Zone Lagos', owner: null,
    lat: 6.524, lng: 3.379, radius: 500, zndPerHour: 6,
    color: 'rgba(201,168,76,0.2)', captured: false },
]);
const [showTerritory, setShowTerritory] = useState(null);
const [myTerritories, setMyTerritories] = useState([]);
const [territoryZnd, setTerritoryZnd]   = useState(0);
// TRANSFERTS ZND
const [showSendZnd, setShowSendZnd]     = useState(false);
const [sendToAddress, setSendToAddress] = useState('');
const [sendAmount, setSendAmount]       = useState('');
const [txHistory, setTxHistory]         = useState([
  { id: 1, type: 'recu', amount: 50, from: 'Pulse App', date: 'Aujourd\'hui', status: 'success' },
  { id: 2, type: 'envoye', amount: 10, to: 'Alex', date: 'Hier', status: 'success' },
  { id: 3, type: 'recu', amount: 200, from: 'Trésor ZND', date: 'Il y a 2j', status: 'success' },
]);

// TRADUCTION
const [translatedMessages, setTranslatedMessages] = useState({});
const [isTranslating, setIsTranslating]           = useState(false);

const translateText = async (text, targetLang) => {
  try {
    setIsTranslating(true);
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text',
        api_key: ''
      }),
    });
    const data = await response.json();
    setIsTranslating(false);
    return data.translatedText || text;
  } catch (err) {
    setIsTranslating(false);
    return text;
  }
};
// LIVE STREAMING
const [lives, setLives] = useState([
  { id: 1, user: 'Alex', avatar: '👨', title: 'Session foot en direct !',
    viewers: 24, lat: 48.857, lng: 2.351, zndEarned: 150, emoji: '⚽' },
  { id: 2, user: 'Sofia', avatar: '👩', title: 'Cours de yoga live 🧘',
    viewers: 67, lat: 48.854, lng: 2.355, zndEarned: 340, emoji: '🧘' },
  { id: 3, user: 'Priya', avatar: '👩', title: 'Coding session Mumbai',
    viewers: 12, lat: 19.077, lng: 72.878, zndEarned: 80, emoji: '💻' },
]);
const [myLive, setMyLive]           = useState(null);
const [showLive, setShowLive]       = useState(null);
const [showStartLive, setShowStartLive] = useState(false);
const [newLive, setNewLive]         = useState({ title: '', emoji: '🎥' });
const [liveViewers, setLiveViewers] = useState(0);
const [liveZnd, setLiveZnd]         = useState(0);
const liveInterval                  = useRef(null);
// PULSE JOBS
const [jobs, setJobs] = useState([
  { id: 1, type: 'mission', title: 'Livraison urgent', description: 'Livrer un colis 2km', pay: 50, currency: 'ZND', emoji: '🛵', urgent: true, lat: 48.857, lng: 2.352 },
  { id: 2, type: 'service', title: 'Plombier cherché', description: 'Fuite robinet à réparer', pay: 80, currency: 'EUR', emoji: '🔧', urgent: true, lat: 48.855, lng: 2.349 },
  { id: 3, type: 'emploi', title: 'Développeur React Native', description: 'CDI Paris, remote possible', pay: 45000, currency: 'EUR', emoji: '💻', urgent: false, lat: 48.860, lng: 2.355 },
  { id: 4, type: 'mission', title: 'Cours de maths', description: 'Lycéen, 2h/semaine', pay: 30, currency: 'EUR', emoji: '📚', urgent: false, lat: 48.856, lng: 2.350 },
  { id: 5, type: 'service', title: 'Déménagement', description: 'Aide pour déménager samedi', pay: 200, currency: 'ZND', emoji: '📦', urgent: false, lat: 48.858, lng: 2.353 },
  { id: 6, type: 'emploi', title: 'Commercial ZND', description: 'Développer le réseau Pulse', pay: 500, currency: 'ZND', emoji: '🤝', urgent: false, lat: 48.854, lng: 2.348 },
]);
const [showCreateJob, setShowCreateJob] = useState(false);
const [showJob, setShowJob]             = useState(null);
const [newJob, setNewJob]               = useState({
  title: '', description: '', type: 'mission',
  pay: '', currency: 'ZND', emoji: '💼'
});
const [jobFilter, setJobFilter]         = useState('all');

// MARKETPLACE
const [showCreateShop, setShowCreateShop] = useState(false);
const [myShop, setMyShop]               = useState(null);
const [shopProducts, setShopProducts]   = useState([]);
const [showAddProduct, setShowAddProduct] = useState(false);
const [newShop, setNewShop]             = useState({
  name: '', description: '', type: 'food', emoji: '🏪'
});
const [newProduct, setNewProduct]       = useState({
  name: '', description: '', price: '', currency: 'ZND', emoji: '📦'
});
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const t = (key) => translations[lang][key] || key;

  // Lire solde ZND réel
  useEffect(() => {
    if (authUser?.walletAddress) {
      walletService.getZNDBalance().then(balance => {
        setAuthUser(prev => ({ ...prev, znd: parseFloat(balance) }));
      });
    }
  }, [authUser?.walletAddress]);

  useEffect(() => {
    return () => { if (earnInterval.current) clearInterval(earnInterval.current); };
  }, []);

  const validate = (isLogin) => {
    const e = {};
    if (!isLogin && !form.name.trim()) e.name = t('nameError');
    if (!EMAIL_REGEX.test(form.email.trim())) e.email = t('emailError');
    if (form.password.length < 6)     e.password = t('passwordError');
    if (!isLogin && form.password !== form.confirmPassword)
      e.confirmPassword = t('confirmError');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

const handleRegister = async () => {
  console.log('[handleRegister] validate() avec form =', JSON.stringify(form));
  if (!validate(false)) {
    console.log('[handleRegister] validation échouée, errors =', JSON.stringify(errors));
    return;
  }
  const url = `${API_URL}/register`;
  const payload = {
    name: form.name,
    email: form.email.trim().toLowerCase(),
    password: form.password,
    birthdate: form.birthdate,
    country: form.country,
    city: form.city,
  };
  console.log('[handleRegister] POST', url, JSON.stringify(payload));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('[handleRegister] response status =', response.status, response.ok);
    const rawText = await response.text();
    console.log('[handleRegister] response body brut =', rawText);
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.log('[handleRegister] échec JSON.parse :', parseErr.message);
      alert('Réponse serveur invalide (voir logs)');
      return;
    }
    if (data.success) {
      console.log('[handleRegister] succès, user =', JSON.stringify(data.user));
      if (data.token) await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
      const walletAddress = data.user.walletAddress || await walletService.getAddress();
      console.log('[handleRegister] walletAddress résolu =', walletAddress);
      if (!data.user.walletAddress) persistWalletAddress(walletAddress);
      setAuthUser({ ...data.user, walletAddress, interests: ['sport', 'social'] });
      generateMatches(['sport', 'social']);
      setScreen('app');
    } else {
      console.log('[handleRegister] échec côté serveur, data.error =', data.error);
      alert(data.error);
    }
  } catch (err) {
    console.log('[handleRegister] exception :', err.name, err.message, err.stack);
    alert('Erreur connexion serveur : ' + err.message);
  }
};

const handleLogin = async () => {
  console.log('[handleLogin] validate() avec form =', JSON.stringify(form));
  if (!validate(true)) {
    console.log('[handleLogin] validation échouée, errors =', JSON.stringify(errors));
    return;
  }
  const url = `${API_URL}/login`;
  const payload = { email: form.email.trim().toLowerCase(), password: form.password };
  console.log('[handleLogin] POST', url, JSON.stringify(payload));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('[handleLogin] response status =', response.status, response.ok);
    const rawText = await response.text();
    console.log('[handleLogin] response body brut =', rawText);
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.log('[handleLogin] échec JSON.parse :', parseErr.message);
      alert('Réponse serveur invalide (voir logs)');
      return;
    }
    if (data.success) {
      console.log('[handleLogin] succès, user =', JSON.stringify(data.user));
      if (data.token) await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
      const walletAddress = data.user.walletAddress || await walletService.getAddress();
      console.log('[handleLogin] walletAddress résolu =', walletAddress);
      if (!data.user.walletAddress) persistWalletAddress(walletAddress);
      setAuthUser({ ...data.user, walletAddress, interests: ['sport', 'job'] });
      generateMatches(['sport', 'job']);
      setScreen('app');
    } else {
      console.log('[handleLogin] échec côté serveur, data.error =', data.error);
      alert(data.error);
    }
  } catch (err) {
    console.log('[handleLogin] exception :', err.name, err.message, err.stack);
    alert('Erreur connexion serveur : ' + err.message);
  }
};

  // Termine le live en cours proprement : arrête l'intervalle, retire le marqueur de la carte
  // (bug #B), et crédite le vrai temps écoulé côté serveur (bug #C). Partagée entre le bouton
  // "Terminer" et la déconnexion (bug #A), pour ne jamais laisser un live tourner en arrière-plan.
  const endLive = async () => {
    if (!myLive) return;
    clearInterval(liveInterval.current);
    const endedLiveId = myLive.id;
    setMyLive(null);
    setLives(prev => prev.filter(l => l.id !== endedLiveId));
    setLiveViewers(0);
    setLiveZnd(0);
    if (liveSessionId.current) {
      const sessionId = liveSessionId.current;
      liveSessionId.current = null;
      const data = await callEconomy('/economy/live/end', { sessionId });
      if (data.success && data.earned > 0) {
        setAuthUser(prev => ({ ...prev, znd: data.znd }));
        addNotification('Live termine ! +' + data.earned + ' ZND gagnes !', 'znd');
      }
    }
  };

  const handleLogout = async () => {
    await endLive();
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthUser(null);
    setForm({ name: '', email: '', password: '', confirmPassword: '' });
    setErrors({});
    setIsTracking(false);
    clearInterval(earnInterval.current);
    setScreen('map_preview');
  };

  const handleSelect = (item, type) => {
    setSelected({ ...item, itemType: type });
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 50 }).start();
  };

  const handleClose = () => {
    Animated.timing(cardAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setSelected(null));
  };

  const filteredEvents = filterActive === 'all'
    ? MOCK_EVENTS : MOCK_EVENTS.filter(e => e.type === filterActive);

  const searchResults = searchQuery.length > 1
    ? MOCK_EVENTS.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.type.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const startRealLocation = () => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ latitude, longitude });
          setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
          addNotification('📍 Position mise à jour !', 'location');
        },
        () => {
          setUserLocation({ latitude: 48.8566, longitude: 2.3522 });
          setMapRegion({ latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        }
      );
    } else {
      setUserLocation({ latitude: 48.8566, longitude: 2.3522 });
    }
  };

  const toggleTracking = () => {
    if (!isTracking) {
      setIsTracking(true);
      trackingStartedAt.current = Date.now();
      earnInterval.current = setInterval(() => {
        setSteps(s => {
          const newSteps = s + Math.floor(Math.random() * 15 + 5);
          setZndEarned(Math.floor(newSteps / 100));
          return newSteps;
        });
      }, 2000);
    } else {
      setIsTracking(false);
      clearInterval(earnInterval.current);
      const elapsedSeconds = trackingStartedAt.current
        ? Math.floor((Date.now() - trackingStartedAt.current) / 1000)
        : 0;
      trackingStartedAt.current = null;
      if (elapsedSeconds > 0) {
        callEconomy('/economy/earn/walk', { elapsedSeconds }).then(data => {
          if (data.success && data.earned > 0) {
            setAuthUser(prev => ({ ...prev, znd: data.znd }));
            addNotification(`🏃 +${data.earned} ZND gagnés en marchant !`, 'znd');
          }
        });
      }
      setZndEarned(0);
      setSteps(0);
    }
  };

  const collectTreasure = (treasure) => {
    setTreasureFound(null);
    callEconomy('/economy/earn/treasure', { treasureId: treasure.id }).then(data => {
      if (data.success) {
        setTreasures(prev => prev.map(tr => tr.id === treasure.id ? { ...tr, found: true } : tr));
        setAuthUser(prev => ({ ...prev, znd: data.znd }));
        addNotification(`💎 +${data.earned} ZND collectés !`, 'znd');
      } else {
        alert(data.error || 'Trésor déjà collecté');
      }
    });
  };

  const addNotification = (text, type) => {
    const notif = { id: Date.now(), type, text, time: 'maintenant', read: false };
    setNotifications(prev => [notif, ...prev]);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const generateMatches = (userInterests) => {
    const matches = MOCK_USERS
      .map(user => {
        const common = user.interests.filter(i => userInterests.includes(i));
        const score  = Math.round((common.length / userInterests.length) * 100);
        return { ...user, matchScore: score, commonInterests: common };
      })
      .filter(u => u.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
    setMatchSuggestions(matches);
  };
  

  // ── ENVOI ZND RÉEL ──
  const sendZndToUser = async (toAddress, amount) => {
    try {
      addNotification('Transaction en cours...', 'znd');
      const result = await walletService.transferZNDOnChain(toAddress, amount);
      if (result.success) {
        addNotification('ZND envoyes avec succes !', 'znd');
        setAuthUser(prev => ({ ...prev, znd: (prev?.znd || 0) - amount }));
        return true;
      } else {
        alert('Erreur transaction : ' + result.error);
        return false;
      }
    } catch (err) {
      alert('Erreur : ' + err.message);
      return false;
    }
  };

  const renderMapView = () => (
    <MapView
      style={StyleSheet.absoluteFillObject}
      region={mapRegion}
      onRegionChangeComplete={setMapRegion}
    >
      {userLocation && (
        <>
          <Circle center={userLocation} radius={200}
            fillColor="rgba(107,33,168,0.1)"
            strokeColor="rgba(167,139,250,0.4)" strokeWidth={2} />
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.myLocationMarker}>
              <View style={styles.myLocationDot} />
              <View style={styles.myLocationRing} />
            </View>
          </Marker>
        </>
      )}
      {MOCK_EVENTS.map(event => (
        <Marker key={`event-${event.id}`}
          coordinate={{ latitude: event.lat, longitude: event.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => screen === 'app' ? handleSelect(event, 'event') : null}>
          <View style={[styles.eventMarker, { borderColor: EVENT_TYPES[event.type].color }]}>
            <Text style={styles.eventEmoji}>{EVENT_TYPES[event.type].emoji}</Text>
            {event.zndReward > 0 && (
              <View style={styles.zndBadge}>
                <Text style={styles.zndBadgeText}>+{event.zndReward}</Text>
              </View>
            )}
          </View>
        </Marker>
      ))}
      {MOCK_USERS.map(user => (
        <Marker key={`user-${user.id}`}
          coordinate={{ latitude: user.lat, longitude: user.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => screen === 'app' ? handleSelect(user, 'user') : null}>
          <View style={styles.userNearbyMarker}>
            <Text style={styles.userNearbyEmoji}>{user.avatar}</Text>
            <View style={styles.userOnlineDot} />
          </View>
        </Marker>
      ))}
      {treasures.filter(tr => !tr.found).map(tr => (
        <Marker key={`treasure-${tr.id}`}
          coordinate={{ latitude: tr.lat, longitude: tr.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => screen === 'app' ? setTreasureFound(tr) : null}>
          <View style={styles.treasureMarker}>
            <Text style={styles.treasureEmoji}>{tr.emoji}</Text>
          </View>
        </Marker>
      ))}
      {/* CERCLES D'AMIS */}
{sharingLocation && friendsLocations.map(friend => (
  <Marker
    key={`friend-${friend.id}`}
    coordinate={{ latitude: friend.lat, longitude: friend.lng }}
    anchor={{ x: 0.5, y: 0.5 }}
    onPress={() => screen === 'app' ? handleSelect(friend, 'user') : null}>
    <View style={[styles.friendLocationMarker,
      !friend.online && { opacity: 0.5 }]}>
      <Text style={{ fontSize: 20 }}>{friend.avatar}</Text>
      <View style={[styles.friendOnlineDot,
        { backgroundColor: friend.online ? '#10b981' : '#6b7280' }]} />
    </View>
  </Marker>
))}
{/* TERRITOIRES */}
{territories.map(territory => (
  <React.Fragment key={`terr-${territory.id}`}>
    <Circle
      center={{ latitude: territory.lat, longitude: territory.lng }}
      radius={territory.radius}
      fillColor={territory.color}
      strokeColor={territory.owner ? '#a78bfa' : '#C9A84C'}
      strokeWidth={2}
    />
    <Marker
      coordinate={{ latitude: territory.lat, longitude: territory.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => setShowTerritory(territory)}>
      <View style={styles.territoryMarker}>
        <Text style={{ fontSize: 16 }}>
          {territory.owner ? territory.avatar : '🏴'}
        </Text>
        <Text style={styles.territoryZnd}>
          +{territory.zndPerHour} ZND/h
        </Text>
      </View>
    </Marker>
  </React.Fragment>
))}
{/* LIVES SUR LA CARTE */}
{lives.map(live => (
  <Marker
    key={`live-${live.id}`}
    coordinate={{ latitude: live.lat, longitude: live.lng }}
    anchor={{ x: 0.5, y: 0.5 }}
    onPress={() => screen === 'app' ? setShowLive(live) : null}>
    <View style={styles.liveMarker}>
      <Text style={styles.liveMarkerEmoji}>{live.avatar}</Text>
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
      <View style={styles.liveViewersBadge}>
        <Text style={styles.liveViewersText}>👁 {live.viewers}</Text>
      </View>
    </View>
  </Marker>
))}
      {/* STORIES SUR LA CARTE */}
{stories.map(story => (
  <Marker
    key={`story-${story.id}`}
    coordinate={{ latitude: story.lat, longitude: story.lng }}
    anchor={{ x: 0.5, y: 0.5 }}
    onPress={() => screen === 'app' ? setShowStory(story) : null}>
    <View style={styles.storyMarker}>
      <Text style={styles.storyMarkerEmoji}>{story.avatar}</Text>
      <View style={styles.storyRing} />
      <View style={styles.storyEmojiBadge}>
        <Text style={{ fontSize: 10 }}>{story.emoji}</Text>
      </View>
    </View>
  </Marker>
))}
      {MOCK_BUSINESSES.map(b => (
        <Marker key={`biz-${b.id}`}
          coordinate={{ latitude: b.lat, longitude: b.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => screen === 'app' ? setSelectedBusiness(b) : null}>
          <View style={styles.businessMarker}>
            <Text style={styles.businessEmoji}>{b.emoji}</Text>
            <View style={styles.businessBadge}>
              <Text style={styles.businessBadgeText}>-{b.zndDiscount}%</Text>
            </View>
          </View>
        </Marker>
      ))}
    </MapView>
  );


  const renderMapPreview = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderMapView()}
      <View style={styles.previewBottom}>
        <View style={styles.previewLogo}>
          <Text style={styles.logoHex}>⬡</Text>
          <Text style={styles.logoText}>PULSE</Text>
          <Text style={styles.tagline}>{t('tagline')}</Text>
        </View>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setScreen('register')}>
          <Text style={styles.btnPrimaryText}>🚀 {t('joinNow')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('login')}>
          <Text style={styles.btnSecondaryText}>{t('login')}</Text>
        </TouchableOpacity>
        <Text style={styles.terms}>{t('terms')}</Text>
      </View>
      <View style={styles.previewLangRow}>
        {['fr','en','it','hi','ru'].map(l => (
          <TouchableOpacity key={l}
            style={[styles.langBtn, lang === l && styles.langBtnActive]}
            onPress={() => setLang(l)}>
            <Text style={styles.langText}>
              {l==='fr'?'🇫🇷':l==='en'?'🇬🇧':l==='it'?'🇮🇹':l==='hi'?'🇮🇳':'🇷🇺'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderWelcome = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderMapView()}
      <View style={styles.welcomeOverlay}>
        <View style={styles.langRow}>
          {['fr','en','it','hi','ru'].map(l => (
            <TouchableOpacity key={l}
              style={[styles.langBtn, lang === l && styles.langBtnActive]}
              onPress={() => setLang(l)}>
              <Text style={styles.langText}>
                {l==='fr'?'🇫🇷':l==='en'?'🇬🇧':l==='it'?'🇮🇹':l==='hi'?'🇮🇳':'🇷🇺'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.logoBlock}>
          <Text style={styles.logoHex}>⬡</Text>
          <Text style={styles.logoText}>PULSE</Text>
          <Text style={styles.tagline}>{t('tagline')}</Text>
        </View>
        <View style={styles.features}>
          {[
            { emoji: '🗺️', text: 'Carte mondiale interactive' },
            { emoji: '💎', text: 'Gagne des ZND chaque jour' },
            { emoji: '👥', text: 'Rencontre des gens près de toi' },
            { emoji: '🏪', text: 'Commerces & services locaux' },
          ].map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.authButtons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setScreen('register')}>
            <Text style={styles.btnPrimaryText}>🚀 {t('joinNow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('login')}>
            <Text style={styles.btnSecondaryText}>{t('login')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.terms}>{t('terms')}</Text>
      </View>
    </View>
  );

  const renderRegister = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderMapView()}
      <KeyboardAvoidingView style={styles.authFullOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('map_preview')}>
            <Text style={styles.backBtnText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.authTitle}>⬡ {t('register')}</Text>
          <Text style={styles.authSub}>Ton wallet ZND sera créé automatiquement 💎</Text>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>👤 {t('name')}</Text>
            <TextInput style={[styles.input, errors.name && styles.inputError]}
              placeholder={t('name')} placeholderTextColor="#6b7280"
              value={form.name} onChangeText={v => setForm({...form, name: v})} />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>
          

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🎂 Date de naissance</Text>
            <TextInput style={styles.input}
              placeholder="JJ/MM/AAAA" placeholderTextColor="#6b7280"
              value={form.birthdate}
              onChangeText={v => setForm({...form, birthdate: v})}
              keyboardType="default" />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🌍 Pays</Text>
            <TextInput style={styles.input}
              placeholder="Ex: France" placeholderTextColor="#6b7280"
              value={form.country}
              onChangeText={v => setForm({...form, country: v})} />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🏙️ Ville</Text>
            <TextInput style={styles.input}
              placeholder="Ex: Paris" placeholderTextColor="#6b7280"
              value={form.city}
              onChangeText={v => setForm({...form, city: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>✉️ {t('email')}</Text>
            <TextInput style={[styles.input, errors.email && styles.inputError]}
              placeholder={t('email')} placeholderTextColor="#6b7280"
              keyboardType="email-address" autoCapitalize="none"
              value={form.email} onChangeText={v => setForm({...form, email: v})} />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🔒 {t('password')}</Text>
            <TextInput style={[styles.input, errors.password && styles.inputError]}
              placeholder={t('password')} placeholderTextColor="#6b7280"
              secureTextEntry value={form.password}
              onChangeText={v => setForm({...form, password: v})} />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🔒 {t('confirmPwd')}</Text>
            <TextInput style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder={t('confirmPwd')} placeholderTextColor="#6b7280"
              secureTextEntry value={form.confirmPassword}
              onChangeText={v => setForm({...form, confirmPassword: v})} />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>
          <View style={styles.walletInfoBox}>
            <Text style={styles.walletInfoText}>{t('walletCreated')}</Text>
            <Text style={styles.walletInfoSub}>BSC Mainnet · +50 ZND offerts 🎁</Text>
          </View>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister}>
            <Text style={styles.btnPrimaryText}>🚀 {t('register')}</Text>
          </TouchableOpacity>
          <Text style={styles.orText}>{t('orWith')}</Text>
          <View style={styles.socialButtons}>
            {['🍎 Apple', '🔵 Google', '📘 Facebook'].map(s => (
              <TouchableOpacity key={s} style={styles.socialBtn}>
                <Text style={styles.socialBtnText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setScreen('login')}>
            <Text style={styles.switchText}>
              {t('haveAccount')} <Text style={styles.switchLink}>{t('login')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );

  const renderLogin = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderMapView()}
      <KeyboardAvoidingView style={styles.authFullOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('map_preview')}>
            <Text style={styles.backBtnText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.authTitle}>⬡ {t('login')}</Text>
          <Text style={styles.authSub}>Content de te revoir ! 👋</Text>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>✉️ {t('email')}</Text>
            <TextInput style={[styles.input, errors.email && styles.inputError]}
              placeholder={t('email')} placeholderTextColor="#6b7280"
              keyboardType="email-address" autoCapitalize="none"
              value={form.email} onChangeText={v => setForm({...form, email: v})} />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🔒 {t('password')}</Text>
            <TextInput style={[styles.input, errors.password && styles.inputError]}
              placeholder={t('password')} placeholderTextColor="#6b7280"
              secureTextEntry value={form.password}
              onChangeText={v => setForm({...form, password: v})} />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>
          <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
            <Text style={styles.switchLink}>{t('forgotPassword')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
            <Text style={styles.btnPrimaryText}>⚡ {t('login')}</Text>
          </TouchableOpacity>
          <Text style={styles.orText}>{t('orWith')}</Text>
          <View style={styles.socialButtons}>
            {['🍎 Apple', '🔵 Google', '📘 Facebook'].map(s => (
              <TouchableOpacity key={s} style={styles.socialBtn}>
                <Text style={styles.socialBtnText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setScreen('register')}>
            <Text style={styles.switchText}>
              {t('noAccount')} <Text style={styles.switchLink}>{t('register')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );

  const renderMap = () => (
    <View style={{ flex: 1 }}>
      {renderMapView()}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>⬡ PULSE</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('live')}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.langSelector}>
            {['fr','en','it','hi','ru'].map(l => (
              <TouchableOpacity key={l}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                onPress={() => setLang(l)}>
                <Text style={styles.langText}>
                  {l==='fr'?'🇫🇷':l==='en'?'🇬🇧':l==='it'?'🇮🇹':l==='hi'?'🇮🇳':'🇷🇺'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifs(true)}>
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.zndBalance}>
            <Text style={styles.zndBalanceText}>💎 {authUser?.znd || 0} ZND</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.searchBar} onPress={() => setShowSearch(true)}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>{t('search')}</Text>
      </TouchableOpacity>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{MOCK_USERS.length}</Text>
          <Text style={styles.statLabel}>{t('nearYou')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{MOCK_EVENTS.length}</Text>
          <Text style={styles.statLabel}>{t('events')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{treasures.filter(tr => !tr.found).length}</Text>
          <Text style={styles.statLabel}>{t('treasures')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#10b981' }]}>+{zndEarned}</Text>
          <Text style={styles.statLabel}>{t('zndToday')}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {['all', ...Object.keys(EVENT_TYPES)].map(type => (
          <TouchableOpacity key={type}
            style={[styles.filterBtn, filterActive === type && styles.filterBtnActive]}
            onPress={() => setFilter(type)}>
            <Text style={styles.filterText}>
              {type === 'all' ? t('all')
                : `${EVENT_TYPES[type].emoji} ${t(EVENT_TYPES[type].label)}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateEvent(true)}>
        <Text style={styles.createBtnText}>{t('createEvent')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.geoBtn} onPress={startRealLocation}>
        <Text style={styles.geoBtnText}>📍</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.matchBtn} onPress={() => setShowMatching(true)}>
      {/* BOUTON STORY */}
<TouchableOpacity
  style={styles.storyBtn}
  onPress={() => setShowCreateStory(true)}>
  <Text style={styles.storyBtnText}>📸</Text>
</TouchableOpacity>
{/* BOUTON LIVE */}
<TouchableOpacity
  style={[styles.liveBtn, myLive && styles.liveBtnActive]}
  onPress={() => myLive ? null : setShowStartLive(true)}>
  <Text style={styles.storyBtnText}>{myLive ? '🔴' : '🎥'}</Text>
</TouchableOpacity>
{/* BOUTON CERCLE D'AMIS */}
<TouchableOpacity
  style={[styles.friendsBtn, sharingLocation && styles.friendsBtnActive]}
  onPress={() => {
  const newVal = !sharingLocation;
  setSharingLocation(newVal);
  addNotification(newVal ? 'Position partagee !' : 'Position masquee', 'social');
}}>
  <Text style={styles.storyBtnText}>👥</Text>
</TouchableOpacity>
        <Text style={styles.matchBtnText}>🤖</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.earnWidget, isTracking && styles.earnWidgetActive]}
        onPress={toggleTracking}>
        <Text style={styles.earnEmoji}>{isTracking ? '⏸️' : '🏃'}</Text>
        <View>
          <Text style={styles.earnTitle}>{isTracking ? 'En cours...' : 'Earn-to-Move'}</Text>
          <Text style={styles.earnStats}>👣 {steps} pas · +{zndEarned} ZND</Text>
        </View>
      </TouchableOpacity>

      {selectedItem && (
        <Animated.View style={[styles.detailCard, {
          transform: [{ translateY: cardAnim.interpolate({
            inputRange: [0, 1], outputRange: [400, 0]
          })}]
        }]}>
          <TouchableOpacity style={styles.cardClose} onPress={handleClose}>
            <Text style={styles.cardCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedItem.itemType === 'event' && (
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{EVENT_TYPES[selectedItem.type].emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedItem.title}</Text>
                  <Text style={styles.cardMeta}>📍 {selectedItem.distance} · 🌍 {selectedItem.city}</Text>
                </View>
                <View style={styles.cardReward}>
                  <Text style={styles.cardRewardText}>+{selectedItem.zndReward} ZND</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{selectedItem.description}</Text>
              <View style={styles.partBar}>
                <View style={[styles.partFill, {
                  width: `${(selectedItem.participants / selectedItem.maxP) * 100}%`
                }]} />
              </View>
              <Text style={styles.cardPartText}>
                👥 {selectedItem.participants}/{selectedItem.maxP} {t('participants')}
              </Text>
              <TouchableOpacity style={styles.cardJoinBtn}>
                <Text style={styles.cardJoinText}>⚡ {t('joinEarn')} {selectedItem.zndReward} ZND</Text>
              </TouchableOpacity>
            </View>
          )}
          {selectedItem.itemType === 'user' && (
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{selectedItem.avatar}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedItem.name}</Text>
                  <Text style={styles.cardMeta}>{selectedItem.activity}</Text>
                </View>
                <View style={styles.cardReward}>
                  <Text style={styles.cardRewardText}>⭐ {selectedItem.zndScore}</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{selectedItem.bio}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.cardJoinBtn, { flex: 1 }]}
                  onPress={() => { handleClose(); setShowProfile(selectedItem); }}>
                  <Text style={styles.cardJoinText}>👤 {t('profile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardJoinBtn, { flex: 1,
                  backgroundColor: 'rgba(107,33,168,0.3)' }]}
                  onPress={() => { handleClose(); setChatUser(selectedItem); }}>
                  <Text style={styles.cardJoinText}>💬 Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* MODAL CRÉER EVENT */}
      <Modal visible={showCreateEvent} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>🎯 Créer un event</Text>
              <TouchableOpacity onPress={() => setShowCreateEvent(false)}>
                <Text style={styles.searchClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Type d'event</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}>
                {Object.entries(EVENT_TYPES).map(([key, val]) => (
                  <TouchableOpacity key={key}
                    style={[styles.typeBtn, newEvent.type === key && styles.typeBtnActive]}
                    onPress={() => setNewEvent({...newEvent, type: key})}>
                    <Text style={styles.typeEmoji}>{val.emoji}</Text>
                    <Text style={styles.typeLabel}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>📝 Titre</Text>
                <TextInput style={styles.input}
                  placeholder="Ex: Match de foot au parc" placeholderTextColor="#6b7280"
                  value={newEvent.title} onChangeText={v => setNewEvent({...newEvent, title: v})} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>📄 Description</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Décris ton event..." placeholderTextColor="#6b7280"
                  multiline value={newEvent.description}
                  onChangeText={v => setNewEvent({...newEvent, description: v})} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>👥 Participants max</Text>
                <TextInput style={styles.input} placeholder="10" placeholderTextColor="#6b7280"
                  keyboardType="numeric" value={newEvent.maxP}
                  onChangeText={v => setNewEvent({...newEvent, maxP: v})} />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>💎 Récompense ZND</Text>
                <TextInput style={styles.input} placeholder="50" placeholderTextColor="#6b7280"
                  keyboardType="numeric" value={newEvent.zndReward}
                  onChangeText={v => setNewEvent({...newEvent, zndReward: v})} />
              </View>
              <View style={styles.walletInfoBox}>
                <Text style={styles.walletInfoText}>
                  📍 Position : {userLocation
                    ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
                    : 'Paris (par défaut)'}
                </Text>
                <Text style={styles.walletInfoSub}>L'event sera placé à ta position actuelle</Text>
              </View>
<TouchableOpacity
  style={styles.btnPrimary}
  onPress={async () => {
    if (!newEvent.title.trim()) return;
    const pos = userLocation || { latitude: 48.856, longitude: 2.352 };
    try {
      const response = await fetch(API_URL + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          type: newEvent.type,
          title: newEvent.title,
          description: newEvent.description || 'Venez nombreux !',
          city: 'Ma position',
          lat: pos.latitude + (Math.random() - 0.5) * 0.002,
          lng: pos.longitude + (Math.random() - 0.5) * 0.002,
          maxP: parseInt(newEvent.maxP) || 10,
          zndReward: parseInt(newEvent.zndReward) || 50,
          userId: authUser?.id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        MOCK_EVENTS.push({
          id: 'new-' + data.event.id,
          type: data.event.type,
          title: data.event.title,
          description: data.event.description,
          city: data.event.city,
          lat: data.event.lat,
          lng: data.event.lng,
          participants: 1,
          maxP: data.event.max_p,
          zndReward: data.event.znd_reward,
          distance: '0m',
        });
        addNotification('Event publie !', 'event');
        setNewEvent({ title: '', description: '', type: 'sport', maxP: '10', zndReward: '50' });
        setShowCreateEvent(false);
      }
    } catch (err) {
      alert('Erreur creation event');
    }
  }}>
  <Text style={styles.btnPrimaryText}>✅ Publier l'event</Text>
</TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* MODAL VOIR UNE STORY */}
<Modal visible={!!showStory} animationType="fade" transparent>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, { alignItems: 'center', gap: 16 }]}>
      <TouchableOpacity
        style={styles.modalClose}
        onPress={() => setShowStory(null)}>
        <Text style={styles.searchClose}>✕</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 64 }}>{showStory?.avatar}</Text>
      <Text style={styles.profileName}>{showStory?.user}</Text>
      <View style={styles.walletInfoBox}>
        <Text style={styles.walletInfoText}>{showStory?.emoji} {showStory?.text}</Text>
        <Text style={styles.walletInfoSub}>Il y a {showStory?.time}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {['❤️', '🔥', '👏', '😮', '💎'].map(reaction => (
          <TouchableOpacity
            key={reaction}
            style={styles.reactionBtn}
            onPress={() => {
              addNotification('Reaction envoyee !', 'social');
              setShowStory(null);
            }}>
            <Text style={{ fontSize: 24 }}>{reaction}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          setChatUser({ name: showStory?.user, avatar: showStory?.avatar });
          setShowStory(null);
        }}>
        <Text style={styles.btnPrimaryText}>💬 Répondre</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* MODAL CRÉER UNE STORY */}
<Modal visible={showCreateStory} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>📸 Ma Story</Text>
        <TouchableOpacity onPress={() => setShowCreateStory(false)}>
          <Text style={styles.searchClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>✍️ Que fais-tu ?</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Au café, qui veut me rejoindre ?"
          placeholderTextColor="#6b7280"
          value={newStory.text}
          onChangeText={v => setNewStory({...newStory, text: v})} />
      </View>
      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>😊 Emoji</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['😊','🏃','🍕','☕','🎵','⚽','💻','🌳','🎉','💎'].map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactionBtn,
                newStory.emoji === emoji && { backgroundColor: 'rgba(107,33,168,0.4)' }]}
              onPress={() => setNewStory({...newStory, emoji})}>
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.walletInfoBox}>
        <Text style={styles.walletInfoText}>
          📍 {userLocation
            ? userLocation.latitude.toFixed(4) + ', ' + userLocation.longitude.toFixed(4)
            : 'Paris (par défaut)'}
        </Text>
        <Text style={styles.walletInfoSub}>
          Visible sur la carte pendant 24h
        </Text>
      </View>
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          if (!newStory.text.trim()) return;
          const pos = userLocation || { latitude: 48.856, longitude: 2.352 };
          const story = {
            id: Date.now(),
            user: authUser?.name || 'Moi',
            avatar: '🧑',
            text: newStory.text,
            emoji: newStory.emoji,
            lat: pos.latitude + (Math.random() - 0.5) * 0.002,
            lng: pos.longitude + (Math.random() - 0.5) * 0.002,
            time: 'maintenant',
            reactions: 0,
          };
          setStories(prev => [...prev, story]);
          addNotification('Story publiee !', 'social');
          setNewStory({ text: '', emoji: '😊' });
          setShowCreateStory(false);
        }}>
        <Text style={styles.btnPrimaryText}>📸 Publier ma story</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
{/* MODAL VOIR UN LIVE */}
<Modal visible={!!showLive} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
      <View style={styles.tabHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 32 }}>{showLive?.avatar}</Text>
          <View>
            <Text style={styles.chatName}>{showLive?.user}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.liveDotRed} />
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>LIVE</Text>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>· 👁 {showLive?.viewers} viewers</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowLive(null)}>
          <Text style={styles.searchClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* SCREEN LIVE SIMULÉ */}
      <View style={styles.liveScreen}>
        <Text style={{ fontSize: 48 }}>{showLive?.emoji}</Text>
        <Text style={styles.liveTitleText}>{showLive?.title}</Text>
        <Text style={{ color: '#9b8cb0', fontSize: 12, marginTop: 8 }}>
          💎 {showLive?.zndEarned} ZND gagnés
        </Text>
      </View>

      {/* RÉACTIONS */}
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
        {['❤️', '🔥', '👏', '😮', '💎'].map(reaction => (
          <TouchableOpacity key={reaction} style={styles.reactionBtn}
            onPress={() => addNotification('Reaction envoyee !', 'social')}>
            <Text style={{ fontSize: 24 }}>{reaction}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ENVOYER DES ZND */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[10, 50, 100].map(amount => (
          <TouchableOpacity key={amount}
            style={[styles.btnPrimary, { flex: 1, marginBottom: 0,
              backgroundColor: 'rgba(201,168,76,0.2)',
              borderWidth: 1, borderColor: '#C9A84C' }]}
            onPress={async () => {
              if ((authUser?.znd || 0) < amount) {
                alert('Solde ZND insuffisant');
                return;
              }
              const data = await callEconomy('/economy/spend', { reason: 'live_tip', amount });
              if (!data.success) {
                alert(data.error || 'Solde ZND insuffisant');
                return;
              }
              setAuthUser(prev => ({ ...prev, znd: data.znd }));
              addNotification('Envoye ' + amount + ' ZND au live !', 'znd');
            }}>
            <Text style={{ color: '#C9A84C', fontWeight: '700' }}>
              💎 {amount} ZND
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
</Modal>

{/* MODAL LANCER UN LIVE */}
<Modal visible={showStartLive} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🎥 Lancer un Live</Text>
        <TouchableOpacity onPress={() => setShowStartLive(false)}>
          <Text style={styles.searchClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>📝 Titre du live</Text>
        <TextInput style={styles.input}
          placeholder="Ex: Session sport en direct !"
          placeholderTextColor="#6b7280"
          value={newLive.title}
          onChangeText={v => setNewLive({...newLive, title: v})} />
      </View>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>😊 Emoji</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['🎥','⚽','🧘','💻','🎵','🍕','🎮','📚','🏋️','🌍'].map(emoji => (
            <TouchableOpacity key={emoji}
              style={[styles.reactionBtn,
                newLive.emoji === emoji && { backgroundColor: 'rgba(107,33,168,0.4)' }]}
              onPress={() => setNewLive({...newLive, emoji})}>
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.walletInfoBox}>
        <Text style={styles.walletInfoText}>
          📍 {userLocation
            ? userLocation.latitude.toFixed(4) + ', ' + userLocation.longitude.toFixed(4)
            : 'Paris (par défaut)'}
        </Text>
        <Text style={styles.walletInfoSub}>
          Ton live sera visible sur la carte en temps réel
        </Text>
      </View>

      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={async () => {
          if (!newLive.title.trim()) return;
          const startData = await callEconomy('/economy/live/start');
          if (!startData.success) {
            alert(startData.error || "Impossible de démarrer le live");
            return;
          }
          liveSessionId.current = startData.sessionId;
          const pos = userLocation || { latitude: 48.856, longitude: 2.352 };
          const live = {
            id: Date.now(),
            user: authUser?.name || 'Moi',
            avatar: '🧑',
            title: newLive.title,
            emoji: newLive.emoji,
            viewers: 0,
            zndEarned: 0,
            lat: pos.latitude,
            lng: pos.longitude,
          };
          setLives(prev => [...prev, live]);
          setMyLive(live);
          setShowStartLive(false);
          setNewLive({ title: '', emoji: '🎥' });
          addNotification('Live lance ! Tu es en direct !', 'live');

          // Simule des viewers qui arrivent (l'affichage seulement - le vrai gain ZND est
          // calculé côté serveur à partir du temps réellement écoulé, cf. /economy/live/end)
          liveInterval.current = setInterval(() => {
            setLiveViewers(v => v + Math.floor(Math.random() * 3));
            setLiveZnd(z => z + Math.floor(Math.random() * 10));
          }, 3000);
        }}>
        <Text style={styles.btnPrimaryText}>🔴 Lancer le Live</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* WIDGET LIVE EN COURS */}
{myLive && (
  <View style={styles.myLiveWidget}>
    <View style={styles.liveDotRed} />
    <View style={{ flex: 1 }}>
      <Text style={styles.earnTitle}>EN DIRECT</Text>
      <Text style={styles.earnStats}>
        👁 {liveViewers} viewers · 💎 {liveZnd} ZND
      </Text>
    </View>
    <TouchableOpacity
      style={{ backgroundColor: '#ef4444', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 6 }}
      onPress={endLive}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
        Terminer
      </Text>
    </TouchableOpacity>
  </View>
)}
{/* MODAL TERRITOIRE */}
<Modal visible={!!showTerritory} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <TouchableOpacity style={styles.modalClose} onPress={() => setShowTerritory(null)}>
        <Text style={styles.searchClose}>✕</Text>
      </TouchableOpacity>
      {showTerritory && (
        <View style={{ gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 48 }}>
              {showTerritory.owner ? showTerritory.avatar : '🏴'}
            </Text>
            <Text style={styles.profileName}>{showTerritory.name}</Text>
            {showTerritory.owner ? (
              <Text style={{ color: '#a78bfa', fontSize: 14 }}>
                Propriétaire : {showTerritory.owner}
              </Text>
            ) : (
              <Text style={{ color: '#C9A84C', fontSize: 14 }}>
                Zone libre à capturer !
              </Text>
            )}
          </View>

          <View style={styles.walletInfoBox}>
            <Text style={styles.walletInfoText}>
              💎 +{showTerritory.zndPerHour} ZND/heure
            </Text>
            <Text style={styles.walletInfoSub}>
              Revenus passifs automatiques
            </Text>
          </View>

          {!myTerritories.find(t => t.id === showTerritory.id) ? (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                if ((authUser?.znd || 0) < 100) {
                  alert('Il te faut 100 ZND pour capturer ce territoire !');
                  return;
                }
                const data = await callEconomy('/economy/spend', { reason: 'territory_capture' });
                if (!data.success) {
                  alert(data.error || 'Solde ZND insuffisant');
                  return;
                }
                setAuthUser(prev => ({ ...prev, znd: data.znd }));
                setMyTerritories(prev => [...prev, showTerritory]);
                setTerritories(prev => prev.map(t =>
                  t.id === showTerritory.id
                    ? { ...t, owner: authUser?.name, avatar: '🧑', color: 'rgba(107,33,168,0.3)' }
                    : t
                ));
                addNotification('Territoire capture ! +' + showTerritory.zndPerHour + ' ZND/h', 'znd');
                setShowTerritory(null);
              }}>
              <Text style={styles.btnPrimaryText}>
                ⚔️ Capturer pour 100 ZND
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.walletInfoBox}>
              <Text style={{ color: '#10b981', textAlign: 'center', fontWeight: '700' }}>
                ✅ Tu possèdes ce territoire !
              </Text>
              <Text style={{ color: '#9b8cb0', textAlign: 'center', fontSize: 12, marginTop: 4 }}>
                +{showTerritory.zndPerHour} ZND/heure en cours...
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => setShowTerritory(null)}>
            <Text style={styles.btnSecondaryText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
</Modal>
      {/* MODAL TRÉSOR */}
      <Modal visible={!!treasureFound} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.treasureModal}>
            <Text style={styles.treasureModalEmoji}>{treasureFound?.emoji || '💎'}</Text>
            <Text style={styles.treasureModalTitle}>Trésor découvert !</Text>
            <Text style={styles.treasureModalZnd}>+{treasureFound?.znd} ZND</Text>
            <TouchableOpacity style={styles.btnPrimary}
              onPress={() => treasureFound && collectTreasure(treasureFound)}>
              <Text style={styles.btnPrimaryText}>💎 Collecter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTreasureFound(null)}>
              <Text style={[styles.switchLink, { marginTop: 12 }]}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL BUSINESS */}
      <Modal visible={!!selectedBusiness} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedBusiness(null)}>
              <Text style={styles.searchClose}>✕</Text>
            </TouchableOpacity>
            {selectedBusiness && (
              <View style={{ gap: 16 }}>
                <View style={styles.cardHeader}>
                  <Text style={{ fontSize: 40 }}>{selectedBusiness.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{selectedBusiness.name}</Text>
                    <Text style={styles.cardMeta}>{selectedBusiness.description}</Text>
                  </View>
                </View>
                <View style={styles.walletInfoBox}>
                  <Text style={styles.walletInfoText}>
                    🏷️ -{selectedBusiness.zndDiscount}% en payant en ZND
                  </Text>
                  <Text style={styles.walletInfoSub}>Ton solde : {authUser?.znd || 0} ZND</Text>
                </View>
                <TouchableOpacity style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>💎 Payer en ZND</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary}
                  onPress={() => { setSelectedBusiness(null); setShowBusinessDash(true); }}>
                  <Text style={styles.btnSecondaryText}>📊 Tableau de bord</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );

  // ── PROFIL ── CORRIGÉ ──────────────────
  const renderProfile = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileHero}>
        <Text style={styles.profileAvatar}>🧑</Text>
        <Text style={styles.profileName}>{authUser?.name || 'Mon Profil'}</Text>
        <Text style={styles.profileBio}>Explorateur ZND & créateur d'events 🌍</Text>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatVal}>{authUser?.znd || 0}</Text>
            <Text style={styles.profileStatLabel}>ZND</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatVal}>47</Text>
            <Text style={styles.profileStatLabel}>{t('friends')}</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatVal}>12</Text>
            <Text style={styles.profileStatLabel}>{t('activities')}</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatVal}>{calculatePulseScore(authUser)}</Text>
            <Text style={styles.profileStatLabel}>Score</Text>
          </View>
        </View>
      </View>

      {/* WALLET CARD */}
      <View style={styles.walletCard}>
        <Text style={styles.walletTitle}>💎 {t('wallet')}</Text>
        <Text style={styles.walletBalance}>{authUser?.znd || 0} ZND</Text>
        <Text style={styles.walletSub}>≈ {((authUser?.znd || 0) * 0.005).toFixed(2)} € · BSC Mainnet</Text>

        {/* CHAMP ADRESSE WALLET */}
        <View style={{ width: '100%', marginTop: 12 }}>
          <Text style={{ color: '#10b981', fontSize: 11, textAlign: 'center' }}>
            {authUser?.walletAddress
              ? `✅ ${authUser.walletAddress.slice(0, 6)}...${authUser.walletAddress.slice(-4)}`
              : 'Création du wallet...'}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 8, alignItems: 'center' }}
            onPress={() => setShowWalletConnect(true)}>
            <Text style={{ color: '#a78bfa', fontSize: 11 }}>🔑 Importer un wallet existant</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.walletBtn} onPress={() => setActiveTab('shop')}>
          <Text style={styles.walletBtnText}>+ {t('buyZnd')}</Text>
        </TouchableOpacity>
      </View>

      {/* IA MATCHING */}
      <Text style={styles.sectionTitle}>🤖 Personnes compatibles</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {matchSuggestions.map(user => (
          <TouchableOpacity key={user.id} style={styles.matchCard}
            onPress={() => setShowProfile(user)}>
            <Text style={styles.matchEmoji}>{user.avatar}</Text>
            <Text style={styles.matchName}>{user.name}</Text>
            <View style={styles.matchScoreBadge}>
              <Text style={styles.matchScoreText}>{user.matchScore}% ✓</Text>
            </View>
            <Text style={styles.matchInterests}>
              {user.commonInterests.map(i => EVENT_TYPES[i]?.emoji).join(' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>⚡ {t('activities')}</Text>
      {MOCK_EVENTS.slice(0, 3).map(event => (
        <View key={event.id} style={styles.activityItem}>
          <Text style={styles.activityEmoji}>{EVENT_TYPES[event.type].emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.activityTitle}>{event.title}</Text>
            <Text style={styles.activityMeta}>🌍 {event.city} · +{event.zndReward} ZND</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>👥 {t('friends')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {MOCK_USERS.map(user => (
          <TouchableOpacity key={user.id} style={styles.friendCard}
            onPress={() => setShowProfile(user)}>
            <Text style={styles.friendAvatar}>{user.avatar}</Text>
            <Text style={styles.friendName}>{user.name}</Text>
            <Text style={styles.friendScore}>⭐ {user.zndScore}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>🚪 {t('logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderMessages = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>💬 {t('messages')}</Text>
      <FlatList data={MOCK_MESSAGES} keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.messageItem} onPress={() => setChatUser(item)}>
            <Text style={styles.messageAvatar}>{item.avatar}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.messageUser}>{item.user}</Text>
              <Text style={styles.messagePreview} numberOfLines={1}>{item.text}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.messageTime}>{item.time}</Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )} />
    </View>
  );

  const renderGroups = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>👥 {t('groups')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewGroup(true)}>
          <Text style={styles.addBtnText}>+ {t('newGroup')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList data={MOCK_GROUPS} keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.groupItem}>
            <Text style={styles.groupEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupDesc}>{item.description}</Text>
              <Text style={styles.groupMembers}>👥 {item.members} membres</Text>
            </View>
            <TouchableOpacity style={styles.joinBtn}>
              <Text style={styles.joinBtnText}>{t('join')}</Text>
            </TouchableOpacity>
          </View>
        )} />
    </View>
  );
  const renderWallet = () => (
  <ScrollView style={styles.tabContent}>
    <Text style={styles.tabTitle}>💳 Mon Wallet</Text>

    {/* SOLDE */}
    <View style={[styles.walletCard, { marginBottom: 16 }]}>
      <Text style={styles.walletTitle}>💎 Solde ZND</Text>
      <Text style={styles.walletBalance}>{authUser?.znd || 0} ZND</Text>
      <Text style={styles.walletSub}>
        ≈ {((authUser?.znd || 0) * 0.005).toFixed(2)} € · BSC Mainnet
      </Text>
      {authUser?.walletAddress && (
        <Text style={{ color: '#6b7280', fontSize: 10, marginTop: 8 }}>
          {authUser.walletAddress.slice(0, 6)}...{authUser.walletAddress.slice(-4)}
        </Text>
      )}
    </View>

    {/* BOUTONS ACTIONS */}
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
      <TouchableOpacity
        style={[styles.btnPrimary, { flex: 1, marginBottom: 0 }]}
        onPress={() => setShowSendZnd(true)}>
        <Text style={styles.btnPrimaryText}>📤 Envoyer</Text>
      </TouchableOpacity>
      <TouchableOpacity
  style={[styles.btnSecondary, { flex: 1 }]}
  onPress={() => Linking.openURL('https://pancakeswap.finance/swap?outputCurrency=0x3BcE58FC2C2BB0653dC757Ba0bc5328d4f2f15A9').catch(() => alert('Impossible d\'ouvrir'))}>
  <Text style={styles.btnSecondaryText}>📥 Acheter</Text>
</TouchableOpacity>
    </View>

    {/* HISTORIQUE */}
    <Text style={styles.sectionTitle}>📊 Historique</Text>
    {txHistory.map(tx => (
      <View key={tx.id} style={[styles.activityItem, {
        borderColor: tx.type === 'recu'
          ? 'rgba(16,185,129,0.3)'
          : 'rgba(239,68,68,0.3)'
      }]}>
        <Text style={styles.activityEmoji}>
          {tx.type === 'recu' ? '📥' : '📤'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.activityTitle}>
            {tx.type === 'recu'
              ? 'Reçu de ' + tx.from
              : 'Envoyé à ' + tx.to}
          </Text>
          <Text style={styles.activityMeta}>{tx.date}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700',
          color: tx.type === 'recu' ? '#10b981' : '#ef4444' }}>
          {tx.type === 'recu' ? '+' : '-'}{tx.amount} ZND
        </Text>
      </View>
    ))}

    {/* MODAL ENVOYER ZND */}
    <Modal visible={showSendZnd} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.tabHeader}>
            <Text style={styles.tabTitle}>📤 Envoyer ZND</Text>
            <TouchableOpacity onPress={() => setShowSendZnd(false)}>
              <Text style={styles.searchClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.walletInfoBox}>
            <Text style={styles.walletInfoText}>
              💎 Solde : {authUser?.znd || 0} ZND
            </Text>
            <Text style={styles.walletInfoSub}>
              ≈ {((authUser?.znd || 0) * 0.005).toFixed(2)} €
            </Text>
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>📬 Adresse wallet destinataire</Text>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              placeholderTextColor="#6b7280"
              value={sendToAddress}
              onChangeText={v => setSendToAddress(v)}
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>💎 Montant ZND</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 100"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={sendAmount}
              onChangeText={v => setSendAmount(v)}
            />
          </View>

          {/* MONTANTS RAPIDES */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[10, 50, 100, 500].map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.filterBtn}
                onPress={() => setSendAmount(amount.toString())}>
                <Text style={styles.filterText}>{amount} ZND</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              if (!sendToAddress || !sendAmount) {
                alert('Remplis tous les champs');
                return;
              }
              if (!(await walletService.hasWallet())) {
                setShowSendZnd(false);
                setShowWalletConnect(true);
                return;
              }
              const amount = parseFloat(sendAmount);
              if (amount > (authUser?.znd || 0)) {
                alert('Solde insuffisant');
                return;
              }
              const success = await sendZndToUser(sendToAddress, amount);
              if (success) {
                setTxHistory(prev => [{
                  id: Date.now(),
                  type: 'envoye',
                  amount: amount,
                  to: sendToAddress.slice(0, 6) + '...',
                  date: 'maintenant',
                  status: 'success',
                }, ...prev]);
                setSendToAddress('');
                setSendAmount('');
                setShowSendZnd(false);
              }
            }}>
            <Text style={styles.btnPrimaryText}>
              📤 Envoyer {sendAmount || '0'} ZND
            </Text>
          </TouchableOpacity>

          <Text style={{ color: '#6b7280', fontSize: 11,
            textAlign: 'center', marginTop: 12 }}>
            Transaction sur BSC Mainnet · Frais ~0.001 BNB
          </Text>
        </View>
      </View>
    </Modal>
  </ScrollView>
);
  const renderJobs = () => (
  <ScrollView style={styles.tabContent}>
    <Text style={styles.tabTitle}>💼 Pulse Jobs</Text>

    {/* FILTRES */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 16 }}>
      {[
        { id: 'all', label: '🌍 Tout', },
        { id: 'mission', label: '🛵 Missions' },
        { id: 'service', label: '🔧 Services' },
        { id: 'emploi', label: '💼 Emplois' },
      ].map(f => (
        <TouchableOpacity key={f.id}
          style={[styles.filterBtn, jobFilter === f.id && styles.filterBtnActive,
            { marginRight: 8 }]}
          onPress={() => setJobFilter(f.id)}>
          <Text style={styles.filterText}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {/* BOUTON POSTER */}
    <TouchableOpacity
      style={[styles.btnPrimary, { marginBottom: 16 }]}
      onPress={() => setShowCreateJob(true)}>
      <Text style={styles.btnPrimaryText}>+ Poster une offre</Text>
    </TouchableOpacity>

    {/* LISTE DES JOBS */}
    {jobs
      .filter(j => jobFilter === 'all' || j.type === jobFilter)
      .map(job => (
        <TouchableOpacity
          key={job.id}
          style={[styles.groupItem, job.urgent && {
            borderColor: 'rgba(239,68,68,0.4)',
            backgroundColor: 'rgba(239,68,68,0.05)'
          }]}
          onPress={() => setShowJob(job)}>
          <Text style={styles.groupEmoji}>{job.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.groupName}>{job.title}</Text>
              {job.urgent && (
                <View style={{ backgroundColor: '#ef4444', borderRadius: 4,
                  paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    URGENT
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.groupDesc}>{job.description}</Text>
            <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '700', marginTop: 4 }}>
              {job.pay} {job.currency}
            </Text>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJob(job)}>
            <Text style={styles.joinBtnText}>Voir</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

    {/* MODAL VOIR JOB */}
    <Modal visible={!!showJob} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowJob(null)}>
            <Text style={styles.searchClose}>✕</Text>
          </TouchableOpacity>
          {showJob && (
            <View style={{ gap: 16 }}>
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 40 }}>{showJob.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{showJob.title}</Text>
                  <Text style={styles.cardMeta}>{showJob.type}</Text>
                </View>
                {showJob.urgent && (
                  <View style={{ backgroundColor: '#ef4444', borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                      URGENT
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>{showJob.description}</Text>
              <View style={styles.walletInfoBox}>
                <Text style={styles.walletInfoText}>
                  💰 {showJob.pay} {showJob.currency}
                </Text>
                <Text style={styles.walletInfoSub}>
                  {showJob.currency === 'ZND'
                    ? 'Paiement instantané en ZND sur BSC'
                    : 'Paiement en ' + showJob.currency}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  addNotification('Candidature envoyee !', 'job');
                  setShowJob(null);
                }}>
                <Text style={styles.btnPrimaryText}>✅ Postuler maintenant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setChatUser({ name: 'Recruteur', avatar: showJob.emoji });
                  setShowJob(null);
                }}>
                <Text style={styles.btnSecondaryText}>💬 Contacter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>

    {/* MODAL CRÉER JOB */}
    <Modal visible={showCreateJob} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <View style={styles.tabHeader}>
            <Text style={styles.tabTitle}>💼 Poster une offre</Text>
            <TouchableOpacity onPress={() => setShowCreateJob(false)}>
              <Text style={styles.searchClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* TYPE */}
            <Text style={styles.inputLabel}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'mission', label: '🛵 Mission' },
                { id: 'service', label: '🔧 Service' },
                { id: 'emploi', label: '💼 Emploi' },
              ].map(type => (
                <TouchableOpacity key={type.id}
                  style={[styles.filterBtn,
                    newJob.type === type.id && styles.filterBtnActive]}
                  onPress={() => setNewJob({...newJob, type: type.id})}>
                  <Text style={styles.filterText}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>📝 Titre</Text>
              <TextInput style={styles.input}
                placeholder="Ex: Livreur vélo urgent"
                placeholderTextColor="#6b7280"
                value={newJob.title}
                onChangeText={v => setNewJob({...newJob, title: v})} />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>📄 Description</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Décris le job..."
                placeholderTextColor="#6b7280"
                multiline
                value={newJob.description}
                onChangeText={v => setNewJob({...newJob, description: v})} />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>💰 Rémunération</Text>
              <TextInput style={styles.input}
                placeholder="Ex: 50"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
                value={newJob.pay}
                onChangeText={v => setNewJob({...newJob, pay: v})} />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>💱 Devise</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['ZND', 'EUR', 'USD'].map(cur => (
                  <TouchableOpacity key={cur}
                    style={[styles.filterBtn,
                      newJob.currency === cur && styles.filterBtnActive]}
                    onPress={() => setNewJob({...newJob, currency: cur})}>
                    <Text style={styles.filterText}>{cur}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>😀 Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['🛵','🔧','💻','📚','📦','🤝','🎨','🏋️','✂️','🍕'].map(emoji => (
                  <TouchableOpacity key={emoji}
                    style={[styles.reactionBtn,
                      newJob.emoji === emoji && { backgroundColor: 'rgba(107,33,168,0.4)' }]}
                    onPress={() => setNewJob({...newJob, emoji})}>
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                if (!newJob.title.trim()) return;
                const job = {
                  id: Date.now(),
                  type: newJob.type,
                  title: newJob.title,
                  description: newJob.description,
                  pay: parseFloat(newJob.pay) || 0,
                  currency: newJob.currency,
                  emoji: newJob.emoji,
                  urgent: false,
                  lat: userLocation?.latitude || 48.856,
                  lng: userLocation?.longitude || 2.352,
                };
                setJobs(prev => [job, ...prev]);
                addNotification('Offre publiee !', 'job');
                setNewJob({ title: '', description: '', type: 'mission',
                  pay: '', currency: 'ZND', emoji: '💼' });
                setShowCreateJob(false);
              }}>
              <Text style={styles.btnPrimaryText}>✅ Publier l'offre</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </ScrollView>
);
const renderMarket = () => (
  <ScrollView style={styles.tabContent}>
    <Text style={styles.tabTitle}>🏪 Marketplace</Text>

    {/* CRÉER SA BOUTIQUE */}
    {!myShop ? (
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => setShowCreateShop(true)}>
        <Text style={styles.btnPrimaryText}>🏪 Créer ma boutique</Text>
      </TouchableOpacity>
    ) : (
      <View style={styles.walletCard}>
        <Text style={styles.walletTitle}>{myShop.emoji} {myShop.name}</Text>
        <Text style={styles.walletSub}>{myShop.description}</Text>
        <TouchableOpacity
          style={styles.walletBtn}
          onPress={() => setShowAddProduct(true)}>
          <Text style={styles.walletBtnText}>+ Ajouter un produit</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* PRODUITS DE MA BOUTIQUE */}
    {shopProducts.length > 0 && (
      <>
        <Text style={styles.sectionTitle}>📦 Mes produits</Text>
        {shopProducts.map(product => (
          <View key={product.id} style={styles.activityItem}>
            <Text style={styles.activityEmoji}>{product.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>{product.name}</Text>
              <Text style={styles.activityMeta}>
                {product.price} {product.currency} · {product.description}
              </Text>
            </View>
          </View>
        ))}
      </>
    )}

    {/* TOUTES LES BOUTIQUES */}
    <Text style={styles.sectionTitle}>🌍 Boutiques & Services</Text>
    {[
      { id: 1, name: 'Café Pulse ☕', description: 'Café cosy', emoji: '☕', type: 'food' },
      { id: 2, name: 'FitZone 🏋️', description: 'Salle de sport', emoji: '🏋️', type: 'sport' },
      { id: 3, name: 'Pizza Crypto 🍕', description: 'Livraison pizza', emoji: '🍕', type: 'food' },
      { id: 4, name: 'Massage Zen 💆', description: 'Massage à domicile', emoji: '💆', type: 'service' },
      { id: 5, name: 'CoiffurePro ✂️', description: 'Coiffure à domicile', emoji: '✂️', type: 'service' },
      { id: 6, name: 'BricoExpert 🔧', description: 'Bricolage et réparations', emoji: '🔧', type: 'service' },
    ].map(shop => (
      <View key={shop.id} style={styles.groupItem}>
        <Text style={styles.groupEmoji}>{shop.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName}>{shop.name}</Text>
          <Text style={styles.groupDesc}>{shop.description}</Text>
        </View>
        <TouchableOpacity style={styles.joinBtn}>
          <Text style={styles.joinBtnText}>Voir</Text>
        </TouchableOpacity>
      </View>
    ))}

    {/* MODAL CRÉER BOUTIQUE */}
    <Modal visible={showCreateShop} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.tabHeader}>
            <Text style={styles.tabTitle}>🏪 Ma boutique</Text>
            <TouchableOpacity onPress={() => setShowCreateShop(false)}>
              <Text style={styles.searchClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>🏪 Nom</Text>
            <TextInput style={styles.input}
              placeholder="Ex: Mon Restaurant" placeholderTextColor="#6b7280"
              value={newShop.name}
              onChangeText={v => setNewShop({...newShop, name: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>📄 Description</Text>
            <TextInput style={styles.input}
              placeholder="Décris ta boutique..." placeholderTextColor="#6b7280"
              value={newShop.description}
              onChangeText={v => setNewShop({...newShop, description: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>😀 Emoji</Text>
            <TextInput style={styles.input}
              placeholder="🏪" placeholderTextColor="#6b7280"
              value={newShop.emoji}
              onChangeText={v => setNewShop({...newShop, emoji: v})} />
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              if (!newShop.name.trim()) return;
              try {
                const response = await fetch(API_URL + '/shops', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
                  body: JSON.stringify({
                    userId: authUser?.id,
                    name: newShop.name,
                    description: newShop.description,
                    type: newShop.type,
                    emoji: newShop.emoji,
                    lat: userLocation?.latitude || 48.856,
                    lng: userLocation?.longitude || 2.352,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  setMyShop(data.shop);
                  setShowCreateShop(false);
                  addNotification('Boutique creee !', 'event');
                }
              } catch (err) {
                alert('Erreur creation boutique');
              }
            }}>
            <Text style={styles.btnPrimaryText}>✅ Créer ma boutique</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* MODAL AJOUTER PRODUIT */}
    <Modal visible={showAddProduct} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.tabHeader}>
            <Text style={styles.tabTitle}>📦 Ajouter produit</Text>
            <TouchableOpacity onPress={() => setShowAddProduct(false)}>
              <Text style={styles.searchClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>📦 Nom du produit</Text>
            <TextInput style={styles.input}
              placeholder="Ex: Pizza Margherita" placeholderTextColor="#6b7280"
              value={newProduct.name}
              onChangeText={v => setNewProduct({...newProduct, name: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>📄 Description</Text>
            <TextInput style={styles.input}
              placeholder="Décris ton produit..." placeholderTextColor="#6b7280"
              value={newProduct.description}
              onChangeText={v => setNewProduct({...newProduct, description: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>💰 Prix</Text>
            <TextInput style={styles.input}
              placeholder="Ex: 100" placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={newProduct.price}
              onChangeText={v => setNewProduct({...newProduct, price: v})} />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>💱 Devise</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['ZND', 'EUR', 'USD'].map(cur => (
                <TouchableOpacity
                  key={cur}
                  style={[styles.filterBtn,
                    newProduct.currency === cur && styles.filterBtnActive]}
                  onPress={() => setNewProduct({...newProduct, currency: cur})}>
                  <Text style={styles.filterText}>{cur}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>😀 Emoji</Text>
            <TextInput style={styles.input}
              placeholder="📦" placeholderTextColor="#6b7280"
              value={newProduct.emoji}
              onChangeText={v => setNewProduct({...newProduct, emoji: v})} />
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              if (!newProduct.name.trim()) return;
              try {
                const response = await fetch(API_URL + '/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
                  body: JSON.stringify({
                    shopId: myShop?.id,
                    name: newProduct.name,
                    description: newProduct.description,
                    price: parseFloat(newProduct.price) || 0,
                    currency: newProduct.currency,
                    emoji: newProduct.emoji,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  setShopProducts(prev => [...prev, data.product]);
                  setNewProduct({ name: '', description: '', price: '', currency: 'ZND', emoji: '📦' });
                  setShowAddProduct(false);
                  addNotification('Produit ajoute !', 'event');
                }
              } catch (err) {
                alert('Erreur ajout produit');
              }
            }}>
            <Text style={styles.btnPrimaryText}>✅ Ajouter le produit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </ScrollView>
);
  const renderShop = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>🛍️ {t('shop')}</Text>
      <View style={styles.shopBalance}>
        <Text style={styles.shopBalanceLabel}>{t('balance')}</Text>
        <Text style={styles.shopBalanceVal}>
          {authUser?.znd || 0} ZND ≈ {((authUser?.znd || 0) * 0.005).toFixed(2)}€
        </Text>
      </View>
      <View style={styles.shopGrid}>
        {SHOP_ITEMS.map(item => (
          <TouchableOpacity key={item.id} style={styles.shopItem}>
            <Text style={styles.shopEmoji}>{item.emoji}</Text>
            <Text style={styles.shopName}>{item.name}</Text>
            <Text style={styles.shopDesc}>{item.description}</Text>
            <View style={styles.shopPriceRow}>
              <Text style={styles.shopPrice}>{item.price}€</Text>
              <Text style={styles.shopPriceZnd}>{Math.round(item.price / 0.005)} ZND</Text>
            </View>
            <TouchableOpacity
  style={styles.shopBuyBtn}
  onPress={() => Linking.openURL('https://pancakeswap.finance/swap?outputCurrency=0x3BcE58FC2C2BB0653dC757Ba0bc5328d4f2f15A9').catch(() => alert('Impossible d\'ouvrir'))}>
  <Text style={styles.shopBuyText}>🛒 Acheter ZND</Text>
</TouchableOpacity>
</TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  if (screen === 'map_preview') return renderMapPreview();
  if (screen === 'welcome')     return renderWelcome();
  if (screen === 'register')    return renderRegister();
  if (screen === 'login')       return renderLogin();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {activeTab === 'map'      && renderMap()}
      {activeTab === 'profile'  && renderProfile()}
      {activeTab === 'messages' && renderMessages()}
      {activeTab === 'groups'   && renderGroups()}
      {activeTab === 'shop'     && renderShop()}
      {activeTab === 'market'   && renderMarket()}
      {activeTab === 'jobs' && renderJobs()}
      {activeTab === 'wallet' && renderWallet()}
      {activeTab === 'valt' && (
  <VALTDashboard navigation={{
    navigate: (screen) => {
      setActiveTab(
        screen === 'CreatePledge' ? 'createPledge'
        : screen === 'GenerateQR' ? 'generateQR'
        : screen === 'ScanQR' ? 'scanQR'
        : screen === 'WalletScreen' ? 'wallet'
        : 'valt'
      );
    }
  }} />
)}
{activeTab === 'createPledge' && (
  <CreatePledgeScreen navigation={{ navigate: setActiveTab, goBack: () => setActiveTab('valt') }} />
)}
{activeTab === 'generateQR' && (
  <GenerateQRScreen navigation={{ navigate: setActiveTab, goBack: () => setActiveTab('valt') }} />
)}
{activeTab === 'scanQR' && (
  <ScanQRScreen navigation={{ navigate: setActiveTab, goBack: () => setActiveTab('valt') }} />
)}


<View style={styles.navbar}>
  {[
    { id: 'map',      emoji: '🗺️', label: t('map')      },
    { id: 'messages', emoji: '💬', label: t('messages')  },
    { id: 'groups',   emoji: '👥', label: t('groups')    },
    { id: 'shop',     emoji: '🛍️', label: t('shop')      },
    { id: 'profile',  emoji: '👤', label: t('profile')   },
{ id: 'market',   emoji: '🏪', label: 'Market'        },
{ id: 'jobs',   emoji: '💼', label: 'Jobs'   },
{ id: 'wallet', emoji: '💳', label: 'Wallet' },
{ id: 'valt', emoji: '🏦', label: 'VALT' },
  ].map(tab => (
    <TouchableOpacity key={tab.id}
      style={[styles.navItem, activeTab === tab.id && styles.navItemActive]}
      onPress={() => setActiveTab(tab.id)}>
      <Text style={styles.navEmoji}>{tab.emoji}</Text>
      <Text style={[styles.navLabel, activeTab === tab.id && styles.navLabelActive]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  ))}
  {/* CLOCHE NOTIFICATIONS */}
  <TouchableOpacity
    style={[styles.navItem, { position: 'relative' }]}
    onPress={() => setShowNotifs(true)}>
    <View>
      <Text style={styles.navEmoji}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{unreadCount}</Text>
        </View>
      )}
    </View>
    <Text style={styles.navLabel}>Notifs</Text>
  </TouchableOpacity>
</View>

      {/* MODAL NOTIFICATIONS */}
      <Modal visible={showNotifs} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>🔔 Notifications</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={styles.switchLink}>Tout lire</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowNotifs(false)}>
                  <Text style={styles.searchClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList data={notifications} keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.notifItem, !item.read && styles.notifItemUnread]}
                  onPress={() => {
                    setNotifications(prev =>
                      prev.map(n => n.id === item.id ? { ...n, read: true } : n));
                  }}>
                  <Text style={styles.notifItemText}>{item.text}</Text>
                  <Text style={styles.notifItemTime}>{item.time}</Text>
                  {!item.read && <View style={styles.notifDot} />}
                </TouchableOpacity>
              )} />
          </View>
        </View>
      </Modal>

      {/* MODAL IA MATCHING */}
      <MatchingScreen
        visible={showMatching}
        onClose={() => setShowMatching(false)}
        currentUser={authUser}
        onOpenChat={(profile) => { setShowMatching(false); setChatUser(profile); }}
        onMatch={(profile) => addNotification(`${profile.name} correspond à tes intérêts ! 👋`, 'match')}
      />

      {/* MODAL BUSINESS DASHBOARD */}
      <Modal visible={showBusinessDash} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>📊 Tableau de bord</Text>
              <TouchableOpacity onPress={() => setShowBusinessDash(false)}>
                <Text style={styles.searchClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}>
                {MOCK_BUSINESSES.map(b => (
                  <TouchableOpacity key={b.id}
                    style={[styles.bizSelectorBtn,
                      activeBusiness.id === b.id && styles.bizSelectorBtnActive]}
                    onPress={() => setActiveBusiness(b)}>
                    <Text style={styles.bizSelectorEmoji}>{b.emoji}</Text>
                    <Text style={styles.bizSelectorName}>{b.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.bizKpiGrid}>
                <View style={styles.bizKpi}>
                  <Text style={styles.bizKpiVal}>{activeBusiness.revenue}</Text>
                  <Text style={styles.bizKpiLabel}>ZND revenus</Text>
                </View>
                <View style={styles.bizKpi}>
                  <Text style={styles.bizKpiVal}>{activeBusiness.orders}</Text>
                  <Text style={styles.bizKpiLabel}>Commandes</Text>
                </View>
                <View style={styles.bizKpi}>
                  <Text style={[styles.bizKpiVal, { color: '#C9A84C' }]}>
                    {activeBusiness.rating}⭐
                  </Text>
                  <Text style={styles.bizKpiLabel}>Note</Text>
                </View>
                <View style={styles.bizKpi}>
                  <Text style={[styles.bizKpiVal, { color: '#10b981' }]}>
                    -{activeBusiness.zndDiscount}%
                  </Text>
                  <Text style={styles.bizKpiLabel}>Réduction ZND</Text>
                </View>
              </View>
              <Text style={styles.sectionTitle}>⚡ Actions rapides</Text>
              {[
                { emoji: '📣', label: 'Créer une offre flash', action: () => addNotification('📣 Offre flash publiée !', 'event') },
                { emoji: '🚀', label: 'Booster la visibilité (50 ZND)', action: () => addNotification('🚀 Boost activé 24h !', 'znd') },
                { emoji: '🎁', label: 'Offrir des ZND aux clients', action: () => addNotification('🎁 Cadeau ZND envoyé !', 'znd') },
                { emoji: '📊', label: 'Voir les analytics détaillés', action: () => {} },
              ].map((action, i) => (
                <TouchableOpacity key={i} style={styles.bizAction} onPress={action.action}>
                  <Text style={styles.bizActionEmoji}>{action.emoji}</Text>
                  <Text style={styles.bizActionLabel}>{action.label}</Text>
                  <Text style={{ color: '#a78bfa' }}>→</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.sectionTitle}>📦 Commandes récentes</Text>
              {[
                { user: '👨 Alex', item: 'Café + croissant', znd: 45, status: '✅' },
                { user: '👩 Sofia', item: 'Abonnement mensuel', znd: 200, status: '✅' },
                { user: '🧑 Marcus', item: 'Session sport 1h', znd: 80, status: '⏳' },
              ].map((order, i) => (
                <View key={i} style={styles.orderItem}>
                  <Text style={{ fontSize: 20 }}>{order.status}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderUser}>{order.user} · {order.item}</Text>
                  </View>
                  <Text style={styles.orderZnd}>+{order.znd} ZND</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL RECHERCHE */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.searchInputRow}>
              <TextInput style={styles.searchInput}
                placeholder={t('search')} placeholderTextColor="#6b7280"
                value={searchQuery} onChangeText={setSearch} autoFocus />
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(''); }}>
                <Text style={styles.searchClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {searchResults.length > 0 ? (
              <FlatList data={searchResults} keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchResult}
                    onPress={() => {
                      setShowSearch(false); setSearch('');
                      setMapRegion({ latitude: item.lat, longitude: item.lng,
                        latitudeDelta: 0.01, longitudeDelta: 0.01 });
                      setActiveTab('map'); handleSelect(item, 'event');
                    }}>
                    <Text style={styles.searchResultEmoji}>{EVENT_TYPES[item.type].emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle}>{item.title}</Text>
                      <Text style={styles.searchResultMeta}>🌍 {item.city} · +{item.zndReward} ZND</Text>
                    </View>
                  </TouchableOpacity>
                )} />
            ) : searchQuery.length > 1 ? (
              <Text style={styles.noResults}>{t('noResults')}</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* MODAL PROFIL UTILISATEUR */}
      <Modal visible={!!showProfile} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <TouchableOpacity style={styles.modalClose} onPress={() => setShowProfile(null)}>
        <Text style={styles.searchClose}>✕</Text>
      </TouchableOpacity>
      {showProfile && (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 64 }}>{showProfile.avatar}</Text>
          <Text style={styles.profileName}>{showProfile.name}</Text>
          <Text style={styles.profileBio}>{showProfile.bio}</Text>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{showProfile.zndScore}</Text>
              <Text style={styles.profileStatLabel}>ZND</Text>
            </View>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{showProfile.friends}</Text>
              <Text style={styles.profileStatLabel}>{t('friends')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity
              style={[styles.cardJoinBtn, { flex: 1 }]}
              onPress={() => { setShowProfile(null); setChatUser(showProfile); }}>
              <Text style={styles.cardJoinText}>💬 Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardJoinBtn, { flex: 1,
                backgroundColor: 'rgba(107,33,168,0.3)' }]}>
              <Text style={styles.cardJoinText}>💜 {t('add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardJoinBtn, { flex: 1,
                backgroundColor: 'rgba(201,168,76,0.2)' }]}
              onPress={() => {
                if (!showProfile?.walletAddress) {
                  alert('Cet utilisateur na pas de wallet connecte');
                  return;
                }
                sendZndToUser(showProfile.walletAddress, 10);
                setShowProfile(null);
              }}>
              <Text style={styles.cardJoinText}>💎 10 ZND</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  </View>
</Modal>

      {/* MODAL CHAT */}
      <Modal visible={!!chatUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatAvatar}>{chatUser?.avatar}</Text>
              <Text style={styles.chatName}>{chatUser?.user || chatUser?.name}</Text>
              <TouchableOpacity onPress={() => setChatUser(null)}>
                <Text style={styles.searchClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMessages}>
  {chatMessages.length === 0 && (
    <View style={styles.chatBubbleOther}>
      <Text style={styles.chatBubbleText}>{chatUser?.text || 'Salut ! 👋'}</Text>
      <TouchableOpacity
        style={{ marginTop: 4 }}
        onPress={async () => {
          const translated = await translateText(
            chatUser?.text || 'Salut !', lang
          );
          setTranslatedMessages(prev => ({
            ...prev, ['default']: translated
          }));
        }}>
        <Text style={{ color: '#a78bfa', fontSize: 10 }}>
          {isTranslating ? '⏳ Traduction...' : '🌐 Traduire'}
        </Text>
      </TouchableOpacity>
      {translatedMessages['default'] && (
        <Text style={{ color: '#C9A84C', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
          {translatedMessages['default']}
        </Text>
      )}
    </View>
  )}
  {chatMessages.map(msg => (
    <View key={msg.id}
      style={msg.from_user === authUser?.id
        ? styles.chatBubbleMine
        : styles.chatBubbleOther}>
      <Text style={styles.chatBubbleText}>{msg.text}</Text>
      {msg.from_user !== authUser?.id && (
        <TouchableOpacity
          style={{ marginTop: 4 }}
          onPress={async () => {
            const translated = await translateText(msg.text, lang);
            setTranslatedMessages(prev => ({
              ...prev, [msg.id]: translated
            }));
          }}>
          <Text style={{ color: '#a78bfa', fontSize: 10 }}>
            {isTranslating ? '⏳...' : '🌐 Traduire'}
          </Text>
        </TouchableOpacity>
      )}
      {translatedMessages[msg.id] && (
        <Text style={{ color: '#C9A84C', fontSize: 12,
          marginTop: 4, fontStyle: 'italic' }}>
          {translatedMessages[msg.id]}
        </Text>
      )}
    </View>
  ))}
</ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput style={styles.chatInput}
                placeholder={t('sendMessage')} placeholderTextColor="#6b7280"
                value={messageText} onChangeText={setMessageText} />
<TouchableOpacity
  style={styles.chatSendBtn}
  onPress={async () => {
    if (!messageText.trim()) return;
    try {
      const response = await fetch(API_URL + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          from: authUser?.id,
          to: chatUser?.id,
          text: messageText,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          from_user: authUser?.id,
          to_user: chatUser?.id,
          text: messageText,
        }]);
        setMessageText('');
        addNotification('Message envoye !', 'message');
      }
    } catch (err) {
      alert('Erreur envoi message');
    }
  }}>
  <Text style={styles.chatSendText}>{t('send')}</Text>
</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* MODAL IMPORT WALLET */}
<Modal visible={showWalletConnect} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🔐 Importer un wallet</Text>
        <TouchableOpacity onPress={() => setShowWalletConnect(false)}>
          <Text style={styles.searchClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.walletInfoBox}>
        <Text style={styles.walletInfoText}>⚠️ Sécurité importante</Text>
        <Text style={styles.walletInfoSub}>
          Ta clé privée / phrase mnémonique reste uniquement sur ton téléphone (stockage sécurisé).
          Elle n'est jamais envoyée sur nos serveurs.
        </Text>
      </View>
      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>🔑 Clé privée (0x...) ou phrase mnémonique</Text>
        <TextInput
          style={styles.input}
          placeholder="0x... ou mot1 mot2 mot3 ..."
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={importInput}
          onChangeText={v => setImportInput(v)}
        />
      </View>
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={async () => {
          const value = importInput.trim();
          if (!value) return;
          try {
            const isPrivateKey = value.startsWith('0x') && value.length === 66;
            const result = isPrivateKey
              ? await walletService.importFromPrivateKey(value)
              : await walletService.importWallet(value);
            setAuthUser(prev => ({ ...prev, walletAddress: result.address }));
            setShowWalletConnect(false);
            setImportInput('');
            addNotification('Wallet importé avec succès !', 'znd');
          } catch (err) {
            alert('Import échoué : ' + err.message);
          }
        }}>
        <Text style={styles.btnPrimaryText}>🔗 Importer ce wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnSecondary, { marginTop: 8 }]}
        onPress={() => setShowWalletConnect(false)}>
        <Text style={styles.btnSecondaryText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

      {/* MODAL NOUVEAU GROUPE */}
      <Modal visible={showNewGroup} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.tabTitle}>👥 {t('newGroup')}</Text>
            <TextInput style={styles.searchInput}
              placeholder={t('groupName')} placeholderTextColor="#6b7280"
              value={groupName} onChangeText={setGroupName} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[styles.cardJoinBtn, { flex: 1 }]}
                onPress={() => { setShowNewGroup(false); setGroupName(''); }}>
                <Text style={styles.cardJoinText}>✅ {t('createGroup')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cardJoinBtn, { flex: 1,
                backgroundColor: 'rgba(107,33,168,0.3)' }]}
                onPress={() => setShowNewGroup(false)}>
                <Text style={styles.cardJoinText}>✕ Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#080510' },
  map:               { flex: 1 },
  previewBottom:     { position: 'absolute', bottom: 0, left: 0, right: 0,
                       padding: 24, paddingBottom: 40,
                       backgroundColor: 'rgba(8,5,16,0.85)',
                       borderTopLeftRadius: 24, borderTopRightRadius: 24,
                       borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
                       gap: 12, alignItems: 'center' },
  previewLangRow:    { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40,
                       right: 16, flexDirection: 'row', gap: 8 },
  previewLogo:       { alignItems: 'center', marginBottom: 8 },
  welcomeOverlay:    { ...StyleSheet.absoluteFillObject,
                       backgroundColor: 'rgba(8,5,16,0.82)',
                       padding: 24, paddingTop: 60,
                       alignItems: 'center', justifyContent: 'center' },
  authFullOverlay:   { ...StyleSheet.absoluteFillObject,
                       backgroundColor: 'rgba(8,5,16,0.92)' },
  eventMarker:       { alignItems: 'center', justifyContent: 'center',
                       width: 44, height: 44, borderRadius: 22,
                       backgroundColor: 'rgba(13,8,32,0.9)', borderWidth: 2 },
  eventEmoji:        { fontSize: 20 },
  zndBadge:          { position: 'absolute', top: -6, right: -6,
                       backgroundColor: '#C9A84C', borderRadius: 8,
                       paddingHorizontal: 4, paddingVertical: 1 },
  zndBadgeText:      { fontSize: 8, color: '#000', fontWeight: '700' },
  userNearbyMarker:  { width: 36, height: 36, borderRadius: 18,
                       backgroundColor: 'rgba(45,27,105,0.9)',
                       borderWidth: 2, borderColor: 'rgba(167,139,250,0.5)',
                       alignItems: 'center', justifyContent: 'center' },
  userNearbyEmoji:   { fontSize: 18 },
  userOnlineDot:     { position: 'absolute', bottom: 0, right: 0,
                       width: 10, height: 10, borderRadius: 5,
                       backgroundColor: '#10b981', borderWidth: 2, borderColor: '#080510' },
  myLocationMarker:  { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  myLocationDot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: '#a78bfa' },
  myLocationRing:    { position: 'absolute', width: 28, height: 28, borderRadius: 14,
                       borderWidth: 3, borderColor: 'rgba(167,139,250,0.4)' },
  treasureMarker:    { width: 48, height: 48, borderRadius: 24,
                       alignItems: 'center', justifyContent: 'center',
                       backgroundColor: 'rgba(201,168,76,0.15)',
                       borderWidth: 2, borderColor: '#C9A84C' },
  treasureEmoji:     { fontSize: 24 },
  treasureModal:     { backgroundColor: '#0d0820', borderTopLeftRadius: 24,
                       borderTopRightRadius: 24, padding: 40, alignItems: 'center',
                       gap: 12, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
                       width: '100%' },
  treasureModalEmoji:{ fontSize: 72 },
  treasureModalTitle:{ fontSize: 22, fontWeight: '800', color: '#fff' },
  treasureModalZnd:  { fontSize: 36, fontWeight: '900', color: '#C9A84C' },
  businessMarker:    { width: 44, height: 44, borderRadius: 10,
                       alignItems: 'center', justifyContent: 'center',
                       backgroundColor: 'rgba(13,8,32,0.9)',
                       borderWidth: 2, borderColor: '#C9A84C' },
  businessEmoji:     { fontSize: 20 },
  businessBadge:     { position: 'absolute', top: -6, right: -6,
                       backgroundColor: '#10b981', borderRadius: 8,
                       paddingHorizontal: 4, paddingVertical: 1 },
  businessBadgeText: { fontSize: 8, color: '#fff', fontWeight: '700' },
  header:            { position: 'absolute', top: 0, left: 0, right: 0,
                       flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', paddingHorizontal: 16,
                       paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 12 },
  headerLeft:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo:              { fontSize: 20, fontWeight: '800', color: '#a78bfa', letterSpacing: 2 },
  liveIndicator:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                       backgroundColor: 'rgba(239,68,68,0.15)',
                       paddingHorizontal: 8, paddingVertical: 3,
                       borderRadius: 100, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  liveDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText:          { fontSize: 9, color: '#ef4444', fontWeight: '700', letterSpacing: 1 },
  langSelector:      { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(13,8,32,0.85)',
                       borderRadius: 100, padding: 3, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)' },
  langBtn:           { width: 28, height: 28, borderRadius: 14,
                       alignItems: 'center', justifyContent: 'center' },
  langBtnActive:     { backgroundColor: 'rgba(107,33,168,0.5)' },
  langText:          { fontSize: 14 },
  notifBtn:          { width: 36, height: 36, borderRadius: 18,
                       backgroundColor: 'rgba(255,255,255,0.08)',
                       alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifIcon:         { fontSize: 16 },
  notifBadge:        { position: 'absolute', top: -2, right: -2,
                       backgroundColor: '#ef4444', borderRadius: 8,
                       minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText:    { fontSize: 9, color: '#fff', fontWeight: '700' },
  notifItem:         { padding: 14, borderBottomWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)',
                       flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifItemUnread:   { backgroundColor: 'rgba(107,33,168,0.1)' },
  notifItemText:     { flex: 1, fontSize: 13, color: '#e8e0f0' },
  notifItemTime:     { fontSize: 10, color: '#6b7280' },
  notifDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a78bfa' },
  zndBalance:        { backgroundColor: 'rgba(201,168,76,0.15)',
                       paddingHorizontal: 10, paddingVertical: 5,
                       borderRadius: 100, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  zndBalanceText:    { fontSize: 12, color: '#C9A84C', fontWeight: '600' },
  searchBar:         { position: 'absolute', top: Platform.OS === 'ios' ? 105 : 90,
                       left: 16, right: 16, flexDirection: 'row', alignItems: 'center',
                       gap: 8, backgroundColor: 'rgba(13,8,32,0.92)',
                       borderRadius: 12, padding: 12, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.2)' },
  searchIcon:        { fontSize: 16 },
  searchPlaceholder: { color: '#6b7280', fontSize: 13, flex: 1 },
  statsBar:          { position: 'absolute', top: Platform.OS === 'ios' ? 165 : 150,
                       left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-around',
                       backgroundColor: 'rgba(13,8,32,0.85)', borderRadius: 12,
                       padding: 12, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)' },
  statItem:          { alignItems: 'center' },
  statVal:           { fontSize: 16, fontWeight: '700', color: '#a78bfa' },
  statLabel:         { fontSize: 9, color: '#6b7280', marginTop: 2,
                       textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider:       { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  filtersContainer:  { position: 'absolute', top: Platform.OS === 'ios' ? 240 : 225,
                       left: 0, right: 0, maxHeight: 44 },
  filterBtn:         { backgroundColor: 'rgba(13,8,32,0.85)', paddingHorizontal: 12,
                       paddingVertical: 6, borderRadius: 100, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)' },
  filterBtnActive:   { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  filterText:        { fontSize: 11, color: '#e8e0f0' },
  createBtn:         { position: 'absolute', bottom: 90, alignSelf: 'center',
                       backgroundColor: '#6B21A8', paddingHorizontal: 28,
                       paddingVertical: 14, borderRadius: 100 },
  createBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  geoBtn:            { position: 'absolute', right: 16, bottom: 170,
                       width: 48, height: 48, borderRadius: 24,
                       backgroundColor: 'rgba(13,8,32,0.9)',
                       alignItems: 'center', justifyContent: 'center',
                       borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' },
  geoBtnText:        { fontSize: 22 },
  matchBtn:          { position: 'absolute', right: 16, bottom: 230,
                       width: 48, height: 48, borderRadius: 24,
                       backgroundColor: 'rgba(107,33,168,0.6)',
                       alignItems: 'center', justifyContent: 'center',
                       borderWidth: 1, borderColor: '#a78bfa' },
  matchBtnText:      { fontSize: 22 },
  earnWidget:        { position: 'absolute', left: 16, bottom: 100,
                       flexDirection: 'row', alignItems: 'center', gap: 10,
                       backgroundColor: 'rgba(13,8,32,0.92)',
                       borderRadius: 16, padding: 12, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.2)' },
  earnWidgetActive:  { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
  earnEmoji:         { fontSize: 28 },
  earnTitle:         { fontSize: 12, fontWeight: '700', color: '#e8e0f0' },
  earnStats:         { fontSize: 11, color: '#10b981', marginTop: 2 },
  detailCard:        { position: 'absolute', bottom: 80, left: 0, right: 0,
                       backgroundColor: '#0d0820', borderTopLeftRadius: 24,
                       borderTopRightRadius: 24, borderTopWidth: 1,
                       borderColor: 'rgba(167,139,250,0.2)', padding: 24, paddingBottom: 16 },
  cardClose:         { position: 'absolute', top: 16, right: 20, width: 32, height: 32,
                       borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)',
                       alignItems: 'center', justifyContent: 'center' },
  cardCloseText:     { color: '#9b8cb0', fontSize: 14 },
  cardContent:       { gap: 14 },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji:         { fontSize: 32 },
  cardTitle:         { fontSize: 18, fontWeight: '700', color: '#fff' },
  cardMeta:          { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  cardReward:        { backgroundColor: 'rgba(201,168,76,0.1)', paddingHorizontal: 10,
                       paddingVertical: 4, borderRadius: 100, borderWidth: 1,
                       borderColor: 'rgba(201,168,76,0.3)' },
  cardRewardText:    { color: '#C9A84C', fontSize: 12, fontWeight: '700' },
  cardDesc:          { color: '#9b8cb0', fontSize: 14, lineHeight: 20 },
  partBar:           { height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
                       borderRadius: 2, overflow: 'hidden' },
  partFill:          { height: '100%', backgroundColor: '#a78bfa', borderRadius: 2 },
  cardPartText:      { color: '#e8e0f0', fontSize: 13 },
  cardJoinBtn:       { backgroundColor: '#6B21A8', padding: 16, borderRadius: 12, alignItems: 'center' },
  cardJoinText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  navbar:            { flexDirection: 'row', backgroundColor: '#0d0820',
                       borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
                       paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8 },
  navItem:           { flex: 1, alignItems: 'center', gap: 2 },
  navItemActive:     {},
  navEmoji:          { fontSize: 20 },
  navLabel:          { fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  navLabelActive:    { color: '#a78bfa' },
  tabContent:        { flex: 1, backgroundColor: '#080510', padding: 16,
                       paddingTop: Platform.OS === 'ios' ? 60 : 44 },
  tabTitle:          { fontSize: 22, fontWeight: '800', color: '#a78bfa', marginBottom: 16 },
  tabHeader:         { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', marginBottom: 16 },
  sectionTitle:      { fontSize: 16, fontWeight: '700', color: '#e8e0f0',
                       marginBottom: 12, marginTop: 8 },
  addBtn:            { backgroundColor: '#6B21A8', paddingHorizontal: 16,
                       paddingVertical: 8, borderRadius: 100 },
  addBtnText:        { color: '#fff', fontSize: 12, fontWeight: '600' },
  profileHero:       { alignItems: 'center', paddingVertical: 24,
                       borderBottomWidth: 1, borderColor: 'rgba(167,139,250,0.15)', marginBottom: 16 },
  profileAvatar:     { fontSize: 72, marginBottom: 8 },
  profileName:       { fontSize: 24, fontWeight: '800', color: '#fff' },
  profileBio:        { fontSize: 14, color: '#9b8cb0', marginTop: 4, textAlign: 'center' },
  profileStats:      { flexDirection: 'row', gap: 24, marginTop: 16 },
  profileStat:       { alignItems: 'center' },
  profileStatVal:    { fontSize: 20, fontWeight: '700', color: '#a78bfa' },
  profileStatLabel:  { fontSize: 11, color: '#6b7280', marginTop: 2 },
  walletCard:        { backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1,
                       borderColor: 'rgba(201,168,76,0.3)', borderRadius: 16,
                       padding: 20, marginBottom: 16, alignItems: 'center' },
  walletTitle:       { fontSize: 14, color: '#C9A84C', marginBottom: 8 },
  walletBalance:     { fontSize: 36, fontWeight: '800', color: '#C9A84C' },
  walletSub:         { fontSize: 12, color: '#9b8cb0', marginTop: 4 },
  walletBtn:         { marginTop: 16, backgroundColor: '#C9A84C',
                       paddingHorizontal: 24, paddingVertical: 10, borderRadius: 100 },
  walletBtnText:     { color: '#000', fontWeight: '700', fontSize: 13 },
  logoutBtn:         { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1,
                       borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12,
                       padding: 16, alignItems: 'center', marginBottom: 40 },
  logoutBtnText:     { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  activityItem:      { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 12, marginBottom: 8, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  activityEmoji:     { fontSize: 28 },
  activityTitle:     { fontSize: 14, fontWeight: '600', color: '#e8e0f0' },
  activityMeta:      { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  friendCard:        { alignItems: 'center', marginRight: 16,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 12, borderWidth: 1, borderColor: 'rgba(167,139,250,0.1)', minWidth: 80 },
  friendAvatar:      { fontSize: 32 },
  friendName:        { fontSize: 12, color: '#e8e0f0', fontWeight: '600', marginTop: 4 },
  friendScore:       { fontSize: 10, color: '#C9A84C', marginTop: 2 },
  messageItem:       { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 14, marginBottom: 8, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  messageAvatar:     { fontSize: 32 },
  messageUser:       { fontSize: 14, fontWeight: '700', color: '#e8e0f0' },
  messagePreview:    { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  messageTime:       { fontSize: 10, color: '#6b7280' },
  unreadBadge:       { backgroundColor: '#6B21A8', borderRadius: 10, minWidth: 20,
                       height: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  unreadText:        { fontSize: 10, color: '#fff', fontWeight: '700' },
  groupItem:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 14, marginBottom: 8, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  groupEmoji:        { fontSize: 32 },
  groupName:         { fontSize: 14, fontWeight: '700', color: '#e8e0f0' },
  groupDesc:         { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  groupMembers:      { fontSize: 11, color: '#6b7280', marginTop: 4 },
  joinBtn:           { backgroundColor: '#6B21A8', paddingHorizontal: 14,
                       paddingVertical: 8, borderRadius: 100 },
  joinBtnText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
  shopBalance:       { backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1,
                       borderColor: 'rgba(201,168,76,0.3)', borderRadius: 12,
                       padding: 16, marginBottom: 20, alignItems: 'center' },
  shopBalanceLabel:  { fontSize: 12, color: '#9b8cb0' },
  shopBalanceVal:    { fontSize: 20, fontWeight: '700', color: '#C9A84C', marginTop: 4 },
  shopGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shopItem:          { width: '47%', backgroundColor: 'rgba(255,255,255,0.03)',
                       borderRadius: 12, padding: 16, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)', alignItems: 'center', gap: 6 },
  shopEmoji:         { fontSize: 32 },
  shopName:          { fontSize: 14, fontWeight: '700', color: '#e8e0f0' },
  shopDesc:          { fontSize: 11, color: '#9b8cb0', textAlign: 'center' },
  shopPriceRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  shopPrice:         { fontSize: 16, fontWeight: '800', color: '#10b981' },
  shopPriceZnd:      { fontSize: 11, color: '#C9A84C' },
  shopBuyBtn:        { backgroundColor: '#6B21A8', width: '100%', padding: 10,
                       borderRadius: 8, alignItems: 'center' },
  shopBuyText:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent:      { backgroundColor: '#0d0820', borderTopLeftRadius: 24,
                       borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
                       borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.2)', minHeight: 300 },
  modalClose:        { alignSelf: 'flex-end', marginBottom: 16 },
  searchInputRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  searchInput:       { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
                       padding: 12, color: '#e8e0f0', borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.2)', fontSize: 14 },
  searchClose:       { color: '#9b8cb0', fontSize: 20, padding: 4 },
  searchResult:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                       borderBottomWidth: 1, borderColor: 'rgba(167,139,250,0.1)' },
  searchResultEmoji: { fontSize: 24 },
  searchResultTitle: { fontSize: 14, fontWeight: '600', color: '#e8e0f0' },
  searchResultMeta:  { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  noResults:         { color: '#9b8cb0', textAlign: 'center', marginTop: 32, fontSize: 14 },
  chatHeader:        { flexDirection: 'row', alignItems: 'center', gap: 12,
                       marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)' },
  chatAvatar:        { fontSize: 32 },
  chatName:          { flex: 1, fontSize: 16, fontWeight: '700', color: '#e8e0f0' },
  chatMessages:      { flex: 1, gap: 12, paddingVertical: 8 },
  chatBubbleOther:   { backgroundColor: 'rgba(107,33,168,0.3)', padding: 12,
                       borderRadius: 16, borderBottomLeftRadius: 4,
                       alignSelf: 'flex-start', maxWidth: '80%' },
  chatBubbleMine:    { backgroundColor: '#6B21A8', padding: 12, borderRadius: 16,
                       borderBottomRightRadius: 4, alignSelf: 'flex-end', maxWidth: '80%' },
  chatBubbleText:    { color: '#fff', fontSize: 14 },
  chatInputRow:      { flexDirection: 'row', gap: 8, marginTop: 16 },
  chatInput:         { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
                       borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
                       color: '#e8e0f0', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  chatSendBtn:       { backgroundColor: '#6B21A8', paddingHorizontal: 20,
                       paddingVertical: 10, borderRadius: 24, justifyContent: 'center' },
  chatSendText:      { color: '#fff', fontWeight: '700' },
  langRow:           { flexDirection: 'row', gap: 8, marginBottom: 32 },
  logoBlock:         { alignItems: 'center', marginBottom: 32 },
  logoHex:           { fontSize: 56, color: '#a78bfa', lineHeight: 64 },
  logoText:          { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 8 },
  tagline:           { fontSize: 13, color: '#C9A84C', marginTop: 8,
                       textAlign: 'center', fontStyle: 'italic' },
  features:          { width: '100%', gap: 10, marginBottom: 32 },
  featureItem:       { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
                       padding: 12, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)' },
  featureEmoji:      { fontSize: 22 },
  featureText:       { fontSize: 13, color: '#e8e0f0' },
  authButtons:       { width: '100%', gap: 12, marginBottom: 12 },
  terms:             { color: '#6b7280', fontSize: 10, textAlign: 'center' },
  authScroll:        { padding: 24, paddingTop: 60, paddingBottom: 40 },
  backBtn:           { marginBottom: 20 },
  backBtnText:       { color: '#a78bfa', fontSize: 14 },
  authTitle:         { fontSize: 28, fontWeight: '900', color: '#a78bfa',
                       letterSpacing: 4, marginBottom: 8 },
  authSub:           { fontSize: 13, color: '#9b8cb0', marginBottom: 28 },
  inputBlock:        { marginBottom: 14 },
  inputLabel:        { fontSize: 12, color: '#9b8cb0', marginBottom: 6, letterSpacing: 0.5 },
  input:             { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
                       padding: 14, color: '#e8e0f0', borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.2)', fontSize: 14 },
  inputError:        { borderColor: '#ef4444' },
  errorText:         { color: '#ef4444', fontSize: 11, marginTop: 4 },
  walletInfoBox:     { backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1,
                       borderColor: 'rgba(201,168,76,0.3)', borderRadius: 12,
                       padding: 14, marginBottom: 20, alignItems: 'center' },
  walletInfoText:    { color: '#C9A84C', fontSize: 13, fontWeight: '700' },
  walletInfoSub:     { color: '#9b8cb0', fontSize: 11, marginTop: 4 },
  orText:            { color: '#6b7280', textAlign: 'center', marginVertical: 14, fontSize: 12 },
  socialButtons:     { flexDirection: 'row', gap: 8, marginBottom: 20 },
  socialBtn:         { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
                       padding: 12, alignItems: 'center', borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)' },
  socialBtnText:     { color: '#e8e0f0', fontSize: 11 },
  switchText:        { color: '#9b8cb0', textAlign: 'center', fontSize: 13 },
  switchLink:        { color: '#a78bfa', fontWeight: '700' },
  btnPrimary:        { backgroundColor: '#6B21A8', padding: 16, borderRadius: 12,
                       alignItems: 'center', marginBottom: 10 },
  btnPrimaryText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary:      { backgroundColor: 'rgba(107,33,168,0.2)', padding: 16,
                       borderRadius: 12, alignItems: 'center', borderWidth: 1,
                       borderColor: '#6B21A8' },
  btnSecondaryText:  { color: '#a78bfa', fontWeight: '700', fontSize: 15 },
  storyMarker:      { width: 48, height: 48, borderRadius: 24,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(13,8,32,0.9)' },
storyMarkerEmoji: { fontSize: 24 },
storyRing:        { position: 'absolute', width: 52, height: 52,
                    borderRadius: 26, borderWidth: 3,
                    borderColor: '#a78bfa' },
storyEmojiBadge:  { position: 'absolute', bottom: -4, right: -4,
                    backgroundColor: '#0d0820', borderRadius: 8,
                    padding: 2 },
storyBtn:         { position: 'absolute', right: 16, bottom: 300,
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(167,139,250,0.3)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: '#a78bfa' },
storyBtnText:     { fontSize: 22 },
reactionBtn:          { width: 44, height: 44, borderRadius: 22,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        marginRight: 8 },
friendLocationMarker: { width: 44, height: 44, borderRadius: 22,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(16,185,129,0.2)',
                        borderWidth: 2, borderColor: '#10b981' },
friendOnlineDot:      { position: 'absolute', bottom: 0, right: 0,
                        width: 12, height: 12, borderRadius: 6,
                        borderWidth: 2, borderColor: '#080510' },
friendsBtn:           { position: 'absolute', right: 16, bottom: 420,
                        width: 48, height: 48, borderRadius: 24,
                        backgroundColor: 'rgba(16,185,129,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: '#10b981' },
friendsBtnActive:     { backgroundColor: 'rgba(16,185,129,0.4)',
                        borderColor: '#10b981' },
                        liveMarker:       { width: 52, height: 52, borderRadius: 26,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    borderWidth: 2, borderColor: '#ef4444' },
liveMarkerEmoji:  { fontSize: 24 },
liveBadge:        { position: 'absolute', top: -6, left: -6,
                    backgroundColor: '#ef4444', borderRadius: 4,
                    paddingHorizontal: 4, paddingVertical: 1 },
liveBadgeText:    { fontSize: 7, color: '#fff', fontWeight: '900' },
liveViewersBadge: { position: 'absolute', bottom: -6, right: -6,
                    backgroundColor: 'rgba(13,8,32,0.9)', borderRadius: 8,
                    paddingHorizontal: 4, paddingVertical: 1 },
liveViewersText:  { fontSize: 8, color: '#fff' },
liveBtn:          { position: 'absolute', right: 16, bottom: 480,
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: '#ef4444' },
liveBtnActive:    { backgroundColor: 'rgba(239,68,68,0.5)' },
liveDotRed:       { width: 8, height: 8, borderRadius: 4,
                    backgroundColor: '#ef4444' },
liveScreen:       { backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 16, padding: 24, alignItems: 'center',
                    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
                    marginVertical: 12 },
liveTitleText:    { fontSize: 16, fontWeight: '700', color: '#fff',
                    marginTop: 8, textAlign: 'center' },
myLiveWidget:     { position: 'absolute', bottom: 100, left: 80,
                    right: 80, flexDirection: 'row', alignItems: 'center',
                    gap: 8, backgroundColor: 'rgba(239,68,68,0.15)',
                    borderRadius: 16, padding: 12, borderWidth: 1,
                    borderColor: '#ef4444' },
                    territoryMarker: { alignItems: 'center', backgroundColor: 'rgba(13,8,32,0.9)',
                   borderRadius: 12, padding: 6, borderWidth: 1,
                   borderColor: 'rgba(167,139,250,0.4)' },
territoryZnd:    { fontSize: 9, color: '#C9A84C', fontWeight: '700', marginTop: 2 },
  typeBtn:           { alignItems: 'center', marginRight: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)',
                       borderRadius: 12, padding: 12, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)', minWidth: 72 },
  typeBtnActive:     { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  typeEmoji:         { fontSize: 28 },
  typeLabel:         { fontSize: 11, color: '#e8e0f0', marginTop: 4, textAlign: 'center' },
  matchCard:         { alignItems: 'center', marginRight: 12,
                       backgroundColor: 'rgba(107,33,168,0.1)', borderRadius: 16,
                       padding: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
                       minWidth: 100 },
  matchEmoji:        { fontSize: 36 },
  matchName:         { fontSize: 13, fontWeight: '700', color: '#e8e0f0', marginTop: 8 },
  matchScoreBadge:   { backgroundColor: '#10b981', borderRadius: 100,
                       paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  matchScoreText:    { fontSize: 10, color: '#fff', fontWeight: '700' },
  matchInterests:    { fontSize: 16, marginTop: 4 },
  matchListItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                       padding: 14, borderBottomWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  matchListName:     { fontSize: 15, fontWeight: '700', color: '#e8e0f0' },
  matchListBio:      { fontSize: 12, color: '#9b8cb0', marginTop: 2 },
  matchListDist:     { fontSize: 11, color: '#6b7280', marginTop: 2 },
  interestTag:       { backgroundColor: 'rgba(107,33,168,0.3)', borderRadius: 100,
                       paddingHorizontal: 8, paddingVertical: 2 },
  interestTagText:   { fontSize: 10, color: '#a78bfa' },
  bizKpiGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  bizKpi:            { width: '47%', backgroundColor: 'rgba(255,255,255,0.03)',
                       borderRadius: 12, padding: 16, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)', alignItems: 'center' },
  bizKpiVal:         { fontSize: 24, fontWeight: '800', color: '#a78bfa' },
  bizKpiLabel:       { fontSize: 11, color: '#6b7280', marginTop: 4 },
  bizAction:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 14, marginBottom: 8, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  bizActionEmoji:    { fontSize: 24 },
  bizActionLabel:    { flex: 1, fontSize: 13, color: '#e8e0f0' },
  bizSelectorBtn:    { alignItems: 'center', marginRight: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)',
                       borderRadius: 12, padding: 10, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.15)', minWidth: 80 },
  bizSelectorBtnActive: { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  bizSelectorEmoji:  { fontSize: 24 },
  bizSelectorName:   { fontSize: 10, color: '#e8e0f0', marginTop: 4 },
  orderItem:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                       backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                       padding: 12, marginBottom: 8, borderWidth: 1,
                       borderColor: 'rgba(167,139,250,0.1)' },
  orderUser:         { fontSize: 13, color: '#e8e0f0' },
  orderZnd:          { fontSize: 13, color: '#10b981', fontWeight: '700' },
});