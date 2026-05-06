const express = require("express");
const Database = require("better-sqlite3");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const HOSTNAME = '127.0.0.1';

const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
