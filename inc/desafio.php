<?php

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

/**
 * Letradeiro: biblioteca do desafio diário.
 *
 * Toda a lógica de sorteio e de acesso ao cache mora aqui, num só lugar.
 * Quem usa:
 *   - generate.php  (agendador às 0h e terminal)
 *   - get.php       (só lê; gera apenas como rede de segurança)
 *   - reset.php     (força um novo sorteio)
 *
 * Este arquivo só define funções e constantes: acessá-lo pelo navegador
 * não executa nada.
 */

declare(strict_types=1);

const MIN_PALAVRAS = 30;
const MAX_PALAVRAS = 200;
const MAX_TENTATIVAS = 2000;
const CAMINHO_DICIONARIO = '/usr/share/dict/brazilian';
const FUSO = 'America/Sao_Paulo';

function dirDados(): string
{
    return dirname(__DIR__) . '/data';
}

/** Data no fuso do jogo. Ex.: dataDe() = hoje, dataDe('yesterday') = ontem. */
function dataDe(string $quando = 'now'): string
{
    return (new DateTime($quando, new DateTimeZone(FUSO)))->format('Y-m-d');
}

function arquivoDoDia(string $data): string
{
    return dirDados() . "/challenge_$data.json";
}

function limpar(string $str): string
{
    $mapa = [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ñ' => 'n'
    ];
    return strtr(mb_strtolower($str, 'UTF-8'), $mapa);
}

/**
 * Lê o dicionário uma única vez e devolve as palavras já limpas, únicas,
 * com 3+ letras, sem nomes próprios e sem reduções coloquiais em "mo".
 */
function carregarDicionario(string $caminho): array
{
    $excecoesLegitimas = array_flip(['rumo', 'ritmo', 'ermo', 'como', 'mesmo', 'termo', 'plumo']);
    $palavras = [];

    $handle = fopen($caminho, 'r');
    if ($handle === false) {
        throw new RuntimeException("Não consegui abrir o dicionário $caminho");
    }

    while (($linha = fgets($handle)) !== false) {
        $original = trim($linha);
        if ($original === '') {
            continue;
        }

        // Nomes próprios, inclusive com maiúscula acentuada (Á, É...)
        $primeira = mb_substr($original, 0, 1, 'UTF-8');
        if (mb_strtolower($primeira, 'UTF-8') !== $primeira) {
            continue;
        }

        $limpa = limpar($original);

        if (mb_strlen($limpa, 'UTF-8') < 3) {
            continue;
        }

        // Reduções coloquiais (vamo, estamo...), preservando palavras legítimas
        if (preg_match('/[aeiou]mo$/u', $limpa) && !isset($excecoesLegitimas[$limpa])) {
            continue;
        }

        $palavras[$limpa] = true;  // chave do array = deduplicação gratuita
    }
    fclose($handle);

    return array_keys($palavras);
}

/**
 * Sorteia letras até achar um conjunto com volume adequado e ao menos
 * um pangrama. Devolve o desafio pronto (ainda não gravado).
 */
