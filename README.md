# escala7 💒

> **Sistema Moderno e Inteligente de Gestão de Escalas Eclesiásticas para a Igreja Adventista do Sétimo Dia (IASD)**

O **escala7** foi desenvolvido sob medida para suprir as particularidades organizacionais e de culto da Igreja Adventista do Sétimo Dia. O sistema une estética visual oficial com governança departamental descentralizada, validações inteligentes anti-conflito, privacidade estrita de dados e exportação de artes oficiais para compartilhamento em grupos de WhatsApp.

---

## 🌟 1. Modelo Estrutural & Arquitetura

O sistema adota uma arquitetura em camadas construída sobre **Next.js (App Router)**, com suporte nativo a banco de dados relacional **Supabase (PostgreSQL)** com **Row Level Security (RLS)** e deployment global na infraestrutura da **Cloudflare** (Cloudflare Pages ou Cloudflare Tunnel).

```
┌───────────────────────────────────────────────────────────┐
│                    escala7 (Frontend)                     │
│    Next.js 16 • React 19 • Tailwind CSS • Lucide Icons    │
└─────────────┬───────────────────────────────┬─────────────┘
              │                               │
       (Acesso Público)              (Ações de Liderança)
              │                               │
              ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  Visualização Protegida   │   │  Painel de Gestão & Login │
│  • Escalas Publicadas     │   │  • WhatsApp + Senha       │
│  • Contatos Ocultados [🔒]│   │  • Gestão por Departamento│
│  • Arte Gráfica Oficial   │   │  • Trocas & Ausências     │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│                    Camada de Backend                      │
│            Next.js API Routes / Cloudflare Edge           │
│     • Validação Anti-Conflito entre Departamentos         │
│     • Verificação de Permissões Eclesiásticas             │
│     • Sanitização de Dados Sensíveis (Sem senhas no JSON) │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL em Nuvem)               │
│   • Row Level Security (RLS) ativo em todas as tabelas    │
│   • Políticas para Leitura Pública vs Modificação Líder   │
│   • Relacionamento Departamentos, Membros e Escalas       │
└───────────────────────────────────────────────────────────┘
```

---

## 📋 2. Regras de Negócio e Governança Eclesiástica

### 2.1 Perfis de Acesso e Permissões
- **Visitante / Deslogado (Modo Público)**:
  - Visualiza livremente todas as escalas publicadas do mês vigente.
  - **Proteção Estrita de Contatos**: Telefones, e-mails e botões diretos de WhatsApp ficam ocultos com o selo `[🔒 Protegido]`. Visitantes não conseguem ver nem clicar nos contatos dos voluntários.
  - Não pode elaborar escalas nem cadastrar membros.
- **Voluntário Comum (Membro Logado)**:
  - Autentica-se informando seu **WhatsApp** cadastrado e sua **senha de acesso**.
  - Visualiza contatos dos irmãos para fins de alinhamento e culto.
  - Pode **solicitar troca de escala** ou **sinalizar aviso de ausência** em suas próprias alocações.
  - Não pode criar escalas nem alterar voluntários de outros departamentos.
  - Pode alterar sua senha a qualquer momento clicando no botão **`[🔑 Alterar Senha]`** ao lado do seu nome.
- **Líder / Responsável de Departamento**:
  - Possui autoridade exclusiva sobre o(s) departamento(s) para o qual foi formalmente designado.
  - Cria, edita e publica escalas do seu ministério.
  - Aprova ou recusa solicitações de trocas e substituições de voluntários desistentes.
  - Pode cadastrar novos membros e indicar irmãos para líderes (ficando como *Indicação Pendente* até aprovação do Administrador).
  - Um líder **não interfere** nos outros departamentos da igreja, mantendo a ordem e autonomia pastoral.
- **Administrador Geral**:
  - Sem restrições de departamento.
  - Autenticado de forma segura via variável de ambiente (`ADMIN_PIN`).
  - Único autorizado a alterar as informações institucionais da igreja (nome, distrito, cidade).
  - Aprova indicações de liderança ou define líderes de departamento de forma direta sem confirmação.

### 2.2 Regras de Escalas e Cultos
1. **Padrão dos Cultos da IASD**:
   - O botão de preenchimento inteligente gera automaticamente as datas em ordem dos cultos semanais: **Sábado** (Escola Sabatina e Culto Divino), **Quarta-feira** (Culto de Oração) e **Domingo** (Culto Evangelístico).
2. **Particularidade do Diaconato**:
   - Na escala do ministério de Diaconato, o preenchimento exige **2 pessoas por culto**: obrigatoriamente **1 Diácono** e **1 Diaconisa**.
3. **Regra de Ouro Anti-Conflito**:
   - O sistema bloqueia a alocação de um mesmo membro em mais de uma função no mesmo dia/culto.
   - Realiza validação cruzada entre departamentos (ex: se um voluntário já está escalado na Sonoplastia no sábado de manhã, o Diaconato é impedido de escalá-lo no mesmo dia).
4. **Crianças e Dependentes**:
   - O sistema permite cadastrar crianças/dependentes que participam de ministérios infantis ou sonoplastia/música sem telefone próprio, vinculando o cadastro ao **WhatsApp do adulto responsável**. O número principal permanece vinculado ao adulto.
