import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createTaskSchema,
  replaceTaskSchema,
  patchTaskSchema,
  taskIdParamSchema,
  listTasksQuerySchema,
} from '../validators/task.validator.js';

const router = Router();

// Every task route requires a valid access token (spec §8).
router.use(authenticate);

router.get('/', validate(listTasksQuerySchema, 'query'), taskController.index);
router.post('/', validate(createTaskSchema), taskController.store);

router.get('/:id', validate(taskIdParamSchema, 'params'), taskController.show);

router.put(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(replaceTaskSchema),
  taskController.replace,
);

router.patch(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(patchTaskSchema),
  taskController.patch,
);

router.delete('/:id', validate(taskIdParamSchema, 'params'), taskController.destroy);

export default router;
