const db = require('./db/init');

// Создание пользователя администратора по умолчанию
try {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, full_name)
    VALUES ('admin', 'admin123', 'manager', 'Администратор')
  `);
  stmt.run();
  
  // Проверка создания
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (user) {
    console.log('✓ Пользователь admin создан:');
    console.log('  Логин: admin');
    console.log('  Пароль: admin123');
    console.log('  Роль: manager');
  } else {
    console.log('ℹ Пользователь admin уже существует');
  }
  
  // Создание тестовых данных для демонстрации
  console.log('\n✓ Создание тестовых данных...');
  
  // Точки продаж
  const points = [
    { name: 'Центральный офис', address: 'ул. Ленина, 1' },
    { name: 'Гостиница Одиссей', address: 'ул. Курортная, 5' },
    { name: 'ТЦ Крым', address: 'пр. Победы, 10' }
  ];
  
  points.forEach(point => {
    db.prepare('INSERT OR IGNORE INTO points (name, address) VALUES (?, ?)').run(point.name, point.address);
  });
  
  // Шаблоны маршрутов
  db.prepare('INSERT OR IGNORE INTO route_templates (name, description) VALUES (?, ?)').run('Прямой маршрут', 'Стандартный маршрут по порядку');
  db.prepare('INSERT OR IGNORE INTO route_templates (name, description) VALUES (?, ?)').run('Обратный маршрут', 'Маршрут в обратном порядке');
  
  const templateId = db.prepare('SELECT id FROM route_templates WHERE name = ?').get('Прямой маршрут')?.id;
  
  if (templateId) {
    // Точки посадок
    const routePoints = [
      { name: 'Гостиница Одиссей', time: '06:00', order: 1 },
      { name: 'ТЦ Крым', time: '06:30', order: 2 },
      { name: 'Центральный офис', time: '07:00', order: 3 }
    ];
    
    routePoints.forEach(point => {
      db.prepare(`
        INSERT OR IGNORE INTO route_points (template_id, point_name, order_num, time)
        VALUES (?, ?, ?, ?)
      `).run(templateId, point.name, point.order, point.time);
    });
  }
  
  // Водители
  db.prepare('INSERT OR IGNORE INTO drivers (full_name, phone, car_info) VALUES (?, ?, ?)').run('Иванов Иван', '+7-978-XXX-XX-XX', 'Mercedes Sprinter');
  db.prepare('INSERT OR IGNORE INTO drivers (full_name, phone, car_info) VALUES (?, ?, ?)').run('Петров Петр', '+7-978-XXX-XX-XX', 'Ford Transit');
  
  // Экскурсоводы
  db.prepare('INSERT OR IGNORE INTO guides (full_name, phone) VALUES (?, ?)').run('Сидорова Анна', '+7-978-XXX-XX-XX');
  db.prepare('INSERT OR IGNORE INTO guides (full_name, phone) VALUES (?, ?)').run('Козлов Дмитрий', '+7-978-XXX-XX-XX');
  
  // Экскурсии
  db.prepare('INSERT OR IGNORE INTO excursions (name, description, base_price, active) VALUES (?, ?, ?, ?)').run('Крым за день', 'Обзорная экскурсия по Крыму', 2000, 1);
  db.prepare('INSERT OR IGNORE INTO excursions (name, description, base_price, active) VALUES (?, ?, ?, ?)').run('Дворцы Южного берега', 'Посещение дворцов', 2500, 1);
  db.prepare('INSERT OR IGNORE INTO excursions (name, description, base_price, active) VALUES (?, ?, ?, ?)').run('Пещерные города', 'Экскурсия к пещерным городам', 1800, 1);
  
  // Реализатор
  db.prepare('INSERT OR IGNORE INTO users (username, password, role, full_name, point_id) VALUES (?, ?, ?, ?, ?)').run('seller1', 'seller123', 'seller', 'Иванова Мария', 1);
  
  // Агент
  db.prepare('INSERT OR IGNORE INTO agents (name, password, point_id) VALUES (?, ?, ?)').run('Гостиница Одиссей', 'odyssey123', 2);
  
  console.log('✓ Тестовые данные созданы!');
  console.log('\n===========================================');
  console.log('Данные для входа:');
  console.log('  Менеджер: admin / admin123');
  console.log('  Реализатор: seller1 / seller123');
  console.log('  Агент: Гостиница Одиссей / odyssey123');
  console.log('===========================================\n');
  
} catch (err) {
  console.error('Ошибка при создании данных:', err);
}
