# Organização do repositório — Será Quem Faz?

O objetivo desta estrutura é manter **uma única implementação PHP/PDO MySQL** e um frontend estático, separando dados públicos, dados privados, migrações, testes e arquivos gerados.

| Local | Finalidade | Versionamento |
| --- | --- | --- |
| `index.html`, `entrar.html`, `cadastro.html`, `categorias.html`, `categoria.html` | Páginas públicas e autenticação | Manter |
| `painel.html`, `prestador.html`, `admin.html` | Endereços estáveis para conta, perfil profissional e administração | Manter |
| `painel-mysql.html`, `prestador-mysql.html`, `admin-mysql.html` | Endereços de compatibilidade **ainda utilizados** por navegação e testes; os respectivos arquivos têm o mesmo conteúdo das páginas acima | Manter até testar migração de URLs/redirects |
| `assets/` | Scripts, CSS, municípios e mídia pública sem dados pessoais | Manter |
| `assets/brand/` | Logotipos e ícones; `simbolo.png` é a cópia canônica | Manter somente arquivos utilizados |
| `backend/public/index.php` | Roteador e controle HTTP da API, com autenticação e sessão | Manter |
| `backend/src/` | Regras de domínio, autorização e acesso PDO MySQL | Manter |
| `backend/bin/` | Operações privadas e ferramentas CLI; nunca expor pela raiz pública | Manter |
| `database/mysql/migrations/001–010` | Esquema e alterações incrementais MySQL/MariaDB | Manter todas, na ordem |
| `database/seed/` | Categorias e dados públicos normalizados | Manter |
| `database/audit/` | Verificações locais de arquitetura e dependências | Manter |
| `database/tests/` | Integrações locais de banco, API, navegador, importação e recuperação | Manter |
| `tests/` | Testes unitários/estáticos Node.js | Manter |
| `scripts/` | Utilitários de manutenção e validação local | Manter |
| `database/hostinger/` | Empacotamento para **uso futuro**, depois do aceite técnico | Preservar, não executar deploy |
| `docs/` | Organização, roteiro de validação e preparação de releases | Manter |
| `dist/`, `node_modules/`, backups e mídia privada | Artefatos locais e/ou confidenciais | Ignorar no Git |

## Limpeza realizada

- Removido `assets/brand/simbolo-dark.png`, pois tinha o **mesmo blob SHA** de `assets/brand/simbolo.png`.
- A única referência textual à cópia removida foi substituída pela imagem canônica na página inicial.
- Nenhum arquivo de migração, teste, documentação necessária, página com endereço em uso ou arquivo pessoal foi excluído.
- O histórico Git não foi reescrito; eventuais arquivos históricos continuam recuperáveis pelas revisões anteriores.

## Regras para exclusões futuras

Antes de remover uma página, script ou imagem, verificar referências nos arquivos versionados, a árvore de build, rotas do navegador e scripts de teste. Páginas com sufixo `-mysql` são **duplicações conhecidas**, mas ainda funcionam como URLs de compatibilidade; a remoção exige redirecionamentos e validação de navegação.

Não enviar arquivos `.env`, `backend/config.php`, arquivos de mídia privada, bancos SQL exportados, capturas pessoais, backups ou chaves. Não incluir dados de clientes/prestadores em fixtures.

A branch `feat/mysql-mariadb-migration` é o local das alterações em andamento. A `main` e qualquer ambiente operacional só poderão ser alterados após homologação expressa.
