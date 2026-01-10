// dashboard.js - V Final (Soma RH Corrigida)
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!document.getElementById("dash-resumo")) return;
    const usuario = await getUsuarioAtual();
    if (!usuario || !["admin", "financeiro"].includes(usuario.perfil.tipo)) return;

    // Data Local Correta (Ano-Mês-01)
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const primeiroDia = `${ano}-${mes}-01`;
    const proximoMes = new Date(ano, Number(mes), 1); // 1º dia do mês seguinte
    const proximoDia = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2,'0')}-01`;

    const [ 
        { data: obras }, 
        { count: totalFuncs }, 
        { data: regsRH }, // Pega dados completos para garantir soma
        { count: pendentes },
        { data: caixa }
    ] = await Promise.all([
      supa.from("obras").select("id, nome, ativo, data_inicio, percentual, data_fim"), 
      supa.from("funcionarios").select("*", { count: 'exact', head: true }),
      supa.from("registros").select("valor, obra_id").gte("data", primeiroDia).lt("data", proximoDia),
      supa.from("solicitacoes_materiais").select("*", { count: 'exact', head: true }).eq("status", "Pendente"),
      supa.from("caixa_obra").select("valor, obra_id").gte("data", primeiroDia).lt("data", proximoDia)
    ]);

    // SOMAS SEGURAS
    const totalCaixa = (caixa || []).reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const totalRH = (regsRH || []).reduce((acc, item) => acc + (Number(item.valor) || 0), 0);


    // CUSTO COMPLETO (RH + CAIXA)
    const totalCusto = totalRH + totalCaixa;
    const elCusto = document.getElementById("dash-custo");
    if (elCusto) elCusto.textContent = totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const elPeriodo = document.getElementById("dash-custo-periodo");
    if (elPeriodo) elPeriodo.textContent = `${mes}/${ano}`;

    // Totais por obra
    const rhPorObra = {};
    (regsRH || []).forEach(r => {
      const oid = r.obra_id;
      rhPorObra[oid] = (rhPorObra[oid] || 0) + (Number(r.valor) || 0);
    });

    const caixaPorObra = {};
    (caixa || []).forEach(c => {
      const oid = c.obra_id;
      caixaPorObra[oid] = (caixaPorObra[oid] || 0) + (Number(c.valor) || 0);
    });

    const obrasAtivas = (obras || []).filter(o => o.ativo);
    const custoRows = obrasAtivas.map(o => {
      const rh = rhPorObra[o.id] || 0;
      const cx = caixaPorObra[o.id] || 0;
      return { nome: o.nome, rh, caixa: cx, total: rh + cx };
    }).sort((a,b)=> b.total - a.total);

    // Tabela Custo por Obra
    const tbodyCusto = document.getElementById("dash-custo-por-obra");
    const totalGeralEl = document.getElementById("dash-custo-total-geral");
    if (tbodyCusto) {
      tbodyCusto.innerHTML = "";
      if (custoRows.length === 0) {
        tbodyCusto.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:10px; color:#94a3b8;'>Sem obras ativas.</td></tr>";
      } else {
        custoRows.forEach(r => {
          tbodyCusto.innerHTML += `<tr>
            <td style="font-weight:600;">${escapeHtml(r.nome)}</td>
            <td>${r.rh.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
            <td>${r.caixa.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
            <td style="font-weight:700;">${r.total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
          </tr>`;
        });
      }
    }
    if (totalGeralEl) totalGeralEl.textContent = custoRows.reduce((acc,r)=>acc+r.total,0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

    // Gráfico Custo por Obra
    const ctxCusto = document.getElementById("dashCustoPorObra");
    if (ctxCusto && typeof Chart !== "undefined") {
      const labels = custoRows.map(r => r.nome);
      const values = custoRows.map(r => Math.round(r.total));
      if (labels.length > 0) {
        new Chart(ctxCusto.getContext("2d"), {
          type: "bar",
          data: { labels, datasets: [{ label: "Custo (R$)", data: values, backgroundColor: "#0f172a", borderRadius: 4 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { callback: (v)=> `R$ ${Number(v).toLocaleString("pt-BR")}` } },
              x: { grid: { display: false } }
            }
          }
        });
      } else {
        ctxCusto.style.display = "none";
      }
    }

    const els = {
      obras: document.getElementById("dash-obras"), 
      funcs: document.getElementById("dash-funcionarios"),
      diarias: document.getElementById("dash-diarias"),
      valor: document.getElementById("dash-valor"),
      materiais: document.getElementById("dash-materiais"),
      caixa: document.getElementById("dash-caixa")
    };

    if(els.obras) els.obras.textContent = (obras||[]).filter(o=>o.ativo).length;
    if(els.funcs) els.funcs.textContent = totalFuncs || 0;
    if(els.diarias) els.diarias.textContent = (regsRH||[]).length;
    
    // Formatação Moeda
    if(els.valor) els.valor.textContent = totalRH.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    if(els.caixa) els.caixa.textContent = totalCaixa.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    if(els.materiais) { 
        els.materiais.textContent = pendentes||0; 
        els.materiais.style.color = (pendentes>0)?"#dc2626":"#10b981"; 
    }

    const nomeMes = now.toLocaleString('pt-BR', { month: 'long' });
    document.getElementById("dash-resumo").innerHTML = `Resumo de <strong>${nomeMes}/${ano}</strong>`;

    // GRÁFICO
    const ctx = document.getElementById("dashDiariasPorObra");
    if (ctx && typeof Chart !== "undefined" && obras && regsRH) {
      const dadosObra = {};
      regsRH.forEach(r => { if (r.obra_id) dadosObra[r.obra_id] = (dadosObra[r.obra_id] || 0) + 1; });
      const labels = []; const dataValues = [];
      obras.forEach(o => { if (dadosObra[o.id] > 0) { labels.push(o.nome); dataValues.push(dadosObra[o.id]); } });

      if (labels.length > 0) {
        if (window.chartDiarias instanceof Chart) window.chartDiarias.destroy();
        window.chartDiarias = new Chart(ctx, {
          type: "bar",
          data: { labels: labels, datasets: [{ label: "Presenças", data: dataValues, backgroundColor: "#1e88e5", borderRadius: 4 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
        });
      } else { ctx.style.display = "none"; ctx.parentElement.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100%;color:#94a3b8;'>Sem dados</div>"; }
    }

    // LISTA DE PROGRESSO
    const listaTempo = document.getElementById("lista-tempo-obras");
    if (listaTempo && obras) {
      const obrasAtivas = obras.filter(o => o.ativo);
      listaTempo.innerHTML = "";
      if (obrasAtivas.length === 0) listaTempo.innerHTML = "<tr><td colspan='5' style='text-align:center'>Nenhuma obra ativa.</td></tr>";
      else {
        obrasAtivas.forEach(o => {
          let inicio = "-", diasTexto = "Não iniciado", statusBadge = "<span class='md-chip' style='background:#f1f5f9; color:#64748b'>Aguardando</span>";
          const perc = o.percentual || 0;
          
          if (o.data_inicio) {
            inicio = formatarDataBR(o.data_inicio);
            const dataFim = o.data_fim ? new Date(o.data_fim) : null;
            const dataInicio = new Date(o.data_inicio + "T00:00:00");
            
            if(dataFim && perc < 100) {
                const totalDias = (dataFim - dataInicio) / (1000 * 60 * 60 * 24);
                const diasPassados = (now - dataInicio) / (1000 * 60 * 60 * 24);
                const percEsperado = (diasPassados / totalDias) * 100;
                
                if (now > dataFim) statusBadge = "<span class='md-chip' style='background:#fee2e2; color:#b91c1c'>Atrasado</span>";
                else if ((percEsperado - perc) > 10) statusBadge = "<span class='md-chip' style='background:#fff7ed; color:#c2410c'>Atenção</span>";
                else statusBadge = "<span class='md-chip' style='background:#e0f2fe; color:#0369a1'>No Prazo</span>";
                
                diasTexto = formatarDataBR(o.data_fim);
            } else if (perc >= 100) {
                statusBadge = "<span class='md-chip' style='background:#dcfce7; color:#166534'>Concluído</span>";
                diasTexto = "Finalizado";
            }
          }
          const barraHtml = `<div style="display:flex; align-items:center; gap:8px;"><div style="flex:1; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;"><div style="width:${perc}%; height:100%; background:${perc >= 100 ? '#10b981' : '#3b82f6'};"></div></div><span style="font-size:11px; font-weight:600; color:#334155;">${perc}%</span></div>`;
          listaTempo.innerHTML += `<tr><td style="font-weight:600">${escapeHtml(o.nome)}</td><td>${inicio}</td><td>${diasTexto}</td><td>${barraHtml}</td><td>${statusBadge}</td></tr>`;
        });
      }
    }
  } catch (e) { console.error(e); }
});