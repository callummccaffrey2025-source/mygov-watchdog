/**
 * MP Receipt — the viral share card. Designed to look like a shop receipt
 * that exposes what your MP actually did. Optimised for Instagram/X sharing.
 *
 * 360×640 at 3× density = 1080×1920 (9:16 story format).
 */
import React from 'react';
import { View, Text } from 'react-native';

const W = 360;
const H = 640;

interface ReceiptItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface Props {
  mpName: string;
  partyName: string;
  partyColour: string;
  electorateName: string;
  items: ReceiptItem[];
  publicTake?: string;
  publicTakeSource?: string;
  date: string;
}

export function MPReceiptCard({
  mpName,
  partyName,
  partyColour,
  electorateName,
  items,
  publicTake,
  publicTakeSource,
  date,
}: Props) {
  return (
    <View style={{
      width: W,
      height: H,
      backgroundColor: '#FFFEF7',
      paddingHorizontal: 28,
      paddingTop: 32,
      paddingBottom: 20,
    }}>
      {/* Header — receipt style */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 3, color: '#9CA3AF', textTransform: 'uppercase' }}>
          Verity Political Receipt
        </Text>
        <View style={{ width: 40, height: 2, backgroundColor: '#00843D', marginTop: 8, borderRadius: 1 }} />
      </View>

      {/* MP name block */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' }}>
          {mpName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <View style={{ backgroundColor: partyColour + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: partyColour }}>{partyName}</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>{electorateName}</Text>
        </View>
      </View>

      {/* Dotted divider */}
      <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', marginBottom: 16 }} />

      {/* Receipt items */}
      {items.map((item, i) => (
        <View key={i} style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: i < items.length - 1 ? 0.5 : 0,
          borderBottomColor: '#E5E7EB',
        }}>
          <Text style={{
            fontSize: 14,
            color: '#374151',
            fontWeight: '500',
            flex: 1,
          }}>
            {item.label}
          </Text>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: item.highlight ? '#DC3545' : '#1A1A2E',
            fontFamily: 'Courier',
          }}>
            {item.value}
          </Text>
        </View>
      ))}

      {/* Dotted divider */}
      <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', marginTop: 16, marginBottom: 16 }} />

      {/* Public take — the hook */}
      {publicTake && (
        <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
            What people are saying
          </Text>
          <Text style={{ fontSize: 13, color: '#374151', fontStyle: 'italic', lineHeight: 18 }} numberOfLines={3}>
            &ldquo;{publicTake}&rdquo;
          </Text>
          {publicTakeSource && (
            <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{publicTakeSource}</Text>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{date}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>V</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A1A2E', letterSpacing: 0.5 }}>VERITY</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#00843D', marginTop: 6 }}>
          See your MP's receipt at verity.au
        </Text>
      </View>
    </View>
  );
}
