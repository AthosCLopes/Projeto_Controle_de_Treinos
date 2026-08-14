const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = 3000;
const JWT_SECRET = "troque_essa_chave_em_producao";

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "gym",
    waitForConnections: true,
    connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

// Serve arquivos estáticos (script.js, style.css)
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// =============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =============================================
function autenticar(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Token não informado" });
    }

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido ou expirado" });
        }
        req.usuarioId = payload.id;
        next();
    });
}

// =============================================
// AUTENTICAÇÃO
// =============================================

// POST /api/cadastro - Criar conta
app.post("/api/cadastro", async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res
                .status(400)
                .json({ error: "Nome, email e senha são obrigatórios" });
        }

        const [existentes] = await pool.execute(
            "SELECT id FROM usuarios WHERE email = ?",
            [email],
        );
        if (existentes.length > 0) {
            return res.status(409).json({ error: "Email já cadastrado" });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const [result] = await pool.execute(
            "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
            [nome, email, senhaHash],
        );

        res.status(201).json({
            message: "Conta criada com sucesso!",
            id: result.insertId,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/login - Autenticar e retornar token
app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res
                .status(400)
                .json({ error: "Email e senha são obrigatórios" });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM usuarios WHERE email = ?",
            [email],
        );
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const token = jwt.sign({ id: usuario.id }, JWT_SECRET, {
            expiresIn: "7d",
        });

        res.json({
            message: "Login realizado com sucesso!",
            token,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// SPLITS
// =============================================

// GET /api/splits - Listar splits do usuário logado
app.get("/api/splits", autenticar, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM splits WHERE usuario_id = ? ORDER BY data_criacao DESC",
            [req.usuarioId],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/splits - Criar split
app.post("/api/splits", autenticar, async (req, res) => {
    try {
        const { nome, descricao } = req.body;

        if (!nome) {
            return res.status(400).json({ error: "Nome é obrigatório" });
        }

        const [result] = await pool.execute(
            "INSERT INTO splits (usuario_id, nome, descricao) VALUES (?, ?, ?)",
            [req.usuarioId, nome, descricao || null],
        );

        res.status(201).json({
            message: "Split criado com sucesso!",
            id: result.insertId,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/splits/:id - Atualizar split
app.put("/api/splits/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao } = req.body;

        const [result] = await pool.execute(
            "UPDATE splits SET nome = ?, descricao = ? WHERE id = ? AND usuario_id = ?",
            [nome, descricao, id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Split não encontrado" });
        }

        res.json({ message: "Split atualizado com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/splits/:id - Excluir split
app.delete("/api/splits/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            "DELETE FROM splits WHERE id = ? AND usuario_id = ?",
            [id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Split não encontrado" });
        }

        res.json({ message: "Split excluído com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// DIAS DE TREINO
// =============================================

// GET /api/splits/:splitId/dias - Listar dias de treino de um split
app.get("/api/splits/:splitId/dias", autenticar, async (req, res) => {
    try {
        const { splitId } = req.params;

        // Garante que o split pertence ao usuário logado
        const [splitRows] = await pool.execute(
            "SELECT id FROM splits WHERE id = ? AND usuario_id = ?",
            [splitId, req.usuarioId],
        );
        if (splitRows.length === 0) {
            return res.status(404).json({ error: "Split não encontrado" });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM dias_treino WHERE split_id = ? ORDER BY ordem ASC, id ASC",
            [splitId],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/splits/:splitId/dias - Criar dia de treino
app.post("/api/splits/:splitId/dias", autenticar, async (req, res) => {
    try {
        const { splitId } = req.params;
        const { nome, ordem } = req.body;

        if (!nome) {
            return res.status(400).json({ error: "Nome é obrigatório" });
        }

        const [splitRows] = await pool.execute(
            "SELECT id FROM splits WHERE id = ? AND usuario_id = ?",
            [splitId, req.usuarioId],
        );
        if (splitRows.length === 0) {
            return res.status(404).json({ error: "Split não encontrado" });
        }

        const [result] = await pool.execute(
            "INSERT INTO dias_treino (split_id, nome, ordem) VALUES (?, ?, ?)",
            [splitId, nome, ordem || 0],
        );

        res.status(201).json({
            message: "Dia de treino criado com sucesso!",
            id: result.insertId,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/dias/:id - Atualizar dia de treino
app.put("/api/dias/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, ordem } = req.body;

        const [result] = await pool.execute(
            `UPDATE dias_treino dt
             JOIN splits s ON dt.split_id = s.id
             SET dt.nome = ?, dt.ordem = ?
             WHERE dt.id = ? AND s.usuario_id = ?`,
            [nome, ordem || 0, id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Dia de treino não encontrado" });
        }

        res.json({ message: "Dia de treino atualizado com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/dias/:id - Excluir dia de treino
app.delete("/api/dias/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            `DELETE dt FROM dias_treino dt
             JOIN splits s ON dt.split_id = s.id
             WHERE dt.id = ? AND s.usuario_id = ?`,
            [id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Dia de treino não encontrado" });
        }

        res.json({ message: "Dia de treino excluído com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// EXERCÍCIOS
// =============================================

// GET /api/dias/:diaId/exercicios - Listar exercícios de um dia de treino
app.get("/api/dias/:diaId/exercicios", autenticar, async (req, res) => {
    try {
        const { diaId } = req.params;

        const [diaRows] = await pool.execute(
            `SELECT dt.id FROM dias_treino dt
             JOIN splits s ON dt.split_id = s.id
             WHERE dt.id = ? AND s.usuario_id = ?`,
            [diaId, req.usuarioId],
        );
        if (diaRows.length === 0) {
            return res.status(404).json({ error: "Dia de treino não encontrado" });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM exercicios WHERE dia_treino_id = ? ORDER BY ordem ASC, id ASC",
            [diaId],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/dias/:diaId/exercicios - Criar exercício
app.post("/api/dias/:diaId/exercicios", autenticar, async (req, res) => {
    try {
        const { diaId } = req.params;
        const { nome, series, repeticoes, peso_atual, ordem } = req.body;

        if (!nome) {
            return res.status(400).json({ error: "Nome é obrigatório" });
        }

        const [diaRows] = await pool.execute(
            `SELECT dt.id FROM dias_treino dt
             JOIN splits s ON dt.split_id = s.id
             WHERE dt.id = ? AND s.usuario_id = ?`,
            [diaId, req.usuarioId],
        );
        if (diaRows.length === 0) {
            return res.status(404).json({ error: "Dia de treino não encontrado" });
        }

        const [result] = await pool.execute(
            `INSERT INTO exercicios (dia_treino_id, nome, series, repeticoes, peso_atual, ordem)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                diaId,
                nome,
                series || null,
                repeticoes || null,
                peso_atual || 0,
                ordem || 0,
            ],
        );

        res.status(201).json({
            message: "Exercício criado com sucesso!",
            id: result.insertId,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/exercicios/:id - Atualizar exercício (inclui peso atual)
app.put("/api/exercicios/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, series, repeticoes, peso_atual, ordem } = req.body;

        const [result] = await pool.execute(
            `UPDATE exercicios e
             JOIN dias_treino dt ON e.dia_treino_id = dt.id
             JOIN splits s ON dt.split_id = s.id
             SET e.nome = ?, e.series = ?, e.repeticoes = ?, e.peso_atual = ?, e.ordem = ?
             WHERE e.id = ? AND s.usuario_id = ?`,
            [nome, series, repeticoes, peso_atual, ordem || 0, id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Exercício não encontrado" });
        }

        res.json({ message: "Exercício atualizado com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/exercicios/:id - Excluir exercício
app.delete("/api/exercicios/:id", autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            `DELETE e FROM exercicios e
             JOIN dias_treino dt ON e.dia_treino_id = dt.id
             JOIN splits s ON dt.split_id = s.id
             WHERE e.id = ? AND s.usuario_id = ?`,
            [id, req.usuarioId],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Exercício não encontrado" });
        }

        res.json({ message: "Exercício excluído com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`💪 Backend rodando em http://localhost:${PORT}`);
    console.log(`📋 API: http://localhost:${PORT}/api`);
});