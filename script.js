// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

"use strict";

const WEBSERVICE = "get.php"; // relativo: funciona em qualquer servidor
const CHAVE_PROGRESSO = "letradeiro_progresso";
const CHAVE_TEMA = "letradeiro_tema";
const MAX_LETRAS = 20;

let dadosJogo = null;
let progresso = { data: "", id: "", encontradas: [] };
let tentativa = "";

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------
 * Armazenamento local (pode falhar em aba anônima ou com bloqueio de
 * cookies; o jogo continua funcionando, só não lembra o progresso)
 * ------------------------------------------------------------------ */

function lerStorage(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarStorage(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: segue o jogo */
  }
}

function removerStorage(chave) {
  try {
    localStorage.removeItem(chave);
  } catch {
    /* idem */
  }
}

function salvar() {
  gravarStorage(CHAVE_PROGRESSO, JSON.stringify(progresso));
}

/* ------------------------------------------------------------------
 * Tema: na primeira visita segue o do sistema; depois, a escolha salva
 * ------------------------------------------------------------------ */

function temaAtual() {
  const salvo = lerStorage(CHAVE_TEMA);
  if (salvo === "dark" || salvo === "light") return salvo;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema() {
  const escuro = temaAtual() === "dark";
  document.body.classList.toggle("dark-mode", escuro);

  const btn = $("btn-tema");
  btn.textContent = escuro ? "☀️" : "🌙";
  btn.setAttribute("aria-label", escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro");
}

function alternarTema() {
  gravarStorage(CHAVE_TEMA, document.body.classList.contains("dark-mode") ? "light" : "dark");
  aplicarTema();
}

/* ------------------------------------------------------------------
 * Mensagens (texto sempre via textContent, nunca HTML)
 * ------------------------------------------------------------------ */

function mostrarMensagem(texto, tipo) {
  const el = $("mensagem");
  el.replaceChildren();
  if (!texto) {
    el.textContent = " ";
    return;
  }
  const span = document.createElement("span");
  span.className = `msg-${tipo}`;
  span.textContent = texto;
  el.appendChild(span);
}

/* ------------------------------------------------------------------
 * Inicialização
 * ------------------------------------------------------------------ */

async function iniciar() {
  aplicarTema();
  ligarEventos();

  try {
    const response = await fetch(WEBSERVICE, { cache: "no-store" });
    const dados = await response.json();
    if (!response.ok || !Array.isArray(dados.respostas)) {
      throw new Error(dados.erro || `HTTP ${response.status}`);
    }
    dadosJogo = dados;
  } catch (e) {
    console.error(e);
    mostrarMensagem("⚠️ Não consegui carregar o desafio. Tente de novo em instantes.", "erro");
    return;
  }

  $("total").textContent = dadosJogo.respostas.length;

  // Progresso salvo só vale se for do mesmo desafio
  let salvo = null;
  try {
    salvo = JSON.parse(lerStorage(CHAVE_PROGRESSO));
  } catch {
    salvo = null; // dado corrompido: começa do zero
  }

  if (salvo && salvo.id === dadosJogo.id && Array.isArray(salvo.encontradas)) {
    progresso = salvo;
  } else {
    progresso = { data: dadosJogo.data, id: dadosJogo.id, encontradas: [] };
    salvar();
  }

  renderizarLetras();
  atualizarLista();
}

function ligarEventos() {
  $("btn-tema").addEventListener("click", alternarTema);
  $("btn-apagar").addEventListener("click", apagar);
  $("btn-mix").addEventListener("click", renderizarLetras);
  $("btn-enviar").addEventListener("click", enviar);
  $("btn-gabarito").addEventListener("click", verGabarito);
  $("btn-fechar-gabarito").addEventListener("click", fecharModais);
  $("btn-abrir-reset").addEventListener("click", abrirModalReset);
  $("btn-cancelar-reset").addEventListener("click", fecharModais);
  $("form-reset").addEventListener("submit", confirmarReset);
  document.addEventListener("keydown", tratarTeclado);
}

/* ------------------------------------------------------------------
 * Roda de letras
 * ------------------------------------------------------------------ */

function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function criarLetra(letra, classe, rotulo, x, y) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = classe;
  b.textContent = letra.toUpperCase();
  b.setAttribute("aria-label", rotulo);
  if (x !== undefined) {
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
  }
  b.addEventListener("click", () => addLetra(letra));
  return b;
}

function renderizarLetras() {
  if (!dadosJogo) return;

  const wheel = $("wheel");
  const chave = dadosJogo.chave;
  const outras = embaralhar(dadosJogo.letras.filter((l) => l !== chave));

  wheel.replaceChildren(criarLetra(chave, "hex chave", `Letra central ${chave.toUpperCase()}`));

  outras.forEach((l, i) => {
    const angulo = i * 60 * (Math.PI / 180);
    const x = 102.5 + 90 * Math.cos(angulo);
    const y = 102.5 + 90 * Math.sin(angulo);
    wheel.appendChild(criarLetra(l, "hex", `Letra ${l.toUpperCase()}`, x, y));
  });
}

/* ------------------------------------------------------------------
 * Montagem e envio da palavra
 * ------------------------------------------------------------------ */

function atualizarTentativa() {
  $("palavra-atual").textContent = tentativa.toUpperCase();
}

function addLetra(l) {
  if (tentativa.length >= MAX_LETRAS) return;
  tentativa += l;
  atualizarTentativa();
}

function apagar() {
  tentativa = tentativa.slice(0, -1);
  atualizarTentativa();
}

/** Usa as 7 letras? (as respostas só contêm letras do desafio) */
function ehPangrama(p) {
  return new Set(p).size === 7;
}

function enviar() {
  if (!dadosJogo) return;

  const p = tentativa.toLowerCase();
  const P = p.toUpperCase();
  tentativa = "";
  atualizarTentativa();

  if (!p) return;

  // As mensagens dizem o motivo: o jogador aprende as regras jogando
  if (p.length < 3) {
    mostrarMensagem(`❌ ${P}: muito curta (mínimo 3 letras)`, "erro");
  } else if (!p.includes(dadosJogo.chave)) {
    mostrarMensagem(`❌ ${P}: falta a letra central (${dadosJogo.chave.toUpperCase()})`, "erro");
  } else if (progresso.encontradas.includes(p)) {
    mostrarMensagem(`🔁 ${P}: você já encontrou`, "aviso");
  } else if (!dadosJogo.respostas.includes(p)) {
    mostrarMensagem(`❌ ${P}: não está na lista`, "erro");
  } else {
    progresso.encontradas.push(p);
    salvar();
    atualizarLista();

    if (progresso.encontradas.length === dadosJogo.respostas.length) {
      dispararFestinha();
      mostrarMensagem(`🏆 ${P}: desafio concluído!`, "concluido");
    } else if (ehPangrama(p)) {
      dispararFestinha();
      mostrarMensagem(`🌟 ${P}: PANGRAMA!`, "pangrama");
    } else {
      mostrarMensagem(`👍 ${P}`, "sucesso");
    }

    $(`word-${p}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  window.scrollTo(0, 0);
}

function dispararFestinha() {
  if (typeof confetti !== "function") return; // biblioteca não carregou: sem festa, mas sem erro
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#ff75c8", "#f7da21", "#4caf50", "#add8e6"],
    disableForReducedMotion: true,
  });
}

/* ------------------------------------------------------------------
 * Lista de palavras
 * ------------------------------------------------------------------ */

function atualizarLista() {
  const encontradas = progresso.encontradas.length;
  const total = dadosJogo.respostas.length;

  $("count").textContent = encontradas;
  $("progress-bar").style.width = `${(encontradas / total) * 100}%`;

  const ordenadas = [...dadosJogo.respostas].sort((a, b) =>
    a.length !== b.length ? a.length - b.length : a.localeCompare(b, "pt-BR"),
  );

  const itens = ordenadas.map((p) => {
    const li = document.createElement("li");
    li.id = `word-${p}`;
    li.style.setProperty("--tamanho-palavra", p.length);

    if (progresso.encontradas.includes(p)) {
      li.textContent = p;
      if (ehPangrama(p)) li.classList.add("pangrama");
    } else {
      li.className = "oculta";
      li.textContent = `${p.length} letras`;
    }
    return li;
  });

  $("lista").replaceChildren(...itens);
}

/* ------------------------------------------------------------------
 * Teclado físico: letras, Enter envia, Backspace apaga, Esc fecha telas
 * ------------------------------------------------------------------ */

/** "Á" vira "a", "ç" continua "ç" */
function normalizarTecla(tecla) {
  if (tecla.length !== 1) return null;
  const minuscula = tecla.toLowerCase();
  if (minuscula === "ç") return "ç";
  return minuscula.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tratarTeclado(e) {
  if (e.key === "Escape") {
    fecharModais();
    return;
  }

  // Fora do jogo, em campos de texto ou com atalhos do sistema: não interfere
  if (!dadosJogo || $("jogo").hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLInputElement) return;

  if (e.key === "Enter") {
    // Com foco num botão, Enter aciona o botão (quem navega por Tab espera isso)
    if (e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    enviar();
    return;
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    apagar();
    return;
  }

  const letra = normalizarTecla(e.key);
  if (letra && dadosJogo.letras.includes(letra)) {
    e.preventDefault();
    addLetra(letra);
  }
}

/* ------------------------------------------------------------------
 * Telas sobrepostas: gabarito e reset
 * ------------------------------------------------------------------ */

function abrirModal(id) {
  window.scrollTo(0, 0);
  $("jogo").hidden = true;
  $(id).hidden = false;
}

function fecharModais() {
  $("modal-gabarito").hidden = true;
  $("modal-reset").hidden = true;
  $("jogo").hidden = false;
  window.scrollTo(0, 0);
}

async function verGabarito() {
  const listaG = $("lista-gabarito");
  listaG.textContent = "Carregando...";
  abrirModal("modal-gabarito");

  try {
    const response = await fetch(`${WEBSERVICE}?ontem=1`, { cache: "no-store" });
    const dados = await response.json();

    if (!response.ok) {
      const p = document.createElement("p");
      p.textContent = dados.erro || "Não foi possível carregar o gabarito.";
      listaG.replaceChildren(p);
      return;
    }

    const spans = [...dados.respostas]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((palavra) => {
        const s = document.createElement("span");
        s.textContent = palavra;
        return s;
      });
    listaG.replaceChildren(...spans);
  } catch (e) {
    console.error(e);
    listaG.textContent = "Erro ao buscar o gabarito de ontem.";
  }
}

function abrirModalReset() {
  $("senha-reset").value = "";
  abrirModal("modal-reset");
  $("senha-reset").focus();
}

async function confirmarReset(e) {
  e.preventDefault();
  const senha = $("senha-reset").value;
  if (!senha) return;

  try {
    const response = await fetch("reset.php", {
      method: "POST",
      body: new URLSearchParams({ senha }),
    });
    const resultado = await response.json();

    if (response.ok && resultado.sucesso) {
      removerStorage(CHAVE_PROGRESSO);
      alert("Novo desafio sorteado! O jogo será recarregado.");
      window.location.reload();
    } else {
      alert("Erro: " + (resultado.erro || "Senha incorreta."));
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao conectar com o servidor.");
  }
}

iniciar();
