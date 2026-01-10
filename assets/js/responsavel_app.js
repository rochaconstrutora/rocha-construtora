// responsavel_app.js — V1.2 (Checklist de Presença + Horas Extras por pessoa)
let usuarioAtual = null;
let obraAtualId = null;
let editandoDiarioId = null;

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getPontoPadrao() {
  const tipoPadrao = document.getElementById("ponto-tipo-padrao")?.value || "DIARIA";
  const extrasPadrao = num(document.getElementById("ponto-extras-padrao")?.value, 0);
  return { tipoPadrao, extrasPadrao: Math.max(0, extrasPadrao) };
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await protegerPagina("responsavel");
  if (!user) return;

  usuarioAtual = user;
  obraAtualId = user.perfil.obra_id;
  if (!obraAtualId) return erro("Erro: Usuário sem obra vinculada.");

  const { data: obra } = await supa.from("obras").select("nome").eq("id", obraAtualId).single();
  if (obra) document.getElementById("obra-titulo").textContent = obra.nome;
  document.getElementById("user-badge").textContent = user.perfil.nome.split(" ")[0];

  const hoje = hojeLocalISO();
  ["ponto-data", "diario-data", "gasto-data"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = hoje;
  });

  document.getElementById("ponto-data")?.addEventListener("change", () => {
    carregarListaPonto();
    carregarFuncionariosPonto();
    carregarChecklistPonto();
  });

  document.getElementById("diario-data")?.addEventListener("change", carregarListaDiario);

  document.getElementById("ponto-marcar-todos")?.addEventListener("change", (e) => {
    marcarTodosChecklistPonto(!!e.target.checked);
  });

  carregarFuncionariosPonto();
  carregarChecklistPonto();
  carregarListaPonto();
  carregarListaDiario();
  carregarListaMateriais();

  // UI: Parcelas só quando for Cartão de Crédito
  document.getElementById("gasto-pagamento")?.addEventListener("change", atualizarUIParcelasGasto);
  atualizarUIParcelasGasto();

  carregarListaGastos();
});

// === PONTO (INDIVIDUAL) (Com Cálculo de Extras) ===
async function carregarFuncionariosPonto() {
  const dataSel = document.getElementById("ponto-data")?.value;
  const select = document.getElementById("ponto-funcionario");
  if (!select || !dataSel) return;

  const { data: funcs } = await supa
    .from("funcionarios")
    .select("id, nome")
    .eq("obra_id", obraAtualId)
    .eq("ativo", true)
    .order("nome");

  const { data: regs } = await supa
    .from("registros")
    .select("funcionario_id")
    .eq("obra_id", obraAtualId)
    .eq("data", dataSel);

  const jaFoi = new Set((regs || []).map((r) => r.funcionario_id));

  select.innerHTML = "<option value=''>Selecione...</option>";
  if (funcs) {
    funcs.forEach((f) => {
      if (!jaFoi.has(f.id)) {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.nome;
        select.appendChild(opt);
      }
    });
  }
}

async function registrarPonto() {
  const funcId = document.getElementById("ponto-funcionario")?.value;
  const tipo = document.getElementById("ponto-tipo")?.value;
  const data = document.getElementById("ponto-data")?.value;
  const horasExtras = num(document.getElementById("ponto-extras")?.value, 0);

  if (!funcId || !tipo || !data) return aviso("Preencha funcionário e tipo.");

  const { data: f } = await supa
    .from("funcionarios")
    .select("funcoes(valor_meia, valor_diaria, valor_hora)")
    .eq("id", funcId)
    .single();

  const valDiaria = tipo === "DIARIA" ? num(f?.funcoes?.valor_diaria, 0) : num(f?.funcoes?.valor_meia, 0);
  const valHora = num(f?.funcoes?.valor_hora, 0);
  const totalCalculado = valDiaria + Math.max(0, horasExtras) * valHora;

  const payload = {
    obra_id: obraAtualId,
    funcionario_id: funcId,
    data,
    tipo,
    valor: totalCalculado,
    horas_extras: Math.max(0, horasExtras),
  };

  const { error } = await supa.from("registros").insert([payload]);
  if (error) return erro("Erro ao registrar: " + error.message);

  sucesso("Ponto registrado!");
  const extrasEl = document.getElementById("ponto-extras");
  if (extrasEl) extrasEl.value = "";

  carregarFuncionariosPonto();
  carregarChecklistPonto();
  carregarListaPonto();
}

