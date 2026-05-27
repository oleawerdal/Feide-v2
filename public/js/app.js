import { api } from "./api.js";
import { el, clear, toast } from "./dom.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderPersons } from "./views/persons.js";
import { renderGroups } from "./views/groups.js";

const appRoot = document.getElementById("app");
let reference = null;
let currentUser = null;

const ROUTES = {
  dashboard: { label: "Datakvalitet", render: (m) => renderDashboard(m) },
  personer: { label: "Personer", render: (m) => renderPersons(m, reference) },
  grupper: { label: "Grupper", render: (m) => renderGroups(m, reference) },
};

function loginView() {
  clear(appRoot);
  const userInput = el("input", { type: "text", autocomplete: "username", placeholder: "brukernavn eller eduPPN" });
  const passInput = el("input", { type: "password", autocomplete: "current-password" });
  const errBox = el("div");
  const btn = el("button", { text: "Logg inn", type: "submit" });

  const form = el("form", {}, [
    el("h1", { text: "Feide brukerkatalog" }),
    el("p", { class: "muted", text: "Logg inn med administratorkonto for å forvalte personer og grupper." }),
    errBox,
    el("label", {}, ["Brukernavn", userInput]),
    el("label", {}, ["Passord", passInput]),
    btn,
  ]);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(errBox);
    btn.disabled = true;
    try {
      const { user } = await api.login(userInput.value.trim(), passInput.value);
      currentUser = user;
      await boot();
    } catch (err) {
      errBox.appendChild(el("div", { class: "error-box", text: err.message }));
      btn.disabled = false;
    }
  });

  appRoot.appendChild(el("div", { class: "login-wrap" }, [el("div", { class: "panel" }, [form])]));
  userInput.focus();
}

function shell() {
  clear(appRoot);
  const nav = el("nav");
  const links = {};
  for (const [key, r] of Object.entries(ROUTES)) {
    links[key] = el("a", { href: "#/" + key, text: r.label });
    nav.appendChild(links[key]);
  }
  const main = el("main");
  appRoot.appendChild(
    el("header", { class: "topbar" }, [
      el("h1", { text: "Feide-katalog" }),
      nav,
      el("span", { class: "who", text: currentUser?.displayName || "" }),
      el("button", {
        class: "secondary small",
        text: "Logg ut",
        onclick: async () => {
          await api.logout();
          currentUser = null;
          location.hash = "";
          loginView();
        },
      }),
    ]),
  );
  appRoot.appendChild(main);

  async function route() {
    const key = (location.hash.replace(/^#\//, "") || "dashboard");
    const r = ROUTES[key] || ROUTES.dashboard;
    for (const [k, link] of Object.entries(links)) link.classList.toggle("active", k === key || (key === "dashboard" && k === "dashboard"));
    try {
      await r.render(main);
    } catch (e) {
      toast(e.message, true);
      if (e.status === 401) { currentUser = null; loginView(); }
    }
  }
  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/dashboard";
  route();
}

async function boot() {
  reference = await api.reference();
  shell();
}

async function init() {
  await api.refreshCsrf();
  try {
    const { user } = await api.me();
    currentUser = user;
    await boot();
  } catch {
    loginView();
  }
}

init();
