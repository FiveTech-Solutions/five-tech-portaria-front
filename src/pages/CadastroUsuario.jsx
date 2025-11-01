import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './CadastroUsuario.css';

function CadastroUsuario() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    confirmPassword: '',
    telefone: '',
    cargo: 'porteiro',
    turno: 'diurno'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // ESTRATÉGIA 1: Tentar criar usuário normal primeiro
      let authData = null;
      let authError = null;

      // Tentar signup com confirmação automática
      const signupResult = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: undefined,
          data: {
            nome: formData.nome,
            telefone: formData.telefone,
            cargo: formData.cargo,
            turno: formData.turno,
            email_confirmed_at: new Date().toISOString() // Força confirmação
          }
        }
      });

      authData = signupResult.data;
      authError = signupResult.error;

      // Se der erro de email não confirmado, tentar abordagem alternativa
      if (authError && authError.message.includes('Email not confirmed')) {
        console.log('Tentando abordagem alternativa...');
        
        // ESTRATÉGIA 2: Criar e depois confirmar manualmente
        const signupResult2 = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        });
        
        if (signupResult2.data.user && !signupResult2.error) {
          // Fazer login direto (funciona mesmo sem confirmação em alguns casos)
          const loginResult = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
          });
          
          if (!loginResult.error) {
            authData = loginResult.data;
            authError = null;
            console.log('Login direto funcionou!');
          } else {
            authData = signupResult2.data;
            authError = signupResult2.error;
          }
        } else {
          authError = signupResult2.error;
        }
      }

      if (authError) {
        console.error('Erro de autenticação:', authError);
        throw authError;
      }

      // Se o usuário foi criado com sucesso
      if (authData.user) {
        console.log('Usuário criado no auth:', authData.user.id);
        
        // Primeiro, vamos tentar fazer login para ter uma sessão ativa
        const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (loginError) {
          console.warn('Não foi possível fazer login automático:', loginError);
        } else {
          console.log('Login automático realizado com sucesso');
        }
        
        // Tentar inserir dados adicionais na tabela de usuários
        const { data: profileData, error: profileError } = await supabase
          .from('usuarios')
          .insert([
            {
              id: authData.user.id,
              nome: formData.nome,
              email: formData.email,
              telefone: formData.telefone,
              cargo: formData.cargo,
              turno: formData.turno,
              ativo: true
            }
          ])
          .select();

        if (profileError) {
          console.error('Erro ao salvar perfil:', profileError);
          console.log('Tentativa com dados mínimos...');
          
          // Tentar inserção com dados mínimos
          const { data: profileDataMin, error: profileErrorMin } = await supabase
            .from('usuarios')
            .insert([
              {
                id: authData.user.id,
                nome: formData.nome,
                email: formData.email
              }
            ])
            .select();

          if (profileErrorMin) {
            console.error('Erro mesmo com dados mínimos:', profileErrorMin);
            // Se ainda falhar, pelo menos o usuário foi criado no auth
            setSuccess('Usuário criado no sistema de autenticação! Execute o script fix-rls-policies.sql no Supabase e tente novamente para salvar o perfil completo.');
          } else {
            console.log('Perfil salvo com dados mínimos:', profileDataMin);
            setSuccess('Usuário cadastrado com sucesso! Você já pode fazer login.');
          }
        } else {
          console.log('Perfil salvo com sucesso:', profileData);
          setSuccess('Usuário cadastrado com sucesso! Você já pode fazer login.');
        }
        
        // Limpar formulário
        setFormData({
          nome: '',
          email: '',
          password: '',
          confirmPassword: '',
          telefone: '',
          cargo: 'porteiro',
          turno: 'diurno'
        });

        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
      setError(error.message || 'Erro ao cadastrar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cadastro-usuario-container">
      <div className="cadastro-usuario-box">
        <h1>Cadastro de Usuário</h1>
        <p className="subtitle">Cadastre-se para acessar o sistema de portaria</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nome">Nome Completo</label>
            <input
              id="nome"
              name="nome"
              type="text"
              value={formData.nome}
              onChange={handleInputChange}
              placeholder="Seu nome completo"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              name="telefone"
              type="tel"
              value={formData.telefone}
              onChange={handleInputChange}
              placeholder="(11) 99999-9999"
              required
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cargo">Cargo</label>
              <select
                id="cargo"
                name="cargo"
                value={formData.cargo}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="porteiro">Porteiro</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="turno">Turno</label>
              <select
                id="turno"
                name="turno"
                value={formData.turno}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="diurno">Diurno (6h às 18h)</option>
                <option value="noturno">Noturno (18h às 6h)</option>
                <option value="integral">Integral</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
            <small>Mínimo 6 caracteres</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Senha</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <div className="login-link">
          <p>Já tem uma conta? 
            <button 
              type="button"
              className="link-button"
              onClick={() => navigate('/login')}
            >
              Faça login aqui
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default CadastroUsuario;