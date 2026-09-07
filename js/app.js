// js/app.js
// Main app: router, sidebar, topbar, modals, context menu, toasts,
// import .txt, keyboard shortcuts, init.

import {
  getSources,
  getSource,
  getHighlights,
  addSource,
  updateSource,
  deleteSource,
  addHighlight,
  updateHighlight,
  getStorageUsage,
  initDataLayer,
  seedIfEmpty,
  uploadOriginalFile,
} from "./data.js";
import {
  renderHome,
  renderSource,
  renderConversions,
  renderSettings,
  formatDate,
} from "./ui.js";
import { startConversion, isConversionOpen, exitConversion } from "./conversion.js";

// ---------- DOM helpers ----------

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

// ---------- expose Praxis global API for ui.js & conversion.js ----------

window.Praxis = {
  startConversion,
  renderSidebar,
  rerenderCurrent,
  openAddHighlightModal,
  openAddNoteModal,
  openConfirmDelete,
  openContextMenu,
  importTxt,
  toast,
  closeSidebarMobile,
};

// ---------- THEME ----------

const THEME_KEY = "praxis_theme";
const THEME_COLORS = {
  dark: "#0a0a0f",
  light: "#f4f6fb",
};

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function updateThemeColorMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

function syncThemeToggleButton() {
  const btn = document.querySelector(".theme-toggle-btn");
  if (!btn) return;
  const icon = btn.querySelector(".theme-toggle-icon");
  const isLight = getCurrentTheme() === "light";
  if (icon) icon.textContent = isLight ? "☀" : "☾";
  const nextMode = isLight ? "dark" : "light";
  btn.setAttribute("aria-label", `Switch to ${nextMode} mode`);
  btn.setAttribute("title", `Switch to ${nextMode} mode`);
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === "light" ? "light" : "dark";
  if (next === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  updateThemeColorMeta(next);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }
  syncThemeToggleButton();
}

function toggleTheme() {
  applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}

function createThemeToggleButton() {
  const isLight = getCurrentTheme() === "light";
  const nextMode = isLight ? "dark" : "light";
  const btn = el(
    "button",
    {
      class: "btn theme-toggle-btn",
      attrs: {
        type: "button",
        "aria-label": `Switch to ${nextMode} mode`,
        title: `Switch to ${nextMode} mode`,
      },
      onClick: () => toggleTheme(),
    },
    [el("span", { class: "theme-toggle-icon", text: isLight ? "☀" : "☾" })]
  );
  return btn;
}

