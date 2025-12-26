
import { CCAConfig, CCAPeriod, CalculationResult, FinancialSummary, MonthlyAccrual } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatMAD = (num: number): string => {
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202f|\u00a0/g, ' '); // Remplace les espaces insécables par des espaces standards
};

export const calculateCCAResults = (config: CCAConfig): CalculationResult[] => {
  const { 
    periods, annualRate, tvaRate, 
    rasMoraleRate, rasPhysiqueRate, endDate, calculationBase
  } = config;

  const end = new Date(endDate);

  return periods.map((p) => {
    const injectionDate = new Date(p.year, p.month - 1, 1);
    
    let durationValue = 0;
    
    if (calculationBase === "Mensuel") {
      const startYear = injectionDate.getFullYear();
      const startMonth = injectionDate.getMonth();
      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      
      durationValue = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      if (end < injectionDate) durationValue = 0;
    } else {
      let durationInMs = end.getTime() - injectionDate.getTime();
      if (durationInMs < 0) durationInMs = 0;
      durationValue = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
    }

    const amountTotal = p.amount;
    const pct1 = p.pctPart1 / 100;
    const pct2 = 1 - pct1;

    const montantPart1 = amountTotal * pct1;
    const montantPart2 = amountTotal * pct2;

    let interestHT1 = 0;
    let interestHT2 = 0;

    const tRate = annualRate / 100;

    if (calculationBase === "Mensuel") {
      interestHT1 = (montantPart1 * tRate * durationValue) / 12;
      interestHT2 = (montantPart2 * tRate * durationValue) / 12;
    } else {
      interestHT1 = (montantPart1 * tRate * durationValue) / 360;
      interestHT2 = (montantPart2 * tRate * durationValue) / 360;
    }

    const tva1 = interestHT1 * (tvaRate / 100);
    const tva2 = interestHT2 * (tvaRate / 100);

    const interestTTC1 = interestHT1 + tva1;
    const interestTTC2 = interestHT2 + tva2;

    const getRasRate = (type: string) => type === "Personne Morale" ? rasMoraleRate / 100 : rasPhysiqueRate / 100;
    const rasRate1 = getRasRate(p.typePart1);
    const rasRate2 = getRasRate(p.typePart2);

    const ras1 = interestHT1 * rasRate1;
    const ras2 = interestHT2 * rasRate2;

    const net1 = interestTTC1 - ras1;
    const net2 = interestTTC2 - ras2;

    return {
      id: p.id,
      periodLabel: `${p.month}/${p.year}`,
      dateDeblocage: injectionDate.toISOString().split('T')[0],
      amountTotal,
      durationValue: durationValue,
      durationUnit: calculationBase === "Mensuel" ? "Mois" : "Jours",
      montantPart1,
      pctPart1: p.pctPart1,
      typePart1: p.typePart1,
      interestHT1,
      tva1,
      rasRate1: rasRate1 * 100,
      ras1,
      interestTTC1,
      net1,
      montantPart2,
      pctPart2: (100 - p.pctPart1),
      typePart2: p.typePart2,
      interestHT2,
      tva2,
      rasRate2: rasRate2 * 100,
      ras2,
      interestTTC2,
      net2
    };
  });
};

