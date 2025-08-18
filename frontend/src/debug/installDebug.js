// Instala ganchos de log e rede no window.__debugStore
(function(){
  if (typeof window === "undefined") return;

  const store = window.__debugStore = {
    logs: [],    // {ts, level, args}
    net: [],     // {ts, type:'fetch'|'xhr', method,url,status,ms,body,resp}
    max: 500
  };
  const push = (arr, obj) => { arr.push(obj); if (arr.length > store.max) arr.shift(); };

  // intercept console
  ["log","info","warn","error"].forEach(level=>{
    const orig = console[level];
    console[level] = function(...args){
      try { push(store.logs, { ts: Date.now(), level, args }); } catch {}
      return orig.apply(this, args);
    };
  });

  // erros globais
  window.addEventListener("error", (e)=>{
    push(store.logs, { ts: Date.now(), level: "error", args: [e?.message || e, e?.error?.stack || ""] });
  });
  window.addEventListener("unhandledrejection", (e)=>{
    push(store.logs, { ts: Date.now(), level: "error", args: ["UnhandledRejection", e?.reason] });
  });

  // fetch
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async (input, init={})=>{
      const start = performance.now();
      let url = (typeof input === "string") ? input : (input && input.url);
      let method = (init && init.method) || "GET";
      try {
        const resp = await origFetch(input, init);
        const ms = Math.round(performance.now() - start);
        push(store.net, { ts: Date.now(), type: "fetch", method, url, status: resp.status, ms });
        return resp;
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        push(store.net, { ts: Date.now(), type: "fetch", method, url, status: "ERR", ms, err: String(err) });
        throw err;
      }
    };
  }

  // XHR
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function(method, url, ...rest){
      this.__dbg = { method, url };
      return open.apply(this, [method, url, ...rest]);
    };
    XHR.prototype.send = function(body){
      const start = performance.now();
      const onEnd = ()=>{
        const ms = Math.round(performance.now() - start);
        push(store.net, {
          ts: Date.now(), type: "xhr",
          method: this.__dbg?.method || "GET",
          url: this.__dbg?.url, status: this.status, ms
        });
        this.removeEventListener("loadend", onEnd);
      };
      this.addEventListener("loadend", onEnd);
      return send.apply(this, [body]);
    };
  }
})();
