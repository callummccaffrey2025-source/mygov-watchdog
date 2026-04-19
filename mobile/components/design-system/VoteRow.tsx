import React from 'react';
import { View, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface VoteRowProps {
  title: string;
  date: string;
  vote: 'aye' | 'no';
  context?: string;
}

export function VoteRow({ title, date, vote, context }: VoteRowProps) {
  const c = useEditorialTheme();
  const voteColor = vote === 'aye' ? c.semanticAye : c.semanticNo;

  return (
    <View style={{ flexDirection: 'row', paddingVertical: SPACE.sm, gap: SPACE.md }}>
      {/* Left: bill title + date */}
      <View style={{ flex: 1 }}>
        <Text style={{ ...TYPE.h3, color: c.textPrimary }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ ...TYPE.meta, color: c.textTertiary, marginTop: SPACE.xxs }}>
          {date}
        </Text>
      </View>

      {/* Right: vote + context */}
      <View style={{ alignItems: 'flex-end', justifyContent: 'center', minWidth: 48 }}>
        <Text style={{ ...TYPE.label, color: voteColor, fontWeight: '500' }}>
          {vote === 'aye' ? 'Aye' : 'No'}
        </Text>
        {context ? (
          <Text style={{ ...TYPE.caption, color: c.textTertiary, marginTop: 2 }}>
            {context}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
