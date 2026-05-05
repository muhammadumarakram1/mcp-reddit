import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const USER_AGENT = process.env.REDDIT_USER_AGENT ?? "mcp-reddit/1.0.0 (YouTube production pipeline)";

let tokenCache: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set. Create an app at https://www.reddit.com/prefs/apps"
    );
  }
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new McpError(ErrorCode.InvalidRequest, `Reddit OAuth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function redditFetch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
  });
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") ?? "60";
    throw new McpError(ErrorCode.InvalidRequest, `Reddit rate limit hit (100 QPM). Retry after ${retryAfter}s.`);
  }
  if (!res.ok) {
    throw new McpError(ErrorCode.InternalError, `Reddit API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function formatPost(child: Record<string, unknown>) {
  const d = child.data as Record<string, unknown>;
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score,
    upvote_ratio: d.upvote_ratio,
    num_comments: d.num_comments,
    url: d.url,
    permalink: `https://reddit.com${d.permalink}`,
    selftext: typeof d.selftext === "string" ? d.selftext.slice(0, 500) : "",
    created_utc: d.created_utc,
    is_self: d.is_self,
    flair: d.link_flair_text,
    thumbnail: d.thumbnail,
  };
}

function formatComment(child: Record<string, unknown>) {
  const d = child.data as Record<string, unknown>;
  if (!d.body) return null;
  return {
    id: d.id,
    author: d.author,
    body: typeof d.body === "string" ? d.body.slice(0, 1000) : "",
    score: d.score,
    created_utc: d.created_utc,
    permalink: `https://reddit.com${d.permalink}`,
  };
}

const SORTS = ["relevance", "hot", "top", "new", "comments"] as const;
const TIME_FILTERS = ["hour", "day", "week", "month", "year", "all"] as const;

const SearchPostsSchema = z.object({
  subreddit: z.string().optional().describe("Subreddit name without r/ prefix (omit for all of Reddit)"),
  query: z.string().min(1).describe("Search query"),
  sort: z.enum(SORTS).default("relevance").describe("Sort order"),
  time_filter: z.enum(TIME_FILTERS).default("week").describe("Time filter for results"),
  limit: z.number().int().min(1).max(100).default(25).describe("Number of results (1-100)"),
});

const GetHotPostsSchema = z.object({
  subreddit: z.string().min(1).describe("Subreddit name without r/ prefix (e.g. ClaudeAI)"),
  limit: z.number().int().min(1).max(100).default(25).describe("Number of posts"),
});

const GetCommentsSchema = z.object({
  post_id: z.string().min(1).describe("Reddit post ID (the alphanumeric part after /comments/)"),
  subreddit: z.string().optional().describe("Subreddit name (optional, speeds up lookup)"),
  limit: z.number().int().min(1).max(500).default(50).describe("Max number of top-level comments"),
  sort: z.enum(["confidence", "top", "new", "controversial", "old", "qa"]).default("top"),
});

const server = new Server(
  { name: "mcp-reddit", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_posts",
      description: "Search Reddit posts. Good for trend research in r/ClaudeAI, r/MachineLearning, r/LocalLLaMA, r/Pakistan.",
      inputSchema: {
        type: "object",
        properties: {
          subreddit: { type: "string", description: "Subreddit name without r/ (omit for all Reddit)" },
          query: { type: "string", description: "Search query" },
          sort: { type: "string", enum: SORTS, default: "relevance" },
          time_filter: { type: "string", enum: TIME_FILTERS, default: "week" },
          limit: { type: "number", default: 25, minimum: 1, maximum: 100 },
        },
        required: ["query"],
      },
    },
    {
      name: "get_hot_posts",
      description: "Get currently hot/trending posts from a specific subreddit.",
      inputSchema: {
        type: "object",
        properties: {
          subreddit: { type: "string", description: "Subreddit name without r/" },
          limit: { type: "number", default: 25, minimum: 1, maximum: 100 },
        },
        required: ["subreddit"],
      },
    },
    {
      name: "get_comments",
      description: "Get top comments from a Reddit post. Useful for audience sentiment and pain-point research.",
      inputSchema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "Reddit post ID" },
          subreddit: { type: "string", description: "Subreddit name (optional)" },
          limit: { type: "number", default: 50, minimum: 1, maximum: 500 },
          sort: { type: "string", enum: ["confidence", "top", "new", "controversial", "old", "qa"], default: "top" },
        },
        required: ["post_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "search_posts": {
        const input = SearchPostsSchema.parse(args);
        const base = input.subreddit ? `/r/${input.subreddit}/search` : "/search";
        const params = new URLSearchParams({
          q: input.query,
          sort: input.sort,
          t: input.time_filter,
          limit: String(input.limit),
          restrict_sr: input.subreddit ? "1" : "0",
        });
        const data = await redditFetch(`${base}?${params}`) as Record<string, unknown>;
        const listing = data.data as Record<string, unknown>;
        const posts = (listing.children as Array<Record<string, unknown>>).map(formatPost);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: posts.length, after: listing.after, posts }, null, 2),
          }],
        };
      }

      case "get_hot_posts": {
        const input = GetHotPostsSchema.parse(args);
        const params = new URLSearchParams({ limit: String(input.limit) });
        const data = await redditFetch(`/r/${input.subreddit}/hot?${params}`) as Record<string, unknown>;
        const listing = data.data as Record<string, unknown>;
        const posts = (listing.children as Array<Record<string, unknown>>).map(formatPost);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ subreddit: input.subreddit, count: posts.length, posts }, null, 2),
          }],
        };
      }

      case "get_comments": {
        const input = GetCommentsSchema.parse(args);
        const sub = input.subreddit ? `/r/${input.subreddit}` : "";
        const params = new URLSearchParams({ limit: String(input.limit), sort: input.sort });
        const data = await redditFetch(`${sub}/comments/${input.post_id}?${params}`) as Array<Record<string, unknown>>;
        // data[0] is the post, data[1] is the comments listing
        const postListing = data[0].data as Record<string, unknown>;
        const postData = (postListing.children as Array<Record<string, unknown>>)[0];
        const commentsListing = data[1].data as Record<string, unknown>;
        const comments = (commentsListing.children as Array<Record<string, unknown>>)
          .map(formatComment)
          .filter(Boolean);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              post: formatPost(postData),
              comment_count: comments.length,
              comments,
            }, null, 2),
          }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${err.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Unexpected error: ${String(err)}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-reddit server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
