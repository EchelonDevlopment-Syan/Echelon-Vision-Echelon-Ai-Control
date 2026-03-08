
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { GeneratedImage } from '../types';
import { X, History, Trash2, Calendar, Clock, ExternalLink, Video } from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: GeneratedImage[];
  onRestore: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onRestore, 
  onDelete, 
  onClear 
}) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 z-[110] h-full w-full max-sm bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-500 ease-out border-l border-slate-200 dark:border-white/10 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                <History className="w-5 h-5" />
              </div>
              <h2 className="font-display font-bold text-lg dark:text-white">Research History</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                  <History className="w-8 h-8 opacity-20" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">No history yet</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your visual research will appear here for quick access.</p>
                </div>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  className="group relative bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden hover:border-cyan-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  onClick={() => onRestore(item)}
                >
                  <div className="flex gap-4 p-3">
                    <div className="w-24 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.type === 'image' ? (
                        <img src={item.data} alt={item.prompt} className="w-full h-full object-cover" />
                      ) : (
                        <Video className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-6">{item.prompt}</h4>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.timestamp).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-md transition-all shadow-sm"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="absolute bottom-2 right-2 text-[10px] text-cyan-600 dark:text-cyan-400 font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    RESTORE <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50">
              <button 
                onClick={onClear}
                className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-red-500 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                CLEAR ALL HISTORY
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
