# Atlas · Catálogo de aplicações

Biblioteca de repositórios GitHub com grade, carrossel, filtros de finalidade, topics, linguagem e visibilidade, além de um leitor de READMEs. A PWA mantém a coleção **pública** disponível offline.

## Usar

Node >=18 e pnpm 10.

```powershell
pnpm install --frozen-lockfile
gh auth login
pnpm build
pnpm local
```

Abra http://127.0.0.1:4173. Esse modo lista todos os repositórios de sua conta (incluindo privados), usando a autenticação do GitHub CLI. Se essa porta estiver ocupada, configure `$env:PORT='4188'`. A primeira consulta coleta os READMEs privados e pode levar cerca de um minuto. Credenciais ficam apenas no processo Node; a API não recebe tokens do navegador.

Use **Editar ficha pessoal** para descrever uma aplicação e ajustar suas categorias. Anotações ficam em `.catalog/annotations.json`, ignorado pelo Git, e prevalecem sobre a categorização local em `.catalog/categories.json`. Faça backup da pasta `.catalog` para preservar sua curadoria. Nenhum desses arquivos altera a descrição do GitHub.

`GH_USER` seleciona a conta (padrão: juninmd). O modo privado exige que ela seja a conta autenticada. `GH_TOKEN` ou `GITHUB_TOKEN` também são aceitos somente no servidor; nunca coloque tokens em URLs ou arquivos versionados.

## Públicos, privados e offline

- `pnpm generate` coleta **somente públicos**, mesmo que o token tenha acesso privado.
- `pnpm build` atualiza a coleção pública, compila e gera manifest + service worker.
- `pnpm build:site` compila usando a coleta pública existente; se ela não existir, coleta antes de compilar. Uma instalação nova precisa de autenticação para evitar o limite baixo de consultas anônimas do GitHub.
- `pnpm dev` inicia a interface de desenvolvimento; execute `pnpm generate` primeiro.
- `pnpm preview` serve a PWA pública. `pnpm local` serve o catálogo completo em loopback.
- O service worker armazena apenas os arquivos públicos do build. A API local tem `Cache-Control: no-store` e nunca entra no cache. Offline, a interface mostra somente a coleção pública.
- O projeto está destinado ao uso local. Os workflows de Pages e publicação Docker foram removidos; não há publicação automática nem configuração do catálogo no `app-charts`.
- READMEs são renderizados com HTML desativado, links limitados a HTTP(S) e imagens externas substituídas por suas legendas. Isso preserva o texto sem carregar rastreadores ou scripts de outros projetos.
- Padrões comuns de tokens/chaves são removidos do conteúdo coletado. Essa remoção não substitui uma auditoria de segredos em cada repositório.
- Nomes, descrições, código e READMEs privados permanecem fora do build, do Git e das imagens Docker.

**Privacidade histórica:** a versão anterior deste repositório público versionava `docs/public/repos.json` com metadados privados. O arquivo foi removido; versões anteriores ainda podem existir no histórico remoto. Esta alteração não reescreve esse histórico.

## Organizar topics no GitHub

```powershell
pnpm topics:plan
# Confira .catalog/topics-plan.json; ajuste as adições se necessário.
pnpm topics:apply
pnpm topics:verify
```

O plano inclui todos os repositórios próprios da conta autenticada. Usa descrição, nome, topics e um trecho descritivo do README para sugerir finalidade e linguagem; onde não existe evidência, propõe `needs-classification`. Não altera visibilidade, conteúdo ou descrições.

A aplicação relê as tags atuais, preserva as existentes, respeita o limite de 20 e verifica o resultado na API. Há intervalo entre escritas e retentativas para falhas temporárias. Execute novamente para retomar os itens pendentes. Erros ficam em `.catalog/topics-report.json`; o comando falha se existir erro ou repositório sem topic. `pnpm topics:verify` faz uma conferência independente do inventário atual contra o plano. O plano e o relatório são locais e podem conter nomes privados.

