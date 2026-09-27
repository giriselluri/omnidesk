import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Play,
  FileCode,
  Layers,
  Sparkles,
  Clock,
  Sliders,
  ShieldCheck,
  ChevronRight,
  Send,
  RotateCcw,
} from 'lucide-react';
import type {
  ModelInfo,
  EvalSuite,
  EvalRunReport,
  PromptTemplate,
} from '../../shared/types.js';
import { api } from '../api/client.js';

interface EvalsViewProps {
  models: ModelInfo[];
}

export const EvalsView: React.FC<EvalsViewProps> = ({ models }) => {
  const [activeTab, setActiveTab] = useState<'suites' | 'templates'>('suites');

  // Eval Suites state
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('');
  const [selectedModelKeys, setSelectedModelKeys] = useState<string[]>([
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gpt-4o-mini',
  ]);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalReport, setEvalReport] = useState<EvalRunReport | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateTargetModel, setTemplateTargetModel] = useState<string>('gemini-3.8-flash');
  const [isExecutingTemplate, setIsExecutingTemplate] = useState(false);
  const [templateOutput, setTemplateOutput] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getEvalSuites(), api.getPromptTemplates()])
      .then(([sList, tList]) => {
        setSuites(sList);
        if (sList.length > 0) setSelectedSuiteId(sList[0].id);

        setTemplates(tList);
        if (tList.length > 0) {
          setSelectedTemplateId(tList[0].id);
          setTemplateVariables(tList[0].sampleVariables || {});
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectTemplate = (tmpl: PromptTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setTemplateVariables(tmpl.sampleVariables || {});
    setTemplateOutput(null);
  };

  const handleRunEvalSuite = async () => {
    if (!selectedSuiteId || selectedModelKeys.length === 0 || isRunningEval) return;
    setIsRunningEval(true);
    setEvalReport(null);

    try {
      const report = await api.runEvalSuite(selectedSuiteId, selectedModelKeys);
      setEvalReport(report);
    } catch (err: any) {
      alert(err.message || 'Evaluation run failed');
    } finally {
      setIsRunningEval(false);
    }
  };

  const handleExecuteTemplate = async () => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl || isExecutingTemplate) return;

    setIsExecutingTemplate(true);
    setTemplateOutput(null);

    // Interpolate variables
    let finalPrompt = tmpl.userPromptTemplate;
    for (const [key, val] of Object.entries(templateVariables)) {
      finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }

    try {
      const res = await api.compareModels({
        prompt: finalPrompt,
        systemPrompt: tmpl.systemPrompt,
        modelIds: [templateTargetModel],
      });
      const resultItem = res.results[templateTargetModel];
      setTemplateOutput(resultItem?.output || 'No response generated');
    } catch (err: any) {
      setTemplateOutput(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      setIsExecutingTemplate(false);
    }
  };

  const toggleModelForEval = (key: string) => {
    if (selectedModelKeys.includes(key)) {
      if (selectedModelKeys.length > 1) {
        setSelectedModelKeys(selectedModelKeys.filter((k) => k !== key));
      }
    } else {
      setSelectedModelKeys([...selectedModelKeys, key]);
    }
  };

  const activeSuite = suites.find((s) => s.id === selectedSuiteId);
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-y-auto">
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                AI Evals & Prompt Workbench
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono font-medium">
                Quality Gates
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Automated evaluation test suites, assertion verifiers, and prompt variable templates across frontier models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('suites')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'suites'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Automated Test Suites</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'templates'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Prompt Templates</span>
            </button>
          </div>
        </div>

        {/* TAB 1: AUTOMATED EVAL SUITES */}
        {activeTab === 'suites' && (
          <div className="space-y-6">
            {/* Suite Configuration Bar */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Select Evaluation Suite
                  </label>
                  <select
                    value={selectedSuiteId}
                    onChange={(e) => setSelectedSuiteId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-medium"
                  >
                    {suites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.testCases.length} assertions)
                      </option>
                    ))}
                  </select>
                  {activeSuite && (
                    <div className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {activeSuite.description}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Contending Models to Evaluate ({selectedModelKeys.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((m) => {
                      const isSel = selectedModelKeys.includes(m.model_key);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleModelForEval(m.model_key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            isSel
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {m.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  Runs each test case and verifies strict assertions (contains, JSON validity, latency SLA).
                </div>

                <button
                  onClick={handleRunEvalSuite}
                  disabled={isRunningEval}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isRunningEval ? 'Running Test Suite...' : 'Execute Quality Gate'}</span>
                </button>
              </div>
            </div>

            {/* Test Cases in Active Suite */}
            {activeSuite && !evalReport && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Assertions in Suite: "{activeSuite.name}"
                </div>

                <div className="space-y-2">
                  {activeSuite.testCases.map((tc, idx) => (
                    <div
                      key={tc.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-200">
                          {idx + 1}. {tc.name}
                        </div>
                        <div className="text-slate-400 text-[11px] line-clamp-1 italic">
                          "{tc.prompt}"
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-blue-400 border border-slate-800 font-mono">
                          {tc.assertionType}: {tc.assertionValue}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluation Run Report Scorecard */}
            {evalReport && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        Evaluation Scorecard: {evalReport.suiteName}
                      </h2>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Executed at {new Date(evalReport.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-mono">
                      Completed
                    </span>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {evalReport.summaries.map((s) => (
                      <div
                        key={s.modelId}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-white">
                          <span>{s.modelName}</span>
                          <span
                            className={`font-mono text-sm ${
                              s.passRate >= 70 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {s.passRate}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.passRate >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${s.passRate}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                          <span>
                            {s.passedCount}/{s.totalCount} passed
                          </span>
                          <span className="flex items-center gap-1 text-slate-300">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {s.avgLatencyMs}ms avg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Test Case Results Breakdown */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Itemized Assertion Results
                  </div>

                  <div className="space-y-3">
                    {evalReport.summaries[0]?.results.map((r, tcIdx) => (
                      <div
                        key={r.testCaseId}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                      >
                        <div className="font-semibold text-xs text-white">
                          Test Case #{tcIdx + 1}: {r.testCaseName}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {evalReport.summaries.map((mSummary) => {
                            const res = mSummary.results[tcIdx];
                            return (
                              <div
                                key={mSummary.modelId}
                                className={`p-3 rounded-lg border text-xs ${
                                  res?.passed
                                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                                    : 'bg-red-950/20 border-red-800/40 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-semibold text-[11px] text-slate-300 truncate">
                                    {mSummary.modelName}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                                      res?.passed
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                        : 'bg-red-950 text-red-400 border border-red-800/50'
                                    }`}
                                  >
                                    {res?.passed ? 'PASSED' : 'FAILED'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-400 line-clamp-2 italic mb-1">
                                  "{res?.actualOutput}"
                                </div>

                                <div className="text-[10px] text-slate-500 font-mono">
                                  Latency: {res?.latencyMs}ms
                                  {res?.reason && ` · ${res.reason}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROMPT WORKBENCH & TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Template Selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Prompt Template Library
              </div>
              {templates.map((t) => {
                const isSel = selectedTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      isSel
                        ? 'bg-purple-600/15 border-purple-500/40 text-white'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs">{t.title}</div>
                    <div className="text-[10px] text-purple-400 font-mono mt-0.5">
                      {t.category}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {t.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Workbench Editor & Executor */}
            <div className="md:col-span-2 space-y-4">
              {activeTemplate ? (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {activeTemplate.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeTemplate.description}
                    </p>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      System Instructions
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                      {activeTemplate.systemPrompt}
                    </div>
                  </div>

                  {/* Variables Form */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Interpolation Variables
                    </label>

                    {Object.keys(templateVariables).map((vKey) => (
                      <div key={vKey}>
                        <label className="block text-xs font-mono text-purple-400 mb-1">
                          {`{{${vKey}}}`}
                        </label>
                        <textarea
                          rows={2}
                          value={templateVariables[vKey] || ''}
                          onChange={(e) =>
                            setTemplateVariables({
                              ...templateVariables,
                              [vKey]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-purple-500 resize-none font-sans"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Model Selection & Run */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Run on:</span>
                      <select
                        value={templateTargetModel}
                        onChange={(e) => setTemplateTargetModel(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-purple-500"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.model_key}>
                            {m.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleExecuteTemplate}
                      disabled={isExecutingTemplate}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isExecutingTemplate ? 'Executing...' : 'Run Prompt'}</span>
                    </button>
                  </div>

                  {/* Output Preview */}
                  {templateOutput && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mt-4">
                      <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Model Output ({templateTargetModel})
                      </div>
                      <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {templateOutput}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-12">
                  Select a prompt template to start experimenting.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
