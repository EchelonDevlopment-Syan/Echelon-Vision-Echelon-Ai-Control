
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { GeneratedImage, ComplexityLevel, VisualStyle, Language, SearchResultItem, FileAttachment, GenerationMode, InfographicFormat, PDFSlide } from './types';
import { 
  researchTopicForPrompt, 
  generateInfographicImage, 
  editInfographicImage,
  generateEchelonVideo,
  extendEchelonVideo,
} from './services/geminiService';
import Infographic from './components/Infographic';
import Loading from './components/Loading';
import IntroScreen from './components/IntroScreen';
import SearchResults from './components/SearchResults';
import SnowEffect from './components/SnowEffect';
import HistorySidebar from './components/HistorySidebar';
import { Search, AlertCircle, History, GraduationCap, Palette, Microscope, Atom, Compass, Globe, Sun, Moon, Key, CreditCard, ExternalLink, Snowflake, Paperclip, X, FileText, Image as ImageIcon, Video, Image as StaticImage, Clapperboard, Sparkles, Download, Layout, RotateCcw, Plus, Hourglass, Trash2, CheckSquare, Square, Layers } from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const STORAGE_KEY = 'echelon_vision_history';

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [topic, setTopic] = useState('');
  const [videoCoverage, setVideoCoverage] = useState('');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('Infographic');
  const [infographicFormat, setInfographicFormat] = useState<InfographicFormat>('Single Slide');
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [selectedSlides, setSelectedSlides] = useState<number[]>([]);
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
  const [activeResult, setActiveResult] = useState<GeneratedImage | null>(null);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResultItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSnowing, setIsSnowing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [showExtensionInput, setShowExtensionInput] = useState(false);
  const [extensionPrompt, setExtensionPrompt] = useState('');

  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  const [currentFile, setCurrentFile] = useState<File | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setImageHistory(parsed);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Safe History Saving logic to prevent QuotaExceededError
  useEffect(() => {
    if (imageHistory.length === 0) return;

    const saveHistoryToStorage = (items: GeneratedImage[]) => {
      try {
        const data = JSON.stringify(items);
        localStorage.setItem(STORAGE_KEY, data);
      } catch (e) {
        if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
          // If quota exceeded, clear the oldest full-resolution images but keep the metadata
          const modifiedHistory = [...items];
          let clearedCount = 0;
          
          // Start from oldest (bottom of list) and clear data strings
          for (let i = modifiedHistory.length - 1; i >= 0; i--) {
            if (modifiedHistory[i].data.length > 1000) { // Only clear if it's a large data string
               modifiedHistory[i] = { ...modifiedHistory[i], data: "" }; // Keep item but remove heavy data
               clearedCount++;
               // Try saving again after clearing one
               try {
                 localStorage.setItem(STORAGE_KEY, JSON.stringify(modifiedHistory));
                 console.warn(`Cleared ${clearedCount} old history items from storage to save space.`);
                 return;
               } catch (retryErr) {
                 continue; // Still too big, keep clearing
               }
            }
          }
          // If still too big, start removing items entirely
          if (modifiedHistory.length > 1) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(modifiedHistory.slice(0, -1)));
          }
        } else {
          console.error("Failed to save history:", e);
        }
      }
    };

    saveHistoryToStorage(imageHistory);
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

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25MB limit. Please upload a smaller deck.");
      return;
    }

    setCurrentFile(file);
    setIsLoading(true);
    setLoadingMessage("Parsing document...");
    setLoadingStep(5);

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        const newAttachment: FileAttachment = {
            data: "", // Deferred base64 conversion to save memory
            mimeType: file.type,
            name: file.name,
            slides: []
        };

        if (file.type === 'application/pdf') {
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const numPages = Math.min(pdf.numPages, 30);
            const extractedSlides: PDFSlide[] = [];

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            for (let i = 1; i <= numPages; i++) {
                setLoadingMessage(`Scanning Slide ${i}/${numPages}...`);
                setLoadingStep(Math.round((i / numPages) * 100));
                
                // Yield to main thread
                await new Promise(resolve => setTimeout(resolve, 10));

                const page = await pdf.getPage(i);
                // Lower scale for faster batch scans and memory efficiency
                const viewport = page.getViewport({ scale: 0.25 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context!, viewport }).promise;
                const thumbBase64 = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
                
                extractedSlides.push({
                    pageNumber: i,
                    thumbnail: thumbBase64,
                    data: thumbBase64
                });
            }
            canvas.width = 0;
            canvas.height = 0;
            pdf.cleanup();
            
            newAttachment.slides = extractedSlides;
            setSelectedSlides(extractedSlides.map(s => s.pageNumber));
        } else if (file.type.startsWith('image/')) {
            const base64 = await blobToBase64(file);
            newAttachment.data = base64;
        }

        setAttachment(newAttachment);
        setError(null);
    } catch (err) {
        console.error(err);
        setError("Error parsing document. It might be too large or complex.");
    } finally {
        setIsLoading(false);
        setLoadingStep(0);
    }
  };

  const handleToggleSlide = (page: number) => {
    setSelectedSlides(prev => 
        prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    );
  };

  const handleSelectAll = () => {
    if (attachment?.slides) {
        setSelectedSlides(attachment.slides.map(s => s.pageNumber));
    }
  };

  const handleDeselectAll = () => setSelectedSlides([]);

  const handleNewResearch = () => {
    setTopic('');
    setVideoCoverage('');
    setAttachment(null);
    setCurrentFile(null);
    setSelectedSlides([]);
    setLoadingFacts([]);
    setCurrentSearchResults([]);
    setActiveResult(null);
    setError(null);
  };

  const handleDismissActiveResult = () => {
    setActiveResult(null);
    setLoadingFacts([]);
    setCurrentSearchResults([]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!topic.trim() && !attachment) {
        setError("Please enter a topic or select slides to process.");
        return;
    }

    if (!hasApiKey) {
      handleSelectKey();
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingFacts([]);
    setCurrentSearchResults([]);

    try {
      if (attachment?.mimeType === 'application/pdf' && selectedSlides.length > 1) {
        setLoadingMessage(`Preparing Batch Synthesis...`);
        const total = selectedSlides.length;

        for (let i = 0; i < total; i++) {
            const pageNum = selectedSlides[i];
            const slideData = attachment.slides?.find(s => s.pageNumber === pageNum)?.data;
            
            setLoadingMessage(`Synthesizing Slide ${pageNum} of ${total}...`);
            setLoadingStep(Math.round(((i + 1) / total) * 100));

            // Throttling to prevent sequential timeouts or rate limits
            if (i > 0) await new Promise(r => setTimeout(r, 2000));

            const researchResult = await researchTopicForPrompt(
                `Reconstruct Slide ${pageNum}: ${topic}`,
                complexityLevel,
                visualStyle,
                language,
                'Single Slide',
                undefined, 
                `High-fidelity reconstruction for slide ${pageNum}.`,
                slideData
            );

            let newImg: GeneratedImage;
            if (generationMode === 'Infographic') {
                const data = await generateInfographicImage(researchResult.imagePrompt);
                newImg = {
                    id: `${Date.now()}-${pageNum}`,
                    data: data,
                    type: 'image',
                    prompt: `Slide ${pageNum}: ${topic || 'Reconstruction'}`,
                    timestamp: Date.now(),
                    pageNumber: pageNum,
                    facts: researchResult.facts,
                    searchResults: researchResult.searchResults
                };
            } else {
                const vid = await generateEchelonVideo(researchResult.videoPrompt, undefined);
                newImg = {
                    id: `${Date.now()}-${pageNum}`,
                    data: vid.url,
                    type: 'video',
                    prompt: `Slide ${pageNum}: ${topic || 'Reconstruction'}`,
                    timestamp: Date.now(),
                    pageNumber: pageNum,
                    rawVideoData: vid.raw
                };
            }
            
            setImageHistory(prev => [newImg, ...prev]);
            setActiveResult(newImg);
            setLoadingFacts(researchResult.facts);
            setCurrentSearchResults(researchResult.searchResults);
        }
      } else {
        // Single synthesis - Deferred base64 conversion only when needed
        let activeAttachment = attachment;
        if (currentFile && !activeAttachment?.data) {
           const b64 = await blobToBase64(currentFile);
           activeAttachment = { ...activeAttachment!, data: b64 };
        }

        setLoadingMessage(activeAttachment ? `Synthesizing Document...` : `Researching Topic...`);
        setLoadingStep(20);
        
        const researchResult = await researchTopicForPrompt(
            topic, 
            complexityLevel, 
            visualStyle, 
            language, 
            infographicFormat, 
            activeAttachment || undefined, 
            videoCoverage
        );
        
        setLoadingFacts(researchResult.facts);
        setCurrentSearchResults(researchResult.searchResults);
        setLoadingStep(60);
        
        let newImage: GeneratedImage;
        if (generationMode === 'Infographic') {
            setLoadingMessage(`Finalizing Master Image...`);
            const finalData = await generateInfographicImage(researchResult.imagePrompt);
            newImage = {
                id: Date.now().toString(),
                data: finalData,
                type: 'image',
                prompt: topic || activeAttachment?.name || "Synthesis",
                timestamp: Date.now(),
                facts: researchResult.facts,
                searchResults: researchResult.searchResults
            };
        } else {
            setLoadingMessage(`Animating Cinematic Sequences...`);
            const result = await generateEchelonVideo(researchResult.videoPrompt, activeAttachment || undefined);
            newImage = {
                id: Date.now().toString(),
                data: result.url,
                type: 'video',
                prompt: topic || activeAttachment?.name || "Cinematic",
                timestamp: Date.now(),
                rawVideoData: result.raw
            };
        }
        setImageHistory([newImage, ...imageHistory]);
        setActiveResult(newImage);
      }
    } catch (err: any) {
      console.error(err);
      setError("System overload. Try processing fewer slides or refreshing the page.");
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleExtend = async () => {
    if (!activeResult || activeResult.type !== 'video' || !activeResult.rawVideoData) return;
    if (!extensionPrompt.trim()) return;

    setIsLoading(true);
    setLoadingMessage(`Extending Cinematic Sequence...`);
    setShowExtensionInput(false);

    try {
      const result = await extendEchelonVideo(activeResult.rawVideoData, extensionPrompt);
      const newImage: GeneratedImage = {
        ...activeResult,
        id: Date.now().toString(),
        data: result.url,
        timestamp: Date.now(),
        prompt: extensionPrompt,
        rawVideoData: result.raw
      };
      setImageHistory([newImage, ...imageHistory]);
      setActiveResult(newImage);
      setExtensionPrompt('');
    } catch (err: any) {
      console.error(err);
      setError("Extension failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (editPrompt: string) => {
    if (!activeResult || activeResult.type === 'video') return;
    setIsLoading(true);
    setLoadingMessage(`Applying Visual Evolution...`);

    try {
      const base64Data = await editInfographicImage(activeResult.data, editPrompt);
      const newImage: GeneratedImage = {
        ...activeResult,
        id: Date.now().toString(),
        data: base64Data,
        prompt: editPrompt,
        timestamp: Date.now(),
      };
      setImageHistory([newImage, ...imageHistory]);
      setActiveResult(newImage);
    } catch (err: any) {
      console.error(err);
      setError('Visual evolution failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreImage = (img: GeneratedImage) => {
     if (!img.data && img.type === 'image') {
        setError("Original high-res image was purged from local storage to save space. Metadata preserved.");
     }
     setActiveResult(img);
     setLoadingFacts(img.facts || []);
     setCurrentSearchResults(img.searchResults || []);
     setIsHistoryOpen(false);
  };

  const deleteFromHistory = (id: string) => {
    if (activeResult?.id === id) setActiveResult(null);
    setImageHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Permanently clear research archive?")) {
      setImageHistory([]);
      setActiveResult(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <>
    {!checkingKey && !hasApiKey && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                <h2 className="text-2xl font-display font-bold mb-4 dark:text-white">API Key Required</h2>
                <p className="text-sm text-slate-500 mb-6">High-fidelity batch reconstruction requires a paid project API key.</p>
                <button onClick={handleSelectKey} className="w-full py-3.5 bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20">
                    <Key className="w-4 h-4" /> Select Paid Key
                </button>
            </div>
        </div>
    )}
    {isSnowing && <SnowEffect />}
    
    <HistorySidebar history={imageHistory} isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onRestore={restoreImage} onDelete={deleteFromHistory} onClear={clearHistory} />

    {showIntro ? (
      <IntroScreen onComplete={() => setShowIntro(false)} />
    ) : (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans pb-20 relative transition-colors">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white dark:from-indigo-900 dark:via-slate-950 dark:to-black z-0"></div>
      
      <header className="border-b border-slate-200 dark:border-white/10 sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/60 h-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-white/5">
                <Atom className="w-8 h-8 text-cyan-500 animate-[spin_10s_linear_infinite]" />
              </div>
              <div className="flex flex-col">
                  <span className="font-display font-bold text-2xl tracking-tight">Echelon <span className="text-cyan-500">Vision</span></span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">Knowledge Engine 3.1</span>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={handleNewResearch} className="p-2.5 rounded-full border border-slate-200 dark:border-white/10 hover:text-cyan-500 transition-colors" title="New Synthesis"><Plus className="w-5 h-5" /></button>
              <button onClick={() => setIsHistoryOpen(true)} className="p-2.5 rounded-full border border-slate-200 dark:border-white/10 relative" title="Visual Archive"><History className="w-5 h-5" /> {imageHistory.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-cyan-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>}</button>
              <button onClick={() => setIsSnowing(!isSnowing)} className={`p-2.5 rounded-full border border-slate-200 dark:border-white/10 transition-colors ${isSnowing ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`} title="Weather Toggle"><Snowflake className="w-5 h-5" /></button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 transition-colors" title="Theme Switcher">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          </div>
      </header>

      <main className="px-6 py-8 relative z-10 max-w-7xl mx-auto">
        <div className={`transition-all duration-700 ${activeResult ? 'mb-8' : 'min-h-[50vh] flex flex-col justify-center items-center'}`}>
          {!activeResult && (
            <div className="text-center mb-10 space-y-6 animate-in fade-in slide-in-from-bottom-8">
                <h1 className="text-5xl md:text-8xl font-display font-bold tracking-tight leading-[0.9]">Synthesize <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">Cinematic</span> Decks.</h1>
                <p className="text-slate-400 max-w-2xl mx-auto font-medium text-lg">Batch-process slide decks into verified high-fidelity visuals or cinematic animations.</p>
            </div>
          )}

          <form onSubmit={handleGenerate} className={`w-full max-w-5xl mx-auto transition-all duration-300 ${isLoading ? 'opacity-50 pointer-events-none scale-[0.98] blur-sm' : ''}`}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200 dark:border-white/10 p-2 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-20"></div>
                
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-2 gap-1 border border-slate-200 dark:border-white/5">
                    <button type="button" onClick={() => setGenerationMode('Infographic')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${generationMode === 'Infographic' ? 'bg-white dark:bg-slate-700 text-cyan-500 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><StaticImage className="w-4 h-4" /> INFOGRAPHIC SYSTEM</button>
                    <button type="button" onClick={() => setGenerationMode('Video')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${generationMode === 'Video' ? 'bg-white dark:bg-slate-700 text-purple-500 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><Clapperboard className="w-4 h-4" /> CINEMATIC ENGINE</button>
                </div>

                {attachment?.slides && attachment.slides.length > 0 && (
                    <div className="px-4 py-5 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/20 rounded-t-3xl mb-2">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-cyan-500/10 rounded-lg"><Layers className="w-4 h-4 text-cyan-500" /></div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Extracted Slides: {attachment.slides.length}</span>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleSelectAll} className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl hover:bg-cyan-500/5 transition-colors">ALL</button>
                                <button type="button" onClick={handleDeselectAll} className="text-[10px] font-bold text-slate-500 border border-slate-500/20 px-3 py-1.5 rounded-xl hover:bg-slate-500/5 transition-colors">NONE</button>
                            </div>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                            {attachment.slides.map(slide => (
                                <div 
                                    key={slide.pageNumber}
                                    onClick={() => handleToggleSlide(slide.pageNumber)}
                                    className={`relative flex-shrink-0 w-36 aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all snap-start shadow-sm ${selectedSlides.includes(slide.pageNumber) ? 'border-cyan-500 scale-105 shadow-cyan-500/20 shadow-lg' : 'border-slate-200 dark:border-white/10 grayscale opacity-50'}`}
                                >
                                    <img src={`data:image/jpeg;base64,${slide.thumbnail}`} className="w-full h-full object-cover" alt={`Slide ${slide.pageNumber}`} />
                                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-bold text-white uppercase tracking-tighter">SLIDE {slide.pageNumber}</div>
                                    <div className="absolute inset-0 flex items-center justify-center transition-opacity">
                                        {selectedSlides.includes(slide.pageNumber) ? <CheckSquare className="w-7 h-7 text-cyan-500 fill-white" /> : <Square className="w-7 h-7 text-white/30" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="relative flex items-center">
                    <Search className="absolute left-8 w-7 h-7 text-slate-400" />
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={attachment ? "Reconstruct focusing on..." : "What complex topic shall we visualize today?"} className="w-full pl-20 pr-20 py-8 bg-transparent border-none outline-none text-2xl placeholder:text-slate-400 font-medium text-slate-900 dark:text-white" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`absolute right-8 p-3 rounded-2xl transition-all ${attachment ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`} title="Upload Deck"><Paperclip className="w-6 h-6" /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf,image/*" onChange={handleFileChange} />
                </div>

                <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-5 py-4 flex flex-col group transition-colors hover:border-cyan-500/30">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Target Audience</label>
                        <select value={complexityLevel} onChange={(e) => setComplexityLevel(e.target.value as ComplexityLevel)} className="bg-transparent border-none text-sm font-bold p-0 w-full cursor-pointer focus:ring-0 text-slate-900 dark:text-slate-100">
                            <option value="Elementary">Elementary</option>
                            <option value="High School">High School</option>
                            <option value="College">College</option>
                            <option value="Expert">Expert</option>
                        </select>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-5 py-4 flex flex-col group transition-colors hover:border-cyan-500/30">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Visual Aesthetic</label>
                        <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value as VisualStyle)} className="bg-transparent border-none text-sm font-bold p-0 w-full cursor-pointer focus:ring-0 text-slate-900 dark:text-slate-100">
                            <option value="Default">Modern Sci</option>
                            <option value="Futuristic">Cyber HUD</option>
                            <option value="Minimalist">Bauhaus</option>
                            <option value="3D Render">Isometric</option>
                        </select>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-5 py-4 flex flex-col col-span-2 justify-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Synthesis Mode</label>
                        <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
                            {selectedSlides.length > 1 ? (
                                <><Layers className="w-4 h-4" /> Batch Reconstruct ({selectedSlides.length} items)</>
                            ) : (
                                <><Sparkles className="w-4 h-4" /> Single Master Synthesis</>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-3 pt-0">
                    <button type="submit" disabled={isLoading} className={`w-full py-5 rounded-[1.8rem] font-bold font-display text-lg flex items-center justify-center gap-3 transition-all ${generationMode === 'Video' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/20' : 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-cyan-500/20'} text-white shadow-xl hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50`}>
                        {selectedSlides.length > 1 ? <Layers className="w-6 h-6" /> : <Microscope className="w-6 h-6" />}
                        <span>{selectedSlides.length > 1 ? `RECONSTRUCT ENTIRE DECK` : 'INITIALIZE KNOWLEDGE SYNTHESIS'}</span>
                    </button>
                </div>
            </div>
          </form>
        </div>

        {isLoading && <Loading status={loadingMessage} step={loadingStep} facts={loadingFacts} />}

        {error && (
            <div className="max-w-2xl mx-auto mt-8 p-6 bg-red-100 dark:bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center gap-5 text-red-800 dark:text-red-200 animate-in slide-in-from-top-4 shadow-lg backdrop-blur-md">
                <div className="p-3 bg-red-500 rounded-2xl text-white"><AlertCircle className="w-6 h-6 flex-shrink-0" /></div>
                <div className="flex flex-col">
                    <span className="font-bold uppercase tracking-widest text-[10px] text-red-600 dark:text-red-400 mb-1">System Error</span>
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        )}

        {activeResult && !isLoading && (
            <div className="max-w-6xl mx-auto mt-12 animate-in zoom-in duration-1000">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 text-cyan-500">
                            {activeResult.type === 'video' ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Deliverable: {activeResult.type}</span>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px] md:max-w-md">{activeResult.prompt}</h2>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleDismissActiveResult} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-red-500 transition-all shadow-sm">DISMISS</button>
                    </div>
                </div>
                
                <div className="bg-slate-100 dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 aspect-video relative group">
                    {activeResult.type === 'image' ? (
                        activeResult.data ? (
                          <Infographic image={activeResult} onEdit={handleEdit} isEditing={isLoading} />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-800">
                              <AlertCircle className="w-12 h-12 text-amber-500" />
                              <p className="text-slate-300">Image data was cleared to save storage space. Please regenerate if needed.</p>
                          </div>
                        )
                    ) : (
                        <div className="w-full h-full relative">
                            <video src={activeResult.data} controls autoPlay className="w-full h-full object-contain" />
                            <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={activeResult.data} download="echelon-cinematic.mp4" className="bg-black/70 backdrop-blur-xl p-4 rounded-2xl text-white hover:bg-purple-600 transition-colors shadow-2xl"><Download className="w-5 h-5" /></a>
                                <button onClick={() => setShowExtensionInput(true)} className="bg-black/70 backdrop-blur-xl p-4 rounded-2xl text-white hover:bg-amber-600 transition-colors shadow-2xl"><Hourglass className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}
                </div>

                {loadingFacts.length > 0 && (
                    <div className="mt-12 p-10 bg-white dark:bg-slate-900/40 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500"><Atom className="w-5 h-5" /></div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Synthesized Evidence</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {loadingFacts.map((fact, i) => (
                                <div key={i} className="flex gap-5 items-start group">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-xs shrink-0 group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-sm">{i+1}</div>
                                    <p className="text-slate-700 dark:text-slate-300 text-base leading-relaxed font-medium">{fact}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <SearchResults results={currentSearchResults} />
            </div>
        )}

        {imageHistory.length > 0 && (
            <div className="max-w-7xl mx-auto mt-24 border-t border-slate-200 dark:border-white/5 pt-16">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500"><History className="w-4 h-4" /></div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Knowledge Archive</h3>
                    </div>
                    <button onClick={() => setIsHistoryOpen(true)} className="text-[10px] font-bold text-cyan-500 hover:text-cyan-400 flex items-center gap-2 uppercase tracking-widest transition-colors">Explorer All Archive <ExternalLink className="w-3 h-3" /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {imageHistory.slice(0, 5).map((img) => (
                        <div key={img.id} onClick={() => restoreImage(img)} className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 transition-all hover:border-cyan-500/50 hover:-translate-y-1 shadow-md bg-white dark:bg-slate-900/50">
                            <div className="aspect-video relative overflow-hidden">
                                {img.type === 'image' ? (
                                    img.data ? (
                                      <img src={img.data} alt={img.prompt} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    ) : (
                                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600 font-bold text-[8px] uppercase">Cached Meta Only</div>
                                    )
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Video className="w-8 h-8 text-white/20" /></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <div className="p-3">
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate uppercase tracking-tighter">{img.prompt}</p>
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