A finalidade exibida identifica sua fonte: descrição do GitHub, trecho do README, anotação pessoal ou pendente. Categorias automáticas são sugestões, não comprovação de comportamento. Projetos sem documentação precisam de curadoria.

Contratos: [topics](https://docs.github.com/en/rest/repos/repos#replace-all-repository-topics) e [READMEs](https://docs.github.com/en/rest/repos/contents#get-a-repository-readme), na documentação oficial do GitHub.

## Índice de stack

Responde "quem usa a dependência X?" e mostra divergências entre repositórios. Tudo é local: o índice fica em `.catalog/stack.json` (ignorado pelo Git) e nunca entra no build, na PWA nem na imagem Docker.

```powershell
pnpm stack:collect                       # lê manifests e workflows de todos os repositórios próprios (requer gh auth login)
pnpm stack:who hono                      # quem declara a dependência, com faixa e tipo
pnpm stack:who hono --range ^4 --json    # filtra pela faixa declarada; --json para pipelines
pnpm stack:report                        # sem CI, sem lockfile e divergências de workflow/Node/pacotes/Docker
```

- **Coleta:** uma consulta da árvore por repositório (`git/trees`) e só os arquivos conhecidos: `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Dockerfile`, `.nvmrc`/`.node-version` e `.github/workflows/*.yml`. Monorepos entram (até 15 manifests por repositório); `node_modules`, `vendor`, `target`, `dist`, `build` e `.venv` são ignorados. Nenhum outro arquivo é lido.
- **Incremental:** repositórios com o mesmo `pushed_at` e branch padrão vêm do cache. Se algum falhar, o snapshot anterior é mantido como `desatualizado`, o comando sai com erro e uma nova execução refaz só o que falta.
- **Cota:** cada repositório custa ~6 chamadas à API (medido: 69 repositórios gastaram ~400), então uma coleta completa de ~500 consome mais da metade das 5 mil chamadas/hora do GitHub. Ao esgotar a cota a coleta para na hora e informa quando tentar de novo; não rode duas coletas completas na mesma hora.
- **Faixas declaradas, não resolvidas:** `hono@^4.6.14` é o que o manifest pede, não a versão instalada. Credenciais em URLs e valores com forma de token são removidos antes de gravar.
- **Limites:** em `pyproject.toml` só `[project].dependencies` é lido (`optional-dependencies` e `[tool.poetry.*]` não); em `Cargo.toml` tabelas `[dependencies.nome]` não são lidas. Python nunca é apontado como "sem lockfile", e um lockfile só vale para o seu ecossistema (`Cargo.lock` não cobre um `package.json`).
- **Lacunas visíveis:** `stack:report` lista árvores truncadas pelo GitHub, manifests com JSON inválido e arquivos acima de 1 MB (não lidos), em vez de indexá-los como vazios. Trocar a versão do índice (`SCHEMA`) invalida o cache.
- **Divergência:** em cada seção do relatório o maior grupo aparece só com a contagem e os demais listam os repositórios. O maior grupo não é necessariamente o mais novo.

## Validar

```powershell
pnpm test
pnpm build:site
pnpm test:e2e
```

Os testes E2E usam Microsoft Edge instalado e um servidor local em 4188. Incluem uma consulta real autenticada ao inventário privado; requerem `gh auth login`. Também verificam navegação, filtros, teclado, mobile, conteúdo hostil, offline e bloqueio de outras origens.

O build Docker é opcional e não publica a imagem. Gere a coleção com `pnpm generate` antes de `docker build -t catalogo:local .`; os dados privados e as credenciais ficam fora da imagem. Para um build sem coleção prévia, forneça uma credencial via BuildKit secret `github_token`, nunca por build-arg. Ao executar o container, vincule a porta a `127.0.0.1`.

A categorização de todos os repositórios é local e identifica sua fonte. Quando a documentação não permite concluir a finalidade, a ficha mantém essa incerteza. A presença de uma categoria não comprova que o programa funciona.
