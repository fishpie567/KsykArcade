const state = {
  user: null,
  config: null,
  listeners: new Set(),
};

function setUser(user) {
  state.user = user;
  notify();
}

function setConfig(config) {
  state.config = config;
  notify();
}

function subscribe(listener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function notify() {
  state.listeners.forEach((listener) => listener(state));
}

export { state, setUser, setConfig, subscribe };
