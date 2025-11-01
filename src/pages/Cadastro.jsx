import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { supabase } from '../supabaseClient';
import './Cadastro.css';

function Cadastro() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    apartamento: '',
    bloco: '',
    telefone: '',
    email: '',
  });
  
  const [vagas, setVagas] = useState([]);
  const [selectedVagas, setSelectedVagas] = useState([]);
  const [veiculos, setVeiculos] = useState([{ modelo: '', placa: '', cor: '', vagaId: '' }]);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Check authentication
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
      }
    };
    checkUser();

    // Load face-api models
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Erro ao carregar modelos:', error);
      }
    };
    loadModels();

    // Load available parking spots
    loadVagas();
  }, [navigate]);

  const loadVagas = async () => {
    try {
      const { data, error } = await supabase
        .from('vagas')
        .select('*')
        .eq('ocupada', false)
        .order('numero');
      
      if (error) throw error;
      setVagas(data || []);
    } catch (error) {
      console.error('Erro ao carregar vagas:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleVagaToggle = (vagaId) => {
    setSelectedVagas(prev => 
      prev.includes(vagaId)
        ? prev.filter(id => id !== vagaId)
        : [...prev, vagaId]
    );
  };

  const handleVeiculoChange = (index, field, value) => {
    const newVeiculos = [...veiculos];
    newVeiculos[index][field] = value;
    setVeiculos(newVeiculos);
  };

  const addVeiculo = () => {
    setVeiculos([...veiculos, { modelo: '', placa: '', cor: '', vagaId: '' }]);
  };

  const removeVeiculo = (index) => {
    setVeiculos(veiculos.filter((_, i) => i !== index));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || !isModelLoaded) return;

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        // Capture image from video
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        
        setCapturedFace(imageData);
        setFaceDescriptor(detection.descriptor);
        setSuccess('Rosto capturado com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Nenhum rosto detectado. Tente novamente.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Erro ao capturar rosto:', error);
      setError('Erro ao capturar rosto.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Insert person
      const { data: pessoa, error: pessoaError } = await supabase
        .from('pessoas')
        .insert([{
          nome: formData.nome,
          apartamento: formData.apartamento,
          bloco: formData.bloco,
          telefone: formData.telefone,
          email: formData.email,
          foto_facial: capturedFace,
          facial_descriptors: faceDescriptor ? { descriptor: Array.from(faceDescriptor) } : null,
        }])
        .select()
        .single();

      if (pessoaError) throw pessoaError;

      // Insert pessoa_vagas relationships
      if (selectedVagas.length > 0) {
        const vagaRelations = selectedVagas.map(vagaId => ({
          pessoa_id: pessoa.id,
          vaga_id: vagaId,
        }));

        const { error: vagasError } = await supabase
          .from('pessoa_vagas')
          .insert(vagaRelations);

        if (vagasError) throw vagasError;
      }

      // Insert vehicles
      const veiculosValidos = veiculos.filter(v => v.modelo && v.placa);
      if (veiculosValidos.length > 0) {
        const veiculosData = veiculosValidos.map(v => ({
          pessoa_id: pessoa.id,
          modelo: v.modelo,
          placa: v.placa,
          cor: v.cor || null,
          vaga_id: v.vagaId || null,
        }));

        const { error: veiculosError } = await supabase
          .from('veiculos')
          .insert(veiculosData);

        if (veiculosError) throw veiculosError;
      }

      setSuccess('Pessoa cadastrada com sucesso!');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      setError(error.message || 'Erro ao cadastrar pessoa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cadastro-container">
      <header className="header">
        <h1>Cadastro de Pessoa</h1>
        <button onClick={() => navigate('/')} className="btn-secondary">
          Voltar
        </button>
      </header>

      <main className="form-content">
        <form onSubmit={handleSubmit} className="cadastro-form">
          {/* Personal Information */}
          <section className="form-section">
            <h2>Informações Pessoais</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="nome">Nome *</label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  value={formData.nome}
                  onChange={handleInputChange}
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
                  disabled={loading}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="apartamento">Apartamento *</label>
                <input
                  id="apartamento"
                  name="apartamento"
                  type="text"
                  value={formData.apartamento}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bloco">Bloco *</label>
                <input
                  id="bloco"
                  name="bloco"
                  type="text"
                  value={formData.bloco}
                  onChange={handleInputChange}
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
                  disabled={loading}
                />
              </div>
            </div>
          </section>

          {/* Parking Spots */}
          <section className="form-section">
            <h2>Vagas de Estacionamento</h2>
            <div className="vagas-grid">
              {vagas.map(vaga => (
                <label key={vaga.id} className="vaga-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedVagas.includes(vaga.id)}
                    onChange={() => handleVagaToggle(vaga.id)}
                    disabled={loading}
                  />
                  <span>Vaga {vaga.numero} - Bloco {vaga.bloco}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Vehicles */}
          <section className="form-section">
            <h2>Veículos</h2>
            {veiculos.map((veiculo, index) => (
              <div key={index} className="veiculo-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Modelo</label>
                    <input
                      type="text"
                      value={veiculo.modelo}
                      onChange={(e) => handleVeiculoChange(index, 'modelo', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Placa</label>
                    <input
                      type="text"
                      value={veiculo.placa}
                      onChange={(e) => handleVeiculoChange(index, 'placa', e.target.value.toUpperCase())}
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cor</label>
                    <input
                      type="text"
                      value={veiculo.cor}
                      onChange={(e) => handleVeiculoChange(index, 'cor', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Vaga</label>
                    <select
                      value={veiculo.vagaId}
                      onChange={(e) => handleVeiculoChange(index, 'vagaId', e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Selecione...</option>
                      {vagas.map(vaga => (
                        <option key={vaga.id} value={vaga.id}>
                          Vaga {vaga.numero} - Bloco {vaga.bloco}
                        </option>
                      ))}
                    </select>
                  </div>
                  {veiculos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVeiculo(index)}
                      className="btn-remove"
                      disabled={loading}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addVeiculo} className="btn-add" disabled={loading}>
              + Adicionar Veículo
            </button>
          </section>

          {/* Facial Capture */}
          <section className="form-section">
            <h2>Captura Facial</h2>
            <div className="camera-capture">
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn-primary"
                  disabled={!isModelLoaded || loading}
                >
                  {isModelLoaded ? 'Ativar Câmera' : 'Carregando modelos...'}
                </button>
              ) : (
                <div className="camera-container">
                  <video ref={videoRef} autoPlay muted width="640" height="480" />
                  <canvas ref={canvasRef} className="overlay-canvas" />
                  <div className="camera-buttons">
                    <button type="button" onClick={captureFace} className="btn-primary">
                      Capturar Rosto
                    </button>
                    <button type="button" onClick={stopCamera} className="btn-secondary">
                      Desativar Câmera
                    </button>
                  </div>
                </div>
              )}
              {capturedFace && (
                <div className="captured-preview">
                  <h3>Rosto Capturado:</h3>
                  <img src={capturedFace} alt="Captured face" />
                </div>
              )}
            </div>
          </section>

          {/* Submit */}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <div className="form-actions">
            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar Pessoa'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default Cadastro;
