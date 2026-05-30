import React from 'react';
import './BuildPlanner.css';
import { useBuildState } from '../../hooks/useBuildState';
import StepIndicator from './StepIndicator';
import Step1Weapon from './steps/Step1Weapon';
import Step2Skill from './steps/Step2Skill';
import Step3WeaponMods from './steps/Step3WeaponMods';
import Step4Passives from './steps/Step4Passives';
import Step5Equipment from './steps/Step5Equipment';
import Step6Uniques from './steps/Step6Uniques';
import Step7Summary from './steps/Step7Summary';

const BuildPlanner: React.FC = () => {
  const {
    state,
    setStep,
    nextStep,
    prevStep,
    canProceed,
    isFirstStep,
    isLastStep,
    setWeapon,
    setSkill,
    setWeaponMods,
    setPassivePoints,
    setPassives,
    setAllEquipment,
    setUniques,
  } = useBuildState();

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <Step1Weapon
            selectedWeapon={state.weapon}
            onWeaponSelect={setWeapon}
          />
        );
      case 2:
        if (!state.weapon) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please select a weapon first</div>;
        }
        return (
          <Step2Skill
            weapon={state.weapon}
            selectedSkill={state.skill}
            onSkillSelect={setSkill}
          />
        );
      case 3:
        if (!state.weapon || !state.skill) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please select a weapon and skill first</div>;
        }
        return (
          <Step3WeaponMods
            weapon={state.weapon}
            skill={state.skill}
            selectedMods={state.weaponMods}
            onModsSelect={(mods) => setWeaponMods(mods.prefixes, mods.suffixes)}
          />
        );
      case 4:
        if (!state.weapon || !state.skill) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please complete previous steps first</div>;
        }
        return (
          <Step4Passives
            weapon={state.weapon}
            skill={state.skill}
            weaponMods={state.weaponMods}
            passivePoints={state.passivePoints}
            selectedPassives={state.passives as any}
            onPassivePointsChange={setPassivePoints}
            onPassivesSelect={setPassives as any}
          />
        );
      case 5:
        if (!state.weapon || !state.skill) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please complete previous steps first</div>;
        }
        return (
          <Step5Equipment
            weapon={state.weapon}
            skill={state.skill}
            equipment={state.equipment as any}
            onEquipmentChange={setAllEquipment as any}
          />
        );
      case 6:
        if (!state.weapon || !state.skill) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please complete previous steps first</div>;
        }
        return (
          <Step6Uniques
            weapon={state.weapon}
            skill={state.skill}
            weaponMods={state.weaponMods}
            passives={state.passives as any}
            equipment={state.equipment as any}
            selectedUniques={state.uniques as any}
            onUniquesSelect={setUniques as any}
          />
        );
      case 7:
        if (!state.weapon || !state.skill) {
          return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Please complete previous steps first</div>;
        }
        return (
          <Step7Summary
            weapon={state.weapon}
            skill={state.skill}
            weaponMods={state.weaponMods}
            passives={state.passives as any}
            equipment={state.equipment as any}
            uniques={state.uniques as any}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="build-planner">
      {/* Step Indicator */}
      <StepIndicator
        currentStep={state.step}
        onStepClick={(step) => setStep(step as 1 | 2 | 3 | 4 | 5 | 6 | 7)}
      />

      {/* Navigation Buttons - Top */}
      <div className="build-planner-nav">
        <button
          onClick={prevStep}
          disabled={isFirstStep}
          className="nav-button nav-button-secondary"
        >
          Previous
        </button>

        <div className="build-summary">
          {state.weapon && (
            <span className="summary-item">
              <span className="summary-label">Weapon:</span> {state.weapon.name}
            </span>
          )}
          {state.skill && (
            <span className="summary-item">
              <span className="summary-label">Skill:</span> {state.skill.name}
            </span>
          )}
          {state.weaponMods.prefixes.length + state.weaponMods.suffixes.length > 0 && (
            <span className="summary-item">
              <span className="summary-label">Mods:</span> {state.weaponMods.prefixes.length}P/{state.weaponMods.suffixes.length}S
            </span>
          )}
          {state.passives.length > 0 && (
            <span className="summary-item">
              <span className="summary-label">Passives:</span> {state.passives.length}
            </span>
          )}
        </div>

        <button
          onClick={nextStep}
          disabled={!canProceed || isLastStep}
          className="nav-button nav-button-primary"
        >
          {isLastStep ? 'Finish' : 'Next'}
        </button>
      </div>

      {/* Step Content */}
      <div className="build-planner-content">
        {renderStep()}
      </div>
    </div>
  );
};

export default BuildPlanner;
