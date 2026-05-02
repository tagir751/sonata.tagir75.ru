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

const cashboxRouter = require('../routes/cashbox');

describe('Cashbox Routes', () => {
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
    
    app.use('/api/cashbox', cashboxRouter);
  });

  describe('GET /api/cashbox', () => {
    it('should return cashbox data for all sellers and agents', async () => {
      const mockCashboxData = [
        { id: 1, user_id: 1, amount: 5000, username: 'seller1', full_name: 'Seller One', role: 'seller' },
        { id: 2, user_id: 2, amount: 3000, username: 'seller2', full_name: 'Seller Two', role: 'seller' }
      ];

      mockStatement.all.mockReturnValueOnce(mockCashboxData).mockReturnValueOnce([]);

      const res = await request(app)
        .get('/api/cashbox');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].username).toBe('seller1');
    });
  });

  describe('GET /api/cashbox/me', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await request(app)
        .get('/api/cashbox/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Требуется авторизация');
    });

    it('should return current user cashbox', async () => {
      const mockUser = { id: 1, username: 'seller1', role: 'seller' };
      const mockCashbox = { id: 1, user_id: 1, amount: 5000 };

      mockStatement.get.mockReturnValue(mockCashbox);

      const res = await request(app)
        .get('/api/cashbox/me')
        .set('x-test-user', JSON.stringify(mockUser));

      expect(res.statusCode).toBe(200);
      expect(res.body.amount).toBe(5000);
    });

    it('should create cashbox if not exists for agent', async () => {
      const mockUser = { id: 1, username: 'agent1', role: 'agent' };
      
      mockStatement.get.mockReturnValueOnce(null);
      mockStatement.run.mockReturnValue({});

      await request(app)
        .get('/api/cashbox/me')
        .set('x-test-user', JSON.stringify(mockUser));

      expect(mockStatement.run).toHaveBeenCalled();
    });
  });

  describe('POST /api/cashbox/reset', () => {
    it('should reset cashbox successfully', async () => {
      const mockUser = { id: 1, username: 'manager', role: 'manager' };
      
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .post('/api/cashbox/reset')
        .set('x-test-user', JSON.stringify(mockUser))
        .send({ user_id: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Касса обнулена');
    });

    it('should update cashbox amount to zero', async () => {
      const mockUser = { id: 1, username: 'manager', role: 'manager' };
      
      mockStatement.run.mockReturnValue({});

      await request(app)
        .post('/api/cashbox/reset')
        .set('x-test-user', JSON.stringify(mockUser))
        .send({ user_id: 1 });

      expect(mockStatement.run).toHaveBeenCalled();
    });
  });
});
