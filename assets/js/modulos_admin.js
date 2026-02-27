// modulos_admin.js — V19 (Modal Confirmação + Loading + UX Melhorado)

const EMPRESA_CONFIG = {
  nome:     "ROCHA CONSTRUTORA LTDA",
  cnpj:     "51.027.684/0001-56",
  endereco: "Rua das Pedras, 12 - Centro, Malhada dos Bois/SE",
  contato:  "rochaconstrutora23@gmail.com | (79) 99653-4829"
};

let usuarioAdminAtual = null;

// ─── LIGHTBOX ─────────────────────────────────────────────────────
function criarLightbox() {
  if (document.getElementById("lightbox-viewer")) return;
  const div = document.createElement("div");
  div.id = "lightbox-viewer";
  div.className = "lightbox-overlay";
  div.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="fecharLightbox()">&#10005;</button>
      <img id="lightbox-img-tag" class="lightbox-img" src="" alt="Foto">
      <div id="lightbox-caption" class="lightbox-caption"></div>
    </div>`;
  div.addEventListener("click", (e) => { if (e.target === div) fecharLightbox(); });
  document.body.appendChild(div);
}

window.abrirLightbox = (url, legenda) => {
  criarLightbox();
  const el = document.getElementById("lightbox-viewer");
  const imgTag = document.getElementById("lightbox-img-tag");
  const capTag = document.getElementById("lightbox-caption");
  if (imgTag) imgTag.src = url;
  if (capTag) capTag.textContent = legenda || "";
  if (el) el.classList.add("show");
};

window.fecharLightbox = () => {
  const el = document.getElementById("lightbox-viewer");
  if (el) el.classList.remove("show");
};

// ─── INICIALIZAÇÃO ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const user = await getUsuarioAtual();
  if (user) usuarioAdminAtual = user;

  const hoje = mesLocalISO();

  if (document.getElementById("sec-ponto")) {
    carregarObrasSelect("ponto-filtro-obra");
    carregarFuncionariosSelect("ponto-filtro-func");
    document.getElementById("ponto-filtro-mes").value = hoje;
    carregarPontosAdmin();
    const selObra = document.getElementById("ponto-filtro-obra");
    if (selObra) selObra.addEventListener("change", (e) => carregarFuncionariosSelect("ponto-filtro-func", e.target.value));
  }

  if (document.getElementById("sec-diario")) {
    carregarObrasSelect("admin-diario-obra");
    const inputMes = document.getElementById("admin-diario-mes");
    if (inputMes) inputMes.value = hoje;
  }

  if (document.getElementById("sec-caixa")) {
    carregarObrasSelect("caixa-filtro-obra");
    carregarObrasSelect("caixa-admin-obra");
    document.getElementById("caixa-filtro-mes").value = hoje;
    carregarCaixaAdmin();
    const formCaixa = document.getElementById("form-caixa-admin");
    if (formCaixa) formCaixa.addEventListener("submit", salvarCaixaAdmin);
    const selPag = document.getElementById("caixa-admin-pagamento");
    if (selPag) selPag.addEventListener("change", atualizarUIParcelasCaixaAdmin);
    atualizarUIParcelasCaixaAdmin();
  }

  if (document.getElementById("sec-materiais")) carregarMateriaisAdmin("Pendente");
});

// ─── HELPERS SELECT ────────────────────────────────────────────────
async function carregarObrasSelect(idSelect) {
  const sel = document.getElementById(idSelect);
  if (!sel || sel.options.length > 1) return;
  let { data, error } = await supa.from("obras").select("id, nome").eq("status", "ativa").order("nome");
  if (error) ({ data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome"));
  sel.innerHTML = idSelect.includes("filtro") ? "<option value=''>Todas</option>" : "<option value=''>Selecione...</option>";
  if (data) data.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.id; opt.textContent = o.nome; sel.appendChild(opt);
  });
}

async function carregarFuncionariosSelect(idSelect, obraId = "") {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  sel.innerHTML = "<option value=''>Carregando...</option>"; sel.disabled = true;
  let query = supa.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
  if (obraId) query = query.eq("obra_id", obraId);
  const { data } = await query;
  sel.innerHTML = "<option value=''>Todos</option>"; sel.disabled = false;
  if (data) data.forEach(f => { const opt = document.createElement("option"); opt.value = f.id; opt.textContent = f.nome; sel.appendChild(opt); });
}

function processarDataDigitada(texto) {
  if (!texto) return null;
  const limpo = texto.replace(/\D/g, "");
  let dia, mes, ano;
  const anoAtual = new Date().getFullYear();
  if (limpo.length === 8) { dia = limpo.substr(0,2); mes = limpo.substr(2,2); ano = limpo.substr(4,4); }
  else if (limpo.length === 6) { dia = limpo.substr(0,2); mes = limpo.substr(2,2); ano = "20" + limpo.substr(4,2); }
  else if (limpo.length === 4) { dia = limpo.substr(0,2); mes = limpo.substr(2,2); ano = anoAtual; }
  else if (texto.includes("-") && texto.length === 10) return texto;
  else return null;
  if (parseInt(mes) > 12 || parseInt(dia) > 31) return null;
  return `${ano}-${mes}-${dia}`;
}

function atualizarUIParcelasCaixaAdmin() {
  const sel = document.getElementById("caixa-admin-pagamento");
  const box = document.getElementById("caixa-admin-parcelas-box");
  const inp = document.getElementById("caixa-admin-parcelas");
  if (!sel || !box) return;
  const ehCredito = (sel.value || "") === "Cartão de Crédito";
  box.style.display = ehCredito ? "" : "none";
  if (ehCredito && inp) { const n = Number(inp.value || 0); if (!Number.isFinite(n) || n <= 0) inp.value = "1"; }
  if (!ehCredito && inp) inp.value = "";
}

// ─── MÓDULO MATERIAIS ──────────────────────────────────────────────
async function carregarMateriaisAdmin(statusFiltro = "Pendente") {
  const tbody = document.getElementById("tabela-materiais");
  if (!tbody) return;

  document.querySelectorAll("#sec-materiais .tab-bar .tab-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === statusFiltro);
  });

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">
    <span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const { data, error } = await supa
    .from("solicitacoes_materiais")
    .select("*, obras(nome), usuarios(nome)")
    .eq("status", statusFiltro)
    .order("created_at", { ascending: false });

  if (error) return tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:16px;">Erro SQL: ${escapeHtml(error.message)}</td></tr>`;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <span class="material-symbols-outlined">inventory_2</span>Nenhum pedido ${statusFiltro.toLowerCase()}.</div></td></tr>`;
    // Atualiza badge
    if (typeof atualizarBadgeMateriais === "function") atualizarBadgeMateriais();
    return;
  }

  tbody.innerHTML = "";

  // Botão WhatsApp para pendentes
  if (statusFiltro === "Pendente" && data.length > 0) {
    let textoZap = "*LISTA DE COMPRAS — ROCHA CONSTRUTORA*\n\n";
    data.forEach(m => {
      textoZap += `• [${m.urgencia || "Normal"}] ${m.item} (${m.quantidade}) — ${m.obras?.nome || "—"}\n`;
    });
    const linkZap = `https://wa.me/?text=${encodeURIComponent(textoZap)}`;
    tbody.innerHTML += `
      <tr>
        <td colspan="7" style="text-align:center;background:#f0fdf4;padding:10px;">
          <a href="${linkZap}" target="_blank" rel="noopener"
             style="background:#25D366;color:white;text-decoration:none;display:inline-flex;
                    align-items:center;gap:6px;padding:8px 18px;border-radius:8px;font-weight:700;font-size:13px;">
            <span class="material-symbols-outlined" style="font-size:18px;">share</span>
            Enviar Lista no WhatsApp (${data.length})
          </a>
        </td>
      </tr>`;
  }

  data.forEach(m => {
    let btnAcao = "";
    if (m.status === "Pendente") btnAcao = `<button class="btn-primary btn-sm" onclick="mudarStatusMaterial('${m.id}','Comprado')">Comprar</button>`;
    else if (m.status === "Comprado") btnAcao = `<button class="btn-secondary btn-sm" onclick="receberMaterialAdmin('${m.id}')">Receber</button>`;
    else btnAcao = "<span style='color:#10b981;font-weight:700;font-size:12px;'>✓ Entregue</span>";

    let btnData = "";
    if (m.status !== "Entregue") {
      const dataAtualBR = m.previsao_entrega ? formatarDataBR(m.previsao_entrega) : "";
      btnData = `<button class="btn-ghost btn-sm" title="Definir Previsão" onclick="definirPrevisaoMaterial('${m.id}','${dataAtualBR}')">
        <span class="material-symbols-outlined" style="font-size:17px;">calendar_month</span>
      </button>`;
    }

    let previsaoDisplay = "";
    if (m.previsao_entrega) {
      const hoje = hojeLocalISO();
      const cor = (m.previsao_entrega < hoje && m.status !== "Entregue") ? "#ef4444" : "#166534";
      const label = m.status === "Entregue" ? "Entregue:" : "Prev.:";
      previsaoDisplay = `<br><small style="color:${cor};font-weight:600;">${label} ${formatarDataBR(m.previsao_entrega)}</small>`;
    }

    const urgIcon = m.urgencia === "Critica" ? "🚨" : m.urgencia === "Alta" ? "🔴" : "🟡";

    tbody.innerHTML += `
      <tr>
        <td style="font-size:12px;color:#64748b;">${new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(m.obras?.nome || "—")}</div>
          <div style="font-size:11px;color:#94a3b8;">${escapeHtml(m.usuarios?.nome?.split(" ")[0] || "—")}</div>
        </td>
        <td style="font-weight:600;">${escapeHtml(m.item)}</td>
        <td>${escapeHtml(m.quantidade)}</td>
        <td title="${escapeHtml(m.urgencia)}">${urgIcon} ${escapeHtml(m.urgencia)}</td>
        <td><span class="md-chip">${m.status}</span>${previsaoDisplay}</td>
        <td class="actions-cell">${btnData}${btnAcao}</td>
      </tr>`;
  });

  if (typeof atualizarBadgeMateriais === "function") atualizarBadgeMateriais();
}

