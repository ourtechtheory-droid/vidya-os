import axios from "axios";

const rawBackendUrl =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  "";

const normalizedBackendUrl = rawBackendUrl.replace(/\/+$/, "");

export const API_BASE = normalizedBackendUrl
  ? normalizedBackendUrl.endsWith("/api")
    ? normalizedBackendUrl
    : `${normalizedBackendUrl}/api`
  : "/api";

export const api = axios.create({ baseURL: API_BASE });

export const getApiErrorMessage = (err, fallback = "Something went wrong") => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .filter(Boolean)
      .join(", ");
  }
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.status) return `Request failed with status ${err.response.status}`;
  if (err?.request) return `Could not reach the backend at ${API_BASE}`;
  return err?.message || fallback;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai_school_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("ai_school_token");
      localStorage.removeItem("ai_school_user");
    }
    return Promise.reject(err);
  }
);

// Manual helper only. The app no longer seeds demo data on startup.
export const seedIfNeeded = async () => {
  try { await axios.post(`${API_BASE}/seed`); } catch (_) {}
};
