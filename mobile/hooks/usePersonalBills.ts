import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Bill } from './useBills';

// Map onboarding topic IDs → bill category strings used in the categories[] column
const TOPIC_TO_CATEGORY: Record<string, string[]> = {
  economy:        ['economy', 'economic', 'finance', 'budget', 'tax'],
  healthcare:     ['health', 'healthcare', 'medical'],
  environment:    ['climate', 'environment', 'energy'],
  education:      ['education'],
  defence:        ['defence', 'defense', 'security'],
  immigration:    ['immigration', 'migration'],
  housing:        ['housing'],
  welfare:        ['welfare', 'social services'],
  indigenous:     ['indigenous', 'indigenous_affairs'],
  infrastructure: ['infrastructure', 'transport'],
  technology:     ['technology', 'digital'],
  foreign_policy: ['foreign_policy', 'foreign affairs'],
  agriculture:    ['agriculture'],
  justice:        ['justice', 'law'],
};

export interface PersonalBill extends Bill {
  matchedTopic: string; // the user's topic that matched
}

export function usePersonalBills() {
  const [bills, setBills] = useState<PersonalBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        // Load user's selected topics
        const raw = await AsyncStorage.getItem('selected_topics');
        const userTopics: string[] = raw ? JSON.parse(raw) : [];
        setTopics(userTopics);

        if (userTopics.length === 0) {
          setLoading(false);
          return;
        }

        // Build list of category strings to search for
        const categoryStrings: string[] = [];
        for (const topic of userTopics) {
          const cats = TOPIC_TO_CATEGORY[topic];
          if (cats) categoryStrings.push(...cats);
        }

        if (categoryStrings.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch recent active bills — we'll filter client-side for category overlap
        const { data } = await supabase
          .from('bills')
          .select('id,title,short_title,current_status,status,summary_plain,categories,date_introduced')
          .neq('current_status', 'In search index')
          .order('date_introduced', { ascending: false })
          .limit(50);

        const allBills = (data || []) as Bill[];

        // Match bills to user topics
        const matched: PersonalBill[] = [];
        const seen = new Set<string>();

        for (const bill of allBills) {
          if (matched.length >= 5) break;
          if (!bill.categories?.length) continue;

          const billCats = bill.categories.map(c => c.toLowerCase());
          for (const topic of userTopics) {
            const topicCats = TOPIC_TO_CATEGORY[topic] || [];
            if (topicCats.some(tc => billCats.some(bc => bc.includes(tc)))) {
              if (!seen.has(bill.id)) {
                seen.add(bill.id);
                matched.push({ ...bill, matchedTopic: topic });
              }
              break;
            }
          }
        }

        setBills(matched);
      } catch {}
      setLoading(false);
    };

    fetch();
  }, []);

  return { bills, topics, loading };
}
