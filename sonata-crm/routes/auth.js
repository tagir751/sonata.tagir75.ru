const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Вход в систему
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  try {
    // Проверка пользователей (реализаторы, менеджеры)
    let user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    
    // Если не найдено, проверяем агентов
    if (!user) {
      const agent = db.prepare('SELECT * FROM agents WHERE name = ? AND password = ?').get(username, password);
      if (agent) {
        user = {
          id: agent.id,
          username: agent.name,
          role: 'agent',
          point_id: agent.point_id
        };
      }
    }

    if (user) {
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name || user.username,
        point_id: user.point_id
      };
      
      // Инициализация кассы для реализаторов
      if (user.role === 'seller' || user.role === 'agent') {
        const cashbox = db.prepare('SELECT * FROM cashbox WHERE user_id = ?').get(user.id);
        if (!cashbox) {
          db.prepare('INSERT INTO cashbox (user_id, amount) VALUES (?, 0)').run(user.id);
        }
      }
      
      res.json({ 
        success: true, 
        user: req.session.user 
      });
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Выход из системы
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Проверка текущей сессии
router.get('/check', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
