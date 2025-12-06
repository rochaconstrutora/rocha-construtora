// relatorios.js — V15 (Corrigido)

const DADOS_EMPRESA = {
  nome: "ROCHA CONSTRUTORA LTDA",
  cnpj: "51.027.684/0001-56", 
  endereco: "Rua das Pedras, 12 - Centro, Malhada dos Bois/SE",
  contato: "rochaconstrutora23@gmail.com | (79) 99653-4829"
};

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
      const { data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome");
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
      <td><div style="font-weight:600; color:#0f172a;">${f.nome}</div><div style="font-size:11px; color:#64748b;">${f.funcao} • ${f.cpf}</div><div style="font-size:11px; color:#64748b;">${infoPag}</div></td>
      <td>${f.obra}</td>
      <td><div style="font-size:13px;">${f.qtd_diarias} <span style="color:#64748b; font-size:11px;">Completas</span></div><div style="font-size:13px;">${f.qtd_meia} <span style="color:#64748b; font-size:11px;">Meias</span></div>${extrasDisplay}</td>
      <td style="font-weight:bold; color:#1e88e5;">${f.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
    `;
    tbody.appendChild(tr);
  });

  if(totalEl) totalEl.textContent = totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  sucesso("Relatório gerado!");
}

// === NOVO: RELATÓRIO FINANCEIRO CONSOLIDADO ===
async function gerarRelatorioFinanceiroObra() {
    const obraId = document.getElementById("relatorio-obra").value;
    if(!obraId) return aviso("Selecione uma Obra específica para este relatório.");

    const btn = document.querySelector("button[onclick='gerarRelatorioFinanceiroObra()']");
    if(btn) btn.textContent = "Calculando...";

    const { data: obra } = await supa.from("obras").select("nome").eq("id", obraId).single();
    
    // Busca Mão de Obra (Tudo)
    const { data: registros } = await supa.from("registros").select("valor").eq("obra_id", obraId);
    
    // Busca Caixa (Tudo)
    const { data: caixa } = await supa.from("caixa_obra").select("valor").eq("obra_id", obraId);
    
    // Busca Materiais (Apenas contagem, pois não temos preço ainda)
    const { count: qtdMateriais } = await supa.from("solicitacoes_materiais").select("*", { count: 'exact', head: true }).eq("obra_id", obraId);

    const totalRH = (registros || []).reduce((acc, r) => acc + Number(r.valor), 0);
    const totalCaixa = (caixa || []).reduce((acc, c) => acc + Number(c.valor), 0);
    const totalGeral = totalRH + totalCaixa;

    const tbody = document.querySelector("#tabela-relatorio tbody");
    const thead = document.querySelector("#tabela-relatorio thead");
    const totalEl = document.getElementById("relatorio-total");

    // Ajusta cabeçalho da tabela dinamicamente
    thead.innerHTML = `<tr><th>Categoria de Custo</th><th>Detalhes</th><th>Valor Total</th></tr>`;
    tbody.innerHTML = `
        <tr>
            <td><strong>👷 Mão de Obra</strong></td>
            <td>Soma de todas as diárias e extras</td>
            <td style="color:#0f172a;">${totalRH.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        </tr>
        <tr>
            <td><strong>🧱 Gastos de Caixa</strong></td>
            <td>Compras locais, combustível, refeições</td>
            <td style="color:#d97706;">${totalCaixa.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        </tr>
        <tr>
            <td><strong>🚛 Materiais Solicitados</strong></td>
            <td>${qtdMateriais} pedidos (Custo não calculado - sem preço)</td>
            <td>R$ 0,00*</td>
        </tr>
    `;

    if(totalEl) totalEl.innerHTML = `CUSTO TOTAL: <span style="color:#b91c1c; font-size:24px;">${totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>`;
    
    sucesso(`Custo consolidado da obra: ${obra.nome}`);
    if(btn) btn.innerHTML = "💲 Custo Obra";
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

    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(`${DADOS_EMPRESA.nome}`, 44, 14);
    doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`CNPJ: ${DADOS_EMPRESA.cnpj}`, 44, 19);
    doc.text(`${DADOS_EMPRESA.endereco}`, 44, 24);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("FOLHA DE PAGAMENTO", 280, 14, {align:'right'});
    
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(11);
    doc.text(`OBRA: ${dados.nomeObra.toUpperCase()}`, 280, 20, {align:'right'});

    doc.setTextColor(100); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Período: ${dados.periodo}`, 280, 25, {align:'right'});

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
        `${f.nome}`.toUpperCase(),
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
      doc.setFont("helvetica", "normal"); doc.text(`${f.nome}`.toUpperCase(), 40, y + 38);
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
      doc.text(`${f.nome}`.toUpperCase(), 100, y + 129, { align: "center" });
      
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