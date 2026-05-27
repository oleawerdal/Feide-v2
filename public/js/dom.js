// Små DOM-hjelpere. All innsetting bruker textContent (ingen innerHTML med
// brukerdata) for å unngå XSS.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v; // kun for statiske, utviklerkontrollerte strenger
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let toastTimer;
export function toast(message, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.className = "toast" + (isError ? " err" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

export function openModal(contentNode) {
  const backdrop = el("div", { class: "modal-backdrop" }, [contentNode]);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      backdrop.remove();
      document.removeEventListener("keydown", esc);
    }
  });
  document.body.appendChild(backdrop);
  return backdrop;
}
