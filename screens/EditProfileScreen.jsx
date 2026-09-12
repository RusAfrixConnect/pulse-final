// ============================================================
// EditProfileScreen.jsx — Édition du profil de matching
// Âge, bio, centres d'intérêt, objectif recherché (amitié /
// relation sérieuse / rencontre). Alimente directement le
// IA Matching (MatchingScreen) une fois enregistré.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { INTEREST_OPTIONS, LOOKING_FOR_OPTIONS } from '../constants/matching';

const MAX_INTERESTS = 10;
const MAX_BIO = 150;

export default function EditProfileScreen({ visible, onClose, currentUser, onSave, saving }) {
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [lookingFor, setLookingFor] = useState('friendship');
  const [error, setError] = useState('');

  // Recharge les valeurs actuelles à chaque ouverture, pour ne pas repartir d'un état obsolète.
  useEffect(() => {
    if (visible) {
      setAge(currentUser?.age ? String(currentUser.age) : '');
      setBio(currentUser?.bio || '');
      setInterests(currentUser?.interests || []);
      setLookingFor(currentUser?.lookingFor || 'friendship');
      setError('');
    }
  }, [visible, currentUser]);

  const toggleInterest = (key) => {
    setInterests(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, key];
    });
  };

  const handleSave = () => {
    const ageNum = parseInt(age, 10);
    if (age && (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 120)) {
      setError('Âge invalide (13 à 120 ans)');
      return;
    }
    setError('');
    onSave({
      age: age ? ageNum : null,
      bio: bio.trim(),
      interests,
      lookingFor,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>✏️ Mon profil</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.headerIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.label}>🎂 Âge</Text>
            <TextInput
              style={styles.input}
              placeholder="Ton âge"
              placeholderTextColor="#6b7280"
              keyboardType="number-pad"
              maxLength={3}
              value={age}
              onChangeText={setAge}
            />

            <Text style={styles.label}>📝 Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Parle un peu de toi..."
              placeholderTextColor="#6b7280"
              multiline
              maxLength={MAX_BIO}
              value={bio}
              onChangeText={setBio}
            />
            <Text style={styles.charCount}>{bio.length}/{MAX_BIO}</Text>

            <Text style={styles.label}>💜 Je recherche</Text>
            <View style={styles.chipsWrap}>
              {LOOKING_FOR_OPTIONS.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.chip, lookingFor === l.key && styles.chipActive]}
                  onPress={() => setLookingFor(l.key)}>
                  <Text style={styles.chipText}>{l.emoji} {l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              ✨ Centres d'intérêt <Text style={styles.labelSub}>({interests.length}/{MAX_INTERESTS})</Text>
            </Text>
            <View style={styles.chipsWrap}>
              {INTEREST_OPTIONS.map(i => (
                <TouchableOpacity
                  key={i.key}
                  style={[styles.chip, interests.includes(i.key) && styles.chipActive]}
                  onPress={() => toggleInterest(i.key)}>
                  <Text style={styles.chipText}>{i.emoji} {i.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={handleSave}>
              <Text style={styles.saveBtnText}>{saving ? 'Enregistrement...' : '💾 Enregistrer'}</Text>
            </TouchableOpacity>
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
  headerIcon: { color: '#e8e0f0', fontSize: 20 },

  label: { color: '#C9A84C', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  labelSub: { color: '#9b8cb0', fontSize: 11, fontWeight: '400' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, color: '#e8e0f0', fontSize: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  charCount: { color: '#6b7280', fontSize: 11, textAlign: 'right', marginTop: 4 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 100, paddingHorizontal: 12,
    paddingVertical: 8, borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: 'rgba(107,33,168,0.4)', borderColor: '#a78bfa' },
  chipText: { color: '#e8e0f0', fontSize: 12 },

  errorText: { color: '#ef4444', fontSize: 12, marginTop: 12, textAlign: 'center' },
  saveBtn: { backgroundColor: '#6B21A8', borderRadius: 100, alignItems: 'center', paddingVertical: 14, marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
