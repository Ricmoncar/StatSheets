// Loose types for the trait tables in traits-data.ts. The data is hand-written
// and varied (duality traits carry heavenly/hellforged halves, cultivation
// traits carry stack rules, and so on), so every shape stays open.

export type PassiveOp = 'add' | 'sub' | 'pct' | 'mul' | 'div' | 'derived' | string;

export interface Passive {
  stat: string;
  op: PassiveOp;
  value?: number;
  /** derived: the stat this one scales from */
  from?: string;
  per?: number;
  perValue?: number;
  perPct?: number;
  cap?: number;
  [k: string]: unknown;
}

export interface Situational {
  id: string;
  label: string;
  desc?: string;
  passive?: Passive[];
  [k: string]: unknown;
}

export interface TraitDef {
  name: string;
  rarity?: string;
  desc?: string;
  passive?: Passive[];
  situational?: Situational[];
  cultivation?: { perStack?: Passive | Passive[]; defaultStacks?: number; [k: string]: unknown };
  notes?: string;
  [k: string]: any;
}

export type TraitTable = Record<string, TraitDef>;
