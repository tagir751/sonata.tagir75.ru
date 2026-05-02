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

const chatRouter = require('../routes/chat');

describe('Chat Routes', () => {
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
    
    app.use('/api/chat', chatRouter);
  });

  describe('GET /api/chat', () => {
    it('should return list of chat messages', async () => {
      const mockMessages = [
        { id: 2, sender_username: 'manager1', message: 'Hi there!', is_manager: 1, created_at: '2025-05-01 10:01:00' },
        { id: 1, sender_username: 'user1', message: 'Hello!', is_manager: 0, created_at: '2025-05-01 10:00:00' }
      ];

      mockStatement.all.mockReturnValue(mockMessages);

      const res = await request(app)
        .get('/api/chat');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      // Messages are reversed in the route, so first one should be user1
      expect(res.body[0].sender_username).toBe('user1');
    });

    it('should respect limit parameter', async () => {
      const mockMessages = [
        { id: 1, sender_username: 'user1', message: 'Message 1', is_manager: 0, created_at: '2025-05-01 10:00:00' }
      ];

      mockStatement.all.mockReturnValue(mockMessages);

      const res = await request(app)
        .get('/api/chat?limit=50');

      expect(res.statusCode).toBe(200);
      expect(mockStatement.all).toHaveBeenCalledWith(50);
    });
  });

  describe('POST /api/chat', () => {
    it('should return error if message is empty', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Сообщение не может быть пустым');
    });

    it('should send message successfully', async () => {
      const mockUser = { username: 'testuser', role: 'seller' };
      
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .post('/api/chat')
        .set('x-test-user', JSON.stringify(mockUser))
        .send({ message: 'Test message' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should mark manager messages correctly', async () => {
      const mockManager = { username: 'manager1', role: 'manager' };
      
      mockStatement.run.mockReturnValue({});

      await request(app)
        .post('/api/chat')
        .set('x-test-user', JSON.stringify(mockManager))
        .send({ message: 'Manager message' });

      expect(mockStatement.run).toHaveBeenCalled();
    });
  });
});
