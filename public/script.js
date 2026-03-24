const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const modelSelect = document.getElementById("model-select");

let conversationHistory = [];

// Add a plain text message bubble
function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// Tool display names
const TOOL_LABELS = {
  render_webapp: "Rendering web app",
  get_current_time: "Getting current time",
  calculate: "Calculating",
};

// Show a tool-call indicator bubble while a tool is running
function addToolCallIndicator(toolName) {
  const div = document.createElement("div");
  div.className = "message tool-call";
  const label = TOOL_LABELS[toolName] || toolName;
  div.innerHTML =
    `<span class="tool-icon">🔧</span>` +
    `<span class="tool-name">${label}</span>` +
    `<span class="tool-status">Running…</span>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// Update a tool-call indicator once the result is available
function updateToolCallIndicator(div, resultJson) {
  const statusEl = div.querySelector(".tool-status");
  if (!statusEl) return;
  try {
    const parsed = JSON.parse(resultJson);
    if (parsed.error) {
      statusEl.textContent = `Failed: ${parsed.error}`;
      statusEl.className = "tool-status error";
    } else {
      const display =
        parsed.result ??
        parsed.datetime ??
        (parsed.rendered ? "Done" : JSON.stringify(parsed));
      statusEl.textContent = `✓ ${display}`;
      statusEl.className = "tool-status done";
    }
  } catch {
    statusEl.textContent = "✓ Done";
    statusEl.className = "tool-status done";
  }
}

// Escape HTML for safe insertion into innerHTML
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render a webapp returned by the AI inside a sandboxed iframe
function addWebApp(title, html) {
  const wrapper = document.createElement("div");
  wrapper.className = "message webapp-message";

  const header = document.createElement("div");
  header.className = "webapp-header";
  header.innerHTML =
    `<span class="webapp-icon">🖥️</span>` +
    `<span class="webapp-title">${escapeHtml(title)}</span>`;

  const iframe = document.createElement("iframe");
  iframe.className = "webapp-iframe";
  // allow-scripts only — iframe has null origin so it cannot access parent cookies/storage
  iframe.setAttribute("sandbox", "allow-scripts allow-forms");
  iframe.title = escapeHtml(title);
  iframe.srcdoc = html;

  wrapper.appendChild(header);
  wrapper.appendChild(iframe);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrapper;
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}

input.addEventListener("input", autoResize);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event("submit"));
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });

  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  const assistantDiv = addMessage("assistant", "");
  assistantDiv.classList.add("typing-indicator");

  // Map tool_call id → indicator <div> so we can update it on tool_result
  const toolDivs = {};
  let fullContent = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversationHistory,
        model: modelSelect.value,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Split on newlines; keep incomplete last line in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        if (raw === "[DONE]") break;

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // Skip malformed chunks
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (parsed.tool_call) {
          // Show tool indicator and pause the assistant typing animation
          const toolDiv = addToolCallIndicator(parsed.tool_call.name);
          toolDivs[parsed.tool_call.id] = toolDiv;
          assistantDiv.classList.remove("typing-indicator");
        }

        if (parsed.tool_result) {
          const toolDiv = toolDivs[parsed.tool_result.id];
          if (toolDiv) updateToolCallIndicator(toolDiv, parsed.tool_result.result);
        }

        if (parsed.webapp) {
          addWebApp(parsed.webapp.title, parsed.webapp.html);
        }

        if (parsed.content) {
          fullContent += parsed.content;
          assistantDiv.textContent = fullContent;
          // Resume typing cursor while text is streaming
          assistantDiv.classList.add("typing-indicator");
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }
    }

    assistantDiv.classList.remove("typing-indicator");

    if (fullContent) {
      conversationHistory.push({ role: "assistant", content: fullContent });
    } else if (!assistantDiv.textContent) {
      // No text response — remove the empty bubble
      assistantDiv.remove();
    }
  } catch (error) {
    assistantDiv.remove();
    addMessage("error", `Error: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});
