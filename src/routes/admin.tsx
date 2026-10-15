import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BadgeCheck, CircleAlert, RefreshCw, Search, Users } from "lucide-react";
import { useSession } from "@/lib/auth";
import { Login } from "@/components/Login";
import { VerifyEmail } from "@/components/VerifyEmail";
import { Button } from "@/components/ui/button";
import { adminOverview, amIAdmin, type AdminUser } from "@/admin/admin.functions";
import { getLang, locale, tr, useT, type T } from "@/i18n";
import { LangSwitch } from "@/components/LangSwitch";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Sinapsi · Amministrazione" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const session = useSession();
  if (session === undefined) return <div className="min-h-screen bg-background" />;
  if (!session) return <Login />;
  if (!session.user.email_confirmed_at) return <VerifyEmail session={session} />;
  return <AdminPage />;
}

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(locale(getLang()), {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const ago = (t: T, iso: string | null) => {
  if (!iso) return t("mai");
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return days <= 0 ? t("oggi") : days === 1 ? t("ieri") : t("{n} giorni fa", { n: days });
};

function AdminPage() {
  const t = useT();
  const check = useServerFn(amIAdmin);
  const overview = useServerFn(adminOverview);
  const access = useQuery({ queryKey: ["am-i-admin"], queryFn: () => check() });
  const data = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overview(),
    enabled: !!access.data?.admin,
  });
  const [filter, setFilter] = useState("");
  const users = useMemo(
    () =>
      (data.data?.users ?? []).filter(
        (u) => !filter || (u.email ?? "").toLowerCase().includes(filter.toLowerCase()),
      ),
    [data.data, filter],
  );
  const all = data.data?.users ?? [];
  const week = Date.now() - 7 * 86400_000;
  const stats = [
    { label: t("Utenti"), value: all.length },
    { label: t("Email verificate"), value: all.filter((u) => u.verified).length },
    { label: t("Note totali"), value: all.reduce((s, u) => s + u.notes, 0) },
    {
      label: t("Attivi negli ultimi 7 giorni"),
      value: all.filter((u) => u.lastActivity && new Date(u.lastActivity).getTime() > week).length,
    },
  ];

  return (
    <main className="min-h-dvh bg-background px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {t("Torna al cervello")}
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-light">
              <Users className="size-6 text-muted-foreground" />
              {t("Amministrazione")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch />
            {access.data?.admin && (
              <Button
                variant="secondary"
                size="sm"
                disabled={data.isFetching}
                onClick={() => void data.refetch()}
              >
                <RefreshCw className={data.isFetching ? "animate-spin" : ""} />
                {t("Aggiorna")}
              </Button>
            )}
          </div>
        </header>

        {access.isLoading && (
          <p className="text-sm text-muted-foreground">{t("Controllo i permessi…")}</p>
        )}
        {access.data && !access.data.admin && (
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            {t(
              "Questa pagina è riservata agli amministratori. Se sei tu il proprietario, aggiungi la tua email al secret",
            )}{" "}
            <code className="font-mono">SINAPSI_ADMIN_EMAILS</code>{" "}
            {t("in Lovable Cloud e verifica l’indirizzo.")}
          </p>
        )}
        {(access.error || data.error) && (
          <p className="text-sm text-destructive">
            {tr(((access.error || data.error) as Error).message)}
          </p>
        )}

        {access.data?.admin && (
          <>
            <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-3xl font-light tabular-nums">
                    {data.isLoading ? "…" : s.value}
                  </div>
                </div>
              ))}
            </section>

            <div className="mb-4 flex items-center gap-2 rounded-md border border-input bg-card px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                aria-label={t("Cerca per email")}
                placeholder={t("Cerca per email…")}
                className="h-10 flex-1 bg-transparent text-base outline-none sm:text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            {data.isLoading && (
              <p className="text-sm text-muted-foreground">{t("Carico gli utenti…")}</p>
            )}

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-card text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Email",
                      t("Registrato"),
                      t("Ultimo accesso"),
                      t("Note"),
                      t("Collegamenti"),
                      t("Ultima attività"),
                      t("Richieste AI (30 gg)"),
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-card/60">
                      <td className="px-4 py-3">
                        <EmailCell user={u} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {day(u.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {ago(t, u.lastSignIn)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{u.notes}</td>
                      <td className="px-4 py-3 tabular-nums">{u.connections}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {ago(t, u.lastActivity)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{u.aiCalls30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: cards */}
            <ul className="space-y-2 md:hidden">
              {users.map((u) => (
                <li key={u.id} className="rounded-lg border border-border bg-card p-4">
                  <EmailCell user={u} />
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t("Note")}</dt>
                      <dd className="text-base tabular-nums">{u.notes}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("Collegamenti")}</dt>
                      <dd className="text-base tabular-nums">{u.connections}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("AI (30 gg)")}</dt>
                      <dd className="text-base tabular-nums">{u.aiCalls30d}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("Registrato il {date} · ultimo accesso {last} · attività {activity}", {
                      date: day(u.createdAt),
                      last: ago(t, u.lastSignIn),
                      activity: ago(t, u.lastActivity),
                    })}
                  </p>
                </li>
              ))}
            </ul>
            {!data.isLoading && !users.length && (
              <p className="text-sm text-muted-foreground">{t("Nessun utente trovato.")}</p>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              {t(
                "Vedi solo conteggi e dati dell’account, mai il contenuto delle note degli altri utenti.",
              )}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function EmailCell({ user }: { user: AdminUser }) {
  const t = useT();
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate">{user.email ?? t("(senza email)")}</span>
        {user.verified ? (
          <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("Email verificata")} />
        ) : (
          <CircleAlert
            className="size-4 shrink-0 text-destructive"
            aria-label={t("Email non verificata")}
          />
        )}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {user.verified ? t("verificata") : t("non verificata")} · {user.provider}
      </div>
    </div>
  );
}
