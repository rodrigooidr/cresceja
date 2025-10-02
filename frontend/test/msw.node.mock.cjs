function setupServer(...handlers) {
  const state = { handlers: [...handlers] };
  return {
    listen() {},
    close() {},
    resetHandlers(...next) {
      state.handlers = [...next];
    },
    use(...next) {
      state.handlers.push(...next);
    },
    getHandlers() {
      return state.handlers;
    },
  };
}

module.exports = { setupServer };
