// responsavel_app.js — V Final (Com Previsão de Entrega e Horas Extras)
let usuarioAtual = null;
let obraAtualId = null;
let editandoDiarioId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await protegerPagina("responsavel");
  if (!user) return;
  usuarioAtual = user;
  obraAtualId = user.perfil.obra_id;
  if (!obraAtualId) return erro("Erro: Usuário sem obra vinculada.");

  const { data: obra } = await supa.from("obras").select("nome").eq("id", obraAtualId).single();
  if (obra) document.getElementById("obra-titulo").textContent = obra.nome;
  document.getElementById("user-badge").textContent = user.perfil.nome.split(" ")[0];

  const hoje = new Date().toISOString().slice(0, 10);
  ["ponto-data", "diario-data", "gasto-data"].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = hoje;
  });

  document.getElementById("ponto-data")?.addEventListener("change", () => { carregarListaPonto(); carregarFuncionariosPonto(); });
  document.getElementById("diario-data")?.addEventListener("change", carregarListaDiario);

  carregarFuncionariosPonto();
  carregarListaPonto();
  carregarListaDiario();
  carregarListaMateriais();
  carregarListaGastos();
});

// === PONTO (Com Cálculo de Extras) ===
async function carregarFuncionariosPonto() {
  const dataSel = document.getElementById("ponto-data").value;
  const select = document.getElementById("ponto-funcionario");
  const { data: funcs } = await supa.from("funcionarios").select("id, nome").eq("obra_id", obraAtualId).eq("ativo", true).order("nome");
  const { data: regs } = await supa.from("registros").select("funcionario_id").eq("obra_id", obraAtualId).eq("data", dataSel);
  const jaFoi = new Set((regs || []).map(r => r.funcionario_id));
  select.innerHTML = "<option value=''>Selecione...</option>";
  if (funcs) funcs.forEach(f => {
    if (!jaFoi.has(f.id)) {
      let opt = document.createElement("option");
      opt.value = f.id; opt.textContent = f.nome; select.appendChild(opt);
    }
  });
}

async function registrarPonto() {
  const funcId = document.getElementById("ponto-funcionario").value;
  const tipo = document.getElementById("ponto-tipo").value;
  const data = document.getElementById("ponto-data").value;
  const horasExtras = document.getElementById("ponto-extras").value || 0; 

  if(!funcId || !tipo || !data) return aviso("Preencha funcionário e tipo.");

  // Busca valores do cargo
  const { data: f } = await supa.from("funcionarios")
    .select("funcoes(valor_meia, valor_diaria, valor_hora)")
    .eq("id", funcId)
    .single();
  
  // Tratamento de segurança para valores nulos
  const valDiaria = tipo === "DIARIA" 
      ? (Number(f?.funcoes?.valor_diaria) || 0) 
      : (Number(f?.funcoes?.valor_meia) || 0);
  
  const valHora = Number(f?.funcoes?.valor_hora) || 0;
  
  // Cálculo Total
  const totalCalculado = valDiaria + (horasExtras * valHora);

  const payload = { 
      obra_id: obraAtualId, 
      funcionario_id: funcId, 
      data, 
      tipo, 
      valor: totalCalculado, 
      horas_extras: horasExtras 
  };

  const { error } = await supa.from("registros").insert([payload]);
  
  if(error) return erro("Erro ao registrar: " + error.message);
  
  sucesso("Ponto registrado!");
  document.getElementById("ponto-extras").value = ""; 
  carregarFuncionariosPonto();
  carregarListaPonto();
}

async function carregarListaPonto() {
  const data = document.getElementById("ponto-data").value;
  const tbody = document.getElementById("lista-ponto");
  const { data: regs } = await supa.from("registros")
      .select("id, valor, horas_extras, funcionarios(nome)")
      .eq("obra_id", obraAtualId)
      .eq("data", data)
      .order("created_at", {ascending:false});

  tbody.innerHTML = "";
  if(!regs || regs.length === 0) return tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:10px;'>Nenhum registro hoje.</td></tr>";
  
  regs.forEach(r => {
    const extrasTxt = r.horas_extras > 0 ? `<div style='font-size:10px; color:#d97706; font-weight:600;'>+ ${r.horas_extras}h extras</div>` : "";
    tbody.innerHTML += `
        <tr>
            <td>${r.funcionarios.nome.split(" ")[0]}</td>
            <td>
                ${(r.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                ${extrasTxt}
            </td>
            <td><button class="btn-danger btn-sm" onclick="excluirPonto('${r.id}')">X</button></td>
        </tr>`;
  });
}

