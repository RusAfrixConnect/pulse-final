// ============================================================
// BookingScreen.jsx — Réservation d'un créneau chez un commerce
// (restaurant, coiffeur, médecin, etc.) : liste des disponibilités,
// choix du paiement (ZND ou EUR), confirmation.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator,
} from 'react-native';

const formatSlotDate = (isoDate) => {
  const date = new Date(isoDate);
  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
};

// `business` = commerce tapé sur la carte (null = modale fermée). `onLoadSlots(businessId)`
// renvoie les créneaux à venir avec places restantes. `onBook(slotId, paymentMethod)`
// renvoie `{ ok, error }` - le paiement EUR n'est jamais réellement prélevé (pas de
// passerelle fiat dans ce projet), c'est explicitement affiché comme "à régler sur place".
export default function BookingScreen({ business, onClose, onLoadSlots, onBook }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('znd');
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (!business) {
      setSlots([]); setSelectedSlot(null); setConfirmed(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    onLoadSlots(business.id).then(data => {
      if (!cancelled) { setSlots(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [business?.id]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    const result = await onBook(selectedSlot.id, paymentMethod);
    setBooking(false);
    if (result.ok) {
      setConfirmed({ slot: selectedSlot, paymentMethod });
      setSelectedSlot(null);
    } else {
      alert(result.error || 'Erreur lors de la réservation');
    }
  };

  const closeAndReset = () => {
    setConfirmed(null);
    setSelectedSlot(null);
    onClose();
  };

  return (
    <Modal visible={!!business} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{business?.emoji || '📅'} {business?.name}</Text>
              <Text style={styles.headerSub}>{business?.type}</Text>
            </View>
            <TouchableOpacity onPress={closeAndReset}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {confirmed ? (
            <View style={styles.confirmedBox}>
              <Text style={styles.confirmedEmoji}>✅</Text>
              <Text style={styles.confirmedTitle}>Réservation confirmée !</Text>
              <Text style={styles.confirmedSub}>
                {formatSlotDate(confirmed.slot.starts_at)} chez {business?.name}
              </Text>
              {confirmed.paymentMethod === 'eur' && (
                <Text style={styles.eurNotice}>💶 À régler sur place ({confirmed.slot.price_eur} €)</Text>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={closeAndReset}>
                <Text style={styles.primaryBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {!!business?.description && (
                <Text style={styles.description}>{business.description}</Text>
              )}
              <Text style={styles.sectionLabel}>Créneaux disponibles</Text>
              {loading ? (
                <ActivityIndicator color="#a78bfa" style={{ marginTop: 24 }} />
              ) : slots.length === 0 ? (
                <Text style={styles.emptyText}>Aucun créneau disponible pour l'instant</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {slots.map(slot => (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotRow, selectedSlot?.id === slot.id && styles.slotRowActive]}
                      disabled={slot.remaining <= 0}
                      onPress={() => { setSelectedSlot(slot); setPaymentMethod('znd'); }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slotDate}>{formatSlotDate(slot.starts_at)}</Text>
                        <Text style={styles.slotMeta}>
                          {slot.duration_minutes} min · {slot.remaining > 0
                            ? `${slot.remaining} place${slot.remaining > 1 ? 's' : ''}`
                            : 'Complet'}
                        </Text>
                      </View>
                      <Text style={styles.slotPrice}>
                        💎{slot.price_znd} · {slot.price_eur}€
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {selectedSlot && (
                <View style={styles.bookPanel}>
                  <Text style={styles.sectionLabel}>Paiement</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[styles.payChip, paymentMethod === 'znd' && styles.payChipActive]}
                      onPress={() => setPaymentMethod('znd')}>
                      <Text style={styles.payChipText}>💎 {selectedSlot.price_znd} ZND</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.payChip, paymentMethod === 'eur' && styles.payChipActive]}
                      onPress={() => setPaymentMethod('eur')}>
                      <Text style={styles.payChipText}>💶 {selectedSlot.price_eur} € (sur place)</Text>
                    </TouchableOpacity>
                  </View>
                  {paymentMethod === 'eur' && (
                    <Text style={styles.eurNotice}>
                      Le paiement en euros n'est pas prélevé dans l'app : tu régleras directement sur place.
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.primaryBtn, booking && { opacity: 0.6 }]}
                    disabled={booking}
                    onPress={handleConfirm}>
                    <Text style={styles.primaryBtnText}>
                      {booking ? 'Réservation...' : 'Confirmer la réservation'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,5,10,0.6)', justifyContent: 'flex-end' },
  container: {
    height: '80%', backgroundColor: '#0f0a1a', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  headerTitle: { color: '#e8e0f0', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#9b8cb0', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  closeIcon: { color: '#e8e0f0', fontSize: 20 },
  description: { color: '#9b8cb0', fontSize: 13, marginBottom: 16, lineHeight: 18 },

  sectionLabel: { color: '#C9A84C', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#9b8cb0', fontSize: 13, textAlign: 'center', marginTop: 24 },

  slotRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent',
  },
  slotRowActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  slotDate: { color: '#e8e0f0', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  slotMeta: { color: '#9b8cb0', fontSize: 12, marginTop: 2 },
  slotPrice: { color: '#C9A84C', fontSize: 12, fontWeight: '700' },

  bookPanel: {
    borderTopWidth: 1, borderColor: 'rgba(167,139,250,0.2)', paddingTop: 16, marginTop: 12,
  },
  payChip: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  payChipActive: { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  payChipText: { color: '#e8e0f0', fontSize: 12, fontWeight: '600' },
  eurNotice: { color: '#C9A84C', fontSize: 11, marginBottom: 12, lineHeight: 16 },

  primaryBtn: {
    backgroundColor: '#6B21A8', borderRadius: 100, alignItems: 'center',
    paddingVertical: 14, marginBottom: 24,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  confirmedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  confirmedEmoji: { fontSize: 56, marginBottom: 12 },
  confirmedTitle: { color: '#e8e0f0', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  confirmedSub: { color: '#9b8cb0', fontSize: 13, textAlign: 'center', marginBottom: 8 },
});
