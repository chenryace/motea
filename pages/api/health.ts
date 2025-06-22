import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const connectionString = process.env.DATABASE_URL;
        
        if (!connectionString) {
            return res.status(500).json({ 
                error: 'DATABASE_URL not configured',
                status: 'error'
            });
        }

        // Test database connection with minimal configuration
        const pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 1,
            idleTimeoutMillis: 5000,
            connectionTimeoutMillis: 5000,
        });

        const client = await pool.connect();
        
        try {
            // Simple query to test connection
            const result = await client.query('SELECT NOW() as current_time');
            
            await pool.end();
            
            return res.status(200).json({
                status: 'healthy',
                database: 'connected',
                timestamp: result.rows[0].current_time,
                environment: process.env.NODE_ENV || 'development'
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Health check failed:', error);
        
        return res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}
