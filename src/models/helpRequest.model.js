import mongoose from 'mongoose';
const { Schema } = mongoose;

const helpRequestSchema = new mongoose.Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  customer_phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'RESOLVED', 'UNRESOLVED'],
    default: 'PENDING',
    index: true,
  },
  original_question: {
    type: String,
    required: true,
  },
  supervisor_answer: {
    type: String,
    default: null,
  },
  supervisorId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
});

const HelpRequest = mongoose.model('HelpRequest', helpRequestSchema);
export default HelpRequest;