// ---------- SIDEBAR ----------

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";

  // Logo
  const logo = el("div", { class: "sidebar-logo" }, [
    el("div", { class: "pulse-dot" }),
    el("div", { class: "logo-text", text: "PRAXIS" }),
  ]);
  sidebar.appendChild(logo);

  // Nav section
  const nav = el("div", { class: "sidebar-section" });
  nav.appendChild(
    el("div", { class: "sidebar-section-label", text: "Workspace" })
  );

  const routes = [
    { hash: "#home", icon: "⌂", label: "Home" },
    { hash: "#conversions", icon: "✦", label: "Conversions" },
    { hash: "#settings", icon: "○", label: "Settings" },
  ];

  const currentHash = location.hash.split("?")[0] || "#home";

  for (const r of routes) {
    const item = el(
      "div",
      {
        class: `sidebar-nav-item ${
          currentHash === r.hash ? "active" : ""
        }`,
        onClick: () => {
          location.hash = r.hash;
          closeSidebarMobile();
        },
      },
      [
        el("span", { class: "icon", text: r.icon }),
        el("span", { text: r.label }),
      ]
    );
    nav.appendChild(item);
  }
  sidebar.appendChild(nav);

  // Sources section
  const sourcesWrap = el("div", { class: "sidebar-sources" });
  sourcesWrap.appendChild(
    el("div", { class: "sidebar-sources-header" }, [
      el("div", { class: "sidebar-section-label", text: "Sources" }),
      el(
        "button",
        {
          class: "sidebar-add-source",
          text: "+",
          onClick: () => openAddSourceModal(),
        }
      ),
    ])
  );

  const sources = getSources();
  if (sources.length === 0) {
    sourcesWrap.appendChild(
      el("div", {
        class: "t-micro",
        style: { padding: "8px 12px" },
        text: "No sources yet. Click +.",
      })
    );
  } else {
    for (const s of sources) {
      const isActive =
        currentHash.startsWith("#source/") &&
        currentHash.split("/")[1]?.split("?")[0] === s.id;
      const item = el(
        "div",
        {
          class: `source-item ${isActive ? "active" : ""}`,
          dataset: { id: s.id },
          onClick: () => {
            location.hash = `#source/${s.id}`;
            closeSidebarMobile();
          },
        },
        [
          el("div", {
            class: "source-dot",
            style: { background: s.color },
          }),
          el("div", { class: "source-title", text: s.title }),
          el("div", {
            class: "source-type-icon",
            text: typeIcon(s.type),
          }),
        ]
      );

      // Right-click context menu (desktop)
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, [
          {
            label: "Rename",
            onClick: () => openRenameSourceModal(s.id),
          },
          {
            label: "Delete Source",
            danger: true,
            onClick: () =>
              openConfirmDelete({
                title: `Delete "${s.title}"?`,
                message:
                  "This will also delete all highlights and conversions for this source.",
                onConfirm: async () => {
                  try {
                    await deleteSource(s.id);
                    renderSidebar();
                    if (
                      location.hash.startsWith(`#source/${s.id}`)
                    ) {
                      location.hash = "#home";
                    } else {
                      rerenderCurrent();
                    }
                    toast("Source deleted");
                  } catch (err) {
                    toast(err.message || "Failed to delete source");
                  }
                },
              }),
          },
        ]);
      });

      // Long-press context menu (mobile)
      attachLongPress(item, (x, y) => {
        openContextMenu(x, y, [
          {
            label: "Rename",
            onClick: () => openRenameSourceModal(s.id),
          },
          {
            label: "Delete Source",
            danger: true,
            onClick: () =>
              openConfirmDelete({
                title: `Delete "${s.title}"?`,
                message:
                  "This will also delete all highlights and conversions for this source.",
                onConfirm: async () => {
                  try {
                    await deleteSource(s.id);
                    renderSidebar();
                    if (location.hash.startsWith(`#source/${s.id}`)) {
                      location.hash = "#home";
                    } else {
                      rerenderCurrent();
                    }
                    toast("Source deleted");
                  } catch (err) {
                    toast(err.message || "Failed to delete source");
                  }
                },
              }),
          },
        ]);
      });

      sourcesWrap.appendChild(item);
    }
  }
  sidebar.appendChild(sourcesWrap);

  // Bottom storage
  const usage = getStorageUsage();
  const bottom = el("div", { class: "sidebar-bottom" }, [
    el("div", { class: "sidebar-storage-label" }, [
      el("div", { class: "t-micro", text: "Local Storage" }),
      el("div", {
        class: "t-micro",
        text: `${usage.percent.toFixed(1)}%`,
      }),
    ]),
    el("div", { class: "sidebar-storage-bar" }, [
      el("div", {
        class: "sidebar-storage-fill",
        style: { width: `${Math.max(2, usage.percent)}%` },
      }),
    ]),
  ]);
  sidebar.appendChild(bottom);
}

function typeIcon(type) {
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

function attachLongPress(node, handler) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  node.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    timer = setTimeout(() => {
      timer = null;
      handler(startX, startY);
      // Prevent the click that follows
      e.preventDefault();
    }, 550);
  });
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  node.addEventListener("touchmove", (e) => {
    if (!timer) return;
    const t = e.touches[0];
    if (
      Math.abs(t.clientX - startX) > 10 ||
      Math.abs(t.clientY - startY) > 10
    ) {
      cancel();
    }
  });
  node.addEventListener("touchend", cancel);
  node.addEventListener("touchcancel", cancel);
}

// ---------- TOPBAR ----------

