export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SupabaseRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export async function sbRest(path: string, init: SupabaseRequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);

  const res = await fetch(url, {
    ...init,
    headers,
    next: {
      revalidate: 30,
      ...(init.next ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase REST ${res.status} ${path}`);
  }

  return res;
}
