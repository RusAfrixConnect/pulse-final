// ============================================================
// MatchingScreen.jsx — IA Matching (amitié & amour) façon Tinder
// Swipe de cartes, profils détaillés, filtres avancés,
// score de compatibilité en %, et ouverture du chat après match.
// ============================================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  PanResponder, Dimensions, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  INTEREST_OPTIONS, INTEREST_MAP, LOOKING_FOR_OPTIONS, LOOKING_FOR_MAP,
  computeCompatibility, ageFromBirthdate,
} from '../constants/matching';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.9;
const CARD_H = SCREEN_H * 0.6;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

const DEFAULT_FILTERS = { minAge: 18, maxAge: 45, maxDistance: 50, lookingFor: 'all', interest: null };

// `profiles` vient de GET /matching/candidates (vrais comptes) : `onSwipe(targetId, liked)`
// doit renvoyer une Promise<boolean> résolue avec le `matched` renvoyé par
// POST /matching/swipe (le match n'est plus simulé côté client). `onReload` redemande de
// nouveaux candidats au parent (bouton "Recommencer").
export default function MatchingScreen({ visible, onClose, currentUser, profiles = [], loading, onOpenChat, onMatch, onSwipe, onReload }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState(null);

  const position = useRef(new Animated.ValueXY()).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  const me = useMemo(() => ({
    age: currentUser?.age || ageFromBirthdate(currentUser?.birthdate) || 27,
    interests: currentUser?.interests || ['sport', 'social'],
    lookingFor: currentUser?.lookingFor || 'friendship',
  }), [currentUser]);

  // Les vrais profils n'ont pas forcément d'âge/de distance renseignés (pas de
  // géolocalisation côté backend) : un champ absent ne doit pas exclure le candidat,
  // seul un champ présent et hors filtre le fait.
  const deck = useMemo(() => {
    return profiles
      .filter(p => p.age == null || (p.age >= filters.minAge && p.age <= filters.maxAge))
      .filter(p => p.distanceKm == null || p.distanceKm <= filters.maxDistance)
      .filter(p => filters.lookingFor === 'all' || p.lookingFor === filters.lookingFor)
      .filter(p => !filters.interest || p.interests.includes(filters.interest))
      .map(p => ({ ...p, ...computeCompatibility(me, p) }))
      .sort((a, b) => b.score - a.score);
  }, [filters, me, profiles]);

  useEffect(() => { setIndex(0); }, [filters, profiles]);

  const resetPosition = () => {
    // `position` est aussi piloté en JS par onPanResponderMove (useNativeDriver: false,
    // requis avec PanResponder) : toute animation sur cette même valeur doit rester en JS,
    // sinon RN lève "Attempting to run JS driven animation on animated node that has been
    // moved to 'native'" dès qu'on relâche le geste après un drag.
    Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
  };

  const forceSwipe = (direction) => {
    Animated.timing(position, {
      toValue: { x: direction === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, y: 0 },
      duration: 250, useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction) => {
    const profile = deck[index];
    position.setValue({ x: 0, y: 0 });
    setShowDetail(false);
    setIndex(i => i + 1);
    if (profile) recordSwipe(profile, direction === 'right');
  };

  // Enregistre le like/pass côté serveur (POST /matching/swipe) - le match n'est plus
  // une chance simulée localement : il n'est réel que si l'autre personne nous a
  // également likés (mutuel), déterminé par le backend.
  const recordSwipe = async (profile, liked) => {
    if (!profile || !onSwipe) return;
    const isMatch = await onSwipe(profile.id, liked);
    if (liked && isMatch) {
      setMatched(profile);
      onMatch && onMatch(profile);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) forceSwipe('right');
        else if (g.dx < -SWIPE_THRESHOLD) forceSwipe('left');
        else resetPosition();
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2], outputRange: ['-10deg', '0deg', '10deg'],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [20, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, -20], outputRange: [1, 0], extrapolate: 'clamp' });

  const current = deck[index];
  const next = deck[index + 1];

  const scoreColor = (score) => score >= 75 ? '#10b981' : score >= 50 ? '#C9A84C' : '#ef4444';

  const renderCard = (profile, isTop) => {
    if (!profile) return null;
    const cardStyle = isTop
      ? {
          transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
          zIndex: 2,
        }
      : { transform: [{ scale: 0.96 }], top: 10, zIndex: 1, opacity: 0.85 };

    return (
      <Animated.View
        key={profile.id}
        style={[styles.card, cardStyle]}
        {...(isTop ? panResponder.panHandlers : {})}>
        <View style={styles.photoArea}>
          <Text style={styles.photoEmoji}>{profile.photos?.[0] || profile.avatar}</Text>
          <LinearGradient
            colors={['transparent', 'rgba(10,10,15,0.95)']}
            style={styles.photoGradient} />
          {isTop && (
            <>
              <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
                <Text style={styles.likeStampText}>LIKE</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
                <Text style={styles.nopeStampText}>NOPE</Text>
              </Animated.View>
            </>
          )}
          <View style={[styles.scoreBadge, { backgroundColor: scoreColor(profile.score) }]}>
            <Text style={styles.scoreBadgeText}>{profile.score}%</Text>
          </View>
          {profile.verified && (
            <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Vérifié</Text></View>
          )}
          <View style={styles.photoInfo}>
            <Text style={styles.photoName}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
            {(profile.city || profile.distanceKm != null) && (
              <Text style={styles.photoMeta}>
                {[profile.city && `📍 ${profile.city}`, profile.distanceKm != null && `${profile.distanceKm}km`]
                  .filter(Boolean).join(' · ')}
              </Text>
            )}
            {LOOKING_FOR_MAP[profile.lookingFor] && (
              <View style={styles.lookingForChip}>
                <Text style={styles.lookingForChipText}>
                  {LOOKING_FOR_MAP[profile.lookingFor].emoji} {LOOKING_FOR_MAP[profile.lookingFor].label}
                </Text>
              </View>
            )}
          </View>
          {isTop && (
            <TouchableOpacity style={styles.infoBtn} onPress={() => setShowDetail(v => !v)}>
              <Text style={styles.infoBtnText}>{showDetail ? '✕' : 'ⓘ'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isTop && showDetail && (
          <ScrollView style={styles.detailPanel} showsVerticalScrollIndicator={false}>
            <Text style={styles.detailBio}>{profile.bio}</Text>

            <Text style={styles.detailLabel}>Compatibilité détaillée</Text>
            {[
              ['Centres d\'intérêt', profile.breakdown.interests],
              ['Objectif', profile.breakdown.lookingFor],
              ['Âge', profile.breakdown.age],
              ['Proximité', profile.breakdown.proximity],
            ].map(([label, val]) => (
              <View key={label} style={styles.barRow}>
                <Text style={styles.barLabel}>{label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${val}%`, backgroundColor: scoreColor(val) }]} />
                </View>
                <Text style={styles.barVal}>{val}%</Text>
              </View>
            ))}

            <Text style={styles.detailLabel}>Centres d'intérêt</Text>
            <View style={styles.chipsWrap}>
              {profile.interests.map(k => (
                <View key={k} style={[
                  styles.interestChip,
                  profile.commonInterests?.includes(k) && styles.interestChipCommon,
                ]}>
                  <Text style={styles.interestChipText}>
                    {INTEREST_MAP[k]?.emoji} {INTEREST_MAP[k]?.label}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Animated.View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🤖 IA Matching</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => setShowFilters(true)}>
                <Text style={styles.headerIcon}>⚙️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.headerIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.deckArea}>
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>⏳</Text>
                <Text style={styles.emptyTitle}>Recherche de profils compatibles...</Text>
              </View>
            ) : !current ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Plus de profils pour l'instant</Text>
                <Text style={styles.emptySub}>Élargis tes filtres ou reviens plus tard</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowFilters(true)}>
                  <Text style={styles.emptyBtnText}>Ajuster mes filtres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyBtn, styles.emptyBtnGhost]}
                  onPress={() => onReload && onReload()}>
                  <Text style={styles.emptyBtnGhostText}>Recommencer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {renderCard(next, false)}
                {renderCard(current, true)}
              </>
            )}
          </View>

          {current && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => forceSwipe('left')}>
                <Text style={styles.actionBtnText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.superBtn]}
                onPress={() => {
                  const profile = current;
                  setIndex(i => i + 1);
                  setShowDetail(false);
                  recordSwipe(profile, true);
                }}>
                <Text style={styles.actionBtnText}>⭐</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => forceSwipe('right')}>
                <Text style={styles.actionBtnText}>❤️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* FILTRES AVANCÉS */}
        <Modal visible={showFilters} animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.filtersSheet}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Filtres</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Text style={styles.headerIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Text style={styles.filterLabel}>Âge : {filters.minAge} - {filters.maxAge} ans</Text>
                <View style={styles.stepperRow}>
                  <Stepper label="Min" value={filters.minAge}
                    onChange={v => setFilters(f => ({ ...f, minAge: Math.min(v, f.maxAge) }))}
                    min={18} max={99} />
                  <Stepper label="Max" value={filters.maxAge}
                    onChange={v => setFilters(f => ({ ...f, maxAge: Math.max(v, f.minAge) }))}
                    min={18} max={99} />
                </View>

                <Text style={styles.filterLabel}>Distance max : {filters.maxDistance} km</Text>
                <Stepper value={filters.maxDistance}
                  onChange={v => setFilters(f => ({ ...f, maxDistance: v }))}
                  min={1} max={100} step={5} />

                <Text style={styles.filterLabel}>Je recherche</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    style={[styles.filterChip, filters.lookingFor === 'all' && styles.filterChipActive]}
                    onPress={() => setFilters(f => ({ ...f, lookingFor: 'all' }))}>
                    <Text style={styles.filterChipText}>🌍 Tout</Text>
                  </TouchableOpacity>
                  {LOOKING_FOR_OPTIONS.map(l => (
                    <TouchableOpacity key={l.key}
                      style={[styles.filterChip, filters.lookingFor === l.key && styles.filterChipActive]}
                      onPress={() => setFilters(f => ({ ...f, lookingFor: l.key }))}>
                      <Text style={styles.filterChipText}>{l.emoji} {l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterLabel}>Centre d'intérêt</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    style={[styles.filterChip, !filters.interest && styles.filterChipActive]}
                    onPress={() => setFilters(f => ({ ...f, interest: null }))}>
                    <Text style={styles.filterChipText}>🌍 Tous</Text>
                  </TouchableOpacity>
                  {INTEREST_OPTIONS.map(i => (
                    <TouchableOpacity key={i.key}
                      style={[styles.filterChip, filters.interest === i.key && styles.filterChipActive]}
                      onPress={() => setFilters(f => ({ ...f, interest: f.interest === i.key ? null : i.key }))}>
                      <Text style={styles.filterChipText}>{i.emoji} {i.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.resetBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                  <Text style={styles.resetBtnText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
                  <Text style={styles.applyBtnText}>Voir {deck.length} profil{deck.length > 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* C'EST UN MATCH */}
        <Modal visible={!!matched} animationType="fade" transparent>
          <View style={styles.matchOverlay}>
            <Text style={styles.matchTitle}>✨ C'est un Match ! ✨</Text>
            <View style={styles.matchAvatars}>
              <Text style={styles.matchAvatarText}>😊</Text>
              <Text style={styles.matchAvatarText}>{matched?.avatar}</Text>
            </View>
            <Text style={styles.matchSub}>
              Toi et {matched?.name} vous plaisez à {matched?.score}% !
            </Text>
            <TouchableOpacity style={styles.matchChatBtn}
              onPress={() => { onOpenChat && onOpenChat(matched); setMatched(null); }}>
              <Text style={styles.matchChatBtnText}>💬 Envoyer un message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.matchContinueBtn} onPress={() => setMatched(null)}>
              <Text style={styles.matchContinueBtnText}>Continuer à swiper</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function Stepper({ label, value, onChange, min, max, step = 1 }) {
  return (
    <View style={styles.stepper}>
      {label && <Text style={styles.stepperLabel}>{label}</Text>}
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperVal}>{value}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.min(max, value + step))}>
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,5,10,0.6)', justifyContent: 'flex-end' },
  container: { height: '92%', backgroundColor: '#0f0a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  headerTitle: { color: '#e8e0f0', fontSize: 18, fontWeight: '700' },
  headerIcon: { color: '#e8e0f0', fontSize: 20 },

  deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', width: CARD_W, height: CARD_H,
    borderRadius: 20, backgroundColor: '#161022', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  photoArea: { flex: 1, backgroundColor: '#1c1530', alignItems: 'center', justifyContent: 'center' },
  photoEmoji: { fontSize: 140 },
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  photoInfo: { position: 'absolute', left: 16, bottom: 16, right: 16 },
  photoName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  photoMeta: { color: '#e8e0f0', fontSize: 13, marginTop: 4 },
  lookingForChip: {
    marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(107,33,168,0.5)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  lookingForChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  scoreBadge: { position: 'absolute', top: 14, right: 14, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  scoreBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  verifiedBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(59,130,246,0.85)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  infoBtn: {
    position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  stamp: { position: 'absolute', top: 40, borderWidth: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  likeStamp: { left: 20, borderColor: '#10b981', transform: [{ rotate: '-20deg' }] },
  likeStampText: { color: '#10b981', fontSize: 28, fontWeight: '900' },
  nopeStamp: { right: 20, borderColor: '#ef4444', transform: [{ rotate: '20deg' }] },
  nopeStampText: { color: '#ef4444', fontSize: 28, fontWeight: '900' },

  detailPanel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,10,26,0.97)', padding: 20 },
  detailBio: { color: '#e8e0f0', fontSize: 14, lineHeight: 20, marginBottom: 16, marginTop: 24 },
  detailLabel: { color: '#C9A84C', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { color: '#9b8cb0', fontSize: 11, width: 100 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  barFill: { height: 6, borderRadius: 3 },
  barVal: { color: '#e8e0f0', fontSize: 11, width: 34, textAlign: 'right' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  interestChip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  interestChipCommon: { backgroundColor: 'rgba(16,185,129,0.25)', borderWidth: 1, borderColor: '#10b981' },
  interestChipText: { color: '#e8e0f0', fontSize: 12 },

  actionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 20 },
  actionBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  passBtn: { backgroundColor: '#1c1530', borderWidth: 2, borderColor: '#ef4444' },
  superBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1c1530', borderWidth: 2, borderColor: '#3b82f6' },
  likeBtn: { backgroundColor: '#1c1530', borderWidth: 2, borderColor: '#10b981' },
  actionBtnText: { fontSize: 26 },

  emptyState: { alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { color: '#e8e0f0', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: '#9b8cb0', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#6B21A8', borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  emptyBtnGhost: { backgroundColor: 'transparent' },
  emptyBtnGhostText: { color: '#a78bfa', fontWeight: '600' },

  filtersSheet: { height: '85%', backgroundColor: '#0f0a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20 },
  filterLabel: { color: '#e8e0f0', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  stepperRow: { flexDirection: 'row', gap: 16 },
  stepper: { alignItems: 'center' },
  stepperLabel: { color: '#9b8cb0', fontSize: 11, marginBottom: 4 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  stepperBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(167,139,250,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  stepperVal: { color: '#e8e0f0', fontSize: 14, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  filterChip: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  filterChipText: { color: '#e8e0f0', fontSize: 12 },
  resetBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 20 },
  resetBtnText: { color: '#9b8cb0', fontSize: 13 },
  applyBtn: { backgroundColor: '#6B21A8', borderRadius: 100, alignItems: 'center', paddingVertical: 14, marginBottom: 24 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  matchOverlay: { flex: 1, backgroundColor: 'rgba(5,5,10,0.95)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  matchTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 24, textAlign: 'center' },
  matchAvatars: { flexDirection: 'row', marginBottom: 20 },
  matchAvatarText: { fontSize: 64, marginHorizontal: -10 },
  matchSub: { color: '#e8e0f0', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  matchChatBtn: { backgroundColor: '#10b981', borderRadius: 100, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12, width: '100%', alignItems: 'center' },
  matchChatBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  matchContinueBtn: { paddingVertical: 10 },
  matchContinueBtnText: { color: '#9b8cb0', fontSize: 13 },
});
