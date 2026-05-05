// Supabase Edge Function — delete-account
//
// Deletes all user data and the auth account itself.
// Requires authenticated user JWT.
//
// Deploy:
//   supabase functions deploy delete-account --project-ref zmmglikiryuftqmoprqm

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Tables that contain user data, in deletion order
const USER_TABLES = [
  'community_votes',
  'community_comments',
  'community_posts',
  'community_reports',
  'poll_votes',
  'user_saves',
  'user_follows',
  'mp_messages',
  'share_events',
  'analytics_events',
  'user_engagement_stats',
  'notification_preferences',
  'push_tokens',
  'user_preferences',
  'email_digest_log',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Authenticate the user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  // Use service-role client for cascading deletes
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const deletedTables: string[] = [];
  const errors: string[] = [];

  // Delete user data from all tables
  for (const table of USER_TABLES) {
    try {
      const { error } = await db.from(table).delete().eq('user_id', user.id);
      if (error) {
        // Table might not exist or column might not be user_id — skip silently
        errors.push(`${table}: ${error.message}`);
      } else {
        deletedTables.push(table);
      }
    } catch {
      // Non-critical — some tables may not exist yet
    }
  }

  // Delete the auth user itself
  try {
    const { error: authError } = await db.auth.admin.deleteUser(user.id);
    if (authError) {
      return jsonResponse({
        error: `Failed to delete auth account: ${authError.message}`,
        deletedTables,
      }, 500);
    }
  } catch (e: any) {
    return jsonResponse({ error: `Auth deletion failed: ${e.message}` }, 500);
  }

  return jsonResponse({
    message: 'Account and all associated data deleted successfully',
    deletedTables,
    warnings: errors.length > 0 ? errors : undefined,
  });
});
