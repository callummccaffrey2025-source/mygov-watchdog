/**
 * ContradictionShareCard — Rendered offscreen at 360x640 (9:16) and captured
 * as PNG via react-native-view-shot. At 3x device density -> 1080x1920.
 *
 * Follows the exact pattern in ShareCards.tsx.
 */
import React from 'react';
import { View, Text } from 'react-native';

const GREEN = '#00843D';
const RED   = '#DC3545';
const DARK  = '#1a2332';
const GREY  = '#9aabb8';
const CARD_W = 360;
const CARD_H = 640;

interface Props {
  mpName: string;
  partyName: string;
  claimText: string;
  contraText: string;
  claimDate: string | null;
  contraDate: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ContradictionShareCard({
  mpName, partyName, claimText, contraText, claimDate, contraDate,
}: Props) {
  return (
    <View style={{
      width: CARD_W,
      height: CARD_H,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
    }}>
      {/* Green header bar */}
      <View style={{
        backgroundColor: GREEN,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: '#FFFFFF22',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>V</Text>
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 }}>VERITY</Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF99', letterSpacing: 1 }}>CONTRADICTION DETECTED</Text>
        </View>
      </View>

      {/* MP identity */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: DARK }}>{mpName}</Text>
        {partyName ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: GREY, marginTop: 2 }}>{partyName}</Text>
        ) : null}
      </View>

      {/* What they said */}
      <View style={{
        marginHorizontal: 24,
        marginBottom: 12,
        backgroundColor: '#FDECEA',
        borderRadius: 12,
        padding: 16,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: RED, letterSpacing: 0.5, marginBottom: 6 }}>
          WHAT THEY SAID
        </Text>
        <Text style={{ fontSize: 14, color: DARK, lineHeight: 20 }} numberOfLines={4}>
          "{claimText}"
        </Text>
        {claimDate ? (
          <Text style={{ fontSize: 11, color: GREY, marginTop: 6 }}>{formatDate(claimDate)}</Text>
        ) : null}
      </View>

      {/* What the record shows */}
      <View style={{
        marginHorizontal: 24,
        marginBottom: 16,
        backgroundColor: '#E8F5EE',
        borderRadius: 12,
        padding: 16,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: GREEN, letterSpacing: 0.5, marginBottom: 6 }}>
          WHAT THE RECORD SHOWS
        </Text>
        <Text style={{ fontSize: 14, color: DARK, lineHeight: 20 }} numberOfLines={4}>
          "{contraText}"
        </Text>
        {contraDate ? (
          <Text style={{ fontSize: 11, color: GREY, marginTop: 6 }}>{formatDate(contraDate)}</Text>
        ) : null}
      </View>

      {/* Footer */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#F8F9FB',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: DARK, marginBottom: 4 }}>
          Verified by Verity
        </Text>
        <Text style={{ fontSize: 11, color: GREY }}>verity.au</Text>
      </View>
    </View>
  );
}
