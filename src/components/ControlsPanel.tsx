import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSettings, DrawingMode } from '@/types';
import ColorPicker from './ColorPicker';
import ModeSelector from './ModeSelector';
import VideoRecorder from './VideoRecorder';

type PanelTheme = 'neumorphic-light' | 'neumorphic-dark' | 'glassmorphism-dark';

interface ControlsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  isTracking: boolean;
  isLoading: boolean;
  isRecording: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onClear: () => void;
  onSave: () => void;
  onSaveTransparent: () => void;
  onUndo: () => void;
  onToggleRecording: () => void;
  onSwitchCamera?: () => void;
  activeMouthState?: 'neutral' | 'open' | 'smile' | 'pursed';
}

const SECTIONS = [
  'camera',
  'theme',
  'display',
  'lips',
  'mode',
  'color',
  'brush',
  'actions',
  'record',
  'shortcuts',
] as const;
type Section = typeof SECTIONS[number];

const ControlsPanel: React.FC<ControlsPanelProps> = ({
  settings,
  onSettingsChange,
  isTracking,
  isLoading,
  isRecording,
  onStartCamera,
  onStopCamera,
  onClear,
  onSave,
  onSaveTransparent,
  onUndo,
  onToggleRecording,
  onSwitchCamera,
  activeMouthState = 'neutral',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<Section>>(
    new Set(['shortcuts', 'record'])
  );

  // Responsive device split detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSection = (s: Section) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const isSectionOpen = (s: Section) => !collapsedSections.has(s);

  const theme = settings.panelTheme || 'neumorphic-light';
  const isNeumorphic = theme === 'neumorphic-light' || theme === 'neumorphic-dark';
  
  // Dynamic panel styles
  let panelClass = 'glass-panel text-white/80';
  let wellClass = 'bg-black/25 border border-white/5';
  let textHighlight = 'text-neon-cyan neon-text';
  let textPrimary = 'text-white/80';

  if (theme === 'neumorphic-light') {
    panelClass = 'neumorphic-panel border-white/60 text-[#2a3b50]';
    wellClass = 'neumorphic-well bg-[#edf1f5]';
    textHighlight = 'text-[#0088FF] font-bold';
    textPrimary = 'text-[#2a3b50]';
  } else if (theme === 'neumorphic-dark') {
    panelClass = 'neumorphic-panel-dark border-white/[0.03] text-white/90';
    wellClass = 'neumorphic-well-dark bg-[#0f0f13]';
    textHighlight = 'text-[#00ffff] font-bold';
    textPrimary = 'text-white/90';
  }

  const btnClass = getThemeBtnClass(theme);

  const panelContent = (
    <div
      className="overflow-y-auto overflow-x-hidden transition-all duration-300"
      style={{ maxHeight: 'calc(100vh - 80px)' }}
    >
      {/* Performance Warning Card on Mobile */}
      {isMobile && settings.bodyTracking && isTracking && (
        <div className="mx-4 mt-2 mb-1 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] flex gap-2 items-start">
          <span className="text-xs">⚠️</span>
          <span>Performance Warning: Body Pose mesh runs heavy on mobile CPUs. Disable if drawing feels laggy.</span>
        </div>
      )}

      {/* ─── Theme Selector ─── */}
      <PanelSection
        title="UI Theme"
        icon="🎨"
        section="theme"
        isOpen={isSectionOpen('theme')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="grid grid-cols-3 gap-1 px-1">
          <button
            onClick={() => onSettingsChange({ panelTheme: 'neumorphic-light' })}
            className={`${btnClass} text-[9px] py-1.5 px-0.5 justify-center flex-col ${
              theme === 'neumorphic-light' ? 'active' : ''
            }`}
          >
            ☀️ Soft Light
          </button>
          <button
            onClick={() => onSettingsChange({ panelTheme: 'neumorphic-dark' })}
            className={`${btnClass} text-[9px] py-1.5 px-0.5 justify-center flex-col ${
              theme === 'neumorphic-dark' ? 'active' : ''
            }`}
          >
            🌑 Soft Dark
          </button>
          <button
            onClick={() => onSettingsChange({ panelTheme: 'glassmorphism-dark' })}
            className={`${btnClass} text-[9px] py-1.5 px-0.5 justify-center flex-col ${
              theme === 'glassmorphism-dark' ? 'active' : ''
            }`}
          >
            🌙 Glass Dark
          </button>
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Camera Controls ─── */}
      <PanelSection
        title="Camera Input"
        icon="📸"
        section="camera"
        isOpen={isSectionOpen('camera')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="flex flex-col gap-2">
          {!isTracking ? (
            <button
              onClick={onStartCamera}
              disabled={isLoading}
              className={`${btnClass} ${
                theme === 'neumorphic-light' ? 'active-gradient' : 'active'
              } w-full justify-center`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin inline-block">⟳</span>
                  <span>Loading AI Models...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>Start Camera</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onStopCamera}
                className={`${btnClass} danger w-full justify-center`}
              >
                <span>⏹</span>
                <span>Stop Camera</span>
              </button>
              {/* Show flip camera switcher */}
              {onSwitchCamera && (
                <button
                  onClick={onSwitchCamera}
                  title="Switch Front/Rear Camera"
                  className={`${btnClass} px-3 justify-center text-xs`}
                >
                  🔄
                </button>
              )}
            </div>
          )}
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Lip & Face Controls ─── */}
      <PanelSection
        title="Lip Reading HUD"
        icon="👄"
        section="lips"
        isOpen={isSectionOpen('lips')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="space-y-2">
          <ToggleRow
            label="Lip & Face Tracking"
            icon="🤖"
            active={settings.lipTracking}
            onClick={() => onSettingsChange({ lipTracking: !settings.lipTracking })}
            theme={theme}
          />
          <ToggleRow
            label="Mouth Shape Actions"
            icon="💬"
            active={settings.lipControlActions}
            onClick={() =>
              onSettingsChange({ lipControlActions: !settings.lipControlActions })
            }
            theme={theme}
            disabled={!settings.lipTracking}
          />
          <ToggleRow
            label="Rainbow Color Brush"
            icon="🌈"
            active={settings.rainbowBrush}
            onClick={() => onSettingsChange({ rainbowBrush: !settings.rainbowBrush })}
            theme={theme}
          />

          {settings.lipTracking && isTracking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-2 rounded-xl text-center font-display text-[9px] uppercase font-bold tracking-widest ${wellClass}`}
            >
              Mouth State:{' '}
              <span className={textHighlight}>
                {activeMouthState === 'smile' && '😊 Smiling'}
                {activeMouthState === 'open' && '😮 Open (Glow Boost)'}
                {activeMouthState === 'pursed' && '😗 Pursed (Erase)'}
                {activeMouthState === 'neutral' && '😐 Neutral'}
              </span>
            </motion.div>
          )}
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Display Toggles ─── */}
      <PanelSection
        title="Skeletons & Display"
        icon="🖥️"
        section="display"
        isOpen={isSectionOpen('display')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="space-y-1">
          <ToggleRow
            label="Camera Preview"
            icon="🎥"
            active={settings.showCamera}
            onClick={() => onSettingsChange({ showCamera: !settings.showCamera })}
            theme={theme}
          />
          <ToggleRow
            label="Hand Landmarks"
            icon="🦴"
            shortcut={isMobile ? undefined : "L"}
            active={settings.showLandmarks}
            onClick={() => onSettingsChange({ showLandmarks: !settings.showLandmarks })}
            theme={theme}
          />
          <ToggleRow
            label="ML Visualization"
            icon="👾"
            shortcut={isMobile ? undefined : "M"}
            active={settings.showMLVisualization}
            onClick={() =>
              onSettingsChange({ showMLVisualization: !settings.showMLVisualization })
            }
            theme={theme}
          />
          <ToggleRow
            label="Dual-Hand Draw"
            icon="🙌"
            active={settings.dualHandDrawing}
            onClick={() => onSettingsChange({ dualHandDrawing: !settings.dualHandDrawing })}
            theme={theme}
          />
          <ToggleRow
            label="Body Pose Tracking"
            icon="🧍"
            active={settings.bodyTracking}
            onClick={() => onSettingsChange({ bodyTracking: !settings.bodyTracking })}
            theme={theme}
          />
          <ToggleRow
            label="Particle Sparks"
            icon="✨"
            active={settings.particlesEnabled}
            onClick={() =>
              onSettingsChange({ particlesEnabled: !settings.particlesEnabled })
            }
            theme={theme}
          />
          <ToggleRow
            label="Fade Trail Effect"
            icon="💫"
            active={settings.fadeTrailEnabled}
            onClick={() =>
              onSettingsChange({ fadeTrailEnabled: !settings.fadeTrailEnabled })
            }
            theme={theme}
          />
          <ToggleRow
            label="FPS Counter"
            icon="📊"
            shortcut={isMobile ? undefined : "F"}
            active={settings.showFPS}
            onClick={() => onSettingsChange({ showFPS: !settings.showFPS })}
            theme={theme}
          />
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Drawing Mode ─── */}
      <PanelSection
        title="Drawing Mode"
        icon="✏️"
        section="mode"
        isOpen={isSectionOpen('mode')}
        onToggle={toggleSection}
        theme={theme}
      >
        <ModeSelector
          mode={settings.drawingMode}
          onModeChange={(mode: DrawingMode) => onSettingsChange({ drawingMode: mode })}
          isNeumorphic={isNeumorphic}
          theme={theme}
        />
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Colors ─── */}
      <PanelSection
        title="Stroke Color"
        icon="🎨"
        section="color"
        isOpen={isSectionOpen('color')}
        onToggle={toggleSection}
        theme={theme}
      >
        <ColorPicker
          selectedColor={settings.strokeColor}
          onColorChange={(color: string) => onSettingsChange({ strokeColor: color })}
          isNeumorphic={isNeumorphic}
          theme={theme}
        />
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Brush Settings ─── */}
      <PanelSection
        title="Brush & Trails"
        icon="🖌️"
        section="brush"
        isOpen={isSectionOpen('brush')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="space-y-4">
          {/* Brush Preview Area */}
          <div className="w-full h-12 flex items-center justify-center my-2 pointer-events-none">
            <svg width="80%" height="40" viewBox="0 0 200 40" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
              <path 
                d="M10,20 Q50,-10 100,20 T190,20" 
                fill="none" 
                stroke={settings.rainbowBrush ? '#00ffff' : settings.strokeColor} 
                strokeWidth={settings.brushSize} 
                strokeLinecap="round" 
              />
            </svg>
          </div>
          
          <SliderControl
            label="Brush Size"
            value={settings.brushSize}
            min={1}
            max={20}
            unit="px"
            onChange={(v) => onSettingsChange({ brushSize: v })}
            theme={theme}
          />
          <SliderControl
            label="Glow Intensity"
            value={settings.glowIntensity}
            min={5}
            max={60}
            unit=""
            onChange={(v) => onSettingsChange({ glowIntensity: v })}
            theme={theme}
          />
          <SliderControl
            label="Smoothing"
            value={settings.smoothing}
            min={1}
            max={15}
            unit=""
            onChange={(v) => onSettingsChange({ smoothing: v })}
            theme={theme}
          />
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Actions ─── */}
      <PanelSection
        title="File Actions"
        icon="⚡"
        section="actions"
        isOpen={isSectionOpen('actions')}
        onToggle={toggleSection}
        theme={theme}
      >
        <div className="space-y-2">
          <div className="flex gap-2">
            <ActionButton
              icon="↩"
              label="Undo"
              onClick={onUndo}
              theme={theme}
            />
            <ActionButton
              icon="🗑️"
              label="Clear"
              onClick={onClear}
              variant="danger"
              theme={theme}
            />
          </div>
          <div className="flex gap-2">
            <ActionButton
              icon="💾"
              label="Save PNG"
              onClick={onSave}
              theme={theme}
            />
            <ActionButton
              icon="🖼️"
              label="Transparent"
              onClick={onSaveTransparent}
              theme={theme}
            />
          </div>
        </div>
      </PanelSection>

      <Divider theme={theme} />

      {/* ─── Recording ─── */}
      <PanelSection
        title="Record Canvas"
        icon="⏺"
        section="record"
        isOpen={isSectionOpen('record')}
        onToggle={toggleSection}
        theme={theme}
      >
        <VideoRecorder
          isRecording={isRecording}
          onToggle={onToggleRecording}
          isNeumorphic={isNeumorphic}
          theme={theme}
        />
      </PanelSection>

      {/* ─── Shortcuts (Desktop only) ─── */}
      {!isMobile && (
        <>
          <Divider theme={theme} />
          <PanelSection
            title="Keyboard Shortcuts"
            icon="⌨️"
            section="shortcuts"
            isOpen={isSectionOpen('shortcuts')}
            onToggle={toggleSection}
            theme={theme}
          >
            <div className="space-y-1">
              <ShortcutRow keys="D" action="Draw mode" theme={theme} />
              <ShortcutRow keys="E" action="Eraser mode" theme={theme} />
              <ShortcutRow keys="P" action="Pointer mode" theme={theme} />
              <ShortcutRow keys="C" action="Clear canvas" theme={theme} />
              <ShortcutRow keys="S" action="Save drawing" theme={theme} />
              <ShortcutRow keys="Ctrl+Z" action="Undo stroke" theme={theme} />
              <ShortcutRow keys="F" action="Toggle FPS" theme={theme} />
              <ShortcutRow keys="R" action="Record video" theme={theme} />
              <ShortcutRow keys="M" action="ML visualization" theme={theme} />
              <ShortcutRow keys="L" action="Landmarks" theme={theme} />
            </div>
          </PanelSection>
        </>
      )}

      <div className="h-3" />
    </div>
  );

  return (
    <>
      {/* Desktop panel */}
      <div className="hidden md:block fixed top-3 left-3 z-50" style={{ width: '320px' }}>
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`${panelClass} overflow-hidden border transition-all duration-300`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04] cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">⚙️</span>
              <span
                className={`text-[11px] font-display font-black tracking-wider ${
                  theme === 'glassmorphism-dark' ? 'text-neon-cyan neon-text' : 'text-current'
                }`}
              >
                CONTROL CENTER
              </span>
            </div>
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-[10px] opacity-40"
            >
              ▼
            </motion.span>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {panelContent}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Mobile toggle button */}
      <button
        className={`md:hidden fixed bottom-4 right-4 z-50 ${panelClass} w-12 h-12 flex items-center justify-center text-lg shadow-lg border`}
        style={{ borderRadius: '50%' }}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? '✕' : '⚙️'}
      </button>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`md:hidden fixed bottom-0 left-0 right-0 z-50 ${panelClass} rounded-t-3xl border-t overflow-hidden`}
              style={{ maxHeight: '80vh' }}
            >
              <div className="flex justify-center pt-2 pb-1">
                <div
                  className={`w-10 h-1 rounded-full ${
                    theme === 'neumorphic-light' ? 'bg-black/10' : 'bg-white/20'
                  }`}
                />
              </div>
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/* ═══════════════════ Helpers for dynamic styles ═══════════════════ */

function getThemeBtnClass(theme: PanelTheme): string {
  if (theme === 'neumorphic-light') return 'neumorphic-button';
  if (theme === 'neumorphic-dark') return 'neumorphic-button-dark';
  return 'glass-button';
}

function getThemeSliderClass(theme: PanelTheme): string {
  if (theme === 'neumorphic-light') return 'neumorphic-slider';
  if (theme === 'neumorphic-dark') return 'neumorphic-slider-dark';
  return 'slider-neon';
}

function getThemeKbdClass(theme: PanelTheme): string {
  if (theme === 'neumorphic-light') return 'neumorphic-kbd';
  if (theme === 'neumorphic-dark') return 'neumorphic-kbd-dark';
  return 'border-white/[0.06] bg-white/[0.04] text-neon-cyan/60';
}

/* ═══════════════════ Sub-components ═══════════════════ */

function PanelSection({
  title,
  icon,
  section,
  isOpen,
  onToggle,
  theme,
  children,
}: {
  title: string;
  icon: string;
  section: Section;
  isOpen: boolean;
  onToggle: (s: Section) => void;
  theme: PanelTheme;
  children: React.ReactNode;
}) {
  const isLight = theme === 'neumorphic-light';
  
  return (
    <div className="px-4">
      <button
        onClick={() => onToggle(section)}
        className="flex items-center justify-between w-full py-2 select-none group"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{icon}</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isLight
                ? 'text-[#5e6e80] group-hover:text-[#2a3b50]'
                : 'text-white/60 group-hover:text-white/80'
            }`}
          >
            {title}
          </span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[9px] opacity-40"
        >
          ▶
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pb-2 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Divider({ theme }: { theme: PanelTheme }) {
  const borderClass = theme === 'neumorphic-light' ? 'border-black/[0.05]' : 'border-white/[0.04]';
  return <div className={`mx-4 border-t ${borderClass}`} />;
}

function ToggleRow({
  label,
  icon,
  shortcut,
  active,
  onClick,
  theme,
  disabled = false,
}: {
  label: string;
  icon: string;
  shortcut?: string;
  active: boolean;
  onClick: () => void;
  theme: PanelTheme;
  disabled?: boolean;
}) {
  const isLight = theme === 'neumorphic-light';
  const isDarkNeumorphic = theme === 'neumorphic-dark';
  const labelColor = isLight ? 'text-[#4a5a70]' : 'text-white/70';
  const disabledOpacity = disabled ? 'opacity-40 pointer-events-none' : '';

  // Handle Neumorphic Toggles
  let trackStyle = {};
  let thumbStyle = {};

  if (isLight) {
    trackStyle = {
      background: active ? 'linear-gradient(135deg, #a8f0eb, #8ee1ec)' : '#f0f3f6',
      boxShadow: active ? 'inset 1px 1px 3px rgba(0,0,0,0.05)' : 'inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #ffffff',
      border: active ? '1px solid rgba(0, 136, 255, 0.15)' : '1px solid rgba(0,0,0,0.03)',
    };
    thumbStyle = {
      background: active ? '#0088FF' : '#ffffff',
      boxShadow: active ? '0 2px 4px rgba(0,136,255,0.3)' : '1px 1px 3px #c8d0e7',
    };
  } else if (isDarkNeumorphic) {
    trackStyle = {
      background: active ? 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,136,255,0.1))' : '#0f0f13',
      boxShadow: active ? 'inset 1px 1px 3px rgba(0,0,0,0.1)' : 'inset 2px 2px 4px #050507, inset -2px -2px 4px rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.01)',
    };
    thumbStyle = {
      background: active ? '#00ffff' : 'rgba(255,255,255,0.3)',
      boxShadow: active ? '0 2px 4px rgba(0,255,255,0.3)' : '1px 1px 3px #050507',
    };
  } else {
    trackStyle = {
      background: active ? 'rgba(0,255,255,0.25)' : 'rgba(255,255,255,0.08)',
      border: active ? '1px solid rgba(0,255,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
    };
    thumbStyle = {
      background: active ? '#00FFFF' : 'rgba(255,255,255,0.3)',
      boxShadow: active ? '0 0 6px rgba(0,255,255,0.5)' : 'none',
    };
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl transition-all duration-150 group ${disabledOpacity} ${
        isLight ? 'hover:bg-black/[0.02]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs flex-shrink-0">{icon}</span>
        <span className={`text-[11px] truncate transition-colors font-medium ${labelColor}`}>
          {label}
        </span>
        {shortcut && (
          <span className={`text-[9px] flex-shrink-0 font-mono opacity-40 ml-1`}>{shortcut}</span>
        )}
      </div>

      {/* Toggle Pill */}
      <div
        className="w-9 h-[20px] rounded-full flex-shrink-0 flex items-center transition-all duration-200 px-0.5"
        style={trackStyle}
      >
        <motion.div
          animate={{ x: active ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-4 h-4 rounded-full"
          style={thumbStyle}
        />
      </div>
    </button>
  );
}

function ActionButton({
  icon,
  label,
  shortcut,
  onClick,
  variant,
  theme,
}: {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: 'danger';
  theme: PanelTheme;
}) {
  const btnClass = getThemeBtnClass(theme);

  return (
    <button
      onClick={onClick}
      className={`${btnClass} flex-1 justify-center text-xs py-2 ${
        variant === 'danger' ? 'danger' : ''
      }`}
    >
      <span className="text-xs">{icon}</span>
      <span className="truncate">{label}</span>
      {shortcut && (
        <span className="text-[9px] flex-shrink-0 ml-0.5 font-mono opacity-40">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
  theme: PanelTheme;
}) {
  const isLight = theme === 'neumorphic-light';
  const labelColor = isLight ? 'text-[#5e6e80]' : 'text-white/50';
  const valColor = theme === 'neumorphic-light' ? 'text-[#0088FF]' : theme === 'neumorphic-dark' ? 'text-[#00ffff]' : 'text-neon-cyan';
  const sliderClass = getThemeSliderClass(theme);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] ${labelColor}`}>{label}</span>
        <span className={`text-[11px] font-mono tabular-nums ${valColor}`}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${sliderClass} w-full block`}
      />
    </div>
  );
}

function ShortcutRow({
  keys,
  action,
  theme,
}: {
  keys: string;
  action: string;
  theme: PanelTheme;
}) {
  const isLight = theme === 'neumorphic-light';
  const labelColor = isLight ? 'text-[#5e6e80]' : 'text-white/35';
  const kbdClass = getThemeKbdClass(theme);

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[10px] ${labelColor}`}>{action}</span>
      <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${kbdClass}`}>
        {keys}
      </kbd>
    </div>
  );
}

export default ControlsPanel;
