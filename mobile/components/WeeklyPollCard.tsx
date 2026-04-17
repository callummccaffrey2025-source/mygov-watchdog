import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeeklyPoll, PollResults } from '../hooks/useWeeklyPoll';
import { useTheme } from '../context/ThemeContext';

const GREEN = '#00843D';

function ResultBar({ label, count, total, isSelected }: { label: string; count: number; total: number; isSelected: boolean }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? GREEN : '#1A1A2E' }}>
          {label} {isSelected ? '✓' : ''}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? GREEN : '#1A1A2E' }}>{pct}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: isSelected ? GREEN : '#9CA3AF' }} />
      </View>
    </View>
  );
}

interface Props {
  poll: WeeklyPoll;
  userVote: number | null;
  results: PollResults | null;
  electorate: string | null;
  onVote: (index: number) => void;
  requireAuth?: (label: string, action: () => void) => void;
}

export function WeeklyPollCard({ poll, userVote, results, electorate, onVote, requireAuth }: Props) {
  const { colors } = useTheme();
  const hasVoted = userVote !== null;

  const handleVote = (index: number) => {
    if (hasVoted) return;
    if (requireAuth) {
      requireAuth('vote on this poll', () => onVote(index));
    } else {
      onVote(index);
    }
  };

  const handleShare = () => {
    if (!results || userVote === null) return;
    const option = poll.options[userVote];
    const nationalPct = results.total > 0 ? Math.round((results.national[userVote] / results.total) * 100) : 0;
    const localPct = results.electorateTotal > 0
      ? Math.round((results.electorate[userVote] / results.electorateTotal) * 100)
      : null;

    const msg = localPct !== null && electorate
      ? `In ${electorate}, ${localPct}% chose "${option}" vs ${nationalPct}% nationally.\n\n"${poll.question}"\n\n${results.total.toLocaleString()} Australians voted on Verity this week.\nverity.run`
      : `${nationalPct}% of Australians chose "${option}"\n\n"${poll.question}"\n\n${results.total.toLocaleString()} voted on Verity this week.\nverity.run`;

    Share.share({ message: msg });
  };

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: 14, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="bar-chart-outline" size={14} color="#4338CA" />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#4338CA', letterSpacing: 0.8 }}>WEEKLY POLL</Text>
      </View>

      {/* Question */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 24, marginBottom: 4 }}>
        {poll.question}
      </Text>
      {poll.description && (
        <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 12 }}>
          {poll.description}
        </Text>
      )}

      {/* Options / Results */}
      {!hasVoted ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          {poll.options.map((option, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => ({
                borderWidth: 1.5, borderColor: GREEN, borderRadius: 10,
                paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
                backgroundColor: pressed ? GREEN + '10' : 'transparent',
              })}
              onPress={() => handleVote(i)}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: GREEN }}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : results ? (
        <View style={{ marginTop: 12 }}>
          {/* National results */}
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 }}>NATIONAL</Text>
          {poll.options.map((option, i) => (
            <ResultBar
              key={i}
              label={option}
              count={results.national[i]}
              total={results.total}
              isSelected={userVote === i}
            />
          ))}

          {/* Electorate comparison */}
          {electorate && results.electorateTotal > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 }}>
                YOUR ELECTORATE: {electorate.toUpperCase()}
              </Text>
              {poll.options.map((option, i) => {
                const localPct = results.electorateTotal > 0 ? Math.round((results.electorate[i] / results.electorateTotal) * 100) : 0;
                const nationalPct = results.total > 0 ? Math.round((results.national[i] / results.total) * 100) : 0;
                const diff = localPct - nationalPct;
                return (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#1A1A2E', flex: 1 }}>{option}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A2E', width: 40, textAlign: 'right' }}>{localPct}%</Text>
                    {diff !== 0 && (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: diff > 0 ? '#10B981' : '#EF4444', width: 40, textAlign: 'right' }}>
                        {diff > 0 ? '+' : ''}{diff}
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
              {results.total.toLocaleString()} response{results.total !== 1 ? 's' : ''}
            </Text>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color={GREEN} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: GREEN }}>Share results</Text>
            </Pressable>
          </View>

          {/* Methodology disclaimer — this is a self-selected community pulse, not a representative poll */}
          <View style={{ marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, flexDirection: 'row', gap: 6 }}>
            <Ionicons name="information-circle-outline" size={13} color="#6B7280" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 11, color: '#6B7280', lineHeight: 15 }}>
              Based on {results.total.toLocaleString()} self-selected Verity users — not a demographically representative poll. Results aren't weighted and shouldn't be compared to Essential, Resolve, or Newspoll.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
