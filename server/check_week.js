const Database = require('better-sqlite3');
const db = new Database('data/wmv.db');

try {
    const weeks = db.prepare('SELECT id, week_name FROM week ORDER BY start_at DESC LIMIT 3').all();
    console.log(JSON.stringify(weeks, null, 2));
} catch (err) {
    console.error(err);
}
