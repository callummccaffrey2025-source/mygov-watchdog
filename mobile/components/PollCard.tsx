import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { Poll } from '../hooks/usePolls';

interface Props {
  poll: Poll;
  onVoted?: () => void;
  requireAuth?: (label: string, action: () => void) => void;
}

export function PollCard({ poll, onVoted, requireAuth }: Props) {
  const [voted, setVoted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [localCounts, setLocalCounts] = useState(poll._voteCounts || []);
  const total = localCounts.reduce((a, b) => a + b, 0);

  const castVote = async (index: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('poll_votes').insert({ poll_id: poll.id, user_id: user.id, option_index: index });
    const updated = [...localCounts];
    updated[index]++;
    setLocalCounts(updated);
    setSelectedIndex(index);
    setVoted(true);
    onVoted?.();
  };

  const handleVote = (index: number) => {
    if (voted) return;
    if (requireAuth) {
      requireAuth('vote on this poll', () => castVote(index));
    } else {
      castVote(index);
    }
  };

  const showResults = voted;

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.options}>
        {(poll.options || []).map((option: string, i: number) => (
          <Pressable
            key={i}
            style={[styles.option, selectedIndex === i && styles.selectedOption]}
            onPress={() => handleVote(i)}
          >
            {showResults && (
              <View style={[styles.bar, { width: `${total > 0 ? (localCounts[i] / total * 100) : 0}%` as any }]} />
            )}
            <Text style={[styles.optionText, selectedIndex === i && styles.selectedText]}>{option}</Text>
            {showResults && (
              <Text style={styles.pct}>{total > 0 ? Math.round(localCounts[i] / total * 100) : 0}%</Text>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={styles.count}>{total} {total === 1 ? 'vote' : 'votes'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  question: { fontSize: 15, fontWeight: '600', color: '#1a2332', marginBottom: 12 },
  options: { gap: 8 },
  option: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e8ecf0',
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: { borderColor: '#00843D' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#e8f5ee' },
  optionText: { fontSize: 14, color: '#1a2332', zIndex: 1 },
  selectedText: { fontWeight: '600', color: '#00843D' },
  pct: { fontSize: 13, fontWeight: '600', color: '#00843D', zIndex: 1 },
  count: { fontSize: 12, color: '#9aabb8', marginTop: 8 },
});
