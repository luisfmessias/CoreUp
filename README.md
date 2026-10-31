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
npm run admin:create   # cria a conta de administrador (primeiro acesso)
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
| `DELETE` | `/api/me` | sim | exclui a conta e os dados dela (a solicitacao profissional e mantida sem e-mail), exige `password` no corpo |
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
| `PUT` | `/api/reviews/[workoutKey]` | profissional ou admin | cria ou edita a avaliacao do usuario logado |
| `DELETE` | `/api/reviews/[workoutKey]` | profissional ou admin | remove a avaliacao do usuario logado |
| `POST` | `/api/professional-requests` | sim | nova solicitacao profissional de quem ja tem conta (ex.: apos rejeicao, com outro CREF) |
| `GET` | `/api/notifications` | sim | ultimas 50 notificacoes e total de nao lidas |
| `PATCH` | `/api/notifications` | sim | marca como lidas as notificacoes em `ids` (ou todas) |
| `GET` | `/api/admin/professional-requests` | admin | solicitacoes, filtra por `status`, com contagem por status |
| `GET` | `/api/admin/professional-requests/[id]` | admin | detalhes de uma solicitacao |
| `POST` | `/api/admin/professional-requests/[id]/approve` | admin | aprova; exige `crefChecked: true` |
| `POST` | `/api/admin/professional-requests/[id]/reject` | admin | rejeita; `reason` opcional |
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

## Papeis e aprovacao de profissionais

| Papel (`User.accountType`) | Acesso |
| --- | --- |
| `USER` | todas as funcionalidades comuns |
| `PROFESSIONAL` | tudo do `USER` + avaliar treinos; so existe depois de aprovado |
| `ADMIN` | tudo dos anteriores + area administrativa (aba Admin) |

O papel e lido do banco em toda requisicao. O login nao pede o tipo de conta.

### Primeiro acesso do administrador

```bash
npm run admin:create
```

O script pede e-mail, nome e senha no terminal (a senha nao aparece ao digitar)
e cria a conta ja como `ADMIN`. Tambem aceita `ADMIN_EMAIL`, `ADMIN_NAME` e
`ADMIN_PASSWORD` como variaveis de ambiente. Se o e-mail ja existir, a conta e
promovida a `ADMIN` sem trocar a senha. Depois disso, entre pelo login normal.
O cadastro do app nunca cria administradores.

### Fluxo do cadastro profissional

1. A pessoa escolhe "Profissional de Educacao Fisica" no cadastro. A conta e
   criada como `USER` e uma `ProfessionalRequest` fica `PENDING`.
2. Todo `ADMIN` recebe uma notificacao persistida (`Notification`).
3. Na aba Admin, o administrador confere o CREF no CONFEF/CREF do estado e
   aprova (precisa marcar a confirmacao) ou rejeita (motivo opcional). Data e
   responsavel ficam registrados.
4. Ao aprovar, a conta vira `PROFESSIONAL`. Nas duas decisoes, o profissional
   recebe uma notificacao. O app relê a conta a cada 30 s e quando a janela
   volta ao foco, entao o status muda sem novo cadastro.

### Regras do CREF

- O numero e normalizado para o formato oficial `000000-G` (6 digitos e
  categoria G ou P); aceita variacoes como `cref 12345 g/sp`.
- `ProfessionalRequest.crefKey` (`000000/UF`) e unico no banco e ignora a
  categoria, entao trocar G por P ou usar outro e-mail nao libera o registro.
  Cadastros simultaneos com o mesmo CREF esbarram nesse indice.
- Uma solicitacao `PENDING`, `APPROVED` ou `REJECTED` bloqueia o CREF para
  sempre. Excluir a conta nao apaga a solicitacao (`userId` vira `null`).
- Quem foi rejeitado pode enviar uma nova solicitacao com outro CREF pela secao
  Conta (aba Evolucao).

### Treinos avaliaveis

Ficam em `src/data/reviewable-workouts.ts`. A chave de cada treino liga as
avaliacoes gravadas em `WorkoutReview`; nao altere uma chave existente.
