const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db/init');

const upload = multer({ storage: multer.memoryStorage() });

// Импорт данных из Excel
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const stats = {
      excursions: { added: 0, skipped: 0 },
      points: { added: 0, skipped: 0 },
      drivers: { added: 0, skipped: 0 },
      guides: { added: 0, skipped: 0 },
      users: { added: 0, skipped: 0 },
      agents: { added: 0, skipped: 0 }
    };

    // Импорт экскурсий
    if (workbook.Sheets['Экскурсии']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['Экскурсии']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM excursions WHERE name = ?').get(row.name);
          if (!existing && row.name) {
            db.prepare(`
              INSERT INTO excursions (name, description, base_price, active)
              VALUES (?, ?, ?, 1)
            `).run(row.name, row.description || '', row.base_price || 0);
            stats.excursions.added++;
          } else {
            stats.excursions.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта экскурсии:', e);
        }
      });
    }

    // Импорт точек продаж
    if (workbook.Sheets['ТочкиПродаж']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['ТочкиПродаж']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM points WHERE name = ?').get(row.name);
          if (!existing && row.name) {
            db.prepare(`
              INSERT INTO points (name, address)
              VALUES (?, ?)
            `).run(row.name, row.address || '');
            stats.points.added++;
          } else {
            stats.points.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта точки:', e);
        }
      });
    }

    // Импорт водителей
    if (workbook.Sheets['Водители']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['Водители']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM drivers WHERE full_name = ? AND phone = ?').get(row.full_name, row.phone);
          if (!existing && row.full_name) {
            db.prepare(`
              INSERT INTO drivers (full_name, phone, car_info)
              VALUES (?, ?, ?)
            `).run(row.full_name, row.phone || '', row.car_info || '');
            stats.drivers.added++;
          } else {
            stats.drivers.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта водителя:', e);
        }
      });
    }

    // Импорт экскурсоводов
    if (workbook.Sheets['Экскурсоводы']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['Экскурсоводы']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM guides WHERE full_name = ? AND phone = ?').get(row.full_name, row.phone);
          if (!existing && row.full_name) {
            db.prepare(`
              INSERT INTO guides (full_name, phone)
              VALUES (?, ?)
            `).run(row.full_name, row.phone || '');
            stats.guides.added++;
          } else {
            stats.guides.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта экскурсовода:', e);
        }
      });
    }

    // Импорт пользователей
    if (workbook.Sheets['Пользователи']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['Пользователи']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(row.username);
          if (!existing && row.username && row.password) {
            db.prepare(`
              INSERT INTO users (username, password, role, full_name, point_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(row.username, row.password, row.role || 'seller', row.full_name || row.username, row.point_id || null);
            stats.users.added++;
          } else {
            stats.users.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта пользователя:', e);
        }
      });
    }

    // Импорт агентов
    if (workbook.Sheets['Агенты']) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets['Агенты']);
      data.forEach(row => {
        try {
          const existing = db.prepare('SELECT id FROM agents WHERE name = ?').get(row.name);
          if (!existing && row.name && row.password) {
            db.prepare(`
              INSERT INTO agents (name, password, point_id)
              VALUES (?, ?, ?)
            `).run(row.name, row.password, row.point_id || null);
            stats.agents.added++;
          } else {
            stats.agents.skipped++;
          }
        } catch (e) {
          console.error('Ошибка импорта агента:', e);
        }
      });
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Ошибка импорта:', err);
    res.status(500).json({ error: 'Ошибка при импорте файла: ' + err.message });
  }
});

// Экспорт всех данных в Excel
router.get('/export', (req, res) => {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Экскурсии
    const excursions = db.prepare('SELECT * FROM excursions').all();
    const wsExcursions = XLSX.utils.json_to_sheet(excursions);
    XLSX.utils.book_append_sheet(workbook, wsExcursions, 'Экскурсии');
    
    // Точки продаж
    const points = db.prepare('SELECT * FROM points').all();
    const wsPoints = XLSX.utils.json_to_sheet(points);
    XLSX.utils.book_append_sheet(workbook, wsPoints, 'ТочкиПродаж');
    
    // Водители
    const drivers = db.prepare('SELECT * FROM drivers').all();
    const wsDrivers = XLSX.utils.json_to_sheet(drivers);
    XLSX.utils.book_append_sheet(workbook, wsDrivers, 'Водители');
    
    // Экскурсоводы
    const guides = db.prepare('SELECT * FROM guides').all();
    const wsGuides = XLSX.utils.json_to_sheet(guides);
    XLSX.utils.book_append_sheet(workbook, wsGuides, 'Экскурсоводы');
    
    // Пользователи (без паролей для безопасности)
    const users = db.prepare('SELECT id, username, role, full_name, point_id FROM users').all();
    const wsUsers = XLSX.utils.json_to_sheet(users);
    XLSX.utils.book_append_sheet(workbook, wsUsers, 'Пользователи');
    
    // Агенты (без паролей)
    const agents = db.prepare('SELECT id, name, point_id FROM agents').all();
    const wsAgents = XLSX.utils.json_to_sheet(agents);
    XLSX.utils.book_append_sheet(workbook, wsAgents, 'Агенты');
    
    // Продажи за период
    const { startDate, endDate } = req.query;
    let salesQuery = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    
    if (startDate) {
      salesQuery += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      salesQuery += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    const sales = db.prepare(salesQuery).all(...params);
    const wsSales = XLSX.utils.json_to_sheet(sales);
    XLSX.utils.book_append_sheet(workbook, wsSales, 'Продажи');
    
    // Отправляем файл
    const fileName = `sonata_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    XLSX.write(workbook, { res, type: 'buffer', bookType: 'xlsx' });
    res.end(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  } catch (err) {
    console.error('Ошибка экспорта:', err);
    res.status(500).json({ error: 'Ошибка при экспорте: ' + err.message });
  }
});

module.exports = router;
