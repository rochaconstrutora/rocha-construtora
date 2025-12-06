// obras.js — V Final (Com Endereço Automático e Status Calculado)

if (document.getElementById("sec-obras")) {
    document.addEventListener("DOMContentLoaded", () => {
        carregarObras();
        
        // Listener para buscar CEP
        const cepInput = document.getElementById("obra-cep");
        if(cepInput) {
            cepInput.addEventListener("blur", async (e) => {
                aviso("Buscando CEP...");
                const dados = await buscarCEP(e.target.value);
                if(dados) {
                    document.getElementById("obra-rua").value = dados.rua || "";
                    document.getElementById("obra-bairro").value = dados.bairro || "";
                    document.getElementById("obra-cidade").value = dados.cidade || "";
                    document.getElementById("obra-estado").value = dados.uf || "";
                    document.getElementById("obra-numero").focus();
                    sucesso("Endereço preenchido!");
                } else {
                    erro("CEP não encontrado.");
                }
            });
        }
    });

    const form = document.getElementById("form-obras");
    
    async function carregarObras() {
        const listaObras = document.getElementById("lista-obras");
        listaObras.innerHTML = `<tr><td colspan="7" style="text-align:center">Carregando...</td></tr>`;
        const { data, error } = await supa.from("obras").select("*").order("nome");
        if (error || !data) { listaObras.innerHTML = `<tr><td colspan="7">Erro ao carregar obras.</td></tr>`; return; }
        
        listaObras.innerHTML = "";
        data.forEach(o => {
            const tr = document.createElement("tr");
            const inicioBR = formatarDataBR(o.data_inicio);
            const fimBR = formatarDataBR(o.data_fim);
            const perc = o.percentual || 0;
            const cidadeDisplay = o.cidade ? `${o.cidade}/${o.estado}` : "-";

            // CÁLCULO DE STATUS AUTOMÁTICO
            let statusAuto = "<span style='color:#64748b'>-</span>";
            if (o.data_inicio && o.data_fim) {
                const total = new Date(o.data_fim) - new Date(o.data_inicio);
                const passado = new Date() - new Date(o.data_inicio);
                const percEsperado = (passado / total) * 100;
                
                if (perc >= 100) statusAuto = "<span class='md-chip' style='background:#dcfce7; color:#166534'>Concluído</span>";
                else if (new Date() > new Date(o.data_fim)) statusAuto = "<span class='md-chip' style='background:#fee2e2; color:#b91c1c'>Atrasado</span>";
                else if ((percEsperado - perc) > 10) statusAuto = "<span class='md-chip' style='background:#fff7ed; color:#c2410c'>Atenção</span>";
                else statusAuto = "<span class='md-chip' style='background:#e0f2fe; color:#0369a1'>No Prazo</span>";
            }

            tr.innerHTML = `
                <td><strong>${o.nome}</strong></td>
                <td>${cidadeDisplay}</td>
                <td>${o.status === 'ativa' ? "<span style='color:green'>Ativa</span>" : "<span style='color:red'>Inativa</span>"}</td>
                <td><small>De: ${inicioBR}<br>Até: ${fimBR}</small></td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="font-weight:bold; font-size:12px;">${perc}%</div>
                        ${statusAuto}
                    </div>
                </td>
                <td class="actions-cell">
                    <button class="btn-primary btn-sm" onclick="editarObra('${o.id}')">Editar</button>
                    <button class="btn-danger btn-sm" onclick="excluirObra('${o.id}')">Excluir</button>
                </td>
            `;
            listaObras.appendChild(tr);
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const obraId = document.getElementById("obra-id").value;
        const dados = {
            nome: document.getElementById("obra-nome").value.trim(),
            cep: document.getElementById("obra-cep").value,
            rua: document.getElementById("obra-rua").value,
            bairro: document.getElementById("obra-bairro").value,
            numero: document.getElementById("obra-numero").value,
            cidade: document.getElementById("obra-cidade").value.trim(),
            estado: document.getElementById("obra-estado").value.toUpperCase().trim(),
            status: document.getElementById("obra-status").value,
            data_inicio: document.getElementById("obra-inicio").value || null,
            data_fim: document.getElementById("obra-fim").value || null,
            percentual: document.getElementById("obra-perc").value || 0
        };
        if (!dados.nome || !dados.cidade || !dados.estado) return aviso("Preencha Nome, Cidade e Estado.");
        
        let result;
        if (obraId) result = await supa.from("obras").update(dados).eq("id", obraId);
        else result = await supa.from("obras").insert([dados]);
        
        if (result.error) return erro("Erro: " + result.error.message);
        sucesso("Obra salva!");
        form.reset();
        document.getElementById("obra-id").value = "";
        carregarObras();
    });

    window.editarObra = async (id) => {
        const { data } = await supa.from("obras").select("*").eq("id", id).single();
        if (!data) return erro("Erro.");
        document.getElementById("obra-id").value = data.id;
        document.getElementById("obra-nome").value = data.nome;
        document.getElementById("obra-cep").value = data.cep || "";
        document.getElementById("obra-rua").value = data.rua || "";
        document.getElementById("obra-bairro").value = data.bairro || "";
        document.getElementById("obra-numero").value = data.numero || "";
        document.getElementById("obra-cidade").value = data.cidade;
        document.getElementById("obra-estado").value = data.estado;
        document.getElementById("obra-status").value = data.status || "ativa";
        document.getElementById("obra-inicio").value = data.data_inicio || "";
        document.getElementById("obra-fim").value = data.data_fim || "";
        document.getElementById("obra-perc").value = data.percentual || 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        aviso(`Editando: ${data.nome}`);
    };

    window.excluirObra = async (id) => {
        if (!confirm("Tem certeza?")) return;
        const { error } = await supa.from("obras").delete().eq("id", id);
        if (error) return erro("Erro ao excluir.");
        sucesso("Obra excluída!");
        carregarObras();
    };
}