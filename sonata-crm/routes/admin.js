const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Получить все справочники
router.get('/data', (req, res) => {
  try {
    const data = {
      excursions: db.prepare('SELECT * FROM excursions WHERE active = 1').all(),
      points: db.prepare('SELECT * FROM points').all(),
      drivers: db.prepare('SELECT * FROM drivers WHERE active = 1').all(),
      guides: db.prepare('SELECT * FROM guides WHERE active = 1').all(),
      routeTemplates: db.prepare('SELECT * FROM route_templates').all(),
      users: db.prepare('SELECT id, username, role, full_name, point_id FROM users').all(),
      agents: db.prepare('SELECT id, name, point_id FROM agents').all()
    };
    res.json(data);
  } catch (err) {
    console.error('Ошибка получения данных:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Управление экскурсиями
router.post('/excursions', (req, res) => {
  try {
    const { name, description, base_price, active } = req.body;
    const result = db.prepare(`
      INSERT INTO excursions (name, description, base_price, active)
      VALUES (?, ?, ?, ?)
    `).run(name, description, base_price, active || 1);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания экскурсии:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/excursions/:id', (req, res) => {
  try {
    // Проверяем, есть ли активные рейсы с этой экскурсией
    const activeTrips = db.prepare(`
      SELECT COUNT(*) as count FROM active_excursions 
      WHERE excursion_id = ? AND status = 'active'
    `).get(req.params.id);
    
    if (activeTrips.count > 0) {
      return res.status(400).json({ error: 'Нельзя удалить экскурсию: есть активные рейсы. Сначала отмените рейсы или сделайте экскурсию неактивной.' });
    }
    
    // Проверяем, есть ли продажи
    const hasSales = db.prepare(`
      SELECT COUNT(*) as count FROM sales s
      JOIN active_excursions ae ON s.active_excursion_id = ae.id
      WHERE ae.excursion_id = ?
    `).get(req.params.id);
    
    if (hasSales.count > 0) {
      return res.status(400).json({ error: 'Нельзя удалить экскурсию: есть заказы с продажами. Экскурсия остаётся в истории.' });
    }
    
    db.prepare('UPDATE excursions SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Экскурсия деактивирована' });
  } catch (err) {
    console.error('Ошибка удаления экскурсии:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление точками продаж
router.post('/points', (req, res) => {
  try {
    const { name, address } = req.body;
    const result = db.prepare(`
      INSERT INTO points (name, address)
      VALUES (?, ?)
    `).run(name, address);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания точки:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/points/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM points WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления точки:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление водителями
router.post('/drivers', (req, res) => {
  try {
    const { full_name, phone, car_info } = req.body;
    const result = db.prepare(`
      INSERT INTO drivers (full_name, phone, car_info)
      VALUES (?, ?, ?)
    `).run(full_name, phone, car_info);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания водителя:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/drivers/:id', (req, res) => {
  try {
    db.prepare('UPDATE drivers SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления водителя:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление экскурсоводами
router.post('/guides', (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const result = db.prepare(`
      INSERT INTO guides (full_name, phone)
      VALUES (?, ?)
    `).run(full_name, phone);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания экскурсовода:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/guides/:id', (req, res) => {
  try {
    db.prepare('UPDATE guides SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления экскурсовода:', err);
    res.status(500).json({ error: err.message });
  }
});

// Создание активных экскурсий
router.post('/active-excursions', (req, res) => {
  try {
    const { excursion_id, date, template_id, guide_id, driver_id } = req.body;
    const result = db.prepare(`
      INSERT INTO active_excursions (excursion_id, date, template_id, guide_id, driver_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(excursion_id, date, template_id, guide_id, driver_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания активной экскурсии:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/active-excursions/:id', (req, res) => {
  try {
    db.prepare('UPDATE active_excursions SET status = "cancelled" WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отмены экскурсии:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление шаблонами маршрутов
router.post('/route-templates', (req, res) => {
  try {
    const { name, description, points } = req.body;
    const result = db.prepare(`
      INSERT INTO route_templates (name, description)
      VALUES (?, ?)
    `).run(name, description);
    
    const templateId = result.lastInsertRowid;
    
    if (points && Array.isArray(points)) {
      const insertPoint = db.prepare(`
        INSERT INTO route_points (template_id, point_name, order_num, time)
        VALUES (?, ?, ?, ?)
      `);
      
      points.forEach((point, index) => {
        insertPoint.run(templateId, point.name, index + 1, point.time);
      });
    }
    
    res.json({ success: true, id: templateId });
  } catch (err) {
    console.error('Ошибка создания шаблона:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/route-templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM route_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления шаблона:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление пользователями
router.post('/users', (req, res) => {
  try {
    const { username, password, role, full_name, point_id } = req.body;
    const result = db.prepare(`
      INSERT INTO users (username, password, role, full_name, point_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password, role, full_name, point_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания пользователя:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/password', (req, res) => {
  try {
    const { password } = req.body;
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка смены пароля:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления пользователя:', err);
    res.status(500).json({ error: err.message });
  }
});

// Управление агентами
router.post('/agents', (req, res) => {
  try {
    const { name, password, point_id } = req.body;
    const result = db.prepare(`
      INSERT INTO agents (name, password, point_id)
      VALUES (?, ?, ?)
    `).run(name, password, point_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Ошибка создания агента:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/agents/:id/password', (req, res) => {
  try {
    const { password } = req.body;
    db.prepare('UPDATE agents SET password = ? WHERE id = ?').run(password, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка смены пароля агента:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agents/:id', (req, res) => {
  try {
    // Проверяем, есть ли продажи у этого агента
    const agentSales = db.prepare(`
      SELECT COUNT(*) as count FROM sales 
      WHERE seller_username = (SELECT name FROM agents WHERE id = ?)
    `).get(req.params.id);
    
    if (agentSales.count > 0) {
      return res.status(400).json({ error: 'Нельзя удалить агента: есть заказы. Агент остаётся в истории.' });
    }
    
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Агент удалён' });
  } catch (err) {
    console.error('Ошибка удаления агента:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
