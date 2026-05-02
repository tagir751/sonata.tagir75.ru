const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Получить список активных экскурсий с количеством проданных билетов
router.get('/active', (req, res) => {
  try {
    const { date } = req.query;
    
    let query = `
      SELECT 
        ae.id,
        e.name as excursion_name,
        ae.date,
        ae.status,
        rt.name as template_name,
        d.full_name as driver_name,
        g.full_name as guide_name,
        COUNT(s.id) as tickets_sold
      FROM active_excursions ae
      JOIN excursions e ON ae.excursion_id = e.id
      LEFT JOIN route_templates rt ON ae.template_id = rt.id
      LEFT JOIN drivers d ON ae.driver_id = d.id
      LEFT JOIN guides g ON ae.guide_id = g.id
      LEFT JOIN sales s ON ae.id = s.active_excursion_id
      WHERE ae.status = 'active'
    `;
    
    if (date) {
      query += ` AND ae.date = '${date}'`;
    }
    
    query += ' GROUP BY ae.id ORDER BY ae.date, e.name';
    
    const excursions = db.prepare(query).all();
    res.json(excursions);
  } catch (err) {
    console.error('Ошибка получения активных экскурсий:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание продажи (группой)
router.post('/', (req, res) => {
  try {
    const {
      active_excursion_id,
      surname,
      phone,
      point_id,
      quantity,
      total_amount,
      paid_amount,
      debt_amount,
      note,
      template_id
    } = req.body;
    
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Получаем точки посадки из шаблона
    const routePoints = db.prepare(`
      SELECT point_name, order_num, time 
      FROM route_points 
      WHERE template_id = ? 
      ORDER BY order_num
    `).all(template_id);

    const groupId = Date.now().toString(); // Уникальный ID группы
    const insertSale = db.prepare(`
      INSERT INTO sales (
        active_excursion_id, seller_username, group_id,
        tourist_surname, phone, point_id, seat_order,
        payment_time, total_amount, paid_amount, debt_amount,
        note, is_debt_record
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Создаём запись для каждого туриста в группе
    for (let i = 0; i < quantity; i++) {
      const point = routePoints[i % routePoints.length];
      const isDebtRecord = (i === 0 && debt_amount > 0) ? 1 : 0;
      
      insertSale.run(
        active_excursion_id,
        user.username,
        groupId,
        surname,
        phone,
        point_id,
        point.order_num,
        point.time,
        total_amount / quantity, // Распределяем сумму на каждого
        paid_amount / quantity,
        isDebtRecord ? debt_amount : 0, // Долг только на первого
        note,
        isDebtRecord
      );
    }

    // Обновляем кассу реализатора
    if (user.role === 'seller' || user.role === 'agent') {
      db.prepare(`
        UPDATE cashbox 
        SET amount = amount + ?, last_reset = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(paid_amount, user.id);
    }

    res.json({ success: true, message: `Продажа оформлена на ${quantity} чел.` });
  } catch (err) {
    console.error('Ошибка создания продажи:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить список продаж для экскурсии (для печати водителю)
router.get('/excursion/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const sales = db.prepare(`
      SELECT 
        s.id,
        s.tourist_surname,
        s.phone,
        rp.point_name,
        rp.time,
        s.total_amount,
        s.paid_amount,
        s.debt_amount,
        s.note,
        s.group_id,
        s.is_debt_record,
        COALESCE(u.full_name, a.name) as seller_name,
        p.name as point_name,
        s.payment_time,
        s.created_at
      FROM sales s
      JOIN route_points rp ON s.seat_order = rp.order_num AND rp.template_id = (
        SELECT template_id FROM active_excursions WHERE id = ?
      )
      LEFT JOIN users u ON s.seller_username = u.username
      LEFT JOIN agents a ON s.seller_username = a.name
      LEFT JOIN points p ON s.point_id = p.id
      WHERE s.active_excursion_id = ?
      ORDER BY rp.order_num, s.created_at
    `).all(id, id);

    // Группируем по group_id для отображения
    const groupedSales = [];
    const groups = {};
    
    sales.forEach(sale => {
      if (!groups[sale.group_id]) {
        groups[sale.group_id] = [];
      }
      groups[sale.group_id].push(sale);
    });
    
    // Раскрываем группы
    Object.values(groups).forEach(group => {
      groupedSales.push(...group);
    });

    res.json(groupedSales);
  } catch (err) {
    console.error('Ошибка получения продаж:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить статистику продаж по реализаторам для экскурсии
router.get('/stats/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем все продажи с информацией о продавце (включая агентов)
    const stats = db.prepare(`
      SELECT 
        s.seller_username,
        COALESCE(u.full_name, a.name) as seller_name,
        COALESCE(u.role, 'agent') as role,
        COUNT(*) as tickets_sold,
        SUM(s.paid_amount) as total_paid,
        SUM(s.debt_amount) as total_debt
      FROM sales s
      LEFT JOIN users u ON s.seller_username = u.username
      LEFT JOIN agents a ON s.seller_username = a.name
      WHERE s.active_excursion_id = ?
      GROUP BY s.seller_username
      ORDER BY tickets_sold DESC
    `).all(id);

    res.json(stats);
  } catch (err) {
    console.error('Ошибка получения статистики:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
