import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawingMode } from '@/types';

interface FloatingActionBarProps {
  currentMode: DrawingMode;
  onSetMode: (mode: DrawingMode) => void;
  onUndo: () => void;
  onClear: () => void;
  isVisible: boolean;
}

const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  currentMode,
  onSetMode,
  onUndo,
  onClear,
  isVisible,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 50, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-2xl"
          style={{
            background: 'rgba(15, 15, 20, 0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Draw Mode */}
          <ActionButton
            active={currentMode === 'draw'}
            onClick={() => onSetMode('draw')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21.121l-7.243-7.243m0 0a2 2 0 10-2.828-2.828 2 2 0 002.828 2.828zm2.121-6.364a2 2 0 10-2.828-2.828 2 2 0 002.828 2.828zM3 21l3.5-3.5m-1.414-7.071L2.172 13.343a2 2 0 000 2.828l3.535 3.535a2 2 0 002.828 0l2.914-2.914" />
                <path d="M12 4l3 3M16 8l3 3" />
                <path d="M17 5l2-2" />
                <path d="M4.5 10.5l-2-2" />
              </svg>
            }
          />

          {/* Eraser Mode */}
          <ActionButton
            active={currentMode === 'eraser'}
            onClick={() => onSetMode('eraser')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16a2.828 2.828 0 010-4l8-8a2.828 2.828 0 014 0l4 4a2.828 2.828 0 010 4l-4 4" />
                <path d="M11 11l4-4" />
              </svg>
            }
          />

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Undo */}
          <ActionButton
            active={false}
            onClick={onUndo}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
              </svg>
            }
          />

          {/* Clear/Trash */}
          <ActionButton
            active={false}
            onClick={onClear}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ActionButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ active, onClick, icon }) => {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 ${
        active 
          ? 'text-[#00ffff] bg-white/[0.08]' 
          : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
      }`}
      style={active ? {
        boxShadow: 'inset 0 0 0 1px rgba(0,255,255,0.2), 0 0 15px rgba(0,255,255,0.1)'
      } : {}}
    >
      {icon}
    </button>
  );
};

export default FloatingActionBar;
