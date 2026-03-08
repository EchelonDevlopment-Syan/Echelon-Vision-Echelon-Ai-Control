
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export type AspectRatio = '16:9' | '9:16' | '1:1';

export type ComplexityLevel = 'Elementary' | 'High School' | 'College' | 'Expert';

export type VisualStyle = 'Default' | 'Minimalist' | 'Realistic' | 'Cartoon' | 'Vintage' | 'Futuristic' | '3D Render' | 'Sketch';

export type Language = 'English' | 'Spanish' | 'French' | 'German' | 'Mandarin' | 'Japanese' | 'Hindi' | 'Arabic' | 'Portuguese' | 'Russian';

export type GenerationMode = 'Infographic' | 'Video';

export type InfographicFormat = 'Single Slide' | 'Full Infographic';

export interface PDFSlide {
  pageNumber: number;
  thumbnail: string; // Base64
  data: string; // Base64 full data
}

export interface FileAttachment {
  data: string; // Base64
  mimeType: string;
  name: string;
  slides?: PDFSlide[];
  selectedPages?: number[];
}

export interface GeneratedImage {
  id: string;
  data: string; // Base64 data URL (Image) or Object URL (Video)
  type: 'image' | 'video';
  prompt: string;
  timestamp: number;
  level?: ComplexityLevel;
  style?: VisualStyle;
  language?: Language;
  format?: InfographicFormat;
  facts?: string[];
  searchResults?: SearchResultItem[];
  rawVideoData?: any; // Stores the raw video object from Veo API for extension
  pageNumber?: number; // If part of a PDF batch
}

export interface SearchResultItem {
  title: string;
  url: string;
}

export interface ResearchResult {
  imagePrompt: string;
  videoPrompt: string;
  facts: string[];
  searchResults: SearchResultItem[];
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
