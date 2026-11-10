const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Reserved keywords to prevent collision with application routes
const RESERVED_WORDS = new Set([
  'api', 'stats', 'urls', 'css', 'js', 'images', 'favicon.ico', 'shorten'
]);

// Configure EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Helper: Validate URL structure
 */
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Helper: Generate cryptographically secure random alphanumeric code
 */
function generateShortCode(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Helper: Get current base URL (e.g. http://localhost:3000)
 */
function getHostUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

// ==========================================
// Web Frontend Routes
// ==========================================

/**
 * GET /
 * Main Dashboard: Shortener input, stats counter, recent links list
 */
app.get('/', (req, res) => {
  const urls = db.getAllUrls(50);
  const stats = db.getStats();
  const hostUrl = getHostUrl(req);
  
  let latestUrl = null;
  if (req.query.created) {
    latestUrl = db.getUrlByCode(req.query.created);
  }

  res.render('index', {
    title: 'NanoLink | Fast & Simple URL Shortener',
    hostUrl,
    urls,
    stats,
    latestUrl,
    error: req.query.error || null,
    success: req.query.success || null
  });
});

/**
 * POST /shorten
 * Form submission from homepage
 */
app.post('/shorten', (req, res) => {
  let { url, customCode } = req.body;
  url = (url || '').trim();
  customCode = (customCode || '').trim();

  // Validate URL
  if (!url || !isValidUrl(url)) {
    return res.redirect('/?error=' + encodeURIComponent('Please enter a valid URL starting with http:// or https://'));
  }

  let code = customCode;

  if (code) {
    // Validate custom code format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9-_]{3,30}$/.test(code)) {
      return res.redirect('/?error=' + encodeURIComponent('Custom alias must be 3-30 characters containing only letters, numbers, hyphens, or underscores.'));
    }

    if (RESERVED_WORDS.has(code.toLowerCase())) {
      return res.redirect('/?error=' + encodeURIComponent('That custom alias is a reserved system route. Please choose another.'));
    }

    // Check if alias already exists
    const existing = db.getUrlByCode(code);
    if (existing) {
      return res.redirect('/?error=' + encodeURIComponent(`Custom alias "${code}" is already in use. Please pick another one.`));
    }
  } else {
    // Generate unique short code with collision handling
    let attempts = 0;
    do {
      code = generateShortCode(6);
      attempts++;
    } while ((db.getUrlByCode(code) || RESERVED_WORDS.has(code.toLowerCase())) && attempts < 10);
  }

  try {
    db.createUrl(code, url);
    return res.redirect(`/?created=${encodeURIComponent(code)}&success=${encodeURIComponent('URL successfully shortened!')}#latestResultCard`);
  } catch (err) {
    console.error('Error creating URL:', err);
    return res.redirect('/?error=' + encodeURIComponent('Failed to shorten URL. Please try again.'));
  }
});

/**
 * GET /stats/:code
 * Individual link analytics and QR code page
 */
app.get('/stats/:code', (req, res) => {
  const { code } = req.params;
  const urlRecord = db.getUrlByCode(code);

  if (!urlRecord) {
    return res.status(404).render('404', {
      title: 'Link Not Found',
      hostUrl: getHostUrl(req)
    });
  }

  res.render('stats', {
    title: `Analytics for /${code}`,
    hostUrl: getHostUrl(req),
    urlRecord
  });
});

/**
 * POST /urls/delete/:code
 * Delete short link from web interface
 */
app.post('/urls/delete/:code', (req, res) => {
  const { code } = req.params;
  db.deleteUrl(code);
  res.redirect('/?success=' + encodeURIComponent(`Short URL /${code} was deleted successfully.`));
});

// ==========================================
// REST API Endpoints
// ==========================================

/**
 * POST /api/shorten
 * JSON API to create a short URL
 */
app.post('/api/shorten', (req, res) => {
  let { url, customCode } = req.body;
  url = (url || '').trim();
  customCode = (customCode || '').trim();

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL. Please provide a valid absolute URL starting with http:// or https://'
    });
  }

  let code = customCode;

  if (code) {
    if (!/^[a-zA-Z0-9-_]{3,30}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Custom alias must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores.'
      });
    }

    if (RESERVED_WORDS.has(code.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'The requested custom alias is a reserved system path.'
      });
    }

    const existing = db.getUrlByCode(code);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Custom alias "${code}" is already in use.`
      });
    }
  } else {
    let attempts = 0;
    do {
      code = generateShortCode(6);
      attempts++;
    } while ((db.getUrlByCode(code) || RESERVED_WORDS.has(code.toLowerCase())) && attempts < 10);
  }

  try {
    const record = db.createUrl(code, url);
    const hostUrl = getHostUrl(req);

    return res.status(201).json({
      success: true,
      shortCode: record.short_code,
      shortUrl: `${hostUrl}/${record.short_code}`,
      originalUrl: record.original_url,
      clicks: record.clicks,
      createdAt: record.created_at
    });
  } catch (err) {
    console.error('API create error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while saving URL.'
    });
  }
});

/**
 * GET /api/urls
 * JSON API to fetch list of all URLs
 */
app.get('/api/urls', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const urls = db.getAllUrls(limit);
  const hostUrl = getHostUrl(req);

  const formattedUrls = urls.map(item => ({
    ...item,
    short_url: `${hostUrl}/${item.short_code}`
  }));

  res.json({
    success: true,
    count: formattedUrls.length,
    data: formattedUrls
  });
});

/**
 * GET /api/urls/:code
 * JSON API to fetch single URL statistics
 */
app.get('/api/urls/:code', (req, res) => {
  const { code } = req.params;
  const urlRecord = db.getUrlByCode(code);

  if (!urlRecord) {
    return res.status(404).json({
      success: false,
      error: 'Short URL code not found.'
    });
  }

  const hostUrl = getHostUrl(req);
  res.json({
    success: true,
    data: {
      ...urlRecord,
      short_url: `${hostUrl}/${urlRecord.short_code}`
    }
  });
});

/**
 * DELETE /api/urls/:code
 * JSON API to delete a short URL
 */
app.delete('/api/urls/:code', (req, res) => {
  const { code } = req.params;
  const existing = db.getUrlByCode(code);

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: 'Short URL code not found.'
    });
  }

  db.deleteUrl(code);
  res.json({
    success: true,
    message: `Short URL /${code} successfully deleted.`
  });
});

// ==========================================
// Short URL Redirection Route
// ==========================================

/**
 * GET /:code
 * Looks up short code, increments click counter, and redirects to target URL
 */
app.get('/:code', (req, res) => {
  const { code } = req.params;

  // Ignore reserved words or static asset patterns
  if (RESERVED_WORDS.has(code.toLowerCase())) {
    return res.status(404).render('404', {
      title: 'Page Not Found',
      hostUrl: getHostUrl(req)
    });
  }

  const urlRecord = db.getUrlByCode(code);

  if (!urlRecord) {
    return res.status(404).render('404', {
      title: 'Short Link Not Found',
      hostUrl: getHostUrl(req)
    });
  }

  // Increment clicks in database asynchronously
  db.incrementClicks(code);

  // Perform 302 temporary redirect to original destination
  return res.redirect(urlRecord.original_url);
});

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    hostUrl: getHostUrl(req)
  });
});

// Start the server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 NanoLink URL Shortener is running!`);
    console.log(`📡 Local server: http://localhost:${PORT}`);
    console.log(`💾 Database: SQLite (urls.db)`);
    console.log(`===============================================`);
  });
}

module.exports = app;
