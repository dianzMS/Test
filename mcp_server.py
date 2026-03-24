"""
Custom MCP (Model Context Protocol) Server

This server exposes tools that the AI agent can call.
Run this with: python mcp_server.py
Or let the agent start it automatically via stdio.
"""

import json
import math

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Custom AI Agent Tools")


@mcp.tool()
def get_weather(city: str) -> str:
    """Get current weather for a city (simulated data for demo purposes)."""
    weather_data = {
        "beijing": {"temp": 22, "condition": "Sunny", "humidity": 45, "wind": "10 km/h NE"},
        "shanghai": {"temp": 26, "condition": "Cloudy", "humidity": 72, "wind": "15 km/h E"},
        "new york": {"temp": 18, "condition": "Rainy", "humidity": 85, "wind": "20 km/h S"},
        "london": {"temp": 12, "condition": "Foggy", "humidity": 90, "wind": "8 km/h W"},
        "tokyo": {"temp": 24, "condition": "Partly Cloudy", "humidity": 65, "wind": "12 km/h SE"},
        "sydney": {"temp": 28, "condition": "Clear", "humidity": 55, "wind": "18 km/h NW"},
    }
    city_lower = city.lower()
    data = weather_data.get(city_lower, {"temp": 20, "condition": "Clear", "humidity": 60, "wind": "5 km/h"})
    return json.dumps({"city": city, **data})


@mcp.tool()
def calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression using standard math functions.

    Supports: +, -, *, /, **, sqrt, sin, cos, tan, log, pi, e, etc.
    Example: 'sqrt(144) + pi * 2'
    """
    import ast as _ast
    import operator as _op

    _OPERATORS = {
        _ast.Add: _op.add,
        _ast.Sub: _op.sub,
        _ast.Mult: _op.mul,
        _ast.Div: _op.truediv,
        _ast.Pow: _op.pow,
        _ast.USub: _op.neg,
        _ast.UAdd: _op.pos,
    }
    _MATH_FUNCS = {k: getattr(math, k) for k in dir(math) if not k.startswith("_")}

    def _eval(node):
        if isinstance(node, _ast.Constant):
            if not isinstance(node.value, (int, float)):
                raise ValueError(f"Unsupported constant type: {type(node.value)}")
            return node.value
        if isinstance(node, _ast.BinOp):
            op = _OPERATORS.get(type(node.op))
            if op is None:
                raise ValueError(f"Unsupported operator: {node.op}")
            return op(_eval(node.left), _eval(node.right))
        if isinstance(node, _ast.UnaryOp):
            op = _OPERATORS.get(type(node.op))
            if op is None:
                raise ValueError(f"Unsupported unary operator: {node.op}")
            return op(_eval(node.operand))
        if isinstance(node, _ast.Call):
            if not isinstance(node.func, _ast.Name):
                raise ValueError("Only direct math function calls are supported")
            func = _MATH_FUNCS.get(node.func.id)
            if func is None:
                raise ValueError(f"Unknown function: {node.func.id}")
            args = [_eval(a) for a in node.args]
            return func(*args)
        if isinstance(node, _ast.Name):
            val = _MATH_FUNCS.get(node.id)
            if val is None or not isinstance(val, (int, float)):
                raise ValueError(f"Unknown name: {node.id}")
            return val
        raise ValueError(f"Unsupported expression node: {type(node)}")

    try:
        tree = _ast.parse(expression, mode="eval")
        result = _eval(tree.body)
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {e}"


@mcp.tool()
def generate_html_app(title: str, items: str, chart_type: str = "cards") -> str:
    """Generate an interactive HTML web application to display data visually in the chat.

    Args:
        title: The title of the HTML app/dashboard.
        items: Comma-separated key:value pairs, e.g. "Sales:1200,Costs:800,Profit:400".
        chart_type: Visual style - "cards", "bars", or "table".

    Returns:
        A complete HTML document that can be rendered directly in the browser.
    """
    parsed = []
    for item in items.split(","):
        item = item.strip()
        if ":" in item:
            key, _, value = item.partition(":")
            parsed.append((key.strip(), value.strip()))
        elif item:
            parsed.append((item, ""))

    if chart_type == "bars":
        content = _build_bar_chart(parsed)
    elif chart_type == "table":
        content = _build_table(parsed)
    else:
        content = _build_cards(parsed)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }}
    .container {{
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }}
    h1 {{
      color: #333;
      margin-bottom: 24px;
      font-size: 1.8rem;
      border-bottom: 3px solid #667eea;
      padding-bottom: 12px;
    }}
    .cards {{ display: flex; flex-wrap: wrap; gap: 16px; }}
    .card {{
      flex: 1 1 180px;
      background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }}
    .card-label {{ font-size: 0.9rem; color: #666; margin-bottom: 8px; }}
    .card-value {{ font-size: 1.6rem; font-weight: bold; color: #667eea; }}
    .bar-chart {{ display: flex; flex-direction: column; gap: 12px; }}
    .bar-row {{ display: flex; align-items: center; gap: 12px; }}
    .bar-label {{ width: 120px; font-size: 0.9rem; color: #555; text-align: right; }}
    .bar-track {{ flex: 1; background: #e9ecef; border-radius: 6px; height: 28px; overflow: hidden; }}
    .bar-fill {{
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 6px;
      display: flex;
      align-items: center;
      padding-left: 10px;
      color: white;
      font-size: 0.85rem;
      font-weight: bold;
      transition: width 0.8s ease;
    }}
    table {{ width: 100%; border-collapse: collapse; }}
    th {{ background: #667eea; color: white; padding: 12px 16px; text-align: left; }}
    td {{ padding: 10px 16px; border-bottom: 1px solid #e9ecef; }}
    tr:hover td {{ background: #f8f9fa; }}
    tr:last-child td {{ border-bottom: none; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>{title}</h1>
    {content}
  </div>
</body>
</html>"""


def _build_cards(items: list) -> str:
    cards = "".join(
        f'<div class="card"><div class="card-label">{k}</div>'
        f'<div class="card-value">{v}</div></div>'
        for k, v in items
    )
    return f'<div class="cards">{cards}</div>'


def _build_bar_chart(items: list) -> str:
    try:
        values = [float(v) for _, v in items if v]
        max_val = max(values) if values else 1
    except ValueError:
        return _build_cards(items)

    rows = ""
    for i, (label, value) in enumerate(items):
        try:
            pct = int(float(value) / max_val * 100)
        except ValueError:
            pct = 0
        rows += (
            f'<div class="bar-row">'
            f'<div class="bar-label">{label}</div>'
            f'<div class="bar-track">'
            f'<div class="bar-fill" style="width:{pct}%">{value}</div>'
            f"</div></div>"
        )
    return f'<div class="bar-chart">{rows}</div>'


def _build_table(items: list) -> str:
    rows = "".join(f"<tr><td>{k}</td><td><strong>{v}</strong></td></tr>" for k, v in items)
    return (
        "<table><thead><tr><th>Item</th><th>Value</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