window.excluirPonto = async (id) => { if(confirm("Apagar?")) { await supa.from("registros").delete().eq("id", id); carregarListaPonto(); carregarFuncionariosPonto(); }};

// === DIÁRIO DE OBRA ===
async function salvarDiario() {
  const data = document.getElementById("diario-data").value;
  const clima = document.getElementById("diario-clima").value;
  const resumo = document.getElementById("diario-resumo").value.trim();
  const fileInput = document.getElementById("diario-foto");
  const statusDiv = document.getElementById("upload-status");
  const btnSalvar = document.querySelector("#tab-diario button.btn-primary");

  if(!resumo) return aviso("Escreva o resumo.");

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
        statusDiv.textContent = `Enviando foto ${i+1}...`;
        try {
            const comp = await new Promise((res, rej) => { new Compressor(arq, { quality: 0.6, maxWidth: 1280, success(r){res(r)}, error(e){rej(e)} }); });
            const nome = `${Date.now()}_${i}_${arq.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            await supa.storage.from('diario-obras').upload(nome, comp);
            const { data: u } = supa.storage.from('diario-obras').getPublicUrl(nome);
            listaUrls.push(u.publicUrl);
        } catch (e) { console.error(e); }
    }
    fotosParaSalvar = JSON.stringify(listaUrls);
  } else if (editandoDiarioId) {
      fotosParaSalvar = undefined;
  }

  statusDiv.textContent = "Salvando...";
  const payload = { obra_id: obraAtualId, usuario_id: usuarioAtual.perfil.id, data, condicoes_climaticas: clima, resumo_atividades: resumo };
  if (fotosParaSalvar !== undefined) payload.link_fotos_drive = fotosParaSalvar;

  let error = null;
  if (editandoDiarioId) {
      const res = await supa.from("diario_obras").update(payload).eq("id", editandoDiarioId);
      error = res.error; if(!error) sucesso("Atualizado!");
  } else {
      const res = await supa.from("diario_obras").insert([payload]);
      error = res.error; if(!error) sucesso("Criado!");
  }
  statusDiv.style.display = "none";
  if(error) return erro("Erro ao salvar.");
  document.getElementById("diario-resumo").value = "";
  fileInput.value = "";
  editandoDiarioId = null;
  btnSalvar.textContent = "Salvar Diário";
  carregarListaDiario();
}

async function carregarListaDiario() {
    const div = document.getElementById("lista-diario"); div.innerHTML = "Carregando...";
    const { data } = await supa.from("diario_obras").select("*").eq("obra_id", obraAtualId).order("data", {ascending: false}).limit(5);
    div.innerHTML = "";
    if(!data || !data.length) return div.innerHTML = "Nada recente.";
    data.forEach(d => {
        let urls = []; try { urls = JSON.parse(d.link_fotos_drive || "[]"); if(!Array.isArray(urls)) urls=[d.link_fotos_drive]; } catch(e){}
        let imgHtml = urls.map(u => `<a href="${u}" target="_blank"><img src="${u}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;margin-right:4px;"></a>`).join("");
        div.innerHTML += `<div style="border-bottom:1px solid #eee;padding:10px 0;"><div style="display:flex; justify-content:space-between; align-items:center;"><b>${formatarDataBR(d.data)}</b><div style="display:flex; gap:5px;"><button class="btn-primary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="prepararEdicaoDiario('${d.id}')">Editar</button><button class="btn-danger btn-sm" style="padding:2px 8px; font-size:10px;" onclick="excluirDiario('${d.id}')">X</button></div></div><div style="font-size:12px; color:#64748b;">${d.condicoes_climaticas}</div><div>${d.resumo_atividades}</div>${imgHtml}</div>`;
    });
}
window.prepararEdicaoDiario = async (id) => { const { data } = await supa.from("diario_obras").select("*").eq("id", id).single(); if(!data) return erro("Erro."); document.getElementById("diario-data").value = data.data; document.getElementById("diario-clima").value = data.condicoes_climaticas; document.getElementById("diario-resumo").value = data.resumo_atividades; editandoDiarioId = data.id; document.querySelector("#tab-diario button.btn-primary").textContent = "Atualizar Diário"; window.scrollTo({top:0, behavior:'smooth'}); aviso("Editando diário."); };
window.excluirDiario = async (id) => { if(confirm("Excluir?")) { await supa.from("diario_obras").delete().eq("id", id); carregarListaDiario(); }};

