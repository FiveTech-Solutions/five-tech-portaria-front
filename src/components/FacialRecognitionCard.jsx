import { useRef, useEffect } from 'react';
import { useHome } from '../contexts/HomeContext';
import './RecognitionCard.css'; // Estilo compartilhado para os cards

const FacialRecognitionCard = () => {
  const {
    isModelLoaded,
    isFacialCameraActive,
    setIsFacialCameraActive,
    isProcessingFacial,
    setIsProcessingFacial,
    recognizedPerson,
    setRecognizedPerson,
    spoofingAlert,
    socialGateStatus,
    openSocialGate,
    closeSocialGate,
    faceapi,
    moradores,
    registerAccess,
  } = useHome();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const toggleCamera = () => {
    setIsFacialCameraActive(!isFacialCameraActive);
  };

  useEffect(() => {
    if (isFacialCameraActive) {
      startVideo();
    } else {
      stopVideo();
    }

    return () => stopVideo();
  }, [isFacialCameraActive]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 360 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar a câmera facial:', error);
      alert('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleVideoPlay = () => {
    const interval = setInterval(async () => {
      if (isProcessingFacial || !videoRef.current || !canvasRef.current) return;

      setIsProcessingFacial(true);

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resizedDetections.length > 0) {
          let personFound = false;
          for (const detection of resizedDetections) {
            const { descriptor, detection: { box } } = detection;
            let bestMatch = null;
            let bestDistance = 0.6; // Threshold

            for (const morador of moradores) {
              if (morador.facial_descriptors && morador.facial_descriptors.length > 0) {
                const storedDescriptor = new Float32Array(morador.facial_descriptors);
                const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestMatch = morador;
                }
              }
            }

            ctx.strokeStyle = bestMatch ? '#00ff00' : '#ff0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            if (bestMatch) {
              personFound = true;
              setRecognizedPerson(bestMatch);
              await registerAccess(bestMatch.id, null, 'Reconhecimento facial');
              break; // Process only the first recognized person
            }
          }
          if (!personFound) {
            setRecognizedPerson(null);
          }
        } else {
          setRecognizedPerson(null);
        }
      } catch (error) {
        console.error('Erro no loop de reconhecimento facial:', error);
      } finally {
        setIsProcessingFacial(false);
      }
    }, 1000); // Intervalo de 1 segundo para evitar sobrecarga

    return () => clearInterval(interval);
  };

  return (
    <div className="recognition-card">
      <h2>📷 Câmera Facial - Portão Social</h2>
      <div className="camera-controls">
        <button onClick={toggleCamera} className="btn-primary" disabled={!isModelLoaded}>
          {isFacialCameraActive ? 'Desativar Câmera' : 'Ativar Câmera'}
        </button>
        {!isModelLoaded && <p className="loading-text">Carregando modelos...</p>}
      </div>
      
      <div className="video-container">
        {isFacialCameraActive ? (
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

      {spoofingAlert && (
        <div className={`spoofing-alert ${spoofingAlert.type}`}>
          <p>{spoofingAlert.message}</p>
        </div>
      )}

      {recognizedPerson && (
        <div className="recognition-status">
          <p>✅ {recognizedPerson.nome} Reconhecido</p>
        </div>
      )}

      <div className="gate-section social-gate">
        <h3>🚶‍♂️ Portão de Entrada Social</h3>
        <div className={`gate-animation ${socialGateStatus}`}>
          <div className="gate-frame">
            <div className="gate-panel"></div>
          </div>
        </div>
        <div className="gate-status-text">
            {socialGateStatus === 'closed' && '🔒 Fechado'}
            {socialGateStatus === 'opening' && 'Abrindo...'}
            {socialGateStatus === 'open' && '✅ Aberto'}
            {socialGateStatus === 'closing' && 'Fechando...'}
        </div>
        <div className="manual-controls">
          <button onClick={openSocialGate} disabled={socialGateStatus !== 'closed'} className="btn-gate-open">
            Abrir Portão
          </button>
          <button onClick={closeSocialGate} disabled={socialGateStatus !== 'open'} className="btn-gate-close">
            Fechar Portão
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacialRecognitionCard;
