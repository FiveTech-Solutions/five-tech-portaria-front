# Instruções para Configurar o Banco de Dados no Supabase

## 🎯 Passos para Configurar o Sistema de Portaria

### 1. Acessar o Painel do Supabase
1. Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Faça login na sua conta
3. Selecione o projeto: **wdcibcsdlwlospeiofab**

### 2. Configurar a Autenticação (CRÍTICO - DEVE FAZER PRIMEIRO)
1. No painel lateral, vá em **Authentication** > **Settings**
2. Desça até encontrar **"User Signups"**
3. **DESABILITE** a opção **"Enable email confirmations"** 
4. **DESABILITE** também **"Enable phone confirmations"** (se estiver habilitado)
5. Na seção **"Email Auth"**, certifique-se que **"Enable email confirmations"** está **DESABILITADO**
6. Clique em **Save** para salvar as alterações
7. **AGUARDE** alguns segundos para as alterações serem aplicadas

> ⚠️ **MUITO IMPORTANTE**: Se não fizer isso, o cadastro dará erro "Email not confirmed"

### 3. Executar o Schema Principal
1. No painel lateral, vá em **SQL Editor**
2. Clique em **"New Query"**
3. Copie todo o conteúdo do arquivo `database-schema.sql`
4. Cole no editor SQL
5. Clique em **Run** para executar

### 4. Corrigir as Políticas RLS (OBRIGATÓRIO)
1. Ainda no **SQL Editor**, clique em **"New Query"**
2. Para resolver rapidamente, execute APENAS esta linha:
   ```sql
   ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
   ```
3. **OU** copie todo o conteúdo do arquivo `fix-rls-policies.sql` e execute
4. Clique em **Run** para executar

> **Nota**: Desabilitar RLS é a solução mais rápida. Para produção, configure políticas adequadas.

### 5. Verificar se Funcionou
1. Vá em **Table Editor** no painel lateral
2. Você deve ver as seguintes tabelas criadas:
   - ✅ usuarios
   - ✅ vagas
   - ✅ pessoas  
   - ✅ veiculos
   - ✅ pessoa_vagas
   - ✅ registros_acesso

## 🧪 Testar o Sistema

1. Acesse: **http://localhost:5174/**
2. Clique em **"Cadastre-se aqui"**
3. Preencha o formulário de cadastro
4. Se tudo estiver correto, você verá: **"Usuário cadastrado com sucesso!"**
5. Faça login com as credenciais criadas

## 🔧 Solução de Problemas

### ❌ Erro: "Email not confirmed" (MAIS COMUM)
**SOLUÇÃO:**
1. Vá em **Authentication** > **Settings**
2. Procure por **"Enable email confirmations"**
3. **DESABILITE** esta opção
4. Clique em **Save**
5. Aguarde 10-20 segundos
6. Tente cadastrar novamente

### ❌ Erro: "Erro ao criar perfil do usuário"
**SOLUÇÃO:**
- ✅ Execute: `ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;` no SQL Editor
- ✅ Ou execute o arquivo `fix-rls-policies.sql` completo

### ❌ Erro: "Invalid login credentials"  
**SOLUÇÃO:**
- ✅ Verifique se o usuário existe em Authentication > Users
- ✅ Verifique se "Enable email confirmations" está DESABILITADO
- ✅ Tente fazer logout e login novamente

### ❌ Erro: "User already registered"
**SOLUÇÃO:**
- ✅ Use outro email (o atual já existe)
- ✅ Ou delete o usuário em Authentication > Users

### 🔥 Solução Rápida para "Email not confirmed"

**Se ainda estiver com erro de email, execute no SQL Editor:**
```sql
-- Confirmar todos os usuários existentes
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Desabilitar RLS na tabela usuarios
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
```

## 📝 Scripts Disponíveis

- `database-schema.sql` - Schema principal com todas as tabelas
- `fix-rls-policies.sql` - Correção das políticas de segurança para permitir cadastro
- `fix-email-confirmation.sql` - Corrige problemas de confirmação de email

## 🎉 Pronto!

Após seguir estes passos, o sistema de portaria estará funcionando completamente com:
- ✅ Login e cadastro de usuários (porteiros)
- ✅ Banco de dados configurado
- ✅ Políticas de segurança ajustadas
- ✅ Interface web funcionando