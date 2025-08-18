export function getPayload() {
  try {
    const tok = localStorage.getItem("token") || "";
    const part = tok.split(".")[1] || "";
    return JSON.parse(atob(part)) || {};
  } catch {
    return {};
  }
}

export const role = () => getPayload().role || null;
export const can = (perm) => !!getPayload().permissions?.[perm];