function updateTopbar(title, actions = []) {
  const topbar = document.getElementById("topbar");
  topbar.innerHTML = "";

  // Left: hamburger + breadcrumb (desktop) / page title (mobile)
  const left = el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minWidth: 0,
      flex: 1,
    },
  });

  left.appendChild(
    el(
      "button",
      {
        class: "topbar-hamburger",
        onClick: () => openSidebarMobile(),
      },
      ["≡"]
    )
  );

  // Breadcrumb (desktop)
  const crumb = el("div", { class: "topbar-breadcrumb" });
  crumb.appendChild(el("span", { text: "Praxis" }));
  crumb.appendChild(el("span", { class: "crumb-sep", text: "/" }));
  crumb.appendChild(el("span", { class: "crumb-current", text: title }));
  left.appendChild(crumb);

  // Mobile page title
  left.appendChild(
    el("div", { class: "topbar-page-title-mobile", text: title })
  );

  topbar.appendChild(left);

  // Right: actions
  const right = el("div", { class: "topbar-actions" });
  right.appendChild(createThemeToggleButton());
  for (const a of actions) {
    right.appendChild(a);
  }
  topbar.appendChild(right);
}

// ---------- ROUTER ----------

let currentRoute = { name: "home", param: null, query: {} };

function parseHash() {
  let h = location.hash || "#home";
  const [path, queryStr] = h.split("?");
  const query = {};
  if (queryStr) {
    for (const pair of queryStr.split("&")) {
      const [k, v] = pair.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
  }
  if (path === "#home" || path === "" || path === "#") {
    return { name: "home", param: null, query };
  }
  if (path === "#conversions") {
    return { name: "conversions", param: null, query };
  }
  if (path === "#settings") {
    return { name: "settings", param: null, query };
  }
  if (path.startsWith("#source/")) {
    return { name: "source", param: path.slice("#source/".length), query };
  }
  return { name: "home", param: null, query };
}

function router() {
  // If conversion panel is open, don't re-render underneath
  if (isConversionOpen()) return;

  const route = parseHash();
  currentRoute = route;

  switch (route.name) {
    case "home":
      renderHome();
      updateTopbar("Home", []);
      break;
    case "conversions":
      renderConversions();
      updateTopbar("Conversions", []);
      break;
    case "settings":
      renderSettings();
      updateTopbar("Settings", []);
      break;
    case "source": {
      const source = getSource(route.param);
      if (!source) {
        renderHome();
        updateTopbar("Home", []);
        break;
      }
      renderSource(route.param, { highlightId: route.query.h || null });
      const actions = [
        el(
          "button",
          {
            class: "btn btn-primary btn-sm",
            onClick: () => openAddHighlightModal(route.param),
          },
          ["+ Add Highlight"]
        ),
      ];
      updateTopbar(source.title, actions);
      break;
    }
    default:
      renderHome();
      updateTopbar("Home", []);
  }

  // Update sidebar active states
  renderSidebar();
}

function rerenderCurrent() {
  router();
}

window.addEventListener("hashchange", router);

// ---------- MOBILE SIDEBAR ----------

function openSidebarMobile() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
}

function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
}

document.getElementById("sidebar-overlay").addEventListener("click", () => {
  closeSidebarMobile();
});

// ---------- MODALS ----------

function modalRoot() {
  return document.getElementById("modal-root");
}

function openModal(contentNode) {
  const root = modalRoot();
  root.innerHTML = "";
  root.appendChild(contentNode);
  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const root = modalRoot();
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = "";
}

modalRoot().addEventListener("click", (e) => {
  if (e.target === modalRoot()) closeModal();
});

function modalHeader(title) {
  return el("div", { class: "modal-header" }, [
    el("div", { class: "modal-title", text: title }),
    el(
      "button",
      {
        class: "modal-close",
        text: "×",
        onClick: () => closeModal(),
      },
      []
    ),
  ]);
}

// ---------- MODAL: Add Source ----------

