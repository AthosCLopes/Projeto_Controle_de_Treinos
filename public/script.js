const API = "http://localhost:3000/api";
const TOKEN_KEY = "treino_token";
const USUARIO_KEY = "treino_usuario";

// =============================================================
// SESSÃO / AUTENTICAÇÃO
// =============================================================

function salvarSessao(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

function obterToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function obterUsuario() {
    const raw = localStorage.getItem(USUARIO_KEY);
    return raw ? JSON.parse(raw) : null;
}

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = "login.html";
}

// Chama no topo de páginas protegidas. Redireciona se não houver sessão.
function exigirAutenticacao() {
    if (!obterToken()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

// Wrapper de fetch que injeta o token e trata erros padronizados
async function apiFetch(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const token = obterToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API}${endpoint}`, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error("Sessão expirada. Faça login novamente.");
    }

    let body = null;
    try {
        body = await res.json();
    } catch (_) {
        // resposta sem corpo
    }

    if (!res.ok) {
        throw new Error(body?.error || "Erro inesperado. Tente novamente.");
    }

    return body;
}

// =============================================================
// HELPERS DE UI
// =============================================================

function escapeHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function mostrarErro(elId, mensagem) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = mensagem;
    el.classList.add("visible");
}

function limparErro(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = "";
    el.classList.remove("visible");
}

function abrirModal(id) {
    document.getElementById(id)?.classList.add("visible");
}

function fecharModal(id) {
    document.getElementById(id)?.classList.remove("visible");
}

function getQueryParam(nome) {
    return new URLSearchParams(window.location.search).get(nome);
}

// =============================================================
// PÁGINA: LOGIN / CADASTRO
// =============================================================

function initLogin() {
    // Se já estiver logado, vai direto para os splits
    if (obterToken()) {
        window.location.href = "splits.html";
        return;
    }

    const tabLogin = document.getElementById("tab-login");
    const tabCadastro = document.getElementById("tab-cadastro");
    const formLogin = document.getElementById("form-login");
    const formCadastro = document.getElementById("form-cadastro");

    tabLogin?.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabCadastro.classList.remove("active");
        formLogin.classList.add("active");
        formCadastro.classList.remove("active");
    });

    tabCadastro?.addEventListener("click", () => {
        tabCadastro.classList.add("active");
        tabLogin.classList.remove("active");
        formCadastro.classList.add("active");
        formLogin.classList.remove("active");
    });

    formLogin?.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparErro("login-error");

        const email = document.getElementById("login-email").value.trim();
        const senha = document.getElementById("login-senha").value;

        try {
            const data = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({ email, senha }),
            });
            salvarSessao(data.token, data.usuario);
            window.location.href = "splits.html";
        } catch (err) {
            mostrarErro("login-error", err.message);
        }
    });

    formCadastro?.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparErro("cadastro-error");

        const nome = document.getElementById("cadastro-nome").value.trim();
        const email = document.getElementById("cadastro-email").value.trim();
        const senha = document.getElementById("cadastro-senha").value;

        try {
            await apiFetch("/cadastro", {
                method: "POST",
                body: JSON.stringify({ nome, email, senha }),
            });
            // Após criar a conta, faz login automaticamente
            const data = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({ email, senha }),
            });
            salvarSessao(data.token, data.usuario);
            window.location.href = "splits.html";
        } catch (err) {
            mostrarErro("cadastro-error", err.message);
        }
    });
}

// =============================================================
// PÁGINA: SPLITS
// =============================================================

function initSplits() {
    if (!exigirAutenticacao()) return;

    const usuario = obterUsuario();
    const nomeEl = document.getElementById("usuario-nome");
    if (nomeEl && usuario) nomeEl.textContent = usuario.nome;

    document.getElementById("logout-btn")?.addEventListener("click", logout);

    const container = document.getElementById("splits-container");
    const form = document.getElementById("split-form");

    async function carregarSplits() {
        container.innerHTML = `<div class="loading-state">Carregando splits...</div>`;
        try {
            const splits = await apiFetch("/splits");

            if (splits.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <strong>Nenhum split ainda</strong>
                        Crie o primeiro para organizar seus dias de treino.
                    </div>`;
                return;
            }

            container.innerHTML = splits
                .map(
                    (s) => `
                    <div class="entity-card" data-id="${s.id}">
                        <div class="entity-card-title">${escapeHtml(s.nome)}</div>
                        <div class="entity-card-desc">${escapeHtml(s.descricao || "Sem descrição")}</div>
                        <div class="entity-card-actions">
                            <button class="btn btn-outline btn-sm" onclick="abrirSplit(${s.id}, '${escapeHtml(s.nome).replace(/'/g, "&#39;")}')">Ver dias</button>
                            <button class="icon-btn btn-sm" title="Excluir" onclick="excluirSplit(event, ${s.id})">✕</button>
                        </div>
                    </div>`,
                )
                .join("");
        } catch (err) {
            container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
        }
    }

    window.abrirSplit = function (id, nome) {
        window.location.href = `dias.html?split_id=${id}&split_nome=${encodeURIComponent(nome)}`;
    };

    window.excluirSplit = async function (event, id) {
        event.stopPropagation();
        if (!confirm("Excluir este split? Todos os dias e exercícios dele também serão apagados.")) return;
        try {
            await apiFetch(`/splits/${id}`, { method: "DELETE" });
            carregarSplits();
        } catch (err) {
            alert(err.message);
        }
    };

    document.getElementById("novo-split-btn")?.addEventListener("click", () => {
        form.reset();
        limparErro("split-error");
        abrirModal("split-modal");
    });

    document.getElementById("split-modal-close")?.addEventListener("click", () => {
        fecharModal("split-modal");
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparErro("split-error");

        const nome = document.getElementById("split-nome").value.trim();
        const descricao = document.getElementById("split-descricao").value.trim();

        try {
            await apiFetch("/splits", {
                method: "POST",
                body: JSON.stringify({ nome, descricao }),
            });
            fecharModal("split-modal");
            carregarSplits();
        } catch (err) {
            mostrarErro("split-error", err.message);
        }
    });

    carregarSplits();
}

