import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AppSettings,
  CanvasTab,
  DEFAULT_SETTINGS,
  GestureType,
  HandLandmark,
  LANDMARK_INDICES,
  Point,
  TrackingData,
} from '@/types';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useSmoothDrawing, getShiftedColor, getRainbowColor } from '@/hooks/useSmoothDrawing';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { detectGesture, getClearGestureProgress, resetGestureState, detectMouthState } from '@/utils/gestureDetection';
import { landmarkToCanvas } from '@/utils/coordinateUtils';
import { drawCursor, clearCanvas, saveCanvasAsPNG } from '@/utils/canvasUtils';
import { ParticleSystem } from '@/utils/particleSystem';
import CameraView from '@/components/CameraView';
import DrawingCanvas from '@/components/DrawingCanvas';
import ControlsPanel from '@/components/ControlsPanel';
import FPSCounter from '@/components/FPSCounter';
import GestureIndicator from '@/components/GestureIndicator';
import OnboardingModal from '@/components/OnboardingModal';
import TabBar from '@/components/TabBar';
import FloatingActionBar from '@/components/FloatingActionBar';
import { drawMLSkeletons } from '@/utils/mlDrawUtils';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const App: React.FC = () => {
  /* ============================== STATE ============================== */
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [clearProgress, setClearProgress] = useState(0);
  const [fps, setFps] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [showOnboarding, setShowOnboarding] = useState(
    !localStorage.getItem('airsketch-ai-onboarded')
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Camera...');

  // Lip / Mouth State
  const [mouthState, setMouthState] = useState<'neutral' | 'open' | 'smile' | 'pursed'>('neutral');

  // Swipe Features Toggles Flash Overlay
  const [swipeFlash, setSwipeFlash] = useState<'left' | 'right' | null>(null);
  
  // Tab transition visual sweep effect
  const [tabTransition, setTabTransition] = useState<boolean>(false);

  // Tabs
  const [tabs, setTabs] = useState<CanvasTab[]>([
    { id: generateId(), name: 'Canvas 1', imageData: null, strokes: [] },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  // Tracking Data for visualization overlay (Direct ref representation)
  const trackingDataRef = useRef<TrackingData>({
    hands: [],
    handedness: [],
    pose: null,
    face: null,
  });

  /* ============================== REFS ============================== */
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const mlCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef(new ParticleSystem());
  const animFrameRef = useRef<number>(0);
  
  const settingsRef = useRef(settings);
  const fpsFramesRef = useRef<number[]>([]);
  const lastGestureRef = useRef<GestureType>('none');
  const canvasSnapshotsRef = useRef<ImageData[]>([]);

  // Track drawing states for left and right hand independently
  const activeDrawingHandsRef = useRef<Record<string, boolean>>({ Left: false, Right: false });
  const latestPointerRef = useRef<Record<string, Point | null>>({ Left: null, Right: null });

  // Refs for gesture, mouth state, and tracking state to avoid state closure issues in the render loop
  const currentGestureRef = useRef<GestureType>('none');
  const mouthStateRef = useRef<'neutral' | 'open' | 'smile' | 'pursed'>('neutral');
  const isTrackingRef = useRef(false);

  settingsRef.current = settings;

  /* ============================== DRAWING ENGINE ============================== */
  const drawing = useSmoothDrawing();
  const { addPoint, endStroke, activeStrokes } = drawing;
  
  const drawingInternals = drawing as ReturnType<typeof useSmoothDrawing> & {
    drawCurrentStroke: (ctx: CanvasRenderingContext2D, settings: AppSettings, handKey?: string) => void;
  };

  /* ============================== VIDEO RECORDER ============================== */
  const { isRecording, toggleRecording } = useVideoRecorder();

  /* ============================== TAB MANAGEMENT ============================== */
  const saveCurrentTabSnapshot = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, imageData } : tab
      )
    );
  }, [activeTabId]);

  const restoreTabSnapshot = useCallback((tab: CanvasTab) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (tab.imageData) {
      ctx.putImageData(tab.imageData, 0, 0);
    }
  }, []);

  const handleSelectTab = useCallback(
    (id: string) => {
      if (id === activeTabId) return;
      
      // Trigger canvas sweep animation
      setTabTransition(true);
      setTimeout(() => setTabTransition(false), 500);

      saveCurrentTabSnapshot();
      setActiveTabId(id);
      const tab = tabs.find((t) => t.id === id);
      if (tab) {
        setTimeout(() => restoreTabSnapshot(tab), 0);
      }
    },
    [activeTabId, tabs, saveCurrentTabSnapshot, restoreTabSnapshot]
  );

  const handleAddTab = useCallback(() => {
    // Trigger canvas sweep animation
    setTabTransition(true);
    setTimeout(() => setTabTransition(false), 500);

    saveCurrentTabSnapshot();
    const newTab: CanvasTab = {
      id: generateId(),
      name: `Canvas ${tabs.length + 1}`,
      imageData: null,
      strokes: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    const canvas = drawCanvasRef.current;
    if (canvas) {
      clearCanvas(canvas);
    }
    canvasSnapshotsRef.current = [];
  }, [tabs.length, saveCurrentTabSnapshot]);

  const handleCloseTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) return;
      const remaining = tabs.filter((t) => t.id !== id);
      setTabs(remaining);
      if (id === activeTabId) {
        const newActive = remaining[0];
        setActiveTabId(newActive.id);
        setTimeout(() => restoreTabSnapshot(newActive), 0);
      }
    },
    [tabs, activeTabId, restoreTabSnapshot]
  );

  const handleSwipeTab = useCallback(
    (direction: number) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      if (nextIndex !== currentIndex) {
        handleSelectTab(tabs[nextIndex].id);
      }
    },
    [tabs, activeTabId, handleSelectTab]
  );

  const handleSettingsChange = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Full-screen overlay flash when toggling features via swipe
  const handleSwipeFeatureToggle = useCallback((enable: boolean) => {
    setSwipeFlash(enable ? 'right' : 'left');
    setTimeout(() => setSwipeFlash(null), 850);
    
    handleSettingsChange({
      showMLVisualization: enable,
      particlesEnabled: enable,
      lipTracking: enable,
    });
  }, [handleSettingsChange]);

  /* ============================== UNDO ============================== */
  const saveUndoSnapshot = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvasSnapshotsRef.current.push(snapshot);
    if (canvasSnapshotsRef.current.length > 30) {
      canvasSnapshotsRef.current.shift();
    }
  }, []);

  const handleUndo = useCallback(() => {
    const snapshots = canvasSnapshotsRef.current;
    if (snapshots.length === 0) return;
    const snapshot = snapshots.pop()!;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  /* ============================== ACTIONS ============================== */
  const handleClear = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      saveUndoSnapshot();
      clearCanvas(canvas);
    }
    particleSystemRef.current.clear();
    canvasSnapshotsRef.current = [];
    resetGestureState();
  }, [saveUndoSnapshot]);

  const handleSave = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) saveCanvasAsPNG(canvas, 'airsketch-drawing.png', false);
  }, []);

  const handleSaveTransparent = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) saveCanvasAsPNG(canvas, 'airsketch-drawing-transparent.png', true);
  }, []);

  const handleStartCamera = useCallback(() => {
    setCameraEnabled(true);
    setErrorMessage(null);
    setLoadingStatus('Initializing Camera...');
    // Cycle through loading status messages for UX delight
    const timer1 = setTimeout(() => setLoadingStatus('Loading AI Hand Tracking...'), 1500);
    const timer2 = setTimeout(() => setLoadingStatus('Warming Up Neural Networks...'), 3500);
    const timer3 = setTimeout(() => setLoadingStatus('Almost Ready...'), 5500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleStopCamera = useCallback(() => {
    setCameraEnabled(false);
    setMouthState('neutral');
    mouthStateRef.current = 'neutral';
    setCurrentGesture('none');
    currentGestureRef.current = 'none';
    trackingDataRef.current = { hands: [], handedness: [], pose: null, face: null };
  }, []);

  const handleToggleRecording = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) toggleRecording(canvas);
  }, [toggleRecording]);

  /* ============================== HAND TRACKING RESULTS ============================== */
  const handleHandResults = useCallback(
    (data: TrackingData) => {
      trackingDataRef.current = data;

      const s = settingsRef.current;
      const canvas = drawCanvasRef.current;
      if (!canvas) return;

      // ─── 1. Face & Lip Tracking Classifier ───
      let activeMouth: 'neutral' | 'open' | 'smile' | 'pursed' = 'neutral';
      if (s.lipTracking && data.face) {
        activeMouth = detectMouthState(data.face);
        if (mouthStateRef.current !== activeMouth) {
          setMouthState(activeMouth);
          mouthStateRef.current = activeMouth;
        }
      } else {
        if (mouthStateRef.current !== 'neutral') {
          setMouthState('neutral');
          mouthStateRef.current = 'neutral';
        }
      }

      // ─── 2. If no hands are detected, clear drawing states ───
      if (!data.hands || data.hands.length === 0) {
        if (activeDrawingHandsRef.current.Left) {
          activeDrawingHandsRef.current.Left = false;
          endStroke('Left');
        }
        if (activeDrawingHandsRef.current.Right) {
          activeDrawingHandsRef.current.Right = false;
          endStroke('Right');
        }
        if (currentGestureRef.current !== 'none') {
          setCurrentGesture('none');
          currentGestureRef.current = 'none';
        }
        return;
      }

      // ─── 3. Process hands ───
      // Process both hands if dual drawing is on, otherwise just process the first hand
      const numHands = s.dualHandDrawing ? data.hands.length : Math.min(1, data.hands.length);
      const currentDrawingState = { Left: false, Right: false };
      let primaryGesture: GestureType = 'none';

      for (let i = 0; i < numHands; i++) {
        const landmarks = data.hands[i];
        const handLabel = data.handedness[i] || (i === 0 ? 'Right' : 'Left');
        const handKey = handLabel === 'Left' ? 'Left' : 'Right';

        const gesture = detectGesture(landmarks, i);
        const gestureType = gesture.type;

        if (i === 0) {
          primaryGesture = gestureType;
          if (currentGestureRef.current !== gestureType) {
            setCurrentGesture(gestureType);
            currentGestureRef.current = gestureType;
          }
          setClearProgress(getClearGestureProgress());
        }

        // Handle swipe gestures for tab switching (only primary hand triggers it)
        if (i === 0 && (gestureType === 'swipe-left' || gestureType === 'swipe-right')) {
          if (lastGestureRef.current !== gestureType) {
            handleSwipeTab(gestureType === 'swipe-left' ? -1 : 1);
          }
        }

        // Swipe right turns features ON, Left turns features OFF (primary hand)
        if (i === 0 && (gestureType === 'swipe-right' || gestureType === 'swipe-left')) {
          if (lastGestureRef.current !== gestureType) {
            const enable = gestureType === 'swipe-right';
            handleSwipeFeatureToggle(enable);
          }
        }

        // Handle clear gesture (primary hand)
        if (i === 0 && gestureType === 'clear') {
          if (lastGestureRef.current !== 'clear') {
            handleClear();
          }
        }

        if (i === 0) {
          lastGestureRef.current = gestureType;
        }

        // Determine drawing state
        let shouldDraw = gestureType === 'draw' && s.drawingMode === 'draw';
        let shouldErase = (gestureType === 'draw' && s.drawingMode === 'eraser') || gestureType === 'palm-erase';

        // Lip reading behavior override (pursed lips behave like eraser)
        if (s.lipControlActions) {
          if (activeMouth === 'pursed') {
            shouldErase = true;
            shouldDraw = false;
          }
        }

        // Calculate dynamic properties based on mouth states
        const openBoost = s.lipControlActions && activeMouth === 'open';
        const activeBrushSize = openBoost ? s.brushSize * 1.8 : s.brushSize;
        const activeGlowIntensity = openBoost ? s.glowIntensity * 1.4 : s.glowIntensity;
        
        const activeColor = (s.rainbowBrush || (s.lipControlActions && activeMouth === 'smile'))
          ? getRainbowColor(performance.now())
          : s.strokeColor;
        const finalColor = handKey === 'Left' ? getShiftedColor(activeColor) : activeColor;

        const indexTip = landmarks[LANDMARK_INDICES.INDEX_TIP];
        const point = landmarkToCanvas(indexTip, canvas.width, canvas.height);
        latestPointerRef.current[handKey] = point;

        if (shouldDraw) {
          if (!activeDrawingHandsRef.current[handKey]) {
            activeDrawingHandsRef.current[handKey] = true;
            saveUndoSnapshot();
          }
          currentDrawingState[handKey] = true;
          
          addPoint(point, { 
            ...s, 
            brushSize: activeBrushSize, 
            glowIntensity: activeGlowIntensity,
            strokeColor: finalColor
          }, handKey);

          // Emit particles while drawing
          if (s.particlesEnabled) {
            const count = openBoost ? 4 : 2;
            particleSystemRef.current.emit(point, finalColor, count);
          }
        } else if (shouldErase) {
          if (!activeDrawingHandsRef.current[handKey]) {
            activeDrawingHandsRef.current[handKey] = true;
            saveUndoSnapshot();
          }
          currentDrawingState[handKey] = true;
          
          const eraseRadius = gestureType === 'palm-erase' ? s.brushSize * 8 : s.brushSize * 1.5;
          addPoint(point, { ...s, drawingMode: 'eraser', brushSize: eraseRadius }, handKey);

          // Emit falling eraser dust particles for a tactile feel
          if (s.particlesEnabled) {
            const count = gestureType === 'palm-erase' ? 8 : 2;
            particleSystemRef.current.emit(point, 'rgba(220, 230, 255, 0.4)', count);
          }
        } else {
          if (activeDrawingHandsRef.current[handKey]) {
            activeDrawingHandsRef.current[handKey] = false;
            endStroke(handKey);
          }
        }
      }

      // Cleanup left hand drawing state if dual hand drawing gets disabled mid-flight
      if (!s.dualHandDrawing && activeDrawingHandsRef.current.Left) {
        activeDrawingHandsRef.current.Left = false;
        endStroke('Left');
      }
    },
    [addPoint, endStroke, handleSwipeTab, handleClear, saveUndoSnapshot, handleSwipeFeatureToggle]
  );

  /* ============================== HAND TRACKING HOOK ============================== */
  const {
    isLoading,
    error: trackingError,
    isTracking,
    startCamera,
    stopCamera,
    switchCamera,
  } = useHandTracking({
    videoElement: videoRef.current,
    onResults: handleHandResults,
    enabled: cameraEnabled,
    cameraFacing: settings.cameraFacing,
    bodyTrackingEnabled: settings.bodyTracking,
    lipTrackingEnabled: settings.lipTracking,
  });

  // Sync cameraFacing change
  useEffect(() => {
    if (isTracking) {
      switchCamera();
    }
  }, [settings.cameraFacing]);

  // Propagate tracking errors
  useEffect(() => {
    if (trackingError) {
      setErrorMessage(trackingError);
    }
  }, [trackingError]);

  // Sync isTrackingRef to bypass state closing in renderLoop
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  /* ============================== RENDER LOOP ============================== */
  useEffect(() => {
    const cursorCanvas = cursorCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    const mlCanvas = mlCanvasRef.current;
    if (!cursorCanvas || !drawCanvas) return;

    const cursorCtx = cursorCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d');
    const mlCtx = mlCanvas ? mlCanvas.getContext('2d') : null;
    if (!cursorCtx || !drawCtx) return;

    let lastTime = performance.now();

    const renderLoop = () => {
      const now = performance.now();
      const delta = now - lastTime;

      // FPS calculation
      fpsFramesRef.current.push(delta);
      if (fpsFramesRef.current.length > 60) fpsFramesRef.current.shift();
      const avgDelta =
        fpsFramesRef.current.reduce((a, b) => a + b, 0) / fpsFramesRef.current.length;
      const currentFps = Math.round(1000 / avgDelta);
      if (Math.abs(currentFps - fps) > 2) {
        setFps(currentFps);
      }
      lastTime = now;

      const s = settingsRef.current;
      const isTrackingActive = isTrackingRef.current;

      // Draw ML Skeletons directly on canvas to bypass React updates
      if (mlCanvas && mlCtx) {
        mlCtx.clearRect(0, 0, mlCanvas.width, mlCanvas.height);
        if (s.showMLVisualization && isTrackingActive) {
          drawMLSkeletons(
            mlCtx,
            trackingDataRef.current,
            currentGestureRef.current,
            mouthStateRef.current,
            mlCanvas.width,
            mlCanvas.height
          );
        }
      }

      // Clear cursor canvas
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

      // Draw current stroke segment for active drawing hands onto drawing canvas
      const isLeftDrawing = activeDrawingHandsRef.current.Left;
      const isRightDrawing = activeDrawingHandsRef.current.Right;

      if (isLeftDrawing) {
        drawingInternals.drawCurrentStroke(drawCtx, s, 'Left');
      }
      if (isRightDrawing) {
        drawingInternals.drawCurrentStroke(drawCtx, s, 'Right');
      }

      // Update and render particles on cursor canvas
      if (s.particlesEnabled) {
        particleSystemRef.current.update();
        particleSystemRef.current.draw(cursorCtx);
      }

      // Draw cursors for all active hands
      Object.keys(latestPointerRef.current).forEach((key) => {
        const lastPoint = latestPointerRef.current[key];
        
        if (lastPoint) {
          const isLeft = key === 'Left';
          const isHandDrawing = activeDrawingHandsRef.current[key];
          
          // Draw customized large ring cursor if palm-erasing
          const isPalmErase = !isLeft && currentGestureRef.current === 'palm-erase';
          const isErasing = s.drawingMode === 'eraser' || isPalmErase || (s.lipControlActions && mouthStateRef.current === 'pursed');
          
          const baseColor = s.rainbowBrush ? getRainbowColor(performance.now()) : s.strokeColor;
          const color = isLeft ? getShiftedColor(baseColor) : baseColor;

          if (isErasing) {
            cursorCtx.save();
            cursorCtx.shadowBlur = 10;
            cursorCtx.shadowColor = 'rgba(255, 80, 80, 0.4)';
            cursorCtx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
            cursorCtx.lineWidth = 1.5;
            cursorCtx.beginPath();
            const radius = isPalmErase ? s.brushSize * 8 : s.brushSize * 1.5;
            cursorCtx.arc(lastPoint.x, lastPoint.y, radius, 0, Math.PI * 2);
            cursorCtx.stroke();
            
            // Draw visual core dot
            cursorCtx.fillStyle = 'rgba(255, 80, 80, 0.2)';
            cursorCtx.beginPath();
            cursorCtx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
            cursorCtx.fill();
            cursorCtx.restore();
          } else {
            drawCursor(cursorCtx, lastPoint, color, isHandDrawing);
          }
        }
      });

      // Fade trail effect
      const eitherDrawing = isLeftDrawing || isRightDrawing;
      if (s.fadeTrailEnabled && !eitherDrawing) {
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.fillStyle = 'rgba(0,0,0,0.005)';
        drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.restore();
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasSize]);

  /* ============================== CANVAS RESIZE ============================== */
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setCanvasSize({ width: w, height: h });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ============================== KEYBOARD SHORTCUTS ============================== */
  useKeyboardShortcuts({
    onClear: handleClear,
    onSave: handleSave,
    onSaveTransparent: handleSaveTransparent,
    onSetMode: (mode) => handleSettingsChange({ drawingMode: mode }),
    onUndo: handleUndo,
    onToggleFPS: () => handleSettingsChange({ showFPS: !settingsRef.current.showFPS }),
    onToggleRecording: handleToggleRecording,
    onToggleMLViz: () =>
      handleSettingsChange({ showMLVisualization: !settingsRef.current.showMLVisualization }),
    onToggleLandmarks: () =>
      handleSettingsChange({ showLandmarks: !settingsRef.current.showLandmarks }),
  });

  /* ============================== RENDER ============================== */
  const theme = settings.panelTheme || 'neumorphic-light';
  const isNeumorphic = theme === 'neumorphic-light' || theme === 'neumorphic-dark';
  
  let bgGradient = 'radial-gradient(ellipse at center, rgba(0,30,50,0.5) 0%, rgba(10,10,15,1) 70%)';
  if (theme === 'neumorphic-light') {
    bgGradient = 'radial-gradient(ellipse at center, rgba(230,235,245,0.3) 0%, rgba(10,10,15,1) 85%)';
  } else if (theme === 'neumorphic-dark') {
    bgGradient = 'radial-gradient(ellipse at center, rgba(30,30,42,0.65) 0%, rgba(10,10,15,1) 90%)';
  }

  return (
    <div className="relative w-screen h-screen bg-surface-900 overflow-hidden select-none">
      {/* Background gradient */}
      <div
        className="absolute inset-0 z-0 transition-all duration-500"
        style={{
          background: bgGradient,
        }}
      />

      {/* Camera Layer */}
      <CameraView ref={videoRef} visible={settings.showCamera && isTracking} />

      {/* Drawing Canvas */}
      <DrawingCanvas
        ref={drawCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
      />

      {/* Cursor / Particles Canvas */}
      <canvas
        ref={cursorCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 12 }}
      />

      {/* ML Visualization Canvas (Direct Rendering Bypass) */}
      <canvas
        ref={mlCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 11 }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="fixed bottom-4 right-4 z-50 text-right pointer-events-none"
      >
        <h1 className="font-display text-sm md:text-base font-bold tracking-wider text-neon-cyan neon-text">
          AIRSKETCH AI
        </h1>
        <p className="text-[9px] md:text-[10px] text-white/25 mt-0.5 font-sans">
          AI-powered air drawing with hand gesture control
        </p>
      </motion.div>

      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onAddTab={handleAddTab}
        onCloseTab={handleCloseTab}
        theme={theme}
      />

      {/* Controls Panel */}
      <ControlsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        isTracking={isTracking}
        isLoading={isLoading}
        isRecording={isRecording}
        onStartCamera={handleStartCamera}
        onStopCamera={handleStopCamera}
        onClear={handleClear}
        onSave={handleSave}
        onSaveTransparent={handleSaveTransparent}
        onUndo={handleUndo}
        onToggleRecording={handleToggleRecording}
        onSwitchCamera={switchCamera}
        activeMouthState={mouthState}
      />

      {/* Floating Action Bar */}
      <FloatingActionBar
        currentMode={settings.drawingMode}
        onSetMode={(mode) => handleSettingsChange({ drawingMode: mode })}
        onUndo={handleUndo}
        onClear={handleClear}
        isVisible={isTracking}
      />

      {/* Gesture Indicator */}
      {isTracking && (
        <GestureIndicator gesture={currentGesture} clearProgress={clearProgress} />
      )}

      {/* FPS Counter */}
      <FPSCounter fps={fps} visible={settings.showFPS} />

      {/* Recording indicator */}
      {isRecording && (
        <div className="fixed top-3 right-20 z-50 flex items-center gap-2 glass-panel px-3 py-1.5 border border-red-500/30">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 recording-indicator" />
          <span className="text-xs text-red-400 font-semibold font-mono">REC</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-3 max-w-md text-center border border-red-500/30 shadow-2xl"
        >
          <p className="text-sm text-red-400 mb-2 font-medium">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-white/40 hover:text-white/60 underline underline-offset-2"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Welcome state (no camera started) */}
      {!isTracking && !isLoading && !errorMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="text-6xl mb-6"
            >
              🎨
            </motion.div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white/80 mb-2">
              Ready to Sketch in the Air
            </h2>
            <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto font-sans">
              Point your index finger at the camera and draw — AI tracks your hand in real time
            </p>
            <button
              onClick={handleStartCamera}
              className={`text-base px-8 py-3 pointer-events-auto mx-auto ${
                isNeumorphic ? 'neumorphic-button active-gradient' : 'glass-button active'
              }`}
              style={{ boxShadow: '0 0 30px rgba(0,255,255,0.2)' }}
            >
              <span>📸</span>
              <span>Start Camera</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,20,30,0.85) 0%, rgba(0,0,0,0.75) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="loading-glow-border rounded-2xl"
          >
            <div
              className="text-center px-12 py-10 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(15,15,25,0.95), rgba(10,10,20,0.98))',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(0,255,255,0.05)',
              }}
            >
              {/* Animated dual-ring spinner */}
              <div className="flex justify-center mb-6">
                <div className="loading-ring" />
              </div>

              {/* Status text with smooth transition */}
              <motion.p
                key={loadingStatus}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-semibold text-neon-cyan font-sans mb-2"
              >
                {loadingStatus}
              </motion.p>

              {/* Animated dots */}
              <div className="loading-dots mt-3">
                <span />
                <span />
                <span />
              </div>

              <p className="text-[10px] text-white/25 mt-4 font-sans">
                Setting up hand, face & pose tracking
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Swipe Feature Toggle Overlay */}
      <AnimatePresence>
        {swipeFlash && (
          <motion.div
            initial={{ opacity: 0, x: swipeFlash === 'right' ? '-100%' : '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: swipeFlash === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none backdrop-blur-sm`}
            style={{
              background:
                swipeFlash === 'right'
                  ? 'radial-gradient(circle, rgba(0, 255, 102, 0.15) 0%, transparent 80%)'
                  : 'radial-gradient(circle, rgba(255, 50, 50, 0.15) 0%, transparent 80%)',
            }}
          >
            <div
              className={`px-8 py-5 rounded-2xl border text-xl font-display font-black tracking-widest ${
                swipeFlash === 'right'
                  ? 'border-green-500/30 text-green-400 bg-green-950/40 shadow-[0_0_50px_rgba(0,255,102,0.2)]'
                  : 'border-red-500/30 text-red-400 bg-red-950/40 shadow-[0_0_50px_rgba(255,50,50,0.2)]'
              }`}
            >
              {swipeFlash === 'right' ? '⚡ ML FEATURES ACTIVATED' : '🔒 ML FEATURES STANDBY'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab sweep transition indicator */}
      <AnimatePresence>
        {tabTransition && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.25), transparent)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
