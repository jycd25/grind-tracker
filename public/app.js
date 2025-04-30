"use strict";

const state = { items: [] };

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(path, opts);
  return resp.json();
}

function renderDue() {
  const today = todayStr();
  const rows = [];
  for (const item of state.items) {
    for (const review of item.reviews) {
      if (!review.done_at && review.due_date === today) rows.push({ item, review });
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

async function refreshItems() {
  state.items = await api("GET", "/api/items");
  renderDue();
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
  if (done) {
    await api("POST", "/api/reviews/" + done + "/done");
    await refreshItems();
  }
});

$("#add-save").addEventListener("click", saveItem);
$("#manual-label").addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveItem();
});

refreshItems();
