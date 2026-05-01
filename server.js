const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Database initialization
const db = new sqlite3.Database('./sonata.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Подключено к SQLite базе данных');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Таблица пользователей (реализаторы, агенты, менеджеры)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('manager', 'seller', 'agent')),
        fullName TEXT,
        salesPointId INTEGER,
        isActive BOOLEAN DEFAULT 1,
        cashOnHand REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица точек продаж
    db.run(`CREATE TABLE IF NOT EXISTS salesPoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        address TEXT,
        isActive BOOLEAN DEFAULT 1
    )`);

    // Таблица агентов (гостиницы и т.д.)
    db.run(`CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        salesPointId INTEGER,
        isActive BOOLEAN DEFAULT 1,
        cashOnHand REAL DEFAULT 0
    )`);

    // Таблица экскурсий (справочник)
    db.run(`CREATE TABLE IF NOT EXISTS excursions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        basePrice REAL,
        isActive BOOLEAN DEFAULT 1
    )`);

    // Таблица шаблонов маршрутов (посадок)
    db.run(`CREATE TABLE IF NOT EXISTS routeTemplates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT
    )`);

    // Таблица точек посадки в шаблоне
    db.run(`CREATE TABLE IF NOT EXISTS routeStops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        templateId INTEGER NOT NULL,
        stopName TEXT NOT NULL,
        stopOrder INTEGER NOT NULL,
        stopTime TEXT NOT NULL,
        FOREIGN KEY (templateId) REFERENCES routeTemplates(id) ON DELETE CASCADE
    )`);

    // Таблица активных экскурсий (экскурсия + дата + шаблон)
    db.run(`CREATE TABLE IF NOT EXISTS activeExcursions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        excursionId INTEGER NOT NULL,
        excursionDate DATE NOT NULL,
        routeTemplateId INTEGER NOT NULL,
        isActive BOOLEAN DEFAULT 1,
        FOREIGN KEY (excursionId) REFERENCES excursions(id),
        FOREIGN KEY (routeTemplateId) REFERENCES routeTemplates(id)
    )`);

    // Таблица водителей
    db.run(`CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT
    )`);

    // Таблица экскурсоводов
    db.run(`CREATE TABLE IF NOT EXISTS guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT
    )`);

    // Таблица продаж
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activeExcursionId INTEGER NOT NULL,
        sellerUsername TEXT NOT NULL,
        salesPointId INTEGER,
        passengerSurname TEXT NOT NULL,
        passengerPhone TEXT,
        stopName TEXT NOT NULL,
        stopTime TEXT,
        fullPrice REAL NOT NULL,
        prepaidAmount REAL NOT NULL,
        debtAmount REAL DEFAULT 0,
        note TEXT,
        isDebtRecord BOOLEAN DEFAULT 0,
        saleDate DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activeExcursionId) REFERENCES activeExcursions(id)
    )`);

    // Таблица чата
    db.run(`CREATE TABLE IF NOT EXISTS chatMessages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderUsername TEXT NOT NULL,
        senderRole TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица истории налички (снятия денег собственником)
    db.run(`CREATE TABLE IF NOT EXISTS cashHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        amountCollected REAL NOT NULL,
        collectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        collectedBy TEXT
    )`);

    console.log('База данных инициализирована');
}

// API Routes

// Авторизация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ? AND password = ? AND isActive = 1`, 
        [username, password], 
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                // Проверка агентов
                db.get(`SELECT a.*, sp.name as salesPointName FROM agents a 
                        LEFT JOIN salesPoints sp ON a.salesPointId = sp.id 
                        WHERE a.name = ? AND a.password = ? AND a.isActive = 1`, 
                    [username, password], 
                    (err, agent) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        if (agent) {
                            return res.json({ 
                                success: true, 
                                user: { 
                                    username: agent.name, 
                                    role: 'agent', 
                                    salesPoint: agent.salesPointName,
                                    cashOnHand: agent.cashOnHand
                                } 
                            });
                        }
                        res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
                    }
                );
            } else {
                res.json({ 
                    success: true, 
                    user: { 
                        username: user.username, 
                        role: user.role, 
                        fullName: user.fullName,
                        salesPointId: user.salesPointId,
                        cashOnHand: user.cashOnHand
                    } 
                });
            }
        }
    );
});

