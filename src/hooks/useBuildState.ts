/**
 * Build State Hook
 * Manages the state for the 6-step build planner wizard
 */

import { useState, useCallback, useMemo } from 'react';
import { WeaponBase } from '../data/weapons';
import { Skill } from '../data/skills';
import type { ItemMod } from '../data/mods';

export type { ItemMod };

export interface PassiveNode {
  id: string;
  name: string;
  type: 'small' | 'notable' | 'keystone';
  stats: Record<string, number>;
}

export interface GeneratedItem {
  slot: string;
  baseType: string;
  prefixes: ItemMod[];
  suffixes: ItemMod[];
}

export interface UniqueItem {
  name: string;
  baseType: string;
  slot: string;
  mods: string[];
  synergyScore?: number;
}

export interface BuildState {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  weapon: WeaponBase | null;
  skill: Skill | null;
  weaponMods: {
    prefixes: ItemMod[];
    suffixes: ItemMod[];
  };
  passivePoints: number;
  passives: PassiveNode[];
  equipment: Record<string, GeneratedItem>;
  uniques: UniqueItem[];
}

const initialState: BuildState = {
  step: 1,
  weapon: null,
  skill: null,
  weaponMods: {
    prefixes: [],
    suffixes: [],
  },
  passivePoints: 100,
  passives: [],
  equipment: {},
  uniques: [],
};

export function useBuildState() {
  const [state, setState] = useState<BuildState>(initialState);

  // Step navigation
  const setStep = useCallback((step: BuildState['step']) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: Math.min(7, prev.step + 1) as BuildState['step'],
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as BuildState['step'],
    }));
  }, []);

  // Step 1: Weapon selection
  const setWeapon = useCallback((weapon: WeaponBase | null) => {
    setState(prev => ({
      ...prev,
      weapon,
      // Clear downstream selections when weapon changes
      skill: null,
      weaponMods: { prefixes: [], suffixes: [] },
    }));
  }, []);

  // Step 2: Skill selection
  const setSkill = useCallback((skill: Skill | null) => {
    setState(prev => ({
      ...prev,
      skill,
      // Clear mods when skill changes (optimization depends on skill)
      weaponMods: { prefixes: [], suffixes: [] },
    }));
  }, []);

  // Step 3: Weapon mods
  const setWeaponMods = useCallback((prefixes: ItemMod[], suffixes: ItemMod[]) => {
    setState(prev => ({
      ...prev,
      weaponMods: { prefixes, suffixes },
    }));
  }, []);

  // Step 4: Passives
  const setPassivePoints = useCallback((points: number) => {
    setState(prev => ({
      ...prev,
      passivePoints: Math.max(0, Math.min(122, points)),
    }));
  }, []);

  const setPassives = useCallback((passives: PassiveNode[]) => {
    setState(prev => ({
      ...prev,
      passives,
    }));
  }, []);

  // Step 5: Equipment
  const setEquipmentSlot = useCallback((slot: string, item: GeneratedItem) => {
    setState(prev => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        [slot]: item,
      },
    }));
  }, []);

  const setAllEquipment = useCallback((equipment: Record<string, GeneratedItem>) => {
    setState(prev => ({
      ...prev,
      equipment,
    }));
  }, []);

  // Step 6: Uniques
  const setUniques = useCallback((uniques: UniqueItem[]) => {
    setState(prev => ({
      ...prev,
      uniques,
    }));
  }, []);

  const toggleUnique = useCallback((unique: UniqueItem) => {
    setState(prev => {
      const exists = prev.uniques.some(u => u.name === unique.name);
      return {
        ...prev,
        uniques: exists
          ? prev.uniques.filter(u => u.name !== unique.name)
          : [...prev.uniques, unique],
      };
    });
  }, []);

  // Reset build
  const resetBuild = useCallback(() => {
    setState(initialState);
  }, []);

  // Computed values
  const canProceed = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.weapon !== null;
      case 2:
        return state.skill !== null;
      case 3:
        return state.weaponMods.prefixes.length > 0 || state.weaponMods.suffixes.length > 0;
      case 4:
        return state.passives.length > 0;
      case 5:
        return Object.keys(state.equipment).length > 0;
      case 6:
        return true; // Uniques are optional
      case 7:
        return true; // Summary is final
      default:
        return false;
    }
  }, [state]);

  const isFirstStep = state.step === 1;
  const isLastStep = state.step === 7;

  return {
    state,
    // Navigation
    setStep,
    nextStep,
    prevStep,
    canProceed,
    isFirstStep,
    isLastStep,
    // Step 1
    setWeapon,
    // Step 2
    setSkill,
    // Step 3
    setWeaponMods,
    // Step 4
    setPassivePoints,
    setPassives,
    // Step 5
    setEquipmentSlot,
    setAllEquipment,
    // Step 6
    setUniques,
    toggleUnique,
    // Reset
    resetBuild,
  };
}

export type BuildStateHook = ReturnType<typeof useBuildState>;
