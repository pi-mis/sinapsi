import { getLang, locale, t } from "@/i18n";
/**
 * GitHub connector: each repository becomes a `progetto` neuron with its
 * description, README and latest commits. Calls go straight from the browser to
 * the GitHub API (CORS is allowed), so the rate limit is the user's own: 60
 * requests/hour without a token, 5000 with one.
 */

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  private: boolean;
  pushed_at: string | null;
  created_at: string;
};
export type GitHubCommit = {
  sha: string;
  commit: { message: string; author: { date: string } | null };
};

export class RateLimited extends Error {}

const API = "https://api.github.com";

export async function gh<T>(
  path: string,
  token: string | null,
  accept = "application/vnd.github+json",
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 403 || response.status === 429) {
    if (response.headers.get("x-ratelimit-remaining") === "0" || response.status === 429)
      throw new RateLimited(t("Limite di GitHub raggiunto: riprendo al prossimo aggiornamento."));
  }
  if (response.status === 401) throw new Error(t("Il token GitHub non è valido o è scaduto."));
  if (response.status === 404)
    throw Object.assign(new Error(t("Non trovato su GitHub.")), { status: 404 });
  if (!response.ok) throw new Error(t("GitHub non risponde in questo momento."));
  return (accept.includes("raw") ? await response.text() : await response.json()) as T;
}

/** The user's own repositories, most recently pushed first. With a token, private ones too. */
export async function listRepos(username: string, token: string | null): Promise<GitHubRepo[]> {
  const out: GitHubRepo[] = [];
  for (let page = 1; page <= 3; page++) {
    const path = token
      ? `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner`
      : `/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=pushed&type=owner`;
    const batch = await gh<GitHubRepo[]>(path, token);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out.filter((r) => !r.fork);
}

/** README as readable text: no badges, images, HTML or link targets. */
export function cleanReadme(markdown: string, limit = 6000): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^```[\s\S]*?^```/gm, (block) => (block.length > 600 ? "[codice]" : block))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

export function prettyName(name: string): string {
  const spaced = name.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The note text for a repository. */
export function repoContent(repo: GitHubRepo, commits: GitHubCommit[]): string {
  const facts = [
    repo.language && t("Linguaggio: {name}", { name: repo.language }),
    repo.stargazers_count ? `★ ${repo.stargazers_count}` : null,
    repo.pushed_at &&
      t("ultimo aggiornamento {date}", {
        date: new Date(repo.pushed_at).toLocaleDateString(locale(getLang())),
      }),
    repo.archived ? t("archiviato") : null,
  ].filter(Boolean);
  const lines = [
    repo.description?.trim() || t("Repository GitHub {name}.", { name: repo.full_name }),
    "",
    `Repository: ${repo.html_url}`,
    ...(repo.homepage ? [t("Sito: {url}", { url: repo.homepage })] : []),
    ...(facts.length ? [facts.join(" · ")] : []),
    ...(repo.topics?.length ? [t("Temi: {topics}", { topics: repo.topics.join(", ") })] : []),
  ];
  if (commits.length) {
    lines.push("", t("Ultimi commit:"));
    for (const c of commits.slice(0, 10)) {
      const date = c.commit.author?.date
        ? new Date(c.commit.author.date).toLocaleDateString(locale(getLang()))
        : "";
      lines.push(`- ${date} ${c.commit.message.split("\n")[0]!.slice(0, 120)}`.trim());
    }
  }
  return lines.join("\n");
}

/** Words that identify a repository inside free text ("sinapsi", "cv chatbot portfolio"). */
export function repoKey(name: string): string | null {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const words = key.split(" ").filter(Boolean);
  if (words.length >= 2 && words.length <= 4) return key;
  if (words.length === 1 && key.length >= 6) return key;
  return null;
}
