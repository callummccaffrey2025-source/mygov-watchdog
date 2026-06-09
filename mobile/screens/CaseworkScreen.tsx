import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';

// ── Casework Categories ──────────────────────────────────────────────────

interface CaseworkCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  examples: string[];
  contactTip: string;
}

const CATEGORIES: CaseworkCategory[] = [
  {
    id: 'centrelink',
    icon: 'card-outline',
    title: 'Centrelink & Payments',
    description: 'Your MP can intervene when payments are delayed, claims are rejected, or debts are disputed.',
    examples: [
      'Payment delayed or suspended without explanation',
      'Rejected claim you believe was wrongly assessed',
      'Robo-debt or disputed overpayment',
      'Waiting weeks for a call-back',
    ],
    contactTip: 'Mention the specific payment type, your CRN (Customer Reference Number), and the date of your last contact with Centrelink.',
  },
  {
    id: 'visa',
    icon: 'airplane-outline',
    title: 'Visas & Immigration',
    description: 'MPs can make ministerial enquiries to the Department of Home Affairs on your behalf.',
    examples: [
      'Visa processing taking longer than stated timeframe',
      'Partner or family visa delays',
      'Bridging visa issues while waiting for decision',
      'Citizenship application delays',
    ],
    contactTip: 'Include your visa subclass number, application date, and any reference numbers from the Department.',
  },
  {
    id: 'ndis',
    icon: 'accessibility-outline',
    title: 'NDIS',
    description: 'Your MP can escalate NDIS plan reviews, funding disputes, and provider issues.',
    examples: [
      'Plan review not reflecting your needs',
      'Funding cuts you disagree with',
      'Can\'t find providers in your area',
      'Access request denied',
    ],
    contactTip: 'Bring your NDIS number, current plan details, and any reports from your therapists or doctors.',
  },
  {
    id: 'aged-care',
    icon: 'heart-outline',
    title: 'Aged Care',
    description: 'MPs can help with home care package wait times, residential care issues, and My Aged Care navigation.',
    examples: [
      'Waiting months for a home care package',
      'Concerns about quality of care in a facility',
      'Difficulty navigating My Aged Care',
      'ACAT assessment delays',
    ],
    contactTip: 'Include the name of the person needing care, their My Aged Care reference, and the specific issue.',
  },
  {
    id: 'tax',
    icon: 'receipt-outline',
    title: 'Tax & ATO',
    description: 'Your MP can enquire about delayed refunds, disputed assessments, and ATO correspondence.',
    examples: [
      'Tax refund delayed beyond normal processing time',
      'Disputed tax assessment or penalty',
      'Difficulty contacting the ATO',
      'ABN or GST registration issues',
    ],
    contactTip: 'Never share your TFN with your MP\'s office. Share the issue type, dates, and any ATO reference numbers.',
  },
  {
    id: 'veterans',
    icon: 'shield-outline',
    title: 'Veterans\' Affairs',
    description: 'MPs can help with DVA claims, pension delays, and access to services.',
    examples: [
      'Compensation claim delays',
      'Gold or White Card issues',
      'Transition support after service',
      'Mental health support access',
    ],
    contactTip: 'Include your DVA file number and the specific claim or service you need help with.',
  },
  {
    id: 'infrastructure',
    icon: 'construct-outline',
    title: 'Local Infrastructure',
    description: 'Federal funding for roads, bridges, flood recovery, and community projects.',
    examples: [
      'Flood or disaster recovery support',
      'Federal infrastructure funding for your area',
      'Mobile phone blackspot complaints',
      'NBN connection issues',
    ],
    contactTip: 'Be specific about the location and the impact on your community. Photos and petitions help.',
  },
  {
    id: 'other',
    icon: 'chatbubble-outline',
    title: 'Something Else',
    description: 'Your MP\'s office handles a wide range of constituent concerns. If in doubt, call them.',
    examples: [
      'Medicare and health rebates',
      'Child support issues',
      'Passport delays',
      'Federal grants and programs',
    ],
    contactTip: 'Write a clear, concise summary of your issue with dates and reference numbers.',
  },
];

// ── Category Card ────────────────────────────────────────────────────────

