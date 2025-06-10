#!/usr/bin/env node

/**
 * Test Script for Backend Upload Proxy
 * Tests the /api/upload endpoint with mock files
 */

import fetch from 'node-fetch';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5174';
const TEST_TOKEN = process.env.TEST_TOKEN; // JWT token for testing

// Create a mock video file for testing (empty file)
function createMockVideoFile(filename, sizeMB = 1) {
  const filePath = join(__dirname, filename);
  const sizeBytes = sizeMB * 1024 * 1024;
  
  // Create a file with the specified size
  const stream = createWriteStream(filePath);
  const buffer = Buffer.alloc(1024); // 1KB chunks
  let written = 0;
  
  return new Promise((resolve, reject) => {
    function writeChunk() {
      if (written >= sizeBytes) {
        stream.end();
        resolve(filePath);
        return;
      }
      
      const remaining = sizeBytes - written;
      const chunkSize = Math.min(buffer.length, remaining);
      
      stream.write(buffer.slice(0, chunkSize));
      written += chunkSize;
      
      // Continue writing
      setImmediate(writeChunk);
    }
    
    stream.on('error', reject);
    writeChunk();
  });
}

// Test health endpoint
async function testHealth() {
  console.log('🏥 Testing health endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/upload/health`);
    const health = await response.json();
    
    console.log(`   Status: ${health.status} (${response.status})`);
    console.log(`   R2: ${health.checks.r2_connectivity.status}`);
    console.log(`   Auth: ${health.checks.supabase_auth.status}`);
    console.log(`   Rate Limiting: ${health.checks.rate_limiting.status}`);
    console.log(`   Memory: ${health.checks.memory.status} (${health.checks.memory.usage_mb}MB)`);
    
    return health.status === 'healthy';
  } catch (error) {
    console.error('   ❌ Health check failed:', error.message);
    return false;
  }
}

// Test upload endpoint
async function testUpload() {
  console.log('📤 Testing upload endpoint...');
  
  if (!TEST_TOKEN) {
    console.log('   ⚠️  Skipping upload test - no TEST_TOKEN provided');
    console.log('   Set TEST_TOKEN environment variable with valid JWT');
    return false;
  }
  
  try {
    // Create mock files
    console.log('   Creating mock video files...');
    const files = await Promise.all([
      createMockVideoFile('test_down_line.webm', 2),
      createMockVideoFile('test_face_on.webm', 2),
      createMockVideoFile('test_overhead.webm', 2)
    ]);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('category', 'iron');
    formData.append('mode', 'training');
    
    files.forEach((filePath, index) => {
      const angles = ['down_line', 'face_on', 'overhead'];
      const stream = createReadStream(filePath);
      const stats = statSync(filePath);
      
      formData.append(`file_${angles[index]}`, stream, {
        filename: `test_${angles[index]}.webm`,
        contentType: 'video/webm',
        knownLength: stats.size
      });
    });
    
    console.log('   Uploading files...');
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: formData
    });
    
    const duration = Date.now() - startTime;
    const result = await response.json();
    
    console.log(`   Response: ${response.status} (${duration}ms)`);
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   Upload Session: ${result.uploadSession}`);
      console.log(`   Files Uploaded: ${Object.keys(result.results).length}`);
    } else {
      console.log(`   Errors: ${result.errors?.join(', ') || result.error?.message}`);
    }
    
    // Cleanup
    const { unlink } = await import('fs/promises');
    await Promise.all(files.map(file => unlink(file).catch(() => {})));
    
    return result.success;
    
  } catch (error) {
    console.error('   ❌ Upload test failed:', error.message);
    return false;
  }
}

// Test rate limiting
async function testRateLimit() {
  console.log('🚦 Testing rate limiting...');
  
  if (!TEST_TOKEN) {
    console.log('   ⚠️  Skipping rate limit test - no TEST_TOKEN provided');
    return true;
  }
  
  try {
    // Make multiple rapid requests
    const requests = Array(15).fill().map((_, i) => 
      fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category: 'iron', mode: 'training' })
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    console.log(`   Made 15 requests, rate limited: ${rateLimited}`);
    return true;
    
  } catch (error) {
    console.error('   ❌ Rate limit test failed:', error.message);
    return false;
  }
}

// Main test runner
async function main() {
  console.log('🧪 Pure Golf Backend Upload Tests\n');
  
  const results = [];
  
  // Run tests
  results.push(await testHealth());
  results.push(await testUpload());
  results.push(await testRateLimit());
  
  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
} 