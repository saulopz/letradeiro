<?php

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Saulo Popov Zambiasi

/**
 * Letradeiro: sorteia um novo desafio para hoje, substituindo o atual.
 *
 * Só aceita POST com a senha de administração. A senha não fica no código:
 * fica em inc/config.php, como hash (veja inc/config.exemplo.php).
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/inc/desafio.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function responder(int $codigo, array $corpo): void
{
    http_response_code($codigo);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// Só POST: senha em GET acaba gravada no log de acesso do nginx
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder(405, ['sucesso' => false, 'erro' => 'Método não permitido.']);
}

$arquivoConfig = __DIR__ . '/inc/config.php';
if (!is_file($arquivoConfig)) {
    error_log('[Letradeiro] inc/config.php não existe: reset desativado.');
    responder(500, ['sucesso' => false, 'erro' => 'Reset não configurado no servidor.']);
}
require $arquivoConfig;

$senha = (string) ($_POST['senha'] ?? '');
if ($senha === '' || !password_verify($senha, SENHA_ADMIN_HASH)) {
    responder(403, ['sucesso' => false, 'erro' => 'Senha incorreta.']);
}

try {
    garantirDesafio(dataDe(), true);
    responder(200, ['sucesso' => true, 'mensagem' => 'Novo desafio sorteado!']);
} catch (Throwable $e) {
    error_log('[Letradeiro] Reset falhou: ' . $e->getMessage());
    responder(500, ['sucesso' => false, 'erro' => 'Não foi possível sortear um novo desafio.']);
}
