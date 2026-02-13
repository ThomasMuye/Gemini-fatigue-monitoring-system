
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, Language } from "../types";

const API_KEY = process.env.API_KEY || '';

/**
 * Decodes a base64 string to a Uint8Array.
 * Manual implementation as per Gemini API rules.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM data into an AudioBuffer.
 * Necessary because Gemini TTS returns raw PCM without headers.
 */
export async function decodePcmData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const analyzeDriverState = async (base64Image: string, lang: Language): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const languageDirective = lang === Language.CN 
    ? "请用中文提供推理说明(reasoning)。" 
    : "Please provide the reasoning in English.";

  // Switched to gemini-flash-lite-latest for better stability in high-frequency multimodal tasks
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: `Analyze the driver's face for fatigue. 
          Identify: Eye status (OPEN/CLOSED/DROOPY), Blink rate, Head tilt, and Yawning.
          Categorize level as LOW, MODERATE, or HEAVY.
          Return ONLY JSON. ${languageDirective}`
        }
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fatigueLevel: { type: Type.STRING },
          blinkRate: { type: Type.NUMBER },
          headAngle: { type: Type.NUMBER },
          eyeStatus: { type: Type.STRING },
          yawnDetected: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["fatigueLevel", "blinkRate", "headAngle", "eyeStatus", "yawnDetected", "confidence", "reasoning"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw error;
  }
};

export const generateAlertAudioBase64 = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");
  return base64Audio;
};
