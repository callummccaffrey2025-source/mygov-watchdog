import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

const CIVIC_FACTS = [
  'Australia has compulsory voting — over 96% turnout.',
  'The Senate has 76 senators: 12 per state, 2 per territory.',
  'A bill must pass both House and Senate to become law.',
  'Question Time runs 45 minutes each sitting day.',
  'The Budget is typically delivered on the second Tuesday in May.',
  'Australia was among the first to give women the vote, in 1902.',
  'The PM is not directly elected — they lead the majority party.',
  'The Hansard is the official word-for-word record of Parliament.',
  'Federal elections must happen within 3 years of the previous one.',
  'There are 151 House of Representatives seats across Australia.',
  'Preferential voting means you rank candidates from 1 to last.',
  'Crossbench senators often hold the balance of power.',
];

export function LoadingFact() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CIVIC_FACTS.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % CIVIC_FACTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <ActivityIndicator size="small" color="#00843D" style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' }}>
        {CIVIC_FACTS[index]}
      </Text>
      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Loading your brief...</Text>
    </View>
  );
}