export const calculateMonthlyAccruals = (config: CCAConfig): MonthlyAccrual[] => {
  const { periods, annualRate, tvaRate, rasMoraleRate, rasPhysiqueRate, endDate, calculationBase } = config;
  const endLimit = new Date(endDate);
  
  if (periods.length === 0) return [];

  // Find min date
  let minDate = new Date(periods[0].year, periods[0].month - 1, 1);
  periods.forEach(p => {
    const d = new Date(p.year, p.month - 1, 1);
    if (d < minDate) minDate = d;
  });

  const accruals: MonthlyAccrual[] = [];
  const curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  while (curr <= endLimit) {
    const month = curr.getMonth() + 1;
    const year = curr.getFullYear();
    const tRate = annualRate / 100;
    
    let activeCapital = 0;
    let monthInterestHT = 0;
    let monthRAS = 0;

    periods.forEach(p => {
      const injectionDate = new Date(p.year, p.month - 1, 1);
      if (injectionDate <= curr) {
        activeCapital += p.amount;
        
        // Interest for this specific month for this injection
        const p1 = p.amount * (p.pctPart1 / 100);
        const p2 = p.amount * (1 - p.pctPart1 / 100);
        
        let i1 = 0;
        let i2 = 0;

        if (calculationBase === "Mensuel") {
          i1 = (p1 * tRate) / 12;
          i2 = (p2 * tRate) / 12;
        } else {
          // Journalier: interest for the number of days in this month
          const lastDayOfMonth = new Date(year, month, 0).getDate();
          i1 = (p1 * tRate * lastDayOfMonth) / 360;
          i2 = (p2 * tRate * lastDayOfMonth) / 360;
        }

        const r1 = i1 * (p.typePart1 === "Personne Morale" ? rasMoraleRate / 100 : rasPhysiqueRate / 100);
        const r2 = i2 * (p.typePart2 === "Personne Morale" ? rasMoraleRate / 100 : rasPhysiqueRate / 100);

        monthInterestHT += (i1 + i2);
        monthRAS += (r1 + r2);
      }
    });

    const monthTVA = monthInterestHT * (tvaRate / 100);
    const monthNet = (monthInterestHT + monthTVA) - monthRAS;

    accruals.push({
      month,
      year,
      label: `${month}/${year}`,
      activeCapital,
      interestHT: monthInterestHT,
      tva: monthTVA,
      ras: monthRAS,
      net: monthNet
    });

    curr.setMonth(curr.getMonth() + 1);
  }

  return accruals;
};

export const summarizeResults = (results: CalculationResult[]): FinancialSummary => {
  return results.reduce((acc, curr) => ({
    totalCapital: acc.totalCapital + curr.amountTotal,
    totalInterestHT: acc.totalInterestHT + curr.interestHT1 + curr.interestHT2,
    totalInterestHT1: acc.totalInterestHT1 + curr.interestHT1,
    totalInterestHT2: acc.totalInterestHT2 + curr.interestHT2,
    totalInterestTTC: acc.totalInterestTTC + curr.interestTTC1 + curr.interestTTC2,
    totalTVA: acc.totalTVA + curr.tva1 + curr.tva2,
    totalRAS: acc.totalRAS + curr.ras1 + curr.ras2,
    totalRAS1: acc.totalRAS1 + curr.ras1,
    totalRAS2: acc.totalRAS2 + curr.ras2,
    netTotal: acc.netTotal + curr.net1 + curr.net2,
    totalRepayment: acc.totalRepayment + curr.amountTotal + curr.interestTTC1 + curr.interestTTC2
  }), {
    totalCapital: 0,
    totalInterestHT: 0,
    totalInterestHT1: 0,
    totalInterestHT2: 0,
    totalInterestTTC: 0,
    totalTVA: 0,
    totalRAS: 0,
    totalRAS1: 0,
    totalRAS2: 0,
    netTotal: 0,
    totalRepayment: 0
  });
};

