const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wrapchik',
      { serverSelectionTimeoutMS: 5000, autoIndex: process.env.NODE_ENV !== 'production' }
    );

    console.log(`[MongoDB] Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    // Driver messages can include connection details. Keep credentials and URI out of logs.
    console.error('[MongoDB] Connection failed.');
    throw error;
  }
};

module.exports = connectDB;
