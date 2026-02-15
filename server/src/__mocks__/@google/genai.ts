/**
 * Jest manual mock for @google/genai package
 * 
 * This mock is needed because the real package uses ESM imports
 * that Jest cannot handle in CommonJS mode.
 */

export enum FunctionCallingConfigMode {
  AUTO = 'AUTO',
  ANY = 'ANY',
  NONE = 'NONE',
}

export enum Type {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  ARRAY = 'ARRAY',
  OBJECT = 'OBJECT',
}

export interface Content {
  role: string;
  parts: Part[];
}

export interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface FunctionCall {
  name?: string;
  args?: Record<string, unknown>;
  id?: string;
}

export interface FunctionResponse {
  name: string;
  response: unknown;
}

export interface FunctionDeclaration {
  name?: string;
  description?: string;
  parameters?: Schema;
}

export interface Schema {
  type?: Type;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: Schema;
}

export interface GenerateContentConfig {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: unknown[];
  toolConfig?: unknown;
  abortSignal?: AbortSignal;
}

export class GoogleGenAI {
  models = {
    generateContent: () => Promise.resolve({
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Mock response from Gemini AI',
              },
            ],
          },
        },
      ],
    }),
  };

  constructor(_options: { apiKey: string }) {
    // Mock constructor does nothing
  }
}
