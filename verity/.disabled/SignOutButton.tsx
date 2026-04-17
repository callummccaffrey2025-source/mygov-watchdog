'use client';
import { supabase } from '@/lib/supabase';
export default function SignOutButton() {
  return <button onClick={async () => { await supabase?.auth.signOut(); location.href='/' }} className="px-3 py-2 border rounded">Sign out</button>;
}
