// Hook personalizado para gerenciar câmera
import { useRef, useState, useCallback } from 'react';

export const useCamera = () => {
  const videoRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    console.log('🎥 Hook: Iniciando câmera...');
    
    if (!videoRef.current) {
      console.error('❌ Hook: VideoRef não disponível');
      setError('Elemento de vídeo não encontrado');
      return false;
    }

    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      videoRef.current.srcObject = stream;
      
      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(resolve)
            .catch(reject);
        };
        videoRef.current.onerror = reject;
      });

      setIsActive(true);
      console.log('✅ Hook: Câmera iniciada com sucesso');
      return true;
      
    } catch (err) {
      console.error('❌ Hook: Erro ao iniciar câmera:', err);
      setError(err.message);
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('⏹️ Hook: Parando câmera...');
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsActive(false);
    setError(null);
    console.log('✅ Hook: Câmera parada');
  }, []);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera
  };
};