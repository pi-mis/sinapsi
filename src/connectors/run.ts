import { t } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { summarizeForNote } from "@/attachments/kinds";
import { canonicalPair } from "@/ai/vector";
import { stableId } from "@/import/ids";
import { isoDay } from "@/import/whatsapp";
import { syncCalendars, type Progress } from "@/import/run";
import {
  RateLimited,
  cleanReadme,
  gh,
  listRepos,
  prettyName,
  repoContent,
  repoKey,
  type GitHubCommit,
  type GitHubRepo,
} from "./github";

/**
 * Connectors keep the brain up to date on their own. Each linked account is a
 * `sources` row (kind 'github' here, 'calendar' for calendars) whose
 * `extracted_text` holds its JSON state. They sync when the app opens, at most
 * every few hours.
 */

const EVERY_HOURS = 6;

type GitHubState = {
  login: string;
  token: string | null;
  lastSync: string | null;
  seen: Record<string, string>;
};
export type GitHubAccount = {
  id: string;
  login: string;
  hasToken: boolean;
  lastSync: string | null;
  repos: number;
};

function readState(raw: string | null): GitHubState {
  try {
    const s = JSON.parse(raw ?? "{}") as Partial<GitHubState>;
    return {
      login: s.login ?? "",
      token: s.token ?? null,
      lastSync: s.lastSync ?? null,
      seen: s.seen ?? {},
    };
  } catch {
    return { login: "", token: null, lastSync: null, seen: {} };
  }
}

export async function listGitHub(): Promise<GitHubAccount[]> {
  const { data } = await supabase
    .from("sources")
    .select("id,extracted_text")
    .eq("kind", "github")
    .order("created_at");
  return (data ?? []).map((r) => {
    const s = readState(r.extracted_text);
    return {
      id: r.id,
      login: s.login,
      hasToken: !!s.token,
      lastSync: s.lastSync,
      repos: Object.keys(s.seen).length,
    };
  });
}

/** Links a GitHub account (public repos by username, or all repos with a read-only token) and syncs it. */
export async function addGitHub(
  userId: string,
  username: string,
  token: string | null,
  report: Progress,
) {
  report(t("Controllo l'account GitHub…"));
  const cleanToken = token?.trim() || null;
  const who = cleanToken
    ? await gh<{ login: string }>("/user", cleanToken)
    : await gh<{ login: string }>(
        `/users/${encodeURIComponent(username.trim().replace(/^@/, ""))}`,
        null,
      ).catch((e: { status?: number }) => {
        throw e.status === 404 ? new Error(t("Utente GitHub non trovato.")) : e;
      });
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("kind", "github")
    .eq("uri", `github:${who.login}`)
    .maybeSingle();
  if (existing) await supabase.from("sources").delete().eq("id", existing.id);
  const state: GitHubState = { login: who.login, token: cleanToken, lastSync: null, seen: {} };
  const { data, error } = await supabase
    .from("sources")
    .insert({ kind: "github", uri: `github:${who.login}`, extracted_text: JSON.stringify(state) })
    .select("id")
    .single();
  if (error) throw new Error(t("Impossibile salvare il collegamento a GitHub."));
  return syncGitHub(userId, data.id, report, true);
}

export async function removeGitHub(id: string) {
  const { error } = await supabase.from("sources").delete().eq("id", id).eq("kind", "github");
  if (error) throw new Error(t("Impossibile scollegare GitHub."));
}

/** Saves the repository's README as a text source of its note, then rebuilds the note's attachment text. */
async function refreshSources(noteId: string, repo: GitHubRepo, readme: string) {
  const readmeUri = `github://${repo.full_name}/README`;
  const { data: rows } = await supabase.from("sources").select("id,uri").eq("folder", noteId);
  const readmeRow = rows?.find((r) => r.uri === readmeUri);
  if (readme) {
    if (readmeRow)
      await supabase.from("sources").update({ extracted_text: readme }).eq("id", readmeRow.id);
    else
      await supabase
        .from("sources")
        .insert({ kind: "text", uri: readmeUri, folder: noteId, extracted_text: readme });
  } else if (readmeRow) await supabase.from("sources").delete().eq("id", readmeRow.id);
  if (!rows?.some((r) => r.uri === repo.html_url))
    await supabase.from("sources").insert({
      kind: "link",
      uri: repo.html_url,
      folder: noteId,
      extracted_text: `${repo.full_name}\n${repo.description ?? ""}`.trim(),
    });
  const { data: all } = await supabase
    .from("sources")
    .select("kind,uri,extracted_text")
    .eq("folder", noteId)
    .order("created_at");
  return summarizeForNote(all ?? []);
}

