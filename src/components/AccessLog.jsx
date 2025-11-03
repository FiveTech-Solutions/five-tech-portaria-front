import { useHome } from '../contexts/HomeContext';
import './AccessLog.css'; // Estilos específicos para este componente

const AccessLog = () => {
  const {
    registros,
    loadingRegistros,
    loadRegistros,
    registrosPage,
    setRegistrosPage,
    registrosTotalPages,
  } = useHome();

  const handlePrevPage = () => {
    if (registrosPage > 1) {
      setRegistrosPage(registrosPage - 1);
    }
  };

  const handleNextPage = () => {
    if (registrosPage < registrosTotalPages) {
      setRegistrosPage(registrosPage + 1);
    }
  };

  return (
    <div className="registros-section compact">
      <div className="registros-header">
        <h2>Últimos Acessos</h2>
        <button 
          onClick={() => loadRegistros(registrosPage)}
          className="btn-refresh"
          title="Atualizar registros"
          disabled={loadingRegistros}
        >
          {loadingRegistros ? '🔄...' : '🔄'}
        </button>
      </div>

      <div className="registros-list">
        {loadingRegistros ? (
          <div className="loading">Carregando...</div>
        ) : registros.length > 0 ? (
          registros.map(registro => (
            <div key={registro.id} className={`registro-card-compact ${registro.tipo}`}>
              <div className="registro-icon">
                {registro.tipo === 'entrada' ? '🟢' : '🔴'}
              </div>
              <div className="registro-info-compact">
                <strong className="registro-nome">{registro.pessoas?.nome || 'Desconhecido'}</strong>
                <span className="registro-tempo">
                  {new Date(registro.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="no-registros">Nenhum registro.</div>
        )}
      </div>

      <div className="pagination-controls">
        <button onClick={handlePrevPage} disabled={registrosPage <= 1 || loadingRegistros}>
          &lt;
        </button>
        <span>
          Pág {registrosPage} de {registrosTotalPages}
        </span>
        <button onClick={handleNextPage} disabled={registrosPage >= registrosTotalPages || loadingRegistros}>
          &gt;
        </button>
      </div>
    </div>
  );
};

export default AccessLog;
