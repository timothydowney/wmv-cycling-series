#!/usr/bin/env node
/**
 * Test script for export/import endpoints
 * Tests both API endpoints locally
 */

const http = require('http');

// Test export
function testExport() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/admin/export-data',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ Export successful!');
          console.log('Exported data structure:');
          console.log(`  - Participants: ${json.data.participants.length}`);
          console.log(`  - Segments: ${json.data.segments.length}`);
          console.log(`  - Seasons: ${json.data.seasons.length}`);
          console.log(`  - Weeks: ${json.data.weeks.length}`);
          console.log('\nSample export:');
          console.log(JSON.stringify(json, null, 2).substring(0, 500));
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse export: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Test import
function testImport(exportData) {
  return new Promise((resolve, reject) => {
    const importData = JSON.stringify({ data: exportData.data });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/admin/import-data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(importData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('\n✅ Import successful!');
          console.log('Imported:');
          console.log(`  - Participants: ${json.imported.participants}`);
          console.log(`  - Segments: ${json.imported.segments}`);
          console.log(`  - Seasons: ${json.imported.seasons}`);
          console.log(`  - Weeks: ${json.imported.weeks}`);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse import response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(importData);
    req.end();
  });
}

async function main() {
  try {
    console.log('🧪 Testing Export/Import Endpoints\n');
    
    // Test export
    const exported = await testExport();
    
    // Test import
    await testImport(exported);
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
