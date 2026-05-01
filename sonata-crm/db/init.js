const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sonata.db');
const db = new sqlite3(dbPath);

// Создание таблиц
db.exec(`
  -- Пользователи (реализаторы, агенты, менеджеры)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager', 'seller', 'agent')),
    full_name TEXT,
    point_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Точки продаж
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Агенты (гостиницы и т.д.)
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    point_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Экскурсии (справочник)
  CREATE TABLE IF NOT EXISTS excursions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Шаблоны маршрутов
  CREATE TABLE IF NOT EXISTS route_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );

  -- Точки посадок в шаблонах
  CREATE TABLE IF NOT EXISTS route_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    point_name TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    time TEXT NOT NULL,
    FOREIGN KEY (template_id) REFERENCES route_templates(id) ON DELETE CASCADE
  );

  -- Активные экскурсии (расписание)
  CREATE TABLE IF NOT EXISTS active_excursions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    excursion_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    template_id INTEGER,
    guide_id INTEGER,
    driver_id INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (excursion_id) REFERENCES excursions(id),
    FOREIGN KEY (template_id) REFERENCES route_templates(id),
    FOREIGN KEY (guide_id) REFERENCES guides(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
  );

  -- Водители
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT,
    car_info TEXT,
    active INTEGER DEFAULT 1
  );

  -- Экскурсоводы
  CREATE TABLE IF NOT EXISTS guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1
  );

  -- Продажи
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    active_excursion_id INTEGER NOT NULL,
    seller_username TEXT NOT NULL,
    group_id TEXT,
    tourist_surname TEXT NOT NULL,
    phone TEXT,
    point_id INTEGER,
    seat_order INTEGER,
    payment_time TEXT,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL,
    debt_amount REAL DEFAULT 0,
    note TEXT,
    is_debt_record INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (active_excursion_id) REFERENCES active_excursions(id)
  );

  -- Касса реализаторов
  CREATE TABLE IF NOT EXISTS cashbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL DEFAULT 0,
    last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Чат
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username TEXT NOT NULL,
    message TEXT NOT NULL,
    is_manager INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Индексы для производительности
  CREATE INDEX IF NOT EXISTS idx_sales_excursion ON sales(active_excursion_id);
  CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_username);
  CREATE INDEX IF NOT EXISTS idx_active_excursions_date ON active_excursions(date);
  CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
`);

module.exports = db;