export const exportToExcel = (results: CalculationResult[], summary: FinancialSummary, config: CCAConfig) => {
  const workbook = XLSX.utils.book_new();

  // 1. Sheet "Résumé" (Used for absolute formula references)
  const summaryData = [
    ["RÉCAPITULATIF FINANCIER"],
    ["Total Capital CCA", summary.totalCapital],
    ["Total Intérêts HT", summary.totalInterestHT],
    ["Total TVA Collectée", summary.totalTVA],
    ["Total RAS à Reverser", summary.totalRAS],
    ["Net Perçu", summary.netTotal],
    ["Total à Rembourser", summary.totalRepayment],
    [],
    ["CONFIGURATION DES TAUX"],
    ["Taux Annuel (%)", config.annualRate],
    ["Taux TVA (%)", config.tvaRate],
    ["Taux RAS PM (%)", config.rasMoraleRate],
    ["Taux RAS PP (%)", config.rasPhysiqueRate],
    ["Base de Calcul", config.calculationBase],
    ["Date Fin de Simulation", config.endDate]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Résumé");

  // 2. Sheet "Détails CCA" with FORMULAS
  const headers = [
    "Période", "Date Déblocage", "Montant Total", "Durée (N)", "Unité", 
    "Part 1 %", "Type Part 1", "Intérêts HT 1", "RAS 1",
    "Part 2 %", "Type Part 2", "Intérêts HT 2", "RAS 2",
    "Net Total Période"
  ];

  const aoaData: any[][] = [headers];

  results.forEach((r, idx) => {
    const rowIdx = idx + 2; // Excel rows start at 1, header is at 1
    const row: any[] = [
      r.periodLabel,
      r.dateDeblocage,
      r.amountTotal,
      r.durationValue,
      r.durationUnit,
      r.pctPart1,
      r.typePart1,
      // Intérêts HT 1 (Column H)
      { f: `IF(E${rowIdx}="Mois", (C${rowIdx}*(F${rowIdx}/100)*'Résumé'!$B$10/100*D${rowIdx})/12, (C${rowIdx}*(F${rowIdx}/100)*'Résumé'!$B$10/100*D${rowIdx})/360)` },
      // RAS 1 (Column I)
      { f: `H${rowIdx} * IF(G${rowIdx}="Personne Morale", 'Résumé'!$B$12/100, 'Résumé'!$B$13/100)` },
      r.pctPart2,
      r.typePart2,
      // Intérêts HT 2 (Column L)
      { f: `IF(E${rowIdx}="Mois", (C${rowIdx}*(J${rowIdx}/100)*'Résumé'!$B$10/100*D${rowIdx})/12, (C${rowIdx}*(J${rowIdx}/100)*'Résumé'!$B$10/100*D${rowIdx})/360)` },
      // RAS 2 (Column M)
      { f: `L${rowIdx} * IF(K${rowIdx}="Personne Morale", 'Résumé'!$B$12/100, 'Résumé'!$B$13/100)` },
      // Net Total Période (Column N) = (HT1 + HT2) * (1 + TVA) - (RAS1 + RAS2)
      { f: `(H${rowIdx} + L${rowIdx}) * (1 + 'Résumé'!$B$11/100) - (I${rowIdx} + M${rowIdx})` }
    ];
    aoaData.push(row);
  });

  const detailsSheet = XLSX.utils.aoa_to_sheet(aoaData);
  XLSX.utils.book_append_sheet(workbook, detailsSheet, "Détails CCA");

  XLSX.writeFile(workbook, `CCA_Simulation_Formules_${new Date().getTime()}.xlsx`);
};

export const exportToPDF = (results: CalculationResult[], summary: FinancialSummary, config: CCAConfig) => {
  const doc = new jsPDF('landscape');
  const timestamp = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.text("Rapport de Simulation CCA - Réglementation Marocaine", 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Généré le : ${timestamp}`, 14, 28);
  doc.text(`Base de calcul : ${config.calculationBase} | Taux Annuel : ${config.annualRate}% | TVA : ${config.tvaRate}%`, 14, 34);

  // Summary Table
  const summaryHeaders = [["Indicateur", "Montant (MAD)"]];
  const summaryBody = [
    ["Total Capital CCA", formatMAD(summary.totalCapital)],
    ["Total Intérêts HT", formatMAD(summary.totalInterestHT)],
    ["Total TVA Collectée", formatMAD(summary.totalTVA)],
    ["Total RAS à Reverser", formatMAD(summary.totalRAS)],
    ["Net Perçu par les Associés", formatMAD(summary.netTotal)],
    ["Total à Rembourser (C + I)", formatMAD(summary.totalRepayment)]
  ];

  autoTable(doc, {
    startY: 40,
    head: summaryHeaders,
    body: summaryBody,
    theme: 'striped',
    headStyles: { fillStyle: 'DF', fillColor: [30, 41, 59] },
    margin: { left: 14 }
  });

  // Detailed Table
  const tableHeaders = [
    ["Pér.", "Cap. Total", "Durée", "Part 1 %", "Type 1", "Int. HT 1", "RAS 1", "Part 2 %", "Type 2", "Int. HT 2", "RAS 2", "Net Période"]
  ];

  const tableBody = results.map(r => [
    r.periodLabel,
    formatMAD(r.amountTotal),
    `${r.durationValue} ${r.durationUnit[0]}`,
    `${r.pctPart1}%`,
    r.typePart1 === 'Personne Morale' ? 'PM' : 'PP',
    formatMAD(r.interestHT1),
    formatMAD(r.ras1),
    `${r.pctPart2}%`,
    r.typePart2 === 'Personne Morale' ? 'PM' : 'PP',
    formatMAD(r.interestHT2),
    formatMAD(r.ras2),
    formatMAD(r.net1 + r.net2)
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: tableHeaders,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillStyle: 'DF', fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    margin: { left: 14 }
  });

  doc.save(`Rapport_CCA_${new Date().getTime()}.pdf`);
};

export const exportMonthlyToExcel = (accruals: MonthlyAccrual[], summary: FinancialSummary, config: CCAConfig) => {
  const workbook = XLSX.utils.book_new();

  // 1. Sheet "Paramètres"
  const summaryData = [
    ["CONFIGURATION ACCRUE MENSUELLE"],
    ["Taux TVA (%)", config.annualRate], // Wait, config sheet should have TVA separately
    ["Taux TVA (%)", config.tvaRate],
    ["Total Intérêts HT", summary.totalInterestHT],
    ["Total TVA", summary.totalTVA],
    ["Total RAS", summary.totalRAS],
    ["Net Total", summary.netTotal]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Paramètres");

  // 2. Sheet "Accrue Mensuelle"
  const headers = ["Mois/Année", "Capital Actif", "Intérêts HT", "TVA (10%)", "RAS Retenue", "Net du Mois"];
  const aoaData: any[][] = [headers];

  accruals.forEach((a, idx) => {
    const rowIdx = idx + 2;
    const row: any[] = [
      a.label,
      a.activeCapital,
      a.interestHT,
      // TVA (Column D) = Int HT * Taux TVA
      { f: `C${rowIdx} * 'Paramètres'!$B$3/100` },
      a.ras,
      // Net (Column F) = (HT + TVA) - RAS
      { f: `(C${rowIdx} + D${rowIdx}) - E${rowIdx}` }
    ];
    aoaData.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Accrue Mensuelle");

  XLSX.writeFile(workbook, `CCA_Accrue_Mensuelle_Formules_${new Date().getTime()}.xlsx`);
};

export const exportMonthlyToPDF = (accruals: MonthlyAccrual[], summary: FinancialSummary, config: CCAConfig) => {
  const doc = new jsPDF('portrait');
  const timestamp = new Date().toLocaleString();

  doc.setFontSize(16);
  doc.text("Tableau d'Accrue Mensuelle Consolidé - CCA", 14, 20);
  
  doc.setFontSize(9);
  doc.text(`Généré le : ${timestamp}`, 14, 28);
  doc.text(`Taux : ${config.annualRate}% | Base : ${config.calculationBase}`, 14, 34);

  const tableHeaders = [
    ["Mois/Année", "Capital Actif", "Int. HT", "TVA", "RAS", "Net"]
  ];

  const tableBody = accruals.map(a => [
    a.label,
    formatMAD(a.activeCapital),
    formatMAD(a.interestHT),
    formatMAD(a.tva),
    formatMAD(a.ras),
    formatMAD(a.net)
  ]);

  autoTable(doc, {
    startY: 40,
    head: tableHeaders,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8 },
    foot: [[
      "TOTAL CUMULÉ",
      "---",
      formatMAD(summary.totalInterestHT),
      formatMAD(summary.totalTVA),
      formatMAD(summary.totalRAS),
      formatMAD(summary.netTotal)
    ]],
    footStyles: { fillColor: [51, 65, 85] }
  });

  doc.save(`CCA_Accrue_Mensuelle_${new Date().getTime()}.pdf`);
};
