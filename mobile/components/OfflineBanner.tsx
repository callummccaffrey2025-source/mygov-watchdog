import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={{ width: '100%', backgroundColor: '#FEF2F2', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16, marginRight: 8 }}>📡</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#991B1B' }}>You're offline — showing cached content</Text>
    </View>
  );
}
