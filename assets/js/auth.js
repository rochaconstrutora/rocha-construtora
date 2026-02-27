// auth.js — V2 (Header atualizado + Permissões + Anti-XSS)

async function getUsuarioAtual() {
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) return null;
  const { data } = await supa.from("usuarios").select("*").eq("usuario_id", user.id).limit(1);
  return data && data.length > 0 ? { auth: user, perfil: data[0] } : null;
}

async function login(event) {
  event.preventDefault();
  const emailEl = document.getElementById("login-email");
  const senhaEl = document.getElementById("login-senha");
  const btnEl   = document.getElementById("btn-login");

  const email = emailEl.value.trim();
  const senha = senhaEl.value.trim();
  if (!email || !senha) return aviso("Preencha e-mail e senha.");

  if (btnEl) setBtnLoading(btnEl, true);

  const { error } = await supa.auth.signInWithPassword({ email, password: senha });

  if (error) {
    if (btnEl) setBtnLoading(btnEl, false);
    if (error.message.includes("Email not confirmed")) return aviso("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.");
    if (error.message.includes("Invalid login credentials")) return erro("E-mail ou senha incorretos.");
    return erro("Falha no login: " + error.message);
  }

  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.perfil) {
    if (btnEl) setBtnLoading(btnEl, false);
    return erro("Usuário sem perfil vinculado.");
  }
  window.location.href = usuario.perfil.tipo === "responsavel" ? "responsavel.html" : "index.html";
}

async function logout() {
  await supa.auth.signOut();
  window.location.href = "login.html";
}

async function protegerPagina(tiposPermitidos = null) {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) { window.location.href = "login.html"; return; }

  const usuario = await getUsuarioAtual();
  if (!usuario) { window.location.href = "login.html"; return; }

  const tipo = usuario.perfil.tipo;
  if (tiposPermitidos && !Array.isArray(tiposPermitidos)) tiposPermitidos = [tiposPermitidos];
  if (tiposPermitidos && !tiposPermitidos.includes(tipo)) {
    erro("Acesso negado.");
    setTimeout(() => { window.location.href = "login.html"; }, 1500);
    return;
  }

  // ── MENUS POR PERFIL ────────────────────────────────
  if (tipo !== "admin") {
    const permissoes = {
      financeiro: ["dashboard", "relatorios", "materiais", "caixa", "diario"],
      rh:         ["funcionarios", "relatorios", "ponto", "caixa"],
      responsavel: []
    };
    const permitidos = permissoes[tipo] || [];
    document.querySelectorAll(".md-nav .menu-item[data-target]").forEach(item => {
      const alvo = item.getAttribute("data-target");
      if (alvo && !permitidos.includes(alvo)) item.style.display = "none";
    });
  }

  // ── HEADER: nome, avatar, chip ────────────────────────
  const nome      = usuario.perfil.nome || "Usuário";
  const primeiroNome = nome.split(" ")[0];
  const inicial   = primeiroNome.charAt(0).toUpperCase();

  // Nome no pill
  const elNome = document.getElementById("header-nome-usuario");
  if (elNome) elNome.textContent = primeiroNome;

  // Avatar
  const elAvatar = document.getElementById("avatar-inicial");
  if (elAvatar) elAvatar.textContent = inicial;

  // Chip de perfil
  const elChip = document.getElementById("chip-perfil");
  if (elChip) {
    const labels = { admin: "Admin", responsavel: "Mestre", financeiro: "Financeiro", rh: "RH" };
    elChip.textContent = labels[tipo] || tipo.toUpperCase();
  }

  // Fallback antigo (compatibilidade)
  const elNomeFallback = document.querySelector(".md-user-pill span:last-child");
  if (elNomeFallback && !elNomeFallback.id) elNomeFallback.textContent = primeiroNome;

  const elCargoFallback = document.querySelector(".md-chip");
  if (elCargoFallback && !elCargoFallback.id) {
    elCargoFallback.innerHTML = "";
    const ic = document.createElement("span");
    ic.className = "material-symbols-outlined";
    ic.style.fontSize = "14px";
    ic.textContent = "verified_user";
    elCargoFallback.appendChild(ic);
    elCargoFallback.appendChild(document.createTextNode(" " + String(tipo || "").toUpperCase()));
  }

  return usuario;
}

document.addEventListener("DOMContentLoaded", () => {
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", logout);
});