// === PONTO (CHECKLIST / LOTE) ===
async function carregarChecklistPonto() {
  const tbody = document.getElementById("ponto-checklist");
  const dataSel = document.getElementById("ponto-data")?.value;
  if (!tbody || !dataSel) return;

  const cbTodos = document.getElementById("ponto-marcar-todos");
  if (cbTodos) cbTodos.checked = false;

  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:10px;'>Carregando...</td></tr>";

  const [{ data: funcs, error: errF }, { data: regs, error: errR }] = await Promise.all([
    supa.from("funcionarios").select("id, nome").eq("obra_id", obraAtualId).eq("ativo", true).order("nome"),
    supa.from("registros").select("funcionario_id").eq("obra_id", obraAtualId).eq("data", dataSel),
  ]);

  if (errF || errR) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:10px;'>Erro ao carregar lista.</td></tr>";
    return;
  }

  const jaFoi = new Set((regs || []).map((r) => r.funcionario_id));
  const pendentes = (funcs || []).filter((f) => !jaFoi.has(f.id));

  if (pendentes.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='4' style='text-align:center; padding:10px;'>Todos já estão lançados para esta data.</td></tr>";
    return;
  }

  const { tipoPadrao, extrasPadrao } = getPontoPadrao();

  tbody.innerHTML = "";
  pendentes.forEach((f) => {
    const tr = document.createElement("tr");

    // Presença
    const tdPres = document.createElement("td");
    tdPres.style.textAlign = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "ponto-presenca";
    cb.dataset.funcionarioId = f.id;
    tdPres.appendChild(cb);

    // Nome
    const tdNome = document.createElement("td");
    tdNome.textContent = f.nome || "-";

    // Tipo
    const tdTipo = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "form-control ponto-tipo-row";
    const opt1 = document.createElement("option");
    opt1.value = "DIARIA";
    opt1.textContent = "Diária";
    const opt2 = document.createElement("option");
    opt2.value = "MEIA";
    opt2.textContent = "Meia";
    sel.appendChild(opt1);
    sel.appendChild(opt2);
    sel.value = tipoPadrao;
    tdTipo.appendChild(sel);

    // Extras (habilita somente quando marcar presença)
    const tdExt = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "0.5";
    inp.placeholder = "0";
    inp.className = "form-control ponto-extras-row";
    inp.value = extrasPadrao ? String(extrasPadrao) : "";
    inp.disabled = true;

    cb.addEventListener("change", () => {
      inp.disabled = !cb.checked;
      if (!cb.checked) {
        inp.value = "";
      } else if (!inp.value) {
        inp.value = extrasPadrao ? String(extrasPadrao) : "";
      }
    });

    tdExt.appendChild(inp);

    tr.appendChild(tdPres);
    tr.appendChild(tdNome);
    tr.appendChild(tdTipo);
    tr.appendChild(tdExt);
    tbody.appendChild(tr);
  });
}

function marcarTodosChecklistPonto(marcado) {
  const tbody = document.getElementById("ponto-checklist");
  if (!tbody) return;
  const checkboxes = Array.from(tbody.querySelectorAll("input.ponto-presenca"));
  checkboxes.forEach((cb) => {
    cb.checked = !!marcado;
    cb.dispatchEvent(new Event("change"));
  });
}

window.aplicarPadraoPonto = () => {
  const tbody = document.getElementById("ponto-checklist");
  if (!tbody) return;

  const { tipoPadrao, extrasPadrao } = getPontoPadrao();

  const checkboxes = Array.from(tbody.querySelectorAll("input.ponto-presenca"));
  const selecionados = checkboxes.filter((c) => c.checked);
  const alvo = selecionados.length > 0 ? selecionados : checkboxes;

  alvo.forEach((cb) => {
    const tr = cb.closest("tr");
    if (!tr) return;
    const sel = tr.querySelector("select.ponto-tipo-row");
    const inp = tr.querySelector("input.ponto-extras-row");
    if (sel) sel.value = tipoPadrao;
    if (inp) inp.value = extrasPadrao ? String(extrasPadrao) : "";
  });

  sucesso("Padrão aplicado.");
};

