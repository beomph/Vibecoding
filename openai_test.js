const $ = (sel) => document.querySelector(sel);

const promptEl = $("#prompt");
const modelEl = $("#model");
const tempEl = $("#temperature");
const sendBtn = $("#sendBtn");
const clearBtn = $("#clearBtn");
const outEl = $("#output");
const rawEl = $("#raw");
const statusEl = $("#status");

function setStatus(text, kind = "info") {
  statusEl.textContent = text || "";
  statusEl.style.color =
    kind === "error" ? "var(--danger)" :
    kind === "ok" ? "var(--ok)" :
    "var(--muted)";
}

function setLoading(on) {
  sendBtn.disabled = on;
  clearBtn.disabled = on;
  promptEl.disabled = on;
  modelEl.disabled = on;
  tempEl.disabled = on;
  setStatus(on ? "요청 중..." : "");
}

function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

clearBtn.addEventListener("click", () => {
  promptEl.value = "";
  outEl.textContent = "";
  rawEl.textContent = "";
  setStatus("");
  promptEl.focus();
});

sendBtn.addEventListener("click", async () => {
  const input = (promptEl.value || "").trim();
  if (!input) {
    setStatus("메시지를 입력하세요.", "error");
    promptEl.focus();
    return;
  }

  const model = modelEl.value;
  const temperature = Number(tempEl.value);

  const payload = {
    input,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
  };

  setLoading(true);
  outEl.textContent = "";
  rawEl.textContent = pretty({ request: payload });

  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    rawEl.textContent = pretty({ request: payload, response: data, http: { status: res.status } });

    if (!res.ok) {
      throw new Error(data?.error || `요청 실패 (HTTP ${res.status})`);
    }

    outEl.textContent = data?.text ?? "";
    setStatus("완료", "ok");
  } catch (e) {
    setStatus(e?.message || "오류가 발생했습니다.", "error");
  } finally {
    setLoading(false);
  }
});

