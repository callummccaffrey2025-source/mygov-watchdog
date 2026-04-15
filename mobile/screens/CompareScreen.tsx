import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMembers, Member } from '../hooks/useMembers';
import { useParties, Party } from '../hooks/useParties';

type SelectionItem = { type: 'member'; data: Member } | { type: 'party'; data: Party };

export function CompareScreen({ navigation }: any) {
  const [left, setLeft] = useState<SelectionItem | null>(null);
  const [right, setRight] = useState<SelectionItem | null>(null);
  const [selecting, setSelecting] = useState<'left' | 'right' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { members } = useMembers({ search: searchQuery || undefined, limit: searchQuery ? 20 : 10 });
  const { parties } = useParties();

  const filteredParties = parties.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = (item: SelectionItem) => {
    if (item.type === 'member') return `${item.data.first_name} ${item.data.last_name}`;
    return item.data.short_name || item.data.name;
  };

  const displaySub = (item: SelectionItem) => {
    if (item.type === 'member') return item.data.party?.short_name || '';
    return 'Party';
  };

  const ItemSelector = ({ side }: { side: 'left' | 'right' }) => {
    const selected = side === 'left' ? left : right;
    return (
      <Pressable style={styles.selectorCard} onPress={() => { setSelecting(side); setSearchQuery(''); }}>
        {selected ? (
          <View style={styles.selectedItem}>
            <Text style={styles.selectedName}>{displayName(selected)}</Text>
            <Text style={styles.selectedSub}>{displaySub(selected)}</Text>
          </View>
        ) : (
          <View style={styles.emptySelector}>
            <Ionicons name="add-circle-outline" size={28} color="#9aabb8" />
            <Text style={styles.emptySelectorText}>Select MP or Party</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Compare</Text>

        {/* Selectors */}
        <View style={styles.selectors}>
          <ItemSelector side="left" />
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <ItemSelector side="right" />
        </View>

        {/* Comparison result */}
        {left && right && (
          <View style={styles.comparison}>
            <View style={styles.compCard}>
              <Text style={styles.compTitle}>Comparison</Text>
              <Text style={styles.compSubtitle}>{displayName(left)} vs {displayName(right)}</Text>
              <View style={styles.alignStat}>
                <Text style={styles.alignValue}>—</Text>
                <Text style={styles.alignLabel}>Voting alignment data coming soon</Text>
              </View>
            </View>
          </View>
        )}

        {(!left || !right) && (
          <View style={styles.hint}>
            <Ionicons name="git-compare-outline" size={48} color="#e8ecf0" />
            <Text style={styles.hintText}>Select two MPs or parties above to compare their voting records and positions.</Text>
          </View>
        )}
      </ScrollView>

      {/* Selection Modal */}
      <Modal visible={selecting !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select MP or Party</Text>
            <Pressable onPress={() => setSelecting(null)}>
              <Ionicons name="close" size={24} color="#1a2332" />
            </Pressable>
          </View>
          <TextInput
            style={styles.modalSearch}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search..."
            placeholderTextColor="#9aabb8"
            autoFocus
          />
          <ScrollView>
            {filteredParties.length > 0 && (
              <View>
                <Text style={styles.modalSection}>Parties</Text>
                {filteredParties.slice(0, 5).map(party => (
                  <Pressable key={party.id} style={styles.modalItem} onPress={() => {
                    const item: SelectionItem = { type: 'party', data: party };
                    if (selecting === 'left') setLeft(item); else setRight(item);
                    setSelecting(null);
                  }}>
                    <View style={[styles.modalDot, { backgroundColor: party.colour || '#9aabb8' }]} />
                    <Text style={styles.modalItemText}>{party.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.modalSection}>MPs & Senators</Text>
            {members.map(m => (
              <Pressable key={m.id} style={styles.modalItem} onPress={() => {
                const item: SelectionItem = { type: 'member', data: m };
                if (selecting === 'left') setLeft(item); else setRight(item);
                setSelecting(null);
              }}>
                <View style={[styles.modalDot, { backgroundColor: m.party?.colour || '#9aabb8' }]} />
                <View>
                  <Text style={styles.modalItemText}>{m.first_name} {m.last_name}</Text>
                  <Text style={styles.modalItemSub}>{m.party?.short_name} · {m.electorate?.name}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a2332', marginBottom: 24 },
  selectors: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  selectorCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e8ecf0',
    borderStyle: 'dashed',
  },
  selectedItem: { alignItems: 'center', gap: 4 },
  selectedName: { fontSize: 13, fontWeight: '700', color: '#1a2332', textAlign: 'center' },
  selectedSub: { fontSize: 11, color: '#9aabb8' },
  emptySelector: { alignItems: 'center', gap: 6 },
  emptySelectorText: { fontSize: 12, color: '#9aabb8', textAlign: 'center' },
  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a2332', justifyContent: 'center', alignItems: 'center' },
  vsText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  comparison: { marginTop: 8 },
  compCard: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 20, gap: 8 },
  compTitle: { fontSize: 16, fontWeight: '700', color: '#1a2332' },
  compSubtitle: { fontSize: 13, color: '#5a6a7a' },
  alignStat: { alignItems: 'center', marginTop: 16, gap: 4 },
  alignValue: { fontSize: 40, fontWeight: '800', color: '#00843D' },
  alignLabel: { fontSize: 13, color: '#9aabb8', textAlign: 'center' },
  hint: { alignItems: 'center', marginTop: 60, gap: 16, paddingHorizontal: 40 },
  hintText: { fontSize: 14, color: '#9aabb8', textAlign: 'center', lineHeight: 22 },
  modal: { flex: 1, backgroundColor: '#ffffff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332' },
  modalSearch: { margin: 16, backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a2332' },
  modalSection: { fontSize: 12, fontWeight: '700', color: '#9aabb8', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8 },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  modalDot: { width: 12, height: 12, borderRadius: 6 },
  modalItemText: { fontSize: 15, color: '#1a2332', fontWeight: '500' },
  modalItemSub: { fontSize: 12, color: '#9aabb8' },
});
