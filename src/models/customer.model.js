import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  phone_number: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;