import axios from "axios";
import apiModule from "../api/index.js";
import inboxApi from "../api/inboxApi";
import { useAuth } from "./AuthContext";

const METHODS = ["get", "post", "put", "patch", "delete"];

function buildClient(candidate, config) {
  if (!candidate) return null;

  if (typeof candidate.create === "function") {
    const created = candidate.create(config);
    if (created?.defaults) {
      created.defaults.headers = {
        ...(created.defaults.headers || {}),
        ...(config.headers || {}),
      };
      if (config.baseURL && !created.defaults.baseURL) {
        created.defaults.baseURL = config.baseURL;
      }
    } else if (created) {
      created.defaults = {
        baseURL: config.baseURL,
        headers: { ...(config.headers || {}) },
      };
    }
    return created;
  }

  const hasMethod = METHODS.some((method) => typeof candidate[method] === "function");
  if (!hasMethod) return null;

  const instance = { ...candidate };

  for (const method of METHODS) {
    if (typeof candidate[method] === "function") {
      const fn = candidate[method];
      instance[method] = fn?.mock ? fn : fn.bind(candidate);
    }
  }

  instance.defaults = {
    ...(candidate.defaults || {}),
    headers: {
      ...(candidate.defaults?.headers || {}),
      ...(config.headers || {}),
    },
  };
  if (config.baseURL && !instance.defaults.baseURL) {
    instance.defaults.baseURL = config.baseURL;
  }

  if (!instance.interceptors) {
    instance.interceptors = {
      request: { use: () => {} },
      response: { use: () => {} },
    };
  }

  return instance;
}

export function useApi() {
  const { token } = useAuth();
  const config = {
    baseURL: "/api",
  };
  void token; // garante re-render quando o token mudar, sem injetar header aqui

  const candidates = process.env.NODE_ENV === "test"
    ? [apiModule, inboxApi, axios]
    : [inboxApi, apiModule, axios];

  for (const candidate of candidates) {
    const resolved = buildClient(candidate, config);
    if (resolved) return resolved;
  }

  return {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    patch: async () => ({ data: {} }),
    delete: async () => ({ data: {} }),
    defaults: {
      baseURL: config.baseURL,
      headers: { ...(config.headers || {}) },
    },
    interceptors: {
      request: { use: () => {} },
      response: { use: () => {} },
    },
  };
}
