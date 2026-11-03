import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Search, X, Folder, Zap, Loader2 } from 'lucide-react';
import { SupportBadge } from '../common/SupportBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { searchApi, SearchResultItem } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { issues, projects, epics, users } = useApp();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setRemoteResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await searchApi.search({ q: trimmed, limit: 15 });
        if (response && Array.isArray(response.results)) {
          setRemoteResults(response.results);
        }
      } catch (err) {
        // Fallback gracefully to local in-memory index
        console.warn('[GlobalSearchModal] Remote search failed, falling back to local memory index:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  // Combine local and remote issue matches, deduplicated by ID
  const localMatchingIssues = trimmed
    ? issues.filter(issue => {
        const idMatch = issue.id.toLowerCase().includes(trimmed);
        const titleMatch = issue.title.toLowerCase().includes(trimmed);
        const descMatch = issue.description.toLowerCase().includes(trimmed);
        const labelMatch = issue.labels.some(l => l.toLowerCase().includes(trimmed));
        const assignee = users.find(u => u.id === issue.assigneeId);
        const assigneeMatch = assignee?.name.toLowerCase().includes(trimmed);
        const project = projects.find(p => p.id === issue.projectId);
        const projectMatch = project?.name.toLowerCase().includes(trimmed) || project?.key.toLowerCase().includes(trimmed);
        return idMatch || titleMatch || descMatch || labelMatch || assigneeMatch || projectMatch;
      })
    : [];

  const remoteIssues = remoteResults
    .filter(r => r.type === 'issue')
    .map(r => {
      const existing = issues.find(i => i.id === r.id);
      if (existing) return existing;
      return {
        id: r.id,
        title: r.title,
        description: r.subtitle || '',
        status: (r.status as any) || 'Open',
        priority: (r.priority as any) || 'Medium',
        supportLevel: 'L1' as const,
        projectId: r.projectId || 'proj-1',
        labels: [],
        reporterId: 'usr-1',
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };
    });

  const matchingIssues = Array.from(
    new Map([...localMatchingIssues, ...remoteIssues].map(item => [item.id, item])).values()
  ).slice(0, 10);

  const localMatchingProjects = trimmed
    ? projects.filter(p => p.name.toLowerCase().includes(trimmed) || p.key.toLowerCase().includes(trimmed))
    : [];
  const remoteProjects = remoteResults
    .filter(r => r.type === 'project')
    .map(r => {
      const existing = projects.find(p => p.id === r.id);
      if (existing) return existing;
      return {
        id: r.id,
        name: r.title,
        key: r.subtitle || r.id,
        description: '',
        color: '#3b82f6',
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };
    });
  const matchingProjects = Array.from(
    new Map([...localMatchingProjects, ...remoteProjects].map(item => [item.id, item])).values()
  ).slice(0, 5);

  const localMatchingEpics = trimmed
    ? epics.filter(e => e.name.toLowerCase().includes(trimmed) || e.description.toLowerCase().includes(trimmed))
    : [];
  const remoteEpics = remoteResults
    .filter(r => r.type === 'epic')
    .map(r => {
      const existing = epics.find(e => e.id === r.id);
      if (existing) return existing;
      return {
        id: r.id,
        name: r.title,
        description: r.subtitle || '',
        status: (r.status as any) || 'To Do',
        color: '#8b5cf6',
        projectId: r.projectId || 'proj-1',
      };
    });
  const matchingEpics = Array.from(
    new Map([...localMatchingEpics, ...remoteEpics].map(item => [item.id, item])).values()
  ).slice(0, 5);

  const handleSelectIssue = (id: string) => {
    navigate(`/issues/${id}`);
    onClose();
  };

  const handleSelectProject = (id: string) => {
    navigate(`/projects/${id}`);
    onClose();
  };

  const handleSelectEpic = () => {
    navigate('/epics');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tickets by ID (INB-1024), keywords, labels, projects, epics..."
            className="flex-1 text-sm bg-transparent border-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          {isSearching && (
            <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {!trimmed && (
            <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
              <p className="text-xs">Type a keyword, ticket ID like <span className="font-mono font-semibold text-blue-600">INB-1002</span>, or project name.</p>
            </div>
          )}

          {trimmed && matchingIssues.length === 0 && matchingProjects.length === 0 && matchingEpics.length === 0 && (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
              <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1">Try searching by ticket ID (e.g. INB-1001), team member name, or label.</p>
            </div>
          )}

          {/* Issues Section */}
          {matchingIssues.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Issues ({matchingIssues.length})
              </div>
              <div className="space-y-1 mt-1">
                {matchingIssues.map(issue => (
                  <button
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {issue.id}
                      </span>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <SupportBadge level={issue.supportLevel} size="sm" showLabel={false} />
                      <PriorityBadge priority={issue.priority} size="sm" showText={false} />
                      <StatusBadge status={issue.status} size="sm" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {matchingProjects.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Projects
              </div>
              <div className="space-y-1 mt-1">
                {matchingProjects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition flex items-center gap-2.5"
                  >
                    <Folder size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {project.name}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">({project.key})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Epics Section */}
          {matchingEpics.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Epics
              </div>
              <div className="space-y-1 mt-1">
                {matchingEpics.map(epic => (
                  <button
                    key={epic.id}
                    onClick={handleSelectEpic}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition flex items-center gap-2.5"
                  >
                    <Zap size={14} className="text-purple-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {epic.name}
                    </span>
                    <span className="text-xs text-zinc-400 truncate">{epic.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
          <span>Press <kbd className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-300">Enter</kbd> to select</span>
          <span>Global Realtime Index</span>
        </div>
      </div>
    </div>
  );
};
