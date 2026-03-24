import OpenAI from "openai";

export const config = {
  maxDuration: 60,
};

// System prompt that introduces the agent and its tools
const SYSTEM_MESSAGE = {
  role: "system",
  content: `You are a helpful AI assistant with access to the following tools:

1. render_webapp: Use this to create interactive web apps, visualizations, games, calculators, charts, or any HTML content that is better shown visually than described in text. Always make the HTML self-contained with inline <style> and <script> tags.
2. get_current_time: Get the current date and time in any timezone.
3. calculate: Evaluate mathematical expressions.

When a user asks for something visual, interactive, or that benefits from a web interface (charts, games, forms, animations, etc.), use render_webapp to build and display it directly in the chat.`,
};

// MCP-style tool definitions passed to the OpenAI API
const TOOLS = [
  {
    type: "function",
    function: {
      name: "render_webapp",
      description:
        "Render an interactive web application, visualization, game, calculator, chart, or any HTML content directly in the chat window. Use this when the user requests something visual or interactive. The HTML must be self-contained with inline CSS and JavaScript — do not reference external URLs.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A short descriptive title for the web app",
          },
          html: {
            type: "string",
            description:
              "A complete, self-contained HTML document with inline <style> and <script> tags. Must not load external resources.",
          },
        },
        required: ["title", "html"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time in a specified timezone.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              "IANA timezone name (e.g., 'UTC', 'America/New_York', 'Asia/Shanghai'). Defaults to UTC.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Evaluate a mathematical expression and return the result. Supports standard arithmetic operators and JavaScript's Math object (e.g., Math.sqrt, Math.PI).",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "A mathematical expression to evaluate (e.g., '2 ** 10', 'Math.sqrt(144)', 'Math.PI * 5 ** 2')",
          },
        },
        required: ["expression"],
      },
    },
  },
];

// Execute a tool call and return a JSON string result
function executeTool(name, args) {
  switch (name) {
    case "render_webapp":
      // Handled client-side; return confirmation metadata
      return JSON.stringify({ rendered: true, title: args.title });

    case "get_current_time": {
      const tz = args.timezone || "UTC";
      try {
        const now = new Date();
        const formatted = now.toLocaleString("en-US", {
          timeZone: tz,
          dateStyle: "full",
          timeStyle: "long",
        });
        return JSON.stringify({ datetime: formatted, timezone: tz, iso: now.toISOString() });
      } catch {
        return JSON.stringify({ datetime: new Date().toISOString(), timezone: "UTC" });
      }
    }

    case "calculate": {
      try {
        const expr = args.expression;
        const MAX_EXPRESSION_LENGTH = 200;
        if (typeof expr !== "string" || expr.length > MAX_EXPRESSION_LENGTH) {
          return JSON.stringify({ error: "Invalid expression" });
        }
        // Block dangerous patterns: assignments, loops, template literals, eval, prototype access, etc.
        if (
          /[=;{}`]|function\s|=>|import|require|process|global|window|document|fetch|XMLHttp|eval|constructor|__proto__|prototype|while\s*\(|for\s*\(|do\s*\{|this/.test(expr)
        ) {
          return JSON.stringify({ error: "Expression contains unsafe patterns" });
        }
        // Evaluate with only Math in scope
        // eslint-disable-next-line no-new-func
        const result = new Function("Math", `"use strict"; return (${expr})`)(Math);
        if (typeof result !== "number" && typeof result !== "bigint") {
          return JSON.stringify({ error: "Expression must evaluate to a number" });
        }
        return JSON.stringify({ result: String(result), expression: expr });
      } catch (err) {
        return JSON.stringify({ error: "Calculation failed: " + err.message });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  const { messages, model } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  const openai = new OpenAI({ apiKey });

  // Set headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Prepend system message; keep user-supplied history intact
    const conversationMessages = [SYSTEM_MESSAGE, ...messages];

    // Agentic loop: keep calling the model until it stops using tools
    let continueLoop = true;
    while (continueLoop) {
      const response = await openai.chat.completions.create({
        model: model || "gpt-4o",
        messages: conversationMessages,
        tools: TOOLS,
        tool_choice: "auto",
        stream: false,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Add assistant turn to conversation so the model sees tool results
      conversationMessages.push(message);

      if (choice.finish_reason === "tool_calls" && message.tool_calls) {
        // Process every tool call requested in this turn
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          // Notify the frontend that a tool is being called
          res.write(
            `data: ${JSON.stringify({
              tool_call: {
                id: toolCall.id,
                name: toolName,
                // Don't send full HTML in tool_call event to keep it small
                args: toolName === "render_webapp" ? { title: toolArgs.title } : toolArgs,
              },
            })}\n\n`
          );

          // For render_webapp, stream the HTML to the frontend for rendering
          if (toolName === "render_webapp") {
            res.write(
              `data: ${JSON.stringify({
                webapp: { id: toolCall.id, title: toolArgs.title, html: toolArgs.html },
              })}\n\n`
            );
          }

          // Execute the tool
          const toolResult = executeTool(toolName, toolArgs);

          // Send result summary to frontend
          res.write(
            `data: ${JSON.stringify({
              tool_result: { id: toolCall.id, name: toolName, result: toolResult },
            })}\n\n`
          );

          // Feed result back into conversation
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        // No more tool calls — stream the final text response
        continueLoop = false;
        if (message.content) {
          const content = message.content;
          const chunkSize = 30;
          for (let i = 0; i < content.length; i += chunkSize) {
            res.write(`data: ${JSON.stringify({ content: content.slice(i, i + chunkSize) })}\n\n`);
          }
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Internal server error";
    // If headers already sent, end the stream with an error event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    } else {
      res.status(status).json({ error: message });
    }
  }
}
