// modulos_admin.js — V17 (Final + WhatsApp)

const EMPRESA_CONFIG = {
    nome: "ROCHA CONSTRUTORA LTDA",
    cnpj: "51.027.684/0001-56",
    endereco: "Rua das Pedras, 12 - Centro, Malhada dos Bois/SE",
    contato: "rochaconstrutora23@gmail.com | (79) 99653-4829"
};

let usuarioAdminAtual = null;

// --- FUNÇÕES LIGHTBOX (GALERIA) ---
function criarLightbox() {
    if (document.getElementById('lightbox-viewer')) return;
    const div = document.createElement('div');
    div.id = 'lightbox-viewer';
    div.className = 'lightbox-overlay';
    div.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close" onclick="fecharLightbox()">&times;</button>
            <img id="lightbox-img-tag" class="lightbox-img" src="">
            <div id="lightbox-caption" class="lightbox-caption"></div>
        </div>`;
    div.onclick = (e) => { if (e.target === div) fecharLightbox(); };
    document.body.appendChild(div);
}

window.abrirLightbox = (url, legenda) => {
    criarLightbox();
    const imgTag = document.getElementById('lightbox-img-tag');
    const capTag = document.getElementById('lightbox-caption');
    const viewer = document.getElementById('lightbox-viewer');
    
    if(imgTag) imgTag.src = url;
    if(capTag) capTag.textContent = legenda || "";
    if(viewer) viewer.style.display = 'flex';
};

window.fecharLightbox = () => {
    const el = document.getElementById('lightbox-viewer');
    if (el) el.style.display = 'none';
};

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", async () => {
  const user = await getUsuarioAtual();
  if (user) usuarioAdminAtual = user;

  const hoje = new Date().toISOString().slice(0, 7);

  // Inicializa Filtros de Ponto
  if (document.getElementById("sec-ponto")) {
      carregarObrasSelect("ponto-filtro-obra");
      carregarFuncionariosSelect("ponto-filtro-func");
      document.getElementById("ponto-filtro-mes").value = hoje;
      carregarPontosAdmin(); 
      const selObra = document.getElementById("ponto-filtro-obra");
      if(selObra) selObra.addEventListener("change", (e) => carregarFuncionariosSelect("ponto-filtro-func", e.target.value));
  }
  // Inicializa Diário
  if (document.getElementById("sec-diario")) {
      carregarObrasSelect("admin-diario-obra");
      const inputMes = document.getElementById("admin-diario-mes");
      if(inputMes) inputMes.value = hoje;
  }
  // Inicializa Caixa
  if (document.getElementById("sec-caixa")) {
      carregarObrasSelect("caixa-filtro-obra");
      carregarObrasSelect("caixa-admin-obra");
      document.getElementById("caixa-filtro-mes").value = hoje;
      carregarCaixaAdmin();
      const formCaixa = document.getElementById("form-caixa-admin");
      if(formCaixa) formCaixa.addEventListener("submit", salvarCaixaAdmin);
  }
  // Inicializa Materiais
  if (document.getElementById("sec-materiais")) carregarMateriaisAdmin('Pendente');
});

// --- HELPERS SELECT ---
async function carregarObrasSelect(idSelect) {
  const sel = document.getElementById(idSelect);
  if (!sel || sel.options.length > 1) return;
  const { data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome");
  sel.innerHTML = idSelect.includes("filtro") ? "<option value=''>Todas</option>" : "<option value=''>Selecione...</option>"; 
  if (data) data.forEach(o => {
    let opt = document.createElement("option");
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
  if (data) data.forEach(f => { let opt = document.createElement("option"); opt.value = f.id; opt.textContent = f.nome; sel.appendChild(opt); });
}

function processarDataDigitada(texto) {
    if (!texto) return null;
    const limpo = texto.replace(/\D/g, ""); 
    let dia, mes, ano;
    const anoAtual = new Date().getFullYear();
    if (limpo.length === 8) { dia = limpo.substr(0, 2); mes = limpo.substr(2, 2); ano = limpo.substr(4, 4); } 
    else if (limpo.length === 6) { dia = limpo.substr(0, 2); mes = limpo.substr(2, 2); ano = "20" + limpo.substr(4, 2); } 
    else if (limpo.length === 4) { dia = limpo.substr(0, 2); mes = limpo.substr(2, 2); ano = anoAtual; } 
    else if (texto.includes("-") && texto.length === 10) return texto; 
    else return null;
    if (parseInt(mes) > 12 || parseInt(dia) > 31) return null;
    return `${ano}-${mes}-${dia}`;
}

// --- MÓDULO MATERIAIS (COM WHATSAPP) ---
async function carregarMateriaisAdmin(statusFiltro = 'Pendente') {
  const tbody = document.getElementById("tabela-materiais");
  if (!tbody) return;
  
  // Atualiza abas (botões)
  document.querySelectorAll('#sec-materiais button').forEach(btn => {
      btn.className = 'btn-secondary';
      if(btn.textContent.includes(statusFiltro) || (statusFiltro==='Pendente' && btn.textContent.includes('Pendentes')) || (statusFiltro==='Entregue' && btn.textContent.includes('Entregues'))) btn.className = 'btn-primary';
  });
  
  tbody.innerHTML = "<tr><td colspan='7' style='text-align:center'>Buscando...</td></tr>";

  const { data, error } = await supa.from("solicitacoes_materiais")
    .select(`*, obras(nome), usuarios(nome)`)
    .eq("status", statusFiltro)
    .order("created_at", { ascending: false });
  
  if (error) return tbody.innerHTML = `<tr><td colspan='7'>Erro SQL: ${error.message}</td></tr>`;
  if (!data || !data.length) return tbody.innerHTML = `<tr><td colspan='7' style='text-align:center;'>Nenhum pedido ${statusFiltro}.</td></tr>`;
  
  tbody.innerHTML = "";

  // NOVO: BOTÃO WHATSAPP (Aparece apenas se tiver pendências)
  if (statusFiltro === 'Pendente' && data.length > 0) {
      let textoZap = "*LISTA DE COMPRAS - ROCHA CONSTRUTORA*\n\n";
      data.forEach(m => {
          textoZap += `• [${m.urgencia || 'Normal'}] ${m.item} (${m.quantidade}) - ${m.obras?.nome}\n`;
      });
      const linkZap = `https://wa.me/?text=${encodeURIComponent(textoZap)}`;
      
      tbody.innerHTML += `
        <tr>
            <td colspan="7" style="text-align:center; background:#f0fdf4; padding:10px;">
                <a href="${linkZap}" target="_blank" class="btn-primary" style="background:#25D366; color:white; text-decoration:none; display:inline-flex; align-items:center; gap:5px; padding:8px 16px; border-radius:6px; font-weight:bold;">
                    <span class="material-symbols-outlined">share</span> Enviar Lista no WhatsApp
                </a>
            </td>
        </tr>
      `;
  }
  
  data.forEach(m => {
    let btnAcao = "";
    if (m.status === 'Pendente') btnAcao = `<button class="btn-primary btn-sm" onclick="mudarStatusMaterial('${m.id}', 'Comprado')">Comprar</button>`;
    else if (m.status === 'Comprado') btnAcao = `<button class="btn-secondary btn-sm" onclick="receberMaterialAdmin('${m.id}')">Receber</button>`;
    else btnAcao = "<span style='color:green;font-weight:bold;font-size:12px;'>OK</span>";

    let btnData = "";
    if (m.status !== 'Entregue') {
        const dataAtualBR = m.previsao_entrega ? formatarDataBR(m.previsao_entrega) : "";
        btnData = `<button class="btn-ghost btn-sm" title="Definir Previsão" onclick="definirPrevisaoMaterial('${m.id}', '${dataAtualBR}')"><span class="material-symbols-outlined" style="font-size:18px;">calendar_month</span></button>`;
    }

    let previsaoDisplay = "";
    if (m.previsao_entrega) {
        const hoje = new Date().toISOString().split('T')[0];
        const cor = m.previsao_entrega < hoje && m.status !== 'Entregue' ? '#ef4444' : '#166534';
        const label = m.status === 'Entregue' ? 'Entregue:' : 'Previsão:';
        previsaoDisplay = `<br><small style="color:${cor}; font-weight:600;">${label} ${formatarDataBR(m.previsao_entrega)}</small>`;
    }

    tbody.innerHTML += `<tr><td>${new Date(m.created_at).toLocaleDateString('pt-BR')}</td><td><div style="font-weight:600;">${m.obras?.nome||"-"}</div><div style="font-size:11px;color:#64748b;">${m.usuarios?.nome?.split(" ")[0]||"-"}</div></td><td>${m.item}</td><td>${m.quantidade}</td><td>${m.urgencia==='Critica' ? '🚨' : m.urgencia}</td><td><span class="md-chip">${m.status}</span>${previsaoDisplay}</td><td style="display:flex; align-items:center; gap:5px;">${btnData}${btnAcao}</td></tr>`;
  });
}