async function syncRepo(userId: string, repo: GitHubRepo, token: string | null) {
  const id = await stableId(userId, `github:${repo.id}`);
  const [readmeRaw, commits] = await Promise.all([
    gh<string>(`/repos/${repo.full_name}/readme`, token, "application/vnd.github.raw").catch(
      (e) => {
        if (e instanceof RateLimited) throw e;
        return "";
      },
    ),
    gh<GitHubCommit[]>(`/repos/${repo.full_name}/commits?per_page=10`, token).catch((e) => {
      if (e instanceof RateLimited) throw e;
      return [] as GitHubCommit[]; // empty repository
    }),
  ]);
  const { data: existing } = await supabase.from("notes").select("id").eq("id", id).maybeSingle();
  const note = {
    title: prettyName(repo.name),
    content: repoContent(repo, commits),
    type: "progetto",
    is_private: repo.private,
    event_date: repo.pushed_at ? isoDay(new Date(repo.pushed_at)) : null,
    ai_status: "pending",
  };
  if (existing) {
    const { error } = await supabase.from("notes").update(note).eq("id", id);
    if (error) throw new Error(t("Impossibile aggiornare un progetto."));
  } else {
    const { error } = await supabase.from("notes").insert({ id, ...note });
    if (error) throw new Error(t("Impossibile salvare un progetto."));
  }
  const enriched = await refreshSources(id, repo, cleanReadme(readmeRaw));
  await supabase.from("notes").update({ enriched }).eq("id", id);
  return { id, key: repoKey(repo.name) };
}

/** 1- to 4-word sequences of a text, lower-case and accent-free. */
function grams(text: string): Set<string> {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++)
    for (let n = 1; n <= 4 && i + n <= words.length; n++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** Links each project to the notes that mention it by name. */
async function linkMentions(projects: { id: string; key: string | null }[]) {
  const named = projects.filter((p): p is { id: string; key: string } => !!p.key);
  if (!named.length) return;
  const ids = new Set(projects.map((p) => p.id));
  const edges: { a: string; b: string; score: number; kind: string }[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("notes")
      .select("id,title,content")
      .eq("is_demo", false)
      .order("id")
      .range(from, from + 499);
    if (error) return;
    for (const n of data) {
      if (ids.has(n.id)) continue;
      const g = grams(`${n.title} ${n.content}`);
      for (const p of named)
        if (g.has(p.key)) {
          const [a, b] = canonicalPair(p.id, n.id);
          edges.push({ a, b, score: 0.7, kind: "project" });
        }
    }
    if (data.length < 500) break;
  }
  for (let i = 0; i < edges.length; i += 500)
    await supabase
      .from("edges")
      .upsert(edges.slice(i, i + 500), { onConflict: "a,b", ignoreDuplicates: true });
}

/** Syncs one GitHub account: only repositories pushed since the last sync are fetched again. */
export async function syncGitHub(
  userId: string,
  sourceId: string,
  report: Progress,
  force = false,
) {
  const { data: row } = await supabase
    .from("sources")
    .select("extracted_text")
    .eq("id", sourceId)
    .single();
  const state = readState(row?.extracted_text ?? null);
  report(t("Leggo i repository…"));
  const repos = await listRepos(state.login, state.token);
  const changed = repos.filter(
    (r) => force || state.seen[String(r.id)] !== (r.pushed_at ?? r.created_at),
  );
  const projects: { id: string; key: string | null }[] = [];
  let limited = false;
  for (let i = 0; i < changed.length; i++) {
    const repo = changed[i]!;
    report(`Progetto ${i + 1} di ${changed.length}: ${repo.name}`, i, changed.length);
    try {
      projects.push(await syncRepo(userId, repo, state.token));
      state.seen[String(repo.id)] = repo.pushed_at ?? repo.created_at;
    } catch (e) {
      if (e instanceof RateLimited) {
        limited = true;
        break;
      }
    }
  }
  if (projects.length) {
    report(t("Collego i progetti alle note…"));
    await linkMentions(projects);
  }
  state.lastSync = new Date().toISOString();
  await supabase
    .from("sources")
    .update({ extracted_text: JSON.stringify(state) })
    .eq("id", sourceId);
  return { updated: projects.length, total: repos.length, limited };
}

/** Runs every connector that is due (or all of them with `force`). Returns how many notes changed. */
export async function syncConnectors(
  userId: string,
  report: Progress,
  force = false,
): Promise<number> {
  let changed = await syncCalendars(userId, report, force);
  for (const account of await listGitHub()) {
    const age = account.lastSync ? Date.now() - new Date(account.lastSync).getTime() : Infinity;
    if (!force && age < EVERY_HOURS * 3600_000) continue;
    try {
      changed += (await syncGitHub(userId, account.id, report)).updated;
    } catch {
      // Retried at the next opening.
    }
  }
  return changed;
}
