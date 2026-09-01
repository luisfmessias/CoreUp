# CoreUp

App de academia que monta a rotina semanal de treino a partir das preferencias
do aluno, acompanha a execucao e registra a evolucao corporal.

Construido como aplicacao mobile-first: a interface tem 430px de largura maxima
e navegacao inferior em cinco abas, no formato de um app nativo.

## Stack

- **Next.js 16** com App Router e React 19
- **TypeScript** em modo estrito
- **Tailwind CSS 4** via plugin PostCSS
- **Prisma 6** sobre SQLite
- **Zod 4** para validacao de entrada
- **bcrypt** e **jsonwebtoken** para autenticacao

## Funcionalidades

| Aba | O que faz |
| --- | --- |
| Inicio | treino do dia, metricas do mes e cobertura por grupo muscular |
| Montar | gerador de plano a partir de objetivo, nivel, dias, tempo, equipamentos e favoritos |
| Treino | rotina da semana, com criacao e remocao de dias |
| Exercicios | busca no catalogo de 200 exercicios, com filtro por grupo |
| Evolucao | habitos de treino e cobertura semanal do plano |

## Como rodar

```bash
npm install
cp .env.example .env
npm run db:init      # cria o SQLite com as 7 tabelas
npm run prisma:generate
npm run dev
```

A aplicacao sobe em `http://localhost:3000`. Crie uma conta pela tela de
cadastro para comecar.

### Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DATABASE_URL` | sim | caminho do SQLite, por exemplo `file:./dev.db` |
| `JWT_SECRET` | em producao | segredo de assinatura das sessoes |
| `SESSION_TTL_DAYS` | nao | validade da sessao em dias, padrao `30` |

Sem `JWT_SECRET` a aplicacao usa um segredo de desenvolvimento e recusa subir
em producao.

## API

Rotas autenticadas esperam o cabecalho `Authorization: Bearer <token>`.

| Metodo | Rota | Auth | Descricao |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | nao | cria conta e ja devolve sessao |
| `POST` | `/api/auth/login` | nao | autentica e devolve token |
| `POST` | `/api/auth/logout` | sim | revoga a sessao atual |
| `GET` | `/api/me` | sim | dados do usuario logado |
| `GET` | `/api/exercises` | nao | catalogo, filtra por `q`, `grupoMuscular`, `nivel` |
| `GET` | `/api/exercises/[id]` | nao | exercicio unico |
| `GET` | `/api/workouts` | sim | treinos do usuario, filtra por `weekday` |
| `POST` | `/api/workouts` | sim | cria treino com exercicios |
| `GET` | `/api/workouts/[id]` | sim | treino unico |
| `PUT` | `/api/workouts/[id]` | sim | atualiza treino |
| `DELETE` | `/api/workouts/[id]` | sim | remove treino |
| `GET` | `/api/history` | sim | ultimos 50 registros de execucao |
| `POST` | `/api/history` | sim | registra treino executado |
| `GET` | `/api/body-metrics` | sim | ultimas 100 medicoes |
| `POST` | `/api/body-metrics` | sim | registra medicao e atualiza o perfil |
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
scripts/init-db.mjs       cria as tabelas via node:sqlite
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