window.mudarStatusMaterial = async (id, novoStatus) => { 
    if(!confirm(`Mudar status para ${novoStatus}?`)) return; 
    
    const payload = { status: novoStatus };
    if (novoStatus === 'Entregue') payload.previsao_entrega = new Date().toISOString().split('T')[0];

    const { error } = await supa.from("solicitacoes_materiais").update(payload).eq("id", id);
    if(error) return erro("Erro.");
    
    if(novoStatus === 'Comprado') {
        const desejaData = confirm("Deseja informar a previsão de entrega agora?");
        if(desejaData) { await definirPrevisaoMaterial(id, ''); return; }
    }
    carregarMateriaisAdmin(novoStatus === 'Comprado' ? 'Pendente' : 'Comprado');
}

window.receberMaterialAdmin = async (id) => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0'); const mes = String(hoje.getMonth() + 1).padStart(2, '0'); const ano = hoje.getFullYear();
    const hojeBR = `${dia}${mes}${ano}`;

    const entrada = prompt(`Informe a DATA REAL da entrega:\n(ex: ${hojeBR} ou deixe em branco para hoje)`, hojeBR);
    if (entrada !== null) {
        let dataISO = processarDataDigitada(entrada);
        if (!dataISO) dataISO = new Date().toISOString().split('T')[0];

        await supa.from("solicitacoes_materiais").update({ status: 'Entregue', previsao_entrega: dataISO }).eq("id", id);
        sucesso("Recebido!");
        carregarMateriaisAdmin('Comprado');
    }
}

