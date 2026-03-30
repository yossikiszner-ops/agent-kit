/**
 * bricks/tools/github.js — GitHub integration
 *
 * Requires: GITHUB_TOKEN in .env.local
 * Create a Personal Access Token at https://github.com/settings/tokens
 * Minimum scopes needed: repo (read/write issues, PRs)
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "github",
  description:
    "Interact with GitHub repositories, issues, pull requests, and files. " +
    "Actions: list-issues, get-issue, create-issue, list-prs, get-pr, " +
    "get-file, list-repos, search-code.",

  requiredEnvVars: ["GITHUB_TOKEN"],

  parameters: z.object({
    action: z
      .enum([
        "list-issues",
        "get-issue",
        "create-issue",
        "list-prs",
        "get-pr",
        "get-file",
        "list-repos",
        "search-code",
      ])
      .describe("The GitHub operation to perform"),
    owner: z
      .string()
      .optional()
      .describe("Repository owner (username or org name)"),
    repo: z
      .string()
      .optional()
      .describe("Repository name"),
    number: z
      .number()
      .int()
      .optional()
      .describe("Issue or PR number"),
    title: z
      .string()
      .optional()
      .describe("Issue title. Used by create-issue."),
    body: z
      .string()
      .optional()
      .describe("Issue body/description. Used by create-issue."),
    labels: z
      .array(z.string())
      .optional()
      .describe("Labels to apply. Used by create-issue."),
    path: z
      .string()
      .optional()
      .describe("File path within the repo. Used by get-file."),
    query: z
      .string()
      .optional()
      .describe("Search query. Used by search-code and list-repos."),
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .default("open")
      .describe("Filter by state. Used by list-issues and list-prs."),
  }),

  execute: async ({
    action,
    owner,
    repo,
    number,
    title,
    body,
    labels,
    path,
    query,
    state = "open",
  }) => {
    const gh = githubFetch.bind(null, process.env.GITHUB_TOKEN);

    switch (action) {
      case "list-issues": {
        mustHave({ owner, repo }, ["owner", "repo"]);
        const data = await gh(
          `/repos/${owner}/${repo}/issues?state=${state}&per_page=20&pulls=false`
        );
        return {
          count: data.length,
          issues: data.map(issueShape),
        };
      }

      case "get-issue": {
        mustHave({ owner, repo, number }, ["owner", "repo", "number"]);
        const data = await gh(`/repos/${owner}/${repo}/issues/${number}`);
        return issueShape(data);
      }

      case "create-issue": {
        mustHave({ owner, repo, title }, ["owner", "repo", "title"]);
        const data = await gh(
          `/repos/${owner}/${repo}/issues`,
          "POST",
          { title, body: body ?? "", labels: labels ?? [] }
        );
        return { number: data.number, url: data.html_url, title: data.title };
      }

      case "list-prs": {
        mustHave({ owner, repo }, ["owner", "repo"]);
        const data = await gh(
          `/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`
        );
        return {
          count: data.length,
          pullRequests: data.map(prShape),
        };
      }

      case "get-pr": {
        mustHave({ owner, repo, number }, ["owner", "repo", "number"]);
        const data = await gh(`/repos/${owner}/${repo}/pulls/${number}`);
        return prShape(data);
      }

      case "get-file": {
        mustHave({ owner, repo, path }, ["owner", "repo", "path"]);
        const data = await gh(`/repos/${owner}/${repo}/contents/${path}`);
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return {
          path: data.path,
          size: data.size,
          content: content.slice(0, 10_000), // cap large files
          truncated: content.length > 10_000,
          sha: data.sha,
        };
      }

      case "list-repos": {
        mustHave({ owner }, ["owner"]);
        const data = await gh(
          `/users/${owner}/repos?sort=updated&per_page=20`
        );
        return {
          count: data.length,
          repos: data.map((r) => ({
            name: r.full_name,
            description: r.description,
            stars: r.stargazers_count,
            language: r.language,
            updatedAt: r.updated_at,
            url: r.html_url,
          })),
        };
      }

      case "search-code": {
        if (!query) {
          return { error: "Provide a query for search-code." };
        }
        const q = owner && repo
          ? `${query} repo:${owner}/${repo}`
          : query;
        const data = await gh(`/search/code?q=${encodeURIComponent(q)}&per_page=10`);
        return {
          total: data.total_count,
          results: (data.items ?? []).map((i) => ({
            file: i.path,
            repo: i.repository.full_name,
            url: i.html_url,
          })),
        };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `GitHub error: ${err.message}. Check GITHUB_TOKEN and repo permissions.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function githubFetch(token, path, method = "GET", body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub API HTTP ${res.status}`);
  }
  return res.json();
}

function mustHave(params, keys) {
  const missing = keys.filter((k) => !params[k]);
  if (missing.length) {
    throw new Error(`Missing required params: ${missing.join(", ")}`);
  }
}

function issueShape(i) {
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    author: i.user?.login,
    labels: (i.labels ?? []).map((l) => l.name),
    body: (i.body ?? "").slice(0, 1_000),
    createdAt: i.created_at,
    url: i.html_url,
  };
}

function prShape(pr) {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user?.login,
    draft: pr.draft,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    createdAt: pr.created_at,
    url: pr.html_url,
  };
}

export default brick;
