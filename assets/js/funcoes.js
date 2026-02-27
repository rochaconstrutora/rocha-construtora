// funcoes.js — V1.2 (Modal + Busca + Anti-XSS)

document.addEventListener("DOMContentLoaded", () => {
  carregarFuncoes();
  const form = document.getElementById("form-funcoes");
  if (form) form.addEventListener("submit", salvarFuncao);

  // Filtro busca
  filtrarTabela("busca-funcoes", "lista-funcoes");
});

function converterMoedaParaNumero(valorTexto) {
  if (!valorTexto) return 0;
  const limpo = valorTexto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(limpo) || 0;
}

async function salvarFuncao(event) {
  event.preventDefault();
  const btn = event.submitter || event.target.querySelector(".btn-primary");
  setBtnLoading(btn, true);

  const id        = document.getElementById("funcao-id").value;
  const nome      = document.getElementById("funcao-nome").value.trim();
  const meia      = converterMoedaParaNumero(document.getElementById("funcao-meia").value);
  const diaria    = converterMoedaParaNumero(document.getElementById("funcao-diaria").value);
  const hora      = converterMoedaParaNumero(document.getElementById("funcao-hora").value);

  if (!nome) { setBtnLoading(btn, false); return aviso("Informe o nome da função."); }

  const payload = { nome, valor_meia: meia, valor_diaria: diaria, valor_hora: hora };

  const result = id
    ? await supa.from("funcoes").update(payload).eq("id", id)
    : await supa.from("funcoes").insert(payload);

  setBtnLoading(btn, false);
  if (result.error) return erro("Erro: " + result.error.message);

  sucesso("Função salva!");
  document.getElementById("form-funcoes").reset();
  document.getElementById("funcao-id").value = "";
  carregarFuncoes();
}

async function carregarFuncoes() {
  const tabela = document.getElementById("lista-funcoes");
  if (!tabela) return;

  tabela.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:18px;">
    <span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const { data, error } = await supa.from("funcoes").select("*").order("nome", { ascending: true });

  if (error) return tabela.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center;padding:16px;">Erro SQL — verifique se a coluna valor_hora existe.</td></tr>`;

  if (!data || data.length === 0) {
    tabela.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <span class="material-symbols-outlined">badge</span>Nenhuma função cadastrada.</div></td></tr>`;
    return;
  }

  const countEl = document.getElementById("count-lista-funcoes");
  if (countEl) countEl.textContent = `${data.length} função(ões)`;

  tabela.innerHTML = "";
  data.forEach(f => {
    const tr = document.createElement("tr");
    const fmt = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const statusHtml = f.ativo
      ? "<span class='badge-ativo'>Ativa</span>"
      : "<span class='badge-inativo'>Inativa</span>";

    tr.innerHTML = `
      <td><strong>${escapeHtml(f.nome)}</strong></td>
      <td>${fmt(f.valor_meia)}</td>
      <td>${fmt(f.valor_diaria)}</td>
      <td style="color:#0284c7;font-weight:600;">${fmt(f.valor_hora)}</td>
      <td>${statusHtml}</td>
      <td class="actions-cell">
        <button class="btn-primary btn-sm" onclick="editarFuncao('${f.id}')">
          <span class="material-symbols-outlined" style="font-size:13px;">edit</span> Editar
        </button>
        <button class="btn-secondary btn-sm" onclick="alterarStatusFuncao('${f.id}', ${f.ativo})">
          ${f.ativo ? "Desativar" : "Ativar"}
        </button>
      </td>`;
    tabela.appendChild(tr);
  });
}

async function editarFuncao(id) {
  const { data, error } = await supa.from("funcoes").select("*").eq("id", id).single();
  if (error || !data) return erro("Erro ao carregar função.");

  const f = data;
  document.getElementById("funcao-id").value   = f.id;
  document.getElementById("funcao-nome").value = f.nome;

  const setMask = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) { el.value = (val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); el.dispatchEvent(new Event("input")); }
  };

  setMask("funcao-meia",   f.valor_meia);
  setMask("funcao-diaria", f.valor_diaria);
  setMask("funcao-hora",   f.valor_hora);

  aviso(`Editando: ${f.nome}`);
  document.getElementById("sec-funcoes").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function alterarStatusFuncao(id, ativoAtual) {
  const { error } = await supa.from("funcoes").update({ ativo: !ativoAtual }).eq("id", id);
  if (error) return erro("Erro ao alterar status.");
  sucesso("Status alterado!");
  carregarFuncoes();
}
