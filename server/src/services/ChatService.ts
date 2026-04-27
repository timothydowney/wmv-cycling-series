/**
 * ChatService.ts
 *
 * Orchestrates Gemini AI conversations with function calling.
 * Manages the multi-turn conversation loop, executing tools as requested
 * by the model until it produces a final text response.
 */

import {
  GoogleGenAI,
  type Content,
  type Part,
  type FunctionCall,
  type GenerateContentConfig,
  FunctionCallingConfigMode,
} from '@google/genai';
import type { AppDatabase } from '../db/types';
import { config } from '../config';
import { ChatToolRunner } from './ChatToolRunner';
import { ChatContextBuilder } from './ChatContextBuilder';
import { getAllToolDefinitions } from './ChatToolDefinitions';
import { getChatRateLimiter } from './ChatRateLimiter';

/** A single message in the conversation history */
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

/** Response from the chat service */
export interface ChatResponse {
  message: string;
  usage: {
    minuteRemaining: number;
    dayRemaining: number;
  };
}

/** Maximum number of function-calling rounds before forcing a text response */
const MAX_TOOL_ROUNDS = 8;

/** Maximum history messages to send (to control token usage) */
const MAX_HISTORY_MESSAGES = 20;

/** Per-API-call timeout in ms. gemini-3-flash-preview needs 3-10s per call with
 * 17 tool declarations. Complex multi-round queries can need 4+ rounds, so 60s
 * per call prevents premature timeout while still catching true hangs. */
const API_CALL_TIMEOUT_MS = 60_000;

export class ChatService {
  private genAI: GoogleGenAI;
  private db: AppDatabase;
  private toolRunner: ChatToolRunner;

