# AI Agent Chat App

A clean AI chat web app with **MCP-style tool calling** and **in-chat web app rendering**, deployable to Vercel in one click.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FdianzMS%2FTest&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20API%20Key&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys)

## Features

- 🤖 Supports GPT-4o / GPT-4o mini / GPT-3.5 Turbo model switching
- ⚡ Streaming responses with real-time display
- 💬 Maintains full conversation context
- 📱 Responsive design, mobile-friendly
- 🔒 API Key stored securely as a server-side environment variable
- 🔧 **MCP-style tool calling** — the AI agent can invoke custom tools:
  - `render_webapp` — builds and renders an interactive HTML app directly inside the chat
  - `get_current_time` — returns the current date/time in any timezone
  - `calculate` — evaluates mathematical expressions using JavaScript's `Math` object
- 🖥️ **In-chat web app rendering** — AI-generated apps appear as live sandboxed iframes in the chat

## How the AI Agent Works

The backend (`api/chat.js`) implements an **agentic loop**:

1. The user message is sent to the OpenAI model along with tool definitions.
2. If the model decides to call a tool, the server executes it and feeds the result back.
3. The loop continues until the model produces a final text response.
4. All events (tool calls, tool results, webapp frames, text chunks) are streamed to the frontend via **Server-Sent Events (SSE)**.

### Adding Your Own MCP Tools

1. Add a new entry to the `TOOLS` array in `api/chat.js`:

```js
{
  type: "function",
  function: {
    name: "my_tool",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "..." },
      },
      required: ["param1"],
    },
  },
}
```

2. Add a `case "my_tool":` branch in `executeTool()` that returns a JSON string result.

That's it — the model will automatically decide when to call your tool.

### In-chat Web App Rendering

Ask the AI to create any interactive experience and it will use `render_webapp` to embed it live in the chat:

- "Show me a bar chart of the planets' distances from the Sun"
- "Build me a Pomodoro timer"
- "Create a simple Snake game"
- "Make a color palette picker"

The rendered app appears as a sandboxed `<iframe>` inside the chat window. It runs with `allow-scripts` sandbox so JavaScript works, but the iframe has a null origin and cannot access the parent page's cookies or storage.

## One-Click Deploy

1. Click the **"Deploy with Vercel"** button above
2. Authorize Vercel with your GitHub account
3. Set the `OPENAI_API_KEY` environment variable
4. Click Deploy — done!

## Local Development

```bash
# Install dependencies
npm install

# Install Vercel CLI
npm i -g vercel

# Create .env file
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# Start local dev server
vercel dev
```

## Project Structure

```
├── api/
│   └── chat.js          # Serverless API — agentic loop + MCP tools
├── public/
│   ├── index.html       # Chat UI
│   ├── style.css        # Styles (includes tool-call & webapp iframe styles)
│   └── script.js        # Frontend logic (SSE handling, iframe rendering)
├── vercel.json          # Vercel routing config
└── package.json
```

