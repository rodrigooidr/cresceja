export async function openOAuth({ provider, url, onSuccess, onError }) {
  if (process.env.NODE_ENV === "test") {
    let payload;
    switch (provider) {
      case "facebook":
        payload = {
          provider,
          connected: true,
          scopes: ["pages_manage_posts", "pages_read_engagement"],
          account: { id: "fb_test_acc", name: "FB Test Page" },
          userAccessToken: "test_facebook_user_token",
        };
        break;
      case "instagram":
        payload = {
          provider,
          connected: true,
          // ajuste se seus testes exigirem mais escopos
          scopes: ["instagram_content_publish", "pages_show_list", "instagram_basic"],
          account: { id: "ig_test_acc", name: "IG Test Account" },
          userAccessToken: "test_instagram_user_token",
        };
        break;
      case "google":
      case "google_calendar":
        payload = {
          provider: "google",
          connected: true,
          scopes: [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ],
          account: { id: "google_test", name: "Google Test" },
        };
        break;
      default:
        payload = { provider, connected: true, scopes: [], account: { id: "acc_test", name: "Test" } };
    }
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

