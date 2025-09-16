export function createEmitter() {
  const map = new Map();
  return {
    on(evt, cb) {
      const arr = map.get(evt) || [];
      arr.push(cb);
      map.set(evt, arr);
      return () => this.off(evt, cb);
    },
    off(evt, cb) {
      const arr = map.get(evt) || [];
      const i = arr.indexOf(cb);
      if (i >= 0) arr.splice(i, 1);
      map.set(evt, arr);
    },
    emit(evt, payload) {
      (map.get(evt) || []).forEach((cb) => {
        try {
          cb(payload);
        } catch {}
      });
    },
    clear() {
      map.clear();
    },
  };
}