function CategoryCard({
  category,
  expanded,
  onToggle,
  onContact,
  colors,
}: {
  category: CaseworkCategory;
  expanded: boolean;
  onToggle: () => void;
  onContact: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${category.title}: ${category.description}`}
      style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
        ...SHADOWS.sm,
      }}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        padding: SPACING.lg,
      }}>
        <View style={{
          width: 40, height: 40, borderRadius: BORDER_RADIUS.md,
          backgroundColor: '#E8F5EE',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name={category.icon as any} size={20} color="#00843D" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text,
          }}>
            {category.title}
          </Text>
          {!expanded && (
            <Text style={{
              fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2,
            }} numberOfLines={1}>
              {category.description}
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={{
          paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
          borderTopWidth: 1, borderTopColor: colors.border,
          paddingTop: SPACING.md,
        }}>
          <Text style={{
            fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22,
            marginBottom: SPACING.md,
          }}>
            {category.description}
          </Text>

          {/* Examples */}
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
            color: colors.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm,
          }}>
            COMMON ISSUES
          </Text>
          {category.examples.map((ex, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.xs }}>
              <Text style={{ fontSize: FONT_SIZE.small, color: '#00843D', marginTop: 1 }}>•</Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, flex: 1, lineHeight: 18 }}>
                {ex}
              </Text>
            </View>
          ))}

          {/* Tip */}
          <View style={{
            backgroundColor: '#FFFBEB',
            borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md,
            marginTop: SPACING.md,
            flexDirection: 'row', gap: SPACING.sm,
          }}>
            <Ionicons name="bulb-outline" size={16} color="#F59E0B" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: '#92400E', lineHeight: 18 }}>
              {category.contactTip}
            </Text>
          </View>

          {/* Contact button */}
          <Pressable
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={`Contact your MP about ${category.title}`}
            style={({ pressed }) => ({
              backgroundColor: '#00843D',
              borderRadius: BORDER_RADIUS.full,
              paddingVertical: SPACING.md,
              alignItems: 'center',
              marginTop: SPACING.lg,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>
              Contact your MP about this
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────

export function CaseworkScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { member: myMP } = useElectorateByPostcode(postcode);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleContact = (category: CaseworkCategory) => {
    hapticLight();
    track('casework_contact', { category: category.id }, 'Casework');

    if (myMP) {
      navigation.navigate('WriteToMP', {
        member: myMP,
        fromCasework: {
          subject: category.title,
          category: category.id,
        },
      });
    } else {
      // No MP set — prompt to enter postcode
      navigation.navigate('MyRepresentatives');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={['#00843D', '#005C2B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: SPACING.lg, paddingHorizontal: 20, paddingBottom: SPACING.xxl }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginBottom: SPACING.lg }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>

          <Text style={{
            fontSize: FONT_SIZE.heading + 4, fontWeight: FONT_WEIGHT.bold,
            color: '#ffffff', marginBottom: SPACING.sm,
          }}>
            Get help from your MP
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.7)', lineHeight: 22,
          }}>
            Your MP's electorate office exists to help you navigate government services. Here's what they can do.
          </Text>
        </LinearGradient>

        {/* MP context card */}
        {myMP && (
          <View style={{
            marginHorizontal: 20, marginTop: -SPACING.md,
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
            ...SHADOWS.md,
          }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: '#00843D',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
                {myMP.first_name[0]}{myMP.last_name[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                {myMP.first_name} {myMP.last_name}
              </Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                {myMP.party?.short_name} · MP for {myMP.electorate?.name}
              </Text>
            </View>
            {myMP.phone && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  Linking.openURL(`tel:${myMP.phone}`);
                }}
                accessibilityRole="button"
                accessibilityLabel="Call your MP's office"
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#E8F5EE',
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Ionicons name="call-outline" size={16} color="#00843D" />
              </Pressable>
            )}
          </View>
        )}

        {/* Explainer */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
          <View style={{
            backgroundColor: '#F0F9FF',
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            flexDirection: 'row', gap: SPACING.md,
            ...SHADOWS.sm,
          }}>
            <Ionicons name="information-circle" size={20} color="#0284C7" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#0C4A6E', marginBottom: SPACING.xs }}>
                This is a free service
              </Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: '#0369A1', lineHeight: 18 }}>
                Every federal MP has an electorate office funded by taxpayers specifically to help constituents.
                You don't need to be a member of their party. You don't need to have voted for them.
                This is what they're there for.
              </Text>
            </View>
          </View>
        </View>

        {/* Categories */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl, paddingBottom: SPACING.xxl }}>
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
            color: colors.textMuted, letterSpacing: 0.8,
            marginBottom: SPACING.md,
          }}>
            WHAT DO YOU NEED HELP WITH?
          </Text>

          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              expanded={expandedId === cat.id}
              onToggle={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              onContact={() => handleContact(cat)}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