function openAddSourceModal() {
  let selectedType = "book";

  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader("New Source"));

  const body = el("div", { class: "modal-body" });

  // Title
  body.appendChild(
    el("div", { class: "form-group" }, [
      el("label", { class: "form-label", text: "Title" }),
      (function () {
        const inp = el("input", {
          class: "form-input",
          attrs: { placeholder: "e.g. Atomic Habits", autofocus: "true" },
        });
        return inp;
      })(),
    ])
  );

  // Type
  const typeGroup = el("div", { class: "form-group" }, [
    el("label", { class: "form-label", text: "Type" }),
  ]);
  const pillRow = el("div", { class: "type-pill-row" });
  const types = ["book", "article", "podcast", "video", "custom"];
  const pills = {};
  for (const t of types) {
    const p = el(
      "button",
      {
        class: `type-pill ${t === selectedType ? "selected" : ""}`,
        text: t,
        onClick: () => {
          selectedType = t;
          for (const [k, el2] of Object.entries(pills)) {
            el2.classList.toggle("selected", k === t);
          }
        },
      },
      []
    );
    pills[t] = p;
    pillRow.appendChild(p);
  }
  typeGroup.appendChild(pillRow);
  body.appendChild(typeGroup);

  // Author
  body.appendChild(
    el("div", { class: "form-group" }, [
      el("label", { class: "form-label", text: "Author (optional)" }),
      el("input", {
        class: "form-input",
        attrs: { placeholder: "e.g. James Clear" },
      }),
    ])
  );

  modal.appendChild(body);

  // Footer
  const footer = el("div", { class: "modal-footer" }, [
    el(
      "button",
      { class: "btn btn-ghost", onClick: () => closeModal() },
      ["Cancel"]
    ),
    el(
      "button",
      {
        class: "btn btn-primary",
        onClick: async () => {
          const titleInput = modal.querySelector(
            ".form-group:nth-child(1) .form-input"
          );
          const authorInput = modal.querySelector(
            ".form-group:nth-child(3) .form-input"
          );
          const title = titleInput.value.trim();
          if (!title) {
            titleInput.focus();
            return;
          }
          try {
            const source = await addSource({
              title,
              type: selectedType,
              author: authorInput.value.trim(),
            });
            closeModal();
            renderSidebar();
            location.hash = `#source/${source.id}`;
            toast("Source created");
          } catch (err) {
            toast(err.message || "Failed to create source");
          }
        },
      },
      ["Create Source →"]
    ),
  ]);
  modal.appendChild(footer);

  openModal(modal);
  setTimeout(() => {
    const firstInput = modal.querySelector(".form-input");
    if (firstInput) firstInput.focus();
  }, 80);
}

// ---------- MODAL: Rename Source ----------

function openRenameSourceModal(sourceId) {
  const source = getSource(sourceId);
  if (!source) return;

  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader("Rename Source"));

  const body = el("div", { class: "modal-body" });
  body.appendChild(
    el("div", { class: "form-group" }, [
      el("label", { class: "form-label", text: "Title" }),
      (function () {
        const inp = el("input", {
          class: "form-input",
          attrs: { value: source.title },
        });
        return inp;
      })(),
    ])
  );
  modal.appendChild(body);

  modal.appendChild(
    el("div", { class: "modal-footer" }, [
      el(
        "button",
        { class: "btn btn-ghost", onClick: () => closeModal() },
        ["Cancel"]
      ),
      el(
        "button",
        {
          class: "btn btn-primary",
          onClick: async () => {
            const inp = modal.querySelector(".form-input");
            const v = inp.value.trim();
            if (!v) {
              inp.focus();
              return;
            }
            try {
              await updateSource(sourceId, { title: v });
              closeModal();
              renderSidebar();
              rerenderCurrent();
              toast("Renamed");
            } catch (err) {
              toast(err.message || "Failed to rename source");
            }
          },
        },
        ["Save"]
      ),
    ])
  );

  openModal(modal);
  setTimeout(() => {
    const inp = modal.querySelector(".form-input");
    if (inp) {
      inp.focus();
      inp.select();
    }
  }, 80);
}

// ---------- MODAL: Add Highlight ----------

