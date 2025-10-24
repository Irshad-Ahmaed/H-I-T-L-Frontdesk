import cron from 'node-cron';
import HelpRequest from '../models/helpRequest.model.js';

const TIMEOUT_MINUTES = 10;

// Run every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  try {
    const result = await HelpRequest.updateMany(
      {
        status: 'PENDING',
        createdAt: { $lt: cutoff },
      },
      {
        $set: {
          status: 'UNRESOLVED',
          resolvedAt: new Date(),
        },
      }
    );

    console.log(`[Timeout] ${result.modifiedCount} requests marked as UNRESOLVED`);

  } catch (error) {
    console.error('[Timeout Cron Error]:', error.message);
  }
});