// =============================================================
// PÁGINA: DIAS DE TREINO
// =============================================================

function initDias() {
    if (!exigirAutenticacao()) return;

    const splitId = getQueryParam("split_id");
    const splitNome = getQueryParam("split_nome") || "Split";

    if (!splitId) {
        window.location.href = "splits.html";
        return;
    }

    document.getElementById("split-nome-titulo").textContent = splitNome;
    document.getElementById("logout-btn")?.addEventListener("click", logout);

    const container = document.getElementById("dias-container");
    const form = document.getElementById("dia-form");

    async function carregarDias() {
        container.innerHTML = `<div class="loading-state">Carregando dias de treino...</div>`;
        try {
            const dias = await apiFetch(`/splits/${splitId}/dias`);

            if (dias.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <strong>Nenhum dia de treino ainda</strong>
                        Adicione um, como "Perna" ou "Peito e Ombro".
                    </div>`;
                return;
            }

            container.innerHTML = dias
                .map(
                    (d) => `
                    <div class="entity-card" data-id="${d.id}">
                        <div class="entity-card-title">${escapeHtml(d.nome)}</div>
                        <div class="entity-card-actions">
                            <button class="btn btn-outline btn-sm" onclick="abrirDia(${d.id}, '${escapeHtml(d.nome).replace(/'/g, "&#39;")}')">Ver exercícios</button>
                            <button class="icon-btn btn-sm" title="Excluir" onclick="excluirDia(event, ${d.id})">✕</button>
                        </div>
                    </div>`,
                )
                .join("");
        } catch (err) {
            container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
        }
    }

    window.abrirDia = function (id, nome) {
        window.location.href = `exercicios.html?dia_id=${id}&dia_nome=${encodeURIComponent(nome)}&split_id=${splitId}&split_nome=${encodeURIComponent(splitNome)}`;
    };

    window.excluirDia = async function (event, id) {
        event.stopPropagation();
        if (!confirm("Excluir este dia de treino? Os exercícios dele também serão apagados.")) return;
        try {
            await apiFetch(`/dias/${id}`, { method: "DELETE" });
            carregarDias();
        } catch (err) {
            alert(err.message);
        }
    };

    document.getElementById("novo-dia-btn")?.addEventListener("click", () => {
        form.reset();
        limparErro("dia-error");
        abrirModal("dia-modal");
    });

    document.getElementById("dia-modal-close")?.addEventListener("click", () => {
        fecharModal("dia-modal");
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparErro("dia-error");

        const nome = document.getElementById("dia-nome").value.trim();

        try {
            await apiFetch(`/splits/${splitId}/dias`, {
                method: "POST",
                body: JSON.stringify({ nome }),
            });
            fecharModal("dia-modal");
            carregarDias();
        } catch (err) {
            mostrarErro("dia-error", err.message);
        }
    });

    carregarDias();
}

// =============================================================
// PÁGINA: EXERCÍCIOS
// =============================================================

function initExercicios() {
    if (!exigirAutenticacao()) return;

    const diaId = getQueryParam("dia_id");
    const diaNome = getQueryParam("dia_nome") || "Treino";
    const splitId = getQueryParam("split_id");
    const splitNome = getQueryParam("split_nome") || "Split";

    if (!diaId) {
        window.location.href = "splits.html";
        return;
    }

    document.getElementById("dia-nome-titulo").textContent = diaNome;

    const linkSplit = document.getElementById("breadcrumb-split");
    if (linkSplit) {
        linkSplit.textContent = splitNome;
        linkSplit.href = `dias.html?split_id=${splitId}&split_nome=${encodeURIComponent(splitNome)}`;
    }

    document.getElementById("logout-btn")?.addEventListener("click", logout);

    const container = document.getElementById("exercicios-container");
    const form = document.getElementById("exercicio-form");

    async function carregarExercicios() {
        container.innerHTML = `<div class="loading-state">Carregando exercícios...</div>`;
        try {
            const exercicios = await apiFetch(`/dias/${diaId}/exercicios`);

            if (exercicios.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <strong>Nenhum exercício ainda</strong>
                        Adicione o primeiro exercício deste treino.
                    </div>`;
                return;
            }

            container.innerHTML = exercicios
                .map(
                    (ex) => `
                    <div class="exercise-row" data-id="${ex.id}">
                        <div class="exercise-info">
                            <div class="exercise-name">${escapeHtml(ex.nome)}</div>
                            <div class="exercise-meta">${ex.series ?? "-"} séries × ${ex.repeticoes ?? "-"} reps</div>
                        </div>
                        <div class="weight-badge">
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                value="${ex.peso_atual}"
                                onchange="atualizarPeso(${ex.id}, this.value)"
                            />
                            <span>kg</span>
                        </div>
                        <button class="icon-btn btn-sm" title="Excluir" onclick="excluirExercicio(${ex.id})">✕</button>
                    </div>`,
                )
                .join("");
        } catch (err) {
            container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
        }
    }

    window.atualizarPeso = async function (id, novoPeso) {
        try {
            // Busca dados atuais do exercício na tela para não sobrescrever nome/series/reps
            const linha = document.querySelector(`.exercise-row[data-id="${id}"]`);
            const nome = linha.querySelector(".exercise-name").textContent;
            const [seriesTxt, repsTxt] = linha
                .querySelector(".exercise-meta")
                .textContent.split("×")
                .map((t) => t.trim());
            const series = parseInt(seriesTxt) || null;
            const repeticoes = parseInt(repsTxt) || null;

            await apiFetch(`/exercicios/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    nome,
                    series,
                    repeticoes,
                    peso_atual: parseFloat(novoPeso) || 0,
                }),
            });
        } catch (err) {
            alert(err.message);
            carregarExercicios();
        }
    };

    window.excluirExercicio = async function (id) {
        if (!confirm("Excluir este exercício?")) return;
        try {
            await apiFetch(`/exercicios/${id}`, { method: "DELETE" });
            carregarExercicios();
        } catch (err) {
            alert(err.message);
        }
    };

    document.getElementById("novo-exercicio-btn")?.addEventListener("click", () => {
        form.reset();
        limparErro("exercicio-error");
        abrirModal("exercicio-modal");
    });

    document.getElementById("exercicio-modal-close")?.addEventListener("click", () => {
        fecharModal("exercicio-modal");
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparErro("exercicio-error");

        const nome = document.getElementById("exercicio-nome").value.trim();
        const series = parseInt(document.getElementById("exercicio-series").value) || null;
        const repeticoes = parseInt(document.getElementById("exercicio-repeticoes").value) || null;
        const peso_atual = parseFloat(document.getElementById("exercicio-peso").value) || 0;

        try {
            await apiFetch(`/dias/${diaId}/exercicios`, {
                method: "POST",
                body: JSON.stringify({ nome, series, repeticoes, peso_atual }),
            });
            fecharModal("exercicio-modal");
            carregarExercicios();
        } catch (err) {
            mostrarErro("exercicio-error", err.message);
        }
    });

    carregarExercicios();
}

// =============================================================
// ROTEAMENTO POR PÁGINA
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
    const pagina = document.body.dataset.page;

    switch (pagina) {
        case "login":
            initLogin();
            break;
        case "splits":
            initSplits();
            break;
        case "dias":
            initDias();
            break;
        case "exercicios":
            initExercicios();
            break;
        default:
            console.warn("Atributo data-page não definido ou desconhecido no <body>.");
    }
});