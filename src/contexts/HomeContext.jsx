import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import Tesseract from 'tesseract.js';
import { supabase } from '../supabaseClient';

const HomeContext = createContext();

export const useHome = () => {
  return useContext(HomeContext);
};

export const HomeProvider = ({ children }) => {
  const navigate = useNavigate();

  // ========== STATE MANAGEMENT ==========

  // --- Models & Cameras ---
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isFacialCameraActive, setIsFacialCameraActive] = useState(false);
  const [isPlateCameraActive, setIsPlateCameraActive] = useState(false);
  const [isProcessingFacial, setIsProcessingFacial] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrWorker, setOcrWorker] = useState(null);

  // --- Data ---
  const [moradores, setMoradores] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loadingMoradores, setLoadingMoradores] = useState(true);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  const [registrosPage, setRegistrosPage] = useState(1);
  const [registrosTotalPages, setRegistrosTotalPages] = useState(1);
  const RECORDS_PER_PAGE = 10;

  // --- Recognition Results ---
  const [recognizedPerson, setRecognizedPerson] = useState(null);
  const [detectedPlate, setDetectedPlate] = useState('');
  const [plateConfidence, setPlateConfidence] = useState(0);
  const [spoofingAlert, setSpoofingAlert] = useState(null);

  // --- Gate Control ---
  const [socialGateStatus, setSocialGateStatus] = useState('closed');
  const [garageGateStatus, setGarageGateStatus] = useState('closed');
  const socialGateTimer = useRef(null);
  const garageGateTimer = useRef(null);

  // --- Cooldown Logic ---
  const lastAccessTimeRef = useRef({}); // Usar Ref para a lógica de cooldown para evitar stale state
  const [lastAccessTime, setLastAccessTime] = useState({}); // Usar State apenas para re-renderizar UI se necessário
  const ACCESS_COOLDOWN = 30000; // 30 segundos

    // ========== LIFECYCLE & INITIALIZATION ========== 
  
    useEffect(() => {
      const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
        }
      };
      checkUser();
      loadModels();
      loadMoradores();
      initializeOcrWorker();
  
      return () => {
        if (ocrWorker) {
          ocrWorker.terminate();
        }
      };
    }, [navigate]);
  
    useEffect(() => {
      loadRegistros(registrosPage);
    }, [registrosPage]);
  // ========== DATA FETCHING ==========

  const loadMoradores = async () => {
    try {
      setLoadingMoradores(true);
      const { data, error } = await supabase
        .from('pessoas')
        .select('*, veiculos (*)')
        .order('nome');
      if (error) throw error;
      setMoradores(data || []);
    } catch (error) {
      console.error('Erro ao carregar moradores:', error);
    } finally {
      setLoadingMoradores(false);
    }
  };

  const loadRegistros = async (page = 1) => {
    try {
      setLoadingRegistros(true);
      const from = (page - 1) * RECORDS_PER_PAGE;
      const to = from + RECORDS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('registros_acesso')
        .select('*, pessoas(nome, apartamento, bloco), veiculos(modelo, placa)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setRegistros(data || []);
      setRegistrosTotalPages(Math.ceil(count / RECORDS_PER_PAGE));
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
    } finally {
      setLoadingRegistros(false);
    }
  };

  // ========== AI MODELS & WORKERS ==========

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
    } catch (error) {
      console.error('Erro ao carregar modelos face-api:', error);
    }
  };

  const initializeOcrWorker = async () => {
    try {
      const worker = await Tesseract.createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
      });
      setOcrWorker(worker);
    } catch (error) {
      console.error('Erro ao inicializar Tesseract worker:', error);
    }
  };

  // ========== CORE LOGIC (COOLDOWN FIXED) ==========

  const registerAccess = async (personId, vehicleId = null, method) => {
    const now = Date.now();
    const lastAccess = lastAccessTimeRef.current[personId];

    if (lastAccess && (now - lastAccess) < ACCESS_COOLDOWN) {
      const timeRemaining = Math.ceil((ACCESS_COOLDOWN - (now - lastAccess)) / 1000);
      console.log(`COOLDOWN: Acesso para ${personId} bloqueado. ${timeRemaining}s restantes.`);
      // Opcional: mostrar um alerta na UI que desaparece
      setSpoofingAlert({
        type: 'warning',
        message: `Aguarde ${timeRemaining}s para novo registro.`
      });
      setTimeout(() => setSpoofingAlert(null), 2000);
      return; // Interrompe a execução
    }

    // Se o cooldown passou, atualiza o ref imediatamente para bloquear próximas chamadas
    lastAccessTimeRef.current[personId] = now;
    // E atualiza o estado para qualquer componente de UI que dependa dele
    setLastAccessTime(prev => ({ ...prev, [personId]: now }));

    try {
      const { data: lastRecord } = await supabase
        .from('registros_acesso')
        .select('tipo')
        .eq('pessoa_id', personId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const newType = lastRecord?.tipo === 'entrada' ? 'saida' : 'entrada';

      const { error } = await supabase.from('registros_acesso').insert({
        pessoa_id: personId,
        veiculo_id: vehicleId,
        tipo: newType,
        reconhecido: true,
        observacoes: method,
      });

      if (error) {
        // Se o registro falhar, reverte o timestamp para permitir uma nova tentativa
        lastAccessTimeRef.current[personId] = lastAccess; 
        setLastAccessTime(prev => ({ ...prev, [personId]: lastAccess }));
        throw error;
      }

      console.log(`REGISTRO: Acesso tipo '${newType}' para ${personId} registrado com sucesso.`);
      await loadRegistros(); // Recarrega os logs
      
      // Abre o portão correto apenas na entrada
      if (newType === 'entrada') {
        if (method.includes('facial')) {
          openSocialGate();
        } else if (method.includes('placa')) {
          openGarageGate();
        }
      }
    } catch (error) {
      console.error('Erro ao registrar acesso no Supabase:', error);
    }
  };

  // ========== GATE CONTROL ==========

  const openSocialGate = () => {
    if (socialGateStatus !== 'closed') return;
    setSocialGateStatus('opening');
    setTimeout(() => {
      setSocialGateStatus('open');
      socialGateTimer.current = setTimeout(closeSocialGate, 12000);
    }, 2500);
  };

  const closeSocialGate = () => {
    if (socialGateStatus !== 'open') return;
    clearTimeout(socialGateTimer.current);
    setSocialGateStatus('closing');
    setTimeout(() => setSocialGateStatus('closed'), 2500);
  };

  const openGarageGate = () => {
    if (garageGateStatus !== 'closed') return;
    setGarageGateStatus('opening');
    setTimeout(() => {
      setGarageGateStatus('open');
      garageGateTimer.current = setTimeout(closeGarageGate, 20000);
    }, 4000);
  };

  const closeGarageGate = () => {
    if (garageGateStatus !== 'open') return;
    clearTimeout(garageGateTimer.current);
    setGarageGateStatus('closing');
    setTimeout(() => setGarageGateStatus('closed'), 4000);
  };

  // ========== PUBLIC API (VALUE) ==========

  const value = {
    // State
    isModelLoaded,
    isFacialCameraActive,
    isPlateCameraActive,
    isProcessingFacial,
    isProcessingOCR,
    moradores,
    registros,
    loadingMoradores,
    loadingRegistros,
    recognizedPerson,
    detectedPlate,
    plateConfidence,
    spoofingAlert,
    socialGateStatus,
    garageGateStatus,
    lastAccessTime,
    ACCESS_COOLDOWN,

    // Setters & Toggles
    setIsFacialCameraActive,
    setIsPlateCameraActive,
    setIsProcessingFacial,
    setIsProcessingOCR,
    setRecognizedPerson,
    setDetectedPlate,
    setPlateConfidence,
    setSpoofingAlert,

    // Core Logic
    loadMoradores,
    loadRegistros,
    registerAccess,
    
    // Gate Control
    openSocialGate,
    closeSocialGate,
    openGarageGate,
    closeGarageGate,

    // AI
    ocrWorker,
    faceapi,
  };

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
};
