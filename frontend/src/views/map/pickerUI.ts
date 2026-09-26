import { state } from "./state";
import { $ } from "./dom";
import { poiLabel } from "./format";
import { runRoute } from "./routingFlow";

const refs: Record<string, any> = {};

function updateGoBtn(): void {
  refs.goBtn.disabled = !(state.selectedStart && state.selectedEnd);
}

function renderSuggestions(query: string): void {
  if (!state.poisData) return;

  const q = query.trim().toLowerCase();

  const matches = state.poisData.features
    .filter((f: any) => poiLabel(f).toLowerCase().includes(q))
    .slice(0, 30);

  refs.suggestionsEl.innerHTML = "";

  if (matches.length === 0) {
    refs.suggestionsEl.classList.add("hidden");
    return;
  }

  matches.forEach((feature: any) => {
    const li = document.createElement("li");
    li.textContent = poiLabel(feature);
    li.addEventListener("click", () => selectPoi(feature));
    refs.suggestionsEl.appendChild(li);
  });

  refs.suggestionsEl.classList.remove("hidden");
}

function selectPoi(feature: any): void {
  if (state.activeField === "start") {
    state.selectedStart = feature;
    refs.startInput.value = poiLabel(feature);
  } else if (state.activeField === "end") {
    state.selectedEnd = feature;
    refs.endInput.value = poiLabel(feature);
  }

  refs.suggestionsEl.classList.add("hidden");
  updateGoBtn();
}

export function collapsePickerSheet(startName: string, endName: string): void {
  refs.pickerSummaryTextEl.textContent = `${startName} → ${endName}`;
  refs.pickerSheetEl.classList.add("collapsed");
}

export function expandPickerSheet(): void {
  refs.pickerSheetEl.classList.remove("collapsed");
}

export function initPickerUI(): void {
  refs.startInput = $("start-input");
  refs.endInput = $("end-input");
  refs.suggestionsEl = $("picker-suggestions");
  refs.goBtn = $("go-btn");
  refs.swapBtn = $("swap-btn");
  refs.pickerSheetEl = $("picker-sheet");
  refs.pickerSummaryEl = $("picker-summary");
  refs.pickerSummaryTextEl = $("picker-summary-text");
  refs.pickerEditBtn = $("picker-edit-btn");

  $("back-btn")?.addEventListener("click", () => {
    history.length > 1 ? history.back() : window.close();
  });

  refs.startInput.addEventListener("focus", () => {
    state.activeField = "start";
    renderSuggestions(refs.startInput.value);
  });

  refs.endInput.addEventListener("focus", () => {
    state.activeField = "end";
    renderSuggestions(refs.endInput.value);
  });

  refs.startInput.addEventListener("input", () => {
    state.selectedStart = null;
    updateGoBtn();
    renderSuggestions(refs.startInput.value);
  });

  refs.endInput.addEventListener("input", () => {
    state.selectedEnd = null;
    updateGoBtn();
    renderSuggestions(refs.endInput.value);
  });

  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement)?.closest("#picker-sheet")) {
      refs.suggestionsEl.classList.add("hidden");
    }
  });

  refs.swapBtn.addEventListener("click", () => {
    [state.selectedStart, state.selectedEnd] = [state.selectedEnd, state.selectedStart];
    refs.startInput.value = state.selectedStart ? poiLabel(state.selectedStart) : "";
    refs.endInput.value = state.selectedEnd ? poiLabel(state.selectedEnd) : "";
    updateGoBtn();
  });

  refs.goBtn.addEventListener("click", () => {
    if (!state.selectedStart || !state.selectedEnd) return;
    runRoute(state.selectedStart, state.selectedEnd);
  });

  refs.pickerSummaryEl.addEventListener("click", expandPickerSheet);
  refs.pickerEditBtn.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
    expandPickerSheet();
  });
}