  constructor(db: AppDatabase) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
    this.db = db;
    this.toolRunner = new ChatToolRunner(db);
  }

  /**
   * Build the shared Gemini config used for every call in the conversation.
   */
  private async buildConfig(userId: string): Promise<GenerateContentConfig> {
    return {
      systemInstruction: await ChatContextBuilder.buildSystemPrompt(this.db, userId),
      temperature: 0.7,
      maxOutputTokens: 2048,
      tools: [{
        functionDeclarations: getAllToolDefinitions(),
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
    };
  }

  /**
   * Call Gemini with a timeout so we don't hang forever.
   */
  private async callGemini(contents: Content[], label: string, userId: string) {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

    try {
      const response = await this.genAI.models.generateContent({
        model: config.geminiModel!,
        contents,
        config: {
          ...(await this.buildConfig(userId)),
          abortSignal: controller.signal,
        },
      });
      const elapsed = Date.now() - start;
      console.log(`[Chat] ${label} — ${elapsed}ms (model=${config.geminiModel})`);
      return response;
    } catch (error) {
      const elapsed = Date.now() - start;
      if (controller.signal.aborted) {
        console.error(`[Chat] ${label} — TIMEOUT after ${elapsed}ms`);
        throw new Error(`Gemini API timed out after ${API_CALL_TIMEOUT_MS}ms`);
      }
      console.error(`[Chat] ${label} — ERROR after ${elapsed}ms:`, error instanceof Error ? error.message : error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send a message and get a response.
   * Handles the full function-calling loop.
   */
  async chat(
    userId: string,
    message: string,
    history: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const requestStart = Date.now();

    // Rate limiting
    const rateLimiter = getChatRateLimiter();
    const rateCheck = rateLimiter.check(userId);
    if (!rateCheck.allowed) {
      const usageInfo = rateLimiter.getUsage(userId);
      return {
        message: '\u23f3 Rate limit reached. Please try again later.',
        usage: {
          minuteRemaining: usageInfo.perMinuteLimit - usageInfo.minuteCount,
          dayRemaining: usageInfo.perDayLimit - usageInfo.dayCount,
        },
      };
    }

    // Consume a request
    rateLimiter.consume(userId);
    const usageInfo = rateLimiter.getUsage(userId);
    const usage = {
      minuteRemaining: usageInfo.perMinuteLimit - usageInfo.minuteCount,
      dayRemaining: usageInfo.perDayLimit - usageInfo.dayCount,
    };

    // Build conversation history for Gemini
    const geminiHistory = this.buildGeminiHistory(history);
    const conversationHistory: Content[] = [
      ...geminiHistory,
      { role: 'user', parts: [{ text: message }] },
    ];

    console.log(`[Chat] ── New request: "${message.substring(0, 80)}${message.length > 80 ? '…' : ''}" (history=${history.length})`);

    // ── Initial API call ──
    let response;
    try {
      response = await this.callGemini(conversationHistory, 'initial', userId);
    } catch {
      return {
        message: 'Sorry, I encountered an error connecting to the AI service. Please try again.',
        usage,
      };
    }

    // ── Function calling loop ──
    let toolRounds = 0;

    while (toolRounds < MAX_TOOL_ROUNDS) {
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        console.log('[Chat] No candidate parts — ending loop');
        break;
      }

      // Check for function calls in the response
      const functionCalls = candidate.content.parts.filter(
        (part): part is Part & { functionCall: FunctionCall } =>
          'functionCall' in part && !!part.functionCall
      );

      if (functionCalls.length === 0) {
        break; // Model gave a text response — we're done
      }

      toolRounds++;
      const toolNames = functionCalls.map(fc => fc.functionCall.name).join(', ');
      console.log(`[Chat] Tool round ${toolRounds}/${MAX_TOOL_ROUNDS}: ${toolNames}`);

      // Add model's function call to conversation history
      conversationHistory.push({
        role: 'model',
        parts: candidate.content.parts,
      });

      // Execute all function calls in parallel
      const functionResponses = await Promise.all(
        functionCalls.map(async (fc) => {
          const toolName = fc.functionCall.name;
          const args = (fc.functionCall.args ?? {}) as Record<string, unknown>;

          if (!toolName) {
            console.warn('[Chat] Function call with no name — skipping');
            return { functionResponse: { name: 'unknown', response: { error: 'Function call missing name' } } };
          }

          const toolStart = Date.now();
          try {
            const result = await this.toolRunner.execute(toolName, args);
            const resultSize = JSON.stringify(result).length;
            console.log(`[Chat]   ↳ ${toolName}(${JSON.stringify(args)}) — ${Date.now() - toolStart}ms, ${resultSize} bytes`);
            return { functionResponse: { name: toolName, response: { result } } };
          } catch (error) {
            console.error(`[Chat]   ↳ ${toolName} FAILED (${Date.now() - toolStart}ms):`, error instanceof Error ? error.message : error);
            return {
              functionResponse: {
                name: toolName,
                response: { error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` },
              },
            };
          }
        })
      );

      // Add function responses to conversation history
      conversationHistory.push({
        role: 'user',
        parts: functionResponses as Part[],
      });

      // Send function results back to the model
      try {
        response = await this.callGemini(conversationHistory, `tool-response round ${toolRounds}`, userId);
      } catch {
        return {
          message: 'Sorry, I encountered an error processing the data. Please try again.',
          usage,
        };
      }
    }

    // ── Extract final text ──
    const textResponse = this.extractTextResponse(response);

    const totalElapsed = Date.now() - requestStart;
    if (toolRounds >= MAX_TOOL_ROUNDS) {
      console.warn(`[Chat] ── Hit max tool rounds (${MAX_TOOL_ROUNDS})`);
    }
    console.log(`[Chat] ── Done: ${toolRounds} tool round(s), ${textResponse?.length ?? 0} chars, ${totalElapsed}ms total`);

    return {
      message: textResponse || 'I was unable to formulate a response. Could you rephrase your question?',
      usage,
    };
  }

  /**
   * Convert our ChatMessage format to Gemini's Content format.
   */
  private buildGeminiHistory(history: ChatMessage[]): Content[] {
    const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
    return trimmed.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Extract text from the final response.
   */
  private extractTextResponse(result: unknown): string | null {
    const r = result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const candidate = r.candidates?.[0];
    if (!candidate?.content?.parts) return null;

    const textParts = candidate.content.parts
      .filter(part => 'text' in part && part.text)
      .map(part => part.text!);

    return textParts.join('\n') || null;
  }
}
