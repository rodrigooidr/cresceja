export function estimateItemHeight(msg) {
  // basic estimate; could be improved with text length, attachments, etc.
  return 64;
}

export function computeWindow({ scrollTop = 0, viewportHeight = 0, itemHeights = [], overscan = 10 }) {
  const n = itemHeights.length;
  let top = 0;
  let start = 0;
  while (start < n && top + itemHeights[start] < scrollTop) {
    top += itemHeights[start];
    start += 1;
  }
  let end = start;
  let visibleHeight = top;
  while (end < n && visibleHeight < scrollTop + viewportHeight) {
    visibleHeight += itemHeights[end];
    end += 1;
  }
  start = Math.max(0, start - overscan);
  end = Math.min(n, end + overscan);
  let topSpacer = 0;
  for (let i = 0; i < start; i++) topSpacer += itemHeights[i];
  let bottomSpacer = 0;
  for (let i = end; i < n; i++) bottomSpacer += itemHeights[i];
  return { start, end, topSpacer, bottomSpacer };
}
