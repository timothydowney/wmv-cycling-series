/**
 * test-gemini.ts
 *
 * Quick diagnostic script to test Gemini API connectivity,
 * model availability, and function calling with @google/genai SDK.
 *
 * Usage: npx tsx scripts/test-gemini.ts
 */

import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY not set in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testBasicChat() {
  console.log('=== Test 1: Basic Chat (no tools) ===');
  console.log(`Model: ${modelName}`);
  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: 'Say hello in exactly 5 words.' }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 256,
      },
    });

    const elapsed = Date.now() - start;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`  Response: ${text}`);
    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Finish reason: ${response.candidates?.[0]?.finishReason}`);
    console.log('  PASS ✅');
    return true;
  } catch (error: any) {
    const elapsed = Date.now() - start;
    console.error(`  FAIL ❌ after ${elapsed}ms:`, error.message || error);
    return false;
  }
}

async function testFunctionCalling() {
  console.log('\n=== Test 2: Function Calling ===');
  const start = Date.now();

  const tools = [{
    functionDeclarations: [{
      name: 'get_current_season',
      description: 'Get the currently active season.',
      parameters: {
        type: Type.OBJECT as const,
        properties: {},
      },
    }],
  }];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [{ text: 'What season is currently running?' }],
      }],
      config: {
        systemInstruction: 'You are a cycling competition assistant. Use tools to answer questions about the competition.',
        temperature: 0.7,
        maxOutputTokens: 1024,
        tools,
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
    });

    const elapsed = Date.now() - start;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Finish reason: ${candidate?.finishReason}`);
    console.log(`  Parts count: ${parts.length}`);

    for (const part of parts) {
      if ('functionCall' in part && part.functionCall) {
        console.log(`  Function call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args)})`);
      }
      if ('text' in part && part.text) {
        console.log(`  Text: ${part.text.substring(0, 100)}`);
      }
    }

    const hasFnCall = parts.some((p: any) => 'functionCall' in p);
    if (hasFnCall) {
      console.log('  PASS ✅ (model requested function call)');
    } else {
      console.log('  WARN ⚠️ (model did not request function call)');
    }

    return { response, hasFnCall };
  } catch (error: any) {
    const elapsed = Date.now() - start;
    console.error(`  FAIL ❌ after ${elapsed}ms:`, error.message || error);
    return { response: null, hasFnCall: false };
  }
}

async function testFunctionResponse() {
  console.log('\n=== Test 3: Full Function Call Loop ===');
  const start = Date.now();

  const tools = [{
    functionDeclarations: [{
      name: 'get_current_season',
      description: 'Get the currently active season.',
      parameters: {
        type: Type.OBJECT as const,
        properties: {},
      },
    }],
  }];

  const config = {
    systemInstruction: 'You are a cycling competition assistant. Use tools to answer questions.',
    temperature: 0.7,
    maxOutputTokens: 1024,
    tools,
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  };

  try {
    // Step 1: Send user message
    console.log('  Step 1: Sending user message...');
    const step1Start = Date.now();
    const response1 = await ai.models.generateContent({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [{ text: 'What season is currently active?' }],
      }],
      config,
    });
    console.log(`  Step 1 time: ${Date.now() - step1Start}ms`);

    const candidate = response1.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const fnCall = parts.find((p: any) => 'functionCall' in p);

    if (!fnCall || !('functionCall' in fnCall)) {
      console.log('  Model did not call a function. Text response:', parts[0]);
      return;
    }

    console.log(`  Model called: ${fnCall.functionCall!.name}`);

    // Step 2: Send function response back
    console.log('  Step 2: Sending function response...');
    const step2Start = Date.now();

    const conversationHistory = [
      { role: 'user' as const, parts: [{ text: 'What season is currently active?' }] },
      { role: 'model' as const, parts: candidate!.content!.parts! },
      {
        role: 'user' as const,
        parts: [{
          functionResponse: {
            name: 'get_current_season',
            response: {
              result: {
                id: 5,
                name: 'Winter 2026',
                start_date: '2025-12-01',
                end_date: '2026-03-15',
                status: 'Currently active',
              },
            },
          },
        }],
      },
    ];

    const response2 = await ai.models.generateContent({
      model: modelName,
      contents: conversationHistory,
      config,
    });

    console.log(`  Step 2 time: ${Date.now() - step2Start}ms`);

    const candidate2 = response2.candidates?.[0];
    const textParts = candidate2?.content?.parts?.filter((p: any) => 'text' in p && p.text) || [];
    const finalText = textParts.map((p: any) => p.text).join('\n');

    console.log(`  Final response: ${finalText.substring(0, 200)}`);
    console.log(`  Total time: ${Date.now() - start}ms`);
    console.log('  PASS ✅');
  } catch (error: any) {
    const elapsed = Date.now() - start;
    console.error(`  FAIL ❌ after ${elapsed}ms:`, error.message || error);
    if (error.response) {
      console.error('  Response body:', JSON.stringify(error.response, null, 2));
    }
  }
}

async function testManyTools() {
  console.log('\n=== Test 4: Many Tools (16 declarations) ===');
  const start = Date.now();

  // Import actual tool definitions
  const { getAllToolDefinitions } = await import('../src/services/ChatToolDefinitions');
  const toolDefs = getAllToolDefinitions();
  console.log(`  Tool count: ${toolDefs.length}`);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [{ text: 'Who is leading the current season standings?' }],
      }],
      config: {
        systemInstruction: 'You are a cycling competition assistant. Use tools to answer questions about standings, leaderboards, and athlete performance.',
        temperature: 0.7,
        maxOutputTokens: 2048,
        tools: [{ functionDeclarations: toolDefs }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
    });

    const elapsed = Date.now() - start;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Finish reason: ${candidate?.finishReason}`);

    for (const part of parts) {
      if ('functionCall' in part && part.functionCall) {
        console.log(`  Function call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args)})`);
      }
      if ('text' in part && part.text) {
        console.log(`  Text: "${part.text.substring(0, 100)}"`);
      }
    }

    console.log('  PASS ✅');
  } catch (error: any) {
    const elapsed = Date.now() - start;
    console.error(`  FAIL ❌ after ${elapsed}ms:`, error.message || error);
  }
}

async function main() {
  console.log(`\n🔧 Gemini API Diagnostic Tool`);
  console.log(`   API Key: ${apiKey!.substring(0, 8)}...${apiKey!.substring(apiKey!.length - 4)}`);
  console.log(`   Model: ${modelName}\n`);

  const basicOk = await testBasicChat();
  if (!basicOk) {
    console.log('\n❌ Basic chat failed. Check API key and model name.');
    process.exit(1);
  }

  await testFunctionCalling();
  await testFunctionResponse();
  await testManyTools();

  console.log('\n✅ All diagnostics complete.');
}

main().catch(console.error);
