#!/usr/bin/env node
// Configuration manager for motea
// waycaan mit, 2025

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const ENV_FILE = path.join(__dirname, '..', '.env.local');

const PROVIDERS = {
    'neon': {
        name: 'Neon PostgreSQL',
        description: 'Serverless PostgreSQL (recommended for Vercel)',
        file: 'env.neon.example'
    },
    'supabase': {
        name: 'Supabase PostgreSQL',
        description: 'PostgreSQL with additional backend services',
        file: 'env.supabase.example'
    },
    'self-hosted': {
        name: 'Self-hosted PostgreSQL',
        description: 'Your own PostgreSQL server or local development',
        file: 'env.self-hosted.example'
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function showBanner() {
    console.log('\n🔧 motea Configuration Manager');
    console.log('=====================================');
    console.log('This tool helps you set up database configuration for motea.\n');
}

function showProviders() {
    console.log('Available database providers:\n');
    Object.entries(PROVIDERS).forEach(([key, provider], index) => {
        console.log(`${index + 1}. ${provider.name}`);
        console.log(`   ${provider.description}\n`);
    });
}

async function selectProvider() {
    showProviders();
    
    while (true) {
        const choice = await question('Select a provider (1-3) or type provider name: ');
        
        // Handle numeric choice
        const numChoice = parseInt(choice);
        if (numChoice >= 1 && numChoice <= 3) {
            const providerKey = Object.keys(PROVIDERS)[numChoice - 1];
            return providerKey;
        }
        
        // Handle provider name
        if (PROVIDERS[choice.toLowerCase()]) {
            return choice.toLowerCase();
        }
        
        console.log('Invalid choice. Please try again.\n');
    }
}

function copyConfigFile(provider) {
    const sourceFile = path.join(CONFIG_DIR, PROVIDERS[provider].file);
    
    if (!fs.existsSync(sourceFile)) {
        console.error(`❌ Configuration file not found: ${sourceFile}`);
        return false;
    }
    
    try {
        const content = fs.readFileSync(sourceFile, 'utf8');
        fs.writeFileSync(ENV_FILE, content);
        console.log(`✅ Configuration copied to .env.local`);
        return true;
    } catch (error) {
        console.error(`❌ Error copying configuration: ${error.message}`);
        return false;
    }
}

async function customizeConfig(provider) {
    console.log(`\n📝 Let's customize your ${PROVIDERS[provider].name} configuration:\n`);
    
    const config = {};
    
    // Database URL
    if (provider === 'neon') {
        config.DATABASE_URL = await question('Enter your Neon database URL: ');
    } else if (provider === 'supabase') {
        config.DATABASE_URL = await question('Enter your Supabase database URL: ');
    } else {
        config.DATABASE_URL = await question('Enter your PostgreSQL database URL: ');
    }
    
    // Password
    const usePassword = await question('Do you want to set an application password? (y/n): ');
    if (usePassword.toLowerCase() === 'y' || usePassword.toLowerCase() === 'yes') {
        config.PASSWORD = await question('Enter application password: ');
        config.DISABLE_PASSWORD = '';
    } else {
        config.PASSWORD = '';
        config.DISABLE_PASSWORD = 'true';
    }
    
    // Optional settings
    const preloadCount = await question('Number of notes to preload (default: 10): ');
    config.PRELOAD_NOTES_COUNT = preloadCount || '10';
    
    const sessionSecret = await question('Session secret (leave empty for auto-generation): ');
    config.SESSION_SECRET = sessionSecret || generateRandomString(32);
    
    return config;
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function updateEnvFile(config) {
    try {
        let content = fs.readFileSync(ENV_FILE, 'utf8');
        
        // Update configuration values
        Object.entries(config).forEach(([key, value]) => {
            if (value === '') {
                // Comment out the line
                const regex = new RegExp(`^${key}=.*$`, 'm');
                content = content.replace(regex, `# ${key}=`);
            } else {
                // Update or add the value
                const regex = new RegExp(`^#?\\s*${key}=.*$`, 'm');
                if (regex.test(content)) {
                    content = content.replace(regex, `${key}=${value}`);
                } else {
                    content += `\n${key}=${value}`;
                }
            }
        });
        
        fs.writeFileSync(ENV_FILE, content);
        console.log('\n✅ Configuration updated successfully!');
        return true;
    } catch (error) {
        console.error(`❌ Error updating configuration: ${error.message}`);
        return false;
    }
}

function showNextSteps(provider) {
    console.log('\n🎉 Configuration complete!');
    console.log('\nNext steps:');
    console.log('1. Review and edit .env.local if needed');
    console.log('2. Make sure your database is accessible');
    
    if (provider === 'self-hosted') {
        console.log('3. Start your PostgreSQL server');
        console.log('4. Create the database if it doesn\'t exist');
    }
    
    console.log('5. Run the application:');
    console.log('   npm run dev    (for development)');
    console.log('   npm run build && npm start    (for production)');
    
    console.log('\n📚 For more information, see:');
    console.log(`   - config/${PROVIDERS[provider].file}`);
    console.log('   - DOCKER.md (for Docker deployment)');
    console.log('   - README.md (for general setup)');
}

async function main() {
    try {
        showBanner();
        
        // Check if .env.local already exists
        if (fs.existsSync(ENV_FILE)) {
            const overwrite = await question('.env.local already exists. Overwrite? (y/n): ');
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                console.log('Configuration cancelled.');
                rl.close();
                return;
            }
        }
        
        // Select provider
        const provider = await selectProvider();
        console.log(`\nSelected: ${PROVIDERS[provider].name}`);
        
        // Copy base configuration
        if (!copyConfigFile(provider)) {
            rl.close();
            return;
        }
        
        // Customize configuration
        const config = await customizeConfig(provider);
        
        // Update configuration file
        if (updateEnvFile(config)) {
            showNextSteps(provider);
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    } finally {
        rl.close();
    }
}

// Handle command line arguments
if (process.argv.length > 2) {
    const command = process.argv[2];
    
    if (command === '--help' || command === '-h') {
        console.log('motea Configuration Manager');
        console.log('\nUsage:');
        console.log('  node scripts/config-manager.js          Interactive setup');
        console.log('  node scripts/config-manager.js --help   Show this help');
        console.log('  node scripts/config-manager.js --list   List available providers');
        process.exit(0);
    }
    
    if (command === '--list' || command === '-l') {
        console.log('Available database providers:');
        Object.entries(PROVIDERS).forEach(([key, provider]) => {
            console.log(`  ${key}: ${provider.name} - ${provider.description}`);
        });
        process.exit(0);
    }
}

// Run interactive setup
if (require.main === module) {
    main();
}
