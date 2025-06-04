#!/usr/bin/env node
// Configuration validator for motea
// waycaan mit, 2025

const fs = require('fs');
const path = require('path');

// Database provider detection (simplified version for validation)
const DATABASE_PROVIDERS = {
    'neon': /neon\.tech/,
    'supabase': /supabase\.co/,
    'self-hosted': /.*/
};

function detectDatabaseProvider(connectionString) {
    for (const [provider, pattern] of Object.entries(DATABASE_PROVIDERS)) {
        if (pattern.test(connectionString) && provider !== 'self-hosted') {
            return provider;
        }
    }
    return 'self-hosted';
}

const ENV_FILE = path.join(__dirname, '..', '.env.local');

function loadEnvFile() {
    if (!fs.existsSync(ENV_FILE)) {
        return null;
    }
    
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                env[key] = valueParts.join('=');
            }
        }
    });
    
    return env;
}

function validateEnvironment(env) {
    const issues = {
        errors: [],
        warnings: [],
        info: []
    };
    
    // Check required variables
    if (!env.DATABASE_URL) {
        issues.errors.push('DATABASE_URL is required');
    }
    
    // Check authentication
    if (!env.PASSWORD && env.DISABLE_PASSWORD !== 'true') {
        issues.warnings.push('No authentication configured. Set PASSWORD or DISABLE_PASSWORD=true');
    }
    
    if (env.PASSWORD && env.DISABLE_PASSWORD === 'true') {
        issues.warnings.push('Both PASSWORD and DISABLE_PASSWORD are set. DISABLE_PASSWORD will take precedence');
    }
    
    // Check session secret
    if (!env.SESSION_SECRET) {
        issues.warnings.push('SESSION_SECRET not set. A random secret will be generated');
    } else if (env.SESSION_SECRET.length < 16) {
        issues.warnings.push('SESSION_SECRET should be at least 16 characters long');
    }
    
    // Check performance settings
    if (env.PRELOAD_NOTES_COUNT) {
        const count = parseInt(env.PRELOAD_NOTES_COUNT);
        if (isNaN(count) || count < 1) {
            issues.warnings.push('PRELOAD_NOTES_COUNT should be a positive number');
        } else if (count > 50) {
            issues.warnings.push('PRELOAD_NOTES_COUNT > 50 may impact performance');
        }
    }
    
    // Check Node environment
    if (env.NODE_ENV && !['development', 'production', 'test'].includes(env.NODE_ENV)) {
        issues.warnings.push('NODE_ENV should be development, production, or test');
    }
    
    // Check port
    if (env.PORT) {
        const port = parseInt(env.PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
            issues.errors.push('PORT must be a valid port number (1-65535)');
        }
    }
    
    return issues;
}

function validateDatabase(env) {
    const issues = {
        errors: [],
        warnings: [],
        info: []
    };
    
    if (!env.DATABASE_URL) {
        return issues;
    }
    
    try {
        // Detect provider
        const detectedProvider = detectDatabaseProvider(env.DATABASE_URL);
        const explicitProvider = env.DB_PROVIDER;
        
        if (explicitProvider && explicitProvider !== detectedProvider) {
            issues.warnings.push(`DB_PROVIDER is set to '${explicitProvider}' but URL suggests '${detectedProvider}'`);
        }
        
        // Basic database configuration validation
        const provider = explicitProvider || detectedProvider;
        const requiresSSL = provider === 'neon' || provider === 'supabase' ||
                           env.DATABASE_URL.includes('sslmode=require') ||
                           env.DATABASE_URL.includes('ssl=true');

        issues.info.push(`Detected database provider: ${provider}`);
        issues.info.push(`SSL required: ${requiresSSL}`);

        // Basic URL validation
        if (!env.DATABASE_URL.startsWith('postgres://') && !env.DATABASE_URL.startsWith('postgresql://')) {
            issues.errors.push('DATABASE_URL must start with postgres:// or postgresql://');
        }
        
        // Provider-specific checks
        if (provider === 'neon') {
            if (!requiresSSL) {
                issues.warnings.push('Neon databases require SSL connections');
            }
            if (!env.DATABASE_URL.includes('sslmode=require')) {
                issues.warnings.push('Consider adding ?sslmode=require to Neon connection string');
            }
        }

        if (provider === 'supabase') {
            if (!requiresSSL) {
                issues.warnings.push('Supabase databases typically require SSL connections');
            }
        }

        if (provider === 'self-hosted') {
            if (env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1')) {
                issues.info.push('Using local database - ensure PostgreSQL is running');
            }
        }
        
    } catch (error) {
        issues.errors.push(`Database configuration error: ${error.message}`);
    }
    
    return issues;
}

function printIssues(issues, title) {
    if (issues.errors.length === 0 && issues.warnings.length === 0 && issues.info.length === 0) {
        return;
    }
    
    console.log(`\n${title}:`);
    console.log('='.repeat(title.length + 1));
    
    issues.errors.forEach(error => {
        console.log(`❌ ERROR: ${error}`);
    });
    
    issues.warnings.forEach(warning => {
        console.log(`⚠️  WARNING: ${warning}`);
    });
    
    issues.info.forEach(info => {
        console.log(`ℹ️  INFO: ${info}`);
    });
}

function main() {
    console.log('🔍 motea Configuration Validator');
    console.log('================================');
    
    // Load environment file
    const env = loadEnvFile();
    
    if (!env) {
        console.log('❌ No .env.local file found');
        console.log('\nTo create a configuration file:');
        console.log('  node scripts/config-manager.js');
        console.log('  or');
        console.log('  copy .env.example to .env.local and edit it');
        process.exit(1);
    }
    
    console.log(`✅ Found .env.local with ${Object.keys(env).length} variables`);
    
    // Validate environment
    const envIssues = validateEnvironment(env);
    printIssues(envIssues, 'Environment Configuration');
    
    // Validate database
    const dbIssues = validateDatabase(env);
    printIssues(dbIssues, 'Database Configuration');
    
    // Summary
    const totalErrors = envIssues.errors.length + dbIssues.errors.length;
    const totalWarnings = envIssues.warnings.length + dbIssues.warnings.length;
    
    console.log('\n📊 Validation Summary:');
    console.log('=====================');
    
    if (totalErrors === 0) {
        console.log('✅ No errors found');
    } else {
        console.log(`❌ ${totalErrors} error(s) found`);
    }
    
    if (totalWarnings === 0) {
        console.log('✅ No warnings');
    } else {
        console.log(`⚠️  ${totalWarnings} warning(s) found`);
    }
    
    if (totalErrors === 0 && totalWarnings === 0) {
        console.log('\n🎉 Configuration looks good!');
        console.log('\nNext steps:');
        console.log('1. Start your database (if self-hosted)');
        console.log('2. Run the application:');
        console.log('   npm run dev    (development)');
        console.log('   npm run build && npm start    (production)');
    } else if (totalErrors > 0) {
        console.log('\n🚨 Please fix the errors before running the application');
        process.exit(1);
    } else {
        console.log('\n⚠️  Consider addressing the warnings for optimal configuration');
    }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('motea Configuration Validator');
    console.log('\nUsage:');
    console.log('  node scripts/validate-config.js    Validate .env.local');
    console.log('  node scripts/validate-config.js --help    Show this help');
    process.exit(0);
}

if (require.main === module) {
    main();
}
