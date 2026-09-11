// ============================================================
// CreatePledgeScreen.jsx — Création de gage multi-collateral
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { pledgeService, API_BASE, getAuthHeaders } from '../services/valtService';

const COLORS = {
  bg: '#0A0A0F', card: '#12121A', cardBorder: '#1E1E2E',
  accent: '#6C63FF', gold: '#FFD166', green: '#06D6A0',
  red: '#EF476F', text: '#FFFFFF', textSub: '#8888AA',
  physical: '#FF6B6B', skill: '#4ECDC4',
  subscription: '#45B7D1', data: '#96CEB4', reputation: '#FFEAA7'
};

const COLLATERAL_TYPES = [
  {
    type: 'PHYSICAL',
    icon: 'cube',
    color: COLORS.physical,
    label: 'Bien physique',
    desc: 'PS5, voiture, vélo, électronique...',
    fields: ['model', 'condition', 'serialNumber', 'video']
  },
  {
    type: 'SKILL',
    icon: 'school',
    color: COLORS.skill,
    label: 'Compétences',
    desc: 'Mets en gage ton temps et expertise',
    fields: ['skillType', 'hourlyRate', 'hours', 'profileUrl']
  },
  {
    type: 'SUBSCRIPTION',
    icon: 'card-membership',
    color: COLORS.subscription,
    label: 'Abonnement',
    desc: 'Netflix, Adobe, Spotify...',
    fields: ['provider', 'oauthConnect']
  }
  // Type REPUTATION retiré : pas de backend de vérification GitHub/Airbnb réel pour l'instant.
];

const CONDITIONS = [
  { value: 'new', label: 'Neuf', ltv: '75%' },
  { value: 'like_new', label: 'Comme neuf', ltv: '72%' },
  { value: 'good', label: 'Bon état', ltv: '68%' },
  { value: 'fair', label: 'État correct', ltv: '60%' },
  { value: 'poor', label: 'Mauvais état', ltv: '45%' }
];

const SUBSCRIPTION_PROVIDERS = [
  { value: 'netflix', label: 'Netflix', price: '15.99€' },
  { value: 'adobe', label: 'Adobe CC', price: '59.99€' },
  { value: 'spotify', label: 'Spotify', price: '10.99€' },
  { value: 'microsoft', label: 'Microsoft 365', price: '9.99€' },
  { value: 'apple', label: 'Apple One', price: '19.95€' }
];

// ─────────────────────────────────────────────
// STEP 1: TYPE SELECTION
// ─────────────────────────────────────────────

const TypeSelector = ({ selected, onSelect }) => (
  <View>
    <Text style={styles.stepTitle}>Que veux-tu mettre en gage ?</Text>
    <Text style={styles.stepSub}>Choisis le type de valeur à gager</Text>
    {COLLATERAL_TYPES.map(col => (
      <TouchableOpacity
        key={col.type}
        style={[styles.typeCard, selected === col.type && { borderColor: col.color, backgroundColor: col.color + '10' }]}
        onPress={() => onSelect(col.type)}
        activeOpacity={0.85}
      >
        <View style={[styles.typeIcon, { backgroundColor: col.color + '20' }]}>
          <Ionicons name={col.icon} size={24} color={col.color} />
        </View>
        <View style={styles.typeInfo}>
          <Text style={styles.typeLabel}>{col.label}</Text>
          <Text style={styles.typeDesc}>{col.desc}</Text>
        </View>
        {selected === col.type && (
          <Ionicons name="checkmark-circle" size={24} color={col.color} />
        )}
      </TouchableOpacity>
    ))}
  </View>
);

// ─────────────────────────────────────────────
// STEP 2: PHYSICAL FORM
// ─────────────────────────────────────────────

