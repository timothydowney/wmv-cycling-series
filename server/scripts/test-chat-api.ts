/**
 * test-chat-api.ts  
 *
 * Quick E2E smoke test: calls the backend chat tRPC endpoint directly,
 * authenticating with the admin session cookie.
 *
 * Usage: npx tsx scripts/test-chat-api.ts
 */
import * as http from 'http';

const BACKEND = 'http://localhost:3001';

/**
 * Make a raw HTTP POST to the tRPC endpoint.
 * We bypass session auth by calling the service directly from a script
 * that imports ChatService—much simpler than faking cookies.
 */
async function testChatDirect() {
  const dotenv = await import('dotenv');
  const path = await import('path');
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  // Ensure DATABASE_PATH resolves correctly relative to server/
  // The .env says "./data/wmv.db" which is relative to server/, not project root
  const serverDir = path.resolve(__dirname, '..');
  if (process.env.DATABASE_PATH && !path.isAbsolute(process.env.DATABASE_PATH)) {
    process.env.DATABASE_PATH = path.resolve(serverDir, process.env.DATABASE_PATH);
  }

  const { drizzleDb } = await import('../src/db');
  const { ChatService } = await import('../src/services/ChatService');

  const chatService = new ChatService(drizzleDb);

  console.log('\n=== Chat API Smoke Test ===\n');

  // Hard real-world queries that require reasoning and fuzzy matching
  const questions = [
    'Compare Tim and Mike\'s performance this season',
    'How does that compare to Michael and Tim for the Fall 2025 season?',
  ];

  const history: Array<{ role: 'user' | 'model'; content: string }> = [];

  for (const question of questions) {
    console.log(`Q: "${question}"`);
    const start = Date.now();
    try {
      // Using Tim Downey's athlete ID as the test user (366880)
      const result = await chatService.chat('366880', question, history);
      const elapsed = Date.now() - start;
      
      // Add to history for follow-up questions
      history.push({ role: 'user', content: question });
      history.push({ role: 'model', content: result.message });
      
      console.log(`A: ${result.message}`);
      console.log(`   (${elapsed}ms)\n`);
    } catch (error: any) {
      const elapsed = Date.now() - start;
      console.error(`   ERROR after ${elapsed}ms: ${error.message}\n`);
    }
  }
}

testChatDirect().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