function openAddHighlightModal(sourceId, opts = {}) {
  const source = getSource(sourceId);
  if (!source) return;

  let tags = [];

  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader("Add Highlight"));

  const body = el("div", { class: "modal-body" });

  // Text
  const textGroup = el("div", { class: "form-group" }, [
    el("label", { class: "form-label", text: "Highlight Text" }),
  ]);
  const textarea = el("textarea", {
    class: "form-textarea",
    attrs: {
      rows: "6",
      placeholder: "Paste or type the passage that struck you...",
    },
  });
  textGroup.appendChild(textarea);
  body.appendChild(textGroup);

  // Tags
  const tagsGroup = el("div", { class: "form-group" }, [
    el("label", { class: "form-label", text: "Tags" }),
  ]);
  const tagRow = el("div", { class: "tag-input-row" });
  const tagInput = el("input", {
    attrs: { placeholder: "Add tag, press Enter" },
  });

  function renderTagPills() {
    // Remove existing pills (everything before the input)
    while (tagRow.firstChild && tagRow.firstChild !== tagInput) {
      tagRow.removeChild(tagRow.firstChild);
    }
    for (const t of tags) {
      const pill = el("div", { class: "tag-input-pill" }, [
        el("span", { text: t }),
        el(
          "span",
          {
            class: "x",
            text: "×",
            onClick: () => {
              tags = tags.filter((x) => x !== t);
              renderTagPills();
            },
          },
          []
        ),
      ]);
      tagRow.insertBefore(pill, tagInput);
    }
  }

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = tagInput.value.trim().replace(/,$/, "");
      if (v && !tags.includes(v)) {
        tags.push(v);
        tagInput.value = "";
        renderTagPills();
      }
    } else if (e.key === "Backspace" && !tagInput.value && tags.length) {
      tags.pop();
      renderTagPills();
    }
  });
  tagRow.appendChild(tagInput);
  tagsGroup.appendChild(tagRow);
  body.appendChild(tagsGroup);

  // Note
  const noteGroup = el("div", { class: "form-group" }, [
    el("label", { class: "form-label", text: "Your Annotation" }),
    el("textarea", {
      class: "form-textarea",
      attrs: { rows: "3", placeholder: "Optional — your own thought on this..." },
    }),
  ]);
  body.appendChild(noteGroup);

  modal.appendChild(body);

  modal.appendChild(
    el("div", { class: "modal-footer" }, [
      el(
        "button",
        { class: "btn btn-ghost", onClick: () => closeModal() },
        ["Cancel"]
      ),
      el(
        "button",
        {
          class: "btn btn-primary",
          onClick: async () => {
            const text = textarea.value.trim();
            if (!text) {
              textarea.focus();
              return;
            }
            const note = noteGroup.querySelector("textarea").value.trim();
            try {
              await addHighlight({
                sourceId,
                text,
                tags: [...tags],
                note,
              });
              closeModal();
              renderSidebar();
              rerenderCurrent();
              toast("Highlight added");
            } catch (err) {
              toast(err.message || "Failed to add highlight");
            }
          },
        },
        ["Save Highlight →"]
      ),
    ])
  );

  openModal(modal);
  setTimeout(() => {
    textarea.focus();
  }, 80);
}

// ---------- MODAL: Add Note ----------

function openAddNoteModal(highlightId) {
  const hl = getHighlights().find((h) => h.id === highlightId);
  if (!hl) return;

  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader("Add Note"));

  const body = el("div", { class: "modal-body" });
  body.appendChild(
    el("div", {
      class: "highlight-note",
      style: { marginBottom: "12px" },
      text: hl.text,
    })
  );
  body.appendChild(
    el("div", { class: "form-group" }, [
      el("label", { class: "form-label", text: "Your Annotation" }),
      (function () {
        const ta = el("textarea", {
          class: "form-textarea",
          attrs: { rows: "4", placeholder: "What does this mean to you?" },
        });
        ta.value = hl.note || "";
        return ta;
      })(),
    ])
  );
  modal.appendChild(body);

  modal.appendChild(
    el("div", { class: "modal-footer" }, [
      el(
        "button",
        { class: "btn btn-ghost", onClick: () => closeModal() },
        ["Cancel"]
      ),
      el(
        "button",
        {
          class: "btn btn-primary",
          onClick: async () => {
            const ta = modal.querySelector(".form-textarea");
            try {
              await updateHighlight(highlightId, { note: ta.value.trim() });
              closeModal();
              rerenderCurrent();
              toast("Note saved");
            } catch (err) {
              toast(err.message || "Failed to save note");
            }
          },
        },
        ["Save"]
      ),
    ])
  );

  openModal(modal);
  setTimeout(() => modal.querySelector(".form-textarea").focus(), 80);
}

