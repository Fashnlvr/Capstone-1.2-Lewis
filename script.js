"use strict";

/**
 * Listing Lab (POC)
 * Proves: guided input workflow + dynamic UI + local persistence + responsiveness
 */

const STORAGE_KEY = "listingLabPOC:v1";
let hasTriedSave = false;

const els = {
  deviceHint: document.getElementById("deviceHint"),
  saveHint: document.getElementById("saveHint"),
  form: document.getElementById("listingForm"),

  itemName: document.getElementById("itemName"),
  brand: document.getElementById("brand"),
  category: document.getElementById("category"),
  condition: document.getElementById("condition"),
  price: document.getElementById("price"),
  notes: document.getElementById("notes"),

  saveBtn: document.getElementById("saveBtn"),
  clearBtn: document.getElementById("clearBtn"),
  copyBtn: document.getElementById("copyBtn"),

  preview: document.getElementById("preview"),
  progressLabel: document.getElementById("progressLabel"),
  progressBar: document.getElementById("progressBar"),
  statusMsg: document.getElementById("statusMsg"),

  priceError: document.getElementById("priceError"),
  guideHint: document.getElementById("guideHint"),
  suggestedRange: document.getElementById("suggestedRange"),
  useSuggestedBtn: document.getElementById("useSuggestedBtn"),
};

function nowISO() {
  return new Date().toISOString();
}

function getDataFromUI() {
  const rawPrice = els.price.value.trim();
  const priceNum = rawPrice === "" ? "" : Number(rawPrice);

  return {
    itemName: els.itemName.value.trim(),
    brand: els.brand.value.trim(),
    category: els.category.value,
    condition: els.condition.value,
    price: priceNum,
    notes: els.notes.value.trim(),
    lastUpdated: nowISO(),
  };
}

function setUIFromData(data) {
  els.itemName.value = data.itemName ?? "";
  els.brand.value = data.brand ?? "";
  els.category.value = data.category ?? "";
  els.condition.value = data.condition ?? "";
  els.price.value = data.price === "" || data.price === undefined ? "" : String(data.price);
  els.notes.value = data.notes ?? "";
}

function isPriceValid(price) {
  if (price === "") return false;
  return Number.isFinite(price) && price >= 0;
}

function completenessCount(data) {
  let count = 0;
  if (data.itemName) count++;
  if (data.category) count++;
  if (data.condition) count++;
  if (data.price !== "" && isPriceValid(data.price)) count++;
  return count;
}

const BASE_RANGES = {
  Tops: [10, 35],
  Bottoms: [15, 45],
  Dresses: [20, 70],
  Outerwear: [25, 90],
  Shoes: [20, 80],
  Bags: [25, 120],
  Accessories: [8, 40],
};

const CONDITION_MULTIPLIER = {
  "New with tags": 1.0,
  "Like new": 0.85,
  "Good": 0.7,
  "Fair": 0.5,
};

const PREMIUM_BRANDS = new Set([
  "reformation",
  "madewell",
  "everlane",
  "anthropologie",
  "free people",
  "lululemon",
  "patagonia",
  "nike",
  "adidas",
  "coach",
  "tory burch",
  "kate spade",
]);

function getSuggestedRange(data) {
  if (!data.category || !data.condition) return null;
  const base = BASE_RANGES[data.category];
  const multiplier = CONDITION_MULTIPLIER[data.condition];
  if (!base || !multiplier) return null;

  let low = Math.round(base[0] * multiplier);
  let high = Math.round(base[1] * multiplier);

  if (data.brand) {
    const normalized = data.brand.trim().toLowerCase();
    if (PREMIUM_BRANDS.has(normalized)) {
      low = Math.round(low * 1.25);
      high = Math.round(high * 1.25);
    }
  }

  return [low, high];
}

function buildExportSummary(data) {
  const title = data.itemName ? data.itemName : "(Untitled item)";
  const lines = [];
  const suggested = getSuggestedRange(data);

  lines.push(`Title: ${title}`);
  if (data.brand) lines.push(`Brand: ${data.brand}`);
  if (data.category) lines.push(`Category: ${data.category}`);
  lines.push(`Condition: ${data.condition || "(Not selected)"}`);
  lines.push(`Price: ${data.price === "" ? "(Not set)" : `$${data.price}`}`);
  if (suggested) lines.push(`Suggested range (POC): $${suggested[0]}-$${suggested[1]}`);

  if (data.notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(data.notes);
  }

  lines.push("");
  lines.push(`Last updated: ${new Date(data.lastUpdated).toLocaleString()}`);

  return lines.join("\n");
}

