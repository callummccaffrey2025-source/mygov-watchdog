/**
 * Premium MP Report Card — designed for Instagram sharing (1080×1350 at 3×).
 * Rendered offscreen at 360×450 and captured via react-native-view-shot.
 */
import React from 'react';
import { View, Text, Image } from 'react-native';

const W = 360;
const H = 450;
const GREEN = '#00843D';

interface Props {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  electorateName: string | null;
  /** @deprecated retained for call-site compatibility; not rendered */
  accountabilityScore?: number;
  attendance: number;
  totalVotes: number;
  speeches: number;
  partyLoyalty: number;
  topDonors: { name: string; amount: number }[];
}

export function MPReportShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, electorateName,
  attendance, totalVotes, speeches, partyLoyalty,
  topDonors,
}: Props) {
  return (
    <View style={{ width: W, height: H, backgroundColor: '#FFFFFF' }}>
      {/* Green header bar */}
      <View style={{ height: 56, backgroundColor: GREEN, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#ffffff20', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>V</Text>
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 1 }}>VERITY</Text>
            <Text style={{ fontSize: 8, fontWeight: '500', color: '#ffffffaa', letterSpacing: 0.5 }}>PARTICIPATION INDEX</Text>
          </View>
        </View>
      </View>

      {/* MP identity section */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 12 }}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: partyColour }} />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: partyColour + '22', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: partyColour }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: partyColour }}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginTop: 8 }}>{mpName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={{ backgroundColor: partyColour + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: partyColour }}>{partyName}</Text>
          </View>
          {electorateName && <Text style={{ fontSize: 11, color: '#6B7280' }}>{electorateName}</Text>}
        </View>
      </View>

      {/* Participation dimensions — no composite score by design */}
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8 }}>PARLIAMENTARY PARTICIPATION</Text>
      </View>

      {/* Stats grid — 2×2 */}
      <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A2E' }}>{attendance}%</Text>
            <Text style={{ fontSize: 9, fontWeight: '500', color: '#6B7280', marginTop: 2 }}>ATTENDANCE</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A2E' }}>{totalVotes}</Text>
            <Text style={{ fontSize: 9, fontWeight: '500', color: '#6B7280', marginTop: 2 }}>VOTES CAST</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A2E' }}>{speeches}</Text>
            <Text style={{ fontSize: 9, fontWeight: '500', color: '#6B7280', marginTop: 2 }}>SPEECHES</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A2E' }}>{partyLoyalty}%</Text>
            <Text style={{ fontSize: 9, fontWeight: '500', color: '#6B7280', marginTop: 2 }}>PARTY LOYALTY</Text>
          </View>
        </View>
      </View>

      {/* Top donors */}
      {topDonors.length > 0 && (
        <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 }}>TOP DONORS</Text>
          {topDonors.slice(0, 3).map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#1A1A2E', flex: 1 }} numberOfLines={1}>{d.name}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A1A2E' }}>${d.amount.toLocaleString('en-AU')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, backgroundColor: '#F8F9FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Track your MP at</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: GREEN }}>verity.run</Text>
      </View>
    </View>
  );
}
