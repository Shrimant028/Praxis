// js/ui.js
// Render functions for each Praxis view. Each clears #content and renders fresh.
// Imports from data.js. Exposes navigation helpers + toast + escapeHtml utilities.

import {
  getSources,
  getSource,
  getHighlights,
  getHighlight,
  getConversions,
  getStorageUsage,
  clearAll,
} from "./data.js";

// ---------- shared helpers ----------

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getTypeIcon(type) {
  switch (type) {
    case "book":
      return "📖";
    case "article":
      return "📄";
    case "podcast":
      return "🎙";
    case "video":
      return "▶";
    default:
      return "•";
  }
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.id) node.id = opts.id;
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
  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) {
      node.dataset[k] = v;
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

// ---------- content rendering root ----------

function content() {
  return document.getElementById("content");
}

function clearContent() {
  content().innerHTML = "";
}

// ============================================================
// HOME
// ============================================================

export function renderHome() {
  clearContent();
  const root = el("div", { class: "home-page" });

  const now = new Date();
  root.appendChild(
    el("h1", {
      class: "home-greeting",
      text: `${getGreeting()}.`,
    })
  );
  root.appendChild(
    el("div", { class: "home-date", text: formatDateLong(now) })
  );

  // Stats row
  const sources = getSources();
  const highlights = getHighlights();
  const conversions = getConversions();

  const stats = el("div", { class: "home-stats" });
  stats.appendChild(
    statCard(String(sources.length), "Sources", () => {
      location.hash = "#home";
    })
  );
  stats.appendChild(
    statCard(String(highlights.length), "Highlights", () => {
      // jump to first source if exists, else home
      if (sources[0]) location.hash = `#source/${sources[0].id}`;
    })
  );
  stats.appendChild(
    statCard(String(conversions.length), "Conversions", () => {
      location.hash = "#conversions";
    })
  );
  root.appendChild(stats);

  // Recent activity
  const recentHighlights = [...highlights]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const activitySection = el("div", { class: "home-section" });
  activitySection.appendChild(
    el("div", { class: "home-section-header" }, [
      el("div", { class: "home-section-title", text: "Recent Activity" }),
    ])
  );

  if (recentHighlights.length === 0) {
    activitySection.appendChild(
      el("div", {
        class: "empty-state",
        html: `<div class="es-title">No activity yet</div><div class="es-sub">Add a source and start capturing highlights.</div>`,
      })
    );
  } else {
    const list = el("div");
    for (const h of recentHighlights) {
      const src = getSource(h.sourceId);
      list.appendChild(
        el("div", {
          class: "activity-item",
          onClick: () => {
            if (src) {
              location.hash = `#source/${src.id}?h=${h.id}`;
            }
          },
        }, [
          el("div", {
            class: "activity-dot",
            style: { background: src ? src.color : "#555" },
          }),
          el("div", {
            class: "activity-source",
            text: src ? src.title : "Unknown",
          }),
          el("div", {
            class: "activity-text",
            text: h.text,
          }),
          el("div", { class: "activity-time", text: timeAgo(h.createdAt) }),
        ])
      );
    }
    activitySection.appendChild(list);
  }
  root.appendChild(activitySection);

  // Recent conversions
  const recentConversions = [...conversions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const convSection = el("div", { class: "home-section" });
  convSection.appendChild(
    el("div", { class: "home-section-header" }, [
      el("div", {
        class: "home-section-title",
        text: "Recent Conversions",
      }),
    ])
  );

  if (recentConversions.length === 0) {
    convSection.appendChild(
      el("div", {
        class: "empty-state",
        html: `<div class="es-title">No conversions yet</div><div class="es-sub">Convert a highlight to create your first intention.</div>`,
      })
    );
  } else {
    for (const c of recentConversions) {
      const src = getSource(c.sourceId);
      convSection.appendChild(
        el("div", {
          class: "recent-conversion",
          onClick: () => {
            location.hash = "#conversions";
          },
        }, [
          el("div", {
            class: "rc-intention",
            text: c.intentionFull || "(no intention)",
          }),
          el("div", {
            class: "rc-meta",
            text: `${src ? src.title : "Unknown"} · ${formatDate(
              c.createdAt
            )}`,
          }),
        ])
      );
    }
  }
  root.appendChild(convSection);

  // Quick convert
  const qc = el("div", { class: "quick-convert" });
  qc.appendChild(
    el("div", {
      class: "quick-convert-label",
      text: "Quick Convert",
    })
  );
  const textarea = el("textarea", {
    attrs: {
      placeholder: "Paste any insight to convert it immediately...",
      rows: "3",
    },
  });
  qc.appendChild(textarea);
  const actions = el("div", { class: "quick-convert-actions" });
  const btn = el(
    "button",
    { class: "btn btn-primary" },
    ["Convert →"]
  );
  btn.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) return;
    // Trigger conversion flow with no linked highlight
    window.Praxis.startConversion({
      insight: text,
      highlightId: null,
      sourceId: null,
    });
  });
  actions.appendChild(btn);
  qc.appendChild(actions);
  root.appendChild(qc);

  content().appendChild(root);
}

