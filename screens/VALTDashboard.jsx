// ============================================================
// VALTDashboard.jsx — Écran principal VALT dans Pulse
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, RefreshControl, StatusBar, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { walletService, pledgeService, reputationService } from '../services/valtService';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────

const COLORS = {
  bg: '#0A0A0F',
  card: '#12121A',
  cardBorder: '#1E1E2E',
  accent: '#6C63FF',
  accentLight: '#8B83FF',
  gold: '#FFD166',
  green: '#06D6A0',
  red: '#EF476F',
  text: '#FFFFFF',
  textSub: '#8888AA',
  physical: '#FF6B6B',
  skill: '#4ECDC4',
  subscription: '#45B7D1',
  data: '#96CEB4',
  reputation: '#FFEAA7'
};

const COL_CONFIG = {
  PHYSICAL: { icon: 'cube', color: COLORS.physical, label: 'Bien physique' },
  SKILL: { icon: 'school', color: COLORS.skill, label: 'Compétences' },
  SUBSCRIPTION: { icon: 'card-membership', color: COLORS.subscription, label: 'Abonnement' },
  DATA: { icon: 'analytics', color: COLORS.data, label: 'Données' },
  REPUTATION: { icon: 'star', color: COLORS.reputation, label: 'Réputation' }
};

// ─────────────────────────────────────────────
// COMPOSANTS
// ─────────────────────────────────────────────

const AnimatedCard = ({ children, delay = 0, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 80 })
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

const ReputationRing = ({ score }) => {
  const { label, color } = reputationService.getScoreLabel(score);
  const angle = (score / 1000) * 360;

  return (
    <View style={styles.repRing}>
      <View style={[styles.repRingInner, { borderColor: color }]}>
        <Text style={[styles.repScore, { color }]}>{score}</Text>
        <Text style={styles.repLabel}>{label}</Text>
      </View>
    </View>
  );
};

