import mongoose from 'mongoose';
const { Schema } = mongoose;

const knowledgeBaseSchema = new mongoose.Schema({
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

knowledgeBaseSchema.index({ question_text: 'text' });
const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
export default KnowledgeBase;