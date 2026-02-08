/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { GeneratedImage, ComplexityLevel, VisualStyle, Language, SearchResultItem, FileAttachment } from './types';
import { 
  researchTopicForPrompt, 
  generateInfographicImage, 
  editInfographicImage,
} from './services/geminiService';
import Infographic from './components/Infographic';
import Loading from './components/Loading';
import IntroScreen from './components/IntroScreen';
import SearchResults from './components/SearchResults';
import SnowEffect from './components/SnowEffect';
import HistorySidebar from './components/HistorySidebar';
import { Search, AlertCircle, History, GraduationCap, Palette, Microscope, Atom, Compass, Globe, Sun, Moon, Key, CreditCard, ExternalLink, DollarSign, Snowflake, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

const STORAGE_KEY = 'echelon_vision_history';

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [topic, setTopic] = useState('');
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [complexityLevel, setComplexityLevel] = useState<ComplexityLevel>('High School');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('Default');
  const [language, setLanguage] = useState<Language>('English');
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [loadingFacts, setLoadingFacts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResultItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSnowing, setIsSnowing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load history from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setImageHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imageHistory));
  }, [imageHistory]);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      } finally {
        setCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
        setError(null);
      } catch (e) {
        console.error("Failed to open key selector:", e);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAttachment({
        data: base64,
        mimeType: file.type,
        name: file.name
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!topic.trim() && !attachment) {
        setError("Please enter a topic or upload a slide to visualize.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStep(1);
    setLoadingFacts([]);
    setCurrentSearchResults([]);
    setLoadingMessage(attachment ? `Analyzing provided content...` : `Researching topic...`);

    try {
      const researchResult = await researchTopicForPrompt(topic, complexityLevel, visualStyle, language, attachment || undefined);
      
      setLoadingFacts(researchResult.facts);
      setCurrentSearchResults(researchResult.searchResults);
      
      setLoadingStep(2);
      setLoadingMessage(`Synthesizing Echelon Visual...`);
      
      let base64Data = await generateInfographicImage(researchResult.imagePrompt);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        data: base64Data,
        prompt: topic || attachment?.name || "Echelon Synthesis",
        timestamp: Date.now(),
        level: complexityLevel,
        style: visualStyle,
        language: language,
        facts: researchResult.facts,
        searchResults: researchResult.searchResults
      };

      setImageHistory([newImage, ...imageHistory]);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("Requested entity was not found") || err.message.includes("404") || err.message.includes("403"))) {
          setError("Access denied. Please select a valid project with billing enabled.");
          setHasApiKey(false);
      } else {
          setError('Failed to process. Please try a different topic or file.');
      }
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleEdit = async (editPrompt: string) => {
    if (imageHistory.length === 0) return;
    const currentImage = imageHistory[0];
    setIsLoading(true);
    setError(null);
    setLoadingStep(2);
    setLoadingMessage(`Evolving Visual: "${editPrompt}"...`);

    try {
      const base64Data = await editInfographicImage(currentImage.data, editPrompt);
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        data: base64Data,
        prompt: editPrompt,
        timestamp: Date.now(),
        level: currentImage.level,
        style: currentImage.style,
        language: currentImage.language,
        facts: currentImage.facts,
        searchResults: currentImage.searchResults
      };
      setImageHistory([newImage, ...imageHistory]);
    } catch (err: any) {
      console.error(err);
      setError('Evolution failed. Try a different command.');
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const restoreImage = (img: GeneratedImage) => {
     // Reorder history to make selected one the current one
     const newHistory = imageHistory.filter(i => i.id !== img.id);
     setImageHistory([img, ...newHistory]);
     
     // Restore associated facts and search results to the main view
     setLoadingFacts(img.facts || []);
     setCurrentSearchResults(img.searchResults || []);
     
     // Set UI parameters to match restored item if applicable
     if (img.level) setComplexityLevel(img.level);
     if (img.style) setVisualStyle(img.style);
     if (img.language) setLanguage(img.language);
     
     // Close history if it was open
     setIsHistoryOpen(false);
  };

  const deleteFromHistory = (id: string) => {
    setImageHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      setImageHistory([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const KeySelectionModal = () => (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
            <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                    <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2 border-4 border-white dark:border-slate-900 shadow-lg">
                        <CreditCard className="w-8 h-8" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white dark:border-slate-900 uppercase tracking-wide">
                        Paid App
                    </div>
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Paid API Key Required</h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">This app uses premium Gemini models. Standard keys will not work.</p>
                </div>
                <button onClick={handleSelectKey} className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                    <Key className="w-4 h-4" />
                    <span>Select Paid API Key</span>
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <>
    {!checkingKey && !hasApiKey && <KeySelectionModal />}
    {isSnowing && <SnowEffect />}
    
    <HistorySidebar 
      isOpen={isHistoryOpen}
      onClose={() => setIsHistoryOpen(false)}
      history={imageHistory}
      onRestore={restoreImage}
      onDelete={deleteFromHistory}
      onClear={clearHistory}
    />

    {showIntro ? (
      <IntroScreen onComplete={() => setShowIntro(false)} />
    ) : (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-20 relative overflow-x-hidden animate-in fade-in duration-1000 transition-colors">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white dark:from-indigo-900 dark:via-slate-950 dark:to-black z-0 transition-colors"></div>
      
      <header className="border-b border-slate-200 dark:border-white/10 sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/60 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 group">
            <div className="relative scale-90 md:scale-100">
                <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20 dark:opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 relative z-10 shadow-sm dark:shadow-none">
                   <Atom className="w-6 h-6 text-cyan-600 dark:text-cyan-400 animate-[spin_10s_linear_infinite]" />
                </div>
            </div>
            <div className="flex flex-col">
                <span className="font-display font-bold text-lg md:text-2xl tracking-tight text-slate-900 dark:text-white leading-none">
                Echelon <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-400 dark:to-amber-400">Vision</span>
                </span>
                <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-medium">Visual Knowledge Engine</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsHistoryOpen(true)} 
                className={`p-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm transition-colors bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 relative`}
                title="Open History"
              >
                <History className="w-5 h-5" />
                {imageHistory.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-cyan-500 border-2 border-white dark:border-slate-800 rounded-full"></span>}
              </button>
              <button onClick={() => setIsSnowing(!isSnowing)} className={`p-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm transition-colors ${isSnowing ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Snowflake className="w-5 h-5" />
              </button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 shadow-sm">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 md:py-8 relative z-10">
        <div className={`max-w-6xl mx-auto transition-all duration-500 ${imageHistory.length > 0 ? 'mb-4 md:mb-8' : 'min-h-[50vh] md:min-h-[70vh] flex flex-col justify-center'}`}>
          {!imageHistory.length && (
            <div className="text-center mb-6 md:mb-16 space-y-3 md:space-y-8 animate-in slide-in-from-bottom-8 duration-700 fade-in">
              <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-300 text-[10px] md:text-xs font-bold tracking-widest uppercase shadow-sm">
                <Compass className="w-3 h-3 md:w-4 md:h-4" /> Analysis enabled for slides, documents, and topics.
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-8xl font-display font-bold text-slate-900 dark:text-white tracking-tight leading-[0.95] md:leading-[0.9]">
                Synthesize <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-indigo-400 dark:to-purple-400">Knowledge.</span>
              </h1>
              <p className="text-sm md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-light leading-relaxed px-4">
                Upload a slide or enter a topic to bring data to life with Echelon Vision.
              </p>
            </div>
          )}

          <form onSubmit={handleGenerate} className={`relative z-20 transition-all duration-300 ${isLoading ? 'opacity-50 pointer-events-none scale-95 blur-sm' : 'scale-100'}`}>
            <div className="relative group">
                <div className={`absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 rounded-3xl opacity-10 dark:opacity-20 transition duration-500 blur-xl ${attachment ? 'opacity-40' : ''}`}></div>
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-2 rounded-3xl shadow-2xl">
                    
                    {/* Attachment Preview */}
                    {attachment && (
                      <div className="px-4 py-3 flex items-center justify-between bg-cyan-500/10 border-b border-cyan-500/20 rounded-t-2xl animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-600 dark:text-cyan-400">
                            {attachment.mimeType.includes('pdf') ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[200px]">{attachment.name}</span>
                             <span className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold">Attachment Ready</span>
                          </div>
                        </div>
                        <button onClick={(e) => {e.preventDefault(); setAttachment(null);}} className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="relative flex items-center">
                        <Search className="absolute left-4 md:left-6 w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={attachment ? "Optional: Add specific instructions..." : "Analyze a topic or upload a slide..."}
                            className="w-full pl-12 md:pl-16 pr-12 md:pr-16 py-3 md:py-6 bg-transparent border-none outline-none text-base md:text-2xl placeholder:text-slate-400 font-medium text-slate-900 dark:text-white"
                        />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`absolute right-4 md:right-6 p-2 rounded-xl transition-all ${attachment ? 'bg-cyan-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-cyan-500'}`}
                        >
                          <Paperclip className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                        />
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 p-2 mt-2">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-cyan-600 dark:text-cyan-400 shrink-0"><GraduationCap className="w-4 h-4" /></div>
                        <div className="flex flex-col z-10 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Audience</label>
                            <select value={complexityLevel} onChange={(e) => setComplexityLevel(e.target.value as ComplexityLevel)} className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 p-0 w-full">
                                <option value="Elementary">Elementary</option>
                                <option value="High School">High School</option>
                                <option value="College">College</option>
                                <option value="Expert">Expert</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
                         <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-purple-600 dark:text-purple-400 shrink-0"><Palette className="w-4 h-4" /></div>
                        <div className="flex flex-col z-10 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Aesthetic</label>
                            <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value as VisualStyle)} className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 p-0 w-full">
                                <option value="Default">Standard Scientific</option>
                                <option value="Minimalist">Minimalist</option>
                                <option value="Realistic">Photorealistic</option>
                                <option value="Cartoon">Graphic Novel</option>
                                <option value="Vintage">Vintage Lithograph</option>
                                <option value="Futuristic">Cyberpunk HUD</option>
                                <option value="3D Render">3D Isometric</option>
                                <option value="Sketch">Technical Blueprint</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
                         <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-green-600 dark:text-green-400 shrink-0"><Globe className="w-4 h-4" /></div>
                        <div className="flex flex-col z-10 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 p-0 w-full">
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                                <option value="Mandarin">Mandarin</option>
                                <option value="Japanese">Japanese</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Arabic">Arabic</option>
                                <option value="Portuguese">Portuguese</option>
                                <option value="Russian">Russian</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                        <button type="submit" disabled={isLoading} className="w-full md:w-auto h-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 py-4 rounded-2xl font-bold font-display shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2">
                            <Microscope className="w-5 h-5" />
                            <span>{attachment ? 'ANALYZE' : 'INITIATE'}</span>
                        </button>
                    </div>
                    </div>
                </div>
            </div>
          </form>
        </div>

        {isLoading && <Loading status={loadingMessage} step={loadingStep} facts={loadingFacts} />}

        {error && (
          <div className="max-w-2xl mx-auto mt-8 p-6 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-center gap-4 text-red-800 dark:text-red-200 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 shadow-sm">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-500 dark:text-red-400" />
            <div className="flex-1"><p className="font-medium">{error}</p></div>
          </div>
        )}

        {imageHistory.length > 0 && !isLoading && (
            <>
                <Infographic image={imageHistory[0]} onEdit={handleEdit} isEditing={isLoading} />
                <div className="max-w-6xl mx-auto flex flex-col items-center">
                   {loadingFacts.length > 0 && (
                      <div className="w-full mt-12 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 animate-in fade-in">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Atom className="w-4 h-4" /> Synthesized Insights
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {loadingFacts.map((fact, i) => (
                            <div key={i} className="flex gap-4 items-start group">
                              <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">
                                {i + 1}
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{fact}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                   )}
                   <SearchResults results={currentSearchResults} />
                </div>
            </>
        )}

        {imageHistory.length > 1 && (
            <div className="max-w-7xl mx-auto mt-16 md:mt-24 border-t border-slate-200 dark:border-white/10 pt-12 transition-colors">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3"><History className="w-4 h-4" />Recent Sessions</h3>
                  <button onClick={() => setIsHistoryOpen(true)} className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline">VIEW ALL HISTORY</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                    {imageHistory.slice(1, 5).map((img) => (
                        <div key={img.id} onClick={() => restoreImage(img)} className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 hover:border-cyan-500/50 transition-all shadow-lg bg-white dark:bg-slate-900/50">
                            <img src={img.data} alt={img.prompt} className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                <p className="text-xs text-white font-bold truncate mb-1 font-display">{img.prompt}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>
    </div>
    )}
    </>
  );
};

export default App;