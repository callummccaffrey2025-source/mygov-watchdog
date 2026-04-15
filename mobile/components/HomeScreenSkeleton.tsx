import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

const FACTS = [
  'Australia has compulsory voting — over 96% turnout.',
  'The Senate has 76 senators: 12 per state, 2 per territory.',
  'A bill must pass both House and Senate to become law.',
  'Question Time runs 45 minutes each sitting day.',
  'There are 151 House of Representatives seats across Australia.',
  'Preferential voting means you rank candidates from 1 to last.',
];

export function HomeScreenSkeleton() {
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => {
    const t = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
      {/* Hero area */}
      <SkeletonLoader width="100%" height={180} borderRadius={16} style={{ marginBottom: 16 }} />

      {/* MP card */}
      <SkeletonLoader width="100%" height={80} borderRadius={14} style={{ marginBottom: 20 }} />

      {/* Daily Brief card */}
      <SkeletonLoader width="100%" height={100} borderRadius={14} style={{ marginBottom: 16 }} />

      {/* Civic fact while loading */}
      <View style={{ alignItems: 'center', paddingVertical: 12, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19, fontStyle: 'italic', paddingHorizontal: 16 }}>
          {FACTS[factIdx]}
        </Text>
      </View>

      {/* Section header */}
      <SkeletonLoader width={140} height={18} style={{ marginBottom: 12 }} />

      {/* News card skeletons */}
      {[1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonLoader width="90%" height={14} borderRadius={6} />
            <SkeletonLoader width="70%" height={14} borderRadius={6} />
            <SkeletonLoader width="40%" height={12} borderRadius={6} />
          </View>
          <SkeletonLoader width={88} height={88} borderRadius={10} />
        </View>
      ))}

      {/* Vote card skeletons */}
      {[1, 2].map(i => (
        <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} style={{ marginBottom: 10 }} />
      ))}
    </ScrollView>
  );
}
