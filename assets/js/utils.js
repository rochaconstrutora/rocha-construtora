// assets/js/utils.js — V17 (Modal Confirmação + Busca + Loading + Mostrar Seção)

// ============================================================
// 1. NOTIFICAÇÕES (TOAST)
// ============================================================
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.textContent =
    type === "success" ? "check_circle" :
    type === "error"   ? "error" :
                         "warning";

  const msg = document.createElement("span");
  msg.style.flex = "1";
  msg.textContent = String(message ?? "");

  toast.appendChild(icon);
  toast.appendChild(msg);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

window.sucesso = (msg) => showToast(msg, "success");
window.erro    = (msg) => showToast(msg, "error");
window.aviso   = (msg) => showToast(msg, "warning");

// ============================================================
// 2. MODAL DE CONFIRMAÇÃO (substitui confirm() nativo)
// ============================================================
window.confirmar = (mensagem, titulo = "Confirmar ação", onConfirm, onCancel) => {
  let overlay = document.getElementById("modal-confirmar");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "modal-confirmar";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-icon">
          <span class="material-symbols-outlined">warning</span>
        </div>
        <h3 class="modal-title" id="modal-titulo">Confirmar</h3>
        <p  class="modal-msg"   id="modal-mensagem"></p>
        <div class="modal-actions">
          <button class="btn-secondary" id="modal-btn-cancelar">Cancelar</button>
          <button class="btn-danger"    id="modal-btn-confirmar">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  document.getElementById("modal-titulo").textContent   = titulo;
  document.getElementById("modal-mensagem").textContent = mensagem;
  overlay.classList.add("active");

  const btnConf   = document.getElementById("modal-btn-confirmar");
  const btnCancel = document.getElementById("modal-btn-cancelar");

  const fechar = () => overlay.classList.remove("active");

  const cloneConf   = btnConf.cloneNode(true);
  const cloneCancel = btnCancel.cloneNode(true);
  btnConf.replaceWith(cloneConf);
  btnCancel.replaceWith(cloneCancel);

  cloneConf.addEventListener("click", () => { fechar(); if (typeof onConfirm === "function") onConfirm(); });
  cloneCancel.addEventListener("click", () => { fechar(); if (typeof onCancel === "function") onCancel(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); }, { once: true });
};

// ============================================================
// 3. LOADING STATE EM BOTÕES
// ============================================================
window.setBtnLoading = (btn, loading) => {
  if (!btn) return;
  if (loading) {
    btn.dataset.textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("btn-loading");
  } else {
    btn.disabled = false;
    btn.classList.remove("btn-loading");
    if (btn.dataset.textoOriginal) btn.innerHTML = btn.dataset.textoOriginal;
  }
};

// ============================================================
// 4. NAVEGAÇÃO ENTRE SEÇÕES (mostrarSecao)
// ============================================================
window.mostrarSecao = (nome) => {
  document.querySelectorAll(".md-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".menu-item[data-target]").forEach(m => m.classList.remove("active"));

  const sec = document.getElementById(`sec-${nome}`);
  if (sec) sec.classList.add("active");

  const menuItem = document.querySelector(`.menu-item[data-target="${nome}"]`);
  if (menuItem) menuItem.classList.add("active");

  // Atualiza breadcrumb no header
  const bc = document.getElementById("header-breadcrumb");
  if (bc && menuItem) {
    const span = menuItem.querySelector("span:last-child");
    bc.textContent = span ? span.textContent : nome;
  }

  // Fecha sidebar no mobile
  const sidebar = document.getElementById("main-sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  }

  // Scroll para topo do conteúdo
  const content = document.querySelector(".md-content");
  if (content) content.scrollTop = 0;
};

// ============================================================
// 5. MÁSCARAS DE INPUT
// ============================================================
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el) return;

  if (el.classList.contains("mask-cpf")) {
    let v = el.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    el.value = v;
  }

  if (el.classList.contains("mask-money")) {
    let v = el.value.replace(/\D/g, "");
    v = (Number(v) / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    el.value = "R$ " + v;
  }

  if (el.classList.contains("mask-cep")) {
    let v = el.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    el.value = v;
  }
});

// ============================================================
// 6. VALIDAÇÕES
// ============================================================
window.validarCPF = (cpf) => {
  if (!cpf) return false;
  cpf = cpf.replace(/[^\d]+/g, "");
  if (!cpf || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.substring(10, 11));
};

// ============================================================
// 7. FORMATAÇÃO
// ============================================================
window.formatarDataBR = (dataISO) => {
  if (!dataISO) return "-";
  try {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
  } catch (e) { return dataISO; }
};

