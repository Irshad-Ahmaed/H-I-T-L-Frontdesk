import mongoose, { Schema } from 'mongoose';

const knowledgeBaseSchema = new Schema({
  question_text: {
    type: String,
    required: true,
    unique: true,
  },
  answer_text: {
    type: String,
    required: true,
  },
  source_request_id: {
    type: Schema.Types.ObjectId,
    ref: 'HelpRequest',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create text index for searching
knowledgeBaseSchema.index({ question_text: 'text' });

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
export default KnowledgeBase;