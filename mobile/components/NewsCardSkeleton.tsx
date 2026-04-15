import React from 'react';
import { View } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

export function NewsCardSkeleton() {
  return (
    <View style={{ flexDirection: 'row', padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#F9FAFB', gap: 12 }}>
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader width="85%" height={14} borderRadius={6} />
        <SkeletonLoader width="65%" height={14} borderRadius={6} />
        <SkeletonLoader width="40%" height={12} borderRadius={6} />
      </View>
      <SkeletonLoader width={80} height={80} borderRadius={10} />
    </View>
  );
}