const PledgeCard = ({ pledge, onPress }) => {
  const config = COL_CONFIG[pledge.type] || COL_CONFIG.PHYSICAL;
  const isActive = pledge.status === 'ACTIVE';
  const daysLeft = pledge.dueDate
    ? Math.max(0, Math.ceil((new Date(pledge.dueDate) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <TouchableOpacity onPress={() => onPress(pledge)} activeOpacity={0.85}>
      <View style={styles.pledgeCard}>
        <View style={[styles.pledgeIconWrap, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.pledgeInfo}>
          <Text style={styles.pledgeModel} numberOfLines={1}>{pledge.model || config.label}</Text>
          <Text style={styles.pledgeRef} numberOfLines={1}>{pledge.collateralRef || 'Gage actif'}</Text>
          {daysLeft !== null && (
            <Text style={[styles.pledgeDays, { color: daysLeft <= 3 ? COLORS.red : COLORS.textSub }]}>
              {daysLeft > 0 ? `${daysLeft}j restants` : 'Expiré'}
            </Text>
          )}
        </View>
        <View style={styles.pledgeRight}>
          <Text style={styles.pledgeAmount}>{pledge.creditAmount} ZND</Text>
          <View style={[styles.pledgeStatus, { backgroundColor: isActive ? COLORS.green + '20' : COLORS.red + '20' }]}>
            <Text style={[styles.pledgeStatusText, { color: isActive ? COLORS.green : COLORS.red }]}>
              {isActive ? 'Actif' : pledge.status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const QuickAction = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient colors={[color + '30', color + '10']} style={styles.quickActionGrad}>
      <Ionicons name={icon} size={24} color={color} />
    </LinearGradient>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────

export default function VALTDashboard({ navigation }) {
  const [balance, setBalance] = useState('0');
  const [pledges, setPledges] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [address, setAddress] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [totalCredit, setTotalCredit] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      const [addr, bal, userPledges, rep] = await Promise.all([
        walletService.getAddress(),
        walletService.getZNDBalance(),
        pledgeService.getUserPledges(),
        reputationService.getScore()
      ]);

      setAddress(addr || '');
      setBalance(bal);
      setReputation(rep);

      const pledgeList = Object.values(userPledges.pledgeDetails || {});
      setPledges(pledgeList);

      const active = pledgeList.filter(p => p.status === 'ACTIVE');
      setTotalCredit(active.reduce((sum, p) => sum + parseFloat(p.creditAmount || 0), 0));

    } catch (error) {
      console.error('Load error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const shortAddress = address
    ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    : '—';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >

        {/* ── HEADER ── */}
        <LinearGradient
          colors={['#1A1A2E', '#0A0A0F']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>VALT</Text>
              <Text style={styles.headerSub}>Value As Liquidity Token</Text>
            </View>
            <TouchableOpacity
              style={styles.headerAddr}
              onPress={() => navigation.navigate('WalletScreen')}
            >
              <Text style={styles.headerAddrText}>{shortAddress}</Text>
              <Ionicons name="copy-outline" size={14} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <AnimatedCard delay={100}>
            <Animated.View style={[styles.balanceCard, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#6C63FF', '#4A42CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceGrad}
              >
                <Text style={styles.balanceLabel}>Solde ZND</Text>
                <Text style={styles.balanceAmount}>{parseFloat(balance).toFixed(2)}</Text>
                <Text style={styles.balanceCurrency}>ZND</Text>

                <View style={styles.balanceDivider} />

                <View style={styles.balanceRow}>
                  <View>
                    <Text style={styles.balanceSub}>Crédit actif</Text>
                    <Text style={styles.balanceSubVal}>{totalCredit.toFixed(0)} ZND</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceSub}>Score VALT</Text>
                    <Text style={styles.balanceSubVal}>{reputation?.score || '—'}/1000</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceSub}>Gages actifs</Text>
                    <Text style={styles.balanceSubVal}>{pledges.filter(p => p.status === 'ACTIVE').length}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </AnimatedCard>
        </LinearGradient>

        <View style={styles.content}>

          {/* ── ACTIONS RAPIDES ── */}
          <AnimatedCard delay={200}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.quickActions}>
              <QuickAction
                icon="add-circle"
                label="Nouveau gage"
                color={COLORS.accent}
                onPress={() => navigation.navigate('CreatePledge')}
              />
              <QuickAction
                icon="qr-code"
                label="Payer"
                color={COLORS.gold}
                onPress={() => navigation.navigate('GenerateQR')}
              />
              <QuickAction
                icon="scan"
                label="Scanner"
                color={COLORS.green}
                onPress={() => navigation.navigate('ScanQR')}
              />
              <QuickAction
                icon="swap-horizontal"
                label="Envoyer"
                color={COLORS.physical}
                onPress={() => navigation.navigate('SendZND')}
              />
            </View>
          </AnimatedCard>

          {/* ── TYPES DE COLLATERAL ── */}
          <AnimatedCard delay={300}>
            <Text style={styles.sectionTitle}>Mettre en gage</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.colRow}>
                {Object.entries(COL_CONFIG).map(([type, config]) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.colCard, { borderColor: config.color + '40' }]}
                    onPress={() => navigation.navigate('CreatePledge', { preselectedType: type })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.colIcon, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.icon} size={20} color={config.color} />
                    </View>
                    <Text style={styles.colLabel}>{config.label}</Text>
                    <Ionicons name="arrow-forward" size={14} color={config.color} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </AnimatedCard>

          {/* ── RÉPUTATION ── */}
          {reputation && (
            <AnimatedCard delay={400}>
              <TouchableOpacity
                style={styles.repCard}
                onPress={() => navigation.navigate('ReputationScreen')}
                activeOpacity={0.85}
              >
                <View style={styles.repLeft}>
                  <Text style={styles.sectionTitle}>Réputation VALT</Text>
                  <Text style={styles.repDesc}>
                    {reputation.repaidPledges} remboursements · {reputation.defaultedPledges} défauts
                  </Text>
                  <Text style={styles.repCredit}>
                    Plafond: {parseFloat(reputation.maxCreditLimit || 0).toFixed(0)} ZND
                  </Text>
                </View>
                <ReputationRing score={parseInt(reputation.score || 500)} />
              </TouchableOpacity>
            </AnimatedCard>
          )}

          {/* ── GAGES ACTIFS ── */}
          <AnimatedCard delay={500}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mes gages</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllPledges')}>
                <Text style={styles.seeAll}>Tout voir</Text>
              </TouchableOpacity>
            </View>

            {pledges.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bank-outline" size={48} color={COLORS.textSub} />
                <Text style={styles.emptyText}>Aucun gage actif</Text>
                <Text style={styles.emptySubText}>Mets un bien en gage pour obtenir du crédit ZND instantanément</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('CreatePledge')}
                >
                  <Text style={styles.emptyBtnText}>Créer mon premier gage</Text>
                </TouchableOpacity>
              </View>
            ) : (
              pledges.slice(0, 3).map((pledge, i) => (
                <PledgeCard
                  key={pledge.pledgeId || i}
                  pledge={pledge}
                  onPress={(p) => navigation.navigate('PledgeDetail', { pledge: p })}
                />
              ))
            )}
          </AnimatedCard>

          {/* ── MARCHÉ SECONDAIRE ── */}
          <AnimatedCard delay={600}>
            <TouchableOpacity
              style={styles.marketBanner}
              onPress={() => navigation.navigate('SecondaryMarket')}
            >
              <LinearGradient
                colors={['#FF6B6B20', '#FF6B6B05']}
                style={styles.marketGrad}
              >
                <View style={styles.marketLeft}>
                  <Text style={styles.marketTitle}>🏪 Marché secondaire</Text>
                  <Text style={styles.marketDesc}>Vends ton bien gagé directement via Pulse</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={32} color={COLORS.physical} />
              </LinearGradient>
            </TouchableOpacity>
          </AnimatedCard>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: 2 },
  headerSub: { fontSize: 11, color: COLORS.textSub, letterSpacing: 3, marginTop: 2 },
  headerAddr: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.cardBorder, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerAddrText: { fontSize: 12, color: COLORS.textSub, fontFamily: 'monospace' },

  balanceCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 4 },
  balanceGrad: { padding: 24 },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginBottom: 8 },
  balanceAmount: { fontSize: 48, fontWeight: '800', color: '#FFF', lineHeight: 56 },
  balanceCurrency: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: -4 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  balanceSubVal: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAction: { alignItems: 'center', flex: 1 },
  quickActionGrad: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 11, color: COLORS.textSub, textAlign: 'center', fontWeight: '600' },

  colRow: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  colCard: { width: 120, padding: 14, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, gap: 10 },
  colIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  colLabel: { fontSize: 12, color: COLORS.text, fontWeight: '600', flex: 1 },

  repCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  repLeft: { flex: 1 },
  repDesc: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },
  repCredit: { fontSize: 13, color: COLORS.accent, fontWeight: '600', marginTop: 8 },
  repRing: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  repRingInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  repScore: { fontSize: 18, fontWeight: '800' },
  repLabel: { fontSize: 9, color: COLORS.textSub, fontWeight: '600' },

  pledgeCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  pledgeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pledgeInfo: { flex: 1 },
  pledgeModel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  pledgeRef: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  pledgeDays: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  pledgeRight: { alignItems: 'flex-end', gap: 8 },
  pledgeAmount: { fontSize: 15, fontWeight: '800', color: COLORS.accent },
  pledgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pledgeStatusText: { fontSize: 11, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySubText: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 },
  emptyBtn: { marginTop: 24, backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  marketBanner: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  marketGrad: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.physical + '30', borderRadius: 16 },
  marketLeft: { flex: 1 },
  marketTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  marketDesc: { fontSize: 12, color: COLORS.textSub, marginTop: 4 }
});
