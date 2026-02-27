// dashboard.js - V17 (Corrigido: sem var duplicada + 5 stats + badge materiais)

document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!document.getElementById("dash-resumo")) return;
    const usuario = await getUsuarioAtual();
    if (!usuario || !["admin", "financeiro"].includes(usuario.perfil.tipo)) return;

    // Atualiza badge de materiais pendentes no menu
    if (typeof atualizarBadgeMateriais === "function") atualizarBadgeMateriais();

    // Período atual
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const primeiroDia = `${ano}-${mes}-01`;
    const proximoMes = new Date(ano, Number(mes), 1);
    const proximoDia = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, "0")}-01`;

    const [
      { data: obras },
      { count: totalFuncs },
      { data: regsRH },
      { count: pendentes },
      { data: caixa }
    ] = await Promise.all([
      supa.from("obras").select("id, nome, ativo, data_inicio, percentual, data_fim"),
      supa.from("funcionarios").select("*", { count: "exact", head: true }),
      supa.from("registros").select("valor, obra_id").gte("data", primeiroDia).lt("data", proximoDia),
      supa.from("solicitacoes_materiais").select("*", { count: "exact", head: true }).eq("status", "Pendente"),
      supa.from("caixa_obra").select("valor, obra_id").gte("data", primeiroDia).lt("data", proximoDia)
    ]);

    // Somas seguras
    const totalCaixa = (caixa || []).reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const totalRH    = (regsRH || []).reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const totalCusto = totalRH + totalCaixa;

    // Atualiza cards do topo
    const els = {
      obras:       document.getElementById("dash-obras"),
      funcs:       document.getElementById("dash-funcionarios"),
      diarias:     document.getElementById("dash-diarias"),
      valor:       document.getElementById("dash-valor"),
      materiais:   document.getElementById("dash-materiais"),
      caixa:       document.getElementById("dash-caixa"),
      custo:       document.getElementById("dash-custo"),
      custoPeriodo:document.getElementById("dash-custo-periodo"),
    };

    const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    if (els.obras)     els.obras.textContent     = (obras || []).filter(o => o.ativo).length;
    if (els.funcs)     els.funcs.textContent     = totalFuncs || 0;
    if (els.diarias)   els.diarias.textContent   = (regsRH || []).length;
    if (els.valor)     els.valor.textContent     = fmt(totalRH);
    if (els.caixa)     els.caixa.textContent     = fmt(totalCaixa);
    if (els.custo)     els.custo.textContent     = fmt(totalCusto);
    if (els.custoPeriodo) els.custoPeriodo.textContent = `${mes}/${ano}`;

    if (els.materiais) {
      els.materiais.textContent = pendentes || 0;
      els.materiais.style.color = (pendentes > 0) ? "#dc2626" : "#10b981";
    }

    const nomeMes = now.toLocaleString("pt-BR", { month: "long" });
    const resumoEl = document.getElementById("dash-resumo");
    if (resumoEl) resumoEl.innerHTML = `Resumo de <strong>${nomeMes}/${ano}</strong>`;

    // ─── CUSTO POR OBRA ────────────────────────────────────────
    const rhPorObra    = {};
    const caixaPorObra = {};
    (regsRH || []).forEach(r => { rhPorObra[r.obra_id]    = (rhPorObra[r.obra_id]    || 0) + (Number(r.valor) || 0); });
    (caixa  || []).forEach(c => { caixaPorObra[c.obra_id] = (caixaPorObra[c.obra_id] || 0) + (Number(c.valor) || 0); });

    const obrasAtivas = (obras || []).filter(o => o.ativo);
    const custoRows = obrasAtivas
      .map(o => ({ nome: o.nome, rh: rhPorObra[o.id] || 0, caixa: caixaPorObra[o.id] || 0, total: (rhPorObra[o.id] || 0) + (caixaPorObra[o.id] || 0) }))
      .sort((a, b) => b.total - a.total);

    const tbodyCusto  = document.getElementById("dash-custo-por-obra");
    const totalGeralEl = document.getElementById("dash-custo-total-geral");

    if (tbodyCusto) {
      tbodyCusto.innerHTML = "";
      if (custoRows.length === 0) {
        tbodyCusto.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:16px;color:#94a3b8;'>Sem obras ativas.</td></tr>";
      } else {
        custoRows.forEach(r => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="font-weight:600;">${escapeHtml(r.nome)}</td>
            <td>${fmt(r.rh)}</td>
            <td>${fmt(r.caixa)}</td>
            <td style="font-weight:700;">${fmt(r.total)}</td>`;
          tbodyCusto.appendChild(tr);
        });
      }
    }
    if (totalGeralEl) totalGeralEl.textContent = fmt(custoRows.reduce((a, r) => a + r.total, 0));

    // ─── GRÁFICO CUSTO POR OBRA ────────────────────────────────
    const ctxCusto = document.getElementById("dashCustoPorObra");
    if (ctxCusto && typeof Chart !== "undefined" && custoRows.length > 0) {
      new Chart(ctxCusto.getContext("2d"), {
        type: "bar",
        data: {
          labels: custoRows.map(r => r.nome),
          datasets: [
            { label: "RH",       data: custoRows.map(r => Math.round(r.rh)),    backgroundColor: "#1e88e5", borderRadius: 4, stack: "s" },
            { label: "Despesas", data: custoRows.map(r => Math.round(r.caixa)), backgroundColor: "#f59e0b", borderRadius: 4, stack: "s" }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, position: "top" } },
          scales: {
            y: { beginAtZero: true, stacked: true, ticks: { callback: v => `R$ ${Number(v).toLocaleString("pt-BR")}` } },
            x: { stacked: true, grid: { display: false } }
          }
        }
      });
    } else if (ctxCusto) {
      ctxCusto.parentElement.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100%;color:#94a3b8;font-size:13px;'>Sem dados no período</div>";
    }

    // ─── GRÁFICO DIÁRIAS POR OBRA ─────────────────────────────
    const ctx = document.getElementById("dashDiariasPorObra");
    if (ctx && typeof Chart !== "undefined" && obras && regsRH) {
      const dadosObra = {};
      regsRH.forEach(r => { if (r.obra_id) dadosObra[r.obra_id] = (dadosObra[r.obra_id] || 0) + 1; });

      const labels = [], dataValues = [];
      obras.forEach(o => {
        if (dadosObra[o.id] > 0) { labels.push(o.nome); dataValues.push(dadosObra[o.id]); }
      });

      if (labels.length > 0) {
        if (window.chartDiarias instanceof Chart) window.chartDiarias.destroy();
        window.chartDiarias = new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [{ label: "Presenças", data: dataValues, backgroundColor: "#1e88e5", borderRadius: 4 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } },
              x: { grid: { display: false } }
            }
          }
        });
      } else {
        ctx.parentElement.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100%;color:#94a3b8;font-size:13px;'>Sem presenças no mês</div>";
      }
    }

    // ─── INTELIGÊNCIA DE PRAZOS ────────────────────────────────
    const listaTempo = document.getElementById("lista-tempo-obras");
    if (listaTempo && obras) {
      listaTempo.innerHTML = "";
      if (obrasAtivas.length === 0) {
        listaTempo.innerHTML = "<tr><td colspan='5' style='text-align:center;padding:16px;color:#94a3b8;'>Nenhuma obra ativa.</td></tr>";
      } else {
        obrasAtivas.forEach(o => {
          let inicio = "-", diasTexto = "Não iniciado";
          let statusBadge = "<span class='md-chip' style='background:#f1f5f9;color:#64748b'>Aguardando</span>";
          const perc = o.percentual || 0;

          if (o.data_inicio) {
            inicio = formatarDataBR(o.data_inicio);
            const dataFim   = o.data_fim  ? new Date(o.data_fim  + "T00:00:00") : null;
            const dataIni   = new Date(o.data_inicio + "T00:00:00");

            if (dataFim && perc < 100) {
              const totalDias    = (dataFim - dataIni) / (1000 * 60 * 60 * 24);
              const diasPassados = (now - dataIni)     / (1000 * 60 * 60 * 24);
              const percEsperado = (diasPassados / totalDias) * 100;

              if (now > dataFim)               statusBadge = "<span class='md-chip' style='background:#fee2e2;color:#b91c1c'>⚠ Atrasado</span>";
              else if ((percEsperado - perc) > 10) statusBadge = "<span class='md-chip' style='background:#fff7ed;color:#c2410c'>Atenção</span>";
              else                              statusBadge = "<span class='md-chip' style='background:#e0f2fe;color:#0369a1'>No Prazo</span>";

              diasTexto = formatarDataBR(o.data_fim);
            } else if (perc >= 100) {
              statusBadge = "<span class='md-chip' style='background:#dcfce7;color:#166534'>✓ Concluído</span>";
              diasTexto = "Finalizado";
            }
          }

          const cor = perc >= 100 ? "#10b981" : perc > 60 ? "#3b82f6" : perc > 30 ? "#f59e0b" : "#ef4444";
          const barraHtml = `
            <div class="progress-bar-wrap">
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width:${perc}%; background:${cor};"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:#334155;white-space:nowrap;">${perc}%</span>
            </div>`;

          listaTempo.innerHTML += `
            <tr>
              <td style="font-weight:600;">${escapeHtml(o.nome)}</td>
              <td>${inicio}</td>
              <td>${diasTexto}</td>
              <td style="min-width:140px;">${barraHtml}</td>
              <td>${statusBadge}</td>
            </tr>`;
        });
      }
    }

  } catch (e) {
    console.error("Erro Dashboard:", e);
  }
});
