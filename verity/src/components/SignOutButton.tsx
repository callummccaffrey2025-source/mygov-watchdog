'use client';
import { getSupabase } from '@/lib/supabase';

export default function SignOutButton() {
  const onClick = async () => {
    try { await getSupabase().auth.signOut(); } finally { location.href = '/'; }
  };
  return <button onClick={onClick} className="px-3 py-2 rounded border">Sign out</button>;
}