window.registrarPontoEmLote = async () => {
  const tbody = document.getElementById("ponto-checklist");
  const dataSel = document.getElementById("ponto-data")?.value;
  if (!tbody || !dataSel) return;

  const selecionados = Array.from(tbody.querySelectorAll("input.ponto-presenca"))
    .filter((c) => c.checked)
    .map((cb) => {
      const tr = cb.closest("tr");
      const funcId = cb.dataset.funcionarioId;
      const tipo = tr?.querySelector("select.ponto-tipo-row")?.value || "";
      const extras = num(tr?.querySelector("input.ponto-extras-row")?.value, 0);
      return { funcId, tipo, extras: Math.max(0, extras) };
    });

  if (selecionados.length === 0) return aviso("Marque pelo menos 1 funcionário como presente.");

  for (const s of selecionados) {
    if (!s.funcId || !s.tipo) return aviso("Preencha o tipo (Diária/Meia) de todos os selecionados.");
  }

  const ids = selecionados.map((s) => s.funcId);
  const { data: funcs, error } = await supa
    .from("funcionarios")
    .select("id, funcoes(valor_meia, valor_diaria, valor_hora)")
    .in("id", ids);

  if (error) return erro("Erro ao buscar valores: " + error.message);

  const mapa = new Map();
  (funcs || []).forEach((f) => mapa.set(f.id, f));

  const payloads = selecionados.map((s) => {
    const f = mapa.get(s.funcId);
    const valDiaria = s.tipo === "DIARIA" ? num(f?.funcoes?.valor_diaria, 0) : num(f?.funcoes?.valor_meia, 0);
    const valHora = num(f?.funcoes?.valor_hora, 0);
    const total = valDiaria + s.extras * valHora;
    return {
      obra_id: obraAtualId,
      funcionario_id: s.funcId,
      data: dataSel,
      tipo: s.tipo,
      valor: total,
      horas_extras: s.extras,
    };
  });

  const btn = document.querySelector("#tab-frequencia button.btn-primary[onclick='registrarPontoEmLote()']");
  const oldTxt = btn ? btn.textContent : "";
  if (btn) btn.textContent = "Salvando...";

  const { error: insErr } = await supa.from("registros").insert(payloads);

  if (btn) btn.textContent = oldTxt || "Registrar Selecionados";

  if (insErr) return erro("Erro ao registrar: " + insErr.message);

  sucesso(`Registrado: ${payloads.length} presença(s)!`);
  carregarFuncionariosPonto();
  carregarChecklistPonto();
  carregarListaPonto();
};

async function carregarListaPonto() {
  const data = document.getElementById("ponto-data")?.value;
  const tbody = document.getElementById("lista-ponto");
  if (!tbody || !data) return;

  const { data: regs } = await supa
    .from("registros")
    .select("id, valor, horas_extras, funcionarios(nome)")
    .eq("obra_id", obraAtualId)
    .eq("data", data)
    .order("created_at", { ascending: false });

  tbody.innerHTML = "";
  if (!regs || regs.length === 0) {
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:10px;'>Nenhum registro hoje.</td></tr>";
    return;
  }

  regs.forEach((r) => {
    const extrasTxt =
      num(r.horas_extras, 0) > 0
        ? `<div style='font-size:10px; color:#d97706; font-weight:600;'>+ ${num(r.horas_extras, 0)}h extras</div>`
        : "";
    tbody.innerHTML += `
        <tr>
            <td>${escapeHtml((r.funcionarios?.nome || "").split(" ")[0])}</td>
            <td>
                ${(num(r.valor, 0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                ${extrasTxt}
            </td>
            <td><button class="btn-danger btn-sm" onclick="excluirPonto('${r.id}')">X</button></td>
        </tr>`;
  });
}

