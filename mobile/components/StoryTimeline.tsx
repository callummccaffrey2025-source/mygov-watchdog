/**
 * StoryTimeline — Vertical timeline showing the full arc of a political story.
 *
 * Pulls bill changes, Hansard speeches, division votes, and related news
 * coverage into a single chronological view. Returns null when no timeline
 * events exist (silent pattern, same as ReceiptsBlock).
 */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStoryTimeline, TimelineEvent } from '../hooks/useStoryTimeline';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

interface Props {
  storyId: number;
  onPressBill?: (billId: string) => void;
  onPressMember?: (memberId: string) => void;
  onPressStory?: (storyId: number) => void;
}

// ── Color + label mappings ───────────────────────────────────────────────────

const DOT_COLORS: Record<TimelineEvent['type'], string> = {
  bill_introduced: '#00843D',
  bill_status_change: '#2563EB',
  hansard_speech: '#7C3AED',
  division_vote: '#D97706',
  news_coverage: '#6B7280',
  bill_passed: '#22C55E',
  bill_defeated: '#DC3545',
};

const BADGE_LABELS: Record<TimelineEvent['type'], string> = {
  bill_introduced: 'Bill',
  bill_status_change: 'Bill',
  hansard_speech: 'Speech',
  division_vote: 'Vote',
  news_coverage: 'News',
  bill_passed: 'Bill',
  bill_defeated: 'Bill',
};

// ── Helper: format gap between two dates ─────────────────────────────────────

