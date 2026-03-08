
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ComplexityLevel, VisualStyle, ResearchResult, SearchResultItem, Language, FileAttachment, InfographicFormat } from "../types";

const getAi = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Use Flash for research phase as it's much faster and avoids environment timeouts during batching
const TEXT_MODEL = 'gemini-3-flash-preview'; 
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';
const EXTENSION_MODEL = 'veo-3.1-generate-preview';

const getLevelInstruction = (level: ComplexityLevel): string => {
  switch (level) {
    case 'Elementary': return "Target Audience: Elementary School. Simple, fun icons, minimal text.";
    case 'High School': return "Target Audience: High School. Clean, educational, textbook-style accuracy.";
    case 'College': return "Target Audience: University. Data-rich, detailed schematics, high information density.";
    case 'Expert': return "Target Audience: Industry Expert. Technical blueprint style, precise annotations.";
    default: return "Target Audience: General Public.";
  }
};

const getStyleInstruction = (style: VisualStyle): string => {
  switch (style) {
    case 'Minimalist': return "Aesthetic: Bauhaus Minimalist. Flat vector art, geometric.";
    case 'Realistic': return "Aesthetic: Photorealistic. Cinematic lighting, 8k resolution.";
    case 'Cartoon': return "Aesthetic: Graphic Novel. Vibrant colors, thick outlines.";
    case 'Vintage': return "Aesthetic: 19th Century Lithograph. Sepia, engraving style.";
    case 'Futuristic': return "Aesthetic: Cyberpunk HUD. Neon glow, holographic 3D wires.";
    case '3D Render': return "Aesthetic: 3D Isometric. Physical clay/plastic models.";
    case 'Sketch': return "Aesthetic: Technical Blueprint. Parchment and technical ink.";
    default: return "Aesthetic: Modern high-quality scientific digital illustration.";
  }
};

export const researchTopicForPrompt = async (
  topic: string, 
  level: ComplexityLevel, 
  style: VisualStyle,
  language: Language,
  format: InfographicFormat,
  attachment?: FileAttachment,
  videoCoverage?: string,
  specificSlideData?: string
): Promise<ResearchResult> => {
  
  const ai = getAi();
  const levelInstr = getLevelInstruction(level);
  const styleInstr = getStyleInstruction(style);

  const parts: any[] = [];
  
  if (specificSlideData) {
    parts.push({
      inlineData: {
        data: specificSlideData,
        mimeType: 'image/jpeg'
      }
    });
  } else if (attachment && attachment.data) {
    parts.push({
      inlineData: {
        data: attachment.data,
        mimeType: attachment.mimeType
      }
    });
  }

  const formatInstr = format === 'Single Slide' 
    ? "Layout: Presentation Slide. Focus on one major concept with clear headings and balanced negative space. Aspect 16:9."
    : "Layout: Full Data Infographic. Multiple sections, data visualizations, and deep hierarchical information. Aspect 16:9.";

  const systemPrompt = `
    You are the Echelon Knowledge Engine. 
    Analyze the provided content.
    
    TASK: 
    1. Use Google Search to verify facts and find deeper, more current technical details.
    2. Synthesize a master plan for both a static Infographic/Slide and a cinematic Video.
    
    Topic: "${topic || 'Document Analysis'}"
    Audience: ${levelInstr}
    Style: ${styleInstr}
    Language: ${language}
    Format: ${formatInstr}
    Video Coverage Focus: "${videoCoverage || 'A comprehensive cinematic overview'}"
    
    Format your response EXACTLY as:
    
    FACTS:
    - [Fact 1]
    - [Fact 2]
    - [Fact 3]
    
    IMAGE_PROMPT:
    [A highly detailed generation prompt for a 16:9 infographic. Describe a specific visual scene, structure, and technical labeling in ${language}.]
    
    VIDEO_PROMPT:
    [A cinematic animation prompt for a 16:9 video. Focus on camera movement and transitions. Keep it under 200 words.]
  `;

  parts.push({ text: systemPrompt });

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  
  const factsMatch = text.match(/FACTS:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
  const factsRaw = factsMatch ? factsMatch[1].trim() : "";
  const facts = factsRaw.split('\n')
    .map(f => f.replace(/^-\s*/, '').trim())
    .filter(f => f.length > 0)
    .slice(0, 5);

  const imgPromptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)(?=VIDEO_PROMPT:|$)/i);
  const imagePrompt = imgPromptMatch ? imgPromptMatch[1].trim() : `Detailed infographic of ${topic}. ${levelInstr} ${styleInstr}`;

  const vidPromptMatch = text.match(/VIDEO_PROMPT:\s*([\s\S]*?)$/i);
  const videoPrompt = vidPromptMatch ? vidPromptMatch[1].trim() : `Cinematic motion graphics of ${topic}.`;

  const searchResults: SearchResultItem[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach(chunk => {
      if (chunk.web?.uri && chunk.web?.title) {
        searchResults.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    });
  }

  return {
    imagePrompt,
    videoPrompt,
    facts,
    searchResults: Array.from(new Map(searchResults.map(item => [item.url, item])).values())
  };
};

export const generateInfographicImage = async (prompt: string): Promise<string> => {
  const response = await getAi().models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: prompt }] },
    config: { 
      imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Image generation timed out or failed.");
};

export const generateEchelonVideo = async (prompt: string, attachment?: FileAttachment): Promise<{url: string, raw: any}> => {
  const ai = getAi();
  
  const canUseAttachmentAsFrame = attachment && attachment.mimeType.startsWith('image/');

  let operation = await ai.models.generateVideos({
    model: VIDEO_MODEL,
    prompt: prompt,
    image: (canUseAttachmentAsFrame && attachment.data) ? {
      imageBytes: attachment.data,
      mimeType: attachment.mimeType
    } : undefined,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const rawVideo = operation.response?.generatedVideos?.[0]?.video;
  const downloadLink = rawVideo?.uri;
  if (!downloadLink) throw new Error("Video generation failed.");

  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download video.");
  
  const blob = await response.blob();
  return {
    url: URL.createObjectURL(blob),
    raw: rawVideo
  };
};

export const extendEchelonVideo = async (previousVideo: any, extensionPrompt: string): Promise<{url: string, raw: any}> => {
  const ai = getAi();
  
  let operation = await ai.models.generateVideos({
    model: EXTENSION_MODEL,
    prompt: extensionPrompt,
    video: previousVideo,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const rawVideo = operation.response?.generatedVideos?.[0]?.video;
  const downloadLink = rawVideo?.uri;
  if (!downloadLink) throw new Error("Extension failed.");

  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return {
    url: URL.createObjectURL(blob),
    raw: rawVideo
  };
};

export const editInfographicImage = async (currentImageBase64: string, editInstruction: string): Promise<string> => {
  const cleanBase64 = currentImageBase64.split(',')[1] || currentImageBase64;
  
  const response = await getAi().models.generateContent({
    model: IMAGE_MODEL,
    contents: {
      parts: [
         { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
         { text: editInstruction }
      ]
    },
    config: { 
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Evolution failed.");
};
