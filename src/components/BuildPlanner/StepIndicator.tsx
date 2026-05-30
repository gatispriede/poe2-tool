import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const STEPS = [
  { number: 1, label: 'Weapon', icon: '⚔️' },
  { number: 2, label: 'Skill', icon: '💎' },
  { number: 3, label: 'Weapon Mods', icon: '🔧' },
  { number: 4, label: 'Passives', icon: '🌳' },
  { number: 5, label: 'Equipment', icon: '🛡️' },
  { number: 6, label: 'Uniques', icon: '⭐' },
  { number: 7, label: 'Summary', icon: '📊' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      padding: '16px 0',
      background: '#1a1a1a',
      borderBottom: '1px solid #333',
      flexWrap: 'wrap',
    }}>
      {STEPS.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const isClickable = step.number <= currentStep;

        return (
          <React.Fragment key={step.number}>
            {index > 0 && (
              <div style={{
                width: 24,
                height: 2,
                background: isCompleted ? '#c58602' : '#444',
                margin: '0 4px',
              }} />
            )}
            <button
              onClick={() => isClickable && onStepClick?.(step.number)}
              disabled={!isClickable}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 12px',
                background: isActive ? '#2a2a2a' : 'transparent',
                border: isActive ? '1px solid #c58602' : '1px solid transparent',
                borderRadius: 8,
                cursor: isClickable ? 'pointer' : 'default',
                opacity: isClickable ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isCompleted ? '#c58602' : isActive ? '#333' : '#222',
                border: isActive ? '2px solid #c58602' : '2px solid #444',
                color: isCompleted ? '#fff' : isActive ? '#c58602' : '#888',
                fontSize: '1rem',
              }}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span style={{
                fontSize: '0.7rem',
                color: isActive ? '#c58602' : isCompleted ? '#888' : '#666',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepIndicator;
