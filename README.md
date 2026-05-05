# mcp-reddit

MCP server for the Reddit API. Research trending topics, audience pain points, and viral content ideas across subreddits directly from Claude Code. Essential for YouTube video ideation in tech, AI, and Pakistan-focused content.

## Tools

| Tool | Description |
|------|-------------|
| `search_posts` | Search posts across Reddit or a specific subreddit |
| `get_hot_posts` | Get currently trending posts in a subreddit |
| `get_comments` | Fetch top comments from a post (great for audience sentiment) |

## Recommended Subreddits for This Pipeline

| Subreddit | Use Case |
|-----------|----------|
| `r/ClaudeAI` | Claude / Anthropic topic research |
| `r/MachineLearning` | ML paper discussions, trending topics |
| `r/LocalLLaMA` | Local model news, community discussions |
| `r/Pakistan` | Pakistan-specific trending topics |
| `r/learnprogramming` | Beginner pain points → tutorial ideas |
| `r/ChatGPT` | AI comparison content ideas |

## Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests per minute | **100 QPM** |
| OAuth token lifetime | 1 hour (auto-refreshes) |
| Cost | Free for personal/non-commercial use |
| Script app type | Free indefinitely |

## API Setup

1. Go to **https://www.reddit.com/prefs/apps**
2. Click "Create App" → select **script**
3. Fill in name, set redirect URI to `http://localhost:8080`
4. Copy the `client_id` (under app name) and `client_secret`

## Environment Variables

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=mcp-reddit/1.0.0 (by /u/your_username)
```

The `user_agent` must be descriptive — Reddit bans generic user agents.

## Install

```bash
cd mcp-reddit
npm install
npm run build
```

## Claude Code `.mcp.json` Config

```json
{
  "mcpServers": {
    "reddit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-reddit/dist/index.js"],
      "env": {
        "REDDIT_CLIENT_ID": "your_client_id",
        "REDDIT_CLIENT_SECRET": "your_client_secret",
        "REDDIT_USER_AGENT": "mcp-reddit/1.0.0 (YouTube research bot)"
      }
    }
  }
}
```

## Example Prompts

```
Get the top 10 hot posts from r/LocalLLaMA this week
```

```
Search r/ClaudeAI for posts about "Claude Code" in the past month, sort by top
```

```
Get the top 30 comments from Reddit post ID 1abc123 — I want to understand what people are asking
```

## Token Handling

The server uses OAuth client credentials flow (no user login required). Tokens are cached in memory and refreshed automatically 60 seconds before expiry.

## How I Built This — Channel 1 Angle

**Video idea:** *"How I find YouTube video ideas using Reddit + AI (the system behind my channel)"*

Reddit is a goldmine for YouTube ideation — the comments tell you exactly what questions your audience has, at what depth, in their own words. The `get_comments` tool is particularly powerful: paste a viral post ID from r/MachineLearning and ask Claude to identify the top 5 unresolved questions in the comments. Those become your next 5 video topics.

The OAuth token caching in this MCP means Claude Code doesn't re-authenticate on every tool call — a small but important detail that makes the tool feel instant in practice.

## License

MIT — see [LICENSE](LICENSE)
