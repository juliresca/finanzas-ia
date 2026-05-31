import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Check, Download, Edit3, Mic, Minus, Plus, Settings, Trash2, TrendingUp, Wallet, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const INCOME_CATEGORIES = ["Kaizen", "Wellnessfy", "Extras"];
const EXPENSE_CATEGORIES = ["Comida", "Vivienda", "Ropa", "Transporte", "Servicios", "Salud", "Ocio", "Educación"];
const METHODS = ["Efectivo", "Transferencia", "Tarjeta de crédito"];
const NATURES = ["Necesario", "Opcional"];
const PURPOSES = ["Gasto", "Inversión"];
const initialBudgets = { Comida: 0, Vivienda: 0, Ropa: 0, Transporte: 0, Servicios: 0, Salud: 0, Ocio: 0, Educación: 0 };

function currency(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function monthKey(date = new Date()) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return new Date().toISOString().slice(0, 7);
  return parsedDate.toISOString().slice(0, 7);
}
function readableMonth(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
function daysInMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}
function dayOfSelectedMonth(key) {
  return key === monthKey() ? new Date().getDate() : daysInMonth(key);
}
function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function parseAmount(text) {
  const clean = String(text || "").replace(/\s/g, "").toLowerCase();
  const kMatch = clean.match(/(?:\$|ars)?(\d+(?:[,.]\d+)?)k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1].replace(",", ".")) * 1000);
  const match = clean.match(/(?:\$|ars)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?/i);
  if (!match) return 0;
  return Number(match[1].replaceAll(".", ""));
}
function findCategory(text, categories) {
  const lower = normalizeText(text);
  return categories.find((category) => lower.includes(normalizeText(category))) || categories[0];
}
function findMethod(text) {
  const lower = normalizeText(text);
  if (lower.includes("efectivo")) return "Efectivo";
  if (lower.includes("tarjeta") || lower.includes("credito")) return "Tarjeta de crédito";
  if (lower.includes("transferencia") || lower.includes("transferi") || lower.includes("mercado pago")) return "Transferencia";
  return "Transferencia";
}
export function parseNaturalInput(text, mode) {
  const clean = String(text || "").trim();
  const lower = normalizeText(clean);
  const categories = mode === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return {
    amount: parseAmount(clean),
    category: findCategory(clean, categories),
    method: findMethod(clean),
    nature: lower.includes("opcional") ? "Opcional" : "Necesario",
    purpose: lower.includes("inversion") || lower.includes("inverti") || lower.includes("invers") ? "Inversión" : "Gasto",
    note: clean,
  };
}
function load(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function runParserTests() {
  const tests = [
    { name: "parses expense amount, category and method", input: "gasté $12.000 en comida por transferencia, necesario", mode: "expense", expected: { amount: 12000, category: "Comida", method: "Transferencia", nature: "Necesario", purpose: "Gasto" } },
    { name: "parses income source", input: "cobré 250000 de Kaizen por transferencia", mode: "income", expected: { amount: 250000, category: "Kaizen", method: "Transferencia" } },
    { name: "parses investment and credit card", input: "pagué 45000 en educación con tarjeta de crédito como inversión", mode: "expense", expected: { amount: 45000, category: "Educación", method: "Tarjeta de crédito", purpose: "Inversión" } },
    { name: "parses shorthand k amount", input: "gasté 15k en comida", mode: "expense", expected: { amount: 15000, category: "Comida" } },
    { name: "parses decimal k amount", input: "gasté 12,5k en transporte", mode: "expense", expected: { amount: 12500, category: "Transporte" } },
    { name: "defaults unknown expense category to first category", input: "gasté 7000 ayer", mode: "expense", expected: { amount: 7000, category: "Comida" } },
    { name: "parses mercado pago as transfer", input: "gasté 9000 en salud con mercado pago", mode: "expense", expected: { amount: 9000, category: "Salud", method: "Transferencia" } },
  ];
  tests.forEach((test) => {
    const result = parseNaturalInput(test.input, test.mode);
    Object.entries(test.expected).forEach(([key, expectedValue]) => {
      console.assert(result[key] === expectedValue, `Parser test failed: ${test.name}. Expected ${key}=${expectedValue}, received ${result[key]}`);
    });
  });
}
if (typeof window !== "undefined") runParserTests();

function getEmptyForm() {
  return { amount: "", category: "Comida", method: "Transferencia", nature: "Necesario", purpose: "Gasto", status: "Cobrado", note: "", date: new Date().toISOString().slice(0, 10) };
}

export default function FinanzasIA() {
  const [transactions, setTransactions] = useState(() => load("finanzas_ia_transactions", []));
  const [budgets, setBudgets] = useState(() => load("finanzas_ia_budgets", initialBudgets));
  const [settings, setSettings] = useState(() => load("finanzas_ia_settings", { savingTarget: 20 }));
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("expense");
  const [quickText, setQuickText] = useState("");
  const [form, setForm] = useState(getEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => save("finanzas_ia_transactions", transactions), [transactions]);
  useEffect(() => save("finanzas_ia_budgets", budgets), [budgets]);
  useEffect(() => save("finanzas_ia_settings", settings), [settings]);

  useEffect(() => {
    const validCategories = mode === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!validCategories.includes(form.category)) setForm((prev) => ({ ...prev, category: validCategories[0] }));
  }, [mode, form.category]);

  const parsedPreview = useMemo(() => quickText.trim() ? parseNaturalInput(quickText, mode) : null, [quickText, mode]);
  const monthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.date) === selectedMonth), [transactions, selectedMonth]);

  const stats = useMemo(() => {
    const incomes = monthTransactions.filter((t) => t.type === "income");
    const expenses = monthTransactions.filter((t) => t.type === "expense");
    const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const balance = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    const targetSaving = totalIncome * (Number(settings.savingTarget || 0) / 100);
    const availableToSpend = Math.max(totalIncome - targetSaving - totalExpense, 0);
    const needToGenerate = Math.max(totalExpense + targetSaving - totalIncome, 0);
    const totalBudget = Object.values(budgets).reduce((s, v) => s + Number(v || 0), 0);
    const monthDay = dayOfSelectedMonth(selectedMonth);
    const totalDays = daysInMonth(selectedMonth);
    const daysLeft = Math.max(totalDays - monthDay, 0);
    const monthProgress = totalDays ? (monthDay / totalDays) * 100 : 0;
    const budgetUsed = totalBudget ? (totalExpense / totalBudget) * 100 : 0;
    const dailySpend = monthDay ? totalExpense / monthDay : 0;
    const dailyAllowed = daysLeft > 0 ? availableToSpend / daysLeft : availableToSpend;
    const paceDelta = totalBudget ? budgetUsed - monthProgress : 0;
    const byExpenseCategory = EXPENSE_CATEGORIES.map((category) => ({
      category,
      total: expenses.filter((t) => t.category === category).reduce((s, t) => s + Number(t.amount), 0),
      budget: Number(budgets[category] || 0),
    })).filter((item) => item.total > 0 || item.budget > 0);
    const necessary = expenses.filter((t) => t.nature === "Necesario").reduce((s, t) => s + Number(t.amount), 0);
    const optional = expenses.filter((t) => t.nature === "Opcional").reduce((s, t) => s + Number(t.amount), 0);
    const investment = expenses.filter((t) => t.purpose === "Inversión").reduce((s, t) => s + Number(t.amount), 0);
    const ordinaryExpense = totalExpense - investment;
    const biggestCategory = [...byExpenseCategory].sort((a, b) => b.total - a.total)[0];
    return { totalIncome, totalExpense, balance, savingRate, targetSaving, availableToSpend, needToGenerate, totalBudget, monthDay, totalDays, monthProgress, budgetUsed, dailySpend, dailyAllowed, paceDelta, byExpenseCategory, necessary, optional, investment, ordinaryExpense, biggestCategory };
  }, [monthTransactions, budgets, settings, selectedMonth]);

  const monthlyHistory = useMemo(() => {
    const keys = [...new Set(transactions.map((t) => monthKey(t.date)))].sort();
    return keys.map((key) => {
      const tx = transactions.filter((t) => monthKey(t.date) === key);
      const ingreso = tx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const egreso = tx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { key, month: key.slice(5), ingreso, egreso, balance: ingreso - egreso };
    });
  }, [transactions]);

  const previousMonthComparison = useMemo(() => {
    const index = monthlyHistory.findIndex((item) => item.key === selectedMonth);
    if (index <= 0) return null;
    const current = monthlyHistory[index];
    const previous = monthlyHistory[index - 1];
    return {
      expenseChange: previous.egreso > 0 ? ((current.egreso - previous.egreso) / previous.egreso) * 100 : 0,
      incomeChange: previous.ingreso > 0 ? ((current.ingreso - previous.ingreso) / previous.ingreso) * 100 : 0,
    };
  }, [monthlyHistory, selectedMonth]);

  const months = useMemo(() => [...new Set([monthKey(), ...transactions.map((t) => monthKey(t.date))])].sort().reverse(), [transactions]);

  function resetEntry() { setForm(getEmptyForm()); setQuickText(""); setEditingId(null); setDetailsOpen(false); setError(""); }
  function validateTransaction(data) {
    const amount = Number(data.amount);
    if (!amount || amount <= 0) return "Ingresá un monto válido.";
    if (!data.category) return "Elegí una categoría.";
    if (!data.date) return "Elegí una fecha.";
    return "";
  }
  function saveTransaction(data, transactionMode = mode) {
    const validationError = validateTransaction(data);
    if (validationError) { setError(validationError); return; }
    const existing = editingId ? transactions.find((item) => item.id === editingId) : null;
    const transaction = {
      id: editingId || uid(),
      type: transactionMode,
      amount: Number(data.amount),
      category: data.category,
      method: data.method,
      nature: transactionMode === "expense" ? data.nature : "",
      purpose: transactionMode === "expense" ? data.purpose : "",
      status: transactionMode === "income" ? data.status || "Cobrado" : "Pagado",
      note: data.note || "",
      date: data.date || new Date().toISOString().slice(0, 10),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTransactions((previous) => editingId ? previous.map((item) => item.id === editingId ? transaction : item) : [transaction, ...previous]);
    resetEntry();
    setView("dashboard");
  }
  function confirmQuickAdd() {
    if (!parsedPreview) { setError("Escribí o dictá un movimiento primero."); return; }
    saveTransaction({ ...form, ...parsedPreview, date: form.date, status: mode === "income" ? "Cobrado" : "Pagado" }, mode);
  }
  function startEdit(transaction) {
    setEditingId(transaction.id);
    setMode(transaction.type);
    setQuickText(transaction.note || "");
    setForm({ amount: String(transaction.amount), category: transaction.category, method: transaction.method, nature: transaction.nature || "Necesario", purpose: transaction.purpose || "Gasto", status: transaction.status || "Cobrado", note: transaction.note || "", date: transaction.date });
    setDetailsOpen(true); setError(""); setView("add");
  }
  function deleteTransaction(id) { setTransactions((previous) => previous.filter((transaction) => transaction.id !== id)); }
  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Tu navegador no soporta dictado por voz. Podés escribir el movimiento en lenguaje natural."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => { setQuickText(event.results[0][0].transcript); setError(""); };
    recognition.start();
  }
  function exportCSV() {
    const header = ["fecha", "tipo", "monto", "categoria", "metodo", "naturaleza", "proposito", "estado", "nota"];
    const rows = transactions.map((t) => [t.date, t.type, t.amount, t.category, t.method, t.nature, t.purpose, t.status, t.note]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `finanzas-ia-${selectedMonth}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  function openAdd(nextMode) { resetEntry(); setMode(nextMode); setView("add"); }

  const status = stats.balance >= stats.targetSaving ? "Vas bien" : stats.balance >= 0 ? "Cuidar gasto" : "Generar más";
  const statusText = stats.balance >= stats.targetSaving
    ? `Podés gastar hasta ${currency(stats.dailyAllowed)} por día y sostener la meta.`
    : stats.balance >= 0
      ? `Para llegar a tu meta, faltan ${currency(stats.targetSaving - stats.balance)}.`
      : `Estás en déficit. Necesitás generar o recortar ${currency(Math.abs(stats.balance))}.`;
  const rhythmText = stats.totalBudget
    ? stats.paceDelta > 10 ? "Estás gastando más rápido que el mes." : stats.paceDelta < -10 ? "Venís por debajo del ritmo previsto." : "Tu gasto acompaña el avance del mes."
    : "Definí presupuestos para medir tu ritmo real.";

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 flex justify-center">
      <div className="w-full max-w-md min-h-screen bg-[#F7F5F1] shadow-2xl relative overflow-hidden">
        <header className="sticky top-0 z-20 bg-[#F7F5F1]/95 backdrop-blur border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Control financiero</p>
              <h1 className="text-xl font-semibold">Finanzas IA</h1>
            </div>
            <div className="flex items-center gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="text-xs bg-white border border-neutral-200 rounded-2xl px-3 py-2 outline-none max-w-[138px]">
                {months.map((month) => <option key={month} value={month}>{readableMonth(month)}</option>)}
              </select>
              <button type="button" onClick={() => setView("settings")} className={`h-10 w-10 rounded-2xl border flex items-center justify-center ${view === "settings" ? "bg-neutral-950 text-white border-neutral-950" : "bg-white text-neutral-500 border-neutral-200"}`} aria-label="Abrir ajustes"><Settings size={18} /></button>
            </div>
          </div>
        </header>

        <main className="px-5 pb-28 pt-5 space-y-5">
          {view === "dashboard" && (
            <>
              <section className="rounded-[2rem] bg-neutral-950 text-white p-5 shadow-xl">
                <div className="flex justify-between items-start gap-4">
                  <div><p className="text-neutral-400 text-sm">Balance mensual</p><h2 className="text-4xl font-semibold mt-1">{currency(stats.balance)}</h2></div>
                  <span className="text-xs px-3 py-1 rounded-full bg-white/10 whitespace-nowrap">{status}</span>
                </div>
                <p className="text-sm text-neutral-300 mt-4">{statusText}</p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button type="button" onClick={() => openAdd("income")} className="rounded-2xl bg-white text-neutral-950 py-3 font-medium flex items-center justify-center gap-2"><Plus size={18} /> Ingreso</button>
                  <button type="button" onClick={() => openAdd("expense")} className="rounded-2xl bg-white/10 py-3 font-medium flex items-center justify-center gap-2"><Minus size={18} /> Egreso</button>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <Metric title="Para gastar" value={currency(stats.availableToSpend)} helper="después de ahorro" icon={<Wallet size={18} />} />
                <Metric title="Tasa ahorro" value={`${Math.round(stats.savingRate)}%`} helper={`meta ${settings.savingTarget || 0}%`} icon={<TrendingUp size={18} />} />
                <Metric title="Ingresos" value={currency(stats.totalIncome)} />
                <Metric title="Egresos" value={currency(stats.totalExpense)} />
              </section>

              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200">
                <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Ritmo del mes</h3><span className="text-xs text-neutral-500">Día {stats.monthDay}/{stats.totalDays}</span></div>
                <p className="text-sm text-neutral-600 mb-4">{rhythmText}</p>
                <Progress label="Mes transcurrido" value={stats.monthProgress} right={`${Math.round(stats.monthProgress)}%`} />
                <Progress label="Presupuesto usado" value={stats.budgetUsed} right={stats.totalBudget ? `${Math.round(stats.budgetUsed)}%` : "sin meta"} />
                <div className="grid grid-cols-2 gap-3 mt-4"><MiniStat label="Gasto diario" value={currency(stats.dailySpend)} /><MiniStat label="Permitido/día" value={currency(stats.dailyAllowed)} /></div>
              </section>

              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200">
                <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Gastos por categoría</h3><BarChart3 size={18} className="text-neutral-500" /></div>
                {stats.byExpenseCategory.length ? <CategoryBars items={stats.byExpenseCategory} total={stats.totalExpense} /> : <Empty text="Cargá tu primer gasto. Ejemplo: “gasté 5000 en comida”." />}
              </section>

              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200">
                <h3 className="font-semibold mb-4">Lectura financiera</h3>
                <div className="space-y-3 text-sm">
                  <Insight label="Necesario" value={currency(stats.necessary)} />
                  <Insight label="Opcional" value={currency(stats.optional)} />
                  <Insight label="Inversión productiva" value={currency(stats.investment)} />
                  <Insight label="Gasto de vida" value={currency(stats.ordinaryExpense)} />
                </div>
              </section>

              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200">
                <h3 className="font-semibold mb-3">Últimos movimientos</h3>
                <TransactionList transactions={monthTransactions.slice(0, 6)} onDelete={deleteTransaction} onEdit={startEdit} />
              </section>
            </>
          )}

          {view === "add" && (
            <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{editingId ? "Editar movimiento" : "Cargar movimiento"}</h2>
                {editingId && <button type="button" onClick={resetEntry} className="text-xs text-neutral-500 flex items-center gap-1"><X size={14} /> cancelar</button>}
              </div>
              <div className="flex rounded-2xl bg-neutral-100 p-1">
                <button type="button" onClick={() => setMode("expense")} className={`flex-1 py-3 rounded-xl text-sm font-medium ${mode === "expense" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}>Egreso</button>
                <button type="button" onClick={() => setMode("income")} className={`flex-1 py-3 rounded-xl text-sm font-medium ${mode === "income" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}>Ingreso</button>
              </div>
              <div className="rounded-3xl bg-[#F7F5F1] p-4 border border-neutral-200">
                <label className="text-xs uppercase tracking-[0.15em] text-neutral-500">Registro natural</label>
                <textarea value={quickText} onChange={(e) => { setQuickText(e.target.value); setError(""); }} placeholder={mode === "expense" ? "Ej: gasté 12000 en comida por transferencia, necesario" : "Ej: cobré 250000 de Kaizen por transferencia"} className="w-full bg-transparent outline-none mt-3 min-h-24 resize-none text-lg" />
                {parsedPreview && (
                  <div className="rounded-2xl bg-white border border-neutral-200 p-3 mb-3 text-sm">
                    <p className="text-xs text-neutral-500 mb-2">Vista previa</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PreviewItem label="Monto" value={currency(parsedPreview.amount)} />
                      <PreviewItem label="Categoría" value={parsedPreview.category} />
                      <PreviewItem label="Método" value={parsedPreview.method} />
                      <PreviewItem label="Tipo" value={mode === "income" ? "Ingreso" : parsedPreview.purpose} />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={startVoice} className="flex-1 rounded-2xl border border-neutral-300 py-3 font-medium flex items-center justify-center gap-2"><Mic size={18} /> {isListening ? "Escuchando" : "Dictar"}</button>
                  <button type="button" onClick={confirmQuickAdd} className="flex-1 rounded-2xl bg-neutral-950 text-white py-3 font-medium flex items-center justify-center gap-2"><Check size={18} /> Confirmar</button>
                </div>
              </div>
              {error && <div className="rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm p-3">{error}</div>}
              <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="w-full rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-medium">{detailsOpen ? "Ocultar detalles" : "Editar detalles manualmente"}</button>
              {detailsOpen && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3"><Input label="Monto" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} type="number" /><Input label="Fecha" value={form.date} onChange={(value) => setForm({ ...form, date: value })} type="date" /></div>
                  <Select label="Categoría" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={mode === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} />
                  <Select label="Método" value={form.method} onChange={(value) => setForm({ ...form, method: value })} options={METHODS} />
                  {mode === "expense" && <div className="grid grid-cols-2 gap-3"><Select label="Naturaleza" value={form.nature} onChange={(value) => setForm({ ...form, nature: value })} options={NATURES} /><Select label="Tipo" value={form.purpose} onChange={(value) => setForm({ ...form, purpose: value })} options={PURPOSES} /></div>}
                  {mode === "income" && <Select label="Estado" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["Cobrado", "Pendiente", "Vencido"]} />}
                  <Input label="Nota" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
                  <button type="button" onClick={() => saveTransaction(form)} className="w-full rounded-2xl bg-neutral-950 text-white py-4 font-semibold">{editingId ? "Guardar cambios" : "Guardar manual"}</button>
                </div>
              )}
            </section>
          )}

          {view === "stats" && (
            <div className="space-y-5">
              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200">
                <h3 className="font-semibold mb-4">Diagnóstico del mes</h3>
                <div className="space-y-3 text-sm">
                  <Insight label="Mayor gasto" value={stats.biggestCategory ? `${stats.biggestCategory.category} · ${currency(stats.biggestCategory.total)}` : "Sin datos"} />
                  <Insight label="Gasto de vida" value={currency(stats.ordinaryExpense)} />
                  <Insight label="Inversión productiva" value={currency(stats.investment)} />
                  <Insight label="Necesitás generar" value={currency(stats.needToGenerate)} />
                  {previousMonthComparison && <><Insight label="Egresos vs mes previo" value={`${Math.round(previousMonthComparison.expenseChange)}%`} /><Insight label="Ingresos vs mes previo" value={`${Math.round(previousMonthComparison.incomeChange)}%`} /></>}
                </div>
              </section>
              <ChartCard title="Ingresos vs egresos" hasData={monthlyHistory.length > 0} empty="Cargá movimientos para ver estadísticas.">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyHistory}><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis hide /><Tooltip formatter={(value) => currency(value)} /><Bar dataKey="ingreso" radius={[8, 8, 0, 0]} fill="#111827" /><Bar dataKey="egreso" radius={[8, 8, 0, 0]} fill="#9CA3AF" /></BarChart></ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Balance histórico" hasData={monthlyHistory.length > 0} empty="Todavía no hay historial.">
                <ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyHistory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis hide /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="balance" strokeWidth={3} dot stroke="#111827" /></LineChart></ResponsiveContainer>
              </ChartCard>
              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200"><h3 className="font-semibold mb-4">Movimientos del mes</h3><TransactionList transactions={monthTransactions} onDelete={deleteTransaction} onEdit={startEdit} /></section>
            </div>
          )}

          {view === "settings" && (
            <div className="space-y-5">
              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200 space-y-4"><h3 className="font-semibold">Objetivo mensual</h3><Input label="Meta de ahorro mensual (%)" value={settings.savingTarget} onChange={(value) => setSettings({ ...settings, savingTarget: value })} type="number" /></section>
              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200 space-y-4"><h3 className="font-semibold">Presupuesto mensual por categoría</h3>{EXPENSE_CATEGORIES.map((category) => <Input key={category} label={category} value={budgets[category]} onChange={(value) => setBudgets({ ...budgets, [category]: value })} type="number" />)}</section>
              <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200 space-y-4"><h3 className="font-semibold">Datos y respaldo</h3><p className="text-sm text-neutral-500">Los datos quedan guardados en este dispositivo. Exportá un respaldo periódicamente.</p><button type="button" onClick={exportCSV} className="w-full rounded-2xl bg-neutral-950 text-white py-4 font-semibold flex items-center justify-center gap-2"><Download size={18} /> Exportar CSV</button></section>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur border-t border-neutral-200 px-5 pt-3 pb-5 grid grid-cols-3 gap-3">
          <NavButton active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<Wallet size={20} />} label="Inicio" />
          <NavButton active={view === "add"} onClick={() => setView("add")} icon={<Plus size={22} />} label="Cargar" primary />
          <NavButton active={view === "stats"} onClick={() => setView("stats")} icon={<BarChart3 size={20} />} label="Datos" />
        </nav>
      </div>
    </div>
  );
}

function ChartCard({ title, hasData, empty, children }) {
  return <section className="rounded-[2rem] bg-white p-5 shadow-sm border border-neutral-200"><h3 className="font-semibold mb-4">{title}</h3><div className="h-64">{hasData ? children : <Empty text={empty} />}</div></section>;
}
function Metric({ title, value, helper, icon }) {
  return <div className="rounded-3xl bg-white p-4 shadow-sm border border-neutral-200">{icon && <div className="text-neutral-500 mb-2">{icon}</div>}<p className="text-xs text-neutral-500">{title}</p><p className="text-lg font-semibold mt-1">{value}</p>{helper && <p className="text-[11px] text-neutral-400 mt-1">{helper}</p>}</div>;
}
function MiniStat({ label, value }) {
  return <div className="rounded-2xl bg-[#F7F5F1] border border-neutral-200 p-3"><p className="text-xs text-neutral-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>;
}
function Progress({ label, value, right }) {
  const safeValue = Math.max(0, Math.min(Number(value || 0), 100));
  return <div className="mb-3"><div className="flex justify-between text-sm mb-1 gap-3"><span>{label}</span><span className="text-neutral-500">{right}</span></div><div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-neutral-950 rounded-full" style={{ width: `${safeValue}%` }} /></div></div>;
}
function CategoryBars({ items, total }) {
  return <div className="space-y-4">{[...items].sort((a, b) => b.total - a.total).map((item) => {
    const percent = total ? (item.total / total) * 100 : 0;
    const budgetPercent = item.budget ? Math.min((item.total / item.budget) * 100, 100) : 0;
    return <div key={item.category}><div className="flex justify-between text-sm mb-1 gap-3"><span>{item.category}</span><span className="text-right">{currency(item.total)} · {Math.round(percent)}%</span></div><div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-neutral-950 rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} /></div>{item.budget > 0 && <p className="text-[11px] text-neutral-400 mt-1">Presupuesto usado: {Math.round(budgetPercent)}%</p>}</div>;
  })}</div>;
}
function Insight({ label, value }) {
  return <div className="flex justify-between border-b border-neutral-100 pb-2 gap-4"><span className="text-neutral-500">{label}</span><strong className="text-right">{value}</strong></div>;
}
function PreviewItem({ label, value }) {
  return <div><p className="text-[11px] text-neutral-400">{label}</p><p className="font-medium truncate">{value}</p></div>;
}
function Input({ label, value, onChange, type = "text" }) {
  return <label className="block"><span className="text-xs text-neutral-500">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl border border-neutral-200 bg-[#F7F5F1] px-4 py-3 outline-none focus:border-neutral-900" /></label>;
}
function Select({ label, value, onChange, options }) {
  return <label className="block"><span className="text-xs text-neutral-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl border border-neutral-200 bg-[#F7F5F1] px-4 py-3 outline-none focus:border-neutral-900">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function TransactionList({ transactions, onDelete, onEdit }) {
  if (!transactions.length) return <Empty text="Sin movimientos todavía." />;
  return <div className="space-y-2">{transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F5F1] p-3"><div className="min-w-0"><p className="font-medium truncate">{transaction.category} · {currency(transaction.amount)}</p><p className="text-xs text-neutral-500 truncate">{transaction.date} · {transaction.method} {transaction.purpose ? `· ${transaction.purpose}` : ""}</p>{transaction.note && <p className="text-xs text-neutral-400 truncate mt-1">{transaction.note}</p>}</div><div className="flex items-center gap-1"><button type="button" onClick={() => onEdit(transaction)} className="p-2 text-neutral-400 hover:text-neutral-950" aria-label="Editar movimiento"><Edit3 size={16} /></button><button type="button" onClick={() => onDelete(transaction.id)} className="p-2 text-neutral-400 hover:text-neutral-950" aria-label="Eliminar movimiento"><Trash2 size={16} /></button></div></div>)}</div>;
}
function Empty({ text }) {
  return <div className="rounded-2xl bg-neutral-50 border border-dashed border-neutral-200 p-5 text-center text-sm text-neutral-500">{text}</div>;
}
function NavButton({ active, onClick, icon, label, primary = false }) {
  const className = primary ? (active ? "bg-neutral-950 text-white py-4 shadow-lg scale-[1.02]" : "bg-neutral-950 text-white py-4 shadow-md") : active ? "bg-neutral-100 text-neutral-950 py-3 font-semibold" : "text-neutral-500 py-3";
  return <button type="button" onClick={onClick} className={`rounded-2xl flex flex-col items-center justify-center gap-1 text-xs transition-all ${className}`}>{icon}{label}</button>;
}
