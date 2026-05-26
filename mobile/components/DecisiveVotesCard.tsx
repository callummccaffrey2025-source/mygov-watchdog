import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { DecisiveVote } from '../hooks/useDecisiveVotes';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const GREEN = '#00843D';

interface Props {
  votes: DecisiveVote[];
  winningCount: number;
  memberFirstName: string;
}

export function DecisiveVotesCard({ votes, winningCount, memberFirstName }: Props) {
  const { colors } = useTheme();

  if (votes.length === 0) return null;

  // Show top 3 closest votes
  const top = votes.slice(0, 3);

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      {/* Section label */}
      <Text style={{
        fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
        letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase',
        marginBottom: SPACING.sm,
      }}>
        Close Votes
      </Text>

      {/* Summary */}
      <Text style={{
        fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
        color: colors.text, marginBottom: SPACING.md, lineHeight: 22,
      }}>
        {memberFirstName} voted with the winning side on {winningCount} of {votes.length} close division{votes.length !== 1 ? 's' : ''}
      </Text>

      {/* Individual close votes */}
      {top.map((v) => (
        <View key={v.division_id} style={{
          backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md, marginBottom: SPACING.sm,
        }}>
          <Text style={{
            fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
            color: colors.text, lineHeight: 18, marginBottom: SPACING.xs,
          }} numberOfLines={2}>
            {cleanDivisionName(v.division_name)}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Tally */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: GREEN, fontWeight: FONT_WEIGHT.bold }}>
                {v.aye_votes} Aye
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>vs</Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: '#DC3545', fontWeight: FONT_WEIGHT.bold }}>
                {v.no_votes} No
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                (margin: {v.margin})
              </Text>
            </View>

            {/* Result */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{
                backgroundColor: v.vote_cast === 'aye' ? '#E8F5EE' : '#FDECEA',
                borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{
                  fontSize: 10, fontWeight: FONT_WEIGHT.bold,
                  color: v.vote_cast === 'aye' ? GREEN : '#DC3545',
                }}>
                  {v.vote_cast === 'aye' ? 'Aye' : 'No'}
                </Text>
              </View>
              {v.on_winning_side && (
                <Ionicons name="checkmark-circle" size={14} color={GREEN} />
              )}
            </View>
          </View>
        </View>
      ))}

      {votes.length > 3 && (
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs }}>
          + {votes.length - 3} more close vote{votes.length - 3 !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Disclaimer */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
        marginTop: SPACING.md, paddingTop: SPACING.md,
        borderTopWidth: 0.5, borderTopColor: colors.border,
      }}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
          Close votes are divisions decided by {'\u2264'}10 votes. "Winning side" means voting with the majority, not that any single MP determined the outcome.
        </Text>
      </View>
    </View>
  );
}

function cleanDivisionName(name: string): string {
  return name.replace(/^[A-Za-z\s]+\s*[—–-]\s*/i, '').trim() || name;
}