window.definirPrevisaoMaterial = async (id, dataAtualBR) => {
    const entrada = prompt(`Informe a previsão:\n(ex: 05122025)`, dataAtualBR);
    if (entrada !== null) {
        const dataISO = processarDataDigitada(entrada);
        if (!dataISO && entrada.trim() !== "") return erro("Data inválida.");
        await supa.from("solicitacoes_materiais").update({ previsao_entrega: dataISO }).eq("id", id);
        sucesso("Data atualizada!");
        const txt = document.querySelector('#sec-materiais button.btn-primary').textContent;
        if(txt.includes('Pendente')) carregarMateriaisAdmin('Pendente');
        else if(txt.includes('Comprado')) carregarMateriaisAdmin('Comprado');
        else carregarMateriaisAdmin('Entregue');
    }
}

// --- MÓDULO PONTO ---
async function carregarPontosAdmin() {
    const mesAno = document.getElementById("ponto-filtro-mes").value; 
    const obraId = document.getElementById("ponto-filtro-obra").value; 
    const funcId = document.getElementById("ponto-filtro-func").value; 
    const tbody = document.getElementById("tabela-ponto-admin");
    
    if(!mesAno) return aviso("Selecione o mês."); 
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center'>Carregando...</td></tr>";
    
    const [ano, mes] = mesAno.split("-"); 
    const inicio = `${ano}-${mes}-01`; 
    const fim = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;
    
    let query = supa.from("registros").select(`id, data, tipo, valor, horas_extras, funcionarios(nome), obras(nome)`).gte("data", inicio).lte("data", fim).order("data", {ascending:false}); 
    if(obraId) query = query.eq("obra_id", obraId); 
    if(funcId) query = query.eq("funcionario_id", funcId);
    
    const { data, error } = await query; 
    if(error) return tbody.innerHTML = `<tr><td colspan='6'>Erro SQL</td></tr>`; 
    if(!data || !data.length) return tbody.innerHTML = "<tr><td colspan='6' style='text-align:center'>Vazio.</td></tr>";
    
    tbody.innerHTML = ""; 
    data.forEach(p => { 
        const valFmt = (p.valor || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); 
        const extraLabel = p.horas_extras > 0 ? `<br><small style="color:#d97706; font-weight:bold">+${p.horas_extras}h extras</small>` : ""; 
        tbody.innerHTML += `<tr><td>${formatarDataBR(p.data)}</td><td>${p.funcionarios?.nome || "-"}</td><td>${p.obras?.nome || "-"}</td><td>${p.tipo}</td><td>${valFmt} ${extraLabel}</td><td class="actions-cell"><button class="btn-primary btn-sm" onclick="editarPontoAdmin('${p.id}')">Editar</button><button class="btn-danger btn-sm" onclick="excluirPontoAdmin('${p.id}')">Excluir</button></td></tr>`; 
    });
}
window.editarPontoAdmin = async (id) => { const { data } = await supa.from("registros").select("*, funcionarios(nome)").eq("id", id).single(); if(!data) return erro("Erro."); document.getElementById("card-edit-ponto").style.display = "block"; document.getElementById("ponto-admin-id").value = data.id; document.getElementById("ponto-admin-nome").value = data.funcionarios?.nome; document.getElementById("ponto-admin-data").value = data.data; document.getElementById("ponto-admin-tipo").value = data.tipo; document.getElementById("ponto-admin-valor").value = (data.valor||0).toLocaleString('pt-BR', {minimumFractionDigits: 2}); document.getElementById("ponto-admin-valor").dispatchEvent(new Event('input')); document.getElementById("card-edit-ponto").scrollIntoView({behavior:'smooth'}); }
window.salvarEdicaoPontoAdmin = async () => { const id = document.getElementById("ponto-admin-id").value; const tipo = document.getElementById("ponto-admin-tipo").value; const valorStr = document.getElementById("ponto-admin-valor").value; const valor = parseFloat(valorStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()); const { error } = await supa.from("registros").update({ tipo, valor }).eq("id", id); if(error) return erro("Erro."); sucesso("Atualizado!"); document.getElementById("card-edit-ponto").style.display = "none"; carregarPontosAdmin(); }
window.cancelarEdicaoPonto = () => { document.getElementById("card-edit-ponto").style.display = "none"; }
window.excluirPontoAdmin = async (id) => { if(!confirm("Excluir?")) return; await supa.from("registros").delete().eq("id", id); sucesso("Excluído."); carregarPontosAdmin(); }