function statCard(number, label, onClick) {
  return el(
    "div",
    {
      class: "stat-card",
      onClick,
    },
    [
      el("div", { class: "stat-number", text: number }),
      el("div", { class: "stat-label", text: label }),
    ]
  );
}

// ============================================================
// SOURCE PAGE
// ============================================================

export function renderSource(sourceId, opts = {}) {
  const source = getSource(sourceId);
  if (!source) {
    clearContent();
    content().appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "es-title", text: "Source not found" }),
        el("div", {
          class: "es-sub",
          text: "It may have been deleted.",
        }),
      ])
    );
    return;
  }

  clearContent();
  const root = el("div", { class: "source-page" });

  // Color bar
  root.appendChild(
    el("div", {
      class: "source-color-bar",
      style: { background: source.color },
    })
  );

  // Title (editable)
  const title = el("div", {
    class: "source-title",
    attrs: { contenteditable: "true", spellcheck: "false" },
    text: source.title,
  });
  title.addEventListener("blur", () => {
    const v = title.textContent.trim();
    if (v && v !== source.title) {
      import("./data.js").then((m) => {
        m.updateSource(sourceId, { title: v });
        window.Praxis.renderSidebar();
      });
    } else {
      title.textContent = source.title;
    }
  });
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      title.blur();
    }
  });
  root.appendChild(title);

  // Meta row
  const meta = el("div", { class: "source-meta" });
  meta.appendChild(
    el("span", { class: "type-badge", text: source.type })
  );
  meta.appendChild(el("span", { class: "source-meta-sep", text: "·" }));

  // Editable author
  const author = el("span", {
    class: "source-author",
    attrs: { contenteditable: "true", spellcheck: "false" },
    text: source.author || "Add author",
  });
  author.addEventListener("blur", () => {
    const v = author.textContent.trim();
    if (v !== source.author) {
      import("./data.js").then((m) => {
        m.updateSource(sourceId, { author: v });
      });
    } else {
      author.textContent = source.author || "Add author";
    }
  });
  author.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      author.blur();
    }
  });
  meta.appendChild(author);

  const highlights = getHighlights(sourceId);
  meta.appendChild(el("span", { class: "source-meta-sep", text: "·" }));
  meta.appendChild(
    el("span", { text: `${highlights.length} highlights` })
  );
  meta.appendChild(el("span", { class: "source-meta-sep", text: "·" }));
  meta.appendChild(
    el("span", { text: `Added ${formatDate(source.createdAt)}` })
  );
  root.appendChild(meta);

  // Highlights section
  const hlSection = el("div");
  hlSection.appendChild(
    el("div", { class: "section-label-row" }, [
      el("div", {
        class: "section-label",
        html: `Highlights <span class="count">${highlights.length}</span>`,
      }),
    ])
  );

  if (highlights.length === 0) {
    hlSection.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", {
          class: "es-title",
          text: "No highlights yet",
        }),
        el("div", {
          class: "es-sub",
          text: "Type, paste, or import highlights below.",
        }),
      ])
    );
  } else {
    // Sort by created asc for stability
    const sorted = [...highlights].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    for (const h of sorted) {
      hlSection.appendChild(renderHighlightBlock(h, source, opts.highlightId));
    }
  }

  // Add highlight area
  const addArea = el("div", { class: "add-highlight-area" });
  addArea.appendChild(
    makeGhostBtn("✏  Type", () => {
      window.Praxis.openAddHighlightModal(sourceId);
    })
  );
  addArea.appendChild(
    makeGhostBtn("⎘  Paste", () => {
      window.Praxis.openAddHighlightModal(sourceId, { focusText: true });
    })
  );
  addArea.appendChild(
    makeGhostBtn("↑  Import .txt", () => {
      window.Praxis.importTxt(sourceId);
    })
  );
  hlSection.appendChild(addArea);

  root.appendChild(hlSection);

  content().appendChild(root);

  // If a specific highlight was requested, scroll & flash
  if (opts.highlightId) {
    const block = root.querySelector(
      `.highlight-block[data-id="${opts.highlightId}"]`
    );
    if (block) {
      block.scrollIntoView({ behavior: "smooth", block: "center" });
      block.classList.add("flash");
      setTimeout(() => block.classList.remove("flash"), 1500);
    }
  }
}

