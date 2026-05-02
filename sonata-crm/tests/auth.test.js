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

const authRouter = require('../routes/auth');

describe('Auth Routes', () => {
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
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/login', () => {
    it('should return error if username or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Введите логин и пароль');
    });

    it('should login successfully as user', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 'seller',
        full_name: 'Test User',
        point_id: 1
      };

      mockStatement.get.mockReturnValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.role).toBe('seller');
    });

    it('should login successfully as agent', async () => {
      const mockAgent = {
        id: 2,
        name: 'agent1',
        password: 'pass123',
        point_id: 1
      };

      mockStatement.get.mockReturnValueOnce(null).mockReturnValueOnce(mockAgent);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'agent1', password: 'pass123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('agent');
    });

    it('should return 401 for invalid credentials', async () => {
      mockStatement.get.mockReturnValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'invalid', password: 'wrong' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Неверный логин или пароль');
    });

    it('should initialize cashbox for seller on login', async () => {
      const mockUser = {
        id: 1,
        username: 'seller1',
        role: 'seller',
        full_name: 'Seller One',
        point_id: 1
      };

      mockStatement.get
        .mockReturnValueOnce(mockUser)
        .mockReturnValueOnce(null);

      await request(app)
        .post('/api/auth/login')
        .send({ username: 'seller1', password: 'password' });

      expect(mockStatement.run).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/check', () => {
    it('should return authenticated user info when session exists', (done) => {
      // Create a separate app with session pre-set
      const testApp = express();
      testApp.use(express.json());
      testApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: true
      }));
      
      testApp.use('/api/auth/check', (req, res, next) => {
        req.session.user = {
          id: 1,
          username: 'testuser',
          role: 'manager'
        };
        next();
      });
      testApp.use('/api/auth', authRouter);

      request(testApp)
        .get('/api/auth/check')
        .end((err, res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body.authenticated).toBe(true);
          expect(res.body.user.username).toBe('testuser');
          done();
        });
    });

    it('should return not authenticated when no session', async () => {
      const res = await request(app)
        .get('/api/auth/check');

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });
});
