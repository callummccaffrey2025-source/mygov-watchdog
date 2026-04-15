import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = '28 March 2026';

export function TermsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#1a2332" />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Agreement">
          By using Verity, you agree to these Terms of Service. If you do not agree, please do
          not use the app. These terms apply to all users, including verified parliamentary officials.
        </Section>

        <Section title="About Verity">
          Verity is a civic information platform providing access to publicly available
          Australian federal parliamentary data. We aim to make parliamentary proceedings more
          accessible and understandable to all Australians. Verity is not affiliated with or
          endorsed by the Australian Parliament House or any political party.
        </Section>

        <Section title="Accuracy of information">
          Parliamentary data displayed in Verity is sourced from public records and provided
          for informational purposes only. While we strive for accuracy, we make no warranty
          that information is complete, current, or error-free. Do not rely on Verity as your
          sole source for legal or political decisions.
        </Section>

        <Section title="User accounts">
          You must be 13 years or older to create an account. You are responsible for
          maintaining the security of your account. You agree not to share your authentication
          credentials or impersonate another person.
        </Section>

        <Section title="Acceptable use">
          You agree not to:
          {'\n'}• Post content that is defamatory, harassing, or threatening
          {'\n'}• Impersonate any person, including a member of parliament
          {'\n'}• Attempt to falsely claim a parliamentary profile that is not yours
          {'\n'}• Use the app to spread deliberate misinformation about parliamentary proceedings
          {'\n'}• Attempt to interfere with the app's infrastructure or security
        </Section>

        <Section title="Verified officials">
          Parliamentary officials who claim their profile via the verification process agree to
          post only accurate information and to represent themselves truthfully. Verity reserves
          the right to revoke verified status at any time if these conditions are not met.
          Verified status is granted based on parliamentary email ownership and does not
          constitute endorsement of any political position.
        </Section>

        <Section title="User-generated content">
          You retain ownership of content you post. By posting, you grant Verity a non-exclusive
          licence to display that content within the app. We reserve the right to remove content
          that violates these terms without notice.
        </Section>

        <Section title="Limitation of liability">
          To the maximum extent permitted by Australian law, Verity is provided "as is" without
          warranty of any kind. We are not liable for any loss or damage arising from your use
          of the app, including reliance on information displayed.
        </Section>

        <Section title="Governing law">
          These terms are governed by the laws of the Australian Capital Territory, Australia.
        </Section>

        <Section title="Contact">
          For questions about these terms, contact us at{' '}
          <Text style={styles.link}>legal@verity.au</Text>.
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <Text style={sectionStyles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  back: { padding: 20, paddingBottom: 0 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a2332', marginBottom: 4 },
  updated: { fontSize: 13, color: '#9aabb8', marginBottom: 24 },
  link: { color: '#00843D', fontWeight: '500' },
});

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '700', color: '#1a2332', marginBottom: 8 },
  body: { fontSize: 15, color: '#3a4a5a', lineHeight: 22 },
});