window.mudarStatusMaterial = async (id, novoStatus) => {
  const payload = { status: novoStatus };
  if (novoStatus === "Entregue") payload.previsao_entrega = hojeLocalISO();
  const { error } = await supa.from("solicitacoes_materiais").update(payload).eq("id", id);
  if (error) return erro("Erro ao atualizar.");

  if (novoStatus === "Comprado") {
    const desejaData = confirm("Deseja informar a previsão de entrega agora?");
    if (desejaData) { await definirPrevisaoMaterial(id, ""); return; }
  }
  sucesso(`Status atualizado para ${novoStatus}!`);
  carregarMateriaisAdmin(novoStatus === "Comprado" ? "Pendente" : "Comprado");
};

window.receberMaterialAdmin = async (id) => {
  const hoje = new Date();
  const hojeBR = `${String(hoje.getDate()).padStart(2,"0")}${String(hoje.getMonth()+1).padStart(2,"0")}${hoje.getFullYear()}`;
  const entrada = prompt(`Informe a DATA REAL da entrega:\n(ex: ${hojeBR} ou deixe em branco para hoje)`, hojeBR);
  if (entrada !== null) {
    let dataISO = processarDataDigitada(entrada);
    if (!dataISO) dataISO = hojeLocalISO();
    await supa.from("solicitacoes_materiais").update({ status: "Entregue", previsao_entrega: dataISO }).eq("id", id);
    sucesso("Material recebido!");
    carregarMateriaisAdmin("Comprado");
  }
};