function render() {
  const data = getDataFromUI();

  // Validation: price
  const priceMissing = data.price === "";
  const priceOk = isPriceValid(data.price);
  const showPriceError = hasTriedSave && (priceMissing || !priceOk);
  els.priceError.hidden = !showPriceError;
  if (showPriceError) {
    els.priceError.textContent = priceMissing
      ? "Price is required."
      : "Price must be 0 or greater.";
    els.statusMsg.textContent = "Fix price to continue.";
  }

  // Progress
  const complete = completenessCount(data);
  els.progressBar.value = complete;
  els.progressLabel.textContent = `Completeness: ${complete}/4`;

  // Status messaging
  if (!showPriceError) {
    if (complete === 0) els.statusMsg.textContent = "Start by adding an item name.";
    if (complete === 1) els.statusMsg.textContent = "Add category and condition to see pricing help.";
    if (complete === 2) els.statusMsg.textContent = "Great - add a list price to finish.";
    if (complete === 3) els.statusMsg.textContent = "Almost there - complete the last required field.";
    if (complete === 4) els.statusMsg.textContent = "Ready to export";
  }

  const suggested = getSuggestedRange(data);
  if (!data.category || !data.condition) {
    els.guideHint.textContent = "Select a category and condition to see a range.";
    els.suggestedRange.textContent = "$-- to $--";
    els.useSuggestedBtn.disabled = true;
  } else if (suggested) {
    els.guideHint.textContent = "Based on category, condition, and brand (if provided).";
    els.suggestedRange.textContent = `$${suggested[0]} to $${suggested[1]}`;
    els.useSuggestedBtn.disabled = false;
  } else {
    els.guideHint.textContent = "No range available yet for this selection.";
    els.suggestedRange.textContent = "$-- to $--";
    els.useSuggestedBtn.disabled = true;
  }

  // Preview
  els.preview.textContent = buildExportSummary(data);
}

function saveToStorage() {
  const data = getDataFromUI();
  hasTriedSave = true;

  // Don't save invalid price states (keeps stored data clean)
  if (data.price === "" || !isPriceValid(data.price)) {
    els.saveHint.textContent = "Not saved (fix price)";
    render();
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  els.saveHint.textContent = `Saved locally - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    setUIFromData(data);
    els.saveHint.textContent = "Loaded saved progress";
    return true;
  } catch {
    return false;
  }
}

function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  setUIFromData({ itemName: "", brand: "", category: "", condition: "", price: "", notes: "" });
  els.saveHint.textContent = "Cleared";
  render();
}

async function copySummary() {
  const text = els.preview.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = "Copied ";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 1200);
  } catch {
    // Fallback: select text
    els.copyBtn.textContent = "Copy failed";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 1200);
  }
}

function updateDeviceHint() {
  const w = window.innerWidth;
  if (w < 520) els.deviceHint.textContent = "Mobile layout";
  else if (w < 860) els.deviceHint.textContent = "Tablet layout";
  else els.deviceHint.textContent = "Desktop layout";
}

// Events
["input", "change"].forEach((evt) => {
  els.itemName.addEventListener(evt, render);
  els.brand.addEventListener(evt, render);
  els.category.addEventListener(evt, render);
  els.condition.addEventListener(evt, render);
  els.price.addEventListener(evt, render);
  els.notes.addEventListener(evt, render);
});

els.saveBtn.addEventListener("click", () => {
  saveToStorage();
  render();
});

els.clearBtn.addEventListener("click", () => {
  if (confirm("Clear this listing and remove saved progress?")) clearAll();
});

els.copyBtn.addEventListener("click", copySummary);
els.useSuggestedBtn.addEventListener("click", () => {
  const data = getDataFromUI();
  const suggested = getSuggestedRange(data);
  if (!suggested) return;
  const mid = Math.round((suggested[0] + suggested[1]) / 2);
  els.price.value = String(mid);
  render();
});

window.addEventListener("resize", updateDeviceHint);

// Init
updateDeviceHint();
loadFromStorage();
render();
