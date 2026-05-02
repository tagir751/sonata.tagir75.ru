const request = require('supertest');
const express = require('express');
const session = require('express-session');

// Mock database
const mockDb = {
  prepare: jest.fn(),
  exec: jest.fn(),
  close: jest.fn()
};

// Mock statements
const mockStatement = {
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn()
};

mockDb.prepare.mockReturnValue(mockStatement);

jest.mock('../db/init', () => mockDb);

const salesRouter = require('../routes/sales');

describe('Sales Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true
    }));
    
    // Add middleware to set mock user session for testing
    app.use((req, res, next) => {
      if (req.headers['x-test-user']) {
        req.session.user = JSON.parse(req.headers['x-test-user']);
      }
      next();
    });
    
    app.use('/api/sales', salesRouter);
  });

  describe('GET /api/sales/active', () => {
    it('should return list of active excursions', async () => {
      const mockExcursions = [
        { id: 1, excursion_name: 'Tour 1', date: '2025-05-01', tickets_sold: 5 },
        { id: 2, excursion_name: 'Tour 2', date: '2025-05-02', tickets_sold: 3 }
      ];

      mockStatement.all.mockReturnValue(mockExcursions);

      const res = await request(app)
        .get('/api/sales/active');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].excursion_name).toBe('Tour 1');
    });

    it('should filter by date if provided', async () => {
      const mockExcursions = [
        { id: 1, excursion_name: 'Tour 1', date: '2025-05-01', tickets_sold: 5 }
      ];

      mockStatement.all.mockReturnValue(mockExcursions);

      const res = await request(app)
        .get('/api/sales/active?date=2025-05-01');

      expect(res.statusCode).toBe(200);
      expect(mockStatement.all).toHaveBeenCalled();
    });
  });

  describe('POST /api/sales/', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await request(app)
        .post('/api/sales/')
        .send({
          active_excursion_id: 1,
          surname: 'Ivanov',
          quantity: 2,
          total_amount: 2000,
          paid_amount: 2000
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Требуется авторизация');
    });

    it('should create a sale successfully for authenticated user', async () => {
      const mockUser = { id: 1, username: 'seller1', role: 'seller' };
      
      // Mock route points
      const mockRoutePoints = [
        { point_name: 'Stop 1', order_num: 1, time: '09:00' },
        { point_name: 'Stop 2', order_num: 2, time: '09:30' }
      ];

      mockStatement.all.mockReturnValueOnce(mockRoutePoints);
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .post('/api/sales/')
        .set('x-test-user', JSON.stringify(mockUser))
        .send({
          active_excursion_id: 1,
          surname: 'Ivanov',
          phone: '+71234567890',
          point_id: 1,
          quantity: 2,
          total_amount: 2000,
          paid_amount: 2000,
          debt_amount: 0,
          template_id: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update cashbox after sale for seller', async () => {
      const mockUser = { id: 1, username: 'seller1', role: 'seller' };
      const mockRoutePoints = [
        { point_name: 'Stop 1', order_num: 1, time: '09:00' }
      ];

      mockStatement.all.mockReturnValueOnce(mockRoutePoints);
      mockStatement.run.mockReturnValue({});

      await request(app)
        .post('/api/sales/')
        .set('x-test-user', JSON.stringify(mockUser))
        .send({
          active_excursion_id: 1,
          surname: 'Petrov',
          quantity: 1,
          total_amount: 1000,
          paid_amount: 1000
        });

      expect(mockStatement.run).toHaveBeenCalled();
    });
  });

  describe('GET /api/sales/excursion/:id', () => {
    it('should return sales list for specific excursion', async () => {
      const mockSales = [
        { id: 1, tourist_surname: 'Ivanov', group_id: 'group1' },
        { id: 2, tourist_surname: 'Petrov', group_id: 'group1' }
      ];

      mockStatement.all.mockReturnValue(mockSales);

      const res = await request(app)
        .get('/api/sales/excursion/1');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].tourist_surname).toBe('Ivanov');
    });
  });

  describe('GET /api/sales/stats/:id', () => {
    it('should return sales statistics by seller', async () => {
      const mockStats = [
        { seller_username: 'seller1', tickets_sold: 10, total_paid: 10000, total_debt: 500 },
        { seller_username: 'seller2', tickets_sold: 5, total_paid: 5000, total_debt: 0 }
      ];

      mockStatement.all.mockReturnValue(mockStats);

      const res = await request(app)
        .get('/api/sales/stats/1');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].seller_username).toBe('seller1');
    });
  });
});