// ---------- MODAL: Confirm Delete ----------

function openConfirmDelete({
  title,
  message,
  onConfirm,
  confirmLabel = "Delete",
}) {
  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader(title));

  const body = el("div", { class: "modal-body" });
  body.appendChild(
    el("div", {
      style: { fontSize: "13px", color: "var(--text2)", lineHeight: "1.7" },
      text: message,
    })
  );
  modal.appendChild(body);

  modal.appendChild(
    el("div", { class: "modal-footer" }, [
      el(
        "button",
        { class: "btn btn-ghost", onClick: () => closeModal() },
        ["Cancel"]
      ),
      el(
        "button",
        {
          class: "btn btn-danger",
          onClick: () => {
            closeModal();
            onConfirm && onConfirm();
          },
        },
        [confirmLabel]
      ),
    ])
  );

  openModal(modal);
}

// ---------- CONTEXT MENU ----------

function ctxRoot() {
  return document.getElementById("context-menu-root");
}

function openContextMenu(x, y, items) {
  const root = ctxRoot();
  root.innerHTML = "";

  const menu = el("div", { class: "context-menu" });
  for (const it of items) {
    menu.appendChild(
      el(
        "div",
        {
          class: `context-menu-item ${it.danger ? "danger" : ""}`,
          text: it.label,
          onClick: () => {
            closeContextMenu();
            it.onClick && it.onClick();
          },
        },
        []
      )
    );
  }
  root.appendChild(menu);

  // Position
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + rect.width > vw - 8) left = vw - rect.width - 8;
  if (top + rect.height > vh - 8) top = vh - rect.height - 8;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
}

function closeContextMenu() {
  const root = ctxRoot();
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = "";
}

ctxRoot().addEventListener("click", (e) => {
  if (e.target === ctxRoot()) closeContextMenu();
});

document.addEventListener("click", (e) => {
  // Close context menu on any outside click
  const root = ctxRoot();
  if (!root.classList.contains("open")) return;
  if (!root.contains(e.target)) closeContextMenu();
});

// ---------- TOAST ----------

function toast(message) {
  const container = document.getElementById("toast-container");
  const t = el("div", { class: "toast", text: message });
  container.appendChild(t);
  setTimeout(() => {
    if (t.parentNode) t.parentNode.removeChild(t);
  }, 2700);
}

// ---------- IMPORT .TXT ----------

function importTxt(sourceId) {
  const input = document.getElementById("hidden-file-input");
  input.value = "";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      // Split by double newline
      const chunks = text
        .split(/\n\s*\n/)
        .map((c) => c.trim())
        .filter((c) => c.length > 20);
      let count = 0;
      for (const c of chunks) {
        try {
          await addHighlight({ sourceId, text: c, tags: [] });
          count++;
        } catch (err) {
          toast(err.message || "Failed to import some highlights");
          break;
        }
      }
      if (count === 0) {
        toast("No highlights found in file");
      } else {
        toast(`Imported ${count} highlight${count !== 1 ? "s" : ""}`);
      }
      try {
        await uploadOriginalFile({ file, sourceId });
      } catch (err) {
        toast(
          `Highlights imported, but file backup to R2 failed: ${
            err.message || "Upload failed"
          }`
        );
      }
      renderSidebar();
      rerenderCurrent();
    };
    reader.onerror = () => toast("Failed to read file");
    reader.readAsText(file);
  };
  input.click();
}

// ---------- KEYBOARD SHORTCUTS ----------

