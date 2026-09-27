import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Users,
  DollarSign,
  Shield,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  FileText,
} from 'lucide-react';
import type {
  ProviderId,
  Invitation,
  User,
  AuditLog,
  ModelInfo,
} from '../../shared/types.js';
import { api } from '../api/client.js';

interface AdminViewProps {
  onRefresh: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'users' | 'budgets' | 'models' | 'audit'>('providers');

  // Provider Vault State
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProviderToEdit, setSelectedProviderToEdit] = useState<ProviderId | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

  // Users & Invitations
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'owner'>('member');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Budgets & Quotas
  const [budgetConfig, setBudgetConfig] = useState<any>(null);
  const [userQuotas, setUserQuotas] = useState<any[]>([]);
  const [groupBudgetUsd, setGroupBudgetUsd] = useState('50.00');
  const [memberAllowanceUsd, setMemberAllowanceUsd] = useState('10.00');

  // Models & Audit
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadAll = async () => {
    try {
      const [provs, usrList, invList, bData, qData, mData, logs] = await Promise.all([
        api.getAdminProviders(),
        api.getAdminUsers(),
        api.getAdminInvitations(),
        api.getAdminBudgets(),
        api.getAdminQuotas(),
        api.getModels(),
        api.getAdminAuditLogs(),
      ]);
      setProviders(provs);
      setUsers(usrList);
      setInvitations(invList);
      setBudgetConfig(bData.config);
      setGroupBudgetUsd((bData.config.group_monthly_budget_micro_usd / 1_000_000).toFixed(2));
      setMemberAllowanceUsd((bData.config.member_monthly_allowance_micro_usd / 1_000_000).toFixed(2));
      setUserQuotas(qData);
      setModels(mData);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, [activeTab]);

  // Provider Actions
  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderToEdit || !apiKeyInput.trim()) return;

    try {
      await api.saveProviderCredential(selectedProviderToEdit, apiKeyInput.trim());
      setSelectedProviderToEdit(null);
      setApiKeyInput('');
      loadAll();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save credential');
    }
  };

  const handleTestProvider = async (provider: ProviderId) => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await api.testProviderCredential(provider);
      setTestResult({ provider, success: res.success, message: res.message });
      loadAll();
    } catch (err: any) {
      setTestResult({ provider, success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleRemoveProvider = async (provider: ProviderId) => {
    if (!confirm(`Are you sure you want to clear credentials for ${provider}?`)) return;
    try {
      await api.removeProviderCredential(provider);
      loadAll();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove');
    }
  };

  // Invitation Actions
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      await api.createInvitation(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create invitation');
    }
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      await api.revokeInvitation(id);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // User Actions
  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateAdminUser(user.id, { status: newStatus });
      loadAll();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  };

  // Budget Actions
  const handleSaveBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAdminBudgets({
        group_monthly_budget_micro_usd: Math.round(parseFloat(groupBudgetUsd) * 1_000_000),
        member_monthly_allowance_micro_usd: Math.round(parseFloat(memberAllowanceUsd) * 1_000_000),
      });
      alert('Budgets updated successfully.');
      loadAll();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save budgets');
    }
  };

  // Model Toggle
  const handleToggleModel = async (modelId: string, currentEnabled: boolean) => {
    try {
      await api.toggleModel(modelId, !currentEnabled);
      loadAll();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle model');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-y-auto">
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-amber-400" />
              Owner Governance & Administration
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Encrypted shared credential vault, invite-only onboarding, strict budget limits, and audit logs.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/40 text-xs font-mono font-medium self-start sm:self-auto">
            Role: Workspace Owner
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'providers', label: 'Provider Credentials', icon: Key },
            { id: 'users', label: 'Members & Invitations', icon: Users },
            { id: 'budgets', label: 'Free Credits & Quotas', icon: DollarSign },
            { id: 'models', label: 'Model Registry', icon: Sliders },
            { id: 'audit', label: 'Security Audit Logs', icon: Shield },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Shared Provider Credentials Vault */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-300 leading-relaxed">
              <strong>Zero-Leak Architecture:</strong> All API keys are securely stored server-side. Members never see or export credentials. Charges are tracked in micro-USD and billed directly to your provider accounts.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => {
                const isTested = testResult?.provider === p.provider;
                return (
                  <div
                    key={p.provider}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                          <h2 className="text-sm font-bold text-white capitalize">
                            {p.provider === 'google' ? 'Google Gemini' : p.provider === 'openai' ? 'OpenAI GPT' : p.provider === 'anthropic' ? 'Anthropic Claude' : 'xAI Grok'}
                          </h2>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                            p.has_key
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.has_key ? 'Active & Ready' : 'Unconfigured'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 mb-4 font-mono">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Masked Key:</span>
                          <span className="text-slate-200">{p.masked_key}</span>
                        </div>
                        {p.last_tested && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Last Verified:</span>
                            <span>{new Date(p.last_tested).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </div>

                      {isTested && (
                        <div className={`p-2.5 rounded-lg mb-3 text-xs flex items-center gap-2 ${testResult?.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50' : 'bg-red-950/60 text-red-300 border border-red-800/50'}`}>
                          {testResult?.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                          <span>{testResult?.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleTestProvider(p.provider)}
                        disabled={testingProvider === p.provider}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${testingProvider === p.provider ? 'animate-spin' : ''}`} />
                        <span>{testingProvider === p.provider ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {p.has_key && p.provider !== 'google' && (
                          <button
                            onClick={() => handleRemoveProvider(p.provider)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            title="Remove key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedProviderToEdit(p.provider);
                            setApiKeyInput('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
                        >
                          {p.has_key ? 'Rotate Key' : 'Configure Key'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Members & Invitations */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Create Invitation Form */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                Invite New Member (Single-Use Token, 48-Hour Expiry)
              </h2>

              <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
                />

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="member">Member Role</option>
                  <option value="owner">Owner Role</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md transition-colors"
                >
                  Generate Invitation
                </button>
              </form>
            </div>

            {/* Pending Invitations Table */}
            {invitations.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Active & Pending Invitations ({invitations.length})
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Invitee Email</th>
                        <th className="py-2.5 px-3">Invite Code</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Expires At</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {invitations.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2.5 px-3 font-medium text-white">{inv.email}</td>
                          <td className="py-2.5 px-3 font-mono text-blue-400 font-semibold">
                            <span className="flex items-center gap-1.5">
                              {inv.invite_code}
                              <button
                                onClick={() => copyInviteCode(inv.invite_code)}
                                className="text-slate-400 hover:text-white p-0.5 rounded"
                                title="Copy code"
                              >
                                {copiedCode === inv.invite_code ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 capitalize">{inv.role}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${inv.status === 'accepted' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Registered Users Table */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Workspace Accounts ({users.length})
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Created</th>
                      <th className="py-2.5 px-3 text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            <div>
                              <div className="font-semibold text-white">{u.display_name}</div>
                              <div className="text-[11px] text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 capitalize font-mono">{u.role}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${u.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {u.role !== 'owner' && (
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                u.status === 'active'
                                  ? 'bg-red-950/60 text-red-400 hover:bg-red-900/60'
                                  : 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60'
                              }`}
                            >
                              {u.status === 'active' ? 'Disable Account' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Free Credits & Quotas */}
        {activeTab === 'budgets' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveBudgets} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Workspace Free Credit Policies & Allowances
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Group Monthly Free Credit Pool
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="10000"
                      value={Math.round(parseFloat(groupBudgetUsd) * 10000)}
                      onChange={(e) => setGroupBudgetUsd((parseFloat(e.target.value) / 10000).toString())}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Default: 500,000 free credits / month across all members
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Standard Member Monthly Free Allowance
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="1000"
                      value={Math.round(parseFloat(memberAllowanceUsd) * 10000)}
                      onChange={(e) => setMemberAllowanceUsd((parseFloat(e.target.value) / 10000).toString())}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Default: 100,000 free credits / month per individual member
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md transition-colors"
                >
                  Save Credit Policies
                </button>
              </div>
            </form>

            {/* Individual Quota Overrides */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Individual Member Credit Allowances
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Monthly Allowance</th>
                      <th className="py-2.5 px-3">Current Usage</th>
                      <th className="py-2.5 px-3 text-right">Customize</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {userQuotas.map((uq) => (
                      <tr key={uq.userId}>
                        <td className="py-2.5 px-3 font-medium text-white">{uq.displayName}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                          {Math.round(uq.allowanceMicroUsd / 100).toLocaleString()} credits
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {Math.round(uq.currentUsageMicroUsd / 100).toLocaleString()} credits
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={async () => {
                              const promptVal = prompt(
                                `Set custom monthly free credits for ${uq.displayName}:`,
                                Math.round(uq.allowanceMicroUsd / 100).toString()
                              );
                              if (promptVal !== null) {
                                const parsed = parseFloat(promptVal);
                                if (!isNaN(parsed) && parsed > 0) {
                                  await api.updateAdminQuota(uq.userId, Math.round(parsed * 100));
                                  loadAll();
                                  onRefresh();
                                }
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Set Custom
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Model Registry */}
        {activeTab === 'models' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              Enable or disable models across the workspace. Pricing is versioned in integer micro-USD.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <span>{m.display_name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-slate-800 text-slate-300">
                        {m.provider}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {m.description}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono mt-2 space-x-2">
                      <span>In: ${(m.input_price_per_million / 1_000_000).toFixed(2)}/1M</span>
                      <span>·</span>
                      <span>Out: ${(m.output_price_per_million / 1_000_000).toFixed(2)}/1M</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleModel(m.id, m.enabled)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      m.enabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {m.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Security Audit Logs */}
        {activeTab === 'audit' && (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Append-Only Security Audit Trail ({auditLogs.length})
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Zero Sensitive Payloads Stored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Resource</th>
                    <th className="py-2.5 px-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white">{log.actor_email}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-400">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {log.resource_type}:{log.resource_id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Configure Provider Key Modal */}
      {selectedProviderToEdit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white capitalize">
              Configure {selectedProviderToEdit} Shared API Key
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed">
              Paste your organization's API key for {selectedProviderToEdit}. The key is encrypted server-side and never returned to browser clients.
            </p>

            <form onSubmit={handleSaveCredential} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  API Key Secret
                </label>
                <input
                  type="password"
                  required
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={`sk-... or key for ${selectedProviderToEdit}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProviderToEdit(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Save & Encrypt Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
