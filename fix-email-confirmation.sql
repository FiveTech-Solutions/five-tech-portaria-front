-- Script para resolver problemas de confirmação de email no Supabase
-- Execute este script se estiver enfrentando erro "Email not confirmed"

-- OPÇÃO 1: Confirmar todos os usuários existentes
-- Esta query marca todos os usuários como confirmados (sem alterar confirmed_at que é gerada automaticamente)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- OPÇÃO 2: Confirmar um usuário específico (substitua o email)
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email = 'seu@email.com';

-- OPÇÃO 3: Ver status dos usuários
SELECT 
    id,
    email,
    email_confirmed_at,
    confirmed_at,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- IMPORTANTE: Execute também este comando para desabilitar RLS na tabela usuarios
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;