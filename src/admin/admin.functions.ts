import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin area. Admins are listed (comma-separated emails) in the server secret
 * SINAPSI_ADMIN_EMAILS, so no address is ever written in the public repository.
 * An admin must also have a verified email. Admins see who registered and how
 * much they use Sinapsi (counts only), never the content of anyone's notes.
 */

function adminEmails(): string[] {
  return (process.env["SINAPSI_ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdmin(userId: string): Promise<boolean> {
  const allowed = adminEmails();
  if (!allowed.length) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email?.toLowerCase();
  return !!email && !!data.user?.email_confirmed_at && allowed.includes(email);
}

export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ admin: await isAdmin(context.userId) }));

export type AdminUser = {
  id: string;
  email: string | null;
  verified: boolean;
  provider: string;
  createdAt: string;
  lastSignIn: string | null;
  notes: number;
  connections: number;
  lastActivity: string | null;
  aiCalls30d: number;
};

/** Runs async jobs a few at a time, so many users do not flood the database. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  job: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(job))));
  return out;
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUser[]; generatedAt: string }> => {
    if (!(await isAdmin(context.userId))) throw new Error("Non hai accesso a questa pagina.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const accounts: {
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      created_at: string;
      last_sign_in_at?: string | null;
      app_metadata?: { provider?: string; providers?: string[] };
    }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw new Error("Impossibile leggere gli utenti.");
      accounts.push(...data.users);
      if (data.users.length < 500) break;
    }

    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const users = await inBatches(accounts, 8, async (u): Promise<AdminUser> => {
      const [notes, edges, last, usage] = await Promise.all([
        supabaseAdmin
          .from("notes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id)
          .eq("is_demo", false),
        supabaseAdmin
          .from("edges")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id),
        supabaseAdmin
          .from("notes")
          .select("updated_at")
          .eq("user_id", u.id)
          .eq("is_demo", false)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.from("ai_usage").select("calls").eq("user_id", u.id).gte("day", since),
      ]);
      return {
        id: u.id,
        email: u.email ?? null,
        verified: !!u.email_confirmed_at,
        provider: u.app_metadata?.providers?.join(", ") || u.app_metadata?.provider || "email",
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
        notes: notes.count ?? 0,
        connections: edges.count ?? 0,
        lastActivity: last.data?.updated_at ?? null,
        aiCalls30d: (usage.data ?? []).reduce((s, r) => s + r.calls, 0),
      };
    });
    users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { users, generatedAt: new Date().toISOString() };
  });
