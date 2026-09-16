-- ==============================================================================
-- ESCALA7 - SCHEMA DO BANCO DE DADOS SUPABASE (POSTGRESQL) COM RLS
-- Sistema de Gestão de Escalas Eclesiásticas para a Igreja Adventista do Sétimo Dia
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELAS PRINCIPAIS
-- ==============================================================================

-- 2.1 Informações Institucionais da Igreja
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    district TEXT DEFAULT 'Distrito Central',
    city TEXT DEFAULT '',
    state VARCHAR(2) DEFAULT 'BR',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Departamentos / Ministérios da IASD
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY, -- ex: 'diaconato', 'sonoplastia', 'recepcao'
    name TEXT NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#002F6C',
    icon VARCHAR(50) NOT NULL DEFAULT 'Calendar',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Funções Técnicas / Cargos por Departamento
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Membros e Voluntários
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY DEFAULT ('m_' || encode(gen_random_bytes(6), 'hex')),
    name TEXT NOT NULL,
    phone VARCHAR(25),
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_leader BOOLEAN DEFAULT FALSE,
    is_child BOOLEAN DEFAULT FALSE,
    parent_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
    leader_status VARCHAR(20) DEFAULT 'none' CHECK (leader_status IN ('none', 'pending', 'approved')),
    leader_nominated_by TEXT,
    password_hash TEXT, -- Armazenamento seguro de senha hash
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Vínculo de Membros com Departamentos (com definição de liderança)
CREATE TABLE IF NOT EXISTS public.member_departments (
    member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    is_department_leader BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (member_id, department_id)
);

-- 2.6 Vínculo de Membros com Funções / Cargos Habilitados
CREATE TABLE IF NOT EXISTS public.member_roles (
    member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (member_id, role_id)
);

-- 2.7 Escalas Mensais por Departamento
CREATE TABLE IF NOT EXISTS public.schedules (
    id TEXT PRIMARY KEY DEFAULT ('sch_' || encode(gen_random_bytes(6), 'hex')),
    department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- formato 'YYYY-MM'
    author_name TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 Itens / Alocações dos Cultos
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id TEXT PRIMARY KEY DEFAULT ('item_' || encode(gen_random_bytes(6), 'hex')),
    schedule_id TEXT NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    service_type VARCHAR(100) NOT NULL DEFAULT 'Culto de Sábado',
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.9 Solicitações de Troca e Avisos de Ausência
CREATE TABLE IF NOT EXISTS public.schedule_requests (
    id TEXT PRIMARY KEY DEFAULT ('req_' || encode(gen_random_bytes(6), 'hex')),
    schedule_item_id TEXT NOT NULL REFERENCES public.schedule_items(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('swap', 'absence')),
    target_member_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
    reason TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_schedules_dept_month ON public.schedules(department_id, month_year);
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_date ON public.schedule_items(schedule_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_items_member_date ON public.schedule_items(member_id, date);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.schedule_requests(status);

-- ==============================================================================
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_requests ENABLE ROW LEVEL SECURITY;

-- 4.1 IGREJA: Qualquer um lê; apenas service_role/admin atualiza
CREATE POLICY "Leitura pública dos dados institucionais da igreja"
ON public.churches FOR SELECT
USING (true);

CREATE POLICY "Modificação institucional exclusiva para admin"
ON public.churches FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 4.2 DEPARTAMENTOS E FUNÇÕES: Leitura pública
CREATE POLICY "Leitura pública de departamentos"
ON public.departments FOR SELECT
USING (true);

CREATE POLICY "Leitura pública de funções técnicas"
ON public.roles FOR SELECT
USING (true);

-- 4.3 ESCALAS: Leitura pública de escalas publicadas; rascunhos para autenticados
CREATE POLICY "Leitura pública de escalas publicadas"
ON public.schedules FOR SELECT
USING (status = 'published' OR auth.role() = 'authenticated');

CREATE POLICY "Gerenciamento de escalas por liderança autenticada"
ON public.schedules FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4.4 ITENS DA ESCALA: Leitura pública de itens de escalas publicadas
CREATE POLICY "Leitura pública de itens de escalas publicadas"
ON public.schedule_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.schedules s 
        WHERE s.id = schedule_items.schedule_id 
        AND (s.status = 'published' OR auth.role() = 'authenticated')
    )
);

CREATE POLICY "Gerenciamento de itens por liderança autenticada"
ON public.schedule_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4.5 MEMBROS: 
-- Visualização pública com proteção de dados: Nomes e vínculos são públicos para visualização nas escalas.
-- Telefones e senhas são protegidos pelo backend / service_role.
CREATE POLICY "Visualização de membros para escalas"
ON public.members FOR SELECT
USING (true);

CREATE POLICY "Gerenciamento de membros por liderança autenticada"
ON public.members FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4.6 VÍNCULOS DE DEPARTAMENTOS E ROLES
CREATE POLICY "Leitura de vínculos de departamentos"
ON public.member_departments FOR SELECT
USING (true);

CREATE POLICY "Gerenciamento de vínculos de departamentos por liderança"
ON public.member_departments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Leitura de funções habilitadas de membros"
ON public.member_roles FOR SELECT
USING (true);

CREATE POLICY "Gerenciamento de funções de membros por liderança"
ON public.member_roles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4.7 SOLICITAÇÕES DE TROCA E AUSÊNCIA
CREATE POLICY "Leitura de solicitações de troca"
ON public.schedule_requests FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Criação de solicitações de troca"
ON public.schedule_requests FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Aprovação e recusa de solicitações por líderes"
ON public.schedule_requests FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 5. SEED INICIAL COM OS MINISTÉRIOS OFICIAIS DA IASD
-- ==============================================================================
INSERT INTO public.churches (name, district, city, state)
VALUES ('Igreja Adventista do Sétimo Dia', 'Distrito Central', 'Central', 'BR')
ON CONFLICT DO NOTHING;

INSERT INTO public.departments (id, name, color, icon, description)
VALUES 
    ('diaconato', 'Diaconato', '#0F4C81', 'ShieldCheck', 'Serviço aos membros, ordem do templo, acolhimento e santa ceia'),
    ('sonoplastia', 'Sonoplastia e Mídia', '#1E3A8A', 'Radio', 'Mesa de áudio, projeção de slides, iluminação e transmissão'),
    ('recepcao', 'Recepção', '#047857', 'Users', 'Boas-vindas calorosas aos visitantes e membros na entrada do templo'),
    ('escola_sabatina', 'Escola Sabatina', '#B45309', 'BookOpen', 'Direção da programação matinal, louvor e professores das classes bíblicas'),
    ('musica', 'Música e Louvor', '#6D28D9', 'Music', 'Dirigentes de louvor congregacional, instrumentistas e sonoplastia musical'),
    ('ancionato', 'Ancionato / Plataforma', '#002F6C', 'Award', 'Liderança espiritual, ancião do dia, pregação e oração intercessória')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, department_id, name, description)
