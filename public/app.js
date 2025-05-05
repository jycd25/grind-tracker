"use strict";

const state = { items: [] };

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
      '<span class="badge">+' + review.step + "d</span>" +
      "<strong>" + esc(item.label) + "</strong>" +
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
      "<strong>" + esc(item.label) + "</strong>" +
      '<div class="meta">grinded ' + esc(item.first_date) + "</div>" +
      '<div class="chips">' + chips + "</div>" +
      '<button class="danger" data-del="' + item.id + '">Delete</button>' +
      "</div>";
  }).join("");
}

async function loadAll() {
  const [items, settings] = await Promise.all([
    api("GET", "/api/items"),
    api("GET", "/api/settings"),
  ]);
  state.items = items;
  $("#ladder").value = settings.ladder;
  renderDue();
  renderAll();
}

async function refreshItems() {
  state.items = await api("GET", "/api/items");
  renderDue();
  renderAll();
}

async function saveItem() {
  const label = $("#manual-label").value.trim();
  if (!label) return;
  const item = await api("POST", "/api/items", { label: label, first_date: todayStr() });
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
