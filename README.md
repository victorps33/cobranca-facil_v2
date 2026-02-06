# Cobrança Fácil - Mockup Asaas

Uma plataforma de gestão de cobranças completa com emissão de boletos (simulada) e régua de cobrança (simulada). Construída para demonstração e testes.

## 🚀 Features

- **Dashboard** com métricas em tempo real
- **Gestão de Clientes** - CRUD completo
- **Gestão de Cobranças** - Criar, editar, marcar como paga, cancelar
- **Emissão de Boleto** (simulado) - Linha digitável, código de barras, página pública
- **Régua de Cobrança** - Configuração de steps (D-5, D-1, D0, D+3, D+7)
- **Notificações** - E-mail, SMS, WhatsApp (simulados)
- **Simulação de Tempo** - Avance dias para testar a régua

## 🛠️ Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Prisma** + **PostgreSQL (Supabase)**

## 🚀 Deploy na Vercel

### 1. Configurar Supabase

1. Crie uma conta em https://supabase.com
2. Crie um novo projeto
3. Vá em **Connect** > **ORMs** > **Prisma**
4. Copie as URLs `DATABASE_URL` e `DIRECT_URL`

### 2. Subir para o GitHub

1. Crie um repositório no GitHub
2. Faça upload dos arquivos do projeto

### 3. Deploy na Vercel

1. Acesse https://vercel.com
2. Clique em **"Add New Project"**
3. Importe o repositório do GitHub
4. Em **Environment Variables**, adicione:
   - `DATABASE_URL` = sua URL do Supabase (com pooler, porta 6543)
   - `DIRECT_URL` = sua URL direta do Supabase (porta 5432)
5. Clique em **Deploy**

### 4. Criar tabelas e popular dados

Após o deploy, rode localmente uma vez para criar as tabelas:

```bash
# Clone o projeto
git clone seu-repositorio
cd asaas-mockup

# Instale dependências
npm install

# Crie arquivo .env com suas URLs do Supabase
# DATABASE_URL="postgresql://..."
# DIRECT_URL="postgresql://..."

# Crie as tabelas no Supabase
npx prisma db push

# Popule com dados de exemplo
npx prisma db seed
```

## 📦 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Criar arquivo .env com as URLs do Supabase
cp .env.example .env
# Edite o .env com suas credenciais

# Criar tabelas
npx prisma db push

# Popular banco com dados de exemplo
npx prisma db seed

# Iniciar servidor de desenvolvimento
npm run dev
```

O app estará disponível em [http://localhost:3000](http://localhost:3000)

## 🎮 Como demonstrar

### 1. Explore o Dashboard

O dashboard mostra:
- Cobranças pendentes (valor total)
- Cobranças vencendo em 7 dias
- Cobranças vencidas (overdue)
- Cobranças pagas nos últimos 30 dias

### 2. Gerencie Clientes

- Acesse `/clientes`
- Crie novos clientes
- Visualize cobranças de cada cliente

### 3. Gerencie Cobranças

- Acesse `/cobrancas`
- Crie novas cobranças
- Gere boletos
- Marque como paga ou cancele

### 4. Configure a Régua de Cobrança

- Acesse `/reguas`
- A régua padrão já vem configurada com:
  - **D-5**: E-mail de lembrete
  - **D-1**: WhatsApp de lembrete
  - **D+3**: SMS de cobrança
  - **D+7**: WhatsApp de negociação
- Adicione ou edite steps usando os templates prontos

### 5. Simule a passagem do tempo

No Dashboard, use os botões:

1. **"Rodar régua agora"** - Executa a régua para a data atual
2. **"Simular passar 7 dias"** - Avança 7 dias e executa a régua
3. **"Resetar data demo"** - Volta para a data real

Ao simular dias, observe:
- Cobranças pendentes virando vencidas
- Notificações sendo criadas nos Logs
- O banner no topo mostrando "Data do sistema: XX/XX/XXXX (Simulada)"

### 6. Visualize os Logs

- Acesse `/logs` para ver todas as notificações enviadas
- Filtre por canal (E-mail, SMS, WhatsApp) e status

### 7. Acesse Boletos

- Clique em "Abrir página pública" em qualquer cobrança com boleto
- A página `/boleto/[id]` é pública e mostra:
  - Dados do cliente
  - Valor e vencimento
  - Código de barras (simulado)
  - Linha digitável (copiável)
  - Botão de impressão

## 📁 Estrutura do Projeto

```
├── app/
│   ├── (dashboard)/          # Layout com sidebar
│   │   ├── page.tsx          # Dashboard
│   │   ├── clientes/         # Páginas de clientes
│   │   ├── cobrancas/        # Páginas de cobranças
│   │   ├── reguas/           # Páginas de réguas
│   │   └── logs/             # Página de logs
│   ├── api/                  # Route handlers REST
│   └── boleto/[id]/          # Página pública do boleto
├── components/
│   ├── ui/                   # Componentes shadcn/ui
│   ├── sidebar.tsx
│   └── topbar.tsx
├── lib/
│   ├── prisma.ts             # Cliente Prisma singleton
│   ├── utils.ts              # Utilitários (tempo, templates, etc)
│   └── cn.ts                 # Utilitário classnames
└── prisma/
    ├── schema.prisma         # Schema do banco
    └── seed.ts               # Dados iniciais
