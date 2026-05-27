import { api } from "../api.js";
import { el, clear, toast, openModal } from "../dom.js";

const AFF_CLASS = (a) => (a === "student" ? "student" : "employee");

export async function renderPersons(root, ref) {
  clear(root);
  const searchInput = el("input", { type: "search", placeholder: "Søk navn, brukernavn, e-post …" });
  const tableWrap = el("div");

  const panel = el("div", { class: "panel" }, [
    el("div", { class: "row" }, [
      el("div", { class: "grow" }, [el("h2", { text: "Personer" })]),
      el("button", { text: "+ Ny person", onclick: () => personForm(ref, null, load) }),
    ]),
    el("div", { class: "row" }, [el("div", { class: "grow" }, [searchInput])]),
    tableWrap,
  ]);
  root.appendChild(panel);

  let timer;
  searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(load, 250);
  });

  async function load() {
    clear(tableWrap).appendChild(el("p", { class: "muted", text: "Laster …" }));
    const { persons } = await api.persons(searchInput.value.trim());
    clear(tableWrap);
    const tbl = el("table", {}, [
      el("thead", {}, el("tr", {}, ["Navn", "Brukernavn / eduPPN", "Tilknytning", "E-post", ""].map((t) => el("th", { text: t })))),
    ]);
    const body = el("tbody");
    for (const p of persons) {
      body.appendChild(
        el("tr", {}, [
          el("td", { text: p.displayName }),
          el("td", {}, [el("div", { text: p.uid }), el("div", { class: "muted", text: p.eduPersonPrincipalName })]),
          el("td", {}, el("span", { class: "badge " + AFF_CLASS(p.eduPersonPrimaryAffiliation), text: p.eduPersonPrimaryAffiliation })),
          el("td", { text: p.mail }),
          el("td", {}, el("div", { class: "actions" }, [
            el("button", { class: "secondary small", text: "Rediger", onclick: () => personForm(ref, p, load) }),
            el("button", { class: "danger small", text: "Slett", onclick: () => removePerson(p, load) }),
          ])),
        ]),
      );
    }
    tbl.appendChild(body);
    tableWrap.appendChild(persons.length ? tbl : el("p", { class: "muted", text: "Ingen treff." }));
  }

  await load();
}

async function removePerson(p, reload) {
  if (!confirm(`Slette ${p.displayName} (${p.uid})?`)) return;
  try {
    await api.deletePerson(p.uid);
    toast("Person slettet");
    reload();
  } catch (e) {
    toast(e.message, true);
  }
}

function personForm(ref, existing, reload) {
  const isNew = !existing;
  const p = existing || {
    uid: "", eduPersonPrincipalName: "", givenName: "", sn: "", displayName: "", mail: "",
    eduPersonAffiliation: ["student"], eduPersonPrimaryAffiliation: "student",
    schacHomeOrganization: ref.realm, norEduPersonNIN: "", mobile: "", telephoneNumber: "",
  };

  const f = {};
  const input = (key, label, opts = {}) => {
    f[key] = el("input", { value: p[key] || "", type: opts.type || "text", placeholder: opts.placeholder || "" });
    if (opts.disabled) f[key].disabled = true;
    return el("label", {}, [labelText(label, opts.req), f[key], errSlot(key)]);
  };

  const affBoxes = ref.affiliations.map((a) =>
    el("label", {}, [
      el("input", { type: "checkbox", value: a.value, checked: p.eduPersonAffiliation.includes(a.value) }),
      `${a.value} (${a.label})`,
    ]),
  );
  const primarySel = el("select", {}, ref.affiliations.map((a) =>
    el("option", { value: a.value, text: `${a.value} – ${a.label}`, selected: a.value === p.eduPersonPrimaryAffiliation }),
  ));

  const errBox = el("div");

  const body = el("div", { class: "modal" }, [
    el("h2", { text: isNew ? "Ny person" : `Rediger ${p.displayName}` }),
    errBox,
    el("div", { class: "grid2" }, [
      input("uid", "Brukernavn (uid)", { req: true, disabled: !isNew, placeholder: "ola.nordmann" }),
      input("eduPersonPrincipalName", "eduPPN", { req: true, placeholder: `ola.nordmann@${ref.realm}` }),
      input("givenName", "Fornavn", { req: true }),
      input("sn", "Etternavn", { req: true }),
      input("displayName", "Visningsnavn", { req: true }),
      input("mail", "E-post", { req: true, type: "email" }),
      input("norEduPersonNIN", "Fødselsnummer", { placeholder: "11 siffer" }),
      input("schacHomeOrganization", "Realm", { req: true }),
      input("mobile", "Mobil"),
      input("telephoneNumber", "Telefon"),
    ]),
    el("label", {}, [labelText("Tilknytning(er)", true), el("div", { class: "checks" }, affBoxes), errSlot("eduPersonAffiliation")]),
    el("label", {}, [labelText("Primær tilknytning", true), primarySel, errSlot("eduPersonPrimaryAffiliation")]),
    isNew ? input("password", "Midlertidig passord (valgfritt)", { type: "password", placeholder: "min. 8 tegn" }) : null,
  ]);

  const save = el("button", { text: "Lagre" });
  body.appendChild(el("div", { class: "footer" }, [
    el("button", { class: "secondary", text: "Avbryt", onclick: () => backdrop.remove() }),
    save,
  ]));
  const backdrop = openModal(body);

  save.addEventListener("click", async () => {
    clearErrors();
    const person = {
      uid: f.uid.value.trim(),
      eduPersonPrincipalName: f.eduPersonPrincipalName.value.trim(),
      givenName: f.givenName.value.trim(),
      sn: f.sn.value.trim(),
      displayName: f.displayName.value.trim(),
      mail: f.mail.value.trim(),
      schacHomeOrganization: f.schacHomeOrganization.value.trim(),
      eduPersonAffiliation: affBoxes.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value),
      eduPersonPrimaryAffiliation: primarySel.value,
      norEduPersonNIN: f.norEduPersonNIN.value.trim() || undefined,
      mobile: f.mobile.value.trim() || undefined,
      telephoneNumber: f.telephoneNumber.value.trim() || undefined,
    };
    try {
      if (isNew) await api.createPerson(person, f.password.value.trim() || undefined);
      else await api.updatePerson(p.uid, person);
      toast("Lagret");
      backdrop.remove();
      reload();
    } catch (e) {
      showErrors(e, errBox, body);
    }
  });

  function clearErrors() {
    clear(errBox);
    body.querySelectorAll(".field-error").forEach((n) => (n.textContent = ""));
  }
}

// --- felles hjelpere for skjema-feil ---
function labelText(text, req) {
  return el("span", {}, req ? [text + " ", el("span", { class: "req", text: "*" })] : [text]);
}
function errSlot(key) {
  return el("div", { class: "field-error", dataset: { for: key } });
}
function showErrors(e, errBox, body) {
  if (e.fields && e.fields.length) {
    for (const fld of e.fields) {
      const key = fld.path.replace(/^person\./, "");
      const slot = body.querySelector(`.field-error[data-for="${key}"]`);
      if (slot) slot.textContent = fld.message;
    }
    errBox.appendChild(el("div", { class: "error-box", text: "Rett opp de merkede feltene." }));
  } else {
    errBox.appendChild(el("div", { class: "error-box", text: e.message }));
  }
}