function makeGhostBtn(text, onClick) {
  return el("button", { class: "btn btn-ghost", onClick }, [text]);
}

function renderHighlightBlock(h, source, flashId) {
  const block = el("div", {
    class: "highlight-block",
    dataset: { id: h.id },
    style: { borderLeftColor: source.color },
  });

  // Header
  const header = el("div", { class: "highlight-block-header" });

  const tags = el("div", { class: "highlight-tags" });
  tags.appendChild(
    el("div", {
      class: "activity-dot",
      style: { background: source.color, marginRight: "0" },
    })
  );
  for (const t of h.tags || []) {
    tags.appendChild(el("span", { class: "tag-pill", text: t }));
  }
  header.appendChild(tags);

  const menuBtn = el("button", {
    class: "highlight-menu",
    text: "⋮",
    onClick: (e) => {
      e.stopPropagation();
      const rect = menuBtn.getBoundingClientRect();
      window.Praxis.openContextMenu(rect.left, rect.bottom + 4, [
        {
          label: "Copy Text",
          onClick: () => {
            navigator.clipboard
              .writeText(h.text)
              .then(() => window.Praxis.toast("Copied"));
          },
        },
        {
          label: "Add Note",
          onClick: () => {
            window.Praxis.openAddNoteModal(h.id);
          },
        },
        {
          label: "Delete Highlight",
          danger: true,
          onClick: () => {
            window.Praxis.openConfirmDelete({
              title: "Delete this highlight?",
              message: "This cannot be undone.",
              onConfirm: () => {
                import("./data.js").then((m) => {
                  m.deleteHighlight(h.id);
                  renderSource(source.id);
                  window.Praxis.renderSidebar();
                  window.Praxis.toast("Highlight deleted");
                });
              },
            });
          },
        },
      ]);
    },
  });
  header.appendChild(menuBtn);
  block.appendChild(header);

  // Text
  block.appendChild(
    el("div", { class: "highlight-text", text: h.text })
  );

  // Note (if any)
  if (h.note) {
    block.appendChild(el("div", { class: "highlight-note", text: h.note }));
  }

  // Footer
  const footer = el("div", { class: "highlight-footer" });

  if (h.converted) {
    footer.appendChild(
      el("div", {
        class: "highlight-converted-tag",
        text: "Converted ✓",
      })
    );
  } else {
    const convertBtn = el(
      "button",
      {
        class: "btn btn-primary btn-sm",
        onClick: (e) => {
          e.stopPropagation();
          window.Praxis.startConversion({
            insight: h.text,
            highlightId: h.id,
            sourceId: source.id,
          });
        },
      },
      ["Convert →"]
    );
    footer.appendChild(convertBtn);
  }

  // Time on the right
  footer.appendChild(
    el("div", {
      class: "activity-time",
      text: timeAgo(h.createdAt),
    })
  );

  block.appendChild(footer);

  return block;
}

// ============================================================
// CONVERSIONS PAGE
// ============================================================

