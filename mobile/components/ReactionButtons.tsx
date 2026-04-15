import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  likes: number;
  dislikes: number;
  userReaction?: 'like' | 'dislike' | null;
  onLike?: () => void;
  onDislike?: () => void;
  requiresAuth?: boolean;
}

export function ReactionButtons({ likes, dislikes, userReaction, onLike, onDislike }: Props) {
  return (
    <View style={styles.container}>
      <Pressable style={[styles.btn, userReaction === 'like' && styles.activeBtn]} onPress={onLike}>
        <Ionicons name={userReaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={userReaction === 'like' ? '#00843D' : '#9aabb8'} />
        <Text style={[styles.count, userReaction === 'like' && styles.activeCount]}>{likes}</Text>
      </Pressable>
      <Pressable style={[styles.btn, userReaction === 'dislike' && styles.dislikeBtn]} onPress={onDislike}>
        <Ionicons name={userReaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={18} color={userReaction === 'dislike' ? '#d32f2f' : '#9aabb8'} />
        <Text style={[styles.count, userReaction === 'dislike' && styles.dislikeCount]}>{dislikes}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: '#f8f9fa' },
  activeBtn: { backgroundColor: '#e8f5ee' },
  dislikeBtn: { backgroundColor: '#fdecea' },
  count: { fontSize: 13, color: '#9aabb8', fontWeight: '500' },
  activeCount: { color: '#00843D' },
  dislikeCount: { color: '#d32f2f' },
});
