import { api } from "../api.js";
import { el, clear } from "../dom.js";

const SEV_LABEL = { error: "Feil", warning: "Advarsel", info: "Info" };

export async function renderDashboard(root) {
  clear(root);
  root.appendChild(el("p", { class: "muted", text: "Henter datakvalitetsrapport …" }));
  let report;
  try {
    report = await api.quality();
  } catch (e) {
    clear(root);
    root.appendChild(el("div", { class: "error-box", text: e.message }));
    return;
  }
  clear(root);

  const scoreClass = report.score >= 90 ? "good" : report.score >= 70 ? "mid" : "bad";
  const t = report.totals;

  root.appendChild(
    el("div", { class: "panel" }, [
      el("h2", { text: "Datakvalitet" }),
      el("div", { class: "score " + scoreClass }, [
        el("div", {}, [
          el("div", { class: "num", text: String(report.score) }),
          el("div", { class: "muted", text: "av 100" }),
        ]),
        el("div", { class: "stats" }, [
          stat(t.persons, "Personer"),
          stat(t.students, "Elever"),
          stat(t.groups, "Grupper"),
          stat(t.errors, "Feil"),
          stat(t.warnings, "Advarsler"),
        ]),
      ]),
      el("p", { class: "muted", text: "Sjekket mot Feides krav til god datakvalitet (info_go / grunnskole)." }),
    ]),
  );

  const panel = el("div", { class: "panel" }, [el("h2", { text: `Funn (${report.issues.length})` })]);
  if (report.issues.length === 0) {
    panel.appendChild(el("p", { class: "badge sev-info", text: "Ingen avvik funnet – katalogen oppfyller kravene." }));
  } else {
    const filter = el("select", { onchange: () => draw() }, [
      el("option", { value: "", text: "Alle alvorlighetsgrader" }),
      el("option", { value: "error", text: "Kun feil" }),
      el("option", { value: "warning", text: "Kun advarsler" }),
      el("option", { value: "info", text: "Kun info" }),
    ]);
    panel.appendChild(el("div", { class: "row" }, [el("div", { class: "grow" }), filter]));
    const tbl = el("table");
    panel.appendChild(tbl);

    const draw = () => {
      clear(tbl);
      tbl.appendChild(
        el("thead", {}, el("tr", {}, [
          th("Alvorlighet"), th("Kode"), th("Gjelder"), th("Beskrivelse"),
        ])),
      );
      const body = el("tbody");
      const sel = filter.value;
      for (const i of report.issues) {
        if (sel && i.severity !== sel) continue;
        body.appendChild(
          el("tr", {}, [
            el("td", {}, el("span", { class: "badge sev-" + i.severity, text: SEV_LABEL[i.severity] })),
            el("td", {}, el("code", { text: i.code })),
            el("td", { text: i.subjectId || i.subjectKind }),
            el("td", { text: i.message }),
          ]),
        );
      }
      tbl.appendChild(body);
    };
    draw();
  }
  root.appendChild(panel);
}

function stat(v, l) {
  return el("div", { class: "stat" }, [el("div", { class: "v", text: String(v) }), el("div", { class: "l", text: l })]);
}
function th(t) { return el("th", { text: t }); }
