import { Router } from 'express';
import {
  receiveHelpRequest,
  learnNewFact,
  sendCustomerText,
} from '../controllers/supervisor.controller.js';

const router = Router();

// --- WEBHOOKS ---

// 1. Webhook from AI Agent to create a new request
router.post('/internal/requests', receiveHelpRequest);

// 2. Webhook from our resolver to learn a fact
router.post('/internal/learn', learnNewFact);

// 3. Webhook from our resolver to text a customer
router.post('/internal/send-text', sendCustomerText);

export default router;