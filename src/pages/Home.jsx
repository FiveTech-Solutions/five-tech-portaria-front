import { useNavigate } from 'react-router-dom';
import { HomeProvider, useHome } from '../contexts/HomeContext';
import AccessLog from '../components/AccessLog';
import FacialRecognitionCard from '../components/FacialRecognitionCard';
import PlateRecognitionCard from '../components/PlateRecognitionCard';
import ResidentsList from '../components/ResidentsList';
import { supabase } from '../supabaseClient';
import './Home.css';

// O componente de conteúdo que usa o contexto
const HomePageContent = () => {
  const navigate = useNavigate();
  // A função de logout pode ser movida para o context se for usada em mais lugares
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="home-container">
      <header className="header">
        <h1>Sistema de Portaria</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/cadastro')} className="btn-secondary">
            Cadastrar Pessoa
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="home-grid">
          <ResidentsList />
          <FacialRecognitionCard />
          <PlateRecognitionCard />
          <AccessLog />
        </div>
      </main>
    </div>
  );
};

// O componente principal que envolve tudo com o Provider
const Home = () => {
  return (
    <HomeProvider>
      <HomePageContent />
    </HomeProvider>
  );
};

export default Home;
