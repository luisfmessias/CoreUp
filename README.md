# CoreUp

App de academia que monta a rotina semanal de treino a partir das preferencias
do aluno, acompanha a execucao e registra a evolucao corporal.

Construido como aplicacao mobile-first: a interface tem 430px de largura maxima
e navegacao inferior em cinco abas, no formato de um app nativo.

## Stack

- **Next.js 16** com App Router e React 19
- **TypeScript** em modo estrito
- **Tailwind CSS 4** via plugin PostCSS
- **Prisma 6** sobre PostgreSQL (Neon)
- **Zod 4** para validacao de entrada
- **bcrypt** e **jsonwebtoken** para autenticacao

## Funcionalidades

| Aba | O que faz |
| --- | --- |
| Inicio | treino do dia e resumo do plano salvo (treinos, exercicios, tempo e grupos) |
| Montar | gerador de plano a partir de objetivo, nivel, dias, tempo, equipamentos e favoritos |
| Treino | plano salvo da semana, com remocao de dias |
| Exercicios | busca no catalogo de 200 exercicios, com filtro por grupo |
| Aval. | avaliacoes de treinos do catalogo feitas por profissionais de Educacao Fisica |
| Evolucao | peso, altura, series por dia, cobertura muscular e dados da conta |

## Como rodar

```bash
npm install
cp .env.example .env   # preencha com as URLs do Neon
npm run prisma:deploy  # aplica as migrations no banco
npm run prisma:generate
npm run dev
```

Para alterar o schema, edite `prisma/schema.prisma` e rode
`npm run prisma:migrate -- --name descricao-da-mudanca`. A migration gerada em
`prisma/migrations/` deve ir para o git.

### Deploy na Vercel

O banco e um Postgres do Neon criado pela aba **Storage** da Vercel, que injeta
`DATABASE_URL` e `DATABASE_URL_UNPOOLED` no projeto. O script `build` roda
`prisma migrate deploy` antes do `next build`, entao cada deploy aplica as
migrations pendentes automaticamente.

A aplicacao sobe em `http://localhost:3000`. Crie uma conta pela tela de
cadastro para comecar.

### Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DATABASE_URL` | sim | URL do Postgres com pooling, usada pelo app |
| `DATABASE_URL_UNPOOLED` | sim | URL direta do Postgres, usada pelas migrations |
| `JWT_SECRET` | em producao | segredo de assinatura das sessoes |
| `SESSION_TTL_DAYS` | nao | validade da sessao em dias, padrao `30` |

Sem `JWT_SECRET` a aplicacao usa um segredo de desenvolvimento e recusa subir
em producao.

## API

Rotas autenticadas esperam o cabecalho `Authorization: Bearer <token>`.

| Metodo | Rota | Auth | Descricao |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | nao | cria conta e ja devolve sessao, exige `acceptPrivacy: true`; `accountType: "PROFESSIONAL"` exige `professional` (CREF, UF, especialidade, formacao) |
| `POST` | `/api/auth/login` | nao | autentica e devolve token e usuario, com o `accountType` salvo no cadastro |
| `POST` | `/api/auth/logout` | sim | revoga a sessao atual |
| `GET` | `/api/me` | sim | dados do usuario logado |
| `DELETE` | `/api/me` | sim | exclui a conta e todos os dados, exige `password` no corpo |
| `GET` | `/api/exercises` | nao | catalogo, filtra por `q`, `grupoMuscular`, `nivel` |
| `GET` | `/api/exercises/[id]` | nao | exercicio unico |
| `GET` | `/api/plan` | sim | plano semanal salvo e preferencias do gerador |
| `PUT` | `/api/plan` | sim | substitui o plano inteiro e salva as preferencias |
| `PUT` | `/api/preferences` | sim | salva as preferencias do gerador |
| `GET` | `/api/workouts` | sim | treinos do usuario, filtra por `weekday` |
| `POST` | `/api/workouts` | sim | cria treino com exercicios |
| `GET` | `/api/workouts/[id]` | sim | treino unico |
| `PUT` | `/api/workouts/[id]` | sim | atualiza treino |
| `DELETE` | `/api/workouts/[id]` | sim | remove treino |
| `GET` | `/api/history` | sim | ultimos 50 registros de execucao |
| `POST` | `/api/history` | sim | registra treino executado |
| `GET` | `/api/body-metrics` | sim | ultimas 100 medicoes |
| `POST` | `/api/body-metrics` | sim | registra medicao e atualiza o perfil |
| `GET` | `/api/reviews` | sim | avaliacoes profissionais dos treinos do catalogo |
| `PUT` | `/api/reviews/[workoutKey]` | profissional | cria ou edita a avaliacao do profissional logado |
| `DELETE` | `/api/reviews/[workoutKey]` | profissional | remove a avaliacao do profissional logado |
| `GET` | `/api/health` | nao | healthcheck |

