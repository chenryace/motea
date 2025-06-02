// Simple test to verify PostgreSQL configuration
const { Pool } = require('pg');

async function testConnection() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/test';
    
    console.log('Testing PostgreSQL connection...');
    console.log('Connection string:', connectionString.replace(/:[^:@]*@/, ':***@'));
    
    const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connection successful!');
        
        // Test creating tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS test_notes (
                id VARCHAR(255) PRIMARY KEY,
                content TEXT
            );
        `);
        console.log('✅ Table creation successful!');
        
        // Test inserting data
        await client.query(
            'INSERT INTO test_notes (id, content) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content',
            ['test-1', 'Hello PostgreSQL!']
        );
        console.log('✅ Data insertion successful!');
        
        // Test querying data
        const result = await client.query('SELECT * FROM test_notes WHERE id = $1', ['test-1']);
        console.log('✅ Data query successful!', result.rows[0]);
        
        // Cleanup
        await client.query('DROP TABLE test_notes');
        console.log('✅ Cleanup successful!');
        
        client.release();
        await pool.end();
        
        console.log('🎉 All PostgreSQL tests passed!');
    } catch (error) {
        console.error('❌ PostgreSQL test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    testConnection();
}

module.exports = { testConnection };