window.definirPrevisaoMaterial = async (id, dataAtualBR) => {
  const entrada = prompt("Informe a previsão:\n(ex: 05122025)", dataAtualBR);
  if (entrada !== null) {
    const dataISO = processarDataDigitada(entrada);
    if (!dataISO && entrada.trim() !== "") return erro("Data inválida.");
    await supa.from("solicitacoes_materiais").update({ previsao_entrega: dataISO }).eq("id", id);
    sucesso("Previsão atualizada!");
    const activeTab = document.querySelector("#sec-materiais .tab-item.active");
    carregarMateriaisAdmin(activeTab?.dataset.status || "Pendente");
  }
};

// ─── MÓDULO PONTO ──────────────────────────────────────────────────
async function carregarPontosAdmin() {
  const mesAno = document.getElementById("ponto-filtro-mes")?.value;
  const obraId = document.getElementById("ponto-filtro-obra")?.value;
  const funcId = document.getElementById("ponto-filtro-func")?.value;
  const tbody  = document.getElementById("tabela-ponto-admin");
  if (!mesAno) return aviso("Selecione o mês.");

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">
    <span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const [ano, mes] = mesAno.split("-");
  const inicio = `${ano}-${mes}-01`;
  const fim    = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;

  let query = supa.from("registros")
    .select("id, data, tipo, valor, horas_extras, funcionarios(nome), obras(nome)")
    .gte("data", inicio).lte("data", fim)
    .order("data", { ascending: false });
  if (obraId) query = query.eq("obra_id", obraId);
  if (funcId) query = query.eq("funcionario_id", funcId);

  const { data, error } = await query;
  if (error) return tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center;padding:16px;">Erro SQL</td></tr>`;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <span class="material-symbols-outlined">event_available</span>Nenhum registro no período.</div></td></tr>`;
    return;
  }

  // Totalizador
  const totalValor = data.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const countEl = document.getElementById("count-tabela-ponto");
  if (countEl) countEl.textContent = `${data.length} registro(s) — Total: ${totalValor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`;

  tbody.innerHTML = "";
  data.forEach(p => {
    const valFmt = (p.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const extraLabel = p.horas_extras > 0
      ? `<br><small style="color:#d97706;font-weight:700;">+${p.horas_extras}h extras</small>`
      : "";
    const tipoBadge = p.tipo === "DIARIA"
      ? "<span class='md-chip' style='background:#e0f2fe;color:#0369a1;'>Diária</span>"
      : "<span class='md-chip' style='background:#fff7ed;color:#c2410c;'>Meia</span>";

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:600;">${formatarDataBR(p.data)}</td>
        <td>${escapeHtml(p.funcionarios?.nome || "—")}</td>
        <td><small style="color:#64748b;">${escapeHtml(p.obras?.nome || "—")}</small></td>
        <td>${tipoBadge}</td>
        <td>${valFmt} ${extraLabel}</td>
        <td class="actions-cell">
          <button class="btn-primary btn-sm"  onclick="editarPontoAdmin('${p.id}')">Editar</button>
          <button class="btn-danger  btn-sm"  onclick="excluirPontoAdmin('${p.id}', '${escapeHtml(p.funcionarios?.nome||"")}', '${formatarDataBR(p.data)}')">Excluir</button>
        </td>
      </tr>`;
  });
}

window.editarPontoAdmin = async (id) => {
  const { data } = await supa.from("registros").select("*, funcionarios(nome)").eq("id", id).single();
  if (!data) return erro("Erro ao carregar registro.");
  document.getElementById("card-edit-ponto").style.display = "block";
  document.getElementById("ponto-admin-id").value    = data.id;
  document.getElementById("ponto-admin-nome").value  = data.funcionarios?.nome;
  document.getElementById("ponto-admin-data").value  = data.data;
  document.getElementById("ponto-admin-tipo").value  = data.tipo;
  document.getElementById("ponto-admin-valor").value = (data.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  document.getElementById("ponto-admin-valor").dispatchEvent(new Event("input"));
  document.getElementById("card-edit-ponto").scrollIntoView({ behavior: "smooth" });
};

window.salvarEdicaoPontoAdmin = async () => {
  const id      = document.getElementById("ponto-admin-id").value;
  const tipo    = document.getElementById("ponto-admin-tipo").value;
  const valorStr= document.getElementById("ponto-admin-valor").value;
  const valor   = parseFloat(valorStr.replace("R$","").replace(/\./g,"").replace(",",".").trim());
  const btn     = document.querySelector("#card-edit-ponto .btn-primary");

  setBtnLoading(btn, true);
  const { error } = await supa.from("registros").update({ tipo, valor }).eq("id", id);
  setBtnLoading(btn, false);

  if (error) return erro("Erro ao salvar.");
  sucesso("Registro atualizado!");
  document.getElementById("card-edit-ponto").style.display = "none";
  carregarPontosAdmin();
};

window.cancelarEdicaoPonto = () => {
  document.getElementById("card-edit-ponto").style.display = "none";
};

window.excluirPontoAdmin = (id, nome, data) => {
  confirmar(
    `Excluir o ponto de "${nome}" em ${data}? Esta ação não pode ser desfeita.`,
    "Excluir Registro",
    async () => {
      const { error } = await supa.from("registros").delete().eq("id", id);
      if (error) return erro("Erro ao excluir.");
      sucesso("Registro excluído!");
      carregarPontosAdmin();
    }
  );
};

// ─── MÓDULO DIÁRIO ─────────────────────────────────────────────────
async function carregarDiariosAdmin() {
  const obraId  = document.getElementById("admin-diario-obra")?.value;
  const mesAno  = document.getElementById("admin-diario-mes")?.value;
  const tbody   = document.getElementById("tabela-diarios");
  if (!tbody) return;
  if (!mesAno) return aviso("Selecione o mês/ano.");

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">
    <span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const [ano, mes] = mesAno.split("-");
  const fim = new Date(Number(ano), Number(mes), 0).getDate();

  let query = supa
    .from("diario_obras")
    .select("id, data, condicoes_climaticas, resumo_atividades, link_fotos_drive, obra_id, obras(nome)")
    .gte("data", `${ano}-${mes}-01`)
    .lte("data", `${ano}-${mes}-${String(fim).padStart(2,"0")}`)
    .order("data", { ascending: false });

  if (obraId) query = query.eq("obra_id", obraId);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <span class="material-symbols-outlined">menu_book</span>Nenhum registro encontrado.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const d of data) {
    const tr = document.createElement("tr");

    const urlsRaw = parseFotosCampo(d.link_fotos_drive);
    const tdFotos = document.createElement("td");
    tdFotos.style.textAlign = "center";

    if (urlsRaw.length > 0) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;gap:5px;justify-content:center;flex-wrap:wrap;";
      let idx = 0;
      for (const raw of urlsRaw) {
        const url = await resolverUrlFotoDiario("diario-obras", raw);
        if (!url) continue;
        idx++;
        const img = document.createElement("img");
        img.src = url;
        img.alt = `Foto ${idx}`;
        img.style.cssText = "width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer;transition:transform 0.15s;";
        img.addEventListener("click", () => abrirLightbox(url, `Foto ${idx}`));
        img.addEventListener("mouseover", () => img.style.transform = "scale(1.1)");
        img.addEventListener("mouseout",  () => img.style.transform = "scale(1)");
        wrap.appendChild(img);
      }
      if (wrap.childNodes.length > 0) tdFotos.appendChild(wrap);
      else tdFotos.textContent = "—";
    } else {
      tdFotos.textContent = "—";
      tdFotos.style.color = "#cbd5e1";
    }

    // Botões de ação (somente admin)
    if (usuarioAdminAtual?.perfil?.tipo === "admin") {
      const actDiv = document.createElement("div");
      actDiv.style.cssText = "display:flex;gap:6px;justify-content:center;margin-top:6px;";

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn-primary btn-sm";
      btnEdit.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;">edit</span>';
      btnEdit.addEventListener("click", () => editarDiarioAdmin(d.id));

      const btnDel = document.createElement("button");
      btnDel.className = "btn-danger btn-sm";
      btnDel.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;">delete</span>';
      btnDel.addEventListener("click", () => excluirDiarioAdmin(d.id, d.data));

      actDiv.appendChild(btnEdit);
      actDiv.appendChild(btnDel);
      tdFotos.appendChild(actDiv);
    }

    tr.innerHTML = `
      <td style="font-weight:600;">${formatarDataBR(d.data)}</td>
      <td>${escapeHtml(d.obras?.nome || "—")}</td>
      <td>${escapeHtml(d.condicoes_climaticas || "—")}</td>
      <td style="max-width:260px;">${escapeHtml(d.resumo_atividades || "—")}</td>`;
    tr.appendChild(tdFotos);
    tbody.appendChild(tr);
  }
}

window.editarDiarioAdmin = async (id) => {
  const { data } = await supa.from("diario_obras").select("*").eq("id", id).single();
  if (!data) return erro("Erro ao carregar.");
  document.getElementById("card-edit-diario").style.display = "block";
  document.getElementById("diario-admin-id").value      = data.id;
  document.getElementById("diario-admin-data").value    = data.data;
  document.getElementById("diario-admin-clima").value   = data.condicoes_climaticas;
  document.getElementById("diario-admin-resumo").value  = data.resumo_atividades;
  document.getElementById("card-edit-diario").scrollIntoView({ behavior: "smooth", block: "center" });
};

window.salvarEdicaoDiarioAdmin = async () => {
  const id     = document.getElementById("diario-admin-id").value;
  const clima  = document.getElementById("diario-admin-clima").value;
  const resumo = document.getElementById("diario-admin-resumo").value;
  const btn    = document.querySelector("#card-edit-diario .btn-primary");
  setBtnLoading(btn, true);
  const { error } = await supa.from("diario_obras").update({ condicoes_climaticas: clima, resumo_atividades: resumo }).eq("id", id);
  setBtnLoading(btn, false);
  if (error) return erro("Erro ao salvar.");
  sucesso("Diário atualizado!");
  window.cancelarEdicaoDiario();
  carregarDiariosAdmin();
};

window.cancelarEdicaoDiario = () => {
  document.getElementById("card-edit-diario").style.display = "none";
  document.getElementById("form-diario-admin")?.reset();
};

window.excluirDiarioAdmin = (id, data) => {
  confirmar(
    `Excluir o diário do dia ${formatarDataBR(data)}? Fotos vinculadas não serão removidas do storage.`,
    "Excluir Diário",
    async () => {
      const { error } = await supa.from("diario_obras").delete().eq("id", id);
      if (error) return erro("Erro ao excluir.");
      sucesso("Diário excluído!");
      carregarDiariosAdmin();
    }
  );
};

// ─── MÓDULO CAIXA ──────────────────────────────────────────────────
async function uploadComprovantesAdmin(files, obraId) {
  const arr = Array.from(files || []).filter(Boolean);
  if (!arr.length) return [];
  const paths = [];
  for (const f of arr) {
    const ext  = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const rand = Math.random().toString(16).slice(2);
    const nome = `${Date.now()}_${rand}.${ext || "bin"}`;
    const path = `caixa/${obraId}/${usuarioAdminAtual?.auth?.id || "system"}/${nome}`;
    const { error } = await supa.storage.from("comprovantes").upload(path, f, {
      cacheControl: "3600", upsert: false, contentType: f.type || "application/octet-stream"
    });
    if (error) { aviso("Falha ao enviar comprovante: " + (error.message || "erro")); continue; }
    paths.push(path);
  }
  return paths;
}

async function salvarCaixaAdmin(e) {
  e.preventDefault();
  const btn = e.submitter || document.querySelector("#form-caixa-admin .btn-primary");
  setBtnLoading(btn, true);

  const id            = document.getElementById("caixa-admin-id").value;
  const obraId        = document.getElementById("caixa-admin-obra").value;
  const data          = document.getElementById("caixa-admin-data").value;
  const categoria     = document.getElementById("caixa-admin-categoria")?.value?.trim() || "";
  const desc          = document.getElementById("caixa-admin-desc").value.trim();
  const valorStr      = document.getElementById("caixa-admin-valor").value;
  const fornecedor    = document.getElementById("caixa-admin-fornecedor")?.value?.trim() || "";
  const documento     = document.getElementById("caixa-admin-documento")?.value?.trim() || "";
  const observacoes   = document.getElementById("caixa-admin-observacoes")?.value?.trim() || "";
  const formaPagamento= document.getElementById("caixa-admin-pagamento")?.value?.trim() || "";
  const parcelasStr   = String(document.getElementById("caixa-admin-parcelas")?.value || "").trim();
  const parcelasRaw   = Number(parcelasStr || 0);
  const parcelasFinal = formaPagamento === "Cartão de Crédito" ? (parcelasRaw > 0 ? parcelasRaw : 1) : null;

  if (!obraId)  { setBtnLoading(btn,false); return aviso("Selecione a obra."); }
  if (!data)    { setBtnLoading(btn,false); return aviso("Informe a data."); }
  if (!categoria){ setBtnLoading(btn,false); return aviso("Selecione a categoria."); }
  if (!desc)    { setBtnLoading(btn,false); return aviso("Informe a descrição."); }
  if (!valorStr){ setBtnLoading(btn,false); return aviso("Informe o valor."); }
  if (!formaPagamento){ setBtnLoading(btn,false); return aviso("Selecione a forma de pagamento."); }

  const valor = parseFloat(valorStr.replace("R$","").replace(/\./g,"").replace(",",".").trim());
  if (!Number.isFinite(valor) || valor <= 0) { setBtnLoading(btn,false); return aviso("Valor inválido."); }

  const inputFiles  = document.getElementById("caixa-admin-comprovantes");
  const novos       = await uploadComprovantesAdmin(inputFiles?.files, obraId);
  const comprovantes= [...(window.__caixaAdminComprovantesExistentes || []), ...novos];

  const payload = {
    obra_id: obraId, usuario_id: usuarioAdminAtual?.perfil?.id, data,
    categoria: categoria || null, descricao: desc, valor,
    fornecedor: fornecedor || null, documento: documento || null,
    observacoes: observacoes || null, forma_pagamento: formaPagamento || null,
    parcelas: parcelasFinal, comprovantes
  };

  const tentarUpsert = async (p) => id
    ? await supa.from("caixa_obra").update(p).eq("id", id)
    : await supa.from("caixa_obra").insert([p]);

  let { error } = await tentarUpsert(payload);

  // Retry em caso de schema cache
  if (error) {
    const msg0 = String(error.message || "");
    if (/schema cache/i.test(msg0) || /in the schema cache/i.test(msg0)) {
      await new Promise(r => setTimeout(r, 1800));
      const r2 = await tentarUpsert(payload);
      error = r2.error;
    }
  }

  // Fallback sem colunas novas
  if (error) {
    const msg = String(error.message || "");
    if (msg.includes("column") && (msg.includes("categoria") || msg.includes("fornecedor") || msg.includes("comprovantes"))) {
      const payloadAntigo = { obra_id: obraId, usuario_id: usuarioAdminAtual?.perfil?.id, data, descricao: desc, valor };
      const res2 = id
        ? await supa.from("caixa_obra").update(payloadAntigo).eq("id", id)
        : await supa.from("caixa_obra").insert([payloadAntigo]);
      setBtnLoading(btn, false);
      if (res2.error) return erro("Erro: " + res2.error.message);
      sucesso("Lançamento salvo (modo compatibilidade).");
      resetFormCaixaAdmin();
      carregarCaixaAdmin();
      return;
    }
    setBtnLoading(btn, false);
    return erro("Erro: " + error.message);
  }

  setBtnLoading(btn, false);
  sucesso(id ? "Lançamento atualizado!" : "Lançamento salvo!");
  resetFormCaixaAdmin();
  carregarCaixaAdmin();
}

function resetFormCaixaAdmin() {
  document.getElementById("form-caixa-admin")?.reset();
  document.getElementById("caixa-admin-id").value = "";
  window.__caixaAdminComprovantesExistentes = [];
  atualizarUIParcelasCaixaAdmin();
}

async function carregarCaixaAdmin() {
  const obraId    = document.getElementById("caixa-filtro-obra")?.value;
  const mesAno    = document.getElementById("caixa-filtro-mes")?.value;
  const categoria = document.getElementById("caixa-filtro-categoria")?.value?.trim() || "";
  const tbody     = document.getElementById("tabela-caixa-admin");

  if (!tbody) return;
  if (!mesAno) return aviso("Selecione o mês.");

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">
    <span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const [ano, mes] = mesAno.split("-");
  const inicio = `${ano}-${mes}-01`;
  const fim    = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;

  let query = supa.from("caixa_obra")
    .select("id, data, descricao, valor, categoria, fornecedor, documento, observacoes, forma_pagamento, parcelas, comprovantes, obras(nome)")
    .gte("data", inicio).lte("data", fim)
    .order("data", { ascending: false });
  if (obraId)    query = query.eq("obra_id", obraId);
  if (categoria) query = query.eq("categoria", categoria);

  const { data, error } = await query;

  if (error) return tbody.innerHTML = `<tr><td colspan="8" style="color:#ef4444;text-align:center;padding:16px;">Erro SQL: ${escapeHtml(error.message)}</td></tr>`;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <span class="material-symbols-outlined">payments</span>Nenhum lançamento no período.</div></td></tr>`;
    atualizarResumosCaixaAdmin([], obraId, inicio, fim);
    return;
  }

  // Totalizador
  const total = data.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);
  const countEl = document.getElementById("count-tabela-caixa");
  if (countEl) countEl.textContent = `${data.length} lançamento(s) — Total: ${total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`;

  tbody.innerHTML = "";
  data.forEach(l => {
    const valor = (l.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const formaPag = formatarPagamentoCaixaAdmin(l);
    const comprs   = parseFotosCampo(l.comprovantes);
    const btnComp  = comprs.length > 0
      ? comprs.map((c, i) => `<button class="btn-ghost btn-sm" onclick="abrirComprovanteAdmin('${encodeURIComponent(c)}')" title="Ver comprovante">${i+1}📎</button>`).join("")
      : "";

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:600;white-space:nowrap;">${formatarDataBR(l.data)}</td>
        <td><small style="color:#64748b;">${escapeHtml(l.obras?.nome || "—")}</small></td>
        <td><span class="md-chip" style="font-size:11px;">${escapeHtml(l.categoria || "—")}</span></td>
        <td style="max-width:200px;" title="${escapeHtml(l.descricao||"")}">
          <div style="font-weight:500;">${escapeHtml(l.descricao || "—")}</div>
          ${l.fornecedor ? `<div style="font-size:11px;color:#94a3b8;">${escapeHtml(l.fornecedor)}</div>` : ""}
        </td>
        <td style="color:#64748b;font-size:12px;">${escapeHtml(formaPag || "—")}</td>
        <td style="font-weight:700;color:#ef4444;">${valor}</td>
        <td>${btnComp}</td>
        <td class="actions-cell">
          <button class="btn-primary btn-sm" onclick="editarCaixaAdmin('${l.id}')">Editar</button>
          <button class="btn-danger  btn-sm" onclick="excluirCaixaAdmin('${l.id}', '${escapeHtml(l.descricao||"")}')">Excluir</button>
        </td>
      </tr>`;
  });

  atualizarResumosCaixaAdmin(data, obraId, inicio, fim);
}

function formatarPagamentoCaixaAdmin(item) {
  const forma = (item?.forma_pagamento || "").trim();
  const parcelas = Number(item?.parcelas || 0);
  if (!forma) return "";
  if (forma === "Cartão de Crédito" && parcelas > 0) return `${forma} (${parcelas}x)`;
  return forma;
}

async function atualizarResumosCaixaAdmin(lancamentos, obraId, inicio, fim) {
  const elDesp  = document.getElementById("caixa-total-despesas");
  const elRH    = document.getElementById("caixa-total-rh");
  const elTotal = document.getElementById("caixa-total-geral");
  const tbodyCats = document.getElementById("caixa-cats-tabela");

  if (!elDesp || !elRH || !elTotal) return;

  const totalDespesas = (lancamentos || []).reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

  let queryRH = supa.from("registros").select("valor").gte("data", inicio).lte("data", fim);
  if (obraId) queryRH = queryRH.eq("obra_id", obraId);

  const { data: regs, error: errRH } = await queryRH;
  if (errRH) { console.error(errRH); }
  const totalRH = (regs || []).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);

  const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  elDesp.textContent  = fmt(totalDespesas);
  elRH.textContent    = fmt(totalRH);
  elTotal.textContent = fmt(totalDespesas + totalRH);

  if (tbodyCats) {
    const porCat = {};
    (lancamentos || []).forEach(l => {
      const cat = (l.categoria || "Outros").trim() || "Outros";
      porCat[cat] = (porCat[cat] || 0) + (Number(l.valor) || 0);
    });
    const cats = Object.entries(porCat).map(([c, t]) => ({ c, t })).sort((a,b) => b.t - a.t);
    tbodyCats.innerHTML = cats.length === 0
      ? "<tr><td colspan='2' style='text-align:center;padding:10px;color:#94a3b8;'>Sem despesas.</td></tr>"
      : cats.slice(0,12).map(x => `<tr><td style="font-weight:600;">${escapeHtml(x.c)}</td><td style="text-align:right;font-weight:700;">${fmt(x.t)}</td></tr>`).join("");
  }

  // Salva contexto para detalhado
  window.__caixaCustoContext = { obraId, inicio, fim };
}

window.editarCaixaAdmin = async (id) => {
  const { data, error } = await supa.from("caixa_obra").select("*").eq("id", id).single();
  if (error || !data) return erro("Erro ao carregar lançamento.");

  document.getElementById("caixa-admin-id").value = data.id;
  document.getElementById("caixa-admin-obra").value = data.obra_id || "";
  document.getElementById("caixa-admin-data").value = data.data || "";
  document.getElementById("caixa-admin-categoria").value = data.categoria || "";
  document.getElementById("caixa-admin-desc").value = data.descricao || "";
  const elValor = document.getElementById("caixa-admin-valor");
  elValor.value = (Number(data.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  elValor.dispatchEvent(new Event("input"));
  document.getElementById("caixa-admin-fornecedor").value = data.fornecedor || "";
  document.getElementById("caixa-admin-documento").value  = data.documento  || "";
  const obsEl = document.getElementById("caixa-admin-observacoes");
  if (obsEl) obsEl.value = data.observacoes || "";
  const selPag = document.getElementById("caixa-admin-pagamento");
  if (selPag) selPag.value = data.forma_pagamento || "";
  const inpParc = document.getElementById("caixa-admin-parcelas");
  if (inpParc) inpParc.value = data.parcelas ? String(data.parcelas) : "";
  window.__caixaAdminComprovantesExistentes = parseFotosCampo(data.comprovantes);
  atualizarUIParcelasCaixaAdmin();

  document.getElementById("sec-caixa").scrollIntoView({ behavior: "smooth", block: "start" });
  aviso("Editando lançamento.");
};

window.excluirCaixaAdmin = (id, desc) => {
  confirmar(
    `Excluir o lançamento "${desc}"? Esta ação não pode ser desfeita.`,
    "Excluir Lançamento",
    async () => {
      const { error } = await supa.from("caixa_obra").delete().eq("id", id);
      if (error) return erro("Erro ao excluir.");
      sucesso("Lançamento excluído!");
      carregarCaixaAdmin();
    }
  );
};

window.abrirComprovanteAdmin = async (pathEnc) => {
  try {
    const path = decodeURIComponent(String(pathEnc || ""));
    const url  = await resolverUrlFotoDiario("comprovantes", path, 3600);
    if (!url) return aviso("Sem acesso ao comprovante (ou expirou).");
    window.open(url, "_blank");
  } catch (e) { aviso("Não foi possível abrir o comprovante."); }
};

// Detalhado custo
window.caixaToggleDetalhadoCusto = async () => {
  const box = document.getElementById("caixa-custo-detalhado");
  const btn = document.getElementById("btn-caixa-detalhado");
  if (!box) return;
  const abrindo = box.style.display === "none" || box.style.display === "";
  box.style.display = abrindo ? "block" : "none";
  if (btn) btn.textContent = abrindo ? "Fechar detalhado" : "Ver detalhado";
  if (abrindo) await carregarDetalhadoCustoCaixa(window.__caixaCustoContext || null);
};

async function carregarDetalhadoCustoCaixa(ctx) {
  const tbody = document.getElementById("caixa-custo-rh-detalhe");
  if (!tbody) return;
  if (!ctx?.inicio || !ctx?.fim) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;color:#94a3b8;'>Selecione Obra e Mês para ver o detalhado.</td></tr>";
    return;
  }
  if (!ctx.obraId) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;color:#94a3b8;'>Selecione uma obra específica para detalhar por funcionário.</td></tr>";
    return;
  }
  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:10px;'>Carregando...</td></tr>";
  const { data: regs, error } = await supa
    .from("registros")
    .select("funcionario_id, horas_extras, valor, funcionarios(nome)")
    .eq("obra_id", ctx.obraId)
    .gte("data", ctx.inicio).lte("data", ctx.fim);

  if (error) { tbody.innerHTML = "<tr><td colspan='4' style='color:#ef4444;text-align:center;'>Erro ao carregar RH.</td></tr>"; return; }

  const map = new Map();
  (regs || []).forEach(r => {
    const id   = r.funcionario_id;
    const nome = r.funcionarios?.nome || "—";
    if (!map.has(id)) map.set(id, { nome, dias: 0, extras: 0, total: 0 });
    const item = map.get(id);
    item.dias++; item.extras += Number(r.horas_extras || 0); item.total += Number(r.valor || 0);
  });

  const lista = Array.from(map.values()).sort((a,b) => b.total - a.total);
  if (lista.length === 0) { tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;color:#94a3b8;'>Sem registros de RH.</td></tr>"; return; }

  tbody.innerHTML = "";
  lista.forEach(i => {
    tbody.innerHTML += `<tr>
      <td style="font-weight:600;">${escapeHtml(i.nome)}</td>
      <td style="text-align:center;">${i.dias}</td>
      <td style="text-align:center;">${(Math.round(i.extras*10)/10).toLocaleString("pt-BR")}</td>
      <td style="text-align:right;font-weight:700;">${i.total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
    </tr>`;
  });
}

function prefillRelatorioCustoFromCaixa() {
  const obraId    = document.getElementById("caixa-filtro-obra")?.value;
  const mesAno    = document.getElementById("caixa-filtro-mes")?.value;
  const catFiltro = (document.getElementById("caixa-filtro-categoria")?.value || "").trim();
  window.__custoFiltroCategoria = catFiltro;

  if (!obraId) { aviso("Selecione uma obra no filtro do Caixa."); return false; }
  if (!mesAno) { aviso("Selecione um mês no filtro do Caixa."); return false; }

  const [ano, mes] = mesAno.split("-");
  const relObra = document.getElementById("relatorio-obra");
  const relTipo = document.getElementById("relatorio-tipo");
  const relMes  = document.getElementById("rel-mes");
  const relAno  = document.getElementById("rel-ano-mensal");
  if (relObra) relObra.value = obraId;
  if (relTipo) relTipo.value = "mensal";
  if (relMes)  relMes.value  = String(Number(mes));
  if (relAno)  relAno.value  = String(Number(ano));
  return true;
}

window.caixaAbrirRelatorioCusto = () => {
  if (typeof window.caixaToggleDetalhadoCusto === "function") window.caixaToggleDetalhadoCusto();
};
window.caixaGerarCustoPDF = async () => {
  const ok = prefillRelatorioCustoFromCaixa();
  if (!ok) return;
  if (typeof baixarCustoObraPDF !== "function") return erro("Função de PDF não encontrada.");
  await baixarCustoObraPDF();
  window.__custoFiltroCategoria = "";
};
window.caixaGerarCustoExcel = async () => {
  const ok = prefillRelatorioCustoFromCaixa();
  if (!ok) return;
  if (typeof baixarCustoObraExcel !== "function") return erro("Função de Excel não encontrada.");
  await baixarCustoObraExcel();
  window.__custoFiltroCategoria = "";
};
