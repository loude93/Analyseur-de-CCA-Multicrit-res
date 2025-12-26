
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, HelpCircle, Download, FileText, 
  Settings, PieChart, BarChart2, TrendingUp, Info,
  Calculator, ChevronRight, Share2, Printer, Upload,
  Save, History, Languages, AlertCircle, FileSpreadsheet,
  Users, Layers, Calendar, Clock, Table
} from 'lucide-react';
import { 
  PieChart as RePieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from 'recharts';
import { GoogleGenAI } from "@google/genai";

import { CCAPeriod, CCAConfig, CalculationResult, FinancialSummary, SavedScenario, PersonType, CalculationBase } from './types';
import { DEFAULT_CONFIG, MONTHS_FR } from './constants';
import { 
  calculateCCAResults, 
  summarizeResults, 
  exportToExcel, 
  exportToPDF, 
  calculateMonthlyAccruals,
  exportMonthlyToExcel,
  exportMonthlyToPDF
} from './services/calculatorService';

// --- Helper for consistent formatting ---
const formatMAD = (num: number): string => {
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202f|\u00a0/g, ' ');
};

// --- Components ---

const MetricCard: React.FC<{ label: string; value: number; color?: string; suffix?: string }> = ({ label, value, color = "blue", suffix = "DH" }) => (
  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold text-${color}-600`}>
      {formatMAD(value)} <span className="text-xs text-gray-400">{suffix}</span>
    </p>
  </div>
);

const SidebarSection: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
  <div className="mb-8 last:mb-0">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">{icon}</div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">{title}</h3>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const App: React.FC = () => {
  // --- Localization ---
  const [lang, setLang] = useState<'FR' | 'AR'>('FR');
  const t = (fr: string, ar: string) => lang === 'FR' ? fr : ar;

  // --- State ---
  const [periods, setPeriods] = useState<CCAPeriod[]>([
    { id: '1', month: 2, year: 2025, amount: 100000, pctPart1: 80, typePart1: "Personne Morale", typePart2: "Personne Physique" }
  ]);
  const [annualRate, setAnnualRate] = useState(DEFAULT_CONFIG.annualRate);
  const [tvaRate, setTvaRate] = useState(DEFAULT_CONFIG.tvaRate);
  const [rasMorale, setRasMorale] = useState(DEFAULT_CONFIG.rasMorale);
  const [rasPhysique, setRasPhysique] = useState(DEFAULT_CONFIG.rasPhysique);
  
  // End Date Management
  const [endDate, setEndDate] = useState(DEFAULT_CONFIG.endDate);
  const [repaymentEndOfMonth, setRepaymentEndOfMonth] = useState(true);

  const [splitMode, setSplitMode] = useState<"Global" | "Variable">("Global");
  const [calculationBase, setCalculationBase] = useState<CalculationBase>("Mensuel");

  // Global Split Settings (used when mode is Global)
  const [globalPctPart1, setGlobalPctPart1] = useState(80);
  const [globalTypePart1, setGlobalTypePart1] = useState<PersonType>("Personne Morale");
  const [globalTypePart2, setGlobalTypePart2] = useState<PersonType>("Personne Physique");

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem('cca_scenarios_v6');
    if (saved) setSavedScenarios(JSON.parse(saved));
  }, []);

  // Snap to end of month if enabled
  const handleEndDateChange = (val: string) => {
    if (repaymentEndOfMonth) {
      const d = new Date(val);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const formatted = lastDay.toISOString().split('T')[0];
      setEndDate(formatted);
    } else {
      setEndDate(val);
    }
  };

  useEffect(() => {
    if (repaymentEndOfMonth) {
      handleEndDateChange(endDate);
    }
  }, [repaymentEndOfMonth, endDate]);

  // Update periods if Global Split changes
  useEffect(() => {
    if (splitMode === "Global") {
      setPeriods(prev => prev.map(p => ({
        ...p,
        pctPart1: globalPctPart1,
        typePart1: globalTypePart1,
        typePart2: globalTypePart2
      })));
    }
  }, [globalPctPart1, globalTypePart1, globalTypePart2, splitMode]);

  // --- Calculations ---
  const config: CCAConfig = useMemo(() => ({
    periods, annualRate, tvaRate, 
    rasMoraleRate: rasMorale, rasPhysiqueRate: rasPhysique,
    endDate, splitMode, calculationBase
  }), [periods, annualRate, tvaRate, rasMorale, rasPhysique, endDate, splitMode, calculationBase]);

  const results = useMemo(() => calculateCCAResults(config), [config]);
  const summary = useMemo(() => summarizeResults(results), [results]);
  const monthlyAccruals = useMemo(() => calculateMonthlyAccruals(config), [config]);

  // --- Handlers ---
  const addPeriod = () => {
    const last = periods[periods.length - 1] || { month: 1, year: 2025 };
    const newMonth = last.month === 12 ? 1 : last.month + 1;
    const newYear = last.month === 12 ? last.year + 1 : last.year;
    setPeriods([...periods, { 
      id: Date.now().toString(), 
      month: newMonth, 
      year: newYear, 
      amount: 0,
      pctPart1: splitMode === "Global" ? globalPctPart1 : 80,
      typePart1: splitMode === "Global" ? globalTypePart1 : "Personne Morale",
      typePart2: splitMode === "Global" ? globalTypePart2 : "Personne Physique"
    }]);
  };

  const removePeriod = (id: string) => {
    if (periods.length > 1) {
      setPeriods(periods.filter(p => p.id !== id));
    }
  };

  const updatePeriod = (id: string, updates: Partial<CCAPeriod>) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleSaveScenario = () => {
    const name = prompt("Nom du scénario :", `Simulation ${new Date().toLocaleDateString()}`);
    if (!name) return;
    const newScenario: SavedScenario = {
      id: Date.now().toString(),
      name,
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config))
    };
    const updated = [newScenario, ...savedScenarios];
    setSavedScenarios(updated);
    localStorage.setItem('cca_scenarios_v6', JSON.stringify(updated));
  };

  const loadScenario = (s: SavedScenario) => {
    setPeriods(s.config.periods);
    setAnnualRate(s.config.annualRate);
    setTvaRate(s.config.tvaRate);
    setRasMorale(s.config.rasMoraleRate);
    setRasPhysique(s.config.rasPhysiqueRate);
    setEndDate(s.config.endDate);
    setSplitMode(s.config.splitMode);
    setCalculationBase(s.config.calculationBase || "Mensuel");
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim() !== "");
      const newPeriods: CCAPeriod[] = lines.slice(1).map((line, idx) => {
        const parts = line.split(";");
        return {
          id: `imp-${idx}-${Date.now()}`,
          month: parseInt(parts[0]) || 1,
          year: parseInt(parts[1]) || 2025,
          amount: parseFloat(parts[2]) || 0,
          pctPart1: parseFloat(parts[3]) || 80,
          typePart1: (parts[4] as PersonType) || "Personne Morale",
          typePart2: (parts[5] as PersonType) || "Personne Physique"
        };
      });
      if (newPeriods.length > 0) setPeriods(newPeriods);
    };
    reader.readAsText(file);
  };

  const barData = results.map(r => ({
    name: r.periodLabel,
    'Part 1 (HT)': Number(r.interestHT1.toFixed(2)),
    'Part 2 (HT)': Number(r.interestHT2.toFixed(2)),
  }));

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${lang === 'AR' ? 'flex-row-reverse text-right' : ''}`}>
      {/* Sidebar */}
      <aside className="no-print w-full md:w-96 bg-slate-900 text-white flex-shrink-0 p-6 overflow-y-auto max-h-screen sticky top-0 border-r border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <Calculator className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{t("CCA Split Expert", "خبير تقسيم CCA")}</h1>
            <span className="block text-[10px] font-normal text-blue-400 uppercase tracking-widest">{t("Fiscale & Bancaire", "ضريبي وبنكي")}</span>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setLang(lang === 'FR' ? 'AR' : 'FR')}
            className="flex-1 py-1.5 bg-slate-800 rounded border border-slate-700 text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
          >
            <Languages size={14} /> {lang === 'FR' ? 'العربية' : 'Français'}
          </button>
        </div>

        <SidebarSection title={t("Période de Remboursement", "فترة السداد")} icon={<Clock size={16} />}>
          <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-4">
             <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-2">{t("Date de Fin (Calculée)", "تاريخ النهاية")}</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => handleEndDateChange(e.target.value)} 
                  className="w-full bg-slate-700 text-sm font-bold rounded p-2 border border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-blue-400" 
                />
             </div>
             <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="endOfMonth"
                  checked={repaymentEndOfMonth} 
                  onChange={(e) => setRepaymentEndOfMonth(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600 bg-slate-700 border-slate-600"
                />
                <label htmlFor="endOfMonth" className="text-xs text-slate-300 cursor-pointer select-none">
                  {t("Remboursement en fin de mois", "السداد في نهاية الشهر")}
                </label>
             </div>
             <p className="text-[9px] text-slate-500 leading-relaxed italic">
                {t("Toutes les injections seront calculées jusqu'à cette date précise.", "سيتم حساب جميع الحقن حتى هذا التاريخ المحدد.")}
             </p>
          </div>
        </SidebarSection>

        <SidebarSection title={t("Méthode & Taux", "الطريقة والمعدلات")} icon={<Calendar size={16} />}>
          <div className="space-y-4">
             <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-2">{t("Base de Calcul", "أساس الحساب")}</label>
                <div className="flex p-1 bg-slate-800 rounded-md border border-slate-700">
                  <button 
                    onClick={() => setCalculationBase("Mensuel")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all ${calculationBase === 'Mensuel' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {t("MENSUEL", "شهري")}
                  </button>
                  <button 
                    onClick={() => setCalculationBase("Journalier")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all ${calculationBase === 'Journalier' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {t("JOURNALIER", "يومي")}
                  </button>
                </div>
             </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>{t("Taux Intérêt Annuel", "المعدل السنوي")}</span>
                <span className="text-blue-400 font-bold">{annualRate}%</span>
              </div>
              <input type="range" min="1" max="15" step="0.25" value={annualRate} onChange={(e) => setAnnualRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>{t("Taux TVA", "معدل الضريبة")}</span>
                <span className="text-blue-400 font-bold">{tvaRate}%</span>
              </div>
              <input type="range" min="0" max="20" value={tvaRate} onChange={(e) => setTvaRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title={t("Split & Personnes", "التقسيم والأشخاص")} icon={<Layers size={16} />}>
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
            <div className="flex p-1 bg-slate-900 rounded-md">
              <button 
                onClick={() => setSplitMode("Global")}
                className={`flex-1 py-1 text-[10px] font-bold rounded ${splitMode === 'Global' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                {t("GLOBAL", "عام")}
              </button>
              <button 
                onClick={() => setSplitMode("Variable")}
                className={`flex-1 py-1 text-[10px] font-bold rounded ${splitMode === 'Variable' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                {t("VARIABLE", "متغير")}
              </button>
            </div>

            {splitMode === "Global" && (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span>{t("Répartition Part 1", "توزيع الجزء 1")}</span>
                    <span className="text-blue-400">{globalPctPart1}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={globalPctPart1} onChange={(e) => setGlobalPctPart1(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg accent-blue-500" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">{t("Type Part 1", "نوع الجزء 1")}</label>
                    <select value={globalTypePart1} onChange={(e) => setGlobalTypePart1(e.target.value as PersonType)} className="w-full bg-slate-700 text-xs rounded p-1.5 border border-slate-600 outline-none">
                      <option value="Personne Morale">Personne Morale</option>
                      <option value="Personne Physique">Personne Physique</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">{t("Type Part 2", "نوع الجزء 2")}</label>
                    <select value={globalTypePart2} onChange={(e) => setGlobalTypePart2(e.target.value as PersonType)} className="w-full bg-slate-700 text-xs rounded p-1.5 border border-slate-600 outline-none">
                      <option value="Personne Morale">Personne Morale</option>
                      <option value="Personne Physique">Personne Physique</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SidebarSection>

        <SidebarSection title={t("Retenues (RAS)", "الاقتطاع")} icon={<Users size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{t("Taux PM", "معدل PM")}</label>
              <input type="number" value={rasMorale} onChange={(e) => setRasMorale(parseFloat(e.target.value))} className="w-full bg-slate-700 text-xs rounded p-1.5 border border-slate-600" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{t("Taux PP", "معدل PP")}</label>
              <input type="number" value={rasPhysique} onChange={(e) => setRasPhysique(parseFloat(e.target.value))} className="w-full bg-slate-700 text-xs rounded p-1.5 border border-slate-600" />
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title={t("Injections de Capital", "حقن رأس المال")} icon={<Plus size={16} />}>
           <div className="mb-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 bg-slate-800 text-[10px] rounded border border-slate-700 flex items-center justify-center gap-2 hover:bg-slate-700"
              >
                <Upload size={12} /> {t("Import CSV", "استيراد")}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleCsvImport} />
           </div>

           <div className="space-y-3">
              {periods.map((p) => (
                <div key={p.id} className="p-3 bg-slate-800 rounded-lg space-y-2 border border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-blue-400">{p.month}/{p.year}</span>
                    <button onClick={() => removePeriod(p.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="bg-slate-700 text-[10px] rounded p-1 border border-slate-600" value={p.month} onChange={(e) => updatePeriod(p.id, { month: parseInt(e.target.value) })}>
                      {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <input type="number" className="bg-slate-700 text-[10px] rounded p-1 border border-slate-600" value={p.year} onChange={(e) => updatePeriod(p.id, { year: parseInt(e.target.value) })} />
                  </div>
                  <input 
                    type="number" 
                    placeholder="Montant total (DH)"
                    className="w-full bg-slate-700 text-xs rounded p-1.5 border border-slate-600"
                    value={p.amount === 0 ? '' : p.amount}
                    onChange={(e) => updatePeriod(p.id, { amount: parseFloat(e.target.value) || 0 })}
                  />

                  {splitMode === "Variable" && (
                    <div className="pt-2 border-t border-slate-700 space-y-2">
                       <div className="flex justify-between text-[9px] mb-1">
                          <span className="text-slate-500">Split Part 1</span>
                          <span className="text-white font-bold">{p.pctPart1}%</span>
                       </div>
                       <input type="range" min="0" max="100" value={p.pctPart1} onChange={(e) => updatePeriod(p.id, { pctPart1: parseInt(e.target.value) })} className="w-full h-1 bg-slate-700 rounded appearance-none accent-blue-500" />
                       <div className="grid grid-cols-1 gap-2">
                          <select value={p.typePart1} onChange={(e) => updatePeriod(p.id, { typePart1: e.target.value as PersonType })} className="w-full bg-slate-700 text-[9px] rounded p-1 border border-slate-600">
                            <option value="Personne Morale">PM (Part 1)</option>
                            <option value="Personne Physique">PP (Part 1)</option>
                          </select>
                          <select value={p.typePart2} onChange={(e) => updatePeriod(p.id, { typePart2: e.target.value as PersonType })} className="w-full bg-slate-700 text-[9px] rounded p-1 border border-slate-600">
                            <option value="Personne Morale">PM (Part 2)</option>
                            <option value="Personne Physique">PP (Part 2)</option>
                          </select>
                       </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addPeriod} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 text-sm rounded-lg border border-dashed border-slate-600 flex items-center justify-center gap-2">
                <Plus size={14} /> {t("Ajouter Injection", "إضافة حقن")}
              </button>
           </div>
        </SidebarSection>

        <SidebarSection title={t("Historique", "تاريخ")} icon={<History size={16} />}>
          <button onClick={handleSaveScenario} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold rounded flex items-center justify-center gap-2 mb-2">
            <Save size={14} /> {t("Sauver Simulation", "حفظ المحاكاة")}
          </button>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {savedScenarios.map(s => (
              <button key={s.id} onClick={() => loadScenario(s)} className="w-full text-left p-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] flex justify-between items-center group">
                <span className="truncate pr-2">{s.name}</span>
                <span className="text-slate-500 group-hover:text-blue-400">{new Date(s.timestamp).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </SidebarSection>
      </aside>

      {/* Main Content */}
      <main className="flex-grow bg-gray-50 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm no-print">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
               {t("Analyseur de CCA Multicritères", "محلل CCA متعدد المعايير")}
               <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-widest">{t("Expert", "خبير")}</span>
               <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">MADE BY MAISSINE</span>
             </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => exportToPDF(results, summary, config)} 
              className="flex items-center gap-2 text-sm font-bold bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 shadow-md transition-colors"
              title={t("Exporter en PDF", "تصدير إلى PDF")}
            >
              <FileText size={16} /> PDF
            </button>
            <button 
              onClick={() => exportToExcel(results, summary, config)}
              className="flex items-center gap-2 text-sm font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 shadow-md transition-colors"
              title={t("Exporter en Excel", "تصدير إلى Excel")}
            >
              <FileSpreadsheet size={16} /> EXCEL
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <MetricCard label={t("Capital Total", "إجمالي رأس المال")} value={summary.totalCapital} color="slate" />
            <MetricCard label={t("Intérêts HT", "الفوائد الصافية")} value={summary.totalInterestHT} color="blue" />
            <MetricCard label={t("TVA (10%)", "الضريبة")} value={summary.totalTVA} color="indigo" />
            <MetricCard label={t("RAS Total", "إجمالي الاقتطاع")} value={summary.totalRAS} color="rose" />
            <MetricCard label={t("Net Final", "صافي الدفع")} value={summary.netTotal} color="emerald" />
            <MetricCard label={t("Remboursement", "مبلغ السداد")} value={summary.totalRepayment} color="cyan" />
          </div>

          {/* Visuals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                   <BarChart2 className="text-blue-500" size={18} /> {t("Poids des Parts HT par Période", "وزن الأجزاء حسب الفترة")}
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <ReTooltip />
                      <Legend />
                      <Bar dataKey="Part 1 (HT)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Part 2 (HT)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Info size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{t("Focus sur les Retenues", "التركيز على الاقتطاعات")}</h3>
                    <p className="text-xs text-gray-400">{t("Impact fiscal cumulé sur les deux parts.", "التأثير الضريبي التراكمي على الجزأين.")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-gray-600">{t("Total RAS PM (30%)", "إجمالي RAS PM")}</span>
                      <span className="text-lg font-bold text-rose-600">
                        {formatMAD(results.reduce((acc, curr) => acc + (curr.typePart1 === 'Personne Morale' ? curr.ras1 : 0) + (curr.typePart2 === 'Personne Morale' ? curr.ras2 : 0), 0))} <span className="text-xs">DH</span>
                      </span>
                   </div>
                   <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-gray-600">{t("Total RAS PP (15%)", "إجمالي RAS PP")}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatMAD(results.reduce((acc, curr) => acc + (curr.typePart1 === 'Personne Physique' ? curr.ras1 : 0) + (curr.typePart2 === 'Personne Physique' ? curr.ras2 : 0), 0))} <span className="text-xs">DH</span>
                      </span>
                   </div>
                </div>
             </div>
          </div>

          {/* Result Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky left-0 no-print">
                <h3 className="font-extrabold text-gray-800">{t("Détail du Split par Injection", "تفاصيل التقسيم لكل حقن")}</h3>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} /> {t("Fin : ", "النهاية : ")} <span className="font-bold text-blue-600">{endDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} /> {t("Mix Actif", "مزيج نشط")}
                  </div>
                </div>
             </div>
             <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
                <table className="w-full text-left text-[10px] whitespace-nowrap">
                   <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 sticky left-0 bg-gray-50 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">{t("Période", "الفترة")}</th>
                        <th className="px-6 py-4">{t("Injection", "تاريخ الحقن")}</th>
                        <th className="px-6 py-4">{t("Date Fin", "تاريخ النهاية")}</th>
                        <th className="px-6 py-4">{t("Total CCA", "إجمالي CCA")}</th>
                        <th className="px-6 py-4">{t(calculationBase === "Mensuel" ? "N (Mois)" : "d (Jours)", calculationBase === "Mensuel" ? "N (أشهر)" : "d (أيام)")}</th>
                        <th className="px-4 py-4 bg-blue-50/50 text-blue-600 font-bold">{t("Int. HT 1", "فائدة 1")}</th>
                        <th className="px-4 py-4 bg-blue-50/50 text-blue-600">{t("RAS 1", "اقتطاع 1")}</th>
                        <th className="px-4 py-4 bg-slate-50 text-slate-600 font-bold">{t("Int. HT 2", "فائدة 2")}</th>
                        <th className="px-4 py-4 bg-slate-50 text-slate-600">{t("RAS 2", "اقتطاع 2")}</th>
                        <th className="px-6 py-4 bg-emerald-50 text-emerald-700 font-extrabold">{t("Net à Payer", "صافي الدفع")}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 text-gray-600">
                      {results.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                           <td className="px-6 py-4 font-bold text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{r.periodLabel}</td>
                           <td className="px-6 py-4 text-gray-400">{r.dateDeblocage}</td>
                           <td className="px-6 py-4 text-blue-400 font-medium">{endDate}</td>
                           <td className="px-6 py-4 font-medium">{formatMAD(r.amountTotal)}</td>
                           <td className="px-6 py-4 text-gray-400 font-bold">
                             {r.durationValue} {calculationBase === "Journalier" ? t("j", "ي") : t("m", "ش")}
                           </td>
                           
                           {/* Part 1 */}
                           <td className="px-4 py-4 bg-blue-50/20 font-bold">{formatMAD(r.interestHT1)}</td>
                           <td className="px-4 py-4 bg-blue-50/20 text-rose-500">-{formatMAD(r.ras1)}</td>
                           
                           {/* Part 2 */}
                           <td className="px-4 py-4 bg-slate-50/30 font-bold">{formatMAD(r.interestHT2)}</td>
                           <td className="px-4 py-4 bg-slate-50/30 text-rose-500">-{formatMAD(r.ras2)}</td>
                           
                           <td className="px-6 py-4 bg-emerald-50/50 font-extrabold text-emerald-800">{formatMAD(r.net1 + r.net2)}</td>
                        </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                      <tr>
                        <td className="px-6 py-4 sticky left-0 bg-slate-900 z-10">{t("TOTAL", "المجموع")}</td>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4">{formatMAD(summary.totalCapital)}</td>
                        <td className="px-6 py-4"></td>
                        <td className="px-4 py-4">{formatMAD(summary.totalInterestHT1)}</td>
                        <td className="px-4 py-4 text-rose-300">-{formatMAD(summary.totalRAS1)}</td>
                        <td className="px-4 py-4">{formatMAD(summary.totalInterestHT2)}</td>
                        <td className="px-4 py-4 text-rose-300">-{formatMAD(summary.totalRAS2)}</td>
                        <td className="px-6 py-4 bg-emerald-600">{formatMAD(summary.netTotal)}</td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          </div>

          {/* Monthly Accrual Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky left-0 no-print">
                <h3 className="font-extrabold text-gray-800 flex items-center gap-2">
                   <Table className="text-blue-500" size={18} /> {t("Tableau d'Accrue Mensuelle Consolidé", "جدول الاستحقاق الشهري الموحد")}
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => exportMonthlyToPDF(monthlyAccruals, summary, config)}
                    className="flex items-center gap-1.5 text-[10px] font-bold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors"
                  >
                    <FileText size={14} /> PDF
                  </button>
                  <button 
                    onClick={() => exportMonthlyToExcel(monthlyAccruals, summary, config)}
                    className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                  >
                    <FileSpreadsheet size={14} /> EXCEL
                  </button>
                </div>
             </div>
             <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
                <table className="w-full text-left text-[10px] whitespace-nowrap">
                   <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 sticky left-0 bg-gray-50 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">{t("Mois / Année", "الشهر / السنة")}</th>
                        <th className="px-6 py-4">{t("Capital Actif", "رأس المال النشط")}</th>
                        <th className="px-6 py-4">{t("Intérêts HT", "الفوائد الصافية")}</th>
                        <th className="px-6 py-4">{t("TVA (10%)", "الضريبة")}</th>
                        <th className="px-6 py-4">{t("RAS Retenue", "الاقتطاع")}</th>
                        <th className="px-6 py-4 bg-emerald-50 text-emerald-700 font-extrabold">{t("Net du Mois", "صافي الشهر")}</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 text-gray-600">
                      {monthlyAccruals.map((acc, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                           <td className="px-6 py-4 font-bold text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{acc.label}</td>
                           <td className="px-6 py-4 text-gray-400">{formatMAD(acc.activeCapital)}</td>
                           <td className="px-6 py-4 font-medium">{formatMAD(acc.interestHT)}</td>
                           <td className="px-6 py-4 text-gray-400">{formatMAD(acc.tva)}</td>
                           <td className="px-6 py-4 text-rose-500">-{formatMAD(acc.ras)}</td>
                           <td className="px-6 py-4 bg-emerald-50/50 font-extrabold text-emerald-800">{formatMAD(acc.net)}</td>
                        </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                      <tr>
                        <td className="px-6 py-4 sticky left-0 bg-slate-900 z-10">{t("TOTAL CUMULÉ", "المجموع التراكمي")}</td>
                        <td className="px-6 py-4">---</td>
                        <td className="px-6 py-4">{formatMAD(summary.totalInterestHT)}</td>
                        <td className="px-6 py-4">{formatMAD(summary.totalTVA)}</td>
                        <td className="px-6 py-4 text-rose-300">-{formatMAD(summary.totalRAS)}</td>
                        <td className="px-6 py-4 bg-emerald-600">{formatMAD(summary.netTotal)}</td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          </div>

          {/* Legal Section */}
          <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 flex gap-6 no-print">
             <AlertCircle className="text-blue-500 flex-shrink-0" size={32} />
             <div className="space-y-4">
                <h3 className="text-lg font-extrabold text-blue-900">{t("Guide du Splitter - N complet", "دليل التقسيم - N كامل")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-blue-800/80 leading-relaxed">
                   <p>
                     <strong>{t("Nombre complet N (Inclusif)", "العدد الكامل N (شامل)")} :</strong> {t("Pour la méthode mensuelle, la durée N est calculée comme le nombre total de mois calendaires entre l'injection et la fin (ex: Février à Mai = 4 mois). La formule est (C * t * N) / 12.", "بالنسبة للطريقة الشهرية ، يتم حساب المدة N على أنها إجمالي عدد الأشهر التقويمية entre l'injection et la fin (sur l'exemple: de février à mai = 4 mois). La formule est (C * t * N) / 12.")}
                   </p>
                   <p>
                     <strong>{t("Date de Remboursement", "تاريخ السداد")} :</strong> {t("La date de fin de simulation impacte directement N (mensuel) ou d (journalier). L'option 'Fin de mois' garantit que N couvre l'intégralité du dernier mois sélectionné.", "يؤثر تاريخ نهاية المحاكاة بشكل مباشر على N (شهري) أو d (يومي). يضمن خيار 'نهاية الشهر' أن يغطي N الشهر الأخير المختار بالكامل.")}
                   </p>
                </div>
             </div>
          </div>
        </div>

        <footer className="bg-white border-t border-gray-100 p-8 text-center no-print">
           <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">© 2025 CCA Expert Split - MAROC</p>
           <div className="flex justify-center gap-6 text-[10px] text-blue-400">
             <a href="#" className="hover:underline">Support</a>
             <a href="#" className="hover:underline">Droit Fiscal</a>
             <a href="#" className="hover:underline">Confidentialité</a>
           </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