export function renderConversions() {
  clearContent();
  const root = el("div", { class: "conversions-page" });

  const all = getConversions().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  root.appendChild(el("h1", { class: "page-title", text: "Conversions" }));
  root.appendChild(
    el("div", {
      class: "page-subtitle",
      text: `${all.length} total`,
    })
  );

  // Filter
  const sources = getSources();
  const filterRow = el("div", { class: "filter-row" });
  const select = el("select", { class: "filter-select" });
  select.appendChild(
    el("option", { attrs: { value: "" }, text: "All Sources" })
  );
  for (const s of sources) {
    select.appendChild(
      el("option", { attrs: { value: s.id }, text: s.title })
    );
  }
  let currentFilter = "";
  select.addEventListener("change", () => {
    currentFilter = select.value;
    renderList();
  });
  filterRow.appendChild(select);
  root.appendChild(filterRow);

  const listHost = el("div");
  root.appendChild(listHost);

  function renderList() {
    listHost.innerHTML = "";
    const filtered = currentFilter
      ? all.filter((c) => c.sourceId === currentFilter)
      : all;

    if (filtered.length === 0) {
      listHost.appendChild(
        el("div", { class: "empty-state" }, [
          el("div", {
            class: "es-title",
            text: "No conversions yet",
          }),
          el("div", {
            class: "es-sub",
            text: "Convert a highlight to create your first intention.",
          }),
        ])
      );
      return;
    }

    for (const c of filtered) {
      const src = getSource(c.sourceId);
      const card = el("div", { class: "conversion-card", dataset: { id: c.id } });

      card.appendChild(
        el("div", { class: "cc-meta" }, [
          el("span", { text: src ? src.title : "Unknown" }),
          src
            ? el("span", { class: "type-badge", text: src.type })
            : null,
        ])
      );

      card.appendChild(
        el("div", { class: "cc-insight", text: c.insight })
      );
      card.appendChild(
        el("div", { class: "cc-intention", text: c.intentionFull })
      );
      card.appendChild(
        el("div", { class: "cc-why", text: `Why: ${c.intentionWhy}` })
      );
      card.appendChild(
        el("div", { class: "cc-date", text: formatDate(c.createdAt) })
      );

      card.addEventListener("click", () => {
        card.classList.toggle("expanded");
      });

      listHost.appendChild(card);
    }
  }

  renderList();
  content().appendChild(root);
}

// ============================================================
// SETTINGS PAGE
// ============================================================

export function renderSettings() {
  clearContent();
  const root = el("div", { class: "settings-page" });

  root.appendChild(el("h1", { class: "page-title", text: "Settings" }));
  root.appendChild(el("div", { class: "page-subtitle", text: " " }));

  // Storage
  const storageSection = el("div", { class: "settings-section" });
  storageSection.appendChild(
    el("div", { class: "section-label", text: "Storage" })
  );

  const usage = getStorageUsage();
  const kb = (usage.used / 1024).toFixed(1);
  storageSection.appendChild(
    el("div", {
      class: "settings-storage-bar",
    }, [
      el("div", {
        class: "settings-storage-fill",
        style: { width: `${Math.max(2, usage.percent)}%` },
      }),
    ])
  );
  storageSection.appendChild(
    el("div", {
      class: "settings-storage-meta",
      text: `${kb} KB used · ${usage.percent.toFixed(2)}% of ~5MB localStorage quota`,
    })
  );

  storageSection.appendChild(
    el("button", {
      class: "btn btn-danger",
      onClick: () => {
        window.Praxis.openConfirmDelete({
          title: "Clear all data?",
          message:
            "This will permanently delete every source, highlight, and conversion. There is no recovery.",
          confirmLabel: "Delete Everything",
          onConfirm: () => {
            clearAll();
            window.Praxis.renderSidebar();
            renderSettings();
            window.Praxis.toast("All data cleared");
          },
        });
      },
    }, ["Clear all data"])
  );

  root.appendChild(storageSection);

  // About
  const aboutSection = el("div", { class: "settings-section" });
  aboutSection.appendChild(el("div", { class: "section-label", text: "About" }));

  const about = el("div", { class: "about-block" });
  about.appendChild(el("div", { class: "about-version", text: "Praxis v2.0" }));
  about.appendChild(el("div", { class: "about-tagline", text: "Knowledge → Action" }));
  about.appendChild(
    el("div", {
      class: "about-desc",
      text: "Praxis is a personal knowledge-to-action workspace. It does not store your notes — it converts them. Every highlight goes through a five-question interrogation that surfaces the real blocker, then collapses into a single, specific implementation intention tied to an existing cue in your day. Notes rot. Intentions execute.",
    })
  );
  aboutSection.appendChild(about);
  root.appendChild(aboutSection);

  content().appendChild(root);
}