// --- MÓDULO DIÁRIO (Com Lightbox) ---
async function carregarDiariosAdmin() { 
    const obraId = document.getElementById("admin-diario-obra").value; 
    const mesAno = document.getElementById("admin-diario-mes").value; 
    const tbody = document.getElementById("tabela-diarios"); 
    
    if (!mesAno) return aviso("Selecione o mês/ano."); 
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Carregando...</td></tr>"; 
    
    const [ano, mes] = mesAno.split("-"); 
    const fim = new Date(ano, mes, 0).getDate(); 
    
    let query = supa.from("diario_obras").select(`*, obras(nome), usuarios(nome)`).gte("data", `${ano}-${mes}-01`).lte("data", `${ano}-${mes}-${fim}`).order("data", { ascending: false }); 
    if (obraId) query = query.eq("obra_id", obraId); 
    
    const { data, error } = await query; 
    if (error || !data) return tbody.innerHTML = "<tr><td colspan='5'>Nenhum registro.</td></tr>"; 
    
    tbody.innerHTML = ""; 
    data.forEach(d => { 
        let urls = []; 
        try { urls = JSON.parse(d.link_fotos_drive || "[]"); if(!Array.isArray(urls)) urls=[d.link_fotos_drive]; } catch (e) {} 
        
        let linkHtml = urls.length > 0 ? `<div style="display:flex; gap:5px; justify-content:center;">` + 
            urls.map((u, index) => `<img src="${u}" onclick="abrirLightbox('${u}', '${formatarDataBR(d.data)} - ${d.condicoes_climaticas}')" style="cursor:pointer; width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #e2e8f0; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">`).join("") + 
            `</div>` : "<span style='color:#cbd5e1'>-</span>"; 
            
        let acoesHtml = ""; 
        if (usuarioAdminAtual && usuarioAdminAtual.perfil.tipo === 'admin') acoesHtml = `<div class="actions-cell" style="justify-content:center; gap:5px;"><button class="btn-primary btn-sm" style="padding:2px 6px;" onclick="editarDiarioAdmin('${d.id}')">Editar</button><button class="btn-danger btn-sm" style="padding:2px 6px;" onclick="excluirDiarioAdmin('${d.id}')">Excluir</button></div>`; 
        
        tbody.innerHTML += `<tr><td>${formatarDataBR(d.data)}</td><td><div style="font-weight:600;">${d.obras?.nome||"-"}</div><div style="font-size:11px;color:#64748b;">${d.usuarios?.nome?.split(" ")[0]||"-"}</div></td><td>${d.condicoes_climaticas||"-"}</td><td style="font-size:13px;">${d.resumo_atividades||""}</td><td style="text-align:center;">${linkHtml}${acoesHtml}</td></tr>`; 
    }); 
}

