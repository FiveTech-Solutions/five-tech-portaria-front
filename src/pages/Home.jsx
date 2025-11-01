import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { supabase } from '../supabaseClient';
import './Home.css';

function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detections, setDetections] = useState([]);
  const navigate = useNavigate();

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
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
        console.log('Modelos carregados com sucesso');
      } catch (error) {
        console.error('Erro ao carregar modelos:', error);
      }
    };
    loadModels();
  }, [navigate]);

  useEffect(() => {
    if (isModelLoaded && isCameraActive) {
      startVideo();
    }
    return () => {
      stopVideo();
    };
  }, [isModelLoaded, isCameraActive]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 720, height: 560 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleVideoPlay = () => {
    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        };

        faceapi.matchDimensions(canvasRef.current, displaySize);

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
        }

        setDetections(detections);
      }
    }, 100);

    return () => clearInterval(interval);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      stopVideo();
    }
    setIsCameraActive(!isCameraActive);
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
        <div className="camera-section">
          <h2>Monitoramento de Câmera</h2>
          <div className="camera-controls">
            <button onClick={toggleCamera} className="btn-primary">
              {isCameraActive ? 'Desativar Câmera' : 'Ativar Câmera'}
            </button>
            {!isModelLoaded && <p>Carregando modelos de reconhecimento facial...</p>}
          </div>
          
          <div className="video-container">
            {isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  onPlay={handleVideoPlay}
                  width="720"
                  height="560"
                />
                <canvas ref={canvasRef} className="overlay-canvas" />
              </>
            ) : (
              <div className="camera-placeholder">
                <p>Câmera desativada</p>
                <p>Clique em "Ativar Câmera" para começar o monitoramento</p>
              </div>
            )}
          </div>

          {detections.length > 0 && (
            <div className="detection-info">
              <p>Rostos detectados: {detections.length}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Home;
