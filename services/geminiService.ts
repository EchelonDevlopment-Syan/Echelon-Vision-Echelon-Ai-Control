/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio, ComplexityLevel, VisualStyle, ResearchResult, SearchResultItem, Language, FileAttachment } from "../types";

const getAi = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const TEXT_MODEL = 'gemini-3-pro-preview';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const EDIT_MODEL = 'gemini-3-pro-image-preview';

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
  attachment?: FileAttachment
): Promise<ResearchResult> => {
  
  const levelInstr = getLevelInstruction(level);
  const styleInstr = getStyleInstruction(style);

  const parts: any[] = [];
  
  // Add file attachment if present
  if (attachment) {
    parts.push({
      inlineData: {
        data: attachment.data,
        mimeType: attachment.mimeType
      }
    });
  }

  const systemPrompt = `
    You are the Echelon Knowledge Engine. 
    Analyze the provided content (text and/or attached file).
    
    TASK: 
    1. Use Google Search to verify the facts in the content and find deeper, more current technical details.
    2. Synthesize a master infographic plan.
    
    Topic: "${topic || 'Document Analysis'}"
    Audience: ${levelInstr}
    Style: ${styleInstr}
    Language: ${language}
    
    Format your response EXACTLY as:
    
    FACTS:
    - [Fact 1]
    - [Fact 2]
    - [Fact 3]
    
    IMAGE_PROMPT:
    [A highly detailed generation prompt for a 16:9 infographic. Describe a specific visual scene, structure, and technical labeling. Do not include citations here.]
  `;

  parts.push({ text: systemPrompt });

  const response = await getAi().models.generateContent({
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

  const promptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i);
  const imagePrompt = promptMatch ? promptMatch[1].trim() : `Detailed infographic of ${topic}. ${levelInstr} ${styleInstr}`;

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
    facts,
    searchResults: Array.from(new Map(searchResults.map(item => [item.url, item])).values())
  };
};

export const generateInfographicImage = async (prompt: string): Promise<string> => {
  const response = await getAi().models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: prompt }] },
    config: { responseModalities: [Modality.IMAGE] }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Generation failed");
};

export const editInfographicImage = async (currentImageBase64: string, editInstruction: string): Promise<string> => {
  const cleanBase64 = currentImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const response = await getAi().models.generateContent({
    model: EDIT_MODEL,
    contents: {
      parts: [
         { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
         { text: editInstruction }
      ]
    },
    config: { responseModalities: [Modality.IMAGE] }
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Edit failed");
};