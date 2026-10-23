#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Saulo Popov Zambiasi
#
# Envia o Letradeiro para o servidor.
# As informações do servidor ficam em deploy.conf, que NÃO vai para o git.
# Para criar: cp deploy.conf.exemplo deploy.conf  (e ajuste os valores)

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f deploy.conf ]; then
    echo "Arquivo deploy.conf não encontrado."
    echo "Crie a partir do modelo: cp deploy.conf.exemplo deploy.conf"
    exit 1
fi

source deploy.conf
DESTINO="$REMOTE_USER@$REMOTE_HOST"

echo "Iniciando deploy para $REMOTE_HOST..."

# 1. Arquivos do jogo, para a pasta pública do site
#    -a: preserva permissões | -v: mostra o que faz | -z: comprime na transferência
rsync -avz \
    --exclude '.git/' \
    --exclude 'data/' \
    --exclude 'sistema/' \
    --exclude 'docs/' \
    --exclude 'deploy.sh' \
    --exclude 'deploy.conf*' \
    --exclude '*.md' \
    --exclude '.gitignore' \
    ./ "$DESTINO:$REMOTE_DIR"

# 2. Arquivos do agendador, para uma pasta temporária FORA da web
#    (a instalação no systemd é manual, veja o README)
rsync -avz sistema/ "$DESTINO:/tmp/letradeiro-sistema/"

echo "Deploy finalizado com sucesso! 🎭"