5. **Responsável pela Escala**:
   - O campo de autoria é preenchido automaticamente com o nome da liderança que elaborou o documento.
6. **Títulos Oficiais por Extenso**:
   - Os títulos seguem o padrão denominacional por extenso: `Escala de [Departamento] - [Mês por Extenso]` (Ex: *Escala de Sonoplastia e Mídia - Setembro*).

---

## 🎨 3. Visão Simplificada vs Visão Detalhada

- **Visão Simplificada**: Exibição limpa em tabela, focada nos cultos e nos nomes dos voluntários escalados. Ideal para visualização rápida no celular.
- **Visão Detalhada**: Exibição rica em cards individuais por culto, dividida por blocos técnicos e cargos específicos (ex: Mesa de Som, Transmissão, Slides, Diácono da Plataforma, etc.).
- **Download de Artes Gráficas (JPG Oficial)**:
  - Botão de exportação direta que gera uma arte de alta qualidade com o padrão **Azul IASD Oficial (`#002F6C`)**, logotipo vetorizado da igreja e tipografia moderna para publicação em redes sociais e grupos de avisos.

---

## 🗄️ 4. Configuração do Supabase (PostgreSQL + RLS)

O **escala7** já possui o script SQL completo pronto para uso em [`supabase/schema.sql`](supabase/schema.sql).

### Passo a Passo de Instalação no Supabase:
1. Acesse o console do [Supabase](https://supabase.com) e crie um novo projeto (ex: `escala7-iasd`).
2. No menu lateral esquerdo, vá em **SQL Editor**.
3. Clique em **New Query**, cole o conteúdo completo do arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
4. O script criará:
   - Todas as tabelas com chaves primárias e relacionamentos com integridade referencial.
   - Índices de alta performance para busca por telefone, datas e departamentos.
   - Ativação de **Row Level Security (RLS)** em todas as tabelas.
   - Políticas de segurança para leitura pública controlada e gravação exclusiva para liderança.
   - Dados iniciais (*seed*) com os departamentos e cargos oficiais da IASD.
5. Obtenha suas credenciais em **Project Settings -> API**:
   - `Project URL` (URL do projeto)
   - `anon` `public` (Chave pública anônima)
   - `service_role` (Chave secreta de serviço - usada exclusivamente no servidor)

---

## ☁️ 5. Deployment na Cloudflare

O projeto é 100% otimizado para a infraestrutura de borda da **Cloudflare**.

### Opção A: Cloudflare Pages (Recomendado para Produção)
1. No painel da Cloudflare, acesse **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**.
2. Selecione o repositório **`escala7`**.
3. Defina as configurações de compilação:
   - **Framework Preset**: `Next.js`
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
4. Na aba **Environment Variables**, adicione as variáveis necessárias:
   - `NEXT_PUBLIC_SUPABASE_URL`: sua URL do Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: sua chave anônima pública.
   - `SUPABASE_SERVICE_ROLE_KEY`: sua chave de serviço.
   - `ADMIN_PIN`: o PIN mestre da igreja para o Administrador Geral.
5. Clique em **Save and Deploy**. O sistema estará disponível globalmente com HTTPS automático e CDN de alta velocidade.

### Opção B: Cloudflare Tunnel (Para Servidor Próprio / Instância Local)
Caso prefira executar o sistema em um servidor próprio ou máquina local com link seguro:
```bash
cloudflared tunnel --protocol http2 --edge-ip-version 4 --url http://localhost:3000
```

---

## 🔒 6. Segurança e Variáveis de Ambiente

Nenhuma senha, chave privada ou PIN é versionado no repositório. O projeto utiliza o arquivo [`.env.example`](.env.example) como modelo:

```bash
# 1. Crie seu arquivo local a partir do exemplo:
cp .env.example .env.local

# 2. Edite o .env.local com suas configurações privadas:
ADMIN_PIN=seu_pin_administrativo_aqui
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publica_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_chave_secreta_aqui
```

### Práticas de Segurança Implementadas:
- **Proteção Anti-Scraping**: Visitantes deslogados não recebem números de telefone nos elementos interativos da escala.
- **Higienização de APIs**: Endpoints públicos e listagens de membros removem explicitamente a coluna `password` antes do envio do JSON.
- **PIN Desacoplado**: O PIN administrativo é validado exclusivamente no servidor através de variável de ambiente, nunca exposto no bundle Javascript do cliente.
- **Sem senhas em texto puro**: Senhas de membros utilizam hashing criptográfico e senhas padrão iniciais exigem alteração no primeiro acesso.

---

## 🛠️ 7. Execução Local para Desenvolvimento

```bash
# 1. Instalar as dependências do projeto
npm install

# 2. Iniciar o servidor local
npm run dev

# 3. Acessar no navegador
http://localhost:3000
```

Para verificar a integridade dos tipos do TypeScript antes de commitar:
```bash
npx tsc --noEmit
```

---

## 📄 Licença e Contribuição

Desenvolvido para apoio às igrejas e congregações da Igreja Adventista do Sétimo Dia. Todos os direitos reservados.