
export type PersonType = "Personne Morale" | "Personne Physique";
export type CalculationBase = "Mensuel" | "Journalier";

export interface CCAPeriod {
  id: string;
  month: number;
  year: number;
  amount: number;
  pctPart1: number; // 0-100
  typePart1: PersonType;
  typePart2: PersonType;
}

export interface CalculationResult {
  id: string;
  periodLabel: string;
  dateDeblocage: string;
  amountTotal: number;
  
  // Part 1
  montantPart1: number;
  pctPart1: number;
  typePart1: PersonType;
  interestHT1: number;
  tva1: number;
  rasRate1: number;
  ras1: number;
  interestTTC1: number;
  net1: number;

  // Part 2
  montantPart2: number;
  pctPart2: number;
  typePart2: PersonType;
  interestHT2: number;
  tva2: number;
  rasRate2: number;
  ras2: number;
  interestTTC2: number;
  net2: number;

  durationValue: number; // In months or days based on calculationBase
  durationUnit: string;
}

export interface MonthlyAccrual {
  month: number;
  year: number;
  label: string;
  activeCapital: number;
  interestHT: number;
  tva: number;
  ras: number;
  net: number;
}

export interface CCAConfig {
  periods: CCAPeriod[];
  annualRate: number;
  tvaRate: number;
  rasMoraleRate: number; // 0-100
  rasPhysiqueRate: number; // 0-100
  endDate: string;
  splitMode: "Global" | "Variable";
  calculationBase: CalculationBase;
}

export interface FinancialSummary {
  totalCapital: number;
  totalInterestHT: number;
  totalInterestHT1: number;
  totalInterestHT2: number;
  totalInterestTTC: number;
  totalTVA: number;
  totalRAS: number;
  totalRAS1: number;
  totalRAS2: number;
  netTotal: number;
  totalRepayment: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  config: CCAConfig;
}
