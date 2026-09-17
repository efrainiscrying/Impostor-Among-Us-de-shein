// Empty string = same origin as the page (production: one server serves both
// the API and the built client). In dev, .env.development points this at
// the separate API server on :8787.
export const API_URL = import.meta.env.VITE_API_URL || "";

async function request(path, body) {
  const res = await fetch(`${API_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}

export function register(username, password) {
  return request("/register", { username, password });
}

export function login(username, password) {
  return request("/login", { username, password });
}
