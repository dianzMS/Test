const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const modelSelect = document.getElementById("model-select");

let conversationHistory = [];

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
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
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.content) {
            fullContent += parsed.content;
            assistantDiv.textContent = fullContent;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch (parseErr) {
          // Skip malformed chunks
        }
      }
    }

    assistantDiv.classList.remove("typing-indicator");
    conversationHistory.push({ role: "assistant", content: fullContent });
  } catch (error) {
    assistantDiv.remove();
    addMessage("error", `错误: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});