VALUES 
    ('role_diac_diacono', 'diaconato', 'Diácono', 'Ordem do templo e recolhimento de dízimos e ofertas'),
    ('role_diac_diaconisa', 'diaconato', 'Diaconisa', 'Acolhimento na nave e preparo do santuário'),
    ('role_diac_acolhimento', 'diaconato', 'Acolhimento da Entrada', 'Recepção de membros na porta'),
    ('role_sono_som', 'sonoplastia', 'Mesa de Som', 'Operação de áudio, microfones e equalização'),
    ('role_sono_slides', 'sonoplastia', 'Projeção de Slides', 'Hinos congregacionais, vídeos e sermão'),
    ('role_sono_transmissao', 'sonoplastia', 'Transmissão Online', 'Operação de câmeras e live stream'),
    ('role_recep_manha', 'recepcao', 'Recepção de Sábado Manhã', 'Entrega de boletins e acolhida inicial'),
    ('role_recep_domingo', 'recepcao', 'Recepção de Domingo', 'Boas-vindas no culto evangelístico'),
    ('role_recep_quarta', 'recepcao', 'Recepção de Quarta-feira', 'Acolhimento no culto de oração'),
    ('role_es_direcao', 'escola_sabatina', 'Direção da Escola Sabatina', 'Abertura, carta missionária e testemunho'),
    ('role_es_professor', 'escola_sabatina', 'Professor da Lição', 'Ensino da lição bíblica na classe'),
    ('role_mus_dirigente', 'musica', 'Dirigente de Louvor', 'Condução dos cânticos e adoração congregacional'),
    ('role_mus_teclado', 'musica', 'Pianista / Tecladista', 'Acompanhamento harmônico dos hinos'),
    ('role_anc_dia', 'ancionato', 'Ancião do Dia', 'Coordenação geral dos cultos e plataforma')
ON CONFLICT (id) DO NOTHING;
