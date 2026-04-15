import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

export function AboutScreen({ navigation }: any) {
  const { colors } = useTheme();

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>About Verity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: '#E8F5EE' }]}>
            <Ionicons name="leaf-outline" size={40} color="#00843D" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Verity</Text>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>Version {version}</Text>
          <Text style={[styles.builtIn, { color: colors.textMuted }]}>Built in Sydney, Australia 🇦🇺</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Mission */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Our Mission</Text>
          <Text style={[styles.body, { color: colors.textBody }]}>
            Verity is an independent civic intelligence platform. We believe every Australian deserves to understand what their elected representatives are doing and why it matters to them.
          </Text>
          <Text style={[styles.body, { color: colors.textBody, marginTop: 10 }]}>
            We are not affiliated with any political party, government entity, or media organisation.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Data sources */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Sources</Text>
          {[
            ['library-outline', 'Australian Parliament House (APH)', 'Bills, votes, and member records'],
            ['people-outline', 'Australian Electoral Commission (AEC)', 'Electorates and election data'],
            ['checkmark-circle-outline', 'TheyVoteForYou', 'Voting records and divisions'],
            ['globe-outline', 'OpenAustralia', 'Parliamentary data and debates'],
            ['newspaper-outline', 'NewsAPI', 'News coverage and media analysis'],
          ].map(([icon, name, desc]) => (
            <View key={name} style={styles.sourceRow}>
              <View style={[styles.sourceIcon, { backgroundColor: colors.surface }]}>
                <Ionicons name={icon as any} size={18} color="#00843D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceName, { color: colors.text }]}>{name}</Text>
                <Text style={[styles.sourceDesc, { color: colors.textMuted }]}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Contact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Get in Touch</Text>
          <Pressable
            style={[styles.linkRow, { backgroundColor: colors.surface }]}
            onPress={() => Linking.openURL('https://verity.au')}
          >
            <Ionicons name="globe-outline" size={20} color="#00843D" />
            <Text style={[styles.linkText, { color: colors.text }]}>verity.au</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.linkRow, { backgroundColor: colors.surface }]}
            onPress={() => Linking.openURL('mailto:hello@verity.au')}
          >
            <Ionicons name="mail-outline" size={20} color="#00843D" />
            <Text style={[styles.linkText, { color: colors.text }]}>hello@verity.au</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Built with care for Australian democracy 🌿
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 48, gap: 0 },
  logoSection: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  appName: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  versionText: { fontSize: 14 },
  builtIn: { fontSize: 13, marginTop: 4 },
  divider: { height: 1, marginVertical: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sourceIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  sourceName: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  sourceDesc: { fontSize: 12, lineHeight: 18, marginTop: 1 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
  footerText: { fontSize: 13, textAlign: 'center', marginTop: 32, lineHeight: 20 },
});
