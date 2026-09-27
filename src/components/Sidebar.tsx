import React, { useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  Mail,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Pin,
  ChevronRight,
  UserCheck,
  Sparkles,
  Ticket,
  ChevronDown,
  Swords,
  ShieldCheck,
} from 'lucide-react';
import type { Conversation, User } from '../../shared/types.js';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  currentUser: User | null;
  availableUsers: User[];
  onSwitchUser: (userId: string) => void;
  onOpenInviteModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onChangeView,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  currentUser,
  availableUsers,
  onSwitchUser,
  onOpenInviteModal,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'arena', label: 'Model Arena', icon: Swords },
    { id: 'evals', label: 'AI Evals & Workbench', icon: ShieldCheck },
    { id: 'chat', label: 'Chat Workspace', icon: MessageSquare },
    { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
    { id: 'gmail', label: 'Gmail Assistant', icon: Mail },
    { id: 'usage', label: 'Free Credits & Usage', icon: BarChart3 },
    { id: 'admin', label: 'Admin Console', icon: Settings, roleRequired: 'owner' },
  ];

  return (
    <aside className="w-64 h-screen bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div>
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                OmniDesk
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-1 py-0.2 rounded font-mono font-medium">Free</span>
              </div>
              <div className="text-[11px] text-slate-400">100% Free Workspace</div>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isOwnerOnly = item.roleRequired === 'owner';
            const isOwner = currentUser?.role === 'owner';

            // Show admin tab or indicate it's owner only
            if (isOwnerOnly && !isOwner) {
              return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.id === 'admin' && (
                  <span className="text-[10px] text-amber-400 font-mono">Owner</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Conversations List inside Chat view */}
        {currentView === 'chat' && (
          <div className="mt-2 px-2">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Conversations
              </span>
              <button
                onClick={onNewConversation}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-blue-400 hover:bg-blue-950/60 transition-colors"
                title="Start new conversation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {conversations.length === 0 ? (
                <div className="text-xs text-slate-400 px-2 py-3 text-center">
                  No conversations yet. Start one!
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800 text-white font-medium border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="truncate pr-2 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="p-1 rounded hover:bg-slate-700/80 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom User Profile & Switcher */}
      <div className="p-3 border-t border-slate-800/80 relative">
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 transition-colors border border-slate-800"
          aria-haspopup="true"
          aria-expanded={userDropdownOpen}
        >
          <div className="flex items-center gap-2.5 text-left truncate">
            <img
              src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
              alt={currentUser?.display_name || 'User'}
              className="w-7 h-7 rounded-full object-cover border border-slate-700"
            />
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {currentUser?.display_name || 'User'}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="capitalize">{currentUser?.role}</span>
                <span>·</span>
                <span className="text-emerald-400">Active</span>
              </div>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {/* User Switcher Dropdown */}
        {userDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setUserDropdownOpen(false)}
            />
            <div className="absolute bottom-16 left-3 right-3 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-40 space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Test Account
              </div>

              {availableUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      onSwitchUser(u.id);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                      isCurrent
                        ? 'bg-blue-600/15 border border-blue-500/30 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-left truncate">
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <div className="truncate">
                        <div>{u.display_name}</div>
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${u.role === 'owner' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/40' : 'bg-slate-800 text-slate-400'}`}>
                      {u.role}
                    </span>
                  </button>
                );
              })}

              <div className="pt-1 border-t border-slate-800 mt-1">
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onOpenInviteModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-950/40 transition-colors"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Redeem Invite Code</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
