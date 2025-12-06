// ==========================================================
// reset.js — Página de Redefinição de Senha (Versão Final)
// ==========================================================

document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("reset-status");
  const form = document.getElementById("reset-form");
  const inputSenha = document.getElementById("nova-senha");
  const inputConfirma = document.getElementById("confirma-senha");

  try {
    const { data, error } = await supa.auth.getUser();
    if (error || !data || !data.user) {
      console.error("Erro ou usuário não encontrado na sessão de reset:", error);
      statusEl.textContent = "Link inválido ou expirado. Solicite uma nova redefinição.";
      form.style.display = "none";
      return;
    }

    const email = data.user.email || "";
    statusEl.textContent = `Defina uma nova senha para o usuário ${email}.`;
    form.style.display = "block";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const senha = inputSenha.value.trim();
      const confirma = inputConfirma.value.trim();

      if (!senha || senha.length < 6) {
        aviso("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }

      if (senha !== confirma) {
        aviso("A confirmação da senha não confere.");
        return;
      }

      const { error: updError } = await supa.auth.updateUser({ password: senha });

      if (updError) {
        erro("Erro ao redefinir senha: " + updError.message);
        console.error(updError);
        return;
      }

      sucesso("Senha redefinida com sucesso! Você já pode entrar com a nova senha.");
      
      // Atraso para o usuário ver a notificação de sucesso antes de sair da página
      setTimeout(() => { 
        window.location.href = "login.html"; 
      }, 1500); 
    });
  } catch (e) {
    console.error("Erro inesperado ao inicializar página de reset:", e);
    statusEl.textContent = "Erro ao processar o link de redefinição. Tente solicitar novamente.";
    form.style.display = "none";
  }
});