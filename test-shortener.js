/**
 * Automated test script to verify all core features of the URL Shortener
 */
const http = require('http');
const app = require('./server');

const TEST_PORT = 3001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || data
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting URL Shortener test suite...');
  const server = app.listen(TEST_PORT);

  try {
    // Test 1: Health / Homepage
    console.log('Test 1: Checking homepage (GET /)...');
    const homeRes = await request('GET', '/');
    if (homeRes.statusCode === 200) {
      console.log('✅ Homepage rendered successfully (200 OK)');
    } else {
      throw new Error(`Homepage returned status ${homeRes.statusCode}`);
    }

    // Test 2: Create short URL via API
    console.log('Test 2: Creating short URL via API (POST /api/shorten)...');
    const createRes = await request('POST', '/api/shorten', {
      url: 'https://en.wikipedia.org/wiki/URL_shortening',
      customCode: 'wiki-test'
    });

    if (createRes.statusCode === 201 && createRes.data.success && createRes.data.shortCode === 'wiki-test') {
      console.log('✅ Short URL created successfully:', createRes.data.shortUrl);
    } else {
      throw new Error(`Failed to create short URL: ${JSON.stringify(createRes.data)}`);
    }

    // Test 3: Test Redirection (GET /wiki-test)
    console.log('Test 3: Testing redirection route (GET /wiki-test)...');
    const redirectRes = await request('GET', '/wiki-test');
    if (redirectRes.statusCode === 302 && redirectRes.headers.location === 'https://en.wikipedia.org/wiki/URL_shortening') {
      console.log('✅ Redirection verified: Redirects to target URL (302 Found)');
    } else {
      throw new Error(`Redirection failed: Status ${redirectRes.statusCode}, Location: ${redirectRes.headers.location}`);
    }

    // Test 4: Check Click Tracking
    console.log('Test 4: Verifying click count incrementation (GET /api/urls/wiki-test)...');
    const statsRes = await request('GET', '/api/urls/wiki-test');
    if (statsRes.statusCode === 200 && statsRes.data.data.clicks >= 1) {
      console.log(`✅ Click count incremented successfully! Total clicks: ${statsRes.data.data.clicks}`);
    } else {
      throw new Error(`Click count verification failed: ${JSON.stringify(statsRes.data)}`);
    }

    // Test 5: Custom Alias Collision
    console.log('Test 5: Testing duplicate alias rejection...');
    const dupRes = await request('POST', '/api/shorten', {
      url: 'https://google.com',
      customCode: 'wiki-test'
    });
    if (dupRes.statusCode === 409) {
      console.log('✅ Duplicate alias rejected as expected (409 Conflict)');
    } else {
      throw new Error(`Duplicate alias was not rejected: Status ${dupRes.statusCode}`);
    }

    // Test 6: Delete short link
    console.log('Test 6: Deleting short link (DELETE /api/urls/wiki-test)...');
    const deleteRes = await request('DELETE', '/api/urls/wiki-test');
    if (deleteRes.statusCode === 200 && deleteRes.data.success) {
      console.log('✅ Short URL deleted successfully');
    } else {
      throw new Error(`Deletion failed: ${JSON.stringify(deleteRes.data)}`);
    }

    // Test 7: Verify 404 for deleted or nonexistent link
    console.log('Test 7: Verifying 404 response for deleted link (GET /wiki-test)...');
    const notFoundRes = await request('GET', '/wiki-test');
    if (notFoundRes.statusCode === 404) {
      console.log('✅ 404 handled gracefully for non-existent link');
    } else {
      throw new Error(`Expected 404, got ${notFoundRes.statusCode}`);
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The URL Shortener is 100% working!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
