// funcionarios.js — V Final (Com Cidade e Estado)

document.addEventListener("DOMContentLoaded", () => {
  carregarFuncionarios();
  carregarFuncoesFuncionario();
  carregarObrasFuncionario();
  const form = document.getElementById("form-funcionarios");
  if (form) form.addEventListener("submit", salvarFuncionario);

  // TRIGGER DO CEP (Preenchimento Automático)
  const cepFunc = document.getElementById("funcionario-cep");
  if(cepFunc) {
      cepFunc.addEventListener("blur", async (e) => {
          const val = e.target.value;
          if(val.length < 8) return; 
          aviso("Buscando CEP...");
          const dados = await buscarCEP(val);
          if(dados) {
              document.getElementById("funcionario-rua").value = dados.rua || "";
              document.getElementById("funcionario-bairro").value = dados.bairro || "";
              
              // Preenche Cidade e Estado Automaticamente
              document.getElementById("funcionario-cidade").value = dados.cidade || "";
              document.getElementById("funcionario-estado").value = dados.uf || "";
              
              document.getElementById("funcionario-numero").focus();
              sucesso("Endereço encontrado!");
          } else {
              erro("CEP não encontrado.");
          }
      });
  }

  // TRIGGER DA MÁSCARA PIX
  const pixInput = document.getElementById("funcionario-pix");
  if (pixInput) {
      pixInput.addEventListener("blur", (e) => {
          const valorFormatado = aplicarMascaraPixInput(e.target.value);
          e.target.value = valorFormatado;
      });
  }
});

async function carregarFuncoesFuncionario() {
  const select = document.getElementById("funcionario-funcao");
  if (!select) return;
  select.innerHTML = "";
  const { data } = await supa.from("funcoes").select("id, nome").eq("ativo", true).order("nome");
  let opt = document.createElement("option"); opt.value = ""; opt.textContent = "Selecione a função"; select.appendChild(opt);
  if(data) data.forEach(f => { let option = document.createElement("option"); option.value = f.id; option.textContent = f.nome; select.appendChild(option); });
}

async function carregarObrasFuncionario() {
  const select = document.getElementById("funcionario-obra");
  if (!select) return;
  select.innerHTML = "";
  const { data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome");
  let opt = document.createElement("option"); opt.value = ""; opt.textContent = "Selecione a obra"; select.appendChild(opt);
  if(data) data.forEach(o => { let option = document.createElement("option"); option.value = o.id; option.textContent = o.nome; select.appendChild(option); });
}

async function salvarFuncionario(event) {
  event.preventDefault();

  const id = document.getElementById("funcionario-id").value;
  const nome = document.getElementById("funcionario-nome").value.trim();
  const apelido = document.getElementById("funcionario-apelido").value.trim();
  const funcao_id = document.getElementById("funcionario-funcao").value;
  const obra_id = document.getElementById("funcionario-obra").value;
  const cpf = document.getElementById("funcionario-cpf").value.trim();
  const conta = document.getElementById("funcionario-conta").value.trim();
  const pix = document.getElementById("funcionario-pix").value.trim();

  // Endereço Completo
  const cep = document.getElementById("funcionario-cep").value;
  const rua = document.getElementById("funcionario-rua").value;
  const bairro = document.getElementById("funcionario-bairro").value;
  const numero = document.getElementById("funcionario-numero").value;
  const cidade = document.getElementById("funcionario-cidade").value;
  const estado = document.getElementById("funcionario-estado").value;

  // VALIDAÇÃO CPF
  if (cpf && !validarCPF(cpf)) {
      erro("CPF inválido! Verifique os dígitos.");
      document.getElementById("funcionario-cpf").focus();
      document.getElementById("funcionario-cpf").style.borderColor = "red";
      return; 
  } else {
      document.getElementById("funcionario-cpf").style.borderColor = "#e2e8f0";
  }

  if (!nome || !funcao_id || !obra_id) {
    aviso("Preencha Nome, Função e Obra.");
    return;
  }

  // Payload atualizado com cidade e estado
  const payload = { 
      nome, apelido, funcao_id, obra_id, cpf, conta, pix, 
      cep, rua, bairro, numero, cidade, estado 
  };
  
  let result;

  if (id) result = await supa.from("funcionarios").update(payload).eq("id", id);
  else result = await supa.from("funcionarios").insert(payload);

  if (result.error) return erro("Erro: " + result.error.message);

  sucesso("Funcionário salvo!");
  document.getElementById("form-funcionarios").reset();
  document.getElementById("funcionario-id").value = "";
  carregarFuncionarios();
}

async function carregarFuncionarios() {
  const tabela = document.getElementById("lista-funcionarios");
  if (!tabela) return;
  tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Carregando...</td></tr>";

  // Carrega cidade e estado para usar futuramente se necessário, mas na tabela mostra o básico
  const { data, error } = await supa.from("funcionarios").select("*, funcoes(nome), obras(nome)").order("nome", { ascending: true });

  if (error) return tabela.innerHTML = "<tr><td colspan='6'>Erro ao carregar lista.</td></tr>";
  if (!data || !data.length) return tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Vazio.</td></tr>";

  tabela.innerHTML = "";
  data.forEach(f => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.apelido || "-"}</td>
      <td>${f.funcoes?.nome || "-"}</td>
      <td>${f.obras?.nome || "-"}</td>
      <td>${f.ativo ? "<span style='color:green'>Ativo</span>" : "<span style='color:red'>Inativo</span>"}</td>
      <td class="actions-cell">
        <button class="btn-primary btn-sm" onclick="editarFuncionario('${f.id}')">Editar</button>
        <button class="btn-secondary btn-sm" onclick="alterarStatusFuncionario('${f.id}', ${f.ativo})">${f.ativo ? "Desativar" : "Ativar"}</button>
        <button class="btn-danger btn-sm" onclick="excluirFuncionario('${f.id}')">Excluir</button>
      </td>
    `;
    tabela.appendChild(tr);
  });
}

async function editarFuncionario(id) {
  const { data } = await supa.from("funcionarios").select("*").eq("id", id).single();
  if (!data) return erro("Erro.");
  
  document.getElementById("funcionario-id").value = data.id;
  document.getElementById("funcionario-nome").value = data.nome;
  document.getElementById("funcionario-apelido").value = data.apelido || "";
  document.getElementById("funcionario-funcao").value = data.funcao_id;
  document.getElementById("funcionario-obra").value = data.obra_id;
  document.getElementById("funcionario-cpf").value = data.cpf || "";
  
  // Endereço
  document.getElementById("funcionario-cep").value = data.cep || "";
  document.getElementById("funcionario-rua").value = data.rua || "";
  document.getElementById("funcionario-bairro").value = data.bairro || "";
  document.getElementById("funcionario-numero").value = data.numero || "";
  document.getElementById("funcionario-cidade").value = data.cidade || "";
  document.getElementById("funcionario-estado").value = data.estado || "";
  
  document.getElementById("funcionario-conta").value = data.conta || "";
  document.getElementById("funcionario-pix").value = data.pix || "";
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  aviso("Editando...");
}

async function alterarStatusFuncionario(id, ativoAtual) {
  const { error } = await supa.from("funcionarios").update({ ativo: !ativoAtual }).eq("id", id);
  if (error) return erro("Erro.");
  sucesso("Status alterado!");
  carregarFuncionarios();
}

window.excluirFuncionario = async (id) => {
    if (!confirm("Excluir funcionário?")) return;
    const { error } = await supa.from("funcionarios").delete().eq("id", id);
    if (error) return erro("Erro (verifique vínculos).");
    sucesso("Excluído!");
    carregarFuncionarios();
};