window.formatarPixInteligente = (chave) => {
  if (!chave) return "-";
  const limpo = chave.trim();
  if (limpo.includes("@")) return `E-mail: ${limpo}`;
  const soNumeros = limpo.replace(/\D/g, "");
  if (soNumeros.length === 11) {
    if (window.validarCPF(soNumeros)) return `CPF: ${soNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
    return `Cel: ${soNumeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}`;
  }
  if (soNumeros.length === 10) return `Tel: ${soNumeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")}`;
  if (soNumeros.length === 14) return `CNPJ: ${soNumeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;
  if (limpo.length > 20) return `Aleatória: ${limpo}`;
  return `Chave: ${limpo}`;
};

window.aplicarMascaraPixInput = (valor) => {
  if (!valor) return "";
  let limpo = valor.trim();
  if (limpo.includes("@")) return limpo;
  if (/[a-zA-Z]/.test(limpo) && limpo.length > 15) return limpo;
  let numeros = limpo.replace(/\D/g, "");
  if (numeros.length === 11 && window.validarCPF(numeros)) return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (numeros.length === 11) return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (numeros.length === 10) return numeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  if (numeros.length === 14) return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return limpo;
};

// ============================================================
// 8. SEGURANÇA (ANTI-XSS)
// ============================================================
window.escapeHtml = (input = "") => {
  const s = String(input);
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
};

window.sanitizeUrl = (url = "") => {
  try {
    const u = String(url || "").trim();
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("data:image/")) return u;
    if (u.startsWith("blob:")) return u;
  } catch (e) {}
  return "";
};

// ============================================================
// 9. DATAS (FUSO BRASIL)
// ============================================================
window.hojeLocalISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

window.mesLocalISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 7);
};

// ============================================================
// 10. FOTOS / STORAGE (SignedURL)
// ============================================================
window.parseFotosCampo = (campo) => {
  if (!campo) return [];
  if (Array.isArray(campo)) return campo.filter(Boolean);
  const raw = String(campo);
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter(Boolean);
  } catch (e) {}
  return raw ? [raw] : [];
};

window.resolverUrlFotoDiario = async (bucket, pathOuUrl, expiresIn = 3600) => {
  if (!pathOuUrl) return "";
  const s = String(pathOuUrl);
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:image/") || s.startsWith("blob:")) {
    return window.sanitizeUrl(s);
  }
  try {
    const { data, error } = await supa.storage.from(bucket).createSignedUrl(s, expiresIn);
    if (error) return "";
    return window.sanitizeUrl(data?.signedUrl || "");
  } catch (e) { return ""; }
};

// ============================================================
// 11. TOGGLE MENU SIDEBAR
// ============================================================
window.toggleMenu = () => {
  const sidebar = document.getElementById("main-sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar) sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("active");
};

// ============================================================
// 12. BUSCA DE CEP
// ============================================================
window.buscarCEP = async (cepValue) => {
  if (!cepValue) return null;
  const cep = cepValue.replace(/\D/g, "");
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
        if (!data2.erro) return { rua: data2.logradouro, bairro: data2.bairro, cidade: data2.localidade, uf: data2.uf };
      }
    } catch (err) { console.error("Erro CEP:", err); }
  }
  return null;
};

// ============================================================
// 13. FILTRO DE TABELA (busca em tempo real)
// ============================================================
window.filtrarTabela = (inputId, tbodyId) => {
  const input = document.getElementById(inputId);
  const tbody = document.getElementById(tbodyId);
  if (!input || !tbody) return;

  input.addEventListener("input", () => {
    const termo = input.value.toLowerCase().trim();
    const rows = tbody.querySelectorAll("tr");
    let visiveis = 0;
    rows.forEach(row => {
      const texto = row.textContent.toLowerCase();
      const mostrar = !termo || texto.includes(termo);
      row.style.display = mostrar ? "" : "none";
      if (mostrar) visiveis++;
    });

    // Contador
    const countEl = document.getElementById(`count-${tbodyId}`);
    if (countEl) countEl.textContent = `${visiveis} registro(s)`;
  });
};

// ============================================================
// 14. BADGE MATERIAIS PENDENTES (header)
// ============================================================
window.atualizarBadgeMateriais = async () => {
  try {
    const { count } = await supa.from("solicitacoes_materiais")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pendente");

    const badge = document.getElementById("badge-materiais");
    if (!badge) return;
    if (count && count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.style.display = "inline";
    } else {
      badge.style.display = "none";
    }
  } catch (e) {}
};

// ============================================================
// 15. LOGOUT (event listener)
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", logout);
});
