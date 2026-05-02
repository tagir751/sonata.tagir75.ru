// Глобальные переменные
let currentUser = null;
let refreshInterval = null;
let lastChatMessageId = 0;
let unreadChatCount = 0;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
  
  if (currentUser) {
    initApp();
  }
});

// Проверка авторизации
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();
    
    if (data.authenticated) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
    } else {
      const stored = localStorage.getItem('user');
      if (stored) {
        currentUser = JSON.parse(stored);
      } else {
        window.location.href = '/login';
        return;
      }
    }
    
    // Отображение имени пользователя
    if (currentUser) {
      document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
      
      // Показываем элементы менеджера
      if (currentUser.role === 'manager') {
        document.body.classList.add('manager');
      }
    }
  } catch (err) {
    console.error('Ошибка проверки авторизации:', err);
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Навигация по вкладкам
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
      
      // Загрузка данных для вкладки
      loadTabData(btn.dataset.tab);
    });
  });
  
  // Выход
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    window.location.href = '/login';
  });
  
  // Форма продажи
  document.getElementById('saleForm')?.addEventListener('submit', handleSaleSubmit);
  
  // Изменение количества - пересчёт долга
  document.getElementById('totalAmount')?.addEventListener('input', calculateDebt);
  document.getElementById('paidAmount')?.addEventListener('input', calculateDebt);
  
  // Выбор места посадки - автозаполнение времени
  document.getElementById('pickupPoint')?.addEventListener('change', updatePickupTime);
  
  // Чат
  document.getElementById('chatForm')?.addEventListener('submit', handleChatSubmit);
  
  // Импорт/Экспорт
  document.getElementById('importBtn')?.addEventListener('click', handleImport);
  document.getElementById('exportBtn')?.addEventListener('click', handleExport);
  
  // Печать списка
  document.getElementById('printListBtn')?.addEventListener('click', printDriverList);
  
  // Фильтр даты экскурсий
  document.getElementById('filterDate')?.addEventListener('change', loadExcursionsForDate);
}

// Инициализация приложения
function initApp() {
  loadActiveExcursions();
  loadAdminData();
  loadCashbox();
  
  // Автообновление каждые 10 секунд
  refreshInterval = setInterval(() => {
    loadActiveExcursions();
    loadChatMessages();
    loadCashbox();
  }, 10000);
  
  // Первая загрузка чата
  loadChatMessages();
}

