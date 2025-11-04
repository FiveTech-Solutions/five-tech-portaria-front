import { useRef, useEffect, useState } from 'react';
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
    ocrError, // Consumir o estado de erro
    moradores,
    registerAccess,
  } = useHome();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const [plateBbox, setPlateBbox] = useState(null); // Estado para o contorno da placa

  const toggleCamera = () => {
    setIsPlateCameraActive(!isPlateCameraActive);
  };

  // Efeito para iniciar e parar a câmera e os loops
  useEffect(() => {
    let ocrInterval;
    if (isPlateCameraActive) {
      startVideo().then(() => {
        renderLoop(); // Inicia o loop de renderização do vídeo
        ocrInterval = setInterval(processPlateOCR, 2000); // Inicia o loop de OCR
      });
    } else {
      stopVideo();
    }

    return () => {
      stopVideo();
      if (ocrInterval) clearInterval(ocrInterval);
    };
  }, [isPlateCameraActive]);

  // Loop de renderização para manter o vídeo fluido e desenhar contornos
  const renderLoop = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Desenha o contorno verde se uma placa foi detectada
      if (plateBbox) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;
        ctx.strokeRect(plateBbox.x0, plateBbox.y0, plateBbox.x1 - plateBbox.x0, plateBbox.y1 - plateBbox.y0);
      }
    }
    animationFrameId.current = requestAnimationFrame(renderLoop);
  };

  // Função que executa apenas o processamento de OCR
  const processPlateOCR = async () => {
    if (isProcessingOCR || !videoRef.current || !ocrWorker || videoRef.current.readyState < 3) return;

    setIsProcessingOCR(true);
    try {
      const video = videoRef.current;

      // Usar um canvas temporário para todo o processamento, para não afetar a exibição
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');

      // 1. Desenha o frame atual do vídeo no canvas temporário
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

      // 2. Pré-processa a imagem inteira no canvas temporário
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const enhancedImageData = enhanceImageForOCR(imageData);
      tempCtx.putImageData(enhancedImageData, 0, 0);

      // 3. Passa o canvas processado para o Tesseract
      const result = await ocrWorker.recognize(tempCanvas);
      let foundPlate = null;

      if (result && result.data && result.data.lines) {
        for (const line of result.data.lines) {
          const plate = processOCRResult(line.text);
          if (plate) {
            // Ajusta as coordenadas do contorno para o tamanho do vídeo renderizado
            const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
            const scaleX = displaySize.width / video.videoWidth;
            const scaleY = displaySize.height / video.videoHeight;
            const scaledBbox = {
              x0: line.bbox.x0 * scaleX,
              y0: line.bbox.y0 * scaleY,
              x1: line.bbox.x1 * scaleX,
              y1: line.bbox.y1 * scaleY,
            };
            foundPlate = { plate, bbox: scaledBbox };
            break;
          }
        }
      }

      if (foundPlate) {
        setDetectedPlate(foundPlate.plate);
        setPlateBbox(foundPlate.bbox); // Armazena as coordenadas escaladas

        const vehicleFound = moradores
          .flatMap(m => m.veiculos?.map(v => ({ ...v, pessoa_id: m.id })) || [])
          .find(v => v.placa.replace(/[^A-Z0-9]/g, '') === foundPlate.plate);

        if (vehicleFound) {
          await registerAccess(vehicleFound.pessoa_id, vehicleFound.id, `Placa (${foundPlate.plate})`);
        } else {
          setDetectedPlate(`${foundPlate.plate} (Não Autorizado)`);
        }
      } else {
        setPlateBbox(null); // Limpa o contorno se nenhuma placa for encontrada
      }
    } catch (error) {
      console.error('Erro no OCR:', error);
      setPlateBbox(null);
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Erro ao acessar a câmera de placas:', error);
      alert('Erro ao acessar a câmera de placas. Verifique as permissões.');
    }
  };

  const stopVideo = () => {
    cancelAnimationFrame(animationFrameId.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Funções de validação de placa
  const normalizePlate = (text) => {
    if (!text) return null;
    const clean = text.replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 7) return null;
    if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean)) return clean;
    if (/^[A-Z]{3}[0-9]{4}$/.test(clean)) return clean;
    return null;
  };

  const processLine = (text) => {
    if (!text || text.trim().length < 7) return null;
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i <= cleanText.length - 7; i++) {
      const potentialPlate = cleanText.substring(i, i + 7);
      const normalized = normalizePlate(potentialPlate);
      if (normalized) return normalized;
    }
    return null;
  };

  const processOCRResult = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');
    for (const line of lines) {
      const result = processLine(line);
      if (result) return result;
    }
    return processLine(rawText);
  };

  const enhanceImageForOCR = (imageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const contrast = gray > 120 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = contrast;
    }
    return imageData;
  };

  return (
    <div className="recognition-card">
      <h2>📷 Câmera de Placas - Garagem</h2>
      <div className="camera-controls">
        <button onClick={toggleCamera} className="btn-primary" disabled={!ocrWorker || ocrError}>
          {isPlateCameraActive ? 'Desativar Câmera' : 'Ativar Câmera'}
        </button>
        <div className="ocr-status-text">
          {!ocrWorker && !ocrError && <p className="loading-text">Carregando OCR...</p>}
          {ocrError && <p className="error-text">{ocrError}</p>}
        </div>
      </div>

      <div className="video-container">
        {isPlateCameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="overlay-canvas" />
          </>
        ) : (
          <div className="camera-placeholder">
            <p>Câmera desativada</p>
          </div>
        )}
      </div>

      {isProcessingOCR && <p className="ocr-processing-text">Processando...</p>}
      {detectedPlate && (
        <div className="recognition-status">
          <p>Placa: {detectedPlate}</p>
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
