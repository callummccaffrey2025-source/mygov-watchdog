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
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Last updated: April 2026</Text>

        <Section
          title="What Verity Collects"
          body="Verity collects your postcode to match you with your federal electorate and local MP. If you create an account, we store your email address. We collect anonymous usage analytics to improve the app. We do not sell your data to anyone."
        />
        <Section
          title="How We Use Your Data"
          body="Your postcode powers your personalised Daily Brief, MP updates, and community feed. Your email is used only for account authentication and critical service updates. Usage analytics help us understand which features matter most."
        />
        <Section
          title="AI Features"
          body="Verity uses AI (powered by Anthropic's Claude) to generate daily briefs, summarise bills, and verify political claims. AI-generated content is clearly labelled. We do not use your personal data to train AI models."
        />
        <Section
          title="Third-Party Services"
          body="Verity uses Supabase for database and authentication, Expo for app delivery, and Anthropic for AI features. Each service has its own privacy policy. We do not share your personal information with advertisers."
        />
        <Section
          title="Data Retention"
          body="You can delete your account and all associated data at any time from the Profile screen. Postcode and preference data is deleted immediately. Anonymised analytics may be retained for up to 12 months."
        />
        <Section
          title="Your Rights"
          body="Under the Australian Privacy Act 1988, you have the right to access, correct, or delete your personal information. Contact privacy@verity.run for any requests."
        />
        <Section
          title="Contact"
          body="Verity is operated by Callum in Sydney, Australia. For privacy questions, email privacy@verity.run."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
