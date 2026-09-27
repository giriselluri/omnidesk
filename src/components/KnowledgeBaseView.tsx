import React, { useState } from 'react';
import {
  BookOpen,
  FolderPlus,
  Upload,
  FileText,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { Document, DocumentCollection, Citation } from '../../shared/types.js';
import { api } from '../api/client.js';

interface KnowledgeBaseViewProps {
  documents: Document[];
  collections: DocumentCollection[];
  onRefresh: () => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  collections,
  onRefresh,
}) => {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);

  // Form states for upload
  const [newDocFilename, setNewDocFilename] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocCollection, setNewDocCollection] = useState<string>('');

  // Form state for collection
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Retrieval sandbox
  const [testQuery, setTestQuery] = useState('');
  const [retrievalResults, setRetrievalResults] = useState<{ context: string; citations: Citation[] } | null>(null);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const filteredDocs = documents.filter((doc) => {
    const matchesCollection = selectedCollectionId ? doc.collection_ids.includes(selectedCollectionId) : true;
    const matchesSearch = searchFilter
      ? doc.filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
        doc.summary?.toLowerCase().includes(searchFilter.toLowerCase())
      : true;
    return matchesCollection && matchesSearch;
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocFilename.trim() || !newDocContent.trim()) return;

    setIsUploading(true);
    try {
      await api.uploadDocument({
        filename: newDocFilename.trim(),
        content: newDocContent.trim(),
        collection_ids: newDocCollection ? [newDocCollection] : [],
      });
      setShowUploadModal(false);
      setNewDocFilename('');
      setNewDocContent('');
      setNewDocCollection('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      await api.createCollection({
        name: newColName.trim(),
        description: newColDesc.trim(),
      });
      setShowCreateCollectionModal(false);
      setNewColName('');
      setNewColDesc('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to create collection');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document and its chunk embeddings?')) return;
    try {
      await api.deleteDocument(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleTestRetrieval = async () => {
    if (!testQuery.trim()) return;
    setIsRetrieving(true);
    try {
      const res = await api.uploadDocument ? await fetch('/api/v1/documents/retrieval/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, collectionIds: selectedCollectionId ? [selectedCollectionId] : undefined }),
      }).then((r) => r.json()) : null;

      setRetrievalResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRetrieving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-y-auto">
      {/* Top Banner */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Private Knowledge Base (RAG)
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload documents, chunk texts into dense passages, and ground multi-model queries with verifiable citations.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreateCollectionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span>New Collection</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-lg shadow-blue-600/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Collections Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCollectionId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              selectedCollectionId === null
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Collections ({documents.length})
          </button>
          {collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            return (
              <button
                key={col.id}
                onClick={() => setSelectedCollectionId(col.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{col.name}</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-400 font-mono">
                  {col.document_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Documents Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">
              Indexed Documents ({filteredDocs.length})
            </h2>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-slate-200 font-medium text-xs truncate">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate">{doc.filename}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                    {doc.summary || 'Document ready for retrieval-augmented generation.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>{doc.chunk_count} chunks</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Ready</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive RAG Retrieval Testing Sandbox */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                RAG Retrieval Inspection Sandbox
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Simulate vector similarity and lexical matching directly against indexed chunks.
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestRetrieval()}
              placeholder="e.g. How does OmniDesk calculate atomic quota reservations?"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleTestRetrieval}
              disabled={isRetrieving || !testQuery.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-medium transition-colors"
            >
              {isRetrieving ? 'Retrieving...' : 'Test Retrieval'}
            </button>
          </div>

          {retrievalResults && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                Retrieved Citations ({retrievalResults.citations.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {retrievalResults.citations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-left text-xs"
                  >
                    <div className="flex items-center justify-between text-blue-400 font-medium mb-1">
                      <span className="truncate">{cite.document_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Score: {cite.score}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed italic line-clamp-3">
                      "{cite.snippet}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Upload New Document</h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Document Filename
                </label>
                <input
                  type="text"
                  required
                  value={newDocFilename}
                  onChange={(e) => setNewDocFilename(e.target.value)}
                  placeholder="e.g. Q4_Executive_Brief.pdf"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Collection (Optional)
                </label>
                <select
                  value={newDocCollection}
                  onChange={(e) => setNewDocCollection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">None (Uncategorized)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Document Content (Extracted Text / Markdown)
                </label>
                <textarea
                  required
                  rows={6}
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Paste text contents from PDF, DOCX, or Markdown notes..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors shadow-md"
                >
                  {isUploading ? 'Chunking & Indexing...' : 'Index Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Create New Collection</h2>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Legal & Contracts"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Brief description of documents stored here..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCollectionModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors shadow-md"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
