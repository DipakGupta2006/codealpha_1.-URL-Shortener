const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Database file path
const dbPath = path.join(__dirname, 'urls.db');
const db = new DatabaseSync(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME
  )
`);

// Create index for faster lookup on short_code
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
`);

/**
 * Insert a new short URL mapping
 */
function createUrl(shortCode, originalUrl) {
  const stmt = db.prepare(`
    INSERT INTO urls (short_code, original_url)
    VALUES (?, ?)
  `);
  stmt.run(shortCode, originalUrl);
  return getUrlByCode(shortCode);
}

/**
 * Fetch a URL record by its short code
 */
function getUrlByCode(shortCode) {
  const stmt = db.prepare(`
    SELECT * FROM urls WHERE short_code = ?
  `);
  return stmt.get(shortCode);
}

/**
 * Increment click count and record last access time
 */
function incrementClicks(shortCode) {
  const stmt = db.prepare(`
    UPDATE urls
    SET clicks = clicks + 1,
        last_accessed = CURRENT_TIMESTAMP
    WHERE short_code = ?
  `);
  stmt.run(shortCode);
}

/**
 * Fetch all URLs ordered by most recent
 */
function getAllUrls(limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM urls
    ORDER BY id DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Delete a URL by short code
 */
function deleteUrl(shortCode) {
  const stmt = db.prepare(`
    DELETE FROM urls WHERE short_code = ?
  `);
  stmt.run(shortCode);
}

/**
 * Get overall statistics
 */
function getStats() {
  const totalUrlsStmt = db.prepare(`SELECT COUNT(*) as totalUrls FROM urls`);
  const totalClicksStmt = db.prepare(`SELECT SUM(clicks) as totalClicks FROM urls`);
  
  const totalUrls = totalUrlsStmt.get()?.totalUrls || 0;
  const totalClicks = totalClicksStmt.get()?.totalClicks || 0;
  
  return {
    totalUrls,
    totalClicks
  };
}

module.exports = {
  createUrl,
  getUrlByCode,
  incrementClicks,
  getAllUrls,
  deleteUrl,
  getStats
};
