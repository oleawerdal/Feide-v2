import { api } from "../api.js";
import { el, clear, toast, openModal } from "../dom.js";

export async function renderGroups(root, ref) {
  clear(root);
  const typeFilter = el("select", {}, [
    el("option", { value: "", text: "Alle gruppetyper" }),
    ...ref.groupTypes.map((g) => el("option", { value: g.type, text: g.label })),
  ]);
  const tableWrap = el("div");

  root.appendChild(
    el("div", { class: "panel" }, [
      el("div", { class: "row" }, [
        el("div", { class: "grow" }, [el("h2", { text: "Grupper" })]),
        el("button", { text: "+ Ny gruppe", onclick: () => groupForm(ref, null, load) }),
      ]),
      el("div", { class: "row" }, [typeFilter]),
      tableWrap,
    ]),
  );
  typeFilter.addEventListener("change", load);

  async function load() {
    clear(tableWrap).appendChild(el("p", { class: "muted", text: "Laster …" }));
    const { groups } = await api.groups(typeFilter.value);
    clear(tableWrap);
    const tbl = el("table", {}, [
      el("thead", {}, el("tr", {}, ["Visningsnavn", "Type", "Trinn", "Fag (GREP)", "Medlemmer", ""].map((t) => el("th", { text: t })))),
    ]);
    const body = el("tbody");
    for (const g of groups) {
      const def = ref.groupTypes.find((t) => t.type === g.goType);
      body.appendChild(
        el("tr", {}, [
          el("td", {}, [el("div", { text: g.displayName }), el("div", { class: "muted", text: g.cn })]),
          el("td", { text: def ? def.label : g.goType }),
          el("td", { text: g.goGrade != null ? String(g.goGrade) : "–" }),
          el("td", { text: g.goGrep || "–" }),
          el("td", { text: String(g.members.length) }),
          el("td", {}, el("div", { class: "actions" }, [
            el("button", { class: "secondary small", text: "Rediger", onclick: () => groupForm(ref, g, load) }),
            el("button", { class: "danger small", text: "Slett", onclick: () => removeGroup(g, load) }),
          ])),
        ]),
      );
    }
    tbl.appendChild(body);
    tableWrap.appendChild(groups.length ? tbl : el("p", { class: "muted", text: "Ingen grupper." }));
  }
  await load();
}

async function removeGroup(g, reload) {
  if (!confirm(`Slette gruppen ${g.displayName}?`)) return;
  try {
    await api.deleteGroup(g.cn);
    toast("Gruppe slettet");
    reload();
  } catch (e) {
    toast(e.message, true);
  }
}

