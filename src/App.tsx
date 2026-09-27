/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import type {
  User,
  Conversation,
  ChatMessage,
  ModelInfo,
  UsageSummary,
  Document,
  DocumentCollection,
} from '../shared/types.js';
import { api } from './api/client.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { ChatView } from './components/ChatView.js';
import { KnowledgeBaseView } from './components/KnowledgeBaseView.js';
import { GmailView } from './components/GmailView.js';
import { UsageView } from './components/UsageView.js';
import { AdminView } from './components/AdminView.js';
import { InviteModal } from './components/InviteModal.js';
import { ArenaView } from './components/ArenaView.js';
import { EvalsView } from './components/EvalsView.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [currentView, setCurrentView] = useState<string>('arena');

  // Models & Providers
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);

  // Conversations & Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Feature Toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(true);

  // Usage & Quotas
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  // Knowledge Base Documents & Collections
  const [documents, setDocuments] = useState<Document[]>([]);
  const [collections, setCollections] = useState<DocumentCollection[]>([]);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Initial Load
  const initApp = async () => {
    try {
      const [authData, modelList, convList, usageData, docList, colList] = await Promise.all([
        api.getMe(),
        api.getModels(),
        api.getConversations(),
        api.getUsage(),
        api.getDocuments(),
        api.getCollections(),
      ]);

      setCurrentUser(authData.user);
      setAvailableUsers(authData.availableUsers);
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0]);
      }

      setConversations(convList);
      setUsageSummary(usageData);
      setDocuments(docList);
      setCollections(colList);

      if (convList.length > 0) {
        selectConversation(convList[0].id);
      } else {
        createNewConversation();
      }
    } catch (err) {
      console.error('Failed to initialize OmniDesk:', err);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const selectConversation = async (convId: string) => {
    try {
      setActiveConversationId(convId);
      const data = await api.getConversation(convId);
      setActiveMessages(data.messages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const createNewConversation = async () => {
    try {
      const newConv = await api.createConversation('New Conversation');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setActiveMessages([]);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      await api.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          createNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      await api.switchUser(userId);
      await initApp();
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !selectedModel || isStreaming) return;

    // Immediately push optimistic user message
    const tempUserMsg: ChatMessage = {
      id: 'tmp_usr_' + Date.now(),
      conversation_id: activeConversationId,
      user_id: currentUser?.id || 'usr_owner_giri',
      role: 'user',
      content,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    // Placeholder streaming assistant message
    const tempAssistantMsg: ChatMessage = {
      id: 'tmp_ast_' + Date.now(),
      conversation_id: activeConversationId,
      user_id: currentUser?.id || 'usr_owner_giri',
      role: 'assistant',
      content: '',
      provider: selectedModel.provider,
      model_key: selectedModel.model_key,
      model_name: selectedModel.display_name,
      status: 'streaming',
      created_at: new Date().toISOString(),
    };

    setActiveMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsStreaming(true);

    try {
      await api.streamMessage(
        activeConversationId,
        {
          provider: selectedModel.provider,
          model: selectedModel.model_key,
          content,
          options: {
            webSearch: webSearchEnabled,
            useKnowledgeBase: knowledgeBaseEnabled,
          },
        },
        {
          onStart: (data) => {
            setActiveMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.citations = data.citations;
                last.search_results = data.searchResults;
              }
              return updated;
            });
          },
          onDelta: (delta) => {
            setActiveMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.content += delta;
              }
              return updated;
            });
          },
          onUsage: (usageData) => {
            setActiveMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.cost_micro_usd = usageData.costMicroUsd;
                last.input_tokens = usageData.inputTokens;
                last.output_tokens = usageData.outputTokens;
              }
              return updated;
            });
          },
          onDone: (finalMsg) => {
            setActiveMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = finalMsg;
              return updated;
            });
            setIsStreaming(false);

            // Refresh conversations and usage balances
            api.getConversations().then(setConversations).catch(console.error);
            api.getUsage().then(setUsageSummary).catch(console.error);
          },
          onError: (errMsg) => {
            setActiveMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                last.status = 'failed';
                last.content = last.content || `Request failed: ${errMsg}`;
              }
              return updated;
            });
            setIsStreaming(false);
          },
        }
      );
    } catch (err: any) {
      console.error('Chat error:', err);
      setIsStreaming(false);
    }
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setCurrentView('chat');
          selectConversation(id);
        }}
        onNewConversation={() => {
          setCurrentView('chat');
          createNewConversation();
        }}
        onDeleteConversation={deleteConversation}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSwitchUser={handleSwitchUser}
        onOpenInviteModal={() => setInviteModalOpen(true)}
      />

      {/* Main Workspace Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          currentView={currentView}
          currentUser={currentUser}
          selectedModel={selectedModel}
          models={models}
          onSelectModel={setSelectedModel}
          webSearchEnabled={webSearchEnabled}
          onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
          knowledgeBaseEnabled={knowledgeBaseEnabled}
          onToggleKnowledgeBase={() => setKnowledgeBaseEnabled(!knowledgeBaseEnabled)}
          usageSummary={usageSummary}
        />

        {/* View Routing */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {currentView === 'arena' && <ArenaView models={models} />}

          {currentView === 'evals' && <EvalsView models={models} />}

          {currentView === 'chat' && (
            <ChatView
              conversation={activeConv}
              messages={activeMessages}
              selectedModel={selectedModel}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              onStopStreaming={handleStopStreaming}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
              knowledgeBaseEnabled={knowledgeBaseEnabled}
              onToggleKnowledgeBase={() => setKnowledgeBaseEnabled(!knowledgeBaseEnabled)}
              onNewConversation={createNewConversation}
            />
          )}

          {currentView === 'kb' && (
            <KnowledgeBaseView
              documents={documents}
              collections={collections}
              onRefresh={() => {
                api.getDocuments().then(setDocuments).catch(console.error);
                api.getCollections().then(setCollections).catch(console.error);
              }}
            />
          )}

          {currentView === 'gmail' && <GmailView />}

          {currentView === 'usage' && (
            <UsageView
              usageSummary={usageSummary}
              onRefresh={() => {
                api.getUsage().then(setUsageSummary).catch(console.error);
              }}
            />
          )}

          {currentView === 'admin' && (
            <AdminView
              onRefresh={() => {
                api.getUsage().then(setUsageSummary).catch(console.error);
                api.getModels().then(setModels).catch(console.error);
              }}
            />
          )}
        </main>
      </div>

      {/* Invite Code Redemption Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSuccess={() => initApp()}
      />
    </div>
  );
}