// Загрузка данных для вкладки
function loadTabData(tab) {
  switch(tab) {
    case 'sales':
      loadActiveExcursions();
      break;
    case 'excursions':
      loadExcursionsForDate();
      break;
    case 'chat':
      loadChatMessages();
      resetChatBadge(); // Сбрасываем бейдж при открытии чата
      break;
    case 'cashbox':
      loadCashbox();
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

// Загрузка активных экскурсий
async function loadActiveExcursions() {
  try {
    const response = await fetch('/api/sales/active');
    const excursions = await response.json();
    
    const container = document.getElementById('activeExcursionsList');
    if (!container) return;
    
    container.innerHTML = excursions.map(exc => `
      <div class="exursion-card" onclick="selectExcursion(${exc.id})">
        <h3>${exc.excursion_name}</h3>
        <p class="date">${new Date(exc.date).toLocaleDateString('ru-RU')}</p>
        <span class="sold">Продано: ${exc.tickets_sold}</span>
      </div>
    `).join('');
    
    // Заполняем select экскурсий
    const select = document.getElementById('excursionSelect');
    if (select) {
      select.innerHTML = excursions.map(exc => 
        `<option value="${exc.id}" data-date="${exc.date}" data-template="${exc.template_id || ''}">${exc.excursion_name} (${new Date(exc.date).toLocaleDateString('ru-RU')})</option>`
      ).join('');
      
      // Триггерим изменение для загрузки точек посадки
      if (select.value) {
        select.dispatchEvent(new Event('change'));
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки экскурсий:', err);
  }
}

// Выбор экскурсии в форме
async function selectExcursion(id) {
  const select = document.getElementById('excursionSelect');
  const option = Array.from(select.options).find(opt => opt.value == id);
  if (option) {
    select.value = id;
    select.dispatchEvent(new Event('change'));
  }
  
  // Переключаемся на вкладку продаж
  document.querySelector('[data-tab="sales"]').click();
}

// Загрузка точек посадки при выборе экскурсии
document.getElementById('excursionSelect')?.addEventListener('change', async function() {
  const selectedOption = this.options[this.selectedIndex];
  const templateId = selectedOption.dataset.template;
  const date = selectedOption.dataset.date;
  
  if (date) {
    document.getElementById('excursionDate').value = date;
  }
  
  if (templateId) {
    try {
      const response = await fetch(`/api/admin/data`);
      const data = await response.json();
      
      const template = data.routeTemplates.find(t => t.id == templateId);
      if (template) {
        // Загружаем точки из шаблона
        const pointsResponse = await fetch(`/api/admin/route-points/${templateId}`);
        if (pointsResponse.ok) {
          const points = await pointsResponse.json();
          const select = document.getElementById('pickupPoint');
          select.innerHTML = points.map(p => 
            `<option value="${p.id}" data-time="${p.time}" data-order="${p.order_num}">${p.point_name}</option>`
          ).join('');
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки точек:', err);
    }
  }
});

// Обновление времени посадки
function updatePickupTime() {
  const select = document.getElementById('pickupPoint');
  const timeInput = document.getElementById('pickupTime');
  const selected = select.options[select.selectedIndex];
  timeInput.value = selected.dataset.time || '';
}

// Расчёт долга
function calculateDebt() {
  const total = parseFloat(document.getElementById('totalAmount').value) || 0;
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const debt = Math.max(0, total - paid);
  document.getElementById('debtAmount').value = debt;
}

// Обработка продажи
async function handleSaleSubmit(e) {
  e.preventDefault();
  
  const saleData = {
    active_excursion_id: document.getElementById('excursionSelect').value,
    surname: document.getElementById('surname').value,
    phone: document.getElementById('phone').value,
    quantity: parseInt(document.getElementById('quantity').value),
    total_amount: parseFloat(document.getElementById('totalAmount').value),
    paid_amount: parseFloat(document.getElementById('paidAmount').value),
    debt_amount: parseFloat(document.getElementById('debtAmount').value),
    note: document.getElementById('note').value,
    point_id: document.getElementById('pickupPoint').value,
    template_id: document.getElementById('excursionSelect').options[
      document.getElementById('excursionSelect').selectedIndex
    ].dataset.template
  };
  
  try {
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(result.message);
      document.getElementById('saleForm').reset();
      loadActiveExcursions();
      loadCashbox();
    } else {
      alert('Ошибка: ' + result.error);
    }
  } catch (err) {
    alert('Ошибка соединения с сервером');
  }
}

// Загрузка сообщений чата
async function loadChatMessages() {
  try {
    const response = await fetch('/api/chat');
    const messages = await response.json();
    
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    // Подсчёт новых сообщений
    let newMessagesCount = 0;
    messages.forEach(msg => {
      if (msg.id > lastChatMessageId && msg.sender_username !== currentUser.username) {
        newMessagesCount++;
      }
    });
    
    // Обновляем счётчик непрочитанных
    if (newMessagesCount > 0 && lastChatMessageId > 0) {
      unreadChatCount += newMessagesCount;
    }
    
    // Обновляем последний ID сообщения
    if (messages.length > 0) {
      lastChatMessageId = Math.max(...messages.map(m => m.id));
    }
    
    // Отображаем бейдж на кнопке чата
    updateChatBadge();
    
    container.innerHTML = messages.map(msg => `
      <div class="chat-message ${msg.is_manager ? 'manager' : 'regular'}">
        <div class="sender">${msg.sender_username}${msg.is_manager ? ' (менеджер)' : ''}</div>
        <div>${msg.message}</div>
        <div class="time">${new Date(msg.created_at).toLocaleString('ru-RU')}</div>
      </div>
    `).join('');
    
    // Прокрутка вниз
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error('Ошибка загрузки чата:', err);
  }
}

// Обновление бейджа на кнопке чата
function updateChatBadge() {
  const chatBtn = document.querySelector('[data-tab="chat"]');
  if (!chatBtn) return;
  
  // Удаляем старый бейдж если есть
  const oldBadge = chatBtn.querySelector('.chat-badge');
  if (oldBadge) oldBadge.remove();
  
  // Добавляем новый бейдж если есть непрочитанные
  if (unreadChatCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'chat-badge';
    badge.textContent = unreadChatCount > 99 ? '99+' : unreadChatCount;
    badge.style.cssText = 'position:absolute;top:5px;right:5px;background:#dc3545;color:white;border-radius:50%;padding:2px 6px;font-size:10px;min-width:18px;text-align:center;';
    chatBtn.style.position = 'relative';
    chatBtn.appendChild(badge);
  }
}

// Сброс счётчика непрочитанных при открытии чата
function resetChatBadge() {
  unreadChatCount = 0;
  updateChatBadge();
}

// Отправка сообщения в чат
async function handleChatSubmit(e) {
  e.preventDefault();
  
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (response.ok) {
      input.value = '';
      loadChatMessages();
      resetChatBadge(); // Сбрасываем бейдж после отправки своего сообщения
    }
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
  }
}

// Загрузка кассы
async function loadCashbox() {
  try {
    // Моя касса
    const myResponse = await fetch('/api/cashbox/me');
    if (myResponse.ok) {
      const myCashbox = await myResponse.json();
      document.getElementById('myCashAmount').textContent = myCashbox.amount || 0;
    }
    
    // Все кассы (только менеджер)
    if (currentUser.role === 'manager') {
      const allResponse = await fetch('/api/cashbox');
      const allCashbox = await allResponse.json();
      
      const tbody = document.querySelector('#allCashboxTable tbody');
      if (tbody) {
        // Сначала реализаторы, потом агенты - уже отсортировано на сервере
        tbody.innerHTML = allCashbox.map(c => `
          <tr>
            <td>${c.full_name || c.username}</td>
            <td>${c.point_name || '-'}</td>
            <td>${c.amount} руб.</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="resetCashbox(${c.user_id})">Обнулить</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки кассы:', err);
  }
}

// Обнуление кассы - используем новый endpoint /api/users/[id]/reset-cash
async function resetCashbox(userId) {
  if (!confirm('Обнулить кассу этого реализатора?')) return;
  
  try {
    // Пробуем новый endpoint сначала
    let response = await fetch(`/api/users/${userId}/reset-cash`, {
      method: 'POST'
    });
    
    // Если такого endpoint нет, используем старый
    if (!response.ok) {
      response = await fetch('/api/cashbox/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
    }
    
    if (response.ok) {
      loadCashbox();
      alert('Касса обнулена');
    } else {
      const result = await response.json();
      alert('Ошибка: ' + result.error);
    }
  } catch (err) {
    alert('Ошибка обнуления кассы');
  }
}

// Загрузка данных администрирования
async function loadAdminData() {
  if (currentUser.role !== 'manager') return;
  
  try {
    const response = await fetch('/api/admin/data');
    const data = await response.json();
    
    // Отображение списков
    renderAdminList('adminExcursionsList', data.excursions, 'excursion');
    renderAdminList('adminPointsList', data.points, 'point');
    renderAdminList('adminDriversList', data.drivers, 'driver');
    renderAdminList('adminGuidesList', data.guides, 'guide');
    renderAdminList('adminUsersList', data.users, 'user');
    renderAdminList('adminAgentsList', data.agents, 'agent');
    renderAdminList('adminTemplatesList', data.routeTemplates, 'template');
  } catch (err) {
    console.error('Ошибка загрузки данных администрирования:', err);
  }
}

function renderAdminList(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.map(item => `
    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
      <span>${item.name || item.full_name || item.username}</span>
      <button class="btn btn-sm btn-danger" onclick="deleteItem('${type}', ${item.id})">Удалить</button>
    </div>
  `).join('');
}

// Импорт Excel
async function handleImport() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Выберите файл для импорта');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(`Импорт завершён!\n\n${JSON.stringify(result.stats, null, 2)}`);
      loadAdminData();
    } else {
      alert('Ошибка импорта: ' + result.error);
    }
  } catch (err) {
    alert('Ошибка соединения с сервером');
  }
}

// Экспорт Excel
async function handleExport() {
  try {
    const response = await fetch('/api/import/export');
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonata_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Ошибка экспорта');
  }
}

// Печать списка водителю
async function printDriverList() {
  const date = document.getElementById('filterDate').value;
  if (!date) {
    alert('Выберите дату');
    return;
  }
  
  // Получаем активные экскурсии на дату
  const response = await fetch(`/api/sales/active?date=${date}`);
  const excursions = await response.json();
  
  if (excursions.length === 0) {
    alert('Нет экскурсий на эту дату');
    return;
  }
  
  // Для простоты берём первую экскурсию
  const excursion = excursions[0];
  
  // Загружаем список продаж
  const salesResponse = await fetch(`/api/sales/excursion/${excursion.id}`);
  const sales = await salesResponse.json();
  
  // Формируем печатную версию
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Список пассажиров - ${excursion.excursion_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .header { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚌 Соната-Крым</h1>
          <h2>Список пассажиров</h2>
          <p>Экскурсия: ${excursion.excursion_name}</p>
          <p>Дата: ${new Date(excursion.date).toLocaleDateString('ru-RU')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Фамилия</th>
              <th>Телефон</th>
              <th>Место посадки</th>
              <th>Время</th>
              <th>Долг (руб)</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            ${sales.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${s.tourist_surname}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.point_name || s.point_name}</td>
                <td>${s.time || '-'}</td>
                <td>${s.debt_amount > 0 ? s.debt_amount : '-'}</td>
                <td>${s.note || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Удаление элемента
async function deleteItem(type, id) {
  if (!confirm('Вы уверены, что хотите удалить этот элемент?')) return;
  
  try {
    const response = await fetch(`/api/admin/${type}s/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadAdminData();
    } else {
      const result = await response.json();
      alert('Ошибка удаления: ' + result.error);
    }
  } catch (err) {
    alert('Ошибка соединения с сервером');
  }
}

// Загрузка экскурсий на дату
async function loadExcursionsForDate() {
  const date = document.getElementById('filterDate').value;
  if (!date) return;
  
  try {
    const response = await fetch(`/api/sales/active?date=${date}`);
    const excursions = await response.json();
    
    const container = document.getElementById('excursionDetails');
    container.innerHTML = excursions.map(exc => `
      <div class="exursion-card" onclick="printDriverListFor(${exc.id})">
        <h3>${exc.excursion_name}</h3>
        <p>Продано билетов: ${exc.tickets_sold}</p>
        <button class="btn btn-primary">Распечатать список</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Ошибка загрузки экскурсий:', err);
  }
}