const PhysicalForm = ({ form, onChange, onVideoCapture }) => (
  <View>
    <Text style={styles.stepTitle}>Décris ton bien</Text>

    <Text style={styles.fieldLabel}>Modèle / Nom du bien *</Text>
    <TextInput
      style={styles.input}
      placeholder="Ex: PlayStation 5, iPhone 14 Pro, Vélo Trek..."
      placeholderTextColor={COLORS.textSub}
      value={form.model}
      onChangeText={v => onChange('model', v)}
    />

    <Text style={styles.fieldLabel}>État *</Text>
    <View style={styles.conditionRow}>
      {CONDITIONS.map(c => (
        <TouchableOpacity
          key={c.value}
          style={[styles.conditionBtn, form.condition === c.value && styles.conditionBtnActive]}
          onPress={() => onChange('condition', c.value)}
        >
          <Text style={[styles.conditionText, form.condition === c.value && styles.conditionTextActive]}>
            {c.label}
          </Text>
          <Text style={styles.conditionLTV}>{c.ltv}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.fieldLabel}>Numéro de série (optionnel mais recommandé)</Text>
    <TextInput
      style={styles.input}
      placeholder="Ex: SN123456789"
      placeholderTextColor={COLORS.textSub}
      value={form.serialNumber}
      onChangeText={v => onChange('serialNumber', v)}
      autoCapitalize="characters"
    />

    <Text style={styles.fieldLabel}>Durée du gage</Text>
    <View style={styles.durationRow}>
      {[7, 14, 30, 60, 90].map(d => (
        <TouchableOpacity
          key={d}
          style={[styles.durationBtn, form.durationDays === d && styles.durationBtnActive]}
          onPress={() => onChange('durationDays', d)}
        >
          <Text style={[styles.durationText, form.durationDays === d && styles.durationTextActive]}>
            {d}j
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.fieldLabel}>Vérification vidéo *</Text>
    <Text style={styles.fieldHint}>
      Filme ton bien en montrant clairement le numéro de série pour maximiser le crédit accordé
    </Text>
    <TouchableOpacity style={styles.videoBtn} onPress={onVideoCapture}>
      {form.videoUri ? (
        <View style={styles.videoPreview}>
          <Ionicons name="videocam" size={24} color={COLORS.green} />
          <Text style={styles.videoBtnTextDone}>Vidéo enregistrée ✓</Text>
        </View>
      ) : (
        <View style={styles.videoPreview}>
          <Ionicons name="videocam-outline" size={24} color={COLORS.accent} />
          <Text style={styles.videoBtnText}>Filmer mon bien</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────
// STEP 2: SKILL FORM
// ─────────────────────────────────────────────

const SkillForm = ({ form, onChange }) => (
  <View>
    <Text style={styles.stepTitle}>Tes compétences</Text>

    <Text style={styles.fieldLabel}>Type de compétence *</Text>
    <TextInput
      style={styles.input}
      placeholder="Ex: Développement web, Design, Traduction..."
      placeholderTextColor={COLORS.textSub}
      value={form.skillType}
      onChangeText={v => onChange('skillType', v)}
    />

    <Text style={styles.fieldLabel}>Taux horaire (€) *</Text>
    <TextInput
      style={styles.input}
      placeholder="Ex: 50"
      placeholderTextColor={COLORS.textSub}
      keyboardType="numeric"
      value={form.hourlyRate?.toString()}
      onChangeText={v => onChange('hourlyRate', parseFloat(v) || 0)}
    />

    <Text style={styles.fieldLabel}>Nombre d'heures à gager *</Text>
    <View style={styles.durationRow}>
      {[1, 2, 3, 5, 10].map(h => (
        <TouchableOpacity
          key={h}
          style={[styles.durationBtn, form.hours === h && styles.durationBtnActive]}
          onPress={() => onChange('hours', h)}
        >
          <Text style={[styles.durationText, form.hours === h && styles.durationTextActive]}>
            {h}h
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.fieldLabel}>Profil professionnel (optionnel)</Text>
    <TextInput
      style={styles.input}
      placeholder="URL Malt, Upwork, LinkedIn..."
      placeholderTextColor={COLORS.textSub}
      value={form.profileUrl}
      onChangeText={v => onChange('profileUrl', v)}
      autoCapitalize="none"
    />

    {form.hourlyRate > 0 && form.hours > 0 && (
      <View style={styles.estimateBox}>
        <Text style={styles.estimateLabel}>Crédit estimé</Text>
        <Text style={styles.estimateAmount}>
          {Math.round(form.hourlyRate * form.hours * 0.70 * 0.965)} ZND
        </Text>
        <Text style={styles.estimateSub}>= {form.hourlyRate * form.hours}€ × 70% LTV − frais</Text>
      </View>
    )}
  </View>
);

// ─────────────────────────────────────────────
// STEP 2: SUBSCRIPTION FORM
// ─────────────────────────────────────────────

const SubscriptionForm = ({ form, onChange }) => (
  <View>
    <Text style={styles.stepTitle}>Ton abonnement</Text>
    {SUBSCRIPTION_PROVIDERS.map(p => (
      <TouchableOpacity
        key={p.value}
        style={[styles.typeCard, form.provider === p.value && { borderColor: COLORS.subscription, backgroundColor: COLORS.subscription + '10' }]}
        onPress={() => onChange('provider', p.value)}
        activeOpacity={0.85}
      >
        <Text style={styles.typeLabel}>{p.label}</Text>
        <Text style={styles.typeDesc}>{p.price}/mois</Text>
        {form.provider === p.value && <Ionicons name="checkmark-circle" size={24} color={COLORS.subscription} />}
      </TouchableOpacity>
    ))}
    <TouchableOpacity style={[styles.oauthBtn, { borderColor: COLORS.subscription }]}>
      <Ionicons name="link" size={20} color={COLORS.subscription} />
      <Text style={[styles.oauthText, { color: COLORS.subscription }]}>Connecter via OAuth</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────
// STEP 3: VALUATION RESULT
// ─────────────────────────────────────────────

const ValuationResult = ({ valuation, onConfirm, onBack, loading }) => {
  if (!valuation) return null;
  return (
    <View>
      <Text style={styles.stepTitle}>Estimation VALT</Text>

      <View style={styles.valuationCard}>
        <LinearGradient colors={['#6C63FF20', '#6C63FF05']} style={styles.valuationGrad}>
          <View style={styles.valuationRow}>
            <Text style={styles.valuationLabel}>Valeur marché</Text>
            <Text style={styles.valuationVal}>{valuation.marketValue || valuation.totalValue} ZND</Text>
          </View>
          <View style={styles.valuationRow}>
            <Text style={styles.valuationLabel}>LTV appliqué</Text>
            <Text style={styles.valuationVal}>70%</Text>
          </View>
          <View style={styles.valuationRow}>
            <Text style={styles.valuationLabel}>Commission (2.5%)</Text>
            <Text style={[styles.valuationVal, { color: COLORS.textSub }]}>−{valuation.fee || 0} ZND</Text>
          </View>
          <View style={styles.valuationRow}>
            <Text style={styles.valuationLabel}>Assurance (1%)</Text>
            <Text style={[styles.valuationVal, { color: COLORS.textSub }]}>−{valuation.insurance || 0} ZND</Text>
          </View>
          <View style={[styles.valuationRow, styles.valuationTotal]}>
            <Text style={styles.valuationTotalLabel}>Tu reçois</Text>
            <Text style={styles.valuationTotalVal}>{valuation.netCredit} ZND</Text>
          </View>
        </LinearGradient>
      </View>

      {valuation.confidence && (
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            Confiance: {valuation.confidence === 'high' ? '🟢 Haute' : valuation.confidence === 'medium' ? '🟡 Moyenne' : '🔴 Faible'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
        onPress={onConfirm}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.confirmBtnText}>Confirmer le gage →</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function CreatePledgeScreen({ navigation, route }) {
  const preselectedType = route?.params?.preselectedType;

  const [step, setStep] = useState(preselectedType ? 1 : 0);
  const [selectedType, setSelectedType] = useState(preselectedType || null);
  const [form, setForm] = useState({ condition: 'good', durationDays: 30, hours: 3 });
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const nextStep = () => {
    Animated.spring(slideAnim, { toValue: -width, useNativeDriver: true, tension: 80 }).start(() => {
      setStep(s => s + 1);
      slideAnim.setValue(width);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
    });
  };

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleVideoCapture = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission caméra requise');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 30,
      quality: 0.8
    });

    if (!result.canceled) {
      updateForm('videoUri', result.assets[0].uri);
    }
  };

  const VALUATION_ENDPOINT = {
    PHYSICAL: { path: '/api/valuate/physical', body: () => ({ model: form.model, condition: form.condition, serialNumber: form.serialNumber }) },
    SKILL: { path: '/api/valuate/skill', body: () => ({ hourlyRate: form.hourlyRate, hours: form.hours, profileUrl: form.profileUrl }) },
    SUBSCRIPTION: { path: '/api/valuate/subscription', body: () => ({ provider: form.provider }) },
  };

  const handleEstimate = async () => {
    if (!form.model && selectedType === 'PHYSICAL') {
      return Alert.alert('Modèle requis', 'Entre le modèle de ton bien');
    }
    if ((!form.hourlyRate || !form.hours) && selectedType === 'SKILL') {
      return Alert.alert('Champs requis', 'Renseigne ton taux horaire et le nombre d\'heures');
    }
    if (!form.provider && selectedType === 'SUBSCRIPTION') {
      return Alert.alert('Abonnement requis', 'Choisis ton abonnement');
    }

    setLoading(true);
    try {
      // Toute la logique de valorisation (LTV, frais, assurance) vit côté serveur -
      // source unique de vérité, cf. audit bug #18.
      const endpoint = VALUATION_ENDPOINT[selectedType];
      const res = await fetch(`${API_BASE}${endpoint.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify(endpoint.body())
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur de valorisation');

      setValuation(data.valuation);
      nextStep();
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'estimer la valeur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPledge = async () => {
    setLoading(true);
    try {
      let result;
      if (selectedType === 'PHYSICAL') {
        result = await pledgeService.createPhysicalPledge({
          model: form.model,
          condition: form.condition,
          serialNumber: form.serialNumber,
          videoUri: form.videoUri,
          durationDays: form.durationDays
        });
      } else if (selectedType === 'SKILL') {
        result = await pledgeService.createSkillPledge({
          skillType: form.skillType,
          hourlyRate: form.hourlyRate,
          hours: form.hours,
          profileUrl: form.profileUrl,
          durationDays: form.durationDays || 7
        });
      } else if (selectedType === 'SUBSCRIPTION') {
        result = await pledgeService.createSubscriptionPledge({
          provider: form.provider,
          oauthToken: form.oauthToken,
          durationDays: form.durationDays || 30
        });
      }

      if (result?.success) {
        Alert.alert(
          '🎉 Gage créé !',
          `Tu as reçu ${valuation?.netCredit} ZND\nTx: ${result.txHash?.substring(0, 20)}...`,
          [{ text: 'Voir mon gage', onPress: () => navigation.navigate('valt') }]
        );
      } else {
        Alert.alert('Erreur', result?.error || 'La création du gage a échoué, réessaie.');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Création du gage échouée: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Type', 'Détails', 'Estimation', 'Confirmation'];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(s => s - 1)}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau gage</Text>
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]} />
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

          {step === 0 && (
            <TypeSelector
              selected={selectedType}
              onSelect={(type) => { setSelectedType(type); }}
            />
          )}

          {step === 1 && selectedType === 'PHYSICAL' && (
            <PhysicalForm form={form} onChange={updateForm} onVideoCapture={handleVideoCapture} />
          )}

          {step === 1 && selectedType === 'SKILL' && (
            <SkillForm form={form} onChange={updateForm} />
          )}

          {step === 1 && selectedType === 'SUBSCRIPTION' && (
            <SubscriptionForm form={form} onChange={updateForm} />
          )}

          {step === 2 && (
            <ValuationResult
              valuation={valuation}
              onConfirm={handleConfirmPledge}
              onBack={() => setStep(1)}
              loading={loading}
            />
          )}
        </Animated.View>
      </ScrollView>

      {step < 2 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, (!selectedType && step === 0) && { opacity: 0.5 }]}
            onPress={step === 0 ? () => selectedType && nextStep() : handleEstimate}
            disabled={!selectedType && step === 0}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.nextBtnText}>{step === 1 ? 'Estimer →' : 'Suivant →'}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const { width } = require('react-native').Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.cardBorder },
  stepDotActive: { backgroundColor: COLORS.accent },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  stepSub: { fontSize: 14, color: COLORS.textSub, marginBottom: 24, lineHeight: 20 },
  typeCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.cardBorder, gap: 12 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  typeDesc: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  fieldLabel: { fontSize: 13, color: COLORS.textSub, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  fieldHint: { fontSize: 12, color: COLORS.textSub, marginBottom: 10, lineHeight: 18 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.cardBorder },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center' },
  conditionBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '20' },
  conditionText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  conditionTextActive: { color: COLORS.accent },
  conditionLTV: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center' },
  durationBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '20' },
  durationText: { fontSize: 13, color: COLORS.textSub, fontWeight: '700' },
  durationTextActive: { color: COLORS.accent },
  videoBtn: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderStyle: 'dashed', alignItems: 'center' },
  videoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoBtnText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
  videoBtnTextDone: { fontSize: 15, color: COLORS.green, fontWeight: '600' },
  estimateBox: { backgroundColor: COLORS.accent + '15', borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: COLORS.accent + '30' },
  estimateLabel: { fontSize: 12, color: COLORS.textSub, marginBottom: 4 },
  estimateAmount: { fontSize: 32, fontWeight: '800', color: COLORS.accent },
  estimateSub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },
  oauthBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1.5, marginTop: 12 },
  oauthText: { fontSize: 15, fontWeight: '600' },
  valuationCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  valuationGrad: { padding: 24, borderWidth: 1, borderColor: COLORS.accent + '30', borderRadius: 20 },
  valuationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  valuationLabel: { fontSize: 14, color: COLORS.textSub },
  valuationVal: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  valuationTotal: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: 16, marginTop: 4 },
  valuationTotalLabel: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  valuationTotalVal: { fontSize: 24, fontWeight: '800', color: COLORS.accent },
  confidenceBadge: { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 20 },
  confidenceText: { fontSize: 14, color: COLORS.text, textAlign: 'center' },
  confirmBtn: { backgroundColor: COLORS.accent, borderRadius: 14, padding: 18, alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  backBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
  backBtnText: { fontSize: 15, color: COLORS.textSub, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: COLORS.bg },
  nextBtn: { backgroundColor: COLORS.accent, borderRadius: 14, padding: 18, alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' }
});