function formatGap(dateA: string, dateB: string): string | null {
  const msA = new Date(dateA).getTime();
  const msB = new Date(dateB).getTime();
  const diffDays = Math.floor((msB - msA) / (1000 * 60 * 60 * 24));

  if (diffDays < 7) return null; // only show gaps >= 7 days
  if (diffDays === 7) return '1 week later';
  if (diffDays < 14) return `${diffDays} days later`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} later`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} later`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} later`;
}

// ── Helper: smart date formatting ────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return timeAgo(dateStr);
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Helper: is today the latest event ────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function StoryTimeline({ storyId, onPressBill, onPressMember, onPressStory }: Props) {
  const { colors } = useTheme();
  const { events, loading } = useStoryTimeline(storyId);
  const [expanded, setExpanded] = useState(false);

  // Silent when no events — same pattern as ReceiptsBlock
  if (loading) return null;
  if (events.length === 0) return null;

  // Collapse logic: if >5 events, show first 3 + last 2 unless expanded
  const shouldCollapse = events.length > 5 && !expanded;
  const visibleEvents = shouldCollapse
    ? [...events.slice(0, 3), ...events.slice(-2)]
    : events;
  const hiddenCount = events.length - 5;

  const handleEventPress = (event: TimelineEvent) => {
    if ((event.type === 'bill_introduced' || event.type === 'bill_status_change' || event.type === 'bill_passed' || event.type === 'bill_defeated') && event.metadata.billId) {
      onPressBill?.(event.metadata.billId);
    } else if (event.type === 'hansard_speech' && event.metadata.memberId) {
      onPressMember?.(event.metadata.memberId);
    } else if (event.type === 'news_coverage' && event.metadata.storyId) {
      onPressStory?.(event.metadata.storyId);
    }
  };

  const lastEvent = events[events.length - 1];
  const showTodayMarker = lastEvent && isToday(lastEvent.date);

  return (
    <View style={{ marginBottom: SPACING.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
        <Ionicons name="time-outline" size={18} color={colors.green} />
        <Text style={{
          fontSize: FONT_SIZE.title,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
        }}>
          Story timeline
        </Text>
      </View>

      {/* Timeline */}
      {visibleEvents.map((event, idx) => {
        const dotColor = DOT_COLORS[event.type];
        const badgeLabel = BADGE_LABELS[event.type];
        const isLast = idx === visibleEvents.length - 1;
        const isTodayEvent = showTodayMarker && isLast && expanded || (showTodayMarker && isLast && !shouldCollapse);

        // Gap label: compute from original event order
        // For collapsed view, don't show gap between item 2 (idx=2) and item 3 (idx=3) since those are non-contiguous
        let gapLabel: string | null = null;
        if (idx > 0) {
          if (shouldCollapse && idx === 3) {
            // Gap between first visible block and last visible block
            gapLabel = null; // The expand button will sit here
          } else {
            // Find the actual previous event in the original array
            let prevEvent: TimelineEvent | undefined;
            if (shouldCollapse && idx < 3) {
              prevEvent = events[idx - 1];
            } else if (shouldCollapse && idx >= 3) {
              // idx 3 = events[events.length - 2], idx 4 = events[events.length - 1]
              const origIdx = events.length - (5 - idx);
              prevEvent = events[origIdx - 1];
            } else {
              prevEvent = events[idx - 1];
            }
            if (prevEvent) {
              gapLabel = formatGap(prevEvent.date, event.date);
            }
          }
        }

        return (
          <React.Fragment key={event.id}>
            {/* Gap label between events */}
            {gapLabel && (
              <View style={{ flexDirection: 'row', marginBottom: SPACING.sm }}>
                <View style={{ width: 24, alignItems: 'center' }}>
                  <View style={{ width: 1, flex: 1, backgroundColor: colors.border }} />
                </View>
                <View style={{ flex: 1, paddingLeft: SPACING.md, paddingVertical: SPACING.xs }}>
                  <Text style={{
                    fontSize: FONT_SIZE.caption - 1,
                    fontWeight: FONT_WEIGHT.medium,
                    color: colors.textMuted,
                    fontStyle: 'italic',
                  }}>
                    {gapLabel}
                  </Text>
                </View>
              </View>
            )}

            {/* Expand button (between collapsed groups) */}
            {shouldCollapse && idx === 3 && (
              <Pressable
                onPress={() => setExpanded(true)}
                style={{ flexDirection: 'row', marginBottom: SPACING.md }}
              >
                <View style={{ width: 24, alignItems: 'center' }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: colors.border, marginTop: 6,
                  }} />
                  <View style={{ width: 1, flex: 1, backgroundColor: colors.border, marginTop: SPACING.xs }} />
                </View>
                <View style={{
                  flex: 1,
                  paddingLeft: SPACING.md,
                  paddingVertical: SPACING.xs,
                }}>
                  <Text style={{
                    fontSize: FONT_SIZE.small,
                    fontWeight: FONT_WEIGHT.semibold,
                    color: colors.green,
                  }}>
                    Show full timeline ({hiddenCount} more event{hiddenCount > 1 ? 's' : ''})
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Event row */}
            <Pressable
              onPress={() => handleEventPress(event)}
              style={{ flexDirection: 'row', marginBottom: isLast ? 0 : SPACING.md }}
            >
              {/* Timeline column: dot + line */}
              <View style={{ width: 24, alignItems: 'center' }}>
                {isTodayEvent ? (
                  <View style={{
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: '#00843D',
                    marginTop: 3,
                    borderWidth: 2,
                    borderColor: '#00843D40',
                  }} />
                ) : (
                  <View style={{
                    width: 12, height: 12, borderRadius: 6,
                    backgroundColor: dotColor,
                    marginTop: 4,
                  }} />
                )}
                {!isLast && (
                  <View style={{
                    width: 1,
                    flex: 1,
                    backgroundColor: colors.border,
                    marginTop: SPACING.xs,
                    minHeight: 24,
                  }} />
                )}
              </View>

              {/* Content column */}
              <View style={{ flex: 1, paddingLeft: SPACING.md, paddingBottom: SPACING.xs }}>
                {/* Type badge + date row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
                  <View style={{
                    backgroundColor: dotColor + '18',
                    borderRadius: BORDER_RADIUS.sm,
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 2,
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZE.caption - 1,
                      fontWeight: FONT_WEIGHT.bold,
                      color: dotColor,
                      letterSpacing: 0.4,
                    }}>
                      {badgeLabel.toUpperCase()}
                    </Text>
                  </View>
                  {isTodayEvent && (
                    <View style={{
                      backgroundColor: '#00843D18',
                      borderRadius: BORDER_RADIUS.sm,
                      paddingHorizontal: SPACING.sm,
                      paddingVertical: 2,
                    }}>
                      <Text style={{
                        fontSize: FONT_SIZE.caption - 1,
                        fontWeight: FONT_WEIGHT.bold,
                        color: '#00843D',
                        letterSpacing: 0.4,
                      }}>
                        TODAY
                      </Text>
                    </View>
                  )}
                  <Text style={{
                    fontSize: FONT_SIZE.caption,
                    color: colors.textMuted,
                    marginLeft: 'auto',
                  }}>
                    {formatEventDate(event.date)}
                  </Text>
                </View>

                {/* Title */}
                <Text
                  style={{
                    fontSize: FONT_SIZE.body,
                    fontWeight: FONT_WEIGHT.semibold,
                    color: colors.text,
                    lineHeight: 21,
                  }}
                  numberOfLines={2}
                >
                  {decodeHtml(event.title)}
                </Text>

                {/* Description */}
                {event.description ? (
                  <Text
                    style={{
                      fontSize: FONT_SIZE.caption,
                      color: colors.textBody,
                      lineHeight: 16,
                      marginTop: SPACING.xs,
                    }}
                    numberOfLines={2}
                  >
                    {decodeHtml(event.description)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}
