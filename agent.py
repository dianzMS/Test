"""
AI Agent with MCP Tools

This module implements an AI agent that:
1. Connects to a custom MCP server (mcp_server.py)
2. Uses Claude as the underlying LLM
3. Executes tool calls via the MCP protocol
4. Returns structured responses including HTML app content when generated

Usage:
    import asyncio
    from agent import run_agent

    result = asyncio.run(run_agent("What's the weather in Tokyo?"))
    print(result["text"])
    if result["html"]:
        # render result["html"] in browser / iframe
        pass
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()

MODEL = "claude-opus-4-5"
MAX_TOKENS = 4096
MCP_SERVER_SCRIPT = str(Path(__file__).parent / "mcp_server.py")

# ── Tool format conversion ──────────────────────────────────────────────────


def _mcp_tool_to_anthropic(tool) -> dict:
    """Convert an MCP tool definition to Anthropic's tool format."""
    return {
        "name": tool.name,
        "description": tool.description or "",
        "input_schema": tool.inputSchema,
    }


# ── HTML detection ──────────────────────────────────────────────────────────

HTML_MARKERS = ("<!DOCTYPE html>", "<html", "<HTML")


def _is_html(text: str) -> bool:
    return any(text.strip().startswith(m) for m in HTML_MARKERS)


# ── Agent loop ──────────────────────────────────────────────────────────────


async def run_agent(user_message: str) -> dict[str, Any]:
    """Run the AI agent with the given user message.

    Returns a dict with:
        text (str): The agent's final text response.
        html (str | None): An HTML app to display, if any tool generated one.
        tool_calls (list): Summary of tool calls made during the conversation.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY is not set. "
            "Copy .env.example to .env and add your Anthropic API key."
        )

    client = anthropic.Anthropic(api_key=api_key)
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[MCP_SERVER_SCRIPT],
        env=None,
    )

    html_result: str | None = None
    tool_calls_log: list[dict] = []

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools_result = await session.list_tools()
            anthropic_tools = [_mcp_tool_to_anthropic(t) for t in tools_result.tools]

            messages = [{"role": "user", "content": user_message}]

            # Agentic loop: keep calling Claude until it finishes
            while True:
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    tools=anthropic_tools,
                    messages=messages,
                )

                if response.stop_reason == "end_turn":
                    text = "\n".join(
                        block.text
                        for block in response.content
                        if hasattr(block, "text")
                    )
                    return {
                        "text": text,
                        "html": html_result,
                        "tool_calls": tool_calls_log,
                    }

                if response.stop_reason == "tool_use":
                    # Append assistant turn with tool-use blocks
                    messages.append({"role": "assistant", "content": response.content})

                    tool_results = []
                    for block in response.content:
                        if block.type != "tool_use":
                            continue

                        # Call the tool via MCP
                        mcp_result = await session.call_tool(block.name, block.input)
                        result_text = (
                            mcp_result.content[0].text
                            if mcp_result.content
                            else ""
                        )

                        # Detect HTML output and save it separately
                        if _is_html(result_text):
                            html_result = result_text

                        tool_calls_log.append(
                            {
                                "tool": block.name,
                                "input": block.input,
                                "output": result_text[:200] + ("…" if len(result_text) > 200 else ""),
                            }
                        )

                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_text,
                            }
                        )

                    messages.append({"role": "user", "content": tool_results})

                else:
                    # Unexpected stop reason – return whatever we have
                    text = "\n".join(
                        block.text
                        for block in response.content
                        if hasattr(block, "text")
                    )
                    return {
                        "text": text,
                        "html": html_result,
                        "tool_calls": tool_calls_log,
                    }


# ── CLI entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else (
        "Show me the weather in Tokyo and generate an HTML dashboard for it."
    )
    print(f"User: {query}\n")
    result = asyncio.run(run_agent(query))
    print(f"Agent: {result['text']}")
    if result["tool_calls"]:
        print("\nTools called:")
        for tc in result["tool_calls"]:
            print(f"  - {tc['tool']}({json.dumps(tc['input'])}) → {tc['output']}")
    if result["html"]:
        out_path = Path("/tmp/agent_output.html")
        out_path.write_text(result["html"], encoding="utf-8")
        print(f"\nHTML app saved to: {out_path}")
