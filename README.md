# Quiosque do Coco — API

API REST do sistema de PDV e gestão de turnos do Quiosque do Coco.
NestJS 10 + MongoDB (Mongoose) + JWT em cookie `httpOnly`.

- Repositório do frontend: `quiosque-do-coco-web`
- Documentação interativa: `/api/docs` (Swagger)

## Requisitos

- Node.js 20+
- MongoDB 7 (local, Docker ou Atlas)

## Desenvolvimento

```bash
npm install
cp .env.example .env    # ajuste se necessário
npm run start:dev       # http://localhost:4000
```

O Mongo local pode ser iniciado pelo `docker-compose.yml` da raiz do workspace
(`docker compose up -d mongodb`). Em produção usamos **MongoDB Atlas** — a API
não roda banco de dados na VPS.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `4000` | Porta da API |
| `NODE_ENV` | `development` | `production` ativa cookie `Secure` + `SameSite=None` |
| `MONGODB_URI` | `mongodb://localhost:27017/quiosque` | Conexão Mongo |
| `JWT_SECRET` | — | Obrigatório em produção |
| `JWT_EXPIRES` | `12h` | Validade do token |
| `FRONTEND_URL` | `http://localhost:5173` | Origem liberada no CORS (URL do Vercel em produção) |

### Scripts

| Comando | Função |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Executa `dist/main` |
| `npm run seed:full` | Popula banco com dados de demonstração |

O boot também cria usuários e produtos básicos se o banco estiver vazio
(`admin/admin123`, `responsavel/resp123`, `atendente/atend123`). **Troque essas
senhas em produção.**

## Módulos

`auth` (JWT em cookie, papéis admin/responsável/atendente) · `users` ·
`products` · `shifts` · `orders` · `payments` · `refunds` · `stock` · `cash` ·
`reports` · `audit` · `seed`.

## Deploy na VPS (Docker + Caddy)

```bash
# no servidor, dentro do repositório
cp .env.example .env
# edite .env:
#   NODE_ENV=production
#   JWT_SECRET=<segredo forte>
#   FRONTEND_URL=https://<seu-projeto>.vercel.app

docker compose up -d --build
```

O container publica **apenas** `127.0.0.1:4000` e entra na rede externa `edge`,
compartilhada com o Caddy. O HTTPS fica com o Caddy:

```caddy
quiosque-api.seudominio.com {
    reverse_proxy quiosque-api:4000
}
```

### Deploy automático

Todo push na `main` dispara o workflow `.github/workflows/deploy.yml`, que acessa
a VPS por SSH e executa `git pull` + rebuild do container da API. Segredos
necessários no repositório: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e
`VPS_APP_DIR` (ex.: `/home/ubuntu/quiosque-api`).

Como o frontend (Vercel) e a API (VPS) são sites diferentes, o cookie de sessão
usa `SameSite=None; Secure` em produção. Por isso a API **precisa** ser servida
por HTTPS e `FRONTEND_URL` deve ser a URL exata do Vercel.

## Estado atual

- Autenticação e autorização por papel implementadas.
- 60 rotas documentadas no Swagger.
- Sem testes automatizados e sem lint configurado (pendências conhecidas).
