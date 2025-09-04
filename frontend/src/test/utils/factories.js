export function makeFile(name = 'file.txt', type = 'text/plain', content = 'hello') {
  return new File([content], name, { type });
}
export function makeFormData(fields = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

