import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { LAYOUT } from '../../theme/tokens';

interface PaperProps {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}

export function Paper({ children, scroll, edges = ['top'] }: PaperProps) {
  const c = useEditorialTheme();

  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={edges}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPadding, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={edges}>
      <View style={{ flex: 1, paddingHorizontal: LAYOUT.screenPadding }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
