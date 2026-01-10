// relatorios.js — V1.1 (Anti-XSS + Obras Ativas Compat) — V15 (Corrigido)

const DADOS_EMPRESA = {
  nome: "ROCHA CONSTRUTORA LTDA",
  cnpj: "51.027.684/0001-56", 
  endereco: "Rua das Pedras, 12 - Centro, Malhada dos Bois/SE",
  contato: "rochaconstrutora23@gmail.com | (79) 99653-4829"
};


function formatarPagamentoCusto(item) {
  const forma = (item?.forma_pagamento || "").trim();
  const parcelas = Number(item?.parcelas || 0);
  if (!forma) return "";
  if (forma === "Cartão de Crédito" && parcelas > 0) return `${forma} (${parcelas}x)`;
  return forma;
}
document.addEventListener("DOMContentLoaded", () => {
  if(!document.getElementById("relatorio-tipo")) return;
  
  carregarObrasRelatorio();
  carregarFuncionariosRelatorio(""); 
  
  const selectObra = document.getElementById("relatorio-obra");
  if(selectObra) {
      selectObra.addEventListener("change", (e) => {
          const obraId = e.target.value;
          const selectFunc = document.getElementById("relatorio-funcionario");
          if(selectFunc) selectFunc.innerHTML = "<option value=''>Buscando...</option>";
          carregarFuncionariosRelatorio(obraId);
      });
  }

  const hoje = new Date();
  const selMes = document.getElementById("rel-mes");
  const selAno = document.getElementById("rel-ano-mensal");
  const selAnoAnual = document.getElementById("rel-ano");
  
  if(selMes) selMes.value = hoje.getMonth() + 1;
  if(selAno) selAno.value = hoje.getFullYear();
  if(selAnoAnual) selAnoAnual.value = hoje.getFullYear();
});

