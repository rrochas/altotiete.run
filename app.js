// app.js
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzq2BNuD_O2dUPlIPfkwfg1jhNS_RsiiL8qm3YmnMBn1YnyTytx2huJtK2OsIxAXjhsNUuzufSQ8m9/pub?gid=0&single=true&output=csv";

let ALL_EVENTS = [];
let ACTIVE_CITY = "TODAS";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (c === "," || c === ";")) {
      row.push(cur.trim());
      cur = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (cur.length || row.length) {
        row.push(cur.trim());
        rows.push(row);
      }
      row = [];
      cur = "";
      if (c === "\r" && next === "\n") i++;
      continue;
    }

    cur += c;
  }

  if (cur.length || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }

  return rows;
}

function brDateToSortable(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return "";
  return `${m[3]}${m[2]}${m[1]}`;
}

function isUpcomingOrToday(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return true;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const today = new Date();
  today.setHours(0,0,0,0);
  dt.setHours(0,0,0,0);
  return dt >= today;
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s){
  return String(s ?? "").trim().toLowerCase();
}

function render() {
  const tbody = document.getElementById("tbody");
  const cards = document.getElementById("cards");
  const status = document.getElementById("status");
  const count = document.getElementById("count");
  const search = normalize(document.getElementById("search").value);

  let filtered = ALL_EVENTS.slice();

  if (ACTIVE_CITY !== "TODAS") {
    filtered = filtered.filter(e => normalize(e.cidade) === normalize(ACTIVE_CITY));
  }

  if (search) {
    filtered = filtered.filter(e =>
      normalize(e.evento).includes(search) ||
      normalize(e.cidade).includes(search) ||
      normalize(e.distancias).includes(search)
    );
  }

  count.textContent = `${filtered.length} corrida(s)`;

  if (!filtered.length) {
    status.textContent = "Nenhuma corrida encontrada para esse filtro.";
    if (tbody) tbody.innerHTML = "";
    cards.innerHTML = "";
    return;
  }

  status.textContent = "";

  // tabela
  if (tbody) {
    tbody.innerHTML = filtered.map(e => {
      const link = (e.link || "").trim();
      const linkCell = link
        ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener">Abrir</a>`
        : `—`;

      return `
        <tr>
          <td>${escapeHTML(e.data)}</td>
          <td>${escapeHTML(e.cidade)}</td>
          <td>${escapeHTML(e.evento)}</td>
          <td>${escapeHTML(e.distancias)}</td>
          <td>${linkCell}</td>
        </tr>
      `;
    }).join("");
  }

  // cards (mobile)
  cards.innerHTML = filtered.map(e => {
    const link = (e.link || "").trim();
    const primary = link
      ? `<a class="btn primary" href="${escapeHTML(link)}" target="_blank" rel="noopener">Inscrição / Info</a>`
      : `<span class="btn" aria-disabled="true">Sem link</span>`;

    return `
      <article class="card">
        <div class="card-top">
          <div>
            <h3>${escapeHTML(e.evento)}</h3>
            <div class="meta">
              <span>📍 ${escapeHTML(e.cidade)}</span>
              <span>📏 ${escapeHTML(e.distancias)}</span>
            </div>
          </div>
          <span class="badge">${escapeHTML(e.data)}</span>
        </div>
        <div class="actions">
          ${primary}
        </div>
      </article>
    `;
  }).join("");
}

async function loadCalendar() {
  const status = document.getElementById("status");
  const updated = document.getElementById("updated");

  try {
    status.textContent = "Carregando calendário...";
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows = parseCSV(text);
    if (rows.length < 2) {
      status.textContent = "Planilha vazia (sem dados).";
      ALL_EVENTS = [];
      render();
      return;
    }

    const header = rows[0].map(h => normalize(h));
    const idx = {
      data: header.indexOf("data"),
      cidade: header.indexOf("cidade"),
      evento: header.indexOf("evento"),
      distancias: header.indexOf("distancias"),
      link: header.indexOf("link"),
    };

    ALL_EVENTS = rows.slice(1)
      .filter(r => r.join("").trim().length > 0)
      .map(r => ({
        data: r[idx.data] ?? "",
        cidade: r[idx.cidade] ?? "",
        evento: r[idx.evento] ?? "",
        distancias: r[idx.distancias] ?? "",
        link: r[idx.link] ?? "",
      }))
      .filter(e => e.data)
      .filter(e => isUpcomingOrToday(e.data))
      .sort((a,b) => brDateToSortable(a.data).localeCompare(brDateToSortable(b.data)));

    const d = new Date();
    const pad = n => String(n).padStart(2,"0");
    updated.textContent = `Atualizado em ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear())}`; // <- ops corrigindo abaixo
  } catch (err) {
    status.textContent = "Erro ao carregar a planilha. Verifique se ela está publicada em CSV.";
    ALL_EVENTS = [];
  }

  // corrige o updated sem bug
  try{
    const d = new Date();
    const pad = n => String(n).padStart(2,"0");
    document.getElementById("updated").textContent =
      `Atualizado em ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  } catch {}

  render();
}

function bindFilters() {
  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      ACTIVE_CITY = btn.getAttribute("data-city") || "TODAS";
      render();
    });
  });

  document.getElementById("search").addEventListener("input", () => render());
}

document.addEventListener("DOMContentLoaded", () => {
  bindFilters();
  loadCalendar();
});
