import mongoose from 'mongoose';
import axios from 'axios';
import Customer from '../models/customer.model.js';
import HelpRequest from '../models/helpRequest.model.js';
import KnowledgeBase from '../models/knowledgeBase.model.js';
import NotificationService from '../services/notification.service.js';

// --- 1. RECEIVES WEBHOOK from AI-AGENT ---
export const receiveHelpRequest = async (req, res) => {
    try {
        const { customerPhone, question } = req.body;

        if (!customerPhone || !question) {
            return res.status(400).json({ error: 'Missing customerPhone or question' });
        }

        console.log(`[Webhook] Received new request from ${customerPhone}`);

        // Find or create the customer
        let customer = await Customer.findOneAndUpdate(
            { phone_number: customerPhone },
            { phone_number: customerPhone },
            { upsert: true, new: true } // upsert = create if not found --- Learned ---
        );

        // Creating the help request
        const newRequest = await HelpRequest.create({
            customerId: customer._id,
            customer_phone: customerPhone,
            original_question: question,
            status: 'PENDING',
        });

        // Simulating the text alert to the supervisor
        NotificationService.sendSupervisorAlert(question, customerPhone);

        res.status(201).json({ success: true, requestId: newRequest._id });
    } catch (error) {
        console.error('[Error] Receiving help request:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- 2. RENDERS UI for SUPERVISOR ---
export const renderSupervisorDashboard = async (req, res) => {
    try {
        // Find all pending requests, oldest first
        const pendingRequests = await HelpRequest.find({ status: 'PENDING' }).sort({ createdAt: 1 });

        // Find all resolved requests, newest first
        const resolvedRequests = await HelpRequest.find({ status: 'RESOLVED' }).sort({ resolvedAt: -1 }).limit(10);

        // Find all learned answers
        const learnedAnswers = await KnowledgeBase.find().sort({ createdAt: -1 }).limit(20);

        // unresolved/expire answer 
        const unresolvedRequests = await HelpRequest.find({ status: 'UNRESOLVED' })
            .sort({ resolvedAt: -1 })
            .limit(10);

        res.render('admin', {
            pendingRequests,
            resolvedRequests,
            learnedAnswers,
            unresolvedRequests
        });
    } catch (error) {
        console.error('[Error] Rendering dashboard:', error.message);
        res.status(500).send('Error loading admin panel');
    }
};

// --- 3. HANDLES "SUBMIT" from SUPERVISOR UI ---
export const resolveHelpRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { answer } = req.body;
        const supervisorId = process.env.DEFAULT_SUPERVISOR_ID || 'supervisor';

        if (!answer) {
            return res.status(400).send('Answer is required');
        }

        // Update the request in the DB
        const request = await HelpRequest.findByIdAndUpdate(
            requestId,
            {
                status: 'RESOLVED',
                supervisor_answer: answer,
                supervisorId: supervisorId,
                resolvedAt: new Date(),
            },
            { new: true } // Return the updated document
        );

        if (!request) {
            return res.status(404).send('Request not found');
        }

        console.log(`[Resolver] Request ${requestId} resolved by ${supervisorId}`);

        // --- Fire Webhooks for Post-Resolution Actions ---
        // This is the key to decoupling our services.

        const backendUrl = `http://localhost:${process.env.PORT || 3000}`;

        // 1. Tell ourselves to "learn" this fact
        await axios.post(`${backendUrl}/api/internal/learn`, {
            question: request.original_question,
            answer: request.supervisor_answer,
            source_request_id: request._id,
        });

        // 2. Tell ourselves to "text" the customer
        await axios.post(`${backendUrl}/api/internal/send-text`, {
            phone: request.customer_phone,
            question: request.original_question,
            answer: request.supervisor_answer,
        });

        // Redirect the supervisor back to the admin panel
        res.redirect('/admin');

    } catch (error) {
        console.error('[Error] Resolving request:', error.message);
        res.status(500).send('Error resolving request');
    }
};

// --- 4. RECEIVES "learn" WEBHOOK ---
export const learnNewFact = async (req, res) => {
    try {
        const { question, answer, source_request_id } = req.body;

        console.log(`[Webhook-Learn] Learning: "${question}"`);

        // Use findOneAndUpdate with upsert to prevent duplicates
        await KnowledgeBase.findOneAndUpdate(
            { question_text: question },
            {
                question_text: question,
                answer_text: answer,
                source_request_id: source_request_id,
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[Error] Learning fact:', error.message);
        res.status(500).json({ error: 'Error learning fact' });
    }
};

// --- 5. RECEIVES "send-text" WEBHOOK ---
export const sendCustomerText = (req, res) => {
    try {
        const { phone, question, answer } = req.body;

        console.log(`[Webhook-Text] Sending text to ${phone}`);

        // Call the simulator
        NotificationService.sendCustomerText(phone, question, answer);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[Error] Sending text:', error.message);
        res.status(500).json({ error: 'Error sending text' });
    }
};