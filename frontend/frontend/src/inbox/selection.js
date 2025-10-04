export function toggle(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function rangeToggle(currentSet, orderedIds = [], anchorId, toId) {
  const startIdx = orderedIds.indexOf(anchorId);
  const endIdx = orderedIds.indexOf(toId);
  if (startIdx === -1 || endIdx === -1) return new Set(currentSet);
  const [a,b] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  const ids = orderedIds.slice(a, b + 1);
  const allSelected = ids.every((id) => currentSet.has(id));
  const next = new Set(currentSet);
  ids.forEach((id) => {
    if (allSelected) next.delete(id); else next.add(id);
  });
  return next;
}

export function isAllPageSelected(visibleIds = [], selectedSet) {
  return visibleIds.every((id) => selectedSet.has(id));
}

export function selectAllPage(visibleIds = [], selectedSet) {
  const next = new Set(selectedSet);
  visibleIds.forEach((id) => next.add(id));
  return next;
}

export function clearAllPage(visibleIds = [], selectedSet) {
  const next = new Set(selectedSet);
  visibleIds.forEach((id) => next.delete(id));
  return next;
}

export function clearOnFilterChange(selectedSet) {
  return new Set();
}

export default {
  toggle,
  rangeToggle,
  isAllPageSelected,
  selectAllPage,
  clearAllPage,
  clearOnFilterChange,
};
