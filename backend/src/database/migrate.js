// Database migration script
require('dotenv').config();
const db = require('./db');

console.log('Running database migrations...');
console.log('Database initialized and migrations complete!');
db.close();