// Получение активных экскурсий
app.get('/api/active-excursions', (req, res) => {
    db.all(`SELECT ae.id, e.name as excursionName, ae.excursionDate, rt.name as routeName,
            (SELECT COUNT(*) FROM sales WHERE activeExcursionId = ae.id) as soldCount
            FROM activeExcursions ae
            JOIN excursions e ON ae.excursionId = e.id
            JOIN routeTemplates rt ON ae.routeTemplateId = rt.id
            WHERE ae.isActive = 1 AND ae.excursionDate >= date('now')
            ORDER BY ae.excursionDate, e.name`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Создание продажи (группы)
app.post('/api/sales', (req, res) => {
    const { 
        activeExcursionId, 
        sellerUsername, 
        salesPointId, 
        surname, 
        phone, 
        stopName, 
        stopTime, 
        fullPrice, 
        prepaidAmount, 
        debtAmount, 
        note, 
        quantity 
    } = req.body;

    const stmt = db.prepare(`INSERT INTO sales 
        (activeExcursionId, sellerUsername, salesPointId, passengerSurname, passengerPhone, 
         stopName, stopTime, fullPrice, prepaidAmount, debtAmount, note, isDebtRecord) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (let i = 0; i < quantity; i++) {
        const isDebt = (i === 0 && debtAmount > 0) ? 1 : 0;
        const debt = (i === 0) ? debtAmount : 0;
        stmt.run(activeExcursionId, sellerUsername, salesPointId, surname, phone, 
                 stopName, stopTime, fullPrice / quantity, prepaidAmount / quantity, debt, note, isDebt);
    }

    stmt.finalize((err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Обновление налички у реализатора
        db.run(`UPDATE users SET cashOnHand = cashOnHand + ? WHERE username = ?`, 
            [prepaidAmount, sellerUsername]);
        
        // Обновление налички у агента
        db.run(`UPDATE agents SET cashOnHand = cashOnHand + ? WHERE name = ?`, 
            [prepaidAmount, sellerUsername]);

        res.json({ success: true });
    });
});

// Получение списка продаж для экскурсии (для печати)
app.get('/api/sales/:activeExcursionId', (req, res) => {
    const { activeExcursionId } = req.params;
    
    db.all(`SELECT s.*, rs.stopOrder 
            FROM sales s
            JOIN routeStops rs ON s.stopName = rs.stopName AND rs.templateId = (
                SELECT routeTemplateId FROM activeExcursions WHERE id = ?
            )
            WHERE s.activeExcursionId = ?
            ORDER BY rs.stopOrder, s.id`, 
        [activeExcursionId, activeExcursionId], 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Получение справочников для менеджера
app.get('/api/admin-data', (req, res) => {
    const data = {};
    
    const tables = {
        users: 'users',
        salesPoints: 'salesPoints',
        agents: 'agents',
        excursions: 'excursions',
        routeTemplates: 'routeTemplates',
        drivers: 'drivers',
        guides: 'guides',
        activeExcursions: `SELECT ae.*, e.name as excursionName, rt.name as routeName 
                          FROM activeExcursions ae 
                          JOIN excursions e ON ae.excursionId = e.id 
                          JOIN routeTemplates rt ON ae.routeTemplateId = rt.id`
    };

    let completed = 0;
    const total = Object.keys(tables).length;

    Object.entries(tables).forEach(([key, query]) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                data[key] = [];
            } else {
                data[key] = rows;
            }
            completed++;
            if (completed === total) {
                res.json(data);
            }
        });
    });
});

// Чат - получение сообщений
app.get('/api/chat', (req, res) => {
    db.all(`SELECT * FROM chatMessages ORDER BY createdAt ASC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Чат - отправка сообщения
app.post('/api/chat', (req, res) => {
    const { senderUsername, senderRole, message } = req.body;
    
    db.run(`INSERT INTO chatMessages (senderUsername, senderRole, message) VALUES (?, ?, ?)`,
        [senderUsername, senderRole, message],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Снятие налички собственником
app.post('/api/collect-cash', (req, res) => {
    const { username, amount, collectedBy } = req.body;
    
    db.serialize(() => {
        db.run(`INSERT INTO cashHistory (username, amountCollected, collectedBy) VALUES (?, ?, ?)`,
            [username, amount, collectedBy]);
        
        db.run(`UPDATE users SET cashOnHand = 0 WHERE username = ?`, [username]);
        db.run(`UPDATE agents SET cashOnHand = 0 WHERE name = ?`, [username]);
        
        res.json({ success: true });
    });
});

// Экспорт в Excel
app.get('/api/export/excels', (req, res) => {
    const { type, startDate, endDate } = req.query;
    
    let query;
    if (type === 'sales') {
        query = `SELECT * FROM sales WHERE saleDate BETWEEN ? AND ?`;
        db.all(query, [startDate, endDate], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            exportToExcel(res, rows, 'sales');
        });
    } else {
        // Экспорт справочников
        const tables = ['users', 'salesPoints', 'agents', 'excursions', 'drivers', 'guides'];
        const workbook = XLSX.utils.book_new();
        
        let completed = 0;
        tables.forEach(table => {
            db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
                if (!err && rows.length > 0) {
                    const worksheet = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(workbook, worksheet, table);
                }
                completed++;
                if (completed === tables.length) {
                    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename=sonata-data.xlsx');
                    res.send(buffer);
                }
            });
        });
    }
});

function exportToExcel(res, data, filename) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}-${Date.now()}.xlsx`);
    res.send(buffer);
}

// Импорт из Excel (только добавление)
const upload = multer({ dest: 'uploads/' });
app.post('/api/import/excel', upload.single('file'), (req, res) => {
    const { type } = req.body;
    
    try {
        const workbook = XLSX.read(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        // Логика импорта в зависимости от типа
        // Только добавление новых записей, дубли пропускаются
        let added = 0;
        let skipped = 0;
        
        data.forEach(row => {
            // Проверка на дубли и вставка
            // Реализация зависит от типа данных
        });
        
        fs.unlinkSync(req.file.path);
        res.json({ success: true, added, skipped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
