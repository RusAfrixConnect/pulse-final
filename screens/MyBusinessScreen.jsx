// ============================================================
// MyBusinessScreen.jsx — Gestion d'un commerce à rendez-vous
// (créer le commerce, publier des créneaux, voir les réservations reçues).
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';

const BUSINESS_TYPES = [
  { key: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { key: 'coiffeur', emoji: '💇', label: 'Coiffeur' },
  { key: 'medecin', emoji: '⚕️', label: 'Médecin' },
  { key: 'beaute', emoji: '💅', label: 'Beauté' },
  { key: 'sport', emoji: '💪', label: 'Sport/Coach' },
  { key: 'autre', emoji: '📅', label: 'Autre' },
];

// Parse "JJ/MM/AAAA" + "HH:MM" en Date, ou null si invalide.
const parseDateTime = (dateStr, timeStr) => {
  const dateParts = (dateStr || '').split('/');
  const timeParts = (timeStr || '').split(':');
  if (dateParts.length !== 3 || timeParts.length !== 2) return null;
  const [d, m, y] = dateParts.map(Number);
  const [h, min] = timeParts.map(Number);
  if (!d || !m || !y || Number.isNaN(h) || Number.isNaN(min)) return null;
  const date = new Date(y, m - 1, d, h, min);
  return Number.isNaN(date.getTime()) ? null : date;
};

function Stepper({ value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <View style={styles.stepperControls}>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.max(min, value - step))}>
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepperVal}>{value}{suffix}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(Math.min(max, value + step))}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MyBusinessScreen({
  visible, onClose, myBusinesses, userLocation,
  onCreateBusiness, onLoadSlots, onCreateSlot, onDeleteSlot, onLoadBookings,
}) {
  const [newBiz, setNewBiz] = useState({ name: '', type: 'restaurant', description: '' });
  const [creating, setCreating] = useState(false);

  const [selectedBizId, setSelectedBizId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: '', time: '', durationMinutes: 30, priceZnd: 20, priceEur: '10', capacity: 1,
  });

  const activeBusiness = myBusinesses.find(b => b.id === selectedBizId) || myBusinesses[0] || null;

  useEffect(() => {
    if (myBusinesses.length && !selectedBizId) setSelectedBizId(myBusinesses[0].id);
  }, [myBusinesses]);

  const refresh = async (businessId) => {
    if (!businessId) return;
    const [s, b] = await Promise.all([onLoadSlots(businessId), onLoadBookings(businessId)]);
    setSlots(s);
    setBookings(b);
  };

  useEffect(() => {
    if (visible && activeBusiness) refresh(activeBusiness.id);
  }, [visible, activeBusiness?.id]);

  const handleCreateBusiness = async () => {
    if (!newBiz.name.trim()) { alert('Nom du commerce requis'); return; }
    const lat = userLocation?.latitude ?? 48.8566;
    const lng = userLocation?.longitude ?? 2.3522;
    const typeInfo = BUSINESS_TYPES.find(t => t.key === newBiz.type);
    setCreating(true);
    const ok = await onCreateBusiness({
      name: newBiz.name.trim(), type: newBiz.type,
      description: newBiz.description.trim(), emoji: typeInfo?.emoji || '📅', lat, lng,
    });
    setCreating(false);
    if (ok) setNewBiz({ name: '', type: 'restaurant', description: '' });
  };

  const handleAddSlot = async () => {
    const dateTime = parseDateTime(newSlot.date, newSlot.time);
    if (!dateTime) { alert('Date (JJ/MM/AAAA) ou heure (HH:MM) invalide'); return; }
    if (dateTime <= new Date()) { alert('Choisis une date/heure dans le futur'); return; }
    const ok = await onCreateSlot(activeBusiness.id, {
      startsAt: dateTime.toISOString(),
      durationMinutes: newSlot.durationMinutes,
      priceZnd: newSlot.priceZnd,
      priceEur: parseFloat(newSlot.priceEur) || 0,
      capacity: newSlot.capacity,
    });
    if (ok) {
      setShowAddSlot(false);
      setNewSlot({ date: '', time: '', durationMinutes: 30, priceZnd: 20, priceEur: '10', capacity: 1 });
      refresh(activeBusiness.id);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    const ok = await onDeleteSlot(activeBusiness.id, slotId);
    if (ok) refresh(activeBusiness.id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🏪 Mon commerce</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {myBusinesses.length === 0 ? (
              <>
                <Text style={styles.sectionLabel}>Créer mon commerce</Text>
                <TextInput style={styles.input} placeholder="Nom (ex: Salon Léa)"
                  placeholderTextColor="#6b7280" value={newBiz.name}
                  onChangeText={v => setNewBiz(b => ({ ...b, name: v }))} />
                <View style={styles.chipsWrap}>
                  {BUSINESS_TYPES.map(t => (
                    <TouchableOpacity key={t.key}
                      style={[styles.chip, newBiz.type === t.key && styles.chipActive]}
                      onPress={() => setNewBiz(b => ({ ...b, type: t.key }))}>
                      <Text style={styles.chipText}>{t.emoji} {t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[styles.input, styles.multilineInput]}
                  placeholder="Description" placeholderTextColor="#6b7280" multiline
                  value={newBiz.description}
                  onChangeText={v => setNewBiz(b => ({ ...b, description: v }))} />
                <Text style={styles.hint}>
                  📍 Utilisera ta position actuelle{userLocation ? '' : ' (position non détectée, valeur par défaut Paris)'}
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, creating && { opacity: 0.6 }]}
                  disabled={creating} onPress={handleCreateBusiness}>
                  <Text style={styles.primaryBtnText}>{creating ? 'Création...' : 'Créer mon commerce'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {myBusinesses.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {myBusinesses.map(b => (
                      <TouchableOpacity key={b.id}
                        style={[styles.chip, activeBusiness?.id === b.id && styles.chipActive]}
                        onPress={() => setSelectedBizId(b.id)}>
                        <Text style={styles.chipText}>{b.emoji} {b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Créneaux</Text>
                  <TouchableOpacity onPress={() => setShowAddSlot(v => !v)}>
                    <Text style={styles.addLink}>{showAddSlot ? 'Annuler' : '+ Ajouter'}</Text>
                  </TouchableOpacity>
                </View>

                {showAddSlot && (
                  <View style={styles.addSlotBox}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="JJ/MM/AAAA"
                        placeholderTextColor="#6b7280" value={newSlot.date}
                        onChangeText={v => setNewSlot(s => ({ ...s, date: v }))} />
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="HH:MM"
                        placeholderTextColor="#6b7280" value={newSlot.time}
                        onChangeText={v => setNewSlot(s => ({ ...s, time: v }))} />
                    </View>
                    <View style={styles.stepperRow}>
                      <View>
                        <Text style={styles.stepperLabel}>Durée (min)</Text>
                        <Stepper value={newSlot.durationMinutes} min={10} max={240} step={10}
                          onChange={v => setNewSlot(s => ({ ...s, durationMinutes: v }))} />
                      </View>
                      <View>
                        <Text style={styles.stepperLabel}>Places</Text>
                        <Stepper value={newSlot.capacity} min={1} max={20}
                          onChange={v => setNewSlot(s => ({ ...s, capacity: v }))} />
                      </View>
                    </View>
                    <View style={styles.stepperRow}>
                      <View>
                        <Text style={styles.stepperLabel}>Prix ZND</Text>
                        <Stepper value={newSlot.priceZnd} min={0} max={2000} step={5}
                          onChange={v => setNewSlot(s => ({ ...s, priceZnd: v }))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepperLabel}>Prix EUR (sur place)</Text>
                        <TextInput style={styles.input} keyboardType="decimal-pad"
                          placeholder="10" placeholderTextColor="#6b7280" value={newSlot.priceEur}
                          onChangeText={v => setNewSlot(s => ({ ...s, priceEur: v }))} />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleAddSlot}>
                      <Text style={styles.primaryBtnText}>Publier ce créneau</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {slots.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun créneau à venir</Text>
                ) : slots.map(slot => (
                  <View key={slot.id} style={styles.slotRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotDate}>
                        {new Date(slot.starts_at).toLocaleString('fr-FR', {
                          weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                      <Text style={styles.slotMeta}>
                        {slot.duration_minutes} min · {slot.remaining}/{slot.capacity} places · 💎{slot.price_znd} · {slot.price_eur}€
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSlot(slot.id)}>
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Réservations reçues</Text>
                {bookings.length === 0 ? (
                  <Text style={styles.emptyText}>Aucune réservation pour l'instant</Text>
                ) : bookings.map(b => (
                  <View key={b.id} style={styles.bookingRow}>
                    <Text style={styles.bookingUser}>{b.userName}</Text>
                    <Text style={styles.slotMeta}>
                      {new Date(b.startsAt).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })} · {b.paymentMethod === 'znd' ? `💎${b.amount}` : `${b.amount}€ sur place`}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5,5,10,0.6)', justifyContent: 'flex-end' },
  container: {
    height: '88%', backgroundColor: '#0f0a1a', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { color: '#e8e0f0', fontSize: 18, fontWeight: '700' },
  closeIcon: { color: '#e8e0f0', fontSize: 20 },

  sectionLabel: { color: '#C9A84C', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addLink: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },

  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, color: '#e8e0f0', fontSize: 14, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)', marginBottom: 10,
  },
  multilineInput: { height: 70, textAlignVertical: 'top' },
  hint: { color: '#6b7280', fontSize: 11, marginBottom: 14 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 100, paddingHorizontal: 12,
    paddingVertical: 8, borderWidth: 1, borderColor: 'transparent', marginRight: 8,
  },
  chipActive: { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  chipText: { color: '#e8e0f0', fontSize: 12 },

  primaryBtn: { backgroundColor: '#6B21A8', borderRadius: 100, alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  addSlotBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 14,
  },
  stepperRow: { flexDirection: 'row', gap: 20, marginTop: 10, marginBottom: 4 },
  stepperLabel: { color: '#9b8cb0', fontSize: 11, marginBottom: 4 },
  stepperControls: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  stepperBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(167,139,250,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stepperVal: { color: '#e8e0f0', fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'center' },

  emptyText: { color: '#9b8cb0', fontSize: 13, marginBottom: 12 },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  slotDate: { color: '#e8e0f0', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  slotMeta: { color: '#9b8cb0', fontSize: 11, marginTop: 2 },
  deleteIcon: { fontSize: 18, paddingHorizontal: 6 },

  bookingRow: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 8,
  },
  bookingUser: { color: '#e8e0f0', fontSize: 13, fontWeight: '700' },
});