// --- CARREGAMENTOS ---
async function carregarObrasRelatorio() {
  const select = document.getElementById("relatorio-obra");
  if (!select) return;
  if(select.options.length <= 1) {
      select.innerHTML = "<option value=''>Todas as obras</option>";
      let { data, error } = await supa.from("obras").select("id, nome").eq("status", "ativa").order("nome");
  if (error) ({ data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome"));
      if(data) data.forEach(o => {
        let opt = document.createElement("option");
        opt.value = o.id; opt.textContent = o.nome; select.appendChild(opt);
      });
  }
}

async function carregarFuncionariosRelatorio(obraId = "") {
  const select = document.getElementById("relatorio-funcionario");
  if (!select) return;
  
  select.disabled = true;
  let query = supa.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
  if (obraId) query = query.eq("obra_id", obraId);

  const { data, error } = await query;
  select.innerHTML = "<option value=''>Todos os funcionários</option>";
  select.disabled = false;

  if (error) { console.error(error); return; }

  if(data) data.forEach(f => {
    let opt = document.createElement("option");
    opt.value = f.id; opt.textContent = f.nome; select.appendChild(opt);
  });
}

// --- BUSCA DE DADOS ---
async function buscarDadosRelatorio() {
  const selectObra = document.getElementById("relatorio-obra");
  const obraId = selectObra.value;
  const nomeObraSelecionada = selectObra.options[selectObra.selectedIndex].text;

  const funcId = document.getElementById("relatorio-funcionario").value;
  const tipo = document.getElementById("relatorio-tipo").value;

  let dataInicio, dataFim, textoPeriodo;

  if (tipo === "quinzena") {
    dataInicio = document.getElementById("rel-q-inicio").value;
    dataFim = document.getElementById("rel-q-fim").value;
    if(!dataInicio || !dataFim) { aviso("Selecione as datas."); return null; }
    textoPeriodo = `${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`;
  } 
  else if (tipo === "mensal") {
    const mes = document.getElementById("rel-mes").value;
    const ano = document.getElementById("rel-ano-mensal").value;
    if(!mes || !ano) { aviso("Selecione mês e ano."); return null; }
    const ultimoDia = new Date(ano, mes, 0).getDate();
    dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
    dataFim = `${ano}-${String(mes).padStart(2,'0')}-${ultimoDia}`;
    const meses = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    textoPeriodo = `${meses[parseInt(mes)]}/${ano}`;
  } 
  else if (tipo === "anual") {
    const ano = document.getElementById("rel-ano").value;
    if(!ano) { aviso("Digite o ano."); return null; }
    dataInicio = `${ano}-01-01`; dataFim = `${ano}-12-31`;
    textoPeriodo = `Ano ${ano}`;
  }

  let query = supa.from("registros")
    .select(`
        id, data, tipo, valor, horas_extras, 
        funcionarios (
            id, nome, cpf, pix, conta, 
            funcoes (nome, valor_hora, valor_diaria, valor_meia)
        ), 
        obras (nome)
    `)
    .gte("data", dataInicio).lte("data", dataFim).order("data");

  if (obraId) query = query.eq("obra_id", obraId);
  if (funcId) query = query.eq("funcionario_id", funcId);

  const { data, error } = await query;
  if (error) { erro("Erro SQL: " + error.message); return null; }
  if (!data || data.length === 0) { aviso("Nenhum registro encontrado."); return null; }

  const agrupado = {};
  data.forEach(r => {
    if (!r.funcionarios) return;
    const fId = r.funcionarios.id;
    if (!agrupado[fId]) {
      agrupado[fId] = {
        nome: r.funcionarios.nome || "Sem Nome",
        funcao: r.funcionarios.funcoes?.nome || "-",
        cpf: r.funcionarios.cpf || "-",
        pix: r.funcionarios.pix || "",
        conta: r.funcionarios.conta || "",
        obra: r.obras?.nome || "Várias",
        valor_hora: Number(r.funcionarios.funcoes?.valor_hora || 0),
        valor_diaria: Number(r.funcionarios.funcoes?.valor_diaria || 0),
        valor_meia: Number(r.funcionarios.funcoes?.valor_meia || 0),
        qtd_diarias: 0, qtd_meia: 0, qtd_extras: 0, total: 0
      };
    }
    if (r.tipo === "DIARIA") agrupado[fId].qtd_diarias++;
    if (r.tipo === "MEIA") agrupado[fId].qtd_meia++;
    if (r.horas_extras) agrupado[fId].qtd_extras += Number(r.horas_extras);
    agrupado[fId].total += Number(r.valor || 0);
  });

  return { 
      lista: Object.values(agrupado), 
      periodo: textoPeriodo,
      nomeObra: obraId ? nomeObraSelecionada : "Todas as Obras"
  };
}

// --- TELA ---
async function gerarRelatorioTela() {
  const btn = document.querySelector("button[onclick='gerarRelatorioTela()']");
  if(btn) btn.textContent = "Carregando...";
  const dados = await buscarDadosRelatorio();
  if(btn) btn.innerHTML = 'Visualizar';
  if (!dados) return;

  const tbody = document.querySelector("#tabela-relatorio tbody");
  const thead = document.querySelector("#tabela-relatorio thead");
  const totalEl = document.getElementById("relatorio-total");
  
  if(!tbody) return;

  // Garante cabeçalho padrão
  if(thead) thead.innerHTML = `<tr><th>Dados do Funcionário</th><th>Obra</th><th>Dias / Extras</th><th>Valor Líquido</th></tr>`;

  tbody.innerHTML = "";
  let totalGeral = 0;

  dados.lista.forEach(f => {
    totalGeral += f.total;
    let infoPag = f.pix ? formatarPixInteligente(f.pix) : (f.conta ? `Conta: ${f.conta}` : "-");
    const extrasDisplay = f.qtd_extras > 0 ? `<div style="font-size:11px; color:#d97706; font-weight:bold;">+ ${f.qtd_extras}h extras</div>` : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><div style="font-weight:600; color:#0f172a;">${escapeHtml(f.nome)}</div><div style="font-size:11px; color:#64748b;">${f.funcao} • ${f.cpf}</div><div style="font-size:11px; color:#64748b;">${escapeHtml(infoPag)}</div></td>
      <td>${escapeHtml(f.obra)}</td>
      <td><div style="font-size:13px;">${f.qtd_diarias} <span style="color:#64748b; font-size:11px;">Completas</span></div><div style="font-size:13px;">${f.qtd_meia} <span style="color:#64748b; font-size:11px;">Meias</span></div>${extrasDisplay}</td>
      <td style="font-weight:bold; color:#1e88e5;">${f.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
    `;
    tbody.appendChild(tr);
  });

  if(totalEl) totalEl.textContent = totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  sucesso("Relatório gerado!");
}

// === CUSTO COMPLETO DA OBRA (RH + DESPESAS) ===

// Retorna {inicio, fim, texto}
function obterPeriodoSelecionado() {
  const tipo = document.getElementById("relatorio-tipo")?.value || "mensal";

  if (tipo === "quinzena") {
    const inicio = document.getElementById("rel-q-inicio")?.value;
    const fim = document.getElementById("rel-q-fim")?.value;
    if (!inicio || !fim) return null;
    return { inicio, fim, texto: `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}` };
  }

  if (tipo === "anual") {
    const ano = Number(document.getElementById("rel-ano")?.value);
    if (!ano) return null;
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, texto: `Ano ${ano}` };
  }

  // mensal (padrão)
  const mes = Number(document.getElementById("rel-mes")?.value || (new Date().getMonth() + 1));
  const ano = Number(document.getElementById("rel-ano-mensal")?.value || new Date().getFullYear());
  if (!mes || !ano) return null;

  const mesStr = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${mesStr}-01`, fim: `${ano}-${mesStr}-${String(ultimoDia).padStart(2, "0")}`, texto: `${mesStr}/${ano}` };
}

async function buscarDadosCustoObra() {
  const obraId = document.getElementById("relatorio-obra")?.value;
  if (!obraId) {
    aviso("Selecione uma obra.");
    return null;
  }

  const periodo = obterPeriodoSelecionado();
  if (!periodo) {
    aviso("Selecione um período válido.");
    return null;
  }

  // Obra
  const { data: obra, error: errObra } = await supa.from("obras").select("nome").eq("id", obraId).single();
  if (errObra || !obra) {
    erro("Não foi possível carregar a obra.");
    return null;
  }

  // RH: soma de registros no período
  const { data: regs, error: errRegs } = await supa
    .from("registros")
    .select("valor, funcionario_id, funcionarios(nome)")
    .eq("obra_id", obraId)
    .gte("data", periodo.inicio)
    .lte("data", periodo.fim);

  if (errRegs) {
    console.error(errRegs);
    erro("Erro ao buscar RH: " + errRegs.message);
    return null;
  }

  const totalRH = (regs || []).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);

  // RH por funcionário
  const rhPorFuncionario = {};
  (regs || []).forEach((r) => {
    const nome = r.funcionarios?.nome || "—";
    rhPorFuncionario[nome] = (rhPorFuncionario[nome] || 0) + (Number(r.valor) || 0);
  });

  const rhLista = Object.entries(rhPorFuncionario)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  // DESPESAS: caixa_obra no período
  const { data: gastos, error: errGastos } = await supa
    .from("caixa_obra")
    .select("id, data, descricao, valor, categoria, fornecedor, documento, observacoes, forma_pagamento, parcelas")
    .eq("obra_id", obraId)
    .gte("data", periodo.inicio)
    .lte("data", periodo.fim)
    .order("data", { ascending: true });

  if (errGastos) {
    console.error(errGastos);
    erro("Erro ao buscar despesas: " + errGastos.message);
    return null;
  }


  // Se o relatório foi chamado a partir do Caixa, podemos aplicar um filtro de categoria (opcional)
  const filtroCategoria = (window.__custoFiltroCategoria || "").trim();
  const gastosFiltrados = filtroCategoria
    ? (gastos || []).filter((g) => String(g.categoria || "").trim() === filtroCategoria)
    : (gastos || []);

  const totalGastos = (gastosFiltrados || []).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

  // Gastos por categoria
  const catMap = {};
  (gastosFiltrados || []).forEach((g) => {
    const cat = g.categoria || "Sem categoria";
    catMap[cat] = (catMap[cat] || 0) + (Number(g.valor) || 0);
  });

  const catLista = Object.entries(catMap)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    obraId,
    obraNome: obra.nome,
    periodoTexto: periodo.texto,
    inicio: periodo.inicio,
    fim: periodo.fim,
    totalRH,
    totalGastos,
    totalGeral: totalRH + totalGastos,
    catLista,
    gastos: gastosFiltrados || [],
    rhLista
  };
}

async function gerarRelatorioFinanceiroObra() {
  const tabela = document.getElementById("tabela-relatorio");
  const totalEl = document.getElementById("relatorio-total");
  if (!tabela || !totalEl) return;

  const dados = await buscarDadosCustoObra();
  if (!dados) return;

  // Monta tabela na tela (Resumo por Categoria + Total)
  const thead = tabela.querySelector("thead");
  const tbody = tabela.querySelector("tbody");
  if (thead) thead.innerHTML = `<tr><th>Categoria</th><th>Total</th></tr>`;
  if (tbody) tbody.innerHTML = "";

  // Linhas de categorias
  if (!dados.catLista.length) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">Sem despesas no período</td></tr>`;
  } else {
    dados.catLista.forEach((c) => {
      tbody.innerHTML += `<tr>
        <td style="font-weight:600">${escapeHtml(c.categoria)}</td>
        <td style="text-align:right; color:#ef4444; font-weight:700">${Number(c.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      </tr>`;
    });
  }

  // Rodapé com totais
  totalEl.textContent = `${dados.totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} (RH: ${dados.totalRH.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} | Despesas: ${dados.totalGastos.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})`;

  sucesso(`Custo completo: ${dados.obraNome} — ${dados.periodoTexto}`);
}

