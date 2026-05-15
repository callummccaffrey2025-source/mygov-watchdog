import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PartyBadge } from './PartyBadge';
import { Member } from '../hooks/useMembers';

interface Props {
  member: Member;
  onPress?: () => void;
  compact?: boolean;
}

export const MemberCard = React.memo(function MemberCard({ member, onPress, compact }: Props) {
  const party = member.party;
  const partyColour = party?.colour || '#9aabb8';
  const displayName = `${member.first_name} ${member.last_name}`;

  return (
    <Pressable style={[styles.card, compact && styles.compact]} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: partyColour + '33' }]}>
        {member.photo_url ? (
          <Image source={{ uri: member.photo_url }} style={styles.photo} />
        ) : (
          <Text style={[styles.initials, { color: partyColour }]}>
            {member.first_name[0]}{member.last_name[0]}
          </Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        {party && <PartyBadge name={party.short_name || party.abbreviation} colour={party.colour} size="sm" />}
        {member.electorate && !compact && (
          <Text style={styles.electorate} numberOfLines={1}>{member.electorate.name}</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  compact: { padding: 8, marginBottom: 6 },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  photo: { width: 52, height: 52 },
  initials: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '600', color: '#1a2332' },
  electorate: { fontSize: 12, color: '#9aabb8', marginTop: 2 },
});
