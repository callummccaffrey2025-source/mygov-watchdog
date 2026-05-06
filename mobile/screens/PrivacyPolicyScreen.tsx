import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 }}>{title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 24, color: '#374151' }}>{body}</Text>
    </View>
  );
}

export function PrivacyPolicyScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Pressable style={{ padding: 20, paddingBottom: 0 }} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 }}>Privacy Policy</Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Last updated: May 2026</Text>

        <Section
          title="Who We Are"
          body="Verity is operated by Callum McCaffrey (sole trader) in Sydney, New South Wales, Australia. ABN: pending registration. For privacy questions, email privacy@verity.au."
        />
        <Section
          title="What We Collect"
          body={'Verity collects the following personal information:\n\n• Postcode — to match you with your federal electorate and local MP\n• Email address — if you create an account (for authentication only)\n• Apple ID — if you sign in with Apple (name and email, as provided by Apple)\n• Device identifiers — for push notifications and anonymous analytics\n• Usage data — which screens you visit, features you use, and content you interact with\n\nWe do not sell your data to anyone.'}
        />
        <Section
          title="How We Use Your Data"
          body={'Your postcode powers your personalised Daily Brief, MP updates, and community feed. Your email is used only for account authentication and critical service updates. Usage data helps us understand which features matter most and improve the app.\n\nWe do not use your personal data for advertising or profiling.'}
        />
        <Section
          title="AI Features"
          body={'Verity uses AI (powered by Anthropic\'s Claude) to generate daily briefs, summarise bills, and verify political claims. AI-generated content is clearly labelled throughout the app.\n\nWhen you use the "Verify a Claim" feature, the claim text and relevant voting data are sent to Anthropic\'s API for analysis. No personal information (name, email, postcode) is included in AI requests.\n\nWe do not use your personal data to train AI models. Anthropic\'s data retention policy applies to API requests: see anthropic.com/privacy.'}
        />
        <Section
          title="Cross-Border Data Transfers"
          body={'Your data is processed and stored using services based outside Australia:\n\n• Supabase (database & authentication) — servers in the United States\n• Anthropic (AI features) — servers in the United States\n• Expo / EAS (app delivery & push notifications) — servers in the United States\n• Apple (Sign-In with Apple) — servers in the United States and Ireland\n\nBy using Verity, you consent to your data being transferred to and processed in these jurisdictions. Each provider maintains security practices consistent with Australian Privacy Principle 8 (cross-border disclosure). We have assessed each provider\'s privacy and security practices.'}
        />
        <Section
          title="Third-Party Services"
          body={'Verity integrates the following third-party services, each with their own privacy policy:\n\n• Supabase (supabase.com/privacy) — database, authentication, Edge Functions\n• Anthropic (anthropic.com/privacy) — AI text generation\n• Expo (expo.dev/privacy) — app delivery, OTA updates, push notifications\n• Apple (apple.com/privacy) — Sign-In with Apple\n\nWe do not share your personal information with advertisers or data brokers.'}
        />
        <Section
          title="Data Retention"
          body="You can delete your account and all associated data at any time from the Profile screen. Postcode, preferences, and community posts are deleted immediately. Anonymised usage analytics may be retained for up to 12 months. Push notification tokens are deactivated on account deletion."
        />
        <Section
          title="Children's Privacy"
          body="Verity is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, contact privacy@verity.au."
        />
        <Section
          title="Your Rights"
          body={'Under the Australian Privacy Act 1988, you have the right to:\n\n• Access your personal information\n• Request correction of inaccurate information\n• Request deletion of your data\n• Complain to the Office of the Australian Information Commissioner (OAIC)\n\nTo exercise these rights, email privacy@verity.au. We will respond within 30 days.'}
        />
        <Section
          title="Changes to This Policy"
          body="We may update this policy from time to time. Material changes will be communicated via an in-app notification. Continued use of Verity after changes constitutes acceptance of the updated policy."
        />
        <Section
          title="Contact"
          body="Callum McCaffrey, Sydney, NSW, Australia. Email: privacy@verity.au."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