window.excluirPonto = async (id) => {
  if (!confirm("Apagar?")) return;
  await supa.from("registros").delete().eq("id", id);
  carregarListaPonto();
  carregarFuncionariosPonto();
  carregarChecklistPonto();
};

// === DIÁRIO DE OBRA ===
async function salvarDiario() {
  const data = document.getElementById("diario-data").value;
  const clima = document.getElementById("diario-clima").value;
  const resumo = document.getElementById("diario-resumo").value.trim();
  const fileInput = document.getElementById("diario-foto");
  const statusDiv = document.getElementById("upload-status");
  const btnSalvar = document.querySelector("#tab-diario button.btn-primary");

  if (!resumo) return aviso("Escreva o resumo.");

  if (!editandoDiarioId) {
    const { data: existe } = await supa.from("diario_obras").select("id").eq("obra_id", obraAtualId).eq("data", data);
    if (existe && existe.length > 0) return aviso("Já existe um diário para hoje! Use a edição.");
  }

  let listaUrls = [];
  let fotosParaSalvar = null;

  if (fileInput.files.length > 0) {
    statusDiv.style.display = "block";
    for (let i = 0; i < fileInput.files.length; i++) {
      const arq = fileInput.files[i];
      statusDiv.textContent = `Enviando foto ${i + 1}...`;
      try {
        const comp = await new Promise((res, rej) => {
          new Compressor(arq, {
            quality: 0.6,
            maxWidth: 1280,
            success(r) { res(r); },
            error(e) { rej(e); },
          });
        });
        const nome = `${Date.now()}_${i}_${arq.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { data: up, error: upErr } = await supa.storage.from("diario-obras").upload(nome, comp);
        if (!upErr) {
          listaUrls.push(up?.path || nome);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fotosParaSalvar = JSON.stringify(listaUrls);
  } else if (editandoDiarioId) {
    fotosParaSalvar = undefined;
  }

  statusDiv.textContent = "Salvando...";
  const payload = {
    obra_id: obraAtualId,
    usuario_id: usuarioAtual.perfil.id,
    data,
    condicoes_climaticas: clima,
    resumo_atividades: resumo,
  };
  if (fotosParaSalvar !== undefined) payload.link_fotos_drive = fotosParaSalvar;

  let error = null;
  if (editandoDiarioId) {
    const res = await supa.from("diario_obras").update(payload).eq("id", editandoDiarioId);
    error = res.error;
    if (!error) sucesso("Atualizado!");
  } else {
    const res = await supa.from("diario_obras").insert([payload]);
    error = res.error;
    if (!error) sucesso("Criado!");
  }

  statusDiv.style.display = "none";
  if (error) return erro("Erro ao salvar.");

  document.getElementById("diario-resumo").value = "";
  fileInput.value = "";
  editandoDiarioId = null;
  btnSalvar.textContent = "Salvar Diário";
  carregarListaDiario();
}

function parseFotosCampo(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return typeof raw === "string" ? [raw] : [];
  }
}

async function carregarListaDiario() {
  const div = document.getElementById("lista-diario");
  if (!div) return;

  div.textContent = "Carregando...";

  const { data, error } = await supa
    .from("diario_obras")
    .select("*")
    .eq("obra_id", obraAtualId)
    .order("data", { ascending: false })
    .limit(5);

  if (error) {
    div.textContent = "Erro ao carregar.";
    return;
  }

  div.innerHTML = "";
  if (!data || data.length === 0) {
    div.textContent = "Nada recente.";
    return;
  }

  for (const d of data) {
    const wrap = document.createElement("div");
    wrap.style.borderBottom = "1px solid #e2e8f0";
    wrap.style.padding = "10px 0";

    const linha1 = document.createElement("div");
    linha1.style.display = "flex";
    linha1.style.justifyContent = "space-between";
    linha1.style.gap = "8px";

    const titulo = document.createElement("div");
    titulo.style.fontWeight = "700";
    titulo.textContent = `${formatarDataBR(d.data)} • ${d.condicoes_climaticas || "-"}`;

    const acoes = document.createElement("div");
    acoes.style.display = "flex";
    acoes.style.gap = "6px";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-secondary btn-sm";
    btnEdit.textContent = "Editar";
    btnEdit.addEventListener("click", () => prepararEdicaoDiario(d.id));

    const btnDel = document.createElement("button");
    btnDel.className = "btn-danger btn-sm";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", () => excluirDiario(d.id));

    acoes.appendChild(btnEdit);
    acoes.appendChild(btnDel);

    linha1.appendChild(titulo);
    linha1.appendChild(acoes);

    const resumo = document.createElement("div");
    resumo.textContent = d.resumo_atividades || "";

    wrap.appendChild(linha1);
    wrap.appendChild(resumo);

    const fotosRaw = parseFotosCampo(d.link_fotos_drive);
    if (fotosRaw.length > 0) {
      const gal = document.createElement("div");
      gal.style.display = "flex";
      gal.style.gap = "6px";
      gal.style.marginTop = "8px";
      gal.style.flexWrap = "wrap";

      let idx = 0;
      for (const raw of fotosRaw) {
        const url = await resolverUrlFotoDiario("diario-obras", raw);
        if (!url) continue;
        idx += 1;

        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        const img = document.createElement("img");
        img.src = url;
        img.alt = `Foto ${idx}`;
        img.style.width = "60px";
        img.style.height = "60px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "4px";

        a.appendChild(img);
        gal.appendChild(a);
      }

      if (gal.childNodes.length > 0) wrap.appendChild(gal);
    }

    div.appendChild(wrap);
  }
}

window.prepararEdicaoDiario = async (id) => {
  const { data } = await supa.from("diario_obras").select("*").eq("id", id).single();
  if (!data) return erro("Erro.");

  document.getElementById("diario-data").value = data.data;
  document.getElementById("diario-clima").value = data.condicoes_climaticas;
  document.getElementById("diario-resumo").value = data.resumo_atividades;

  editandoDiarioId = data.id;
  document.querySelector("#tab-diario button.btn-primary").textContent = "Atualizar Diário";
  window.scrollTo({ top: 0, behavior: "smooth" });
  aviso("Editando diário.");
};

window.excluirDiario = async (id) => {
  if (!confirm("Excluir?")) return;
  await supa.from("diario_obras").delete().eq("id", id);
  carregarListaDiario();
};

// === GASTOS ===
let editandoGastoId = null;

function formatarPagamentoGasto(g) {
  const forma = (g?.forma_pagamento || "").trim();
  const parcelas = Number(g?.parcelas || 0);
  if (!forma) return "";
  if (forma === "Cartão de Crédito" && parcelas > 1) return `${forma} (${parcelas}x)`;
  if (forma === "Cartão de Crédito" && parcelas === 1) return `${forma} (1x)`;
  return forma;
}

function atualizarUIParcelasGasto() {
  const sel = document.getElementById("gasto-pagamento");
  const box = document.getElementById("gasto-parcelas-box");
  const inp = document.getElementById("gasto-parcelas");
  if (!sel || !box) return;
  const ehCredito = (sel.value || "") === "Cartão de Crédito";
  box.style.display = ehCredito ? "" : "none";
  if (ehCredito && inp) {
    const n = Number(inp.value || 0);
    if (!Number.isFinite(n) || n <= 0) inp.value = "1";
  }
  if (!ehCredito && inp) inp.value = "";
}

async function uploadComprovantesResponsavel(files, obraId) {
  const arr = Array.from(files || []).filter(Boolean);
  if (!arr.length) return [];
  const paths = [];

  for (const f of arr) {
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const rand = Math.random().toString(16).slice(2);
    const nome = `${Date.now()}_${rand}.${ext || "bin"}`;
    const path = `caixa/${obraId}/${usuarioAtual?.auth?.id || "system"}/${nome}`;

    const { error } = await supa.storage.from("comprovantes").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || "application/octet-stream"
    });

    if (error) {
      console.error(error);
      aviso("Falha ao enviar comprovante: " + (error.message || "erro"));
      continue;
    }
    paths.push(path);
  }
  return paths;
}

window.abrirComprovanteResponsavel = async (pathEnc) => {
  try {
    const path = decodeURIComponent(String(pathEnc || ""));
    const url = await resolverUrlFotoDiario("comprovantes", path, 3600);
    if (!url) return aviso("Sem acesso ao comprovante (ou expirou).");
    window.open(url, "_blank");
  } catch (e) {
    aviso("Não foi possível abrir.");
  }
};

window.cancelarEdicaoGasto = (silencioso = false) => {
  editandoGastoId = null;
  document.getElementById("gasto-id").value = "";
  document.getElementById("gasto-desc").value = "";
  document.getElementById("gasto-valor").value = "";
  document.getElementById("gasto-fornecedor").value = "";
  document.getElementById("gasto-documento").value = "";
  document.getElementById("gasto-obs").value = "";
  document.getElementById("gasto-categoria").value = "";
  document.getElementById("gasto-pagamento").value = "";
  document.getElementById("gasto-parcelas").value = "";
  const inputFiles = document.getElementById("gasto-comprovantes");
  if (inputFiles) inputFiles.value = "";
  window.__gastoComprovantesExistentes = [];
  atualizarUIParcelasGasto();

  const btnSalvar = document.getElementById("btn-gasto-salvar");
  const btnCancelar = document.getElementById("btn-gasto-cancelar");
  if (btnSalvar) btnSalvar.textContent = "Salvar Despesa";
  if (btnCancelar) btnCancelar.style.display = "none";

  if (!silencioso) sucesso("Edição cancelada.");
};

window.prepararEdicaoGasto = async (id) => {
  const { data, error } = await supa
    .from("caixa_obra")
    .select("*")
    .eq("id", id)
    .eq("usuario_id", usuarioAtual?.perfil?.id)
    .single();

  if (error || !data) return erro("Não foi possível abrir este lançamento.");

  editandoGastoId = data.id;
  document.getElementById("gasto-id").value = data.id;
  document.getElementById("gasto-data").value = data.data || hojeLocalISO();
  document.getElementById("gasto-categoria").value = data.categoria || "";
  document.getElementById("gasto-desc").value = data.descricao || "";
  document.getElementById("gasto-valor").value = Number(data.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  document.getElementById("gasto-valor").dispatchEvent(new Event("input"));

  document.getElementById("gasto-fornecedor").value = data.fornecedor || "";
  document.getElementById("gasto-documento").value = data.documento || "";
  document.getElementById("gasto-obs").value = data.observacoes || "";

  const selPag = document.getElementById("gasto-pagamento");
  if (selPag) selPag.value = data.forma_pagamento || "";
  const inpParc = document.getElementById("gasto-parcelas");
  if (inpParc) inpParc.value = data.parcelas ? String(data.parcelas) : "";

  window.__gastoComprovantesExistentes = parseFotosCampo(data.comprovantes);
  const inputFiles = document.getElementById("gasto-comprovantes");
  if (inputFiles) inputFiles.value = "";

  atualizarUIParcelasGasto();

  const btnSalvar = document.getElementById("btn-gasto-salvar");
  const btnCancelar = document.getElementById("btn-gasto-cancelar");
  if (btnSalvar) btnSalvar.textContent = "Atualizar Despesa";
  if (btnCancelar) btnCancelar.style.display = "";

  aviso("Editando despesa.");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

async function lancarGasto() {
  const id = document.getElementById("gasto-id")?.value || "";
  const categoria = document.getElementById("gasto-categoria")?.value?.trim() || "";
  const desc = document.getElementById("gasto-desc")?.value?.trim() || "";
  const valorStr = document.getElementById("gasto-valor")?.value || "";
  const data = document.getElementById("gasto-data")?.value || hojeLocalISO();

  const fornecedor = document.getElementById("gasto-fornecedor")?.value?.trim() || "";
  const documento = document.getElementById("gasto-documento")?.value?.trim() || "";
  const observacoes = document.getElementById("gasto-obs")?.value?.trim() || "";

  const formaPagamento = document.getElementById("gasto-pagamento")?.value?.trim() || "";
  const parcelasStr = String(document.getElementById("gasto-parcelas")?.value || "").trim();
  const parcelasRaw = Number(parcelasStr || 0);
  const parcelasFinal = (formaPagamento === "Cartão de Crédito") ? (parcelasRaw > 0 ? parcelasRaw : 1) : null;

  // Obrigatórios
  if (!categoria) return aviso("Selecione a categoria.");
  if (!desc) return aviso("Informe a descrição.");
  if (!valorStr) return aviso("Informe o valor.");
  if (!data) return aviso("Informe a data.");
  if (!formaPagamento) return aviso("Selecione a forma de pagamento.");

  // Parcelas (somente crédito)
  if (formaPagamento === "Cartão de Crédito") {
    if (!parcelasStr) {
      const inp = document.getElementById("gasto-parcelas");
      if (inp) inp.value = "1";
    } else if (!Number.isFinite(parcelasRaw) || parcelasRaw < 1) {
      return aviso("Parcelas inválidas.");
    }
  }

  const valor = parseFloat(valorStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
  if (!Number.isFinite(valor) || valor <= 0) return aviso("Valor inválido.");

  // Upload de comprovantes (opcional)
  const inputFiles = document.getElementById("gasto-comprovantes");
  const novos = await uploadComprovantesResponsavel(inputFiles?.files, obraAtualId);
  const comprovantes = [...(window.__gastoComprovantesExistentes || []), ...novos];

  const payloadCompleto = {
    obra_id: obraAtualId,
    usuario_id: usuarioAtual?.perfil?.id,
    data,
    categoria: categoria || null,
    descricao: desc,
    valor,
    fornecedor: fornecedor || null,
    documento: documento || null,
    observacoes: observacoes || null,
    forma_pagamento: formaPagamento || null,
    parcelas: parcelasFinal,
    comprovantes: comprovantes
  };

  const tentarUpsert = async (payload) => {
    if (id) {
      return await supa
        .from("caixa_obra")
        .update(payload)
        .eq("id", id)
        .eq("usuario_id", usuarioAtual?.perfil?.id);
    }
    return await supa.from("caixa_obra").insert([payload]);
  };

  let { error } = await tentarUpsert(payloadCompleto);

  // Retry rápido para casos em que o Supabase/PostgREST ainda não atualizou o "schema cache"
  if (error) {
    const msg0 = String(error.message || "");
    if (/schema cache/i.test(msg0) || /in the schema cache/i.test(msg0)) {
      await new Promise((r) => setTimeout(r, 1800));
      const r2 = await tentarUpsert(payloadCompleto);
      error = r2.error;
    }
  }

  if (error) {
    const msg = String(error.message || "");
    // Compatibilidade com banco antigo (sem as novas colunas)
    if (msg.includes("column") && (msg.includes("categoria") || msg.includes("fornecedor") || msg.includes("comprovantes") || msg.includes("forma_pagamento") || msg.includes("parcelas"))) {
      const payloadAntigo = { obra_id: obraAtualId, usuario_id: usuarioAtual?.perfil?.id, data, descricao: desc, valor };
      let r2;
      if (id) r2 = await supa.from("caixa_obra").update(payloadAntigo).eq("id", id).eq("usuario_id", usuarioAtual?.perfil?.id);
      else r2 = await supa.from("caixa_obra").insert([payloadAntigo]);
      if (r2.error) return erro("Erro: " + r2.error.message);
      aviso("Salvou no modo compatibilidade. Para liberar categoria/fornecedor/pagamento/anexos, rode o arquivo SQL_ATUALIZACAO.sql no Supabase.");
    } else {
      return erro("Erro: " + error.message);
    }
  } else {
    sucesso(id ? "Despesa atualizada!" : "Despesa salva!");
  }

  // Reset
  window.cancelarEdicaoGasto(true);
  carregarListaGastos();
}

async function carregarListaGastos() {
  const tbody = document.getElementById("lista-gastos");
  const inicioMes = mesLocalISO() + "-01";
  if (!tbody) return;

  const { data, error } = await supa
    .from("caixa_obra")
    .select("id, data, categoria, descricao, valor, comprovantes, fornecedor, forma_pagamento, parcelas")
    .eq("obra_id", obraAtualId)
    .eq("usuario_id", usuarioAtual?.perfil?.id)
    .gte("data", inicioMes)
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = "<tr><td colspan='6'>Erro ao carregar.</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  if (!data || !data.length) return (tbody.innerHTML = "<tr><td colspan='6'>Vazio este mês.</td></tr>");

  data.forEach((g) => {
    const val = num(g.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dia = String(g.data || "").split("-")[2] || "";
    const comps = parseFotosCampo(g.comprovantes);
    const compBtn = comps.length
      ? `<button class="btn-secondary btn-sm" onclick="abrirComprovanteResponsavel('${encodeURIComponent(comps[0])}')">Ver (${comps.length})</button>`
      : "-";

    const pag = formatarPagamentoGasto(g);
    const extraLinha = [g.fornecedor ? `Loja: ${escapeHtml(g.fornecedor)}` : "", pag ? `Pag.: ${escapeHtml(pag)}` : ""].filter(Boolean).join(" • ");

    tbody.innerHTML += `
      <tr>
        <td>${dia}</td>
        <td style="font-size:12px;">${escapeHtml(g.categoria || "-")}</td>
        <td style="font-size:12px;">
          ${escapeHtml(g.descricao || "")}
          ${extraLinha ? `<div style="font-size:11px;color:#64748b; margin-top:2px;">${extraLinha}</div>` : ""}
        </td>
        <td style="color:#ef4444; font-weight:bold; font-size:12px; text-align:right;">${val}</td>
        <td>${compBtn}</td>
        <td style="white-space:nowrap;">
          <button class="btn-secondary btn-sm" onclick="prepararEdicaoGasto('${g.id}')">Editar</button>
          <button class="btn-danger btn-sm" onclick="excluirGasto('${g.id}')">Excluir</button>
        </td>
      </tr>`;
  });
}

window.excluirGasto = async (id) => {
  if (!confirm("Excluir?")) return;
  const { error } = await supa
    .from("caixa_obra")
    .delete()
    .eq("id", id)
    .eq("usuario_id", usuarioAtual?.perfil?.id);

  if (error) return erro("Erro: " + error.message);
  sucesso("Excluído.");
  carregarListaGastos();
};

// === MATERIAIS (Com Previsão) ===
async function pedirMaterial() {
  const item = document.getElementById("mat-item").value;
  const qtd = document.getElementById("mat-qtd").value;
  const urg = document.getElementById("mat-urgencia").value;
  const obs = document.getElementById("mat-obs").value;

  if (!item) return aviso("Informe o item.");

  await supa.from("solicitacoes_materiais").insert([
    { obra_id: obraAtualId, usuario_id: usuarioAtual.perfil.id, item, quantidade: qtd, urgencia: urg, obs },
  ]);

  sucesso("Pedido enviado.");
  carregarListaMateriais();
}

async function carregarListaMateriais() {
  const t = document.getElementById("lista-materiais");

  const { data } = await supa
    .from("solicitacoes_materiais")
    .select("item, quantidade, status, previsao_entrega")
    .eq("obra_id", obraAtualId)
    .order("created_at", { ascending: false })
    .limit(5);

  t.innerHTML = "";
  if (data) {
    data.forEach((m) => {
      let statusDisplay = m.status;

      if (m.previsao_entrega) {
        const dataFmt = formatarDataBR(m.previsao_entrega);
        if (m.status === "Entregue") {
          statusDisplay += `<br><small style="color:#166534; font-weight:600;">Entregue: ${dataFmt}</small>`;
        } else {
          statusDisplay += `<br><small style="color:#0284c7; font-weight:600;">Chega: ${dataFmt}</small>`;
        }
      }

      t.innerHTML += `<tr><td><b>${escapeHtml(m.item)}</b><br><small>${escapeHtml(m.quantidade)}</small></td><td>${statusDisplay}</td></tr>`;
    });
  }
}
