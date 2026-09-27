import React, { useState, useEffect } from 'react';
import {
  Mail,
  Search,
  Sparkles,
  Send,
  Trash2,
  Edit3,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import type { EmailThread, EmailDraft } from '../../shared/types.js';
import { api } from '../api/client.js';

export const GmailView: React.FC = () => {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftInstructions, setDraftInstructions] = useState('');
  const [activeDraft, setActiveDraft] = useState<EmailDraft | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [tList, dList] = await Promise.all([
        api.getGmailThreads(searchQuery),
        api.getDrafts(),
      ]);
      setThreads(tList);
      setDrafts(dList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  const handleSummarize = async (threadId: string) => {
    setIsSummarizing(true);
    try {
      const res = await api.summarizeThread(threadId);
      if (selectedThread && selectedThread.id === threadId) {
        setSelectedThread({ ...selectedThread, ai_summary: res.summary });
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Summarization failed');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCreateDraftReply = async (threadId: string) => {
    setIsDrafting(true);
    try {
      const draft = await api.draftReply(threadId, draftInstructions || undefined);
      setActiveDraft(draft);
      setDraftInstructions('');
      loadData();
      showToast('AI draft generated! Review and approve before sending.');
    } catch (err: any) {
      alert(err.message || 'Draft generation failed');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleUpdateDraft = async () => {
    if (!activeDraft) return;
    try {
      const updated = await api.updateDraft(activeDraft.id, {
        recipient: activeDraft.recipient,
        subject: activeDraft.subject,
        body: activeDraft.body,
      });
      setActiveDraft(updated);
      showToast('Draft saved.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save draft');
    }
  };

  const handleConfirmSend = async () => {
    if (!activeDraft) return;
    setIsSending(true);
    try {
      await api.sendDraft(activeDraft.id);
      setShowApprovalModal(false);
      setActiveDraft(null);
      showToast('Email successfully sent after explicit authorization!');
      loadData();
      if (selectedThread) {
        const refreshed = await api.getGmailThread(selectedThread.id);
        setSelectedThread(refreshed);
      }
    } catch (err: any) {
      alert(err.message || 'Send rejected');
    } finally {
      setIsSending(false);
    }
  };

  const handleDiscardDraft = async (id: string) => {
    try {
      await api.discardDraft(id);
      if (activeDraft?.id === id) setActiveDraft(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to discard draft');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Threads & Drafts List */}
        <div className="w-80 md:w-96 border-r border-slate-800 flex flex-col bg-slate-950/60">
          <div className="p-3.5 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                Gmail Inbox
              </div>
              <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50">
                Connected
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages, senders, topics..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {threads.map((t) => {
              const isSelected = selectedThread?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedThread(t)}
                  className={`p-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-900 border-l-2 border-blue-500' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {t.from_name}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium truncate mb-0.5">
                    {t.subject}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">
                    {t.snippet}
                  </div>
                  {t.ai_summary && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Brief Ready</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pending Drafts Section */}
            {drafts.length > 0 && (
              <div className="p-3 bg-slate-950 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Unsent Drafts ({drafts.length})
                </div>
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setActiveDraft(d)}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer mb-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span className="truncate">{d.subject}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${d.status === 'sent' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">To: {d.recipient}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Thread Detail & AI Assistant Panel */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {selectedThread ? (
            <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-lg font-bold text-white">{selectedThread.subject}</h1>
                  <div className="text-xs text-slate-400 mt-1">
                    From: <strong className="text-slate-200">{selectedThread.from_name}</strong> ({selectedThread.from})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSummarize(selectedThread.id)}
                    disabled={isSummarizing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-medium text-indigo-300 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isSummarizing ? 'Summarizing...' : 'Summarize Thread'}</span>
                  </button>
                </div>
              </div>

              {/* AI Executive Summary Card */}
              {selectedThread.ai_summary && (
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI Executive Summary
                  </div>
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedThread.ai_summary}
                  </div>
                </div>
              )}

              {/* Messages in Thread */}
              <div className="space-y-4">
                {selectedThread.messages.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                      <div className="font-semibold text-slate-200">{m.from_name}</div>
                      <div>{new Date(m.date).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate AI Draft Reply Box */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  Generate AI Reply Draft
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draftInstructions}
                    onChange={(e) => setDraftInstructions(e.target.value)}
                    placeholder="Instructions (e.g. Agree to increase the member allowance to $25 and propose meeting Thursday 2pm)"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleCreateDraftReply(selectedThread.id)}
                    disabled={isDrafting}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-md disabled:bg-slate-800"
                  >
                    {isDrafting ? 'Drafting...' : 'Draft Reply'}
                  </button>
                </div>
              </div>

              {/* Active Draft Reviewer */}
              {activeDraft && (
                <div className="p-5 rounded-2xl bg-slate-900/95 border-2 border-blue-500/40 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Review Editable Draft
                    </div>
                    <span className="text-[11px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/50">
                      Approval Required Before Sending
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Recipient</label>
                      <input
                        type="text"
                        value={activeDraft.recipient}
                        onChange={(e) => setActiveDraft({ ...activeDraft, recipient: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Subject</label>
                      <input
                        type="text"
                        value={activeDraft.subject}
                        onChange={(e) => setActiveDraft({ ...activeDraft, subject: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Body</label>
                      <textarea
                        rows={7}
                        value={activeDraft.body}
                        onChange={(e) => setActiveDraft({ ...activeDraft, body: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500 resize-none font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleDiscardDraft(activeDraft.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard Draft</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUpdateDraft}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                      >
                        Save Edits
                      </button>

                      {/* Explicit Approval & Send Button */}
                      <button
                        onClick={() => setShowApprovalModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Approve & Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Mail className="w-12 h-12 text-slate-400 mb-3" />
              <p className="text-sm">Select an email thread from the inbox to read, summarize, or draft a reply.</p>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Approval Security Confirmation Modal */}
      {showApprovalModal && activeDraft && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-bold text-white">Explicit Send Authorization</h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              OmniDesk security policy prevents autonomous email sending by models. You are authorizing the immediate transmission of this email to:
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div><strong className="text-slate-400">To:</strong> {activeDraft.recipient}</div>
              <div><strong className="text-slate-400">Subject:</strong> {activeDraft.subject}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel Review
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSend}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                {isSending ? 'Sending...' : 'Confirm & Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