## Como o gerador monta o treino

O plano nao e sorteado. Cada exercicio candidato recebe uma pontuacao e o de
maior nota ocupa a vaga:

- **+40** se pertence ao grupo muscular previsto para aquele slot
- **+80** se e favorito do aluno e esta no grupo certo, **+18** se favorito em outro grupo
- **+16** se e um movimento composto e cai nos dois primeiros slots do dia
- **+4** se e classificado como nivel iniciante

O desempate e alfabetico, entao o resultado e deterministico: as mesmas
preferencias sempre geram o mesmo plano. Depois de montada a semana, o gerador
confere a cobertura contra sete grupos considerados essenciais e sinaliza nas
notas o que ficou de fora.

A quantidade de exercicios por sessao vem do tempo disponivel e do nivel, e os
equipamentos escolhidos filtram o catalogo antes da pontuacao.

## Estrutura

```
prisma/schema.prisma      7 models e o enum Weekday
prisma/migrations/        historico de migrations do banco
src/app/api/              11 rotas REST
src/components/           CoreUpApp e componentes de UI
src/data/exercises.json   catalogo de 200 exercicios
src/lib/                  auth, prisma, schemas, gerador de treino
src/types/fitness.ts      tipos de dominio
```

## Sobre os dados

O catalogo de exercicios e um JSON estatico, nao uma tabela. Por isso as rotas
que recebem `exerciseId` validam manualmente contra o catalogo antes de gravar,
ja que nao existe chave estrangeira cobrindo essa relacao.

## Seguranca e LGPD

- **Limite de tentativas:** login bloqueia por 15 minutos apos 5 senhas erradas
  no mesmo e-mail ou 20 no mesmo IP; cadastro aceita 5 contas por IP por hora;
  exclusao de conta bloqueia apos 5 senhas erradas. As tentativas ficam na
  tabela `AuthAttempt`, porque na Vercel cada requisicao pode cair numa
  instancia diferente. A API responde `429` com o cabecalho `Retry-After`.
- **Consentimento:** o cadastro exige aceite da Politica de Privacidade e do uso
  dos dados de saude. A data fica em `User.privacyAcceptedAt`.
- **Politica de Privacidade:** pagina em `/privacidade`. O e-mail de contato e a
  data de atualizacao ficam em `src/lib/legal.ts`.
- **Exclusao de conta:** aba Evolucao, secao Conta. Apaga o usuario e, em
  cascata, sessoes, treinos, historico e medidas.

## Contas de profissional

- O tipo de conta (`User.accountType`) e definido no cadastro e lido do banco
  em toda requisicao. O login nao pede o tipo: ele vem da conta salva.
- Os dados do registro ficam em `ProfessionalProfile`. Um mesmo CREF + UF nao
  pode estar em duas contas.
- Nao ha integracao com o CONFEF/CREF: todo cadastro nasce com
  `verificationStatus = PENDING` e a interface mostra "Verificacao pendente".
  Para marcar um registro como conferido, altere o status para `VERIFIED` no
  banco depois de checar o CREF manualmente.
- Os treinos avaliaveis estao em `src/data/reviewable-workouts.ts`. A chave de
  cada treino liga as avaliacoes gravadas em `WorkoutReview`; nao altere uma
  chave existente.
