"use strict";

const state = { base: null, sections: [], items: [], selected: null };

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(path, opts);
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error((data && data.error) || ("HTTP " + resp.status));
  return data;
}

function sourceLink(item) {
  if (!item.source) return "";
  const live = state.base &&
    state.sections.find((s) => s.file === item.source && s.anchor === item.anchor);
  if (!live) return '<span class="badge moved">' + esc(item.source) + "</span>";
  const href = "vscode://file/" + state.base + "/" + live.file + ":" + live.line;
  return '<a href="' + esc(href) + '">open notes</a>';
}

function renderDue() {
  const today = todayStr();
  const rows = [];
  for (const item of state.items) {
    for (const review of item.reviews) {
      if (!review.done_at && review.due_date <= today) rows.push({ item, review });
    }
  }
  const el = $("#due-list");
  if (rows.length === 0) {
    el.innerHTML = '<p class="empty">Nothing due. Go grind something.</p>';
    return;
  }
  el.innerHTML = rows.map(({ item, review }) =>
    '<div class="row">' +
      '<span class="badge step">+' + review.step + "d</span>" +
      "<strong>" + esc(item.label) + "</strong>" +
      sourceLink(item) +
      '<button data-done="' + review.id + '">Done</button>' +
    "</div>"
  ).join("");
}

function renderAll() {
  const el = $("#all-list");
  if (state.items.length === 0) {
    el.innerHTML = '<p class="empty">No items yet.</p>';
    return;
  }
  el.innerHTML = state.items.map((item) => {
    const chips = item.reviews.map((r) => {
      const cls = r.done_at ? "done" : (r.due_date <= todayStr() ? "duenow" : "future");
      return '<span class="chip ' + cls + '">+' + r.step + "d " +
        r.due_date.slice(5) + (r.done_at ? " ✓" : "") + "</span>";
    }).join("");
    return '<div class="card">' +
      "<strong>" + esc(item.label) + "</strong> " + sourceLink(item) +
      '<div class="meta">grinded ' + esc(item.first_date) + "</div>" +
      '<div class="chips">' + chips + "</div>" +
      '<button class="danger" data-del="' + item.id + '">Delete</button>' +
      "</div>";
  }).join("");
}

async function loadAll() {
  const [sec, items, settings] = await Promise.all([
    api("GET", "/api/sections"),
    api("GET", "/api/items"),
    api("GET", "/api/settings"),
  ]);
  state.base = sec.base;
  state.sections = sec.sections;
  state.items = items;
  $("#ladder").value = settings.ladder;
  $("#search-wrap").classList.toggle("hidden", state.sections.length === 0);
  renderDue();
  renderAll();
}

async function refreshItems() {
  state.items = await api("GET", "/api/items");
  renderDue();
  renderAll();
}

function renderSearch() {
  const q = $("#search").value.trim().toLowerCase();
  const el = $("#search-results");
  if (!q) { el.innerHTML = ""; return; }
  const matches = state.sections.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 50);
  el.innerHTML = matches.map((s, i) =>
    '<div class="result" data-idx="' + i + '">' + esc(s.label) + "</div>"
  ).join("") || '<p class="empty">No matching sections.</p>';
  el.querySelectorAll(".result").forEach((node, i) => {
    node.addEventListener("click", () => {
      state.selected = { label: matches[i].label, source: matches[i].file, anchor: matches[i].anchor };
      $("#selected-section").textContent = "Selected: " + matches[i].label;
      $("#selected-section").classList.remove("hidden");
      $("#search-results").innerHTML = "";
      $("#search").value = "";
    });
  });
}

async function saveItem() {
  const manual = $("#manual-label").value.trim();
  const candidate = manual ? { label: manual, source: null, anchor: null } : state.selected;
  if (!candidate) return;
  const item = await api("POST", "/api/items", {
    label: candidate.label, source: candidate.source, anchor: candidate.anchor, first_date: todayStr(),
  });
  state.selected = null;
  $("#selected-section").classList.add("hidden");
  $("#manual-label").value = "";
  $("#add-confirm").textContent = "Saved. Reviews due: " + item.reviews.map((r) => r.due_date).join(", ");
  await refreshItems();
}

document.addEventListener("click", async (event) => {
  const done = event.target.getAttribute && event.target.getAttribute("data-done");
  const del = event.target.getAttribute && event.target.getAttribute("data-del");
  if (done) {
    await api("POST", "/api/reviews/" + done + "/done");
    await refreshItems();
  } else if (del) {
    await api("DELETE", "/api/items/" + del);
    await refreshItems();
  }
});

$("#tabs").addEventListener("click", (event) => {
  const tab = event.target.getAttribute("data-tab");
  if (!tab) return;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b === event.target));
  document.querySelectorAll(".tab").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
});

$("#search").addEventListener("input", renderSearch);
$("#add-save").addEventListener("click", saveItem);
$("#manual-label").addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveItem();
});

$("#ladder-save").addEventListener("click", async () => {
  try {
    await api("POST", "/api/settings", { ladder: $("#ladder").value.trim() });
    $("#settings-msg").textContent = "Saved.";
  } catch (err) {
    $("#settings-msg").textContent = "Error: " + err.message;
  }
});

loadAll();
