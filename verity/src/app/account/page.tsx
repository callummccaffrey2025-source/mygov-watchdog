export const dynamic = "force-dynamic";
import AuthClient from "@/components/AuthClient";
import SignOutButton from "@/components/SignOutButton";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function AccountPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <section className="min-h-[60vh] py-10">
      <h1 className="text-4xl font-semibold mb-2">Account</h1>
      {!user ? (
        <>
          <p className="text-lg text-gray-600 mb-6">Sign in to manage your settings.</p>
          <div className="max-w-md"><AuthClient /></div>
        </>
      ) : (
        <>
          <p className="text-lg text-gray-600">Signed in as <span className="font-medium">{user.email}</span></p>
          <div className="mt-6 flex gap-3">
            <a className="border rounded-lg px-3 py-2" href="/subscribe">Subscribe</a>
            <SignOutButton />
          </div>
        </>
      )}
    </section>
  );
}