window.editarDiarioAdmin = async (id) => { const { data } = await supa.from("diario_obras").select("*").eq("id", id).single(); if(!data) return erro("Erro."); document.getElementById("card-edit-diario").style.display = "block"; document.getElementById("diario-admin-id").value = data.id; document.getElementById("diario-admin-data").value = data.data; document.getElementById("diario-admin-clima").value = data.condicoes_climaticas; document.getElementById("diario-admin-resumo").value = data.resumo_atividades; document.getElementById("card-edit-diario").scrollIntoView({ behavior: 'smooth', block: 'center' }); }
window.salvarEdicaoDiarioAdmin = async () => { const id = document.getElementById("diario-admin-id").value; const clima = document.getElementById("diario-admin-clima").value; const resumo = document.getElementById("diario-admin-resumo").value; const { error } = await supa.from("diario_obras").update({ condicoes_climaticas: clima, resumo_atividades: resumo }).eq("id", id); if(error) return erro("Erro."); sucesso("Atualizado!"); window.cancelarEdicaoDiario(); carregarDiariosAdmin(); }
window.cancelarEdicaoDiario = () => { document.getElementById("card-edit-diario").style.display = "none"; document.getElementById("form-diario-admin").reset(); }
window.excluirDiarioAdmin = async (id) => { if(!confirm("Excluir?")) return; await supa.from("diario_obras").delete().eq("id", id); carregarDiariosAdmin(); }

