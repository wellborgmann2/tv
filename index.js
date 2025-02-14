import express from 'express';
import http from 'http';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import { Client } from "ssh2";
import retry from "async-retry";
import { exec } from "child_process";
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express(); 
const server = http.createServer(app);
const streamPipeline = promisify(pipeline);

const connSettings = {
    host: process.env.IP_SSH,
    port: 22,
    username: process.env.USER_SSH,
    password: process.env.PASS_SSH,
    readyTimeout: 30000,
};

async function executeSSHCommand(command) {
    return retry(async (bail) => {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let dataReceived = "";

            conn.on("error", (err) => {
                console.error("Erro na conexão SSH:", err);
                conn.end();
                bail(err);
            });

            conn.on("ready", () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }
                    stream
                        .on("close", () => {
                            conn.end();
                            resolve(dataReceived.trim());
                        })
                        .on("data", (data) => {
                            dataReceived += data.toString();
                        })
                        .stderr.on("data", (data) => {
                            console.error("STDERR:", data.toString());
                        });
                });
            }).connect(connSettings);
        });
    }, {
        retries: 3,
        minTimeout: 2000,
    });
}

async function checkLoginExists(loginName) {
    let comando = `chage -l ${loginName} | grep -E 'Account expires' | cut -d ' ' -f3-`;
    try {
        const dataReceived = await executeSSHCommand(comando);
        return {
            exists: !!dataReceived, 
            data: dataReceived || null
        };
    } catch (error) {
        console.error("Erro ao verificar login:", error);
        return { exists: false, data: null };
    }
}

app.get("/checkuser", async (req, res) => {
    const login = req.query?.login;
    if (!login) {
        return res.status(400).send({ error: "Parâmetro 'login' ausente" });
    }
    try {
        const { data, exists } = await checkLoginExists(login);
        if (!exists) {
            return res.status(404).send({ error: "Usuário não encontrado" });
        }
        const dias = diferencaEmDias(data);
        const validade = validadeFormatada(data);
        res.json({ login, dias, validade });
    } catch (error) {
        console.error("Erro na API:", error);
        res.status(500).send({ error: "Erro interno do servidor" });
    }
});


app.get("/iptv", (req, res) => {
  res.sendFile("iptv.html", { root: "views" });
});

function validadeFormatada(data) {
    const futuro = new Date(data);
    const dia = futuro.getDate().toString().padStart(2, "0");
    const mes = (futuro.getMonth() + 1).toString().padStart(2, "0");
    const ano = futuro.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function diferencaEmDias(dataISO) {
    const dataTimestamp = new Date(dataISO);
    const dataAtual = new Date();
    const diferencaMilissegundos = dataTimestamp.getTime() - dataAtual.getTime();
    return Math.round(diferencaMilissegundos / (1000 * 60 * 60 * 24));
}

app.get('/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "Parâmetro 'url' ausente" });
    }
    
    try {
        const response = await axios({
            method: 'get',
            url,
            responseType: 'stream',
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Mantém o mesmo Content-Type da resposta original
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');

        await streamPipeline(response.data, res);
    } catch (error) {
        console.error("Erro ao baixar arquivo:", error);
        res.status(500).json({ error: "Erro ao baixar o arquivo" });
    }
});


server.listen(8000, () => {
    console.log("Server is running on http://localhost:8000");
});
