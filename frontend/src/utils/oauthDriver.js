export async function openOAuth({ provider, url, onSuccess, onError }) {
  if (process.env.NODE_ENV === "test") {
    const payload = {
      provider,
      connected: true,
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      account: { id: "fb_test_acc", name: "FB Test Page" },
    };
    onSuccess?.(payload);
    return { close: () => {} };
  }

  try {
    const w = window.open(url, "_blank", "width=600,height=700");
    if (!w) throw new Error("Popup bloqueado");
    return { close: () => w.close() };
  } catch (e) {
    onError?.(e);
    return { close: () => {} };
  }
}

