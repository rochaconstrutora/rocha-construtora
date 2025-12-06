// auth.js — Permissões Ajustadas (Financeiro sem Ponto)

async function getUsuarioAtual() {
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) return null;
  const { data } = await supa.from("usuarios").select("*").eq("usuario_id", user.id).limit(1);
  return data && data.length > 0 ? { auth: user, perfil: data[0] } : null;
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value.trim();
  if (!email || !senha) return aviso("Preencha e-mail e senha.");

  const { error } = await supa.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.message.includes("Email not confirmed")) return aviso("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.");
    if (error.message.includes("Invalid login credentials")) return erro("E-mail ou senha incorretos.");
    return erro("Falha no login: " + error.message);
  }

  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.perfil) return erro("Usuário sem perfil vinculado.");
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
    erro("Acesso negado."); setTimeout(() => { window.location.href = "login.html"; }, 1500); return;
  }

  // --- CONFIGURAÇÃO DE MENUS POR PERFIL ---
  if(tipo !== "admin") {
      const permissoes = { 
          // ATUALIZADO: Financeiro VÊ Diário, mas NÃO VÊ Ponto
          financeiro: ["dashboard", "relatorios", "materiais", "caixa", "diario"], 
          
          // RH VÊ Ponto
          rh: ["funcionarios", "relatorios", "ponto"], 
          
          responsavel: [] 
      };
      
      const permitidos = permissoes[tipo] || [];
      
      document.querySelectorAll(".md-nav .menu-item").forEach(item => {
        const alvo = item.getAttribute("data-target");
        // Se o item tem um alvo e não está na lista de permitidos, esconde
        if (alvo && !permitidos.includes(alvo)) item.style.display = "none";
      });
  }
  
  // Atualiza nome e cargo no topo
  const elNome = document.querySelector(".md-user-pill span:last-child");
  if(elNome) elNome.textContent = usuario.perfil.nome.split(" ")[0];
  const elCargo = document.querySelector(".md-chip");
  if(elCargo) elCargo.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">verified_user</span> ${tipo.toUpperCase()}`;

  return usuario;
}

document.addEventListener("DOMContentLoaded", () => {
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", logout);
});