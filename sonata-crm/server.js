const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const db = require('./db/init');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const cashboxRoutes = require('./routes/cashbox');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'sonata-crimea-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // В продакшене включить true с HTTPS
    maxAge: 8 * 60 * 60 * 1000 // 8 часов
  }
}));

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
};

const requireManager = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'manager') {
    return res.status(403).json({ error: 'Доступ только для менеджеров' });
  }
  next();
};

// Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/sales', requireAuth, salesRoutes);
app.use('/api/admin', requireAuth, requireManager, adminRoutes);
app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/cashbox', requireAuth, cashboxRoutes);
app.use('/api/import', requireAuth, requireManager, importRoutes);

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница входа
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});
