// assets/js/utils.js — V15 (Corrigido e Estável)

// 1. NOTIFICAÇÕES (TOAST)
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon = type === "success" ? "check_circle" : type === "error" ? "error" : "warning";
  toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.5s ease-out forwards";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// Exportando para window
window.sucesso = (msg) => showToast(msg, "success");
window.erro = (msg) => showToast(msg, "error");
window.aviso = (msg) => showToast(msg, "warning");

// 2. MÁSCARAS DE INPUT
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el) return;

  // Máscara de CPF
  if (el.classList.contains("mask-cpf")) {
    let v = el.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    el.value = v;
  }
  
  // Máscara de Dinheiro
  if (el.classList.contains("mask-money")) {
    let v = el.value.replace(/\D/g, "");
    v = (Number(v) / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    el.value = "R$ " + v;
  }
  
  // Máscara de CEP
  if (el.classList.contains("mask-cep")) {
    let v = el.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    el.value = v;
  }
});

// 3. FUNÇÕES DE VALIDAÇÃO E FORMATAÇÃO

// Validador matemático de CPF
window.validarCPF = (cpf) => {
    if (!cpf) return false;
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(10, 11))) return false;
    
    return true;
};

// Formatar Data
window.formatarDataBR = (dataISO) => {
  if (!dataISO) return "-";
  try {
      const [ano, mes, dia] = dataISO.split("-");
      return `${dia}/${mes}/${ano}`;
  } catch (e) { return dataISO; }
};

// Formatar Pix para exibição (Tabelas e Recibos)
window.formatarPixInteligente = (chave) => {
  if (!chave) return "-";
  const limpo = chave.trim();
  
  if (limpo.includes("@")) return `E-mail: ${limpo}`;
  
  const soNumeros = limpo.replace(/\D/g, "");

  // Lógica de diferenciação: CPF vs Celular (Ambos 11 dígitos)
  if (soNumeros.length === 11) {
      if (window.validarCPF(soNumeros)) {
          // É CPF
          return `CPF: ${soNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
      } else {
          // É Celular
          return `Cel: ${soNumeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}`;
      }
  }
  
  if (soNumeros.length === 10) return `Tel: ${soNumeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")}`;
  
  if (soNumeros.length === 14) return `CNPJ: ${soNumeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;

  if (limpo.length > 20) return `Aleatória: ${limpo}`;
  
  return `Chave: ${limpo}`;
};

// Nova Função: Máscara para o INPUT (enquanto digita/sai do campo)
window.aplicarMascaraPixInput = (valor) => {
    if (!valor) return "";
    let limpo = valor.trim();
    
    if (limpo.includes("@")) return limpo;
    if (/[a-zA-Z]/.test(limpo) && limpo.length > 15) return limpo;

    let numeros = limpo.replace(/\D/g, "");

    // É CPF válido?
    if (numeros.length === 11 && window.validarCPF(numeros)) {
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    
    // É Celular?
    if (numeros.length === 11) {
        return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }

    // É Fixo?
    if (numeros.length === 10) {
        return numeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }

    // É CNPJ?
    if (numeros.length === 14) {
        return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    return limpo;
};

// 4. OUTRAS UTILIDADES
window.toggleMenu = () => {
  const sidebar = document.getElementById("main-sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar) sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("active");
};

window.buscarCEP = async (cepValue) => {
    if (!cepValue) return null;
    const cep = cepValue.replace(/\D/g, '');
    if (cep.length !== 8) return null;
    
    try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
        if (res.ok) {
            const data = await res.json();
            return { rua: data.street, bairro: data.neighborhood, cidade: data.city, uf: data.state };
        }
        throw new Error("BrasilAPI falhou");
    } catch (e) {
        try {
            const res2 = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (res2.ok) {
                const data2 = await res2.json();
                if (!data2.erro) {
                    return { rua: data2.logradouro, bairro: data2.bairro, cidade: data2.localidade, uf: data2.uf };
                }
            }
        } catch (err) { console.error("Erro CEP:", err); }
    }
    return null;
};