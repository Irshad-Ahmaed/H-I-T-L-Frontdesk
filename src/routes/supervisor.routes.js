import { Router } from 'express';
import {
  renderSupervisorDashboard,
  resolveHelpRequest,
} from '../controllers/supervisor.controller.js';

const router = Router();

// --- HUMAN-FACING UI ---

// 1. GET /admin - Renders the main dashboard
router.get('/', renderSupervisorDashboard);

// 2. POST /admin/request/:requestId/resolve - Handles the form submission
router.post('/request/:requestId/resolve', resolveHelpRequest);

export default router;