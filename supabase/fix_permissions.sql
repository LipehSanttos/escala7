-- ==============================================================================
-- ESCALA7: CORREÇÃO DE PERMISSÕES DO SCHEMA PUBLIC NO SUPABASE
-- Execute este comando no SQL Editor do Supabase para corrigir o erro
-- "permission denied for table departments"
-- ==============================================================================

-- 1. Conceder uso do schema public para anon (visitantes) e authenticated (logados)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Conceder permissões em todas as tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Garantir permissões automáticas para quaisquer tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Observação: Como o RLS (Row Level Security) já está habilitado em todas as tabelas,
-- as regras de segurança continuam ativas (visitantes só lêem o permitido, gravação só para líderes).
