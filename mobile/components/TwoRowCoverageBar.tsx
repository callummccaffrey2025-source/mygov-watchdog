/**
 * TwoRowCoverageBar — Verity's answer to Ground News.
 *
 * Top row: political lean (L / C / R) with a Ground News-style warm palette.
 * Bottom row: Australian ownership (News Corp / Nine / ABC / Seven West / Independent).
 *
 * The ownership row is the distinctly Australian layer that Ground News doesn't ship:
 * concentration in the Australian media is the defining media-literacy fact of this country,
 * and it matters more day-to-day than bias for most stories.
 *
 * Input: an array of articles (or article-shaped objects) that each carry a source.leaning
 * and source.owner. The component buckets owners into five broad groups; null/unknown
 * owners fall into Independent by design (most independent Australian outlets don't have
 * an owner string in the sources table).
 */
import React from 'react';
import { View, Text } from 'react-native';

interface ArticleLike {
  source?: {
    leaning?: string | null;
    owner?: string | null;
  } | null;
}

interface Props {
  articles: ArticleLike[];
  height?: number;
  showLabels?: boolean;
}

const BIAS_COLORS = {
  left: '#B8342A',
  center: '#9AA3AB',
  right: '#2C4F8C',
};

const OWNER_COLORS = {
  'News Corp': '#8B0000',
  'Nine': '#003A70',
  'ABC': '#FF6600',
  'Seven West': '#4A2B6B',
  'Independent': '#2F7A2F',
} as const;

type OwnerKey = keyof typeof OWNER_COLORS;
const OWNER_ORDER: OwnerKey[] = ['News Corp', 'Nine', 'ABC', 'Seven West', 'Independent'];

function classifyOwner(raw: string | null | undefined): OwnerKey {
  if (!raw) return 'Independent';
  const o = raw.toLowerCase();
  if (o.includes('news corp') || o.includes('newscorp')) return 'News Corp';
  if (o.includes('nine') || o.includes('fairfax')) return 'Nine';
  if (o.includes('abc') || o.includes('australian broadcasting')) return 'ABC';
  if (o.includes('seven')) return 'Seven West';
  return 'Independent';
}

function classifyBias(leaning: string | null | undefined): keyof typeof BIAS_COLORS {
  if (!leaning) return 'center';
  if (leaning === 'left' || leaning === 'center-left') return 'left';
  if (leaning === 'right' || leaning === 'center-right') return 'right';
  return 'center';
}

export function TwoRowCoverageBar({ articles, height = 8, showLabels = true }: Props) {
  const total = articles.length;

  const bias = { left: 0, center: 0, right: 0 };
  const owner: Record<OwnerKey, number> = {
    'News Corp': 0, 'Nine': 0, 'ABC': 0, 'Seven West': 0, 'Independent': 0,
  };

  for (const a of articles) {
    bias[classifyBias(a.source?.leaning)]++;
    owner[classifyOwner(a.source?.owner)]++;
  }

  if (total === 0) {
    return (
      <View style={{ gap: 4 }}>
        <View style={{ height, borderRadius: 3, backgroundColor: '#E5E7EB' }} />
        <View style={{ height, borderRadius: 3, backgroundColor: '#E5E7EB' }} />
        {showLabels && (
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>No coverage yet</Text>
        )}
      </View>
    );
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <View style={{ gap: 4 }}>
      {/* Row 1 — Political lean */}
      <View
        style={{
          flexDirection: 'row', height, borderRadius: 3, overflow: 'hidden',
          backgroundColor: '#E5E7EB',
        }}
      >
        {bias.left > 0 && <View style={{ flex: bias.left, backgroundColor: BIAS_COLORS.left }} />}
        {bias.center > 0 && <View style={{ flex: bias.center, backgroundColor: BIAS_COLORS.center }} />}
        {bias.right > 0 && <View style={{ flex: bias.right, backgroundColor: BIAS_COLORS.right }} />}
      </View>

      {/* Row 2 — Ownership */}
      <View
        style={{
          flexDirection: 'row', height, borderRadius: 3, overflow: 'hidden',
          backgroundColor: '#E5E7EB',
        }}
      >
        {OWNER_ORDER.map(k =>
          owner[k] > 0 ? (
            <View key={k} style={{ flex: owner[k], backgroundColor: OWNER_COLORS[k] }} />
          ) : null
        )}
      </View>

      {showLabels && (
        <View style={{ marginTop: 6, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#4B5563', letterSpacing: 0.3 }}>
              L {pct(bias.left)}%
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#4B5563', letterSpacing: 0.3 }}>
              C {pct(bias.center)}%
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#4B5563', letterSpacing: 0.3 }}>
              R {pct(bias.right)}%
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {OWNER_ORDER.filter(k => owner[k] > 0).map(k => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: OWNER_COLORS[k] }} />
                <Text style={{ fontSize: 10, color: '#4B5563' }}>
                  {k} {pct(owner[k])}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
