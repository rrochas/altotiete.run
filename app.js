// app.js
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzq2BNuD_O2dUPlIPfkwfg1jhNS_RsiiL8qm3YmnMBn1YnyTytx2huJtK2OsIxAXjhsNUuzufSQ8m9/pub?gid=0&single=true&output=csv";

function parseCSV(text) {
  // Parser simples que lida com vírgula/ponto e vírgula e aspas
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
      // pula \r\n
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
  // dd/mm/yyyy -> yyyymmdd (string)
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return "";
  return `${m[3]}${m[2]}${m[1]}`;
}

function isUpcomingOrToday(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return true; // se tiver estranho, não esconde
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

async function loadCalendar() {
  const status = document.getElementById("status");
  const tbody = document.getElementById("tbody");
  const updated = document.getElementById("updated");

  try {
    status.textContent = "Carregando calendário...";
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows = parseCSV(text);
    if (rows.length < 2) {
      status.textContent = "Planilha vazia (sem dados).";
      tbody.innerHTML = "";
      return;
    }

    const header = rows[0].map(h => h.toLowerCase());
    const idx = {
      data: header.indexOf("data"),
      cidade: header.indexOf("cidade"),
      evento: header.indexOf("evento"),
      distancias: header.indexOf("distancias"),
      link: header.indexOf("link"),
    };

    // monta lista de eventos
    const events = rows.slice(1)
      .filter(r => r.join("").trim().length > 0)
      .map(r => ({
        data: r[idx.data] ?? "",
        cidade: r[idx.cidade] ?? "",
        evento: r[idx.evento] ?? "",
        distancias: r[idx.distancias] ?? "",
        link: r[idx.link] ?? "",
      }))
      .filter(e => e.data) // exige data
      .filter(e => isUpcomingOrToday(e.data))
      .sort((a,b) => brDateToSortable(a.data).localeCompare(brDateToSortable(b.data)));

    if (!events.length) {
      status.textContent = "Nenhuma corrida futura encontrada.";
      tbody.innerHTML = "";
      return;
    }

    tbody.innerHTML = events.map(e => {
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

    status.textContent = "";
    const d = new Date();
    const pad = n => String(n).padStart(2,"0");
    updated.textContent = `Atualizado em ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;

  } catch (err) {
    status.textContent = "Erro ao carregar a planilha. Verifique se ela está publicada em CSV.";
    tbody.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", loadCalendar);
