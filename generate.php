<?php

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

/**
 * Letradeiro: gera o desafio do dia pelo terminal.
 *
 * Uso:
 *   php generate.php            gera o de hoje, se ainda não existir
 *   php generate.php --forcar   sorteia um novo e substitui o de hoje
 *
 * É este script que o agendador (systemd timer) chama às 0h.
 * Só roda no terminal: pelo navegador, responde 404.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/inc/desafio.php';

$forcar = in_array('--forcar', $argv, true);
$data = dataDe();
$inicio = microtime(true);

try {
    $existia = is_file(arquivoDoDia($data));
    $desafio = json_decode(garantirDesafio($data, $forcar), true, 512, JSON_THROW_ON_ERROR);

    $acao = ($forcar || !$existia) ? 'gerado' : 'já existia, mantido';
    $ms = (int) round((microtime(true) - $inicio) * 1000);

    printf(
        "[%s] Desafio %s: letras %s (chave %s), %d palavras, %d ms\n",
        $data,
        $acao,
        mb_strtoupper(implode(' ', $desafio['letras']), 'UTF-8'),
        mb_strtoupper($desafio['chave'], 'UTF-8'),
        count($desafio['respostas']),
        $ms
    );
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "[$data] ERRO: " . $e->getMessage() . "\n");
    exit(1);
}
