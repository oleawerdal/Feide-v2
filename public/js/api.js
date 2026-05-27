// Tynt API-lag med CSRF-håndtering. Token hentes ved oppstart og etter login.
let csrfToken = null;

async function refreshCsrf() {
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    if (!csrfToken) await refreshCsrf();
    headers["X-CSRF-Token"] = csrfToken;
  }
  const res = await fetch("/api" + path, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data.error || `Feil (${res.status})`);
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }
  return data;
}

export const api = {
  refreshCsrf,
  me: () => request("GET", "/auth/me"),
  login: async (username, password) => {
    await refreshCsrf();
    const r = await request("POST", "/auth/login", { username, password });
    await refreshCsrf(); // sesjonen er regenerert -> nytt token
    return r;
  },
  logout: () => request("POST", "/auth/logout"),
  reference: () => request("GET", "/reference"),
  quality: () => request("GET", "/quality"),
  persons: (q) => request("GET", "/persons" + (q ? `?q=${encodeURIComponent(q)}` : "")),
  person: (uid) => request("GET", `/persons/${encodeURIComponent(uid)}`),
  createPerson: (person, password) => request("POST", "/persons", { person, password }),
  updatePerson: (uid, person) => request("PUT", `/persons/${encodeURIComponent(uid)}`, { person }),
  deletePerson: (uid) => request("DELETE", `/persons/${encodeURIComponent(uid)}`),
  setPassword: (uid, password) => request("PUT", `/persons/${encodeURIComponent(uid)}/password`, { password }),
  groups: (type) => request("GET", "/groups" + (type ? `?type=${encodeURIComponent(type)}` : "")),
  group: (cn) => request("GET", `/groups/${encodeURIComponent(cn)}`),
  createGroup: (group) => request("POST", "/groups", { group }),
  updateGroup: (cn, group) => request("PUT", `/groups/${encodeURIComponent(cn)}`, { group }),
  deleteGroup: (cn) => request("DELETE", `/groups/${encodeURIComponent(cn)}`),
  setMembers: (cn, members) => request("PUT", `/groups/${encodeURIComponent(cn)}/members`, { members }),
};
