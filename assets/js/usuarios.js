// usuarios.js — V1.2 (Modal + Anti-XSS + Sessão Admin)

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("sec-usuarios")) return;

  const form        = document.getElementById("form-usuario");
  const inputNome   = document.getElementById("usuario-nome");
  const inputEmail  = document.getElementById("usuario-email");
  const inputSenha  = document.getElementById("usuario-senha");
  const selectTipo  = document.getElementById("usuario-tipo");
  const selectObra  = document.getElementById("usuario-obra");
  const obraBox     = document.getElementById("usuario-obra-box");
  const senhaBox    = document.getElementById("usuario-senha-box");
  const listaUsrs   = document.getElementById("lista-usuarios");
  let editandoId    = null;

  if (selectTipo) {
    selectTipo.addEventListener("change", () => {
      if (obraBox) obraBox.style.display = selectTipo.value === "responsavel" ? "block" : "none";
      if (selectObra && selectTipo.value !== "responsavel") selectObra.value = "";
    });
  }

  async function carregarObras() {
    if (!selectObra) return;
    let { data, error } = await supa.from("obras").select("id, nome").eq("status", "ativa").order("nome");
    if (error) ({ data } = await supa.from("obras").select("id, nome").eq("ativo", true).order("nome"));
    selectObra.innerHTML = '<option value="">Selecione...</option>';
    if (data) data.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.id; opt.textContent = o.nome; selectObra.appendChild(opt);
    });
  }

  async function listarUsuarios() {
    if (!listaUsrs) return;
    listaUsrs.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;"><span class="skeleton" style="width:50%;height:14px;display:block;margin:0 auto;"></span></td></tr>';

    const { data, error } = await supa
      .from("usuarios")
      .select("id, nome, login, tipo, ativo, obras:obra_id (nome)")
      .order("nome");

    if (error || !data) {
      listaUsrs.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:16px;">Erro ao carregar usuários.</td></tr>';
      return;
    }

    listaUsrs.innerHTML = "";
    if (data.length === 0) {
      listaUsrs.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <span class="material-symbols-outlined">group</span>Nenhum usuário cadastrado.</div></td></tr>`;
      return;
    }

    data.forEach(u => {
      const tr = document.createElement("tr");
      const tipoLabel = { admin: "Administrador", responsavel: "Responsável", financeiro: "Financeiro", rh: "RH" }[u.tipo] || u.tipo;
      const statusHtml = u.ativo
        ? "<span class='badge-ativo'>Ativo</span>"
        : "<span class='badge-inativo'>Inativo</span>";

      tr.innerHTML = `
        <td><strong>${escapeHtml(u.nome)}</strong></td>
        <td style="font-size:12px;color:#64748b;">${escapeHtml(u.login || "—")}</td>
        <td><span class="md-chip">${tipoLabel}</span></td>
        <td>${escapeHtml(u.obras?.nome || "—")}</td>
        <td>${statusHtml}</td>
        <td class="actions-cell">
          <button class="btn-primary btn-sm"   onclick="editarUsuario('${u.id}')">Editar</button>
          <button class="btn-secondary btn-sm" onclick="resetSenhaUsuario('${u.id}', '${escapeHtml(u.nome)}')">Resetar Senha</button>
          <button class="btn-danger btn-sm"    onclick="removerUsuario('${u.id}', '${escapeHtml(u.nome)}')">Excluir</button>
        </td>`;
      listaUsrs.appendChild(tr);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || form.querySelector(".btn-primary");
      setBtnLoading(btn, true);

      const nome   = inputNome.value.trim();
      const email  = inputEmail.value.trim();
      const senha  = inputSenha ? inputSenha.value.trim() : "";
      const tipo   = selectTipo.value;
      const obraId = tipo === "responsavel" ? (selectObra?.value || null) : null;

      if (!nome || !email || !tipo) { setBtnLoading(btn, false); return aviso("Preencha os campos obrigatórios."); }

      if (editandoId) {
        const { error } = await supa.from("usuarios").update({ nome, login: email, tipo, obra_id: obraId }).eq("id", editandoId);
        setBtnLoading(btn, false);
        if (error) return erro("Erro: " + error.message);
        sucesso("Usuário atualizado!");
        resetForm();
        listarUsuarios();
      } else {
        if (!senha) { setBtnLoading(btn, false); return aviso("Senha é obrigatória."); }
        const { data: { session: adminSession } } = await supa.auth.getSession();
        const { data: authData, error: authError } = await supa.auth.signUp({ email, password: senha });
        if (adminSession) {
          try { await supa.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token }); } catch (e) {}
        }
        setBtnLoading(btn, false);
        if (authError) return erro("Erro Auth: " + authError.message);
        if (!authData?.user) return erro("Erro de conexão.");

        const { error: dbError } = await supa.from("usuarios").insert([{
          usuario_id: authData.user.id, nome, login: email, tipo, obra_id: obraId, ativo: true
        }]);
        if (dbError) return erro("Usuário criado no Auth mas perfil falhou: " + dbError.message);
        sucesso("Usuário criado com sucesso!");
        resetForm();
        listarUsuarios();
      }
    });
  }

  function resetForm() {
    form.reset();
    if (selectTipo) selectTipo.value = "responsavel";
    if (obraBox)  obraBox.style.display  = "block";
    if (senhaBox) senhaBox.style.display = "block";
    editandoId = null;
    const btnSubmit = form.querySelector(".btn-primary");
    if (btnSubmit) btnSubmit.textContent = "Criar Usuário";
  }

  window.editarUsuario = async (id) => {
    const { data } = await supa.from("usuarios").select("*").eq("id", id).single();
    if (!data) return erro("Erro ao carregar.");
    editandoId = data.id;
    if (inputNome)  inputNome.value  = data.nome;
    if (inputEmail) inputEmail.value = data.login;
    if (inputSenha) inputSenha.value = "";
    if (senhaBox)   senhaBox.style.display = "none";
    if (selectTipo) selectTipo.value = data.tipo;
    if (data.tipo === "responsavel") {
      if (obraBox)   obraBox.style.display = "block";
      if (selectObra) selectObra.value = data.obra_id || "";
    } else {
      if (obraBox)   obraBox.style.display = "none";
      if (selectObra) selectObra.value = "";
    }
    const btnSubmit = form.querySelector(".btn-primary");
    if (btnSubmit) btnSubmit.textContent = "Salvar Alterações";
    document.getElementById("sec-usuarios").scrollIntoView({ behavior: "smooth", block: "start" });
    aviso("Editando: " + data.nome);
  };

  window.resetSenhaUsuario = (id, nome) => {
    confirmar(
      `Enviar e-mail de redefinição de senha para "${nome}"?`,
      "Resetar Senha",
      async () => {
        const { data } = await supa.from("usuarios").select("login").eq("id", id).single();
        if (!data) return erro("E-mail não encontrado.");
        const { error } = await supa.auth.resetPasswordForEmail(data.login, { redirectTo: window.location.origin + "/reset.html" });
        if (error) return erro("Erro: " + error.message);
        sucesso("E-mail de redefinição enviado!");
      }
    );
  };

  window.removerUsuario = (id, nome) => {
    confirmar(
      `Deseja excluir o usuário "${nome}"? Ele perderá acesso ao sistema.`,
      "Excluir Usuário",
      async () => {
        const { error } = await supa.from("usuarios").delete().eq("id", id);
        if (error) return erro("Erro ao excluir.");
        sucesso("Usuário excluído.");
        listarUsuarios();
      }
    );
  };

  if (senhaBox) senhaBox.style.display = "block";
  carregarObras();
  listarUsuarios();
});
