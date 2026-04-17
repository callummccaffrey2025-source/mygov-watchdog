/**
 * VerityRealityCheck — the parliamentary layer beneath a news story.
 *
 * This is the feature no Australian news app ships and no overseas aggregator can:
 * for a given story, surface the actual bill(s) in parliament it refers to, and show
 * the user's own MP's recorded position on those bills. Media frames the story;
 * Verity shows what actually happened in the chamber.
 *
 * Matching strategy (lexical, fast, no AI):
 *   1. If the story has a category, pull up to 20 recent bills in that category.
 *   2. Also run an OR-ilike on bill title for up to 3 significant keywords from the headline.
 *   3. Score by keyword overlap, require a minimum threshold (avoids false positives), take top 2.
 *   4. If the user's MP has a recorded division vote whose name overlaps with a matched bill,
 *      surface that position.
 *
 * Returns null (renders nothing) when no bill match is confident enough — this is by design.
 * Better to be silent than to link a donation story to an unrelated bill.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useVotes } from '../hooks/useVotes';

interface RelatedBill {
  id: string;
  title: string;
  short_title: string | null;
  current_status: string | null;
  date_introduced: string | null;
  categories: string[] | null;
}

interface Props {
  storyId: number;
  headline: string;
  category: string | null;
  onPressBill?: (bill: RelatedBill) => void;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'from', 'as', 'its',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'that', 'this', 'these', 'those',
  'bill', 'bills', 'act', 'acts', 'amendment', 'amendments', 'says', 'said', 'will', 'into', 'over',
  'after', 'before', 'about', 'what', 'when', 'where', 'which', 'would', 'could', 'should',
]);

function keywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || [];
  return Array.from(new Set(words.filter(w => !STOP.has(w))));
}

export function VerityRealityCheck({ storyId, headline, category, onPressBill }: Props) {
  const { postcode } = useUser();
  const { member: myMP } = useElectorateByPostcode(postcode);
  const { votes: mpVotes } = useVotes(myMP?.id ?? null);

  const [bills, setBills] = useState<RelatedBill[]>([]);
  const [loading, setLoading] = useState(true);

  const storyKws = useMemo(() => keywords(headline), [headline]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const collected = new Map<string, RelatedBill>();

        // Pass 1 — category match (fast path, uses gin index on categories)
        if (category) {
          const { data } = await supabase
            .from('bills')
            .select('id, title, short_title, current_status, date_introduced, categories')
            .contains('categories', [category])
            .order('date_introduced', { ascending: false, nullsFirst: false })
            .limit(20);
          for (const b of ((data as RelatedBill[]) || [])) collected.set(b.id, b);
        }

        // Pass 2 — keyword title match for stronger signal
        if (storyKws.length > 0) {
          const topKws = storyKws.slice(0, 3);
          const orFilter = topKws.map(k => `title.ilike.%${k}%`).join(',');
          const { data } = await supabase
            .from('bills')
            .select('id, title, short_title, current_status, date_introduced, categories')
            .or(orFilter)
            .order('date_introduced', { ascending: false, nullsFirst: false })
            .limit(20);
          for (const b of ((data as RelatedBill[]) || [])) {
            if (!collected.has(b.id)) collected.set(b.id, b);
          }
        }

        // Score by keyword overlap. Require a real match — one shared word isn't enough.
        const threshold = Math.min(2, Math.max(1, storyKws.length));
        const scored = Array.from(collected.values())
          .map(b => {
            const t = ((b.short_title || b.title) || '').toLowerCase();
            const hits = storyKws.filter(k => t.includes(k)).length;
            return { bill: b, score: hits };
          })
          .filter(s => s.score >= threshold)
          .sort((a, b) => b.score - a.score);

        if (!cancelled) {
          setBills(scored.slice(0, 2).map(s => s.bill));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [storyId, headline, category]);

  const mpBillVote = useMemo(() => {
    if (!myMP || mpVotes.length === 0 || bills.length === 0) return null;
    for (const bill of bills) {
      const billKws = keywords(bill.short_title ?? bill.title);
      for (const vote of mpVotes) {
        if (!vote.division?.name) continue;
        const divKws = keywords(vote.division.name);
        const overlap = billKws.filter(k => divKws.includes(k)).length;
        if (overlap >= 2) return { bill, vote };
      }
    }
    return null;
  }, [myMP, mpVotes, bills]);

  // Be silent when we can't confidently match — better than false linkages
  if (!loading && bills.length === 0) return null;

  return (
    <View style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden' }}>
      {/* Green rail at top */}
      <View style={{ height: 3, backgroundColor: '#00843D' }} />
      <View style={{ backgroundColor: '#F0FDF4', padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Ionicons name="shield-checkmark" size={14} color="#00843D" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#00843D', letterSpacing: 0.8 }}>
            VERITY REALITY CHECK
          </Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#14532D', marginBottom: 12, lineHeight: 23 }}>
          What actually happened in parliament
        </Text>

        {loading ? (
          <Text style={{ fontSize: 13, color: '#166534' }}>Finding related legislation…</Text>
        ) : (
          <>
            {bills.map(bill => (
              <Pressable
                key={bill.id}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#ECFDF5' : '#FFFFFF',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 8,
                })}
                onPress={() => onPressBill?.(bill)}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#00843D', letterSpacing: 0.6, marginBottom: 4 }}>
                  RELATED BILL
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: '#14532D', lineHeight: 20 }}
                  numberOfLines={3}
                >
                  {bill.short_title || bill.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{ backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534' }}>
                      {(bill.current_status || 'In progress').toUpperCase()}
                    </Text>
                  </View>
                  {bill.date_introduced && (
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>
                      Introduced {new Date(bill.date_introduced).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={14} color="#00843D" style={{ marginLeft: 'auto' }} />
                </View>
              </Pressable>
            ))}

            {mpBillVote && myMP && (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginTop: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#00843D', letterSpacing: 0.6, marginBottom: 4 }}>
                  YOUR MP'S POSITION
                </Text>
                <Text style={{ fontSize: 14, color: '#14532D', lineHeight: 20 }}>
                  {myMP.first_name} {myMP.last_name} voted{' '}
                  <Text style={{ fontWeight: '800', color: mpBillVote.vote.vote_cast === 'aye' ? '#00843D' : '#DC2626' }}>
                    {mpBillVote.vote.vote_cast === 'aye'
                      ? 'FOR'
                      : mpBillVote.vote.vote_cast === 'no'
                      ? 'AGAINST'
                      : mpBillVote.vote.vote_cast.toUpperCase()}
                  </Text>{' '}
                  on a related division.
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 11, color: '#059669', marginTop: 10, fontStyle: 'italic', lineHeight: 15 }}>
              Sourced from APH division records and the bills register — not editorial framing.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
