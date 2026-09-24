interface GitHubRepo {
  id:               number;
  name:             string;
  full_name:        string;
  description:      string | null;
  private:          boolean;
  default_branch:   string;
  language:         string | null;
  stargazers_count: number;
  forks_count:      number;
  open_issues_count:number;
  html_url:         string;
}

interface GitHubCommit {
  sha:    string;
  commit: {
    message: string;
    author:  { name: string; email: string; date: string };
  };
  stats?: { additions: number; deletions: number };
  files?: { filename: string }[];
}

interface GitHubPR {
  number:  number;
  title:   string;
  state:   string;
  head:    { ref: string; sha: string };
  base:    { ref: string };
  user:    { login: string; avatar_url: string };
  body:    string | null;
  diff_url:string;
}

export async function fetchRepoInfo(
  owner: string, repo: string, token?: string
): Promise<GitHubRepo | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function fetchRepoLanguages(
  owner: string, repo: string, token?: string
): Promise<Record<string, number>> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
    if (!res.ok) return {};
    return res.json();
  } catch { return {}; }
}

function isValidGitHubName(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

function toSafeRepoRef(owner: string, repo: string): { owner: string; repo: string } | null {
  if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) return null;
  return {
    owner: encodeURIComponent(owner),
    repo: encodeURIComponent(repo),
  };
}

function toPositiveInt(value: number): number | null {
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function fetchRepoCommits(
  owner: string, repo: string, token?: string, perPage = 20
): Promise<GitHubCommit[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const safeRef = toSafeRepoRef(owner, repo);
  if (!safeRef) return [];
  const safePerPage = Math.max(1, Math.min(100, Math.trunc(perPage)));
  try {
    const res = await fetch(
      `https://api.github.com/repos/${safeRef.owner}/${safeRef.repo}/commits?per_page=${safePerPage}`,
      { headers }
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function fetchRepoPRs(
  owner: string, repo: string, token?: string
): Promise<GitHubPR[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const safeRef = toSafeRepoRef(owner, repo);
  if (!safeRef) return [];
  try {
    const res = await fetch(
      `https://api.github.com/repos/${safeRef.owner}/${safeRef.repo}/pulls?state=open&per_page=10`,
      { headers }
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function fetchPRDiff(
  owner: string, repo: string, prNumber: number, token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.diff",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const safeRef = toSafeRepoRef(owner, repo);
  const safePrNumber = toPositiveInt(prNumber);
  if (!safeRef || safePrNumber === null) return "";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${safeRef.owner}/${safeRef.repo}/pulls/${safePrNumber}`,
      { headers }
    );
    if (!res.ok) return "";
    return res.text();
  } catch { return ""; }
}

export async function fetchFileContent(
  owner: string, repo: string, path: string, token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const safeRef = toSafeRepoRef(owner, repo);
  if (!safeRef) return "";
  const safePath = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  if (!safePath) return "";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${safeRef.owner}/${safeRef.repo}/contents/${safePath}`,
      { headers }
    );
    if (!res.ok) return "";
    const data = await res.json();
    if (data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return "";
  } catch { return ""; }
}

export async function fetchRepoTree(
  owner: string, repo: string, branch = "main", token?: string
): Promise<{ path: string; type: string }[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tree ?? []).filter(
      (f: { type: string }) => f.type === "blob"
    );
  } catch { return []; }
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch { return null; }
}

export function computeRiskScore(criticals: number, warnings: number): string {
  if (criticals >= 5) return "F";
  if (criticals >= 3) return "D";
  if (criticals >= 1) return "C";
  if (warnings >= 5)  return "B-";
  if (warnings >= 2)  return "B";
  if (warnings >= 1)  return "B+";
  return "A+";
}