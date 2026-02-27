// funcionarios.js — V1.2 (Modal + Busca + CEP + Anti-XSS)

document.addEventListener("DOMContentLoaded", () => {
  carregarFuncionarios();
  carregarFuncoesFuncionario();
  carregarObrasFuncionario();

  const form = document.getElementById("form-funcionarios");
  if (form) form.addEventListener("submit", salvarFuncionario);

  // Filtro busca em tempo real
  filtrarTabela("busca-funcionarios", "lista-funcionarios");

  // CEP automático
  const cepFunc = document.getElementById("funcionario-cep");
  if (cepFunc) {
    cepFunc.addEventListener("blur", async (e) => {
      const val = e.target.value;
      if (val.replace(/\D/g, "").length < 8) return;
      aviso("Buscando CEP...");
      const dados = await buscarCEP(val);
      if (dados) {
        document.getElementById("funcionario-rua").value    = dados.rua    || "";
        document.getElementById("funcionario-bairro").value = dados.bairro || "";
        document.getElementById("funcionario-cidade").value = dados.cidade || "";
        document.getElementById("funcionario-estado").value = dados.uf     || "";
        document.getElementById("funcionario-numero").focus();
        sucesso("Endereço encontrado!");
      } else {
        erro("CEP não encontrado.");
      }
    });
  }

  // Máscara PIX no blur
  const pixInput = document.getElementById("funcionario-pix");
  if (pixInput) {
    pixInput.addEventListener("blur", (e) => {
      e.target.value = aplicarMascaraPixInput(e.target.value);
    });
  }
});

async function carregarFuncoesFuncionario() {
  const select = document.getElementById("funcionario-funcao");
  if (!select) return;
  select.innerHTML = "";
  const { data } = await supa.from("funcoes").select("id, nome").eq("ativo", true).order("nome");
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecione a função";
  select.appendChild(optDefault);
  if (data) data.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id; opt.textContent = f.nome; select.appendChild(opt);
  });
}

async function carregarObrasFuncionario() {
  const select = document.getElementById("funcionario-obra");
  if (!select) return;
  select.innerHTML = "";
  let { data, error } = await supa.from("obras").select("id, nome").eq("status", "ativa").order("nome");
  if (error) ({ data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome"));
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecione a obra";
  select.appendChild(optDefault);
  if (data) data.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.id; opt.textContent = o.nome; select.appendChild(opt);
  });
}

async function salvarFuncionario(event) {
  event.preventDefault();
  const btn = event.submitter || event.target.querySelector("button[type='submit']") || event.target.querySelector(".btn-primary");
  setBtnLoading(btn, true);

  const id       = document.getElementById("funcionario-id").value;
  const nome     = document.getElementById("funcionario-nome").value.trim();
  const apelido  = document.getElementById("funcionario-apelido").value.trim();
  const funcao_id= document.getElementById("funcionario-funcao").value;
  const obra_id  = document.getElementById("funcionario-obra").value;
  const cpf      = document.getElementById("funcionario-cpf").value.trim();
  const conta    = document.getElementById("funcionario-conta").value.trim();
  const pix      = document.getElementById("funcionario-pix").value.trim();
  const cep      = document.getElementById("funcionario-cep").value;
  const rua      = document.getElementById("funcionario-rua").value;
  const bairro   = document.getElementById("funcionario-bairro").value;
  const numero   = document.getElementById("funcionario-numero").value;
  const cidade   = document.getElementById("funcionario-cidade").value;
  const estado   = document.getElementById("funcionario-estado").value;

  const cpfEl = document.getElementById("funcionario-cpf");

  if (cpf && !validarCPF(cpf)) {
    setBtnLoading(btn, false);
    erro("CPF inválido! Verifique os dígitos.");
    cpfEl.focus();
    cpfEl.classList.add("is-invalid");
    return;
  } else {
    cpfEl.classList.remove("is-invalid");
  }

  if (!nome || !funcao_id || !obra_id) {
    setBtnLoading(btn, false);
    return aviso("Preencha Nome, Função e Obra.");
  }

  const payload = { nome, apelido, funcao_id, obra_id, cpf, conta, pix, cep, rua, bairro, numero, cidade, estado };

  const result = id
    ? await supa.from("funcionarios").update(payload).eq("id", id)
    : await supa.from("funcionarios").insert(payload);

  setBtnLoading(btn, false);
  if (result.error) return erro("Erro: " + result.error.message);

  sucesso("Funcionário salvo com sucesso!");
  document.getElementById("form-funcionarios").reset();
  document.getElementById("funcionario-id").value = "";
  carregarFuncionarios();
}

