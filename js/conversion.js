// js/conversion.js
// The conversion flow is a full-screen panel that overlays the app.
// State machine: confirm → loading-questions → questions → generating → result
// Errors: rendered inline in the body with a retry button.

import { addConversion, getSource } from "./data.js";

const panel = () => document.getElementById("conversion-panel");

let state = null; // active flow state, null when panel closed

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (opts.style) {
    for (const [k, v] of Object.entries(opts.style)) {
      node.style[k] = v;
    }
  }
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  if (opts.onInput) node.addEventListener("input", opts.onInput);
  if (opts.onKeydown) node.addEventListener("keydown", opts.onKeydown);
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function clearPanel() {
  panel().innerHTML = "";
}

function renderHeader({ stateLabel, showProgress = false, progress = null } = {}) {
  const header = el("div", { class: "cp-header" });

  const exitBtn = el(
    "button",
    {
      class: "cp-exit",
      onClick: () => exitFlow(),
    },
    ["✕ Exit"]
  );
  header.appendChild(exitBtn);

  header.appendChild(
    el("div", {
      class: "cp-state-label",
      text: stateLabel || "",
    })
  );

  if (showProgress && progress != null) {
    header.appendChild(
      el("div", { class: "cp-progress", text: `Q ${progress} / 5` })
    );
    header.appendChild(
      el("div", {
        class: "cp-progress-bar",
        style: { width: `${(progress / 5) * 100}%` },
      })
    );
  } else {
    header.appendChild(el("div", { class: "cp-progress", text: "" }));
  }
  return header;
}

function renderBody(content) {
  const body = el("div", { class: "cp-body" });
  const inner = el("div", { class: "cp-body-inner" });
  inner.appendChild(content);
  body.appendChild(inner);
  return body;
}

function renderFooter(content) {
  const footer = el("div", { class: "cp-footer" });
  const inner = el("div", { class: "cp-footer-inner" });
  if (content) inner.appendChild(content);
  footer.appendChild(inner);
  return footer;
}

// ---------- API ----------

async function apiGenerate(payload) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

// ---------- states ----------

function renderConfirm() {
  clearPanel();
  const source = state.sourceId ? getSource(state.sourceId) : null;
  const editableText = state.insight;

  panel().appendChild(
    renderHeader({ stateLabel: "Step 1 of 3 · Confirm" })
  );

  const body = el("div");
  body.appendChild(
    el("div", { class: "cp-confirm-label", text: "Converting" })
  );
  if (source) {
    body.appendChild(
      el("div", { class: "cp-source-tag" }, [
        el("div", {
          class: "dot",
          style: { background: source.color },
        }),
        el("span", { text: source.title }),
      ])
    );
  } else {
    body.appendChild(
      el("div", { class: "cp-source-tag" }, [
        el("span", { text: "Quick convert — no source linked" }),
      ])
    );
  }

  body.appendChild(
    el("div", { class: "cp-highlight-card", text: editableText })
  );

  body.appendChild(
    el("div", {
      class: "cp-confirm-label",
      text: "Edit before converting",
      style: { marginTop: "16px" },
    })
  );

  const textarea = el("textarea", {
    class: "cp-edit-textarea",
    attrs: { placeholder: "Edit the insight text..." },
  });
  textarea.value = editableText;
  textarea.addEventListener("input", () => {
    state.insight = textarea.value;
  });
  body.appendChild(textarea);

  panel().appendChild(renderBody(body));

  const footerContent = el("div", { style: { display: "flex", gap: "8px" } }, [
    el(
      "button",
      {
        class: "btn btn-primary btn-block",
        onClick: () => {
          if (!state.insight.trim()) return;
          state.editedInsight = state.insight.trim();
          goLoadingQuestions();
        },
      },
      ["Begin Interrogation →"]
    ),
  ]);
  panel().appendChild(renderFooter(footerContent));

  // auto focus
  setTimeout(() => textarea.focus(), 50);
}

function renderLoadingQuestions(retryFn) {
  clearPanel();
  panel().appendChild(renderHeader({ stateLabel: "Preparing" }));
  const body = el("div", { class: "cp-centered" }, [
    el("div", { class: "spinner spinner-24" }),
    el("div", { class: "cp-loading-text", text: "Generating questions..." }),
  ]);
  panel().appendChild(renderBody(body));
  panel().appendChild(renderFooter(null));
}

function renderQuestions() {
  clearPanel();
  const idx = state.questionIdx; // 0..4
  const q = state.questions[idx];
  panel().appendChild(
    renderHeader({
      stateLabel: "Interrogation",
      showProgress: true,
      progress: idx + 1,
    })
  );

  const body = el("div");
  body.appendChild(
    el("div", { class: "cp-q-num", text: `0${idx + 1} —` })
  );
  body.appendChild(el("div", { class: "cp-q-text", text: q }));

  panel().appendChild(renderBody(body));

  const footer = el("div");
  footer.appendChild(
    el("div", { class: "cp-answer-label", text: "Your Answer" })
  );

  const textarea = el("textarea", {
    class: "cp-answer-textarea",
    attrs: { placeholder: "Answer honestly..." },
  });
  textarea.value = state.answers[idx] || "";
  textarea.addEventListener("input", () => {
    state.answers[idx] = textarea.value;
    nextBtn.disabled = textarea.value.trim().length < 3;
  });
  footer.appendChild(textarea);

  const nextBtn = el(
    "button",
    {
      class: "btn btn-primary btn-block",
      onClick: () => {
        if (nextBtn.disabled) return;
        state.answers[idx] = textarea.value;
        if (idx === 4) {
          goGenerating();
        } else {
          state.questionIdx = idx + 1;
          renderQuestions();
        }
      },
    },
    [idx === 4 ? "Generate Intention →" : "Next →"]
  );
  nextBtn.disabled = textarea.value.trim().length < 3;

  footer.appendChild(nextBtn);
  panel().appendChild(renderFooter(footer));

  setTimeout(() => textarea.focus(), 50);
}

