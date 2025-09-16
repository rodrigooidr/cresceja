export function suggestionTitle(item, idx = 0) {
  return (
    item?.title ??
    item?.name ??
    item?.caption ??
    item?.text ??
    `Sugestão IG/FB #${idx + 1}`
  );
}
