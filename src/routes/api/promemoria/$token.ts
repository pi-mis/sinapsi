import { createFileRoute } from "@tanstack/react-router";
import { remindersToIcs, type Reminder } from "@/brain/reminders";

/**
 * Private iCal feed of the user's open reminders, so the phone's calendar app
 * can show them and send its own notifications. The secret token in the URL is
 * the only credential: it maps to a `sources` row of kind `reminder_feed`.
 */
export const Route = createFileRoute("/api/promemoria/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = params.token.replace(/\.ics$/i, "");
        if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: feed } = await supabaseAdmin
          .from("sources")
          .select("user_id")
          .eq("kind", "reminder_feed")
          .eq("uri", token)
          .maybeSingle();
        if (!feed) return new Response("Not found", { status: 404 });
        const { data } = await supabaseAdmin
          .from("jobs")
          .select("id,note_id,status,payload")
          .eq("user_id", feed.user_id)
          .eq("kind", "reminder")
          .eq("status", "open")
          .limit(500);
        const reminders = (data ?? []) as unknown as Reminder[];
        const app = new URL("/", request.url).href;
        return new Response(remindersToIcs(reminders, app), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="sinapsi-promemoria.ics"',
            "Cache-Control": "private, max-age=900",
          },
        });
      },
    },
  },
});
