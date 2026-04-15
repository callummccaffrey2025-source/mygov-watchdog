import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  category: string;
  published_at: string;
}

export function useNewsItems(limit = 5) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('news_items')
          .select('id,headline,summary,source,url,category,published_at')
          .order('published_at', { ascending: false })
          .limit(limit);
        setItems((data as NewsItem[]) || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [limit]);

  return { items, loading };
}
