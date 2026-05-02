const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Получить состояние кассы всех реализаторов
router.get('/', (req, res) => {
  try {
    // Сначала реализаторы (SELLER) по алфавиту, потом агенты (AGENT) по алфавиту
    const cashboxData = db.prepare(`
      SELECT 
        c.id,
        c.user_id,
        c.amount,
        c.last_reset,
        u.username,
        u.full_name,
        u.role,
        p.name as point_name,
        1 as sort_order
      FROM cashbox c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN points p ON u.point_id = p.id
      WHERE u.role IN ('seller', 'agent') AND u.role != 'agent'
      ORDER BY u.full_name COLLATE NOCASE
    `).all();

    // Агенты по алфавиту
    const agentsCashbox = db.prepare(`
      SELECT 
        c.id,
        c.user_id,
        c.amount,
        c.last_reset,
        a.name as username,
        a.name as full_name,
        'agent' as role,
        p.name as point_name,
        2 as sort_order
      FROM cashbox c
      JOIN agents a ON c.user_id = a.id
      LEFT JOIN points p ON a.point_id = p.id
      ORDER BY a.name COLLATE NOCASE
    `).all();

    // Объединяем: сначала реализаторы, потом агенты
    const allCashbox = [...cashboxData, ...agentsCashbox];
    
    // Сортируем внутри каждой группы уже сделано в SQL, теперь просто объединяем
    res.json(allCashbox);
  } catch (err) {
    console.error('Ошибка получения данных кассы:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить кассу текущего пользователя
router.get('/me', (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    let cashbox;
    
    if (user.role === 'agent') {
      cashbox = db.prepare(`
        SELECT * FROM cashbox WHERE user_id = ?
      `).get(user.id);
      
      if (!cashbox) {
        db.prepare('INSERT INTO cashbox (user_id, amount) VALUES (?, 0)').run(user.id);
        cashbox = { user_id: user.id, amount: 0 };
      }
    } else {
      cashbox = db.prepare(`
        SELECT c.*, u.username, u.full_name, p.name as point_name
        FROM cashbox c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN points p ON u.point_id = p.id
        WHERE c.user_id = ?
      `).get(user.id);
    }

    res.json(cashbox || { amount: 0 });
  } catch (err) {
    console.error('Ошибка получения кассы:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обнулить кассу (собственник забрал наличку)
router.post('/reset', (req, res) => {
  try {
    const { user_id } = req.body;
    const currentUser = req.session.user;
    
    // Только менеджер может обнулять кассы других
    if (currentUser.role !== 'manager' && user_id !== currentUser.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    db.prepare(`
      UPDATE cashbox 
      SET amount = 0, last_reset = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(user_id);

    res.json({ success: true, message: 'Касса обнулена' });
  } catch (err) {
    console.error('Ошибка обнуления кассы:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обнулить кассу по ID пользователя (новый endpoint для мобильных)
router.post('/users/:id/reset-cash', (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUser = req.session.user;
    
    // Только менеджер может обнулять кассы других
    if (currentUser.role !== 'manager' && userId !== currentUser.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    db.prepare(`
      UPDATE cashbox 
      SET amount = 0, last_reset = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(userId);

    res.json({ success: true, message: 'Касса обнулена' });
  } catch (err) {
    console.error('Ошибка обнуления кассы:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
