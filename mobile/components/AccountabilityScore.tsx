import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParticipationIndex } from '../hooks/useAccountabilityScore';

function Stat({
  icon, label, value, subtitle, color = '#1A1A1A',
}: { icon: string; label: string; value: string; subtitle?: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Ionicons name={icon as any} size={14} color="#6B7280" />
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
      {subtitle ? (
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

interface Props {
  score: ParticipationIndex;
  mpName: string;
  partyColour: string;
}

export function AccountabilityScoreCard({ score, mpName }: Props) {
  const [showMethodology, setShowMethodology] = useState(false);

  const handleShare = () => {
    Share.share({
      message:
        `${mpName} on the Verity Participation Index:\n\n` +
        `Attendance: ${score.attendanceRate}%\n` +
        `Speeches: ${score.speechesCount}\n` +
        `Questions: ${score.questionsCount}\n` +
        `Independence (crossed floor): ${score.independenceRate}%\n` +
        `Committees: ${score.committeeCount}${score.chairCount > 0 ? ` (${score.chairCount} as chair/deputy)` : ''}\n\n` +
        `Based on ${score.totalVotes} recorded votes from public APH records.\n` +
        `Track your MP at verity.run`,
    });
  };

  return (
    <>
      <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A2E' }}>Participation Index</Text>
          <Pressable onPress={handleShare} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="share-outline" size={16} color="#00843D" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>Share</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 17 }}>
          Parliamentary participation from public APH records. Not a judgment of effectiveness or virtue.
        </Text>

        {/* Low sample warning */}
        {score.isLowSample && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Ionicons name="information-circle" size={14} color="#D97706" />
            <Text style={{ flex: 1, fontSize: 12, color: '#92400E' }}>
              Small sample ({score.totalVotes} votes) — these numbers will change as more data is recorded.
            </Text>
          </View>
        )}

        {/* Four separate dimensions — never collapsed */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Stat
            icon="checkmark-done-outline"
            label="Attendance"
            value={`${score.attendanceRate}%`}
            subtitle={`of ${score.totalVotes} recorded votes`}
          />
          <Stat
            icon="mic-outline"
            label="Activity"
            value={`${score.parliamentaryActivity}`}
            subtitle={`${score.speechesCount} speeches · ${score.questionsCount} questions`}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Stat
            icon="git-branch-outline"
            label="Independence"
            value={`${score.independenceRate}%`}
            subtitle={score.rebelVotes === 1 ? 'crossed floor once' : `crossed floor ${score.rebelVotes} times`}
          />
          <Stat
            icon="people-outline"
            label="Committees"
            value={`${score.committeeCount}`}
            subtitle={score.chairCount > 0 ? `${score.chairCount} as chair/deputy` : 'member roles'}
          />
        </View>

        {/* What we can't see — per Tingle's review */}
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="eye-off-outline" size={13} color="#6B7280" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              What we can't see
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18 }}>
            Party room decisions, cabinet deliberations, constituency casework, and policy negotiation are not publicly recorded. Ministers typically give fewer speeches because they run departments. These numbers describe parliamentary behaviour only.
          </Text>
        </View>

        {/* Methodology link */}
        <Pressable onPress={() => setShowMethodology(true)} style={{ alignSelf: 'center', paddingVertical: 10, marginTop: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280' }}>
            How is this calculated? <Text style={{ color: '#00843D', fontWeight: '600' }}>Read the methodology →</Text>
          </Text>
        </Pressable>
      </View>

      {/* Methodology modal */}
      <Modal visible={showMethodology} transparent animationType="slide" onRequestClose={() => setShowMethodology(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowMethodology(false)}
        >
          <Pressable
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' }}
            onPress={e => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E' }}>Methodology</Text>
              <Pressable onPress={() => setShowMethodology(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            <View style={{ maxHeight: 500 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>What we measure</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                The Verity Participation Index tracks four separate dimensions of parliamentary behaviour from public APH division records, Hansard transcripts, and committee listings. We report each dimension independently rather than collapsing them into a single number. A single composite score would hide editorial choices inside a weighted formula, so we don't use one.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>The four dimensions</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Attendance</Text> — percentage of recorded divisions where the MP voted aye or no. Abstentions and absences lower this number. Paired absences (formal agreements with an opposition MP) are excluded from the denominator.
              </Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Activity</Text> — count of Hansard-recorded speeches and questions. Note: senior ministers typically give fewer speeches because they run departments.
              </Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Independence</Text> — percentage of substantive votes where the MP crossed the floor (voted against party majority). Independence can reflect conscience or grandstanding — the number alone can't tell you which.
              </Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                <Text style={{ fontWeight: '600' }}>Committees</Text> — current committee memberships. Chair and deputy-chair roles are flagged because committee work is radically undervalued in most public political coverage.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>What we don't measure</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                Party room decisions, cabinet deliberations, constituency casework, and private policy negotiation. Approximately 85% of political work happens outside the chamber and is not publicly recorded.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>Confidence</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                MPs with fewer than 20 recorded votes are flagged as low sample. Their numbers will shift materially as more data accrues. Treat early-term MPs with wider error bars.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>Data sources</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                Australian Parliament House division records (aph.gov.au), Hansard transcripts via OpenAustralia, committee listings from APH. All underlying data is public.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 }}>Changelog</Text>
              <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 14 }}>
                April 2026 — v1: Replaced composite "Accountability Score" with four separate dimensions following methodology review. Added low-sample flag. Added "what we can't see" disclosure.
              </Text>

              <Pressable onPress={() => Linking.openURL('https://verity.run/methodology')}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D', marginTop: 8 }}>
                  Read the full methodology page →
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
