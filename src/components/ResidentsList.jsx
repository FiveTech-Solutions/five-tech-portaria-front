import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHome } from '../contexts/HomeContext';
import './ResidentsList.css';

const ResidentsList = () => {
  const { moradores, loadingMoradores } = useHome();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroBloco, setFiltroBloco] = useState('');

  const blocosUnicos = [...new Set(moradores.map(m => m.bloco))].sort();

  const moradoresFiltrados = moradores.filter(morador => {
    const matchesSearch = 
      morador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      morador.apartamento.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBloco = !filtroBloco || morador.bloco === filtroBloco;
    
    return matchesSearch && matchesBloco;
  });

  return (
    <div className="moradores-section">
      <div className="moradores-header">
        <h2>Lista de Moradores</h2>
        <button onClick={() => navigate('/cadastro')} className="btn-add">
          + Adicionar
        </button>
      </div>

      <div className="filters-container">
        <input
          type="text"
          placeholder="Buscar por nome ou apto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filtroBloco}
          onChange={(e) => setFiltroBloco(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos os Blocos</option>
          {blocosUnicos.map(bloco => (
            <option key={bloco} value={bloco}>Bloco {bloco}</option>
          ))}
        </select>
      </div>

      <div className="moradores-list">
        {loadingMoradores ? (
          <div className="loading">Carregando moradores...</div>
        ) : moradoresFiltrados.length > 0 ? (
          <>
            <div className="moradores-count">
              {moradoresFiltrados.length} morador(es) encontrado(s)
            </div>
            {moradoresFiltrados.map(morador => (
              <div key={morador.id} className="morador-card">
                <div className="morador-info">
                  <h3>{morador.nome}</h3>
                  <p>Apto {morador.apartamento} - Bloco {morador.bloco}</p>
                  {morador.veiculos && morador.veiculos.length > 0 && (
                      <div className="veiculos-info">
                        {morador.veiculos.map(v => `${v.placa}`).join(', ')}
                      </div>
                  )}
                </div>
                <div className="morador-actions">
                  <span className={`reconhecimento-status ${morador.facial_descriptors ? 'cadastrado' : 'pendente'}`}>
                    {morador.facial_descriptors ? '👤' : '❓'}
                  </span>
                  {/* O botão de edição pode ser reativado aqui, 
                      mas a lógica do modal precisaria ser conectada via context */}
                  {/* <button className="btn-edit">✏️</button> */}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="no-moradores">Nenhum morador encontrado.</div>
        )}
      </div>
    </div>
  );
};

export default ResidentsList;
