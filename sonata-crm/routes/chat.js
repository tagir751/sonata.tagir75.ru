const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Получить сообщения чата
router.get('/', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const messages = db.prepare(`
      SELECT 
        id,
        sender_username,
        message,
        is_manager,
        created_at
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT ?
    `).all(parseInt(limit));
    
    // Переворачиваем порядок (новые внизу)
    res.json(messages.reverse());
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отправить сообщение
router.post('/', (req, res) => {
  try {
    const { message } = req.body;
    const user = req.session.user;
    
    if (!user || !message) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const isManager = user.role === 'manager' ? 1 : 0;
    
    db.prepare(`
      INSERT INTO chat_messages (sender_username, message, is_manager)
      VALUES (?, ?, ?)
    `).run(user.username, message, isManager);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
