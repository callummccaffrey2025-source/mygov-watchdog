export const dynamic = "force-dynamic";
import AuthClient from "@/components/AuthClient";
import CheckoutButton from "@/components/CheckoutButton";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function SubscribePage(){
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <section className="min-h-[60vh] py-10">
      <h1 className="text-4xl font-semibold mb-2">Subscribe</h1>
      {!user ? (
        <>
          <p className="text-lg text-gray-600 mb-6">Sign in to start your $1/month subscription.</p>
          <div className="max-w-md"><AuthClient /></div>
        </>
      ) : (
        <>
          <p className="text-lg text-gray-700 mb-6">Signed in as <span className="font-medium">{user.email}</span>.</p>
          <CheckoutButton />
        </>
      )}
    </section>
  );
}