// PDF do custo completo (igual estilo dos outros relatórios)
async function baixarCustoObraPDF() {
  try {
    const dados = await buscarDadosCustoObra();
    if (!dados) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait" });
    const logoImg = await getLogoBase64();

    // Cabeçalho
    doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 35, 'F');
    if (logoImg) { try { doc.addImage(logoImg, 'PNG', 14, 6, 20, 20); } catch(e) {} }

    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold");
    // Evita sobreposição com o título quando o nome da empresa é grande
    const nomeLines = doc.splitTextToSize(String(DADOS_EMPRESA.nome || ""), 92);
    doc.setFontSize(12);
    doc.text(nomeLines, 38, 12);
    const yNomeFim = 12 + (nomeLines.length - 1) * 5;
    doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`CNPJ: ${DADOS_EMPRESA.cnpj}`, 38, yNomeFim + 6);
    doc.text(`${DADOS_EMPRESA.endereco}`, 38, yNomeFim + 10);
doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("RELATÓRIO — CUSTO COMPLETO DA OBRA", 196, 12, {align:'right'});

    doc.setTextColor(37, 99, 235); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`OBRA: ${dados.obraNome.toUpperCase()}`, 196, 18, {align:'right'});

    doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Período: ${dados.periodoTexto}`, 196, 23, {align:'right'});

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(14, 36, 196, 36);

    // Resumo (cards)
    const y0 = 42;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y0, 182, 18, 2, 2, "F");
    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`RH: ${dados.totalRH.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`, 18, y0 + 7);
    doc.text(`Despesas: ${dados.totalGastos.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`, 18, y0 + 13);
    doc.setTextColor(17, 24, 39);
    doc.text(`TOTAL: ${dados.totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`, 196, y0 + 11, {align:'right'});

    // Tabela por categoria
    const catBody = (dados.catLista || []).map(c => [
      String(c.categoria || "—"),
      Number(c.total || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
    ]);

    doc.autoTable({
      startY: y0 + 24,
      head: [['Categoria', 'Total']],
      body: catBody.length ? catBody : [['Sem despesas no período', '-']],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    // Despesas detalhadas (limita p/ não estourar)
    const maxLinhas = 160;
    const detalhes = (dados.gastos || []).slice(0, maxLinhas).map(g => [
      formatarDataBR(g.data),
      String(g.categoria || "—"),
      String(g.fornecedor || "—"),
      String(formatarPagamentoCusto(g) || "—"),
      String(g.descricao || "—"),
      Number(g.valor || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
    ]);

    doc.addPage();
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("DESPESAS DETALHADAS", 14, 16);

    doc.autoTable({
      startY: 22,
      head: [['Data', 'Categoria', 'Fornecedor/Loja', 'Pagamento', 'Descrição', 'Valor']],
      body: detalhes.length ? detalhes : [['-', '-', '-', '-', 'Sem despesas', '-']],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2, overflow: 'ellipsize' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 34 },
        3: { cellWidth: 32, overflow: 'linebreak' },
        4: { cellWidth: 52 },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      }
    });

    // RH por funcionário (top 100)
    doc.addPage();
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("RH POR FUNCIONÁRIO (TOTAL NO PERÍODO)", 14, 16);

    const rhBody = (dados.rhLista || []).slice(0, 120).map(r => [
      String(r.nome || "—"),
      Number(r.total || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
    ]);

    doc.autoTable({
      startY: 22,
      head: [['Funcionário', 'Total']],
      body: rhBody.length ? rhBody : [['-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, overflow: 'ellipsize' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 196, 290, {align:'right'});

    doc.save(`Custo_Obra_${dados.obraNome.replace(/[^a-zA-Z0-9]/g,'_')}_${dados.periodoTexto.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    sucesso("PDF de custo baixado!");
  } catch (e) {
    console.error(e);
    erro("Erro PDF Custo: " + e.message);
  }
}

async function baixarCustoObraExcel() {
  try {
    const dados = await buscarDadosCustoObra();
    if (!dados) return;

    const wb = XLSX.utils.book_new();

    // Resumo
    const resumo = [
      { "Obra": dados.obraNome, "Período": dados.periodoTexto, "RH": dados.totalRH, "Despesas": dados.totalGastos, "Total": dados.totalGeral }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

    // Categorias
    const categorias = (dados.catLista || []).map(c => ({ "Categoria": c.categoria, "Total": c.total }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categorias), "Categorias");

    // Despesas
    const despesas = (dados.gastos || []).map(g => ({
      "Data": g.data,
      "Categoria": g.categoria || "",
      "Descrição": g.descricao || "",
      "Fornecedor/Loja": g.fornecedor || "",
      "Forma de Pagamento": formatarPagamentoCusto(g) || "",
      "Parcelas": g.parcelas || "",
      "Documento": g.documento || "",
      "Observações": g.observacoes || "",
      "Valor": Number(g.valor) || 0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesas), "Despesas");

    // RH por funcionário
    const rh = (dados.rhLista || []).map(r => ({ "Funcionário": r.nome, "Total": r.total }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rh), "RH");

    XLSX.writeFile(wb, `Custo_Obra_${dados.obraNome.replace(/[^a-zA-Z0-9]/g,'_')}_${dados.periodoTexto.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`);
    sucesso("Excel de custo gerado!");
  } catch (e) {
    console.error(e);
    erro("Erro Excel Custo: " + e.message);
  }
}

async function getLogoBase64() {
  try {
    const response = await fetch('assets/img/logo_preto.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) { return null; }
}

// --- PDF: FOLHA HORIZONTAL ---
async function baixarFolhaPDF() {
  try {
    const dados = await buscarDadosRelatorio();
    if (!dados) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" }); 
    const logoImg = await getLogoBase64(); 

    // --- CABEÇALHO ---
    doc.setFillColor(255, 255, 255); doc.rect(0, 0, 297, 40, 'F');
    if (logoImg) { try { doc.addImage(logoImg, 'PNG', 14, 6, 24, 24); } catch(e) {} }

    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold");
    const nomeLines2 = doc.splitTextToSize(String(DADOS_EMPRESA.nome || ""), 130);
    doc.setFontSize(14);
    doc.text(nomeLines2, 44, 13);
    const yNome2Fim = 13 + (nomeLines2.length - 1) * 6;
    doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`CNPJ: ${DADOS_EMPRESA.cnpj}`, 44, yNome2Fim + 7);
    doc.text(`${DADOS_EMPRESA.endereco}`, 44, yNome2Fim + 12);
doc.setTextColor(30, 41, 59);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("FOLHA DE PAGAMENTO", 280, 13, {align:'right'});
    
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(11);
    doc.text(`OBRA: ${dados.nomeObra.toUpperCase()}`, 280, 19, {align:'right'});

    doc.setTextColor(100); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Período: ${dados.periodo}`, 280, 24, {align:'right'});

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(14, 35, 283, 35);

    // --- DADOS TABELA ---
    const corpo = dados.lista.map(f => {
      let pag = "-";
      if (f.pix) pag = `PIX: ${f.pix}`;
      else if (f.conta) pag = `Conta: ${f.conta}`;
      else pag = `CPF: ${f.cpf || '-'}`;

      let qtdDetalhes = `${(f.qtd_diarias + (f.qtd_meia * 0.5)).toFixed(1)}d`;
      if(f.qtd_extras > 0) qtdDetalhes += ` +${f.qtd_extras}h`;

      return [
        `${escapeHtml(f.nome)}`.toUpperCase(),
        `${f.funcao || '-'}`,
        `${f.cpf || '-'}`, 
        pag, 
        qtdDetalhes,
        f.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
        "" 
      ];
    });

    doc.autoTable({
      startY: 40,
      head: [['Funcionário', 'Cargo', 'CPF', 'Dados Pagamento', 'Dias', 'Líquido', 'Assinatura']],
      body: corpo,
      theme: 'striped',
      headStyles: { 
          fillColor: [30, 41, 59], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 3
      },
      styles: { 
          fontSize: 8, 
          cellPadding: 3, 
          valign: 'middle',
          textColor: [50, 50, 50],
          overflow: 'ellipsize' 
      },
      // === AJUSTE DE LARGURAS (V24) ===
      columnStyles: { 
          0: { cellWidth: 55, fontStyle: 'bold' }, // Nome
          1: { cellWidth: 25 }, // Cargo
          2: { cellWidth: 33, halign: 'center' }, // CPF (AUMENTADO para 33mm)
          3: { cellWidth: 50, fontSize: 7 }, // Pagamento
          4: { cellWidth: 25, halign: 'center' }, // Dias
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 25, textColor: [30, 41, 59] }, // Líquido
          6: { cellWidth: 'auto' } // Assinatura
      },
      didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 6) {
             data.cell.text = ["_____________________________"];
             data.cell.styles.valign = 'bottom';
             data.cell.styles.halign = 'center';
             data.cell.styles.textColor = [200, 200, 200];
          }
          if (data.section === 'head' && data.column.index === 5) {
              data.cell.styles.halign = 'right';
          }
      }
    });

    // Rodapé
    const totalGeral = dados.lista.reduce((acc, c) => acc + c.total, 0);
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, finalY - 6, 120, 14, 2, 2, 'F');

    doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL:`, 18, finalY + 4);
    
    doc.setTextColor(37, 99, 235);
    doc.text(totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), 125, finalY + 4, {align: 'right'});
    
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 283, 200, {align: 'right'});

    doc.save(`Folha_${dados.periodo.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    sucesso("Folha baixada!");
  } catch (e) { erro("Erro PDF: " + e.message); console.error(e); }
}

async function baixarContracheques() {
  try {
    const dados = await buscarDadosRelatorio();
    if (!dados) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const logoImg = await getLogoBase64();
    let y = 10; let contador = 0;

    for (const f of dados.lista) {
      if (contador > 0 && contador % 2 === 0) { doc.addPage(); y = 10; }
      
      let pagInfo = f.pix ? formatarPixInteligente(f.pix) : (f.conta ? `Conta: ${f.conta}` : "Não informado");

      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.roundedRect(10, y, 190, 135, 3, 3);
      doc.setFillColor(255, 255, 255); doc.rect(10.5, y + 0.5, 189, 28, 'F');
      if (logoImg) { try { doc.addImage(logoImg, 'PNG', 15, y + 5, 18, 18); } catch(e) {} }

      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(`${DADOS_EMPRESA.nome}`, 40, y + 10);
      doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`CNPJ: ${DADOS_EMPRESA.cnpj}`, 40, y + 15);
      doc.text(`${DADOS_EMPRESA.contato}`, 40, y + 20);

      doc.setTextColor(15, 23, 42); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGAMENTO", 190, y + 10, { align: 'right' });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`${dados.periodo}`, 190, y + 16, { align: 'right' });

      doc.setFillColor(248, 250, 252); doc.rect(11, y + 32, 188, 16, 'F');
      doc.setFont("helvetica", "bold"); doc.text("Funcionário:", 15, y + 38);
      doc.setFont("helvetica", "normal"); doc.text(`${escapeHtml(f.nome)}`.toUpperCase(), 40, y + 38);
      doc.setFont("helvetica", "bold"); doc.text("Cargo:", 15, y + 44);
      doc.setFont("helvetica", "normal"); doc.text(`${f.funcao || '-'}`, 40, y + 44);
      doc.setFont("helvetica", "bold"); doc.text("CPF:", 120, y + 38);
      doc.setFont("helvetica", "normal"); doc.text(`${f.cpf || '-'}`, 135, y + 38);

      doc.setFillColor(30, 41, 59); doc.rect(10, y + 52, 190, 8, 'F');
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("DESCRIÇÃO", 15, y + 57); doc.text("QTD", 140, y + 57, {align:'center'}); doc.text("VALOR (R$)", 190, y + 57, {align:'right'});

      doc.setTextColor(50); doc.setFont("helvetica", "normal");
      let ly = y + 66;
      
      if (f.qtd_diarias > 0) {
          doc.text("Diárias Completas", 15, ly);
          doc.text(`${f.qtd_diarias}`, 140, ly, {align:'center'});
          const val = f.qtd_diarias * f.valor_diaria;
          doc.text(val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), 190, ly, {align:'right'});
          ly += 6;
      }
      if (f.qtd_meia > 0) {
          doc.text("Meia Diárias (50%)", 15, ly);
          doc.text(`${f.qtd_meia}`, 140, ly, {align:'center'});
          const val = f.qtd_meia * f.valor_meia;
          doc.text(val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), 190, ly, {align:'right'});
          ly += 6;
      }
      if (f.qtd_extras > 0) {
          doc.text("Horas Extras", 15, ly);
          doc.text(`${f.qtd_extras}h`, 140, ly, {align:'center'});
          const val = f.qtd_extras * f.valor_hora;
          doc.text(val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), 190, ly, {align:'right'});
          ly += 6;
      }

      doc.setFillColor(226, 232, 240); doc.rect(120, y + 90, 80, 10, 'F');
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("TOTAL LÍQUIDO", 125, y + 96);
      doc.text(f.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), 195, y + 96, { align: 'right' });

      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text("Declaro ter recebido a importância líquida acima.", 15, y + 110);
      doc.setDrawColor(0); doc.line(50, y + 125, 150, y + 125);
      doc.text(`${escapeHtml(f.nome)}`.toUpperCase(), 100, y + 129, { align: "center" });
      
      y += 145; contador++;
    }
    doc.save(`Recibos_${dados.periodo.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    sucesso("Recibos baixados!");
  } catch (e) { erro("Erro Recibos: " + e.message); }
}

async function baixarFolhaExcel() {
  try {
    const dados = await buscarDadosRelatorio();
    if (!dados) return;
    const linhas = dados.lista.map(f => ({
      "Funcionário": f.nome, "Cargo": f.funcao, "CPF": f.cpf,
      "Pagamento": f.pix ? f.pix : f.conta, 
      "Dias Trabalhados": f.qtd_diarias + (f.qtd_meia * 0.5),
      "Horas Extras": f.qtd_extras,
      "Valor Total": f.total
    }));
    const total = dados.lista.reduce((acc,c) => acc + c.total, 0);
    linhas.push({ "Funcionário": "TOTAL GERAL", "Valor Total": total });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(linhas);
    XLSX.utils.book_append_sheet(wb, ws, "Folha");
    XLSX.writeFile(wb, `Folha_${dados.periodo}.xlsx`);
  } catch(e) { erro("Erro no Excel: " + e.message); }
}