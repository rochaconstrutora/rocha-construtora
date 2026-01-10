// funcoes.js — V1.1 (Anti-XSS)
document.addEventListener("DOMContentLoaded", () => {
  carregarFuncoes();
  const form = document.getElementById("form-funcoes");
  if (form) form.addEventListener("submit", salvarFuncao);
});

async function salvarFuncao(event) {
  event.preventDefault();

  const id = document.getElementById("funcao-id").value;
  const nome = document.getElementById("funcao-nome").value.trim();
  
  const meiaInput = document.getElementById("funcao-meia").value;
  const diariaInput = document.getElementById("funcao-diaria").value;
  const horaInput = document.getElementById("funcao-hora").value; 

  const meia = converterMoedaParaNumero(meiaInput);
  const diaria = converterMoedaParaNumero(diariaInput);
  const hora = converterMoedaParaNumero(horaInput); 

  if (!nome) return aviso("Informe o nome da função.");

  const payload = { nome, valor_meia: meia, valor_diaria: diaria, valor_hora: hora };

  let result;
  if (id) {
    result = await supa.from("funcoes").update(payload).eq("id", id);
  } else {
    result = await supa.from("funcoes").insert(payload);
  }

  if (result.error) return erro("Erro: " + result.error.message);

  sucesso("Função salva!");
  document.getElementById("form-funcoes").reset();
  document.getElementById("funcao-id").value = "";
  carregarFuncoes();
}

function converterMoedaParaNumero(valorTexto) {
  if (!valorTexto) return 0;
  let limpo = valorTexto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(limpo) || 0;
}

async function carregarFuncoes() {
  const tabela = document.getElementById("lista-funcoes");
  if (!tabela) return;

  tabela.innerHTML = "<tr><td colspan='6' style='text-align:center'>Carregando...</td></tr>";

  const { data, error } = await supa.from("funcoes").select("*").order("nome", { ascending: true });

  if (error) return tabela.innerHTML = "<tr><td colspan='6'>Erro SQL (Verifique se criou a coluna valor_hora).</td></tr>";
  if (!data || data.length === 0) return tabela.innerHTML = "<tr><td colspan='6' style='text-align:center'>Nenhuma função cadastrada.</td></tr>";

  tabela.innerHTML = "";

  data.forEach(f => {
    const tr = document.createElement("tr");
    const valMeia = (f.valor_meia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const valDiaria = (f.valor_diaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const valHora = (f.valor_hora || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    tr.innerHTML = `
      <td><strong>${escapeHtml(f.nome)}</strong></td>
      <td>${valMeia}</td>
      <td>${valDiaria}</td>
      <td style="color:#0284c7; font-weight:500;">${valHora}</td>
      <td>${f.ativo ? "<span style='color:green'>Ativa</span>" : "<span style='color:red'>Inativa</span>"}</td>
      <td class="actions-cell">
        <button class="btn-primary btn-sm" onclick="editarFuncao('${f.id}')">Editar</button>
        <button class="btn-secondary btn-sm" onclick="alterarStatusFuncao('${f.id}', ${f.ativo})">
          ${f.ativo ? "Desativar" : "Ativar"}
        </button>
      </td>
    `;
    tabela.appendChild(tr);
  });
}

async function editarFuncao(id) {
  const { data, error } = await supa.from("funcoes").select("*").eq("id", id).single();
  if (error || !data) return erro("Erro ao carregar função.");

  const f = data;
  document.getElementById("funcao-id").value = f.id;
  document.getElementById("funcao-nome").value = f.nome;
  
  const setMaskValue = (id, val) => {
      const el = document.getElementById(id);
      if(el) {
          el.value = (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          el.dispatchEvent(new Event('input'));
      }
  };

  setMaskValue("funcao-meia", f.valor_meia);
  setMaskValue("funcao-diaria", f.valor_diaria);
  setMaskValue("funcao-hora", f.valor_hora);

  aviso(`Editando: ${f.nome}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function alterarStatusFuncao(id, ativoAtual) {
  const { error } = await supa.from("funcoes").update({ ativo: !ativoAtual }).eq("id", id);
  if (error) return erro("Erro ao alterar status.");
  sucesso("Status alterado!");
  carregarFuncoes();
}