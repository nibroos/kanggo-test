import { Router } from 'express';
import authRoutes from './auth.routes.js';
import taskRoutes from './task.routes.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

router.get('/', (req, res) =>
  sendSuccess(res, {
    message: 'Task Management API',
    data: {
      version: '1.0.0',
      documentation: '/api/docs',
      endpoints: ['/api/auth', '/api/tasks', '/health', '/live', '/ready'],
    },
  }),
);

router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);

export default router;