document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl + K → focus search (we'll surface a toast & focus breadcrumb
  // search affordance — for now we just open a quick search box via prompt
  // replacement: focus the topbar's first input if present, else toast)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openQuickSearch();
    return;
  }
  // Escape → close any modal or conversion panel
  if (e.key === "Escape") {
    if (isConversionOpen()) {
      exitConversion();
      return;
    }
    if (modalRoot().classList.contains("open")) {
      closeModal();
      return;
    }
    if (ctxRoot().classList.contains("open")) {
      closeContextMenu();
      return;
    }
    closeSidebarMobile();
  }
});

function openQuickSearch() {
  // Inline search modal
  const modal = el("div", { class: "modal" });
  modal.appendChild(modalHeader("Search"));

  const body = el("div", { class: "modal-body" });
  const input = el("input", {
    class: "form-input",
    attrs: { placeholder: "Search sources, highlights, conversions..." },
  });
  body.appendChild(input);

  const results = el("div", {
    style: { marginTop: "12px", maxHeight: "300px", overflowY: "auto" },
  });
  body.appendChild(results);

  function doSearch(q) {
    results.innerHTML = "";
    const ql = q.toLowerCase().trim();
    if (!ql) {
      results.appendChild(
        el("div", {
          class: "t-micro",
          style: { padding: "8px 4px" },
          text: "Start typing to search across all your data.",
        })
      );
      return;
    }

    const sources = getSources().filter((s) =>
      s.title.toLowerCase().includes(ql)
    );
    const highlights = getHighlights().filter(
      (h) =>
        h.text.toLowerCase().includes(ql) ||
        (h.note || "").toLowerCase().includes(ql)
    );

    if (sources.length === 0 && highlights.length === 0) {
      results.appendChild(
        el("div", {
          class: "t-micro",
          style: { padding: "8px 4px" },
          text: "No matches.",
        })
      );
      return;
    }

    if (sources.length) {
      results.appendChild(
        el("div", {
          class: "t-label",
          style: { padding: "4px" },
          text: "Sources",
        })
      );
      for (const s of sources) {
        results.appendChild(
          el(
            "div",
            {
              class: "source-item",
              onClick: () => {
                closeModal();
                location.hash = `#source/${s.id}`;
              },
            },
            [
              el("div", {
                class: "source-dot",
                style: { background: s.color },
              }),
              el("div", { class: "source-title", text: s.title }),
            ]
          )
        );
      }
    }

    if (highlights.length) {
      results.appendChild(
        el("div", {
          class: "t-label",
          style: { padding: "4px", marginTop: "8px" },
          text: "Highlights",
        })
      );
      for (const h of highlights.slice(0, 12)) {
        const src = getSource(h.sourceId);
        results.appendChild(
          el(
            "div",
            {
              class: "source-item",
              onClick: () => {
                closeModal();
                if (src)
                  location.hash = `#source/${src.id}?h=${h.id}`;
              },
            },
            [
              el("div", {
                class: "source-dot",
                style: { background: src ? src.color : "#555" },
              }),
              el("div", {
                class: "source-title",
                text: h.text.slice(0, 70) + (h.text.length > 70 ? "…" : ""),
              }),
            ]
          )
        );
      }
    }
  }

  input.addEventListener("input", () => doSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = results.querySelector(".source-item");
      if (first) first.click();
    }
  });

  modal.appendChild(body);
  modal.appendChild(
    el("div", { class: "modal-footer" }, [
      el("div", {
        class: "t-micro",
        text: "Press Esc to close",
      }),
    ])
  );

  openModal(modal);
  doSearch("");
  setTimeout(() => input.focus(), 80);
}

// ---------- INIT ----------

async function init() {
  applyTheme(getInitialTheme(), { persist: false });
  await initDataLayer();
  await seedIfEmpty();
  renderSidebar();
  if (!location.hash) location.hash = "#home";
  router();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      toast(err.message || "Failed to initialize app");
    });
  });
} else {
  init().catch((err) => {
    toast(err.message || "Failed to initialize app");
  });
}
