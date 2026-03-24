# AI Agent with Custom MCP Tools + HTML Apps in Chat

This project shows how to build an AI agent that:
1. **Uses custom MCP tools** via the [Model Context Protocol](https://modelcontextprotocol.io/)
2. **Renders interactive HTML apps** directly inside the chat response

---

## Architecture

```
┌─────────────────────────────────────────┐
│          Browser Chat UI                │
│  (templates/chat.html)                  │
│  • Sends messages → /chat API           │
│  • Renders HTML app in an iframe        │
└──────────────┬──────────────────────────┘
               │ POST /chat
┌──────────────▼──────────────────────────┐
│          Flask Web App                  │
│  (chat_app.py)                          │
│  • Serves the chat UI                   │
│  • Calls run_agent()                    │
└──────────────┬──────────────────────────┘
               │ asyncio
┌──────────────▼──────────────────────────┐
│          AI Agent                       │
│  (agent.py)                             │
│  • Connects to MCP server via stdio     │
│  • Lists available tools                │
│  • Runs agentic loop with Claude        │
│  • Detects HTML output from tools       │
└──────────────┬──────────────────────────┘
               │ MCP (stdio)
┌──────────────▼──────────────────────────┐
│       Custom MCP Server                 │
│  (mcp_server.py)                        │
│  Tools:                                 │
│  • get_weather(city)                    │
│  • calculate(expression)               │
│  • generate_html_app(title, items, …)  │
└─────────────────────────────────────────┘
```

---

## File Structure

```
├── mcp_server.py        # Custom MCP tools server (FastMCP)
├── agent.py             # AI agent (Claude + MCP client)
├── chat_app.py          # Flask chat web application
├── templates/
│   └── chat.html        # Chat UI frontend (iframe HTML rendering)
├── requirements.txt     # Python dependencies
└── .env.example         # Environment variable template
```

---

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Your API Key

```bash
cp .env.example .env
# Edit .env and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com/

### 3. Run the Chat App

```bash
python chat_app.py
```

Open **http://localhost:5000** in your browser.

### 4. (Optional) Run the Agent from the Command Line

```bash
python agent.py "Show me the weather in Tokyo and create an HTML dashboard"
```

---

## How It Works

### Custom MCP Tools (`mcp_server.py`)

Tools are defined using the `@mcp.tool()` decorator from [FastMCP](https://github.com/jlowin/fastmcp):

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Custom AI Agent Tools")

@mcp.tool()
def get_weather(city: str) -> str:
    """Get current weather for a city."""
    ...

@mcp.tool()
def calculate(expression: str) -> str:
    """Evaluate a math expression."""
    ...

@mcp.tool()
def generate_html_app(title: str, items: str, chart_type: str = "cards") -> str:
    """Generate an interactive HTML dashboard — rendered in the chat."""
    ...

mcp.run(transport="stdio")
```

To add your own tool, just add a new `@mcp.tool()` function.

### AI Agent with MCP Client (`agent.py`)

The agent:
1. Starts `mcp_server.py` as a subprocess (stdio transport)
2. Lists all available tools and converts them to Anthropic's format
3. Runs an **agentic loop**: calls Claude → executes tool calls via MCP → feeds results back
4. Detects when a tool returns HTML and includes it in the structured response

```python
from agent import run_agent
import asyncio

result = asyncio.run(run_agent("Show weather for Tokyo as an HTML dashboard"))

print(result["text"])        # Agent's text response
print(result["tool_calls"])  # List of tools called and their outputs
if result["html"]:
    # HTML document ready to render in an iframe or browser
    open("output.html", "w").write(result["html"])
```

### HTML Apps in Chat (`templates/chat.html`)

When the agent returns HTML content:
- The chat UI shows a **"📱 View HTML App"** button in the message bubble
- Clicking it opens a **side panel with an iframe** rendering the HTML
- The iframe uses `srcdoc` (no separate URL needed) and `sandbox` for security

```
┌─────────────────┬─────────────────────┐
│  Chat messages  │  HTML App Preview   │
│                 │  ┌───────────────┐  │
│ 🤖 Here's your  │  │               │  │
│    dashboard    │  │  [iframe with │  │
│ [📱 View App]   │  │   your HTML]  │  │
│                 │  └───────────────┘  │
└─────────────────┴─────────────────────┘
```

---

## Available Tools

| Tool | Description | Example prompt |
|------|-------------|----------------|
| `get_weather` | Current weather for a city | *"What's the weather in London?"* |
| `calculate` | Math expressions | *"Calculate sqrt(144) + pi * 2"* |
| `generate_html_app` | Interactive HTML dashboard | *"Create an HTML bar chart: Sales:1200, Costs:800"* |

**Supported cities for weather:** Beijing, Shanghai, New York, London, Tokyo, Sydney

**Chart types for HTML dashboards:** `cards` (default), `bars`, `table`

---

## Adding Your Own MCP Tools

1. Open `mcp_server.py`
2. Add a new `@mcp.tool()` function with a clear docstring
3. Restart `chat_app.py` — the agent will automatically discover the new tool

```python
@mcp.tool()
def search_database(query: str, limit: int = 10) -> str:
    """Search the product database and return matching items."""
    # Your implementation here
    return json.dumps(results)
```

---

## Requirements

- Python 3.10+
- Anthropic API key (Claude model access)
- See `requirements.txt` for all packages
