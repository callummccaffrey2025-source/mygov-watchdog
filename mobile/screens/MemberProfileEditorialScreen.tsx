import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Member } from '../hooks/useMembers';
import { useParticipationData } from '../hooks/useParticipationData';
import { useRecentMemberVotes } from '../hooks/useRecentMemberVotes';
import { useHansard } from '../hooks/useHansard';
import { useRegisteredInterests } from '../hooks/useRegisteredInterests';
import { useCommittees } from '../hooks/useCommittees';
import { useFollow } from '../hooks/useFollow';
import { useUser } from '../context/UserContext';
import { useAuthGate } from '../hooks/useAuthGate';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';

import {
  Card, Hero, StatRow, VoteRow, Pullquote, Divider,
  SectionHeading, Button, Badge, MethodologyFooter, SourcesFooter, EmptyState,
} from '../components/design-system';
import { useEditorialTheme } from '../theme/useEditorialTheme';
import { TYPE, SPACE, LAYOUT } from '../theme/tokens';

const PROCEDURAL_PREFIXES = ['Business —', 'Motions —', 'Procedure', 'Adjournment', 'Business of the Senate', 'Business of the House'];

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

export function MemberProfileEditorialScreen({ route, navigation }: any) {
  const { member: memberParam, memberId } = route.params as { member?: Member; memberId?: string };
  const [member, setMember] = useState<Member | null>(memberParam ?? null);
  const c = useEditorialTheme();
  const { user } = useUser();
  const { requireAuth, authSheetProps } = useAuthGate();

  useEffect(() => {
    if (!member && memberId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('members')
            .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
            .eq('id', memberId)
            .maybeSingle();
          if (data) setMember(data as Member);
        } catch {}
      })();
    }
  }, [memberId]);

  useEffect(() => {
    if (member) {
      track('mp_profile_view', { member_id: member.id, name: `${member.first_name} ${member.last_name}` }, 'MemberProfile');
    }
  }, [member?.id]);

  const { participation, loading: partLoading } = useParticipationData(member?.id);
  const { votes: recentVotes, totalCount: totalVoteCount, loading: votesLoading } = useRecentMemberVotes(member?.id, 5);
  const { entries: hansardEntries, loading: hansardLoading } = useHansard(member?.id);
  const { grouped: interestsGrouped, interests: allInterests, loading: interestsLoading } = useRegisteredInterests(member?.id);
  const { current: committees } = useCommittees(member?.id);
  const { following, toggle: toggleFollow } = useFollow('member', member?.id ?? '');

  if (!member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...TYPE.body, color: c.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${member.first_name} ${member.last_name}`;
  const party = member.party;
  const chamberLabel = member.chamber === 'senate' ? 'Senate' : 'House';
  const heroLabel = [party?.name ?? 'Independent', chamberLabel].join(' · ').toUpperCase();
  const metaParts: string[] = [];
  if (member.electorate) metaParts.push(`${member.electorate.name}, ${member.electorate.state}`);
  if (member.ministerial_role) metaParts.push(member.ministerial_role);

  // Determine which stat gets the green highlight (highest percentile)
  const stats = participation ? [
    { key: 'voting', pct: participation.votingPercentile },
    { key: 'activity', pct: participation.activityPercentile },
    { key: 'independence', pct: participation.independencePercentile },
    { key: 'committee', pct: participation.committeePercentile },
  ] : [];
  const highlightKey = stats.length > 0
    ? stats.reduce((best, s) => s.pct > best.pct ? s : best).key
    : null;

  // Filter hansard to substantive entries (not procedural)
  const substantiveSpeeches = hansardEntries
    .filter(e => e.debate_topic && !PROCEDURAL_PREFIXES.some(p => e.debate_topic!.startsWith(p)))
    .slice(0, 3);

  // Period label for participation section
  const periodLabel = participation?.periodStart && participation?.periodEnd
    ? `${Math.round((new Date(participation.periodEnd).getTime() - new Date(participation.periodStart).getTime()) / (1000 * 60 * 60 * 24))} days`
    : '365 days';

  const handleShare = () => {
    Share.share({
      message: `${displayName} — ${chamberLabel} member${member.electorate ? ` for ${member.electorate.name}` : ''}. View on Verity.`,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['top']}>
      {/* ── Compact nav ──────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: LAYOUT.screenPadding, paddingVertical: SPACE.xs }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{ ...TYPE.body, color: c.textPrimary }}>‹</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: SPACE.md }}>
          <Pressable onPress={handleShare} hitSlop={12}>
            <Text style={{ ...TYPE.meta, color: c.textTertiary }}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => requireAuth('follow this member', () => toggleFollow())}
            hitSlop={12}
          >
            <Text style={{ ...TYPE.meta, color: following ? c.brandGreen : c.textTertiary }}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACE.md, paddingBottom: SPACE.xl }}>
          <Hero
            label={heroLabel}
            title={displayName}
            meta={metaParts.join(' · ')}
          />

          {/* CTA bar */}
          <View style={{ flexDirection: 'row', gap: SPACE.xs, marginTop: SPACE.lg }}>
            <View style={{ flex: 1 }}>
              <Button
                title={following ? 'Following' : 'Follow'}
                variant={following ? 'ghost' : 'primary'}
                onPress={() => requireAuth('follow this member', () => toggleFollow())}
              />
            </View>
            {member.email && (
              <View style={{ width: '40%' }}>
                <Button
                  title="Contact"
                  variant="ghost"
                  onPress={() => navigation.navigate('WriteToMP', { member })}
                />
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: LAYOUT.screenPadding }}>
          <Divider />
        </View>

        {/* ── Participation ──────────────────────────────── */}
        {participation && (
          <View style={{ paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACE['2xl'] }}>
            <SectionHeading title="Participation" meta={periodLabel} />
            <Text style={{ ...TYPE.label, color: c.textTertiary, marginTop: SPACE.xs, marginBottom: SPACE.md }}>
              Four dimensions of parliamentary work, each shown as a percentile among {chamberLabel} members.
            </Text>

            <StatRow
              value={`${Math.round(participation.votingValue)}%`}
              label="votes attended"
              percentile={participation.votingPercentile}
              isHighlight={highlightKey === 'voting'}
              caption={`${participation.votesCast} of ${participation.divisionsEligible} divisions`}
            />
            <StatRow
              value={participation.votesAgainstParty > 0 ? `${participation.votesAgainstParty}` : '0'}
              label={participation.votesAgainstParty === 1 ? 'vote against majority' : 'votes against majority'}
              percentile={participation.independencePercentile}
              isHighlight={highlightKey === 'independence'}
              caption={participation.independenceValue > 0 ? `${participation.independenceValue.toFixed(1)}% independence rate` : 'voted with party on every division'}
            />
            <StatRow
              value={`${participation.speechesTotal}`}
              label="substantive speeches"
              percentile={participation.activityPercentile}
              isHighlight={highlightKey === 'activity'}
              caption={participation.questionsAsked > 0 ? `including ${participation.questionsAsked} questions` : undefined}
            />
            <StatRow
              value={`${participation.activeCommittees}`}
              label={participation.activeCommittees === 1 ? 'committee role' : 'committee roles'}
              percentile={participation.committeePercentile}
              isHighlight={highlightKey === 'committee'}
            />

            <MethodologyFooter />
          </View>
        )}

        <View style={{ paddingHorizontal: LAYOUT.screenPadding, marginTop: SPACE['2xl'] }}>
          <Divider />
        </View>

        {/* ── Recent votes ───────────────────────────────── */}
        {recentVotes.length > 0 && (
          <View style={{ paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACE['2xl'] }}>
            <SectionHeading
              title="Recent votes"
              meta={totalVoteCount > 0 ? `All ${totalVoteCount}` : undefined}
            />

            {recentVotes.map((v, idx) => {
              const div = v.division;
              if (!div || !div.name) return null;
              const title = cleanDivisionTitle(div.name);
              const vote = v.vote_cast === 'aye' ? 'aye' as const : 'no' as const;
              const context = v.rebelled ? 'rebelled' : undefined;
              return (
                <React.Fragment key={v.id}>
                  <VoteRow
                    title={decodeHtml(title)}
                    date={timeAgo(div.date)}
                    vote={vote}
                    context={context}
                  />
                  {idx < recentVotes.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </View>
        )}

        <View style={{ paddingHorizontal: LAYOUT.screenPadding, marginTop: SPACE['2xl'] }}>
          <Divider />
        </View>

        {/* ── In parliament (Hansard pullquotes) ──────────── */}
        {substantiveSpeeches.length > 0 && (
          <View style={{ paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACE['2xl'] }}>
            <SectionHeading title="In parliament" />

            {substantiveSpeeches.map((entry, idx) => (
              <View key={entry.id} style={{ marginTop: idx > 0 ? SPACE.lg : SPACE.md }}>
                <Pullquote
                  text={decodeHtml(entry.excerpt ?? '').slice(0, 200)}
                  source={`${entry.debate_topic ?? 'Parliament'} · ${timeAgo(entry.date)}`}
                  sourceUrl={entry.source_url ?? undefined}
                />
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: LAYOUT.screenPadding, marginTop: SPACE['2xl'] }}>
          <Divider />
        </View>

        {/* ── Declared interests ──────────────────────────── */}
        <View style={{ paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACE['2xl'] }}>
          <SectionHeading title="Declared interests" />

          {interestsLoading ? (
            <View style={{ height: 40, backgroundColor: c.hairline, borderRadius: 8, opacity: 0.3, marginTop: SPACE.md }} />
          ) : allInterests.length > 0 ? (
            <>
              {Object.entries(interestsGrouped).map(([category, items]) => (
                <View key={category} style={{ marginTop: SPACE.md }}>
                  <Text style={{ ...TYPE.label, color: c.textSecondary, marginBottom: SPACE.xxs }}>
                    {category} ({items.length})
                  </Text>
                  {items.slice(0, 3).map(item => (
                    <Text key={item.id} style={{ ...TYPE.meta, color: c.textTertiary, marginBottom: 2 }}>
                      {decodeHtml(item.description)}
                    </Text>
                  ))}
                  {items.length > 3 && (
                    <Text style={{ ...TYPE.meta, color: c.textQuiet }}>
                      and {items.length - 3} more
                    </Text>
                  )}
                </View>
              ))}
            </>
          ) : (
            <EmptyState
              title="Not yet available"
              explanation={
                member.chamber === 'house'
                  ? "House members' interests are not yet published as structured data by the Parliament of Australia."
                  : "No interest declarations found for this senator."
              }
              available="Senate interests (1,753 records across 76 senators) are available for all current senators."
            />
          )}
        </View>

        {/* ── Sources footer ──────────────────────────────── */}
        <View style={{ paddingHorizontal: LAYOUT.screenPadding, marginTop: SPACE['2xl'] }}>
          <Divider />
          <SourcesFooter
            sources={['APH division records', 'Hansard transcripts', 'AEC donation returns', 'Senate register of interests']}
            lastUpdated={participation?.periodEnd ?? undefined}
          />
        </View>
      </ScrollView>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
