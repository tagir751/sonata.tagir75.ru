const request = require('supertest');
const express = require('express');

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

const adminRouter = require('../routes/admin');

describe('Admin Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
  });

  describe('GET /api/admin/data', () => {
    it('should return all reference data', async () => {
      mockStatement.all
        .mockReturnValueOnce([]) // excursions
        .mockReturnValueOnce([]) // points
        .mockReturnValueOnce([]) // drivers
        .mockReturnValueOnce([]) // guides
        .mockReturnValueOnce([]) // routeTemplates
        .mockReturnValueOnce([]) // users
        .mockReturnValueOnce([]); // agents

      const res = await request(app)
        .get('/api/admin/data');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('excursions');
      expect(res.body).toHaveProperty('points');
      expect(res.body).toHaveProperty('drivers');
      expect(res.body).toHaveProperty('guides');
      expect(res.body).toHaveProperty('routeTemplates');
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('agents');
    });
  });

  describe('POST /api/admin/excursions', () => {
    it('should create new excursion', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/excursions')
        .send({
          name: 'New Excursion',
          description: 'Test description',
          base_price: 1500
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe(1);
    });
  });

  describe('DELETE /api/admin/excursions/:id', () => {
    it('should deactivate excursion', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/excursions/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/points', () => {
    it('should create new sales point', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/points')
        .send({
          name: 'New Point',
          address: 'Test Address'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/points/:id', () => {
    it('should delete sales point', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/points/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/drivers', () => {
    it('should create new driver', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/drivers')
        .send({
          full_name: 'Ivanov Ivan',
          phone: '+71234567890',
          car_info: 'Toyota Camry'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/drivers/:id', () => {
    it('should deactivate driver', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/drivers/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/guides', () => {
    it('should create new guide', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/guides')
        .send({
          full_name: 'Petrov Petr',
          phone: '+70987654321'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/guides/:id', () => {
    it('should deactivate guide', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/guides/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/active-excursions', () => {
    it('should create new active excursion', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/active-excursions')
        .send({
          excursion_id: 1,
          date: '2025-05-10',
          template_id: 1,
          guide_id: 1,
          driver_id: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/active-excursions/:id', () => {
    it('should cancel active excursion', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/active-excursions/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/route-templates', () => {
    it('should create new route template with points', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/route-templates')
        .send({
          name: 'Route 1',
          description: 'Test route',
          points: [
            { name: 'Stop 1', time: '09:00' },
            { name: 'Stop 2', time: '09:30' }
          ]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe(1);
    });
  });

  describe('DELETE /api/admin/route-templates/:id', () => {
    it('should delete route template', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/route-templates/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create new user', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/users')
        .send({
          username: 'newuser',
          password: 'password123',
          role: 'seller',
          full_name: 'New User',
          point_id: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/admin/users/:id/password', () => {
    it('should update user password', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .put('/api/admin/users/1/password')
        .send({ password: 'newpassword' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete user', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/users/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/agents', () => {
    it('should create new agent', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/admin/agents')
        .send({
          name: 'agent1',
          password: 'pass123',
          point_id: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/admin/agents/:id/password', () => {
    it('should update agent password', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .put('/api/admin/agents/1/password')
        .send({ password: 'newpass' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/agents/:id', () => {
    it('should delete agent', async () => {
      mockStatement.run.mockReturnValue({});

      const res = await request(app)
        .delete('/api/admin/agents/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