```

## 🔌 APIs Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/customers` | GET, POST | Listar/criar clientes |
| `/api/customers/[id]` | GET, PATCH, DELETE | Detalhe/editar/excluir cliente |
| `/api/charges` | GET, POST | Listar/criar cobranças |
| `/api/charges/[id]` | GET, PATCH, DELETE | Detalhe/editar/excluir cobrança |
| `/api/charges/[id]/generate-boleto` | POST | Gerar boleto |
| `/api/dunning-rules` | GET, POST | Listar/criar réguas |
| `/api/dunning-rules/[id]` | GET, PATCH, DELETE | Detalhe/editar/excluir régua |
| `/api/dunning-steps` | GET, POST | Listar/criar steps |
| `/api/dunning-steps/[id]` | GET, PATCH, DELETE | Detalhe/editar/excluir step |
| `/api/logs` | GET | Listar notificações |
| `/api/jobs/run-dunning` | POST | Executar régua de cobrança |
| `/api/demo/advance?days=N` | POST | Avançar N dias (simulação) |
| `/api/demo/reset` | POST | Resetar para data real |
| `/api/dashboard/stats` | GET | Estatísticas do dashboard |

## 🎨 Variáveis do Template

Use estas variáveis nos templates da régua:

- `{{nome}}` - Nome do cliente
- `{{valor}}` - Valor formatado (R$ X.XXX,XX)
- `{{vencimento}}` - Data de vencimento (dd/MM/yyyy)
- `{{link_boleto}}` - URL pública do boleto
- `{{descricao}}` - Descrição da cobrança

## 📝 Notas

- **Sem autenticação**: O sistema é totalmente aberto para facilitar demonstrações
- **Dados locais**: Tudo é persistido no SQLite local (`prisma/dev.db`)
- **Boletos simulados**: A linha digitável e código de barras são gerados de forma determinística a partir dos dados da cobrança
- **Notificações simuladas**: Nenhum e-mail, SMS ou WhatsApp real é enviado

## 🔄 Resetar o banco de dados

```bash
# Remove o banco e recria do zero
npx prisma migrate reset
```

## 📄 Licença

Este projeto é um mockup para demonstração. Livre para uso educacional e testes.MM/yyyy)
- `{{link_boleto}}` - Link público do boleto
- `{{descricao}}` - Descrição da cobrança

## 📝 Licença

Este projeto é apenas para fins de demonstração.

---

Desenvolvido com ❤️ usando Next.js, Tailwind e shadcn/ui
