"""
Flask Chat Web Application

Provides a chat interface that:
- Accepts user messages via a REST API
- Runs the AI agent with MCP tools
- Returns text responses + optional HTML app content
- The frontend renders HTML responses in an iframe

Run with:
    python chat_app.py
Then open: http://localhost:5000
"""

import asyncio
import json
import os

from flask import Flask, jsonify, render_template, request

from agent import run_agent

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("chat.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    user_message = (data.get("message") or "").strip()

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    try:
        result = asyncio.run(run_agent(user_message))
        return jsonify(
            {
                "text": result["text"],
                "html": result["html"],
                "tool_calls": result["tool_calls"],
            }
        )
    except EnvironmentError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"Agent error: {e}"}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, port=port)
