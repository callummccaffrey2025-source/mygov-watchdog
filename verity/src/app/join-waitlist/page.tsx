export const dynamic = "force-dynamic";
import AuthClient from "@/components/AuthClient";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function WaitlistPage(){
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <section className="min-h-[60vh] py-10">
      <h1 className="text-4xl font-semibold mb-2">Join waitlist</h1>
      {!user ? (
        <>
          <p className="text-lg text-gray-600 mb-6">Sign in to join the waitlist.</p>
          <div className="max-w-md"><AuthClient /></div>
        </>
      ) : (
        <p className="text-lg text-gray-700">Thanks, <span className="font-medium">{user.email}</span> — you’re on the waitlist.</p>
      )}
    </section>
  );
}
