export function suggestionTitle(item, index) {
  if (!item) {
    return typeof index === 'number' ? `Sugestão ${index + 1}` : 'Sugestão';
  }

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (title) {
    return title;
  }

  const headline = typeof item.copy_json?.headline === 'string'
    ? item.copy_json.headline.trim()
    : '';
  if (headline) {
    return headline;
  }

  return typeof index === 'number' ? `Sugestão ${index + 1}` : 'Sugestão';
}

export default suggestionTitle;
