// usuarios.js — V Final Blindada
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("sec-usuarios")) return;

  const form = document.getElementById("form-usuario");
  const inputNome = document.getElementById("usuario-nome");
  const inputEmail = document.getElementById("usuario-email");
  const inputSenha = document.getElementById("usuario-senha");
  const selectTipo = document.getElementById("usuario-tipo");
  const selectObra = document.getElementById("usuario-obra");
  const obraBox = document.getElementById("usuario-obra-box");
  const senhaBox = document.getElementById("usuario-senha-box");
  const listaUsuarios = document.getElementById("lista-usuarios");
  let editandoId = null;

  if (selectTipo) {
    selectTipo.addEventListener("change", () => {
      if (selectTipo.value === "responsavel") {
        if (obraBox) obraBox.style.display = "block";
      } else {
        if (obraBox) obraBox.style.display = "none";
        if (selectObra) selectObra.value = "";
      }
    });
  }

  async function carregarObras() {
    if (!selectObra) return;
    const { data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome");
    selectObra.innerHTML = '<option value="">Selecione...</option>';
    if (data) data.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.id; opt.textContent = o.nome; selectObra.appendChild(opt);
    });
  }

  async function listarUsuarios() {
    if (!listaUsuarios) return;
    listaUsuarios.innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando...</td></tr>';
    const { data, error } = await supa.from("usuarios").select("id, nome, login, tipo, ativo, obras:obra_id (nome)").order("nome");
    if (error || !data) {
      listaUsuarios.innerHTML = '<tr><td colspan="6">Erro ao carregar usuários.</td></tr>';
      return;
    }
    listaUsuarios.innerHTML = "";
    data.forEach((u) => {
      const tr = document.createElement("tr");
      const tipoLabel = {admin: "Administrador", responsavel: "Responsável", financeiro: "Financeiro", rh: "RH"}[u.tipo] || u.tipo;
      const statusHtml = u.ativo ? "<span style='color:green'>Ativo</span>" : "<span style='color:red'>Inativo</span>";
      tr.innerHTML = `
        <td>${u.nome}</td>
        <td>${u.login || "-"}</td>
        <td>${tipoLabel}</td>
        <td>${u.obras?.nome || "-"}</td>
        <td>${statusHtml}</td>
        <td class="actions-cell">
          <button class="btn-primary btn-sm" onclick="editarUsuario('${u.id}')">Editar</button>
          <button class="btn-secondary btn-sm" onclick="resetSenhaUsuario('${u.id}')">Resetar</button>
          <button class="btn-danger btn-sm" onclick="removerUsuario('${u.id}')">Excluir</button>
        </td>
      `;
      listaUsuarios.appendChild(tr);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = inputNome.value.trim();
      const email = inputEmail.value.trim();
      const senha = inputSenha ? inputSenha.value.trim() : "";
      const tipo = selectTipo.value;
      const obraId = tipo === "responsavel" ? (selectObra.value || null) : null;

      if (!nome || !email || !tipo) return aviso("Preencha os campos obrigatórios.");

      if (editandoId) {
         const { error } = await supa.from("usuarios").update({ nome, login: email, tipo, obra_id: obraId }).eq("id", editandoId);
         if (error) return erro("Erro: " + error.message);
         sucesso("Usuário atualizado!");
         resetForm();
         listarUsuarios();
      } else {
         if (!senha) return aviso("Senha é obrigatória.");
         const { data: authData, error: authError } = await supa.auth.signUp({ email, password: senha });
         if (authError) return erro("Erro Auth: " + authError.message);
         if (!authData || !authData.user) return erro("Erro conexão Login.");
         
         const { error: dbError } = await supa.from("usuarios").insert([{
           usuario_id: authData.user.id, nome, login: email, tipo, obra_id: obraId, ativo: true
         }]);
         if (dbError) return erro("Conflito: Login criado mas perfil falhou.");
         sucesso("Usuário criado!");
         resetForm();
         listarUsuarios();
      }
    });
  }

  function resetForm() {
    form.reset();
    selectTipo.value = "responsavel";
    if (obraBox) obraBox.style.display = "block";
    if (senhaBox) senhaBox.style.display = "block";
    editandoId = null;
  }

  window.editarUsuario = async (id) => {
    const { data } = await supa.from("usuarios").select("*").eq("id", id).single();
    if (!data) return erro("Erro ao carregar.");
    editandoId = data.id;
    if(inputNome) inputNome.value = data.nome;
    if(inputEmail) inputEmail.value = data.login;
    if(inputSenha) inputSenha.value = "";
    if (senhaBox) senhaBox.style.display = "none"; 
    if(selectTipo) selectTipo.value = data.tipo;
    if (data.tipo === "responsavel") {
      if(obraBox) obraBox.style.display = "block";
      if(selectObra) selectObra.value = data.obra_id || "";
    } else {
      if(obraBox) obraBox.style.display = "none";
      if(selectObra) selectObra.value = "";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    aviso("Editando: " + data.nome);
  };

  window.resetSenhaUsuario = async (id) => {
    if (!confirm("Enviar e-mail?")) return;
    const { data } = await supa.from("usuarios").select("login").eq("id", id).single();
    if(!data) return erro("E-mail não encontrado.");
    const { error } = await supa.auth.resetPasswordForEmail(data.login, { redirectTo: window.location.origin + "/reset.html" });
    if (error) return erro("Erro: " + error.message);
    sucesso("E-mail enviado!");
  };

  window.removerUsuario = async (id) => {
    if (!confirm("Excluir perfil?")) return;
    const { error } = await supa.from("usuarios").delete().eq("id", id);
    if (error) return erro("Erro ao excluir.");
    sucesso("Excluído.");
    listarUsuarios();
  };

  if (senhaBox) senhaBox.style.display = "block";
  carregarObras();
  listarUsuarios();
});