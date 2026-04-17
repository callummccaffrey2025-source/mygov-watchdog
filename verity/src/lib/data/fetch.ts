import "server-only";
import type { Bill, MP } from "@/types";

type Maybe<T> = T | null;
export async function getClient() {
  // Late import to keep pages tree-shakeable
  const mod = await import("@/lib/supabase/server").catch(() => null as any);
  const getSupabaseServer = (mod && (mod.getSupabaseServer || mod.createClient)) || null;
  if (!getSupabaseServer) return null;
  try { return getSupabaseServer(); } catch { return null; }
}

export async function fetchBills(limit=20): Promise<Bill[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data } = await sb.from("bills")
    .select("id,title,stage,status,last_movement_at")
    .order("last_movement_at",{ ascending:false })
    .limit(limit);
  return (data ?? []) as any;
}

export async function fetchBill(id: string): Promise<Maybe<Bill & { movements: any[] }>> {
  const sb = await getClient();
  if (!sb) return null;
  const { data: bill } = await sb.from("bills").select("*").eq("id", id).single();
  if (!bill) return null;
  const { data: moves } = await sb.from("bill_movements")
    .select("id,kind,occurred_at,chamber,note,source_url")
    .eq("bill_id", id)
    .order("occurred_at",{ ascending:true });
  return { ...(bill as any), movements: (moves ?? []) };
}

export async function fetchMPs(limit=50): Promise<MP[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data } = await sb.from("mps")
    .select("id,name,party,electorate,state,headshot_url")
    .order("name",{ ascending:true })
    .limit(limit);
  return (data ?? []) as any;
}

export async function fetchMP(id: string): Promise<Maybe<MP & { votes: any[] }>> {
  const sb = await getClient();
  if (!sb) return null;
  const { data: mp } = await sb.from("mps").select("*").eq("id", id).single();
  if (!mp) return null;
  const { data: votes } = await sb
    .from("division_votes")
    .select("division_id,vote, divisions!inner(id,motion,occurred_at,chamber,source_url)")
    .eq("mp_id", id)
    .order("divisions.occurred_at",{ ascending:false })
    .limit(20);
  return { ...(mp as any), votes: (votes ?? []) };
}
