CREATE DATABASE IF NOT EXISTS gym
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE gym;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS splits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_splits_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dias_treino (
    id INT AUTO_INCREMENT PRIMARY KEY,
    split_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ordem INT DEFAULT 0,
    CONSTRAINT fk_dias_treino_split
        FOREIGN KEY (split_id) REFERENCES splits(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exercicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dia_treino_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    series INT,
    repeticoes INT,
    peso_atual DECIMAL(6,2) DEFAULT 0,
    ordem INT DEFAULT 0,
    CONSTRAINT fk_exercicios_dia_treino
        FOREIGN KEY (dia_treino_id) REFERENCES dias_treino(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE INDEX idx_splits_usuario ON splits(usuario_id);
CREATE INDEX idx_dias_treino_split ON dias_treino(split_id);
CREATE INDEX idx_exercicios_dia_treino ON exercicios(dia_treino_id);