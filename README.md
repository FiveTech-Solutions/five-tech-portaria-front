# Sistema de Portaria - Front-end

Sistema de portaria completo em React com reconhecimento facial e gerenciamento de pessoas, veículos e vagas.

## Funcionalidades

- 🔐 **Autenticação**: Login com email e senha via Supabase
- 🏠 **Tela Inicial**: Monitoramento de câmera com reconhecimento facial em tempo real usando face-api.js
- 👤 **Cadastro de Pessoas**: 
  - Informações pessoais (nome, apartamento, bloco, telefone, email)
  - Captura facial com câmera
  - Associação de vagas de estacionamento
  - Registro de veículos (modelo, placa, cor, vaga)
- 🚗 **Gerenciamento de Veículos**: Cadastro de múltiplos veículos por pessoa
- 🅿️ **Controle de Vagas**: Sistema de vagas por bloco
- 📸 **Reconhecimento Facial**: Usando face-api.js para detecção e reconhecimento
- 📋 **OCR de Placas**: Suporte para reconhecimento de placas com tesseract.js

## Tecnologias Utilizadas

- **React 19** - Framework JavaScript
- **Vite** - Build tool
- **React Router DOM** - Navegação entre páginas
- **Supabase** - Backend as a Service (banco de dados, autenticação)
- **face-api.js** - Reconhecimento facial
- **tesseract.js** - OCR para reconhecimento de placas

## Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase (gratuita)

## Configuração do Banco de Dados

1. Crie um projeto no [Supabase](https://supabase.com)
2. No dashboard do Supabase, vá em SQL Editor
3. Execute o arquivo `database-schema.sql` para criar todas as tabelas e políticas

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/FiveTech-Solutions/five-tech-portaria-front.git
cd five-tech-portaria-front
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

Você pode encontrar essas informações em:
- Supabase Dashboard > Settings > API > Project URL
- Supabase Dashboard > Settings > API > Project API keys > anon public

5. Os modelos do face-api.js já foram baixados durante a configuração inicial. Se precisar baixá-los novamente:
```bash
./download-models.sh
```

## Executando o Projeto

### Modo de Desenvolvimento
```bash
npm run dev
```
Acesse: http://localhost:5173

### Build para Produção
```bash
npm run build
```

### Preview da Build de Produção
```bash
npm run preview
```

## Estrutura do Projeto

```
src/
├── pages/
│   ├── Home.jsx          # Tela inicial com câmera
│   ├── Home.css
│   ├── Login.jsx         # Tela de login
│   ├── Login.css
│   ├── Cadastro.jsx      # Cadastro de pessoas
│   └── Cadastro.css
├── supabaseClient.js     # Configuração do Supabase
├── App.jsx               # Componente principal com rotas
├── App.css
├── main.jsx             # Entry point
└── index.css

public/
└── models/              # Modelos do face-api.js

database-schema.sql      # Schema do banco de dados
download-models.sh       # Script para baixar modelos
```

## Criando o Primeiro Usuário

Como o sistema usa autenticação do Supabase, você precisa criar o primeiro usuário:

1. No dashboard do Supabase, vá em Authentication > Users
2. Clique em "Add User" e crie um usuário com email e senha
3. Use essas credenciais para fazer login no sistema

Ou use o sistema de signup do Supabase (se habilitado):
- Configure em: Authentication > Settings > Email Auth

## Uso do Sistema

### 1. Login
- Acesse a tela de login com suas credenciais

### 2. Tela Inicial (Monitoramento)
- Ativa a câmera para monitoramento
- Detecta rostos em tempo real
- Exibe informações sobre detecções

### 3. Cadastro de Pessoas
- Clique em "Cadastrar Pessoa"
- Preencha os dados pessoais
- Selecione as vagas disponíveis
- Adicione veículos (modelo, placa, cor, vaga)
- Ative a câmera e capture o rosto da pessoa
- Salve o cadastro

## Permissões de Câmera

O sistema precisa de permissão para acessar a câmera do dispositivo:
- Navegadores modernos solicitarão permissão automaticamente
- Em produção, use HTTPS para funcionalidade de câmera

## Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Autenticação obrigatória via Supabase
- Políticas de acesso configuradas no banco de dados

## Lint

```bash
npm run lint
```

## Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do email do projeto.
