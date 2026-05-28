import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface SectionProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  colors: any;
}

function MethodSection({ icon, title, children, colors }: SectionProps) {
  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name={icon as any} size={16} color="#00843D" />
        </View>
        <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Para({ children, colors }: { children: string; colors: any }) {
  return <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 22, marginBottom: SPACING.sm }}>{children}</Text>;
}

function Source({ label, url, colors }: { label: string; url: string; colors: any }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
      accessibilityRole="link"
    >
      <Ionicons name="open-outline" size={12} color="#00843D" />
      <Text style={{ fontSize: 13, color: '#00843D', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function MethodologyScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md }}>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => navigation.goBack()} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>How Verity Works</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}>
        <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.xl }}>
          Verity is committed to transparency and neutrality. Here's exactly how we source, process, and present civic data.
        </Text>

        <MethodSection icon="person-outline" title="MP Profiles & Voting Records" colors={colors}>
          <Para colors={colors}>Every MP profile is built from official public records. Voting data comes from TheyVoteForYou.org.au, which parses Hansard (the official parliamentary transcript) to extract every recorded division vote.</Para>
          <Para colors={colors}>We show 145,000+ vote records across 1,929 divisions for 225 current MPs. Votes are labelled "Aye" (for), "No" (against), or absent. We never interpret how an MP "would have" voted.</Para>
          <Source label="TheyVoteForYou.org.au" url="https://theyvoteforyou.org.au" colors={colors} />
          <Source label="Parliament of Australia — Hansard" url="https://www.aph.gov.au/Parliamentary_Business/Hansard" colors={colors} />
        </MethodSection>

        <MethodSection icon="cash-outline" title="Donations & Follow the Money" colors={colors}>
          <Para colors={colors}>Donation data comes from the Australian Electoral Commission (AEC) annual returns and election campaign disclosures. We match donations to MPs and cross-reference donor industries with the MP's voting record on related legislation.</Para>
          <Para colors={colors}>Industry labels (mining, finance, property, etc.) are applied based on donor organisation names and ABN lookups. The "Follow the Money" feature shows correlations, not causation — a donation from a mining company and a vote on a mining bill is a fact, not an accusation.</Para>
          <Source label="AEC Disclosure Returns" url="https://www.aec.gov.au/Parties_and_Representatives/financial_disclosure/" colors={colors} />
        </MethodSection>

        <MethodSection icon="newspaper-outline" title="News & Bias Ratings" colors={colors}>
          <Para colors={colors}>News articles are ingested from 100+ Australian sources via NewsAPI, Google News RSS, and direct RSS feeds. Stories are clustered by topic using AI similarity matching.</Para>
          <Para colors={colors}>Source bias ratings (Left, Lean Left, Centre, Lean Right, Right) come from Media Bias/Fact Check (MBFC), an independent media monitoring organisation. We display these ratings transparently — Verity does not assign its own bias labels.</Para>
          <Source label="Media Bias/Fact Check" url="https://mediabiasfactcheck.com" colors={colors} />
        </MethodSection>

        <MethodSection icon="eye-off-outline" title="Blindspot Detection" colors={colors}>
          <Para colors={colors}>A "blindspot" is flagged when a news story's coverage is dominated by sources from one side of the political spectrum while the other side has little or no coverage. We calculate this by counting articles from left-leaning, centre, and right-leaning sources for each story cluster.</Para>
          <Para colors={colors}>The threshold: if one side has zero coverage, or if more than 60% of sources lean one direction with less than 10% from the other, we flag it as a blindspot. This helps readers see what they might be missing.</Para>
        </MethodSection>

        <MethodSection icon="scale-outline" title="Consistency Index" colors={colors}>
          <Para colors={colors}>The Consistency Index (formerly Hypocrisy Index) measures the gap between what an MP says in parliament and how they vote. Speeches are sourced from Hansard via OpenAustralia and classified against policy topics curated by TheyVoteForYou.</Para>
          <Para colors={colors}>Each speech is classified by AI (Claude Haiku) against candidate policy topics. The MP's stated position in speeches is compared to their voting record on divisions linked to those same policies. The score is rank-based: higher means a bigger gap between rhetoric and action.</Para>
          <Para colors={colors}>Confidence thresholds: only classifications with 60%+ confidence are included. Minimum data requirements apply — MPs with fewer than 3 scored topics show "insufficient data" instead of a score.</Para>
          <Source label="OpenAustralia" url="https://www.openaustralia.org.au" colors={colors} />
          <Source label="TheyVoteForYou — Policies" url="https://theyvoteforyou.org.au/policies" colors={colors} />
        </MethodSection>

        <MethodSection icon="bar-chart-outline" title="Polls & Sentiment" colors={colors}>
          <Para colors={colors}>Verity's in-app polls ask users their position on current policy issues. Results are aggregated by electorate when enough responses exist (minimum threshold applies). Published polling data from Newspoll, Essential, and Resolve is also displayed with full attribution.</Para>
          <Para colors={colors}>Poll aggregation uses standard weighted averaging across pollsters, with recency weighting. We display margins of error and sample sizes where available.</Para>
        </MethodSection>

        <MethodSection icon="document-text-outline" title="Bills & Legislation" colors={colors}>
          <Para colors={colors}>Bill data is scraped directly from the Australian Parliament House (APH) website daily. We track all bills from the 47th and 48th Parliaments: title, sponsor, portfolio, status, progress stages, and official summaries where available.</Para>
          <Para colors={colors}>AI-generated plain-English summaries use Claude Haiku and are clearly labelled as AI-generated. We never fabricate bill text or parliamentary quotes.</Para>
          <Source label="APH — Bills before Parliament" url="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_before_Parliament" colors={colors} />
        </MethodSection>

        <View style={{ backgroundColor: colors.cardAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md }}>
          <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.sm }}>Our commitment</Text>
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 20 }}>
            Verity is non-partisan. We show what MPs do, not what we think they should do. If you find an error or believe something is being presented unfairly, please report it — corrections strengthen the record.
          </Text>
          <Pressable
            onPress={() => Linking.openURL('mailto:corrections@verity.run')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md }}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={14} color="#00843D" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>corrections@verity.run</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
