<?php

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

/**
 * Letradeiro: entrega o desafio do dia (ou o gabarito de ontem).
 *
 * O desafio normalmente já foi gerado às 0h pelo agendador (generate.php).
 * Se por algum motivo ele não existir (servidor desligado à meia-noite,
 * agendador quebrado), este script gera na hora, como rede de segurança.
 * O mutex dentro de garantirDesafio() impede gerações duplicadas.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/inc/desafio.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');  // o desafio muda à meia-noite: nada de cache no navegador

// --- GABARITO DE ONTEM ---
if (isset($_GET['ontem'])) {
    $arquivo = arquivoDoDia(dataDe('yesterday'));

    if (is_file($arquivo)) {
        readfile($arquivo);
    } else {
        http_response_code(404);
        echo json_encode(['erro' => 'O desafio de ontem não foi registrado no sistema.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// --- DESAFIO DE HOJE ---
try {
    echo garantirDesafio(dataDe());
} catch (Throwable $e) {
    error_log('[Letradeiro] ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['erro' => 'Não foi possível carregar o desafio de hoje.'], JSON_UNESCAPED_UNICODE);
}
