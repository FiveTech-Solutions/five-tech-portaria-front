import { useRef, useEffect } from 'react';
import { useHome } from '../contexts/HomeContext';
import './RecognitionCard.css'; // Estilo compartilhado para os cards

const PlateRecognitionCard = () => {
  const {
    isPlateCameraActive,
    setIsPlateCameraActive,
    isProcessingOCR,
    setIsProcessingOCR,
    detectedPlate,
    setDetectedPlate,
    plateConfidence,
    setPlateConfidence,
    garageGateStatus,
    openGarageGate,
    closeGarageGate,
    ocrWorker,
    moradores,
    registerAccess,
  } = useHome();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const toggleCamera = () => {
    setIsPlateCameraActive(!isPlateCameraActive);
  };

  useEffect(() => {
    if (isPlateCameraActive) {
      startVideo();
    } else {
      stopVideo();
    }

    return () => stopVideo();
  }, [isPlateCameraActive]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 360, facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar a câmera de placas:', error);
      alert('Erro ao acessar a câmera de placas. Verifique as permissões.');
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const processPlate = (rawText) => {
    if (!rawText) return null;
    const cleanText = rawText.replace(/[^A-Z0-9]/g, '');
    // Simple validation for Brazilian plates (Mercosul or older)
    const mercosulRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    const oldRegex = /^[A-Z]{3}[0-9]{4}$/;
    if (mercosulRegex.test(cleanText) || oldRegex.test(cleanText)) {
      return cleanText;
    }
    return null;
  };

  const handleVideoPlay = () => {
    const interval = setInterval(async () => {
      if (isProcessingOCR || !videoRef.current || !ocrWorker) return;

      setIsProcessingOCR(true);
      try {
        const video = videoRef.current;
        const { data: { text, confidence } } = await ocrWorker.recognize(video);
        
        const plate = processPlate(text);

        if (plate) {
          setDetectedPlate(plate);
          setPlateConfidence(confidence / 100);

          // Find vehicle and person
          let vehicleFound = null;
          for (const morador of moradores) {
            const vehicle = morador.veiculos?.find(v => v.placa === plate);
            if (vehicle) {
              vehicleFound = { ...vehicle, pessoa_id: morador.id };
              break;
            }
          }

          if (vehicleFound) {
            await registerAccess(vehicleFound.pessoa_id, vehicleFound.id, `Reconhecimento de placa (${plate})`);
          } else {
            setDetectedPlate(`${plate} (Não autorizado)`);
          }
        } else {
            // Optionally clear the detected plate if nothing valid is found
            // setDetectedPlate('');
        }

      } catch (error) {
        console.error('Erro no OCR:', error);
      } finally {
        setIsProcessingOCR(false);
      }
    }, 5000); // Process every 5 seconds

    return () => clearInterval(interval);
  };

  return (
    <div className="recognition-card">
      <h2>📷 Câmera de Placas - Garagem</h2>
      <div className="camera-controls">
        <button onClick={toggleCamera} className="btn-primary" disabled={!ocrWorker}>
          {isPlateCameraActive ? 'Desativar Câmera' : 'Ativar Câmera'}
        </button>
        {!ocrWorker && <p className="loading-text">Carregando OCR...</p>}
      </div>
      
      <div className="video-container">
        {isPlateCameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              onPlay={handleVideoPlay}
            />
            <canvas ref={canvasRef} className="overlay-canvas" />
          </>
        ) : (
          <div className="camera-placeholder">
            <p>Câmera desativada</p>
          </div>
        )}
      </div>

      {isProcessingOCR && <p>Processando...</p>}
      {detectedPlate && (
        <div className="recognition-status">
          <p>Placa: {detectedPlate} (Confiança: {Math.round(plateConfidence * 100)}%)</p>
        </div>
      )}

      <div className="gate-section garage-gate">
        <h3>🚗 Portão da Garagem</h3>
        <div className={`gate-animation ${garageGateStatus}`}>
          <div className="gate-frame">
            <div className="gate-panel"></div>
          </div>
        </div>
        <div className="gate-status-text">
            {garageGateStatus === 'closed' && '🔒 Fechado'}
            {garageGateStatus === 'opening' && 'Abrindo...'}
            {garageGateStatus === 'open' && '✅ Aberto'}
            {garageGateStatus === 'closing' && 'Fechando...'}
        </div>
        <div className="manual-controls">
          <button onClick={openGarageGate} disabled={garageGateStatus !== 'closed'} className="btn-gate-open">
            Abrir Portão
          </button>
          <button onClick={closeGarageGate} disabled={garageGateStatus !== 'open'} className="btn-gate-close">
            Fechar Portão
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlateRecognitionCard;