function renderGenerating() {
  clearPanel();
  panel().appendChild(renderHeader({ stateLabel: "Synthesizing" }));
  const body = el("div", { class: "cp-centered" }, [
    el("div", { class: "spinner spinner-40" }),
    el("div", {
      class: "cp-loading-text",
      text: "Synthesizing your responses",
    }),
    el("div", {
      class: "cp-loading-sub",
      text: "Building your implementation intention...",
    }),
  ]);
  panel().appendChild(renderBody(body));
  panel().appendChild(renderFooter(null));
}

function renderResult() {
  clearPanel();
  panel().appendChild(
    renderHeader({ stateLabel: "Step 3 of 3 · Result" })
  );

  const body = el("div");
  body.appendChild(
    el("div", {
      class: "cp-confirm-label",
      text: "Implementation Intention",
    })
  );

  body.appendChild(
    el("div", { class: "cp-result-card" }, [
      el("div", { class: "cp-if-then", text: state.intentionFull }),
      el("div", { class: "cp-divider" }),
      el("div", { class: "cp-why-label", text: "Why This Works" }),
      el("div", { class: "cp-why-text", text: state.intentionWhy }),
    ])
  );

  panel().appendChild(renderBody(body));

  const footer = el("div", { style: { display: "flex", gap: "8px" } }, [
    el(
      "button",
      {
        class: "btn btn-ghost",
        style: { flex: "0 0 auto" },
        onClick: () => {
          navigator.clipboard.writeText(
            `${state.intentionFull}\n\nWhy: ${state.intentionWhy}`
          );
          window.Praxis.toast("Copied to clipboard");
        },
      },
      ["Copy"]
    ),
    el(
      "button",
      {
        class: "btn btn-primary",
        style: { flex: "1" },
        onClick: () => {
          saveAndClose();
        },
      },
      ["Save & Close →"]
    ),
  ]);
  panel().appendChild(renderFooter(footer));
}

function renderError(message, retryFn, stateLabel) {
  clearPanel();
  panel().appendChild(renderHeader({ stateLabel: stateLabel || "Error" }));
  const body = el("div", { class: "cp-centered" }, [
    el("div", { class: "cp-error", text: message }),
    el(
      "button",
      {
        class: "btn btn-ghost",
        onClick: () => retryFn(),
      },
      ["Retry"]
    ),
  ]);
  panel().appendChild(renderBody(body));
  panel().appendChild(renderFooter(null));
}

// ---------- transitions ----------

async function goLoadingQuestions() {
  renderLoadingQuestions();
  try {
    const res = await apiGenerate({
      type: "questions",
      insight: state.editedInsight,
    });
    if (!res.questions || res.questions.length !== 5) {
      throw new Error("Received malformed response from server.");
    }
    state.questions = res.questions;
    state.questionIdx = 0;
    state.answers = new Array(5).fill("");
    renderQuestions();
  } catch (err) {
    renderError(
      err.message || "Failed to generate questions.",
      () => goLoadingQuestions(),
      "Questions failed"
    );
  }
}

async function goGenerating() {
  renderGenerating();
  // Build Q&A transcript
  const qa = state.questions
    .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${state.answers[i] || ""}`)
    .join("\n\n");
  try {
    const res = await apiGenerate({
      type: "intention",
      insight: state.editedInsight,
      qa,
    });
    if (!res.full || !res.why) {
      throw new Error("Received malformed response from server.");
    }
    state.intentionFull = res.full;
    state.intentionWhy = res.why;
    renderResult();
  } catch (err) {
    renderError(
      err.message || "Failed to synthesize intention.",
      () => goGenerating(),
      "Synthesis failed"
    );
  }
}

function saveAndClose() {
  addConversion({
    highlightId: state.highlightId,
    sourceId: state.sourceId,
    insight: state.editedInsight,
    questions: state.questions,
    answers: state.answers,
    intentionFull: state.intentionFull,
    intentionWhy: state.intentionWhy,
  });
  window.Praxis.toast("Conversion saved");
  exitFlow();
}

function exitFlow() {
  state = null;
  panel().classList.remove("open");
  panel().setAttribute("aria-hidden", "true");
  clearPanel();
  // Re-render current view so the "converted ✓" tag shows up
  if (window.Praxis && window.Praxis.rerenderCurrent) {
    window.Praxis.rerenderCurrent();
  }
}

// ---------- public API ----------

export function startConversion({ insight, highlightId, sourceId }) {
  state = {
    insight,
    editedInsight: insight,
    highlightId: highlightId || null,
    sourceId: sourceId || null,
    questions: [],
    answers: [],
    questionIdx: 0,
    intentionFull: "",
    intentionWhy: "",
  };
  panel().classList.add("open");
  panel().setAttribute("aria-hidden", "false");
  renderConfirm();
}

export function isConversionOpen() {
  return panel().classList.contains("open");
}

export function exitConversion() {
  exitFlow();
}