async function carregarFuncionarios() {
  const tabela = document.getElementById("lista-funcionarios");
  if (!tabela) return;

  tabela.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">
    <span class="skeleton" style="width:60%;height:14px;display:block;margin:0 auto;"></span>
  </td></tr>`;

  const { data, error } = await supa
    .from("funcionarios")
    .select("*, funcoes(nome), obras(nome)")
    .order("nome", { ascending: true });

  if (error) return tabela.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#ef4444;">Erro ao carregar lista.</td></tr>`;

  const countEl = document.getElementById("count-lista-funcionarios");
  if (countEl) countEl.textContent = `${(data||[]).length} funcionário(s)`;

  if (!data || !data.length) {
    tabela.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <span class="material-symbols-outlined">engineering</span>Nenhum funcionário cadastrado.</div></td></tr>`;
    return;
  }

  tabela.innerHTML = "";
  data.forEach(f => {
    const tr = document.createElement("tr");
    const statusHtml = f.ativo
      ? "<span class='badge-ativo'>Ativo</span>"
      : "<span class='badge-inativo'>Inativo</span>";

    tr.innerHTML = `
      <td>
        <div style="font-weight:600;">${escapeHtml(f.nome)}</div>
        ${f.cpf ? `<div style="font-size:11px;color:#94a3b8;">${f.cpf}</div>` : ""}
      </td>
      <td>${escapeHtml(f.apelido || "—")}</td>
      <td>${escapeHtml(f.funcoes?.nome || "—")}</td>
      <td>${escapeHtml(f.obras?.nome  || "—")}</td>
      <td>${statusHtml}</td>
      <td class="actions-cell">
        <button class="btn-primary btn-sm" onclick="editarFuncionario('${f.id}')">
          <span class="material-symbols-outlined" style="font-size:13px;">edit</span> Editar
        </button>
        <button class="btn-secondary btn-sm" onclick="alterarStatusFuncionario('${f.id}', ${f.ativo})">
          ${f.ativo ? "Desativar" : "Ativar"}
        </button>
        <button class="btn-danger btn-sm" onclick="excluirFuncionario('${f.id}', '${escapeHtml(f.nome)}')">
          <span class="material-symbols-outlined" style="font-size:13px;">delete</span>
        </button>
      </td>`;
    tabela.appendChild(tr);
  });
}

async function editarFuncionario(id) {
  const { data } = await supa.from("funcionarios").select("*").eq("id", id).single();
  if (!data) return erro("Erro ao carregar funcionário.");

  document.getElementById("funcionario-id").value      = data.id;
  document.getElementById("funcionario-nome").value    = data.nome;
  document.getElementById("funcionario-apelido").value = data.apelido || "";
  document.getElementById("funcionario-funcao").value  = data.funcao_id;
  document.getElementById("funcionario-obra").value    = data.obra_id;
  document.getElementById("funcionario-cpf").value     = data.cpf    || "";
  document.getElementById("funcionario-cep").value     = data.cep    || "";
  document.getElementById("funcionario-rua").value     = data.rua    || "";
  document.getElementById("funcionario-bairro").value  = data.bairro || "";
  document.getElementById("funcionario-numero").value  = data.numero || "";
  document.getElementById("funcionario-cidade").value  = data.cidade || "";
  document.getElementById("funcionario-estado").value  = data.estado || "";
  document.getElementById("funcionario-conta").value   = data.conta  || "";
  document.getElementById("funcionario-pix").value     = data.pix    || "";

  document.getElementById("sec-funcionarios").scrollIntoView({ behavior: "smooth", block: "start" });
  aviso(`Editando: ${data.nome}`);
}

async function alterarStatusFuncionario(id, ativoAtual) {
  const { error } = await supa.from("funcionarios").update({ ativo: !ativoAtual }).eq("id", id);
  if (error) return erro("Erro ao alterar status.");
  sucesso("Status alterado!");
  carregarFuncionarios();
}

window.excluirFuncionario = (id, nome) => {
  confirmar(
    `Deseja excluir o funcionário "${nome}"? Esta ação é irreversível.`,
    "Excluir Funcionário",
    async () => {
      const { error } = await supa.from("funcionarios").delete().eq("id", id);
      if (error) return erro("Erro: verifique se há registros de ponto vinculados.");
      sucesso("Funcionário excluído!");
      carregarFuncionarios();
    }
  );
};