// --- MÓDULO CAIXA ---
async function salvarCaixaAdmin(e) { e.preventDefault(); const id = document.getElementById("caixa-admin-id").value; const obraId = document.getElementById("caixa-admin-obra").value; const data = document.getElementById("caixa-admin-data").value; const desc = document.getElementById("caixa-admin-desc").value.trim(); const valorStr = document.getElementById("caixa-admin-valor").value; if(!obraId || !data || !desc || !valorStr) return aviso("Preencha campos."); const valor = parseFloat(valorStr.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()); const payload = { obra_id: obraId, usuario_id: usuarioAdminAtual?.perfil?.id, data, descricao: desc, valor }; let error; if(id) { const res = await supa.from("caixa_obra").update(payload).eq("id", id); error = res.error; } else { const res = await supa.from("caixa_obra").insert([payload]); error = res.error; } if(error) return erro("Erro: "+error.message); document.getElementById("form-caixa-admin").reset(); document.getElementById("caixa-admin-id").value = ""; carregarCaixaAdmin(); }
async function carregarCaixaAdmin() { const obraId = document.getElementById("caixa-filtro-obra").value; const mesAno = document.getElementById("caixa-filtro-mes").value; const tbody = document.getElementById("tabela-caixa"); const totalEl = document.getElementById("caixa-total-geral"); if(!mesAno) return; const [ano, mes] = mesAno.split("-"); const inicio = `${ano}-${mes}-01`; const fim = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`; let query = supa.from("caixa_obra").select("*, obras(nome), usuarios(nome)").gte("data", inicio).lte("data", fim).order("data", {ascending:false}); if(obraId) query = query.eq("obra_id", obraId); const { data } = await query; tbody.innerHTML = ""; if(!data || !data.length) { totalEl.textContent = "R$ 0,00"; tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Sem lançamentos.</td></tr>"; return; } let total = 0; data.forEach(c => { total += Number(c.valor); tbody.innerHTML += `<tr><td>${formatarDataBR(c.data)}</td><td><div style="font-weight:600">${c.obras?.nome||"-"}</div><div style="font-size:11px;color:#64748b;">${c.usuarios?.nome?.split(" ")[0]||"Sistema"}</div></td><td>${c.descricao}</td><td style="color:#ef4444;font-weight:bold;">${Number(c.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td class="actions-cell"><button class="btn-primary btn-sm" onclick="editarCaixaAdmin('${c.id}')">Editar</button><button class="btn-danger btn-sm" onclick="excluirCaixaAdmin('${c.id}')">Excluir</button></td></tr>`; }); totalEl.textContent = total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
window.editarCaixaAdmin = async (id) => { const { data } = await supa.from("caixa_obra").select("*").eq("id", id).single(); document.getElementById("caixa-admin-id").value = data.id; document.getElementById("caixa-admin-obra").value = data.obra_id; document.getElementById("caixa-admin-data").value = data.data; document.getElementById("caixa-admin-desc").value = data.descricao; document.getElementById("caixa-admin-valor").value = data.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2}); document.getElementById("caixa-admin-valor").dispatchEvent(new Event('input')); window.scrollTo({top:0, behavior:'smooth'}); }
window.excluirCaixaAdmin = async (id) => { if(!confirm("Excluir?")) return; await supa.from("caixa_obra").delete().eq("id", id); carregarCaixaAdmin(); }

// --- PDF DO DIÁRIO ---
async function getLocalLogo(path) { try { const r = await fetch(path); if(!r.ok)return null; const b=await r.blob(); return new Promise(res=>{const d=new FileReader();d.onloadend=()=>res(d.result);d.readAsDataURL(b);}); }catch(e){return null;} }
async function getResizedImageBase64(url) { try { const r=await fetch(url); const b=await r.blob(); const bmp=await createImageBitmap(b); const w=500; const s=w/bmp.width; const h=bmp.height*s; const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.drawImage(bmp,0,0,w,h); return c.toDataURL('image/jpeg',0.5); }catch(e){return null;} }

window.baixarDiarioPDF = async () => { 
    const btn = document.querySelector("button[onclick='baixarDiarioPDF()']"); 
    if(btn) btn.textContent = "Gerando..."; 
    const obraId = document.getElementById("admin-diario-obra").value; 
    const mesAno = document.getElementById("admin-diario-mes").value; 
    const [ano, mes] = mesAno.split("-"); 
    const fim = new Date(ano, mes, 0).getDate(); 
    
    let query = supa.from("diario_obras").select(`*, obras(nome), usuarios(nome)`).gte("data", `${ano}-${mes}-01`).lte("data", `${ano}-${mes}-${fim}`).order("data", { ascending: true }); 
    if (obraId) query = query.eq("obra_id", obraId); 
    
    const { data } = await query; 
    if(!data || data.length === 0) { 
        if(btn) btn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> PDF'; 
        return aviso("Nada para imprimir."); 
    }

    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    const logoBase64 = await getLocalLogo('assets/img/logo_preto.png'); 
    let y = 15; const margemEsq = 15; const larguraLinha = 180;

    const addHeader = () => { 
        if (logoBase64) { try { doc.addImage(logoBase64, 'PNG', margemEsq, 10, 25, 25); } catch(e) {} } 
        doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(14); 
        doc.text(EMPRESA_CONFIG.nome, 200, 18, {align: 'right'}); 
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100); 
        doc.text(`CNPJ: ${EMPRESA_CONFIG.cnpj}`, 200, 23, {align: 'right'}); 
        doc.text(EMPRESA_CONFIG.endereco, 200, 28, {align: 'right'}); 
        doc.text(EMPRESA_CONFIG.contato, 200, 33, {align: 'right'}); 
        doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(margemEsq, 40, 200, 40); 
        doc.setFontSize(16); doc.setTextColor(0); doc.setFont("helvetica", "bold"); 
        doc.text("DIÁRIO DE OBRA", 105, 52, {align: 'center'}); 
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
        doc.text(`Período de Referência: ${mes}/${ano}`, 105, 58, {align: 'center'}); 
        return 65; 
    };

    y = addHeader(); 
    for (const d of data) { 
        if(y > 240) { doc.addPage(); y = addHeader(); } 
        doc.setFillColor(241, 245, 249); doc.rect(margemEsq, y-6, larguraLinha, 8, 'F'); 
        doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); 
        doc.text(`${formatarDataBR(d.data)}  •  ${d.obras?.nome}  •  Clima: ${d.condicoes_climaticas}`, margemEsq + 2, y); 
        y += 8; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(50); 
        const linhasTexto = doc.splitTextToSize(d.resumo_atividades || "Sem relato.", larguraLinha); 
        doc.text(linhasTexto, margemEsq + 2, y); 
        y += (linhasTexto.length * 6) + 4; 
        
        let urls = []; 
        try { urls = JSON.parse(d.link_fotos_drive || "[]"); if(!Array.isArray(urls)) urls=[d.link_fotos_drive]; } catch (e) {} 
        
        if(urls.length > 0) { 
            let xFoto = margemEsq; let alturaFoto = 40; let larguraFoto = 40; 
            if (y + alturaFoto > 280) { doc.addPage(); y = addHeader(); } 
            doc.setFontSize(8); doc.setTextColor(150); 
            doc.text("Registros Fotográficos:", margemEsq, y); y += 4; 
            for (const url of urls) { 
                const imgData = await getResizedImageBase64(url); 
                if (imgData) { 
                    try { 
                        doc.addImage(imgData, 'JPEG', xFoto, y, larguraFoto, alturaFoto); 
                        doc.setDrawColor(200); doc.rect(xFoto, y, larguraFoto, alturaFoto); 
                        xFoto += larguraFoto + 5; 
                        if (xFoto > 180) { xFoto = margemEsq; y += alturaFoto + 5; } 
                    } catch(err) {} 
                } 
            } 
            if (xFoto > margemEsq) y += alturaFoto + 5; 
        } 
        y += 6; 
    }
    
    const totalPages = doc.internal.getNumberOfPages(); 
    for (let i = 1; i <= totalPages; i++) { 
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); 
        doc.text(`Página ${i} de ${totalPages} - Gerado pelo Sistema Rocha Construtora`, 105, 290, {align:'center'}); 
    } 
    doc.save(`Diario_Obra_${mes}_${ano}.pdf`); 
    if(btn) btn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> PDF'; 
    sucesso("PDF Gerado!");
}