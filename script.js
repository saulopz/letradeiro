// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

let dadosJogo = null;
let progresso = { data: "", encontradas: [] };
let tentativa = "";
let webservice = "get.php"; // relativo: funciona em qualquer servidor

function aplicarTema() {
  const temaSalvo = localStorage.getItem("letradeiro_tema") || "light";
  const btn = document.getElementById("btn-tema");

  if (temaSalvo === "dark") {
    document.body.classList.add("dark-mode");
    if (btn) btn.innerText = "☀️"; // Ícone para voltar ao claro
  } else {
    document.body.classList.remove("dark-mode");
    if (btn) btn.innerText = "🌙"; // Ícone para ir ao escuro
  }
}

function alternarTema() {
  if (document.body.classList.contains("dark-mode")) {
    localStorage.setItem("letradeiro_tema", "light");
  } else {
    localStorage.setItem("letradeiro_tema", "dark");
  }
  aplicarTema();
}

aplicarTema();

async function iniciar() {
  // 1. Buscar dados do backend
  try {
    const response = await fetch(webservice);
    const dados = await response.json();
    if (!response.ok || !Array.isArray(dados.respostas)) {
      throw new Error(dados.erro || `HTTP ${response.status}`);
    }
    dadosJogo = dados;
  } catch (e) {
    console.error(e);
    document.getElementById("palavra-digitada").innerHTML =
      `<span style="color: #f44336">⚠️ Não consegui carregar o desafio. Tente de novo em instantes.</span>`;
    return;
  }
  document.getElementById("total").innerText = dadosJogo.respostas.length;

  // 2. Verificar LocalStorage
  const salvo = JSON.parse(localStorage.getItem("letradeiro_progresso"));
  if (salvo && salvo.id === dadosJogo.id) {
    progresso = salvo;
  } else {
    progresso = {
      data: dadosJogo.data,
      id: dadosJogo.id,
      encontradas: [],
    };
    salvar();
  }

  renderizarLetras();
  atualizarLista();
  aplicarTema();
}

function renderizarLetras() {
  const wheel = document.getElementById("wheel");
  const letras = [...dadosJogo.letras];
  embaralhar(letras);
  const chave = dadosJogo.chave;

  const outras = letras.filter((l) => l !== chave);

  wheel.innerHTML = `<div class="hex chave" onclick="addLetra('${chave}')">${chave.toUpperCase()}</div>`;

  outras.forEach((l, i) => {
    const angulo = i * 60 * (Math.PI / 180);
    // Ajustado para o novo centro (102.5) e raio menor (90)
    const x = 102.5 + 90 * Math.cos(angulo);
    const y = 102.5 + 90 * Math.sin(angulo);
    wheel.innerHTML += `<div class="hex" style="left:${x}px; top:${y}px" onclick="addLetra('${l}')">${l.toUpperCase()}</div>`;
  });
}

function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function addLetra(l) {
  tentativa += l;
  document.getElementById("palavra-atual").innerText = tentativa.toUpperCase();
}

function apagar() {
  tentativa = tentativa.slice(0, -1);
  document.getElementById("palavra-atual").innerText = tentativa.toUpperCase();
}

function enviar() {
  const p = tentativa.toLowerCase();
  const palavra_digitada = document.getElementById("palavra-digitada");

  if (dadosJogo.respostas.includes(p) && !progresso.encontradas.includes(p)) {
    progresso.encontradas.push(p);
    salvar();
    atualizarLista();

    // --- LÓGICA DO PANGRAMA (FESTINHA) ---
    // Verifica se a palavra usa todas as 7 letras do desafio
    const letrasUnicas = new Set(p.split(""));
    const todasAchadas =
      progresso.encontradas.length === dadosJogo.respostas.length;
    if (todasAchadas) {
      // VITÓRIA TOTAL: O ápice do jogo
      dispararFestinha(); // Uma grande explosão
      palavra_digitada.innerHTML = `<span style="color: #4caf50">🏆 <b>${p.toUpperCase()}</b> CONCLUÍDO!</span>`;
    } else if (letrasUnicas.size === 7) {
      dispararFestinha();
      palavra_digitada.innerHTML = `<span style="color: #f7da21">🌟 <b>${p.toUpperCase()}</b> PANGRAMA!</span>`;
    } else {
      palavra_digitada.innerHTML = `<span style="color: #4caf50"><b>${p.toUpperCase()}</b> 👍</span>`;
    }
    // -------------------------------------

    const elementoEncontrado = document.getElementById(`word-${p}`);
    if (elementoEncontrado) {
      elementoEncontrado.scrollIntoView({
        behavior: "smooth",
        inline: "center",
      });
    }
  } else if (progresso.encontradas.includes(p)) {
    palavra_digitada.innerHTML = `<span style="color: #ff9800"><b>${p.toUpperCase()}</b> 🔁</span>`;
  } else {
    palavra_digitada.innerHTML = `<span style="color: #f44336"><b>${p.toUpperCase()}</b> ❌</span>`;
  }
  tentativa = "";
  document.getElementById("palavra-atual").innerText = "";
  window.scrollTo(0, 0);
}

function dispararFestinha() {
  // Configuração rápida de confetes
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#ff75c8", "#f7da21", "#4caf50", "#add8e6"],
  });
}

function salvar() {
  localStorage.setItem("letradeiro_progresso", JSON.stringify(progresso));
}

function atualizarLista() {
  const encontradas = progresso.encontradas.length;
  const total = dadosJogo.respostas.length;
  const porcentagem = (encontradas / total) * 100;

  document.getElementById("count").innerText = encontradas;
  document.getElementById("progress-bar").style.width = porcentagem + "%";

  const lista = document.getElementById("lista");

  const todasAsRespostas = [...dadosJogo.respostas].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  lista.innerHTML = todasAsRespostas
    .map((p) => {
      const jaAchou = progresso.encontradas.includes(p);
      // Adicionamos style="--tamanho-palavra: ${p.length}"
      if (jaAchou) {
        return `<li id="word-${p}" style="--tamanho-palavra: ${p.length}">${p}</li>`;
      } else {
        return `<li id="word-${p}" class="oculta" style="--tamanho-palavra: ${p.length}">${p.length} letras</li>`;
      }
    })
    .join("");
}

async function verGabarito() {
  const listaG = document.getElementById("lista-gabarito");
  const modal = document.getElementById("modal-gabarito");
  const jogo = document.querySelector(".game-container");

  // Limpa o scroll para o topo do celular
  window.scrollTo(0, 0);
  listaG.innerHTML = "Carregando...";

  try {
    const response = await fetch(`${webservice}?ontem=1`);

    if (!response.ok) {
      const erroDados = await response.json();
      listaG.innerHTML = `<p style="padding:20px;">${erroDados.erro}</p>`;
    } else {
      const dadosOntem = await response.json();
      const respostas = dadosOntem.respostas.sort((a, b) => a.localeCompare(b));
      listaG.innerHTML = respostas.map((p) => `<span>${p}</span>`).join("");
    }

    // Esconde um, mostra o outro
    jogo.style.display = "none";
    modal.style.display = "block";
  } catch (e) {
    alert("Erro ao buscar dados de ontem.");
    console.error(e);
  }
}

function fecharGabarito() {
  const modal = document.getElementById("modal-gabarito");
  const jogo = document.querySelector(".game-container");

  // Esconde o gabarito
  modal.style.display = "none";

  // Restaura a visibilidade do jogo
  // Usamos 'block' ou 'flex' para garantir que ele preencha o espaço
  jogo.style.display = "block";

  // Garante que a tela volte ao topo para o início do jogo
  window.scrollTo(0, 0);
}

function abrirModalReset() {
  window.scrollTo(0, 0);
  document.querySelector(".game-container").style.display = "none";
  document.getElementById("senha-reset").value = "";
  document.getElementById("modal-reset").style.display = "block";
}

function fecharModalReset() {
  document.getElementById("modal-reset").style.display = "none";
  document.querySelector(".game-container").style.display = "block";
  window.scrollTo(0, 0);
}

async function confirmarReset() {
  const senha = document.getElementById("senha-reset").value;
  if (!senha) return;

  try {
    const response = await fetch("reset.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `senha=${encodeURIComponent(senha)}`,
    });

    const resultado = await response.json();

    if (response.ok && resultado.sucesso) {
      localStorage.removeItem("letradeiro_progresso");
      alert("Novo desafio sorteado! O jogo será recarregado.");
      window.location.reload();
    } else {
      alert("Erro: " + (resultado.erro || "Senha incorreta."));
    }
  } catch (e) {
    alert("Erro ao conectar com o servidor.");
    console.error(e);
  }
}

iniciar();
