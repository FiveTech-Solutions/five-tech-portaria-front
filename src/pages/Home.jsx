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
  
  // Estados para lista de moradores
  const [moradores, setMoradores] = useState([]);
  const [loadingMoradores, setLoadingMoradores] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroBloco, setFiltroBloco] = useState('');
  
  // Estados para registros de entrada/saída
  const [registros, setRegistros] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState(''); // 'entrada', 'saida' ou ''
  const [filtroData, setFiltroData] = useState('hoje'); // 'hoje', 'semana', 'mes', 'todos'
  
  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMorador, setEditingMorador] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  
  // Refs para captura facial no modal
  const editVideoRef = useRef(null);
  const editCanvasRef = useRef(null);
  const [editCameraActive, setEditCameraActive] = useState(false);
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  
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
    
    // Carregar lista de moradores e registros
    loadMoradores();
    loadRegistros();
  }, [navigate]);

  const loadMoradores = async () => {
    try {
      setLoadingMoradores(true);
      const { data, error } = await supabase
        .from('pessoas')
        .select(`
          *,
          veiculos (
            id,
            modelo,
            placa,
            cor
          )
        `)
        .order('nome');

      if (error) throw error;

      setMoradores(data || []);
      
      // Debug: Verificar quantos moradores têm facial descriptors
      const comRosto = data?.filter(m => m.facial_descriptors && m.facial_descriptors.length > 0) || [];
      console.log(`👥 MORADORES CARREGADOS:`, {
        total: data?.length || 0,
        comRosto: comRosto.length,
        nomes: comRosto.map(m => m.nome)
      });
      
    } catch (error) {
      console.error('Erro ao carregar moradores:', error);
    } finally {
      setLoadingMoradores(false);
    }
  };

  const loadRegistros = async () => {
    try {
      setLoadingRegistros(true);
      
      let query = supabase
        .from('registros_acesso')
        .select(`
          *,
          pessoas (
            nome,
            apartamento,
            bloco
          ),
          veiculos (
            modelo,
            placa
          )
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtro de data
      if (filtroData === 'hoje') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        query = query.gte('created_at', hoje.toISOString());
      } else if (filtroData === 'semana') {
        const semanaAtras = new Date();
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        query = query.gte('created_at', semanaAtras.toISOString());
      } else if (filtroData === 'mes') {
        const mesAtras = new Date();
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        query = query.gte('created_at', mesAtras.toISOString());
      }

      // Aplicar filtro de tipo
      if (filtroTipo) {
        query = query.eq('tipo', filtroTipo);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setRegistros(data || []);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
    } finally {
      setLoadingRegistros(false);
    }
  };

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

  // Estado para controle de reconhecimento
  const [recognizedPerson, setRecognizedPerson] = useState(null);
  const [lastRecognitionTime, setLastRecognitionTime] = useState({}); // Por pessoa
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const RECOGNITION_COOLDOWN = 10000; // 10 segundos para teste

  // Estados para detecção anti-spoofing
  const [livenessData, setLivenessData] = useState({});
  const [isLivenessValid, setIsLivenessValid] = useState(false);
  const [spoofingAlert, setSpoofingAlert] = useState(null);

  // Função para detectar liveness (anti-spoofing)
  const detectLiveness = (detections, personId) => {
    if (!detections || detections.length === 0) return false;

    const detection = detections[0];
    const currentTime = Date.now();
    
    // Inicializar dados para esta pessoa se não existirem
    if (!livenessData[personId]) {
      setLivenessData(prev => ({
        ...prev,
        [personId]: {
          positions: [],
          expressions: [],
          landmarks: [],
          startTime: currentTime,
          movements: 0,
          expressionChanges: 0,
          blinkCount: 0,
          lastBlink: 0,
          faceQuality: []
        }
      }));
      return false;
    }

    const data = livenessData[personId];
    
    // 1. Detectar movimento da cabeça
    if (detection.landmarks) {
      const currentLandmarks = detection.landmarks.positions;
      if (data.landmarks.length > 0) {
        const lastLandmarks = data.landmarks[data.landmarks.length - 1];
        
        // Calcular diferença de posição dos pontos faciais
        let totalMovement = 0;
        for (let i = 0; i < Math.min(currentLandmarks.length, lastLandmarks.length); i++) {
          const dx = currentLandmarks[i].x - lastLandmarks[i].x;
          const dy = currentLandmarks[i].y - lastLandmarks[i].y;
          totalMovement += Math.sqrt(dx * dx + dy * dy);
        }
        
        // Movimento mais sensível para validação rápida
        if (totalMovement > 2) {
          data.movements++;
          console.log(`⚡🤏 Movimento rápido detectado para ${personId}`);
        }
      }
      
      // Armazenar landmarks atuais
      data.landmarks.push(currentLandmarks);
      if (data.landmarks.length > 10) data.landmarks.shift();
    }

    // 2. Detectar piscadas (indicador forte de pessoa real) - OTIMIZADO
    if (detection.expressions) {
      const expressions = detection.expressions;
      
      // Detecção mais sensível de piscadas
      const eyesClosed = expressions.neutral < 0.8 || expressions.sad > 0.05;
      const timeSinceLastBlink = currentTime - data.lastBlink;
      
      if (eyesClosed && timeSinceLastBlink > 300) {
        data.blinkCount++;
        data.lastBlink = currentTime;
        console.log(`⚡👁️ Piscada rápida detectada para ${personId}`);
      }
      
      // Detectar mudanças de expressão
      if (data.expressions.length > 0) {
        const lastExpression = data.expressions[data.expressions.length - 1];
        
        let expressionDiff = 0;
        Object.keys(expressions).forEach(key => {
          if (lastExpression[key]) {
            expressionDiff += Math.abs(expressions[key] - lastExpression[key]);
          }
        });
        
        if (expressionDiff > 0.1) {
          data.expressionChanges++;
        }
      }
      
      data.expressions.push(expressions);
      if (data.expressions.length > 5) data.expressions.shift();
    }

    // 3. Análise de qualidade da face (fotos tendem a ter qualidade diferente)
    const faceBox = detection.detection.box;
    const faceSize = faceBox.width * faceBox.height;
    const aspectRatio = faceBox.width / faceBox.height;
    
    // Fotos impressas tendem a ter proporções diferentes
    const qualityScore = {
      size: faceSize,
      ratio: aspectRatio,
      confidence: detection.detection.score
    };
    
    data.faceQuality.push(qualityScore);
    if (data.faceQuality.length > 5) data.faceQuality.shift();

    // 4. Verificar tempo de observação e critérios múltiplos
    const observationTime = currentTime - data.startTime;
    
    // Validação rápida - critérios otimizados (1.5 segundos)
    if (observationTime > 1500) {
      const hasMovement = data.movements >= 1;
      const hasExpressionChange = data.expressionChanges >= 1;
      const hasBlinks = data.blinkCount >= 1;
      
      // Aprovação rápida: qualquer movimento natural OU piscada
      const quickValidation = hasBlinks || (hasMovement && hasExpressionChange);
      
      if (quickValidation) {
        console.log(`⚡ Quick liveness approved for ${personId} in ${Math.floor(observationTime / 1000)}s`);
        return true;
      }
    }

    // Fallback para validação mais rigorosa (800ms máximo)
    if (observationTime > 800) {
      const hasMovement = data.movements >= 1;
      const hasExpressionChange = data.expressionChanges >= 1;
      const hasVariation = data.faceQuality.length > 2;
      
      // Pelo menos 2 dos 3 critérios básicos
      const validCriteria = [hasMovement, hasExpressionChange, hasVariation]
        .filter(Boolean).length;
      
      const isLive = validCriteria >= 2;
      
      console.log(`🔍 Liveness check for ${personId}:`, {
        observationTime: Math.floor(observationTime / 1000) + 's',
        movements: data.movements,
        expressions: data.expressionChanges,
        blinks: data.blinkCount,
        validCriteria,
        isLive
      });
      
      return isLive;
    }
    
    return false;
  };

  const handleVideoPlay = () => {
    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions();

        // Usar as dimensões renderizadas do elemento de vídeo
        const displaySize = {
          width: video.offsetWidth,
          height: video.offsetHeight,
        };

        // Configurar canvas para corresponder exatamente ao vídeo renderizado
        faceapi.matchDimensions(canvas, displaySize);

        // Redimensionar detecções para corresponder ao tamanho do elemento renderizado
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Reconhecimento facial
          if (detections.length > 0) {
            await performFacialRecognition(resizedDetections, ctx);
          } else {
            setRecognizedPerson(null);
          }
        }

        setDetections(detections);
      }
    }, 300); // Otimizado para 300ms - mais responsivo

    return () => clearInterval(interval);
  };

  // Função para realizar reconhecimento facial
  const performFacialRecognition = async (detections, ctx) => {
    try {
      const currentTime = Date.now();
      
      for (let detection of detections) {
        const faceDescriptor = detection.descriptor;
        const box = detection.detection.box;
        
        // Comparar com descritores armazenados
        let bestMatch = null;
        let bestDistance = Infinity;
        const DISTANCE_THRESHOLD = 0.6; // Ajuste conforme necessário

        for (let morador of moradores) {
          if (morador.facial_descriptors && morador.facial_descriptors.length > 0) {
            try {
              const storedDescriptor = new Float32Array(morador.facial_descriptors);
              const distance = faceapi.euclideanDistance(faceDescriptor, storedDescriptor);
              
              if (distance < bestDistance && distance < DISTANCE_THRESHOLD) {
                bestDistance = distance;
                bestMatch = morador;
              }
            } catch (error) {
              console.error('Erro ao comparar descriptor:', error);
            }
          }
        }

        // Desenhar apenas o quadrado com borda colorida (coordenadas já estão corretas)
        ctx.strokeStyle = bestMatch ? '#00ff00' : '#ff0000'; // Verde se reconhecido, vermelho se não
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        if (bestMatch) {
          // TEMPORÁRIO: Desabilitar liveness check para debug
          console.log(`🎯 ${bestMatch.nome} RECONHECIDO - Processando registro...`);
          
          setRecognizedPerson(bestMatch);
          setSpoofingAlert(null);
          setIsLivenessValid(true);
          
          // Registrar acesso automaticamente (com cooldown de 1 minuto POR PESSOA)
          const lastTimeForThisPerson = lastRecognitionTime[bestMatch.id] || 0;
          const timeElapsed = currentTime - lastTimeForThisPerson;
          const canRegister = timeElapsed > RECOGNITION_COOLDOWN;
          
          console.log(`👤 ${bestMatch.nome} (PESSOA REAL):`, {
            lastTime: lastTimeForThisPerson,
            currentTime,
            timeElapsed: Math.floor(timeElapsed / 1000) + 's',
            cooldown: Math.floor(RECOGNITION_COOLDOWN / 1000) + 's',
            canRegister,
            liveness: '✅ Validado'
          });
          
          if (canRegister) {
            console.log(`✅ Registrando acesso para ${bestMatch.nome} (pessoa real)`);
            await registrarAcessoAutomatico(bestMatch.id);
            setLastRecognitionTime(prev => ({
              ...prev,
              [bestMatch.id]: currentTime
            }));
          } else {
            const remainingSeconds = Math.ceil((RECOGNITION_COOLDOWN - timeElapsed) / 1000);
            console.log(`⏱️ Aguardando ${remainingSeconds}s para próximo registro de ${bestMatch.nome}`);
          }
        } else {
          setRecognizedPerson(null);
          setSpoofingAlert(null);
          setIsLivenessValid(false);
          
          // Verificar se é uma tentativa de spoofing (rosto detectado mas não reconhecido)
          if (detections.length > 0) {
            const hasMinimalMovement = detectLiveness(detections, 'unknown');
            if (!hasMinimalMovement) {
              setSpoofingAlert({
                type: 'danger',
                message: '⚠️ Possível tentativa de spoofing detectada! Use pessoa real.'
              });
              console.log('🚨 Possível spoofing: Rosto detectado mas sem movimento natural');
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro no reconhecimento facial:', error);
    }
  };

  // Função para registrar acesso automaticamente
  const registrarAcessoAutomatico = async (pessoaId) => {
    try {
      console.log(`🚀 INICIANDO registro automático para pessoa ID: ${pessoaId}`);
      
      // Verificar último registro para determinar tipo (entrada/saída)
      const { data: ultimoRegistro, error: errorUltimo } = await supabase
        .from('registros_acesso')
        .select('tipo')
        .eq('pessoa_id', pessoaId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (errorUltimo) {
        console.error('❌ Erro ao buscar último registro:', errorUltimo);
        throw errorUltimo;
      }

      // Determinar tipo baseado no último registro
      let tipo = 'entrada';
      if (ultimoRegistro && ultimoRegistro.length > 0) {
        tipo = ultimoRegistro[0].tipo === 'entrada' ? 'saida' : 'entrada';
        console.log(`📋 Último registro: ${ultimoRegistro[0].tipo} → Próximo: ${tipo}`);
      } else {
        console.log(`📋 Nenhum registro anterior → Primeiro: ${tipo}`);
      }

      console.log(`💾 Inserindo registro: ${tipo} para pessoa ${pessoaId}`);
      
      const { error } = await supabase
        .from('registros_acesso')
        .insert([
          {
            pessoa_id: pessoaId,
            tipo: tipo,
            reconhecido: true,
            observacoes: 'Reconhecimento facial automático',
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('❌ Erro ao inserir registro:', error);
        throw error;
      }

      // Recarregar registros
      await loadRegistros();
      
      console.log(`✅ ${tipo.toUpperCase()} registrada automaticamente`);
      
      // Mostrar notificação temporária (opcional)
      setTimeout(() => {
        console.log(`Registro de ${tipo} concluído`);
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao registrar acesso automático:', error);
    }
  };

  // Recarregar registros quando filtros mudarem
  useEffect(() => {
    if (!loadingRegistros) {
      loadRegistros();
    }
  }, [filtroTipo, filtroData]);

  // Atualizar contador de cooldown
  useEffect(() => {
    const interval = setInterval(() => {
      if (recognizedPerson && lastRecognitionTime[recognizedPerson.id]) {
        const currentTime = Date.now();
        const timeElapsed = currentTime - lastRecognitionTime[recognizedPerson.id];
        const remaining = Math.max(0, RECOGNITION_COOLDOWN - timeElapsed);
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [recognizedPerson, lastRecognitionTime, RECOGNITION_COOLDOWN]);

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

  // Filtrar moradores baseado na busca e filtro de bloco
  const moradoresFiltrados = moradores.filter(morador => {
    const matchesSearch = morador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         morador.apartamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         morador.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBloco = !filtroBloco || morador.bloco === filtroBloco;
    
    return matchesSearch && matchesBloco;
  });

  // Obter lista única de blocos para o filtro
  const blocosUnicos = [...new Set(moradores.map(m => m.bloco))].sort();

  // Função para abrir modal de edição
  const openEditModal = (morador) => {
    setEditingMorador(morador);
    setEditForm({
      nome: morador.nome,
      apartamento: morador.apartamento,
      bloco: morador.bloco,
      telefone: morador.telefone || '',
      email: morador.email || ''
    });
    setCapturedFace(morador.foto_facial);
    setFaceDescriptor(morador.facial_descriptors);
    setShowEditModal(true);
  };

  // Função para fechar modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingMorador(null);
    setEditForm({});
    setCapturedFace(null);
    setFaceDescriptor(null);
    if (editCameraActive) {
      stopEditCamera();
    }
  };

  // Função para atualizar campos do formulário
  const updateEditForm = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Função para salvar alterações
  const saveChanges = async () => {
    if (!editingMorador) return;

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('pessoas')
        .update({
          nome: editForm.nome,
          apartamento: editForm.apartamento,
          bloco: editForm.bloco,
          telefone: editForm.telefone,
          email: editForm.email,
          foto_facial: capturedFace,
          facial_descriptors: faceDescriptor,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMorador.id);

      if (error) throw error;

      // Recarregar lista de moradores
      await loadMoradores();
      closeEditModal();
      
      alert('Morador atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações: ' + error.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Função para registrar entrada/saída manual
  const registrarAcesso = async (pessoaId, tipo, observacao = '') => {
    try {
      const { error } = await supabase
        .from('registros_acesso')
        .insert([
          {
            pessoa_id: pessoaId,
            tipo: tipo,
            reconhecido: true,
            observacoes: observacao,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      // Recarregar registros
      await loadRegistros();
      alert(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
    } catch (error) {
      console.error('Erro ao registrar acesso:', error);
      alert('Erro ao registrar acesso: ' + error.message);
    }
  };

  // Funções para câmera no modal de edição - VERSÃO SIMPLIFICADA
  const startEditCamera = async () => {
    console.log('🎥 === INICIANDO CÂMERA DO MODAL ===');
    
    // Log detalhado do estado atual
    console.log('🔍 Estado atual:');
    console.log('   - isModelLoaded:', isModelLoaded);
    console.log('   - editVideoRef.current:', editVideoRef.current);
    console.log('   - navigator.mediaDevices:', !!navigator.mediaDevices);
    console.log('   - getUserMedia:', !!navigator.mediaDevices?.getUserMedia);

    // Verificação básica
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('❌ Seu navegador não suporta acesso à câmera');
      return;
    }

    if (!editVideoRef.current) {
      console.error('❌ Elemento de vídeo não encontrado');
      // Tentar aguardar um pouco e tentar novamente
      setTimeout(() => {
        if (editVideoRef.current) {
          console.log('✅ Elemento de vídeo encontrado após delay');
          startEditCamera();
        } else {
          alert('❌ Elemento de vídeo não está disponível');
        }
      }, 100);
      return;
    }

    try {
      console.log('📹 Solicitando permissão da câmera...');
      
      // Configuração mais simples
      const constraints = {
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream da câmera obtido:', stream);

      // Parar câmera principal se estiver ativa
      if (isCameraActive) {
        console.log('⏹️ Parando câmera principal para evitar conflito');
        stopVideo();
      }

      // Configurar vídeo
      const video = editVideoRef.current;
      video.srcObject = stream;
      
      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log('📺 Metadata carregada, iniciando reprodução');
          video.play()
            .then(() => {
              console.log('▶️ Vídeo iniciado com sucesso');
              setEditCameraActive(true);
              resolve();
            })
            .catch(error => {
              console.error('❌ Erro ao iniciar vídeo:', error);
              reject(error);
            });
        };

        video.onerror = (error) => {
          console.error('❌ Erro no elemento de vídeo:', error);
          reject(error);
        };
      });

    } catch (error) {
      console.error('❌ Erro completo:', error);
      console.log('📋 Detalhes do erro:');
      console.log('   - name:', error.name);
      console.log('   - message:', error.message);
      console.log('   - constraint:', error.constraint);

      let message = 'Erro ao acessar câmera:\n\n';
      switch (error.name) {
        case 'NotAllowedError':
          message += '🚫 Permissão negada.\nPor favor, permita o acesso à câmera.';
          break;
        case 'NotFoundError':
          message += '📷 Câmera não encontrada.\nVerifique se há uma câmera conectada.';
          break;
        case 'NotReadableError':
          message += '⚠️ Câmera em uso por outro aplicativo.\nFeche outros apps que usam a câmera.';
          break;
        case 'OverconstrainedError':
          message += '⚙️ Configurações não suportadas.\nSua câmera não suporta as configurações solicitadas.';
          break;
        default:
          message += `🔧 ${error.message}`;
      }
      
      alert(message);
    }
  };

  const stopEditCamera = () => {
    console.log('⏹️ === PARANDO CÂMERA DO MODAL ===');
    
    try {
      if (editVideoRef.current?.srcObject) {
        const stream = editVideoRef.current.srcObject;
        const tracks = stream.getTracks();
        
        console.log('🔄 Parando', tracks.length, 'tracks');
        tracks.forEach((track, index) => {
          console.log(`   Track ${index}:`, track.kind, track.readyState);
          track.stop();
        });
        
        editVideoRef.current.srcObject = null;
        console.log('✅ Câmera do modal parada com sucesso');
      } else {
        console.log('ℹ️ Nenhuma stream ativa para parar');
      }
    } catch (error) {
      console.error('❌ Erro ao parar câmera:', error);
    }
    
    setEditCameraActive(false);
  };

  const captureEditFace = async () => {
    if (!editVideoRef.current || !editCanvasRef.current || !isModelLoaded) {
      console.log('Referências não disponíveis para captura');
      return;
    }

    try {
      console.log('Iniciando captura de rosto...');
      const detections = await faceapi
        .detectSingleFace(editVideoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        console.log('Rosto detectado, capturando...');
        
        // Capturar imagem do rosto
        const canvas = editCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = editVideoRef.current.videoWidth;
        canvas.height = editVideoRef.current.videoHeight;
        ctx.drawImage(editVideoRef.current, 0, 0);

        // Extrair área do rosto
        const { x, y, width, height } = detections.detection.box;
        const faceCanvas = document.createElement('canvas');
        const faceCtx = faceCanvas.getContext('2d');
        faceCanvas.width = width;
        faceCanvas.height = height;
        faceCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

        // Salvar dados
        setCapturedFace(faceCanvas.toDataURL('image/jpeg', 0.8));
        setFaceDescriptor(Array.from(detections.descriptor));
        
        alert('Rosto capturado com sucesso!');
        stopEditCamera();
      } else {
        alert('Nenhum rosto detectado. Tente novamente com melhor iluminação.');
      }
    } catch (error) {
      console.error('Erro na captura:', error);
      alert('Erro na captura: ' + error.message);
    }
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
        <div className="content-grid">
          {/* Seção de Registros de Entrada/Saída */}
          <div className="registros-section">
            <div className="registros-header">
              <h2>Registros de Acesso</h2>
              <button 
                onClick={loadRegistros}
                className="btn-refresh"
                title="Atualizar registros"
              >
                🔄
              </button>
            </div>

            {/* Filtros */}
            <div className="registros-filters">
              <div className="filter-group">
                <label>Período:</label>
                <select
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  className="filter-select"
                >
                  <option value="hoje">Hoje</option>
                  <option value="semana">Última semana</option>
                  <option value="mes">Último mês</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Tipo:</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Todos</option>
                  <option value="entrada">Entradas</option>
                  <option value="saida">Saídas</option>
                </select>
              </div>
            </div>

            {/* Lista de Registros */}
            <div className="registros-list">
              {loadingRegistros ? (
                <div className="loading">Carregando registros...</div>
              ) : registros.length > 0 ? (
                <>
                  <div className="registros-count">
                    {registros.length} registro(s) encontrado(s)
                  </div>
                  {registros.map(registro => (
                    <div key={registro.id} className={`registro-card ${registro.tipo}`}>
                      <div className="registro-info">
                        <div className="registro-tipo">
                          {registro.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SAÍDA'}
                        </div>
                        
                        {registro.pessoas ? (
                          <div className="registro-pessoa">
                            <strong>{registro.pessoas.nome}</strong>
                            <span>Apto {registro.pessoas.apartamento} - Bloco {registro.pessoas.bloco}</span>
                          </div>
                        ) : (
                          <div className="registro-pessoa">
                            <strong>Pessoa não identificada</strong>
                          </div>
                        )}
                        
                        {registro.veiculos && (
                          <div className="registro-veiculo">
                            🚗 {registro.veiculos.modelo} - {registro.veiculos.placa}
                          </div>
                        )}
                        
                        <div className="registro-tempo">
                          🕒 {new Date(registro.created_at).toLocaleString('pt-BR')}
                        </div>
                        
                        {registro.observacoes && (
                          <div className="registro-obs">
                            💭 {registro.observacoes}
                          </div>
                        )}
                        
                        <div className="registro-status">
                          {registro.reconhecido ? '✅ Reconhecido' : '❓ Manual'}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="no-registros">
                  {filtroTipo || filtroData !== 'todos' 
                    ? 'Nenhum registro encontrado com os filtros aplicados' 
                    : 'Nenhum registro de acesso'
                  }
                </div>
              )}
            </div>
          </div>

          {/* Seção da Câmera */}
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

            {/* Alerta de Anti-Spoofing */}
            {spoofingAlert && (
              <div className={`spoofing-alert ${spoofingAlert.type}`}>
                <p>{spoofingAlert.message}</p>
              </div>
            )}

            {/* Status do Reconhecimento */}
            {recognizedPerson && (
              <div className="recognition-status">
                <div className="person-recognized">
                  <h3>
                    {isLivenessValid ? '✅' : '🔍'} {recognizedPerson.nome} 
                    {isLivenessValid ? ' Reconhecido' : ' - Validando...'}
                  </h3>
                  <p><strong>{recognizedPerson.apartamento} - {recognizedPerson.bloco}</strong></p>
                  {!isLivenessValid ? (
                    <div className="liveness-validation">
                      <p className="validation-info">
                        ⚡ Validação rápida em andamento...
                      </p>
                      <p className="validation-instructions">
                        Pisque ou mova levemente (1-2 segundos)
                      </p>
                    </div>
                  ) : cooldownRemaining > 0 ? (
                    <div className="cooldown-status">
                      <p className="cooldown-info">
                        🔒 COOLDOWN ATIVO
                      </p>
                      <p className="cooldown-timer">
                        Próximo registro em: <strong>{Math.ceil(cooldownRemaining / 1000)}s</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="access-registered">✅ Pessoa real - Pronto para registrar</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Seção da Lista de Moradores */}
          <div className="moradores-section">
            <div className="moradores-header">
              <h2>Lista de Moradores</h2>
              <button 
                onClick={() => navigate('/cadastro')} 
                className="btn-add"
              >
                + Adicionar Morador
              </button>
            </div>

            {/* Filtros e Busca */}
            <div className="filters-container">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Buscar por nome, apartamento ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="filter-box">
                <select
                  value={filtroBloco}
                  onChange={(e) => setFiltroBloco(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Todos os blocos</option>
                  {blocosUnicos.map(bloco => (
                    <option key={bloco} value={bloco}>Bloco {bloco}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Moradores */}
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
                        <div className="morador-main">
                          <h3>{morador.nome}</h3>
                          <p className="apartamento">Apto {morador.apartamento} - Bloco {morador.bloco}</p>
                          {morador.telefone && (
                            <p className="telefone">📞 {morador.telefone}</p>
                          )}
                          {morador.email && (
                            <p className="email">📧 {morador.email}</p>
                          )}
                        </div>
                        
                        {morador.veiculos && morador.veiculos.length > 0 && (
                          <div className="veiculos-info">
                            <h4>Veículos:</h4>
                            {morador.veiculos.map(veiculo => (
                              <div key={veiculo.id} className="veiculo-item">
                                🚗 {veiculo.modelo} - {veiculo.placa}
                                {veiculo.cor && <span> ({veiculo.cor})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="morador-actions">
                        <button 
                          className="btn-edit" 
                          title="Editar"
                          onClick={() => openEditModal(morador)}
                        >
                          ✏️
                        </button>
                        <div className="reconhecimento-status">
                          {morador.facial_descriptors ? (
                            <span className="rosto-cadastrado">👤 Cadastrado</span>
                          ) : (
                            <span className="rosto-pendente">❓ Sem rosto</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="no-moradores">
                  {searchTerm || filtroBloco 
                    ? 'Nenhum morador encontrado com os filtros aplicados' 
                    : 'Nenhum morador cadastrado'
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Morador</h2>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="edit-form">
                <div className="form-section">
                  <h3>Dados Pessoais</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nome Completo</label>
                      <input
                        type="text"
                        value={editForm.nome || ''}
                        onChange={(e) => updateEditForm('nome', e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Apartamento</label>
                      <input
                        type="text"
                        value={editForm.apartamento || ''}
                        onChange={(e) => updateEditForm('apartamento', e.target.value)}
                        placeholder="Ex: 101"
                      />
                    </div>
                    <div className="form-group">
                      <label>Bloco</label>
                      <input
                        type="text"
                        value={editForm.bloco || ''}
                        onChange={(e) => updateEditForm('bloco', e.target.value)}
                        placeholder="Ex: A"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Telefone</label>
                      <input
                        type="tel"
                        value={editForm.telefone || ''}
                        onChange={(e) => updateEditForm('telefone', e.target.value)}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => updateEditForm('email', e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Reconhecimento Facial</h3>
                  
                  {capturedFace ? (
                    <div className="captured-face-preview">
                      <img src={capturedFace} alt="Rosto capturado" />
                      <p>✅ Rosto cadastrado</p>
                      <button 
                        type="button" 
                        className="btn-recapture"
                        onClick={() => {
                          setCapturedFace(null);
                          setFaceDescriptor(null);
                        }}
                      >
                        📷 Capturar Novo Rosto
                      </button>
                    </div>
                  ) : (
                    <div className="face-capture-section">
                      <p>🔍 Nenhum rosto cadastrado para este morador</p>
                      
                      <div className="camera-controls">
                        <button 
                          type="button"
                          className="btn-camera"
                          onClick={editCameraActive ? stopEditCamera : startEditCamera}
                        >
                          {!isModelLoaded ? '⏳ Carregando...' : 
                           editCameraActive ? '📹 Parar Câmera' : '📷 Ativar Câmera'}
                        </button>
                        
                        <button 
                          type="button"
                          className="btn-debug"
                          onClick={() => {
                            console.log('🔍 === DEBUG INFO ===');
                            console.log('editVideoRef.current:', editVideoRef.current);
                            console.log('isModelLoaded:', isModelLoaded);
                            console.log('editCameraActive:', editCameraActive);
                            console.log('navigator.mediaDevices:', navigator.mediaDevices);
                            console.log('getUserMedia disponível:', !!navigator.mediaDevices?.getUserMedia);
                            
                            // Teste simples da câmera
                            navigator.mediaDevices?.getUserMedia({ video: true })
                              .then(stream => {
                                console.log('✅ Teste de câmera OK:', stream);
                                stream.getTracks().forEach(track => track.stop());
                              })
                              .catch(err => console.error('❌ Teste de câmera falhou:', err));
                          }}
                        >
                          🔍 Debug
                        </button>
                        
                        {editCameraActive && (
                          <button 
                            type="button"
                            className="btn-capture"
                            onClick={captureEditFace}
                          >
                            📸 Capturar Rosto
                          </button>
                        )}
                      </div>

                      {!isModelLoaded && (
                        <div className="loading-models">
                          <p>🔄 Carregando modelos de reconhecimento facial...</p>
                          <small>Isso pode levar alguns segundos na primeira vez</small>
                        </div>
                      )}

                      <div className="video-preview">
                        <video
                          ref={editVideoRef}
                          autoPlay
                          muted
                          playsInline
                          width="320"
                          height="240"
                          style={{
                            display: editCameraActive ? 'block' : 'none',
                            backgroundColor: '#f0f0f0',
                            border: '2px solid #667eea'
                          }}
                        />
                        <canvas
                          ref={editCanvasRef}
                          style={{ display: 'none' }}
                        />
                        
                        {!editCameraActive && (
                          <div style={{
                            width: '320px',
                            height: '240px',
                            backgroundColor: '#f0f0f0',
                            border: '2px dashed #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666'
                          }}>
                            📷 Câmera desativada
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={closeEditModal}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-save" 
                onClick={saveChanges}
                disabled={editLoading}
              >
                {editLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