function sortearDesafio(string $data): array
{
    if (!is_readable(CAMINHO_DICIONARIO)) {
        throw new RuntimeException('Dicionário não encontrado ou ilegível: ' . CAMINHO_DICIONARIO);
    }

    $dicionario = carregarDicionario(CAMINHO_DICIONARIO);

    $alfabeto = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'x', 'z'];
    $vogais = ['a', 'e', 'i', 'o', 'u'];

    for ($tentativa = 0; $tentativa < MAX_TENTATIVAS; $tentativa++) {
        shuffle($alfabeto);
        $selecionadas = array_slice($alfabeto, 0, 7);

        // Regra do Q: sem U, o Q não forma palavras
        if (in_array('q', $selecionadas, true) && !in_array('u', $selecionadas, true)) {
            $indiceQ = array_search('q', $selecionadas, true);
            $indicesParaTroca = array_values(array_diff(array_keys($selecionadas), [$indiceQ]));
            $selecionadas[$indicesParaTroca[array_rand($indicesParaTroca)]] = 'u';
        }

        // Ç não pode ser a chave (índice 0)
        if ($selecionadas[0] === 'ç') {
            [$selecionadas[0], $selecionadas[1]] = [$selecionadas[1], $selecionadas[0]];
        }

        if (count(array_intersect($selecionadas, $vogais)) < 2) {
            continue;
        }

        $chave = $selecionadas[0];
        $regex = '/^[' . implode('', $selecionadas) . ']+$/u';

        // preg_grep filtra o dicionário inteiro em C
        $palavras = [];
        $temPangrama = false;
        foreach (preg_grep($regex, $dicionario) as $palavra) {
            if (mb_strpos($palavra, $chave, 0, 'UTF-8') === false) {
                continue;
            }
            $palavras[] = $palavra;

            if (!$temPangrama && count(array_unique(mb_str_split($palavra, 1, 'UTF-8'))) === 7) {
                $temPangrama = true;
            }
        }

        $total = count($palavras);
        if ($total >= MIN_PALAVRAS && $total <= MAX_PALAVRAS && $temPangrama) {
            $ordenadas = $selecionadas;
            sort($ordenadas);

            return [
                'data' => $data,
                // Data e chave entram no id: mesmas letras em outro dia (ou
                // com outra chave) não herdam o progresso salvo no navegador
                'id' => md5($data . '|' . $chave . '|' . implode('', $ordenadas)),
                'letras' => $selecionadas,  // chave na primeira posição
                'chave' => $chave,
                'respostas' => $palavras,
            ];
        }
    }

    throw new RuntimeException(
        'Nenhum conjunto válido após ' . MAX_TENTATIVAS . ' tentativas (dicionário com ' . count($dicionario) . ' palavras).'
    );
}

/** Grava num temporário e renomeia: ninguém nunca lê um arquivo pela metade. */
function gravarAtomico(string $arquivo, string $conteudo): void
{
    $temporario = $arquivo . '.tmp' . getmypid();
    if (file_put_contents($temporario, $conteudo) === false || !rename($temporario, $arquivo)) {
        @unlink($temporario);
        throw new RuntimeException("Falha ao gravar $arquivo (permissão da pasta data/?)");
    }
}

/**
 * Garante que o desafio da data exista e devolve o JSON.
 *
 * Com $forcar = false: se já existe, só lê.
 * Com $forcar = true:  sorteia um novo e substitui (usado no reset).
 *
 * O mutex (flock) garante que só um processo sorteie por vez. Quem chega
 * durante um sorteio espera e recebe o mesmo desafio.
 */
function garantirDesafio(string $data, bool $forcar = false): string
{
    $arquivo = arquivoDoDia($data);

    if (!$forcar && is_file($arquivo)) {
        $conteudo = file_get_contents($arquivo);
        if ($conteudo !== false) {
            return $conteudo;
        }
    }

    if (!is_dir(dirDados())) {
        throw new RuntimeException('Pasta de dados não existe: ' . dirDados());
    }

    $trava = fopen(dirDados() . '/.letradeiro.lock', 'c');
    if ($trava === false) {
        throw new RuntimeException('Não consegui abrir o arquivo de trava em ' . dirDados() . ' (permissão?)');
    }

    try {
        flock($trava, LOCK_EX);

        // Outro processo pode ter gerado enquanto esperávamos a trava
        if (!$forcar && is_file($arquivo)) {
            $conteudo = file_get_contents($arquivo);
            if ($conteudo !== false) {
                return $conteudo;
            }
        }

        $json = json_encode(sortearDesafio($data), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        gravarAtomico($arquivo, $json);

        return $json;
    } finally {
        flock($trava, LOCK_UN);
        fclose($trava);
    }
}