// === GASTOS ===
async function lancarGasto() {
    const desc = document.getElementById("gasto-desc").value.trim(); const valorStr = document.getElementById("gasto-valor").value; const data = document.getElementById("gasto-data").value;
    if(!desc || !valorStr) return aviso("Preencha campos.");
    const valor = parseFloat(valorStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
    const { error } = await supa.from("caixa_obra").insert([{ obra_id: obraAtualId, usuario_id: usuarioAtual.perfil.id, descricao: desc, valor: valor, data: data }]);
    if(error) return erro("Erro."); sucesso("Lançado!"); document.getElementById("gasto-desc").value = ""; document.getElementById("gasto-valor").value = ""; carregarListaGastos();
}
async function carregarListaGastos() {
    const tbody = document.getElementById("lista-gastos"); const inicioMes = new Date().toISOString().slice(0, 8) + "01";
    const { data } = await supa.from("caixa_obra").select("*").eq("obra_id", obraAtualId).gte("data", inicioMes).order("data", {ascending: false});
    tbody.innerHTML = ""; if(!data || !data.length) return tbody.innerHTML = "<tr><td colspan='4'>Vazio este mês.</td></tr>";
    data.forEach(g => { const val = Number(g.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); tbody.innerHTML += `<tr><td>${g.data.split("-")[2]}</td><td style="font-size:12px;">${g.descricao}</td><td style="color:#ef4444; font-weight:bold; font-size:12px;">${val}</td><td><button style="color:red;border:none;background:none;" onclick="excluirGasto('${g.id}')">x</button></td></tr>`; });
}
window.excluirGasto = async (id) => { if(confirm("Excluir?")) { await supa.from("caixa_obra").delete().eq("id", id); carregarListaGastos(); }};

// === MATERIAIS (Com Previsão) ===
async function pedirMaterial() {
  const item = document.getElementById("mat-item").value; const qtd = document.getElementById("mat-qtd").value; const urg = document.getElementById("mat-urgencia").value; const obs = document.getElementById("mat-obs").value;
  if(!item) return aviso("Informe o item.");
  await supa.from("solicitacoes_materiais").insert([{obra_id:obraAtualId, usuario_id:usuarioAtual.perfil.id, item, quantidade:qtd, urgencia:urg, obs}]);
  sucesso("Pedido enviado."); carregarListaMateriais();
}

async function carregarListaMateriais() {
    const t = document.getElementById("lista-materiais");
    // Agora busca a coluna previsao_entrega
    const {data} = await supa.from("solicitacoes_materiais").select("item, quantidade, status, previsao_entrega").eq("obra_id",obraAtualId).order("created_at",{ascending:false}).limit(5);
    t.innerHTML = "";
    if(data) data.forEach(m => {
        let statusDisplay = m.status;
        
        // Exibe previsão no app
        if (m.previsao_entrega) {
            const dataFmt = formatarDataBR(m.previsao_entrega);
            if (m.status === 'Entregue') {
                statusDisplay += `<br><small style="color:#166534; font-weight:600;">Entregue: ${dataFmt}</small>`;
            } else {
                statusDisplay += `<br><small style="color:#0284c7; font-weight:600;">Chega: ${dataFmt}</small>`;
            }
        }
        
        t.innerHTML += `<tr><td><b>${m.item}</b><br><small>${m.quantidade}</small></td><td>${statusDisplay}</td></tr>`;
    });
}