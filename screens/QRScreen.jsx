// ============================================================
// QRScreen.jsx — Génération et scan de QR de paiement VALT
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Animated, Dimensions, Share, ActivityIndicator, Image, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { pledgeService, qrService, walletService } from '../services/valtService';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#0A0A0F', card: '#12121A', cardBorder: '#1E1E2E',
  accent: '#6C63FF', gold: '#FFD166', green: '#06D6A0',
  red: '#EF476F', text: '#FFFFFF', textSub: '#8888AA'
};

// ─────────────────────────────────────────────
// GENERATE QR SCREEN
// ─────────────────────────────────────────────

export function GenerateQRScreen({ navigation }) {
  const [pledges, setPledges] = useState([]);
  const [selectedPledge, setSelectedPledge] = useState(null);
  const [amount, setAmount] = useState('');
  const [qrData, setQRData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select'); // select | amount | qr

  const qrScaleAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes

  useEffect(() => {
    loadPledges();
  }, []);

  useEffect(() => {
    if (step === 'qr') {
      // Animation QR apparition
      Animated.spring(qrScaleAnim, { toValue: 1, tension: 60, useNativeDriver: true }).start();

      // Countdown
      const interval = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(interval);
            setQRData(null);
            setStep('amount');
            Alert.alert('QR Expiré', 'Le QR code a expiré. Génère-en un nouveau.');
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step]);

  const loadPledges = async () => {
    try {
      const data = await pledgeService.getUserPledges() || {};
      
      const activePledges = Object.values(data?.pledgeDetails || {});
setPledges(activePledges);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateQR = async () => {
    if (!selectedPledge || !amount || parseFloat(amount) <= 0) {
      return Alert.alert('Erreur', 'Sélectionne un gage et entre un montant');
    }

    setLoading(true);
    try {
      const qr = await qrService.generateQR(
        selectedPledge.pledgeId,
        parseFloat(amount),
        15
      );
      setQRData(qr);
      setTimeLeft(900);
      setStep('qr');
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!qrData?.dataURL) return;
    try {
      await Share.share({
        message: `Paiement VALT — ${amount} ZND\nExpire: ${qrData.expiresAt}`,
        url: qrData.dataURL
      });
    } catch (err) { }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerColor = timeLeft > 300 ? COLORS.green : timeLeft > 60 ? COLORS.gold : COLORS.red;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'select' ? navigation.goBack() : setStep('select')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Générer un QR</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── SÉLECTION DU GAGE ── */}
      {step === 'select' && (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Quel gage utiliser ?</Text>
          {pledges.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucun gage actif</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreatePledge')}
              >
                <Text style={styles.emptyBtnText}>Créer un gage</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pledges.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.pledgeOption, selectedPledge?.pledgeId === p.pledgeId && styles.pledgeOptionActive]}
                onPress={() => { setSelectedPledge(p); setStep('amount'); }}
              >
                <View>
                  <Text style={styles.pledgeOptionName}>{p.model || 'Gage'}</Text>
                  <Text style={styles.pledgeOptionBal}>{p.creditAmount} ZND disponibles</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* ── SAISIE MONTANT ── */}
      {step === 'amount' && (
        <ScrollView style={styles.content}>
          <Text style={styles.stepTitle}>Combien ?</Text>
          <Text style={styles.stepSub}>Gage: {selectedPledge?.model} · {selectedPledge?.creditAmount} ZND dispo</Text>

          <View style={styles.amountContainer}>
            <Text style={styles.amountCurrency}>ZND</Text>
            <Text style={styles.amountValue}>{amount || '0'}</Text>
          </View>
          {/* Clavier numérique */}
          <View style={styles.numpad}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.numpadKey}
                onPress={() => {
                  if (key === '⌫') setAmount(a => a.slice(0, -1));
                  else if (key === '.' && amount.includes('.')) return;
                  else setAmount(a => a + key);
                }}
              >
                <Text style={styles.numpadKeyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Montants rapides */}
          <View style={styles.quickAmounts}>
            {['10', '25', '50', '100'].map(a => (
              <TouchableOpacity key={a} style={styles.quickAmt} onPress={() => setAmount(a)}>
                <Text style={styles.quickAmtText}>{a} ZND</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.7 }]}
            onPress={handleGenerateQR}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.generateBtnText}>Générer le QR →</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── QR CODE ── */}
      {step === 'qr' && qrData && (
        <View style={styles.qrContainer}>
          <Text style={styles.stepTitle}>QR de paiement</Text>

          <Animated.View style={[styles.qrCard, { transform: [{ scale: qrScaleAnim }] }]}>
            <LinearGradient colors={['#FFFFFF', '#F0F0FF']} style={styles.qrCardGrad}>
              {qrData.dataURL && (
                <Image
                  source={{ uri: qrData.dataURL }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.qrAmount}>{amount} ZND</Text>
              <View style={styles.qrMeta}>
                <View style={[styles.timerBadge, { backgroundColor: timerColor + '20', borderColor: timerColor + '40' }]}>
                  <Ionicons name="time-outline" size={14} color={timerColor} />
                  <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.qrHint}>
            Présente ce QR au destinataire · Expire dans {formatTime(timeLeft)}
          </Text>

          <View style={styles.qrActions}>
            <TouchableOpacity style={styles.qrActionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={COLORS.accent} />
              <Text style={styles.qrActionText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qrActionBtn, { backgroundColor: COLORS.red + '15', borderColor: COLORS.red + '30' }]}
              onPress={() => { setQRData(null); setStep('amount'); }}
            >
              <Ionicons name="refresh" size={22} color={COLORS.red} />
              <Text style={[styles.qrActionText, { color: COLORS.red }]}>Nouveau QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// SCAN QR SCREEN
// ─────────────────────────────────────────────

export function ScanQRScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    startScanAnimation();
  }, []);

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true })
      ])
    ).start();
  };

  const handleBarcodeScanned = async ({ type, data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      const qrPayload = JSON.parse(data);

      // Validation basique
      if (!qrPayload.v || !qrPayload.pid || !qrPayload.amt) {
        Alert.alert('QR invalide', 'Ce QR code n\'est pas un paiement VALT');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Vérification expiration
      if (Date.now() / 1000 > qrPayload.exp) {
        Alert.alert('QR expiré', 'Ce QR code a expiré');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Confirmation paiement
      Alert.alert(
        '💳 Confirmer le paiement',
        `Tu vas recevoir ${qrPayload.amt} ZND\nDe: ${qrPayload.from?.substring(0, 10)}...`,
        [
          {
            text: 'Annuler',
            onPress: () => { setScanned(false); setProcessing(false); },
            style: 'cancel'
          },
          {
            text: 'Accepter',
            onPress: async () => {
              try {
                const result = await qrService.payWithQR(qrPayload);
                setPaymentResult({ ...result, amount: qrPayload.amt });
              } catch (err) {
                Alert.alert('Paiement échoué', err.message);
                setScanned(false);
              } finally {
                setProcessing(false);
              }
            }
          }
        ]
      );
    } catch {
      Alert.alert('QR invalide', 'Impossible de lire ce QR code');
      setScanned(false);
      setProcessing(false);
    }
  };

  // Succès paiement
  if (paymentResult) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient colors={[COLORS.green + '20', COLORS.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.green} />
        </View>
        <Text style={styles.successTitle}>Paiement reçu !</Text>
        <Text style={styles.successAmount}>{paymentResult.amount} ZND</Text>
        <Text style={styles.successTx}>Tx: {paymentResult.txHash?.substring(0, 20)}...</Text>
        <TouchableOpacity
          style={styles.successBtn}
          onPress={() => navigation.navigate('VALTDashboard')}
        >
          <Text style={styles.successBtnText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="camera-off" size={48} color={COLORS.textSub} />
        <Text style={[styles.stepTitle, { textAlign: 'center', marginTop: 16 }]}>
          Accès caméra refusé
        </Text>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240]
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner QR VALT</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.scanArea}>
        {hasPermission && (
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        {/* Overlay */}
        <View style={styles.scanOverlay}>
          <View style={styles.scanViewfinder}>
            {/* Coins */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Ligne de scan */}
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
            />
          </View>
        </View>

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.processingText}>Traitement en cours...</Text>
          </View>
        )}
      </View>

      <View style={styles.scanBottom}>
        <Text style={styles.scanHint}>Place le QR VALT dans le cadre</Text>
        <TouchableOpacity style={styles.manualBtn}>
          <Text style={styles.manualBtnText}>Saisir manuellement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  stepSub: { fontSize: 13, color: COLORS.textSub, marginBottom: 24 },

  pledgeOption: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  pledgeOptionActive: { borderColor: COLORS.accent },
  pledgeOptionName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  pledgeOptionBal: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },

  amountContainer: { alignItems: 'center', paddingVertical: 40 },
  amountCurrency: { fontSize: 16, color: COLORS.textSub, fontWeight: '700', letterSpacing: 3 },
  amountValue: { fontSize: 64, fontWeight: '800', color: COLORS.text, letterSpacing: -2 },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  numpadKey: { width: width / 3 - 14, aspectRatio: 1.8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, marginVertical: 4, backgroundColor: COLORS.card, borderRadius: 14 },
  numpadKeyText: { fontSize: 22, fontWeight: '600', color: COLORS.text },

  quickAmounts: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickAmt: { flex: 1, paddingVertical: 10, backgroundColor: COLORS.card, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  quickAmtText: { fontSize: 13, color: COLORS.accent, fontWeight: '700' },

  generateBtn: { backgroundColor: COLORS.accent, borderRadius: 14, padding: 18, alignItems: 'center' },
  generateBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  qrContainer: { flex: 1, paddingHorizontal: 20, alignItems: 'center' },
  qrCard: { borderRadius: 24, overflow: 'hidden', width: 280, marginBottom: 16 },
  qrCardGrad: { padding: 24, alignItems: 'center' },
  qrImage: { width: 232, height: 232, marginBottom: 16 },
  qrAmount: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },
  qrMeta: { alignItems: 'center' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  timerText: { fontSize: 14, fontWeight: '700' },
  qrHint: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  qrActions: { flexDirection: 'row', gap: 12, width: '100%' },
  qrActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent + '15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.accent + '30' },
  qrActionText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },

  scanArea: { flex: 1, position: 'relative' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanViewfinder: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: COLORS.accent, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 8 },
  scanLine: { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 },

  processingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  processingText: { color: COLORS.text, marginTop: 16, fontSize: 16, fontWeight: '600' },

  scanBottom: { padding: 24, alignItems: 'center' },
  scanHint: { fontSize: 14, color: COLORS.textSub, marginBottom: 16 },
  manualBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.cardBorder },
  manualBtnText: { color: COLORS.textSub, fontSize: 14, fontWeight: '600' },

  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  successAmount: { fontSize: 48, fontWeight: '800', color: COLORS.green, marginBottom: 8 },
  successTx: { fontSize: 12, color: COLORS.textSub, fontFamily: 'monospace', marginBottom: 40 },
  successBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16 },
  successBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, color: COLORS.textSub, marginBottom: 20 },
  emptyBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});
