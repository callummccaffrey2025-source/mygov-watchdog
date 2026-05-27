/**
 * HeadlineComparison — Side-by-side headline comparison from left/center/right sources.
 *
 * Fetches articles for a given story and groups them by source bias leaning,
 * showing how different outlets frame the same story.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
}

interface ArticleWithSource {
  id: number;
  title: string;
  source_name: string;
  leaning: string | null;
  bias_score: number | null;
}

type LeaningBucket = 'left' | 'center' | 'right';

const LEANING_CONFIG: Record<LeaningBucket, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  left: { label: 'Left-leaning', color: '#2563EB', icon: 'arrow-back-circle-outline' },
  center: { label: 'Centre', color: '#6B7280', icon: 'remove-circle-outline' },
  right: { label: 'Right-leaning', color: '#DC3545', icon: 'arrow-forward-circle-outline' },
};

function classifyLeaning(leaning: string | null, biasScore: number | null): LeaningBucket | null {
  if (leaning) {
    const l = leaning.toLowerCase();
    if (l.includes('left')) return 'left';
    if (l.includes('right')) return 'right';
    if (l.includes('cent') || l.includes('neutral') || l.includes('least')) return 'center';
  }
  if (biasScore !== null) {
    if (biasScore < -0.2) return 'left';
    if (biasScore > 0.2) return 'right';
    return 'center';
  }
  return null;
}

export function HeadlineComparison({ storyId }: Props) {
  const { colors } = useTheme();
  const [articles, setArticles] = useState<ArticleWithSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Get article IDs for this story
        const { data: junctionRows } = await supabase
          .from('news_story_articles')
          .select('article_id')
          .eq('story_id', storyId);

        const articleIds = (junctionRows || []).map((r: any) => r.article_id);
        if (articleIds.length === 0) {
          if (!cancelled) {
            setArticles([]);
            setLoading(false);
          }
          return;
        }

        // Fetch articles with source info
        const { data: articlesData } = await supabase
          .from('news_articles')
          .select('id, title, news_sources(name, leaning, bias_score)')
          .in('id', articleIds)
          .limit(30);

        if (!cancelled) {
          const mapped: ArticleWithSource[] = ((articlesData || []) as any[]).map((a) => {
            const source = a.news_sources;
            return {
              id: a.id,
              title: a.title || '',
              source_name: source?.name || 'Unknown',
              leaning: source?.leaning || null,
              bias_score: source?.bias_score ?? null,
            };
          });
          setArticles(mapped);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setArticles([]);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  if (loading) {
    return (
      <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  // Bucket articles by leaning
  const buckets: Record<LeaningBucket, ArticleWithSource[]> = { left: [], center: [], right: [] };
  for (const article of articles) {
    const bucket = classifyLeaning(article.leaning, article.bias_score);
    if (bucket) {
      buckets[bucket].push(article);
    }
  }

  // Need at least 2 buckets with articles to show a meaningful comparison
  const activeBuckets = (['left', 'center', 'right'] as LeaningBucket[]).filter(
    (b) => buckets[b].length > 0
  );
  if (activeBuckets.length < 2) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <Ionicons name="newspaper-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            Headline comparison
          </Text>
        </View>
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
          Not enough sources with known bias ratings to compare headlines.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: SPACING.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
        <Ionicons name="newspaper-outline" size={18} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
          Headline comparison
        </Text>
      </View>

      {/* Columns */}
      {activeBuckets.map((bucket) => {
        const config = LEANING_CONFIG[bucket];
        const topArticle = buckets[bucket][0];
        const extraCount = buckets[bucket].length - 1;

        return (
          <View
            key={bucket}
            style={{
              backgroundColor: colors.card,
              borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg,
              marginBottom: SPACING.sm,
              borderLeftWidth: 3,
              borderLeftColor: config.color,
              ...SHADOWS.sm,
            }}
          >
            {/* Bias badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <Ionicons name={config.icon} size={14} color={config.color} />
              <View style={{
                backgroundColor: config.color + '18',
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.sm,
                paddingVertical: 2,
              }}>
                <Text style={{
                  fontSize: FONT_SIZE.caption,
                  fontWeight: FONT_WEIGHT.bold,
                  color: config.color,
                  letterSpacing: 0.3,
                }}>
                  {config.label.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Source name */}
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.semibold,
              color: colors.textMuted,
              marginBottom: SPACING.xs,
            }}>
              {topArticle.source_name}
            </Text>

            {/* Headline */}
            <Text style={{
              fontSize: FONT_SIZE.body,
              fontWeight: FONT_WEIGHT.semibold,
              color: colors.text,
              lineHeight: 21,
            }}>
              {decodeHtml(topArticle.title)}
            </Text>

            {/* Extra count */}
            {extraCount > 0 && (
              <Text style={{
                fontSize: FONT_SIZE.caption,
                color: colors.textMuted,
                marginTop: SPACING.sm,
              }}>
                + {extraCount} more {extraCount === 1 ? 'source' : 'sources'}
              </Text>
            )}
          </View>
        );
      })}

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs }}>
        <Ionicons name="information-circle-outline" size={10} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          Bias ratings from Media Bias/Fact Check. Compare how different outlets frame the same story.
        </Text>
      </View>
    </View>
  );
}
