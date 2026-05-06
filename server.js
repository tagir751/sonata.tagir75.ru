const express = require("express");
const Database = require("better-sqlite3");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOSTNAME || '127.0.0.1';

// Путь к базе данных - используем папку data
const dbPath = path.join(__dirname, 'data', 'app.db');

// Создаём папку data, если её нет
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Инициализация таблиц (если ещё не созданы)
function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL
        )
    `);
}

initDB();

app.listen(PORT, HOSTNAME, () => {
    console.log(`Server started successfully on http://${HOSTNAME}:${PORT}`);
});
