import { supabase } from './supabase';

// Divisions carry no FK to bills — the link is the division's bill_title text.
// Resolve a division to its bill id, or null when no confident match exists.
export async function findBillIdForDivision(divisionId: string): Promise<string | null> {
  try {
    const { data: div } = await supabase
      .from('divisions')
      .select('bill_title')
      .eq('id', divisionId)
      .maybeSingle();
    const title = (div as { bill_title?: string } | null)?.bill_title?.trim();
    if (!title) return null;

    const { data: byShort } = await supabase
      .from('bills')
      .select('id')
      .ilike('short_title', `%${title}%`)
      .limit(1)
      .maybeSingle();
    if (byShort?.id) return byShort.id;

    const { data: byTitle } = await supabase
      .from('bills')
      .select('id')
      .ilike('title', `%${title}%`)
      .limit(1)
      .maybeSingle();
    return byTitle?.id ?? null;
  } catch {
    return null;
  }
}
