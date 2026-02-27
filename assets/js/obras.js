// obras.js — V1.2 (Modal + Busca + Anti-XSS + CEP Automático)

if (document.getElementById("sec-obras")) {
  document.addEventListener("DOMContentLoaded", () => {
    carregarObras();

    // Filtro de busca
    filtrarTabela("busca-obras", "lista-obras");

    // Listener CEP
    const cepInput = document.getElementById("obra-cep");
    if (cepInput) {
      cepInput.addEventListener("blur", async (e) => {
        aviso("Buscando CEP...");
        const dados = await buscarCEP(e.target.value);
        if (dados) {
          document.getElementById("obra-rua").value    = dados.rua    || "";
          document.getElementById("obra-bairro").value = dados.bairro || "";
          document.getElementById("obra-cidade").value = dados.cidade || "";
          document.getElementById("obra-estado").value = dados.uf     || "";
          document.getElementById("obra-numero").focus();
          sucesso("Endereço preenchido!");
        } else {
          erro("CEP não encontrado.");
        }
      });
    }
  });

  const form = document.getElementById("form-obras");

  async function carregarObras() {
    const lista = document.getElementById("lista-obras");
    lista.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">
      <span class="skeleton" style="width:60%;height:14px;display:block;margin:0 auto;"></span>
    </td></tr>`;

    const { data, error } = await supa.from("obras").select("*").order("nome");
    if (error || !data) {
      lista.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#ef4444;">Erro ao carregar obras.</td></tr>`;
      return;
    }

    // Contador
    const countEl = document.getElementById("count-lista-obras");
    if (countEl) countEl.textContent = `${data.length} obra(s)`;

    lista.innerHTML = "";
    if (data.length === 0) {
      lista.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <span class="material-symbols-outlined">apartment</span>Nenhuma obra cadastrada.</div></td></tr>`;
      return;
    }

    data.forEach(o => {
      const tr = document.createElement("tr");
      const inicioBR    = formatarDataBR(o.data_inicio);
      const fimBR       = formatarDataBR(o.data_fim);
      const perc        = o.percentual || 0;
      const cidadeDisplay = o.cidade ? `${o.cidade}/${o.estado}` : "-";

      let statusAuto = "<span style='color:#64748b'>—</span>";
      if (o.data_inicio && o.data_fim) {
        const total      = new Date(o.data_fim) - new Date(o.data_inicio);
        const passado    = new Date() - new Date(o.data_inicio);
        const percEsperado = (passado / total) * 100;
        if      (perc >= 100)              statusAuto = "<span class='md-chip' style='background:#dcfce7;color:#166534'>✓ Concluído</span>";
        else if (new Date() > new Date(o.data_fim)) statusAuto = "<span class='md-chip' style='background:#fee2e2;color:#b91c1c'>Atrasado</span>";
        else if ((percEsperado - perc) > 10)        statusAuto = "<span class='md-chip' style='background:#fff7ed;color:#c2410c'>Atenção</span>";
        else                               statusAuto = "<span class='md-chip' style='background:#e0f2fe;color:#0369a1'>No Prazo</span>";
      }

      const statusAtivo = o.status === "ativa"
        ? "<span class='badge-ativo'>Ativa</span>"
        : "<span class='badge-inativo'>Inativa</span>";

      const cor = perc >= 100 ? "#10b981" : perc > 60 ? "#3b82f6" : perc > 30 ? "#f59e0b" : "#ef4444";

      tr.innerHTML = `
        <td><strong>${escapeHtml(o.nome)}</strong></td>
        <td><span style="font-size:12px;">${escapeHtml(cidadeDisplay)}</span></td>
        <td>${statusAtivo}</td>
        <td><small style="color:#64748b;">De: ${inicioBR}<br>Até: ${fimBR}</small></td>
        <td>
          <div style="display:flex;flex-direction:column;gap:5px;min-width:100px;">
            <div class="progress-bar-wrap">
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width:${perc}%;background:${cor};"></div>
              </div>
              <span style="font-size:11px;font-weight:700;">${perc}%</span>
            </div>
            ${statusAuto}
          </div>
        </td>
        <td class="actions-cell">
          <button class="btn-primary btn-sm" onclick="editarObra('${o.id}')">
            <span class="material-symbols-outlined" style="font-size:14px;">edit</span> Editar
          </button>
          <button class="btn-danger btn-sm" onclick="excluirObra('${o.id}', '${escapeHtml(o.nome)}')">
            <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
          </button>
        </td>`;
      lista.appendChild(tr);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || form.querySelector("button");
    setBtnLoading(btn, true);

    const obraId = document.getElementById("obra-id").value;
    const dados = {
      nome:       document.getElementById("obra-nome").value.trim(),
      cep:        document.getElementById("obra-cep").value,
      rua:        document.getElementById("obra-rua").value,
      bairro:     document.getElementById("obra-bairro").value,
      numero:     document.getElementById("obra-numero").value,
      cidade:     document.getElementById("obra-cidade").value.trim(),
      estado:     document.getElementById("obra-estado").value.toUpperCase().trim(),
      status:     document.getElementById("obra-status").value,
      data_inicio:document.getElementById("obra-inicio").value || null,
      data_fim:   document.getElementById("obra-fim").value || null,
      percentual: document.getElementById("obra-perc").value || 0
    };

    if (!dados.nome || !dados.cidade || !dados.estado) {
      setBtnLoading(btn, false);
      return aviso("Preencha Nome, Cidade e Estado.");
    }

    const result = obraId
      ? await supa.from("obras").update(dados).eq("id", obraId)
      : await supa.from("obras").insert([dados]);

    setBtnLoading(btn, false);
    if (result.error) return erro("Erro: " + result.error.message);

    sucesso("Obra salva com sucesso!");
    form.reset();
    document.getElementById("obra-id").value = "";
    carregarObras();
  });

  window.editarObra = async (id) => {
    const { data } = await supa.from("obras").select("*").eq("id", id).single();
    if (!data) return erro("Erro ao carregar obra.");
    document.getElementById("obra-id").value      = data.id;
    document.getElementById("obra-nome").value    = data.nome;
    document.getElementById("obra-cep").value     = data.cep    || "";
    document.getElementById("obra-rua").value     = data.rua    || "";
    document.getElementById("obra-bairro").value  = data.bairro || "";
    document.getElementById("obra-numero").value  = data.numero || "";
    document.getElementById("obra-cidade").value  = data.cidade;
    document.getElementById("obra-estado").value  = data.estado;
    document.getElementById("obra-status").value  = data.status || "ativa";
    document.getElementById("obra-inicio").value  = data.data_inicio || "";
    document.getElementById("obra-fim").value     = data.data_fim    || "";
    document.getElementById("obra-perc").value    = data.percentual  || 0;

    // Scroll ao topo do formulário
    document.getElementById("sec-obras").scrollIntoView({ behavior: "smooth", block: "start" });
    aviso(`Editando: ${data.nome}`);
  };

  window.excluirObra = (id, nome) => {
    confirmar(
      `Deseja realmente excluir a obra "${nome}"? Esta ação não pode ser desfeita.`,
      "Excluir Obra",
      async () => {
        const { error } = await supa.from("obras").delete().eq("id", id);
        if (error) return erro("Erro ao excluir. Verifique se não há registros vinculados.");
        sucesso("Obra excluída!");
        carregarObras();
      }
    );
  };
}