async function groupForm(ref, existing, reload) {
  const isNew = !existing;
  const g = existing || {
    cn: "", displayName: "", description: "", goType: "basis", goGrep: "", goGrade: undefined,
    schacHomeOrganization: ref.realm, schoolYear: "", members: [],
  };

  // Hent alle personer for medlemsvelger.
  const { persons } = await api.persons();

  const f = {};
  const cnInput = el("input", { value: g.cn, placeholder: "f.eks. basis-7a-2025" });
  if (!isNew) cnInput.disabled = true;
  const nameInput = el("input", { value: g.displayName, placeholder: "f.eks. 7A" });
  const descInput = el("input", { value: g.description || "" });
  const yearInput = el("input", { value: g.schoolYear || "", placeholder: "2025/2026" });

  const typeSel = el("select", {}, ref.groupTypes.map((t) =>
    el("option", { value: t.type, text: t.label, selected: t.type === g.goType }),
  ));
  const gradeSel = el("select", {}, [
    el("option", { value: "", text: "–" }),
    ...ref.grades.map((n) => el("option", { value: String(n), text: `${n}. trinn`, selected: g.goGrade === n })),
  ]);
  const grepSel = el("select", {}, [
    el("option", { value: "", text: "–" }),
    ...ref.grepSubjects.map((s) => el("option", { value: s.code, text: `${s.name} (${s.code})`, selected: g.goGrep === s.code })),
  ]);

  const gradeLabel = el("label", {}, [el("span", { text: "Årstrinn" }), gradeSel]);
  const grepLabel = el("label", {}, [el("span", { text: "Fag (GREP)" }), grepSel]);

  function applyTypeRules() {
    const def = ref.groupTypes.find((t) => t.type === typeSel.value);
    gradeLabel.style.display = def && def.requiresGrade ? "" : "none";
    grepLabel.style.display = def && def.requiresGrep ? "" : "none";
  }
  typeSel.addEventListener("change", applyTypeRules);

  // Medlemsvelger
  const memberSearch = el("input", { type: "search", placeholder: "Filtrer personer …" });
  const memberList = el("div", { class: "member-list" });
  const memberSet = new Set(g.members);
  function drawMembers() {
    clear(memberList);
    const q = memberSearch.value.trim().toLowerCase();
    for (const p of persons) {
      if (q && !(`${p.displayName} ${p.uid} ${p.eduPersonPrincipalName}`.toLowerCase().includes(q))) continue;
      const cb = el("input", { type: "checkbox", value: p.dn, checked: memberSet.has(p.dn) });
      cb.addEventListener("change", () => (cb.checked ? memberSet.add(p.dn) : memberSet.delete(p.dn)));
      memberList.appendChild(el("label", {}, [cb, `${p.displayName} `, el("span", { class: "muted", text: `(${p.uid}, ${p.eduPersonPrimaryAffiliation})` })]));
    }
  }
  memberSearch.addEventListener("input", drawMembers);

  const errBox = el("div");
  const body = el("div", { class: "modal" }, [
    el("h2", { text: isNew ? "Ny gruppe" : `Rediger ${g.displayName}` }),
    errBox,
    el("div", { class: "grid2" }, [
      el("label", {}, [reqLabel("Gruppe-ID (cn)"), cnInput, errSlot("cn")]),
      el("label", {}, [reqLabel("Visningsnavn"), nameInput, errSlot("displayName")]),
      el("label", {}, [reqLabel("Gruppetype"), typeSel, errSlot("goType")]),
      gradeLabel,
      grepLabel,
      el("label", {}, [el("span", { text: "Skoleår" }), yearInput, errSlot("schoolYear")]),
    ]),
    el("label", {}, [el("span", { text: "Beskrivelse" }), descInput]),
    el("label", {}, [el("span", { text: `Medlemmer (${memberSet.size} valgt)` }), memberSearch]),
    memberList,
  ]);
  errSlot("goGrade") && body.appendChild(errSlot("goGrade"));
  body.appendChild(errSlot("goGrep"));

  const save = el("button", { text: "Lagre" });
  body.appendChild(el("div", { class: "footer" }, [
    el("button", { class: "secondary", text: "Avbryt", onclick: () => backdrop.remove() }),
    save,
  ]));
  const backdrop = openModal(body);
  applyTypeRules();
  drawMembers();

  save.addEventListener("click", async () => {
    clear(errBox);
    body.querySelectorAll(".field-error").forEach((n) => (n.textContent = ""));
    const group = {
      cn: cnInput.value.trim(),
      displayName: nameInput.value.trim(),
      description: descInput.value.trim() || undefined,
      goType: typeSel.value,
      goGrep: grepSel.value || undefined,
      goGrade: gradeSel.value ? Number(gradeSel.value) : undefined,
      schacHomeOrganization: g.schacHomeOrganization || ref.realm,
      schoolYear: yearInput.value.trim() || undefined,
      members: [...memberSet],
    };
    try {
      if (isNew) await api.createGroup(group);
      else await api.updateGroup(g.cn, group);
      toast("Lagret");
      backdrop.remove();
      reload();
    } catch (e) {
      showErrors(e, errBox, body);
    }
  });
}

function reqLabel(text) {
  return el("span", {}, [text + " ", el("span", { class: "req", text: "*" })]);
}
function errSlot(key) {
  return el("div", { class: "field-error", dataset: { for: key } });
}
function showErrors(e, errBox, body) {
  if (e.fields && e.fields.length) {
    for (const fld of e.fields) {
      const slot = body.querySelector(`.field-error[data-for="${fld.path}"]`);
      if (slot) slot.textContent = fld.message;
    }
    errBox.appendChild(el("div", { class: "error-box", text: "Rett opp de merkede feltene." }));
  } else {
    errBox.appendChild(el("div", { class: "error-box", text: e.message }));
  }
}
