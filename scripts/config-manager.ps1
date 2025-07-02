# Configuration manager for motea (PowerShell version)
# waycaan mit, 2025

param(
    [string]$Provider,
    [switch]$List,
    [switch]$Help
)

$ConfigDir = Join-Path $PSScriptRoot ".." "config"
$EnvFile = Join-Path $PSScriptRoot ".." ".env.local"

$Providers = @{
    'neon' = @{
        Name = 'Neon PostgreSQL'
        Description = 'Serverless PostgreSQL (recommended for Vercel)'
        File = 'env.neon.example'
    }
    'supabase' = @{
        Name = 'Supabase PostgreSQL'
        Description = 'PostgreSQL with additional backend services'
        File = 'env.supabase.example'
    }
    'self-hosted' = @{
        Name = 'Self-hosted PostgreSQL'
        Description = 'Your own PostgreSQL server or local development'
        File = 'env.self-hosted.example'
    }
}

function Show-Banner {
    Write-Host ""
    Write-Host "🔧 motea Configuration Manager" -ForegroundColor Blue
    Write-Host "=====================================" -ForegroundColor Blue
    Write-Host "This tool helps you set up database configuration for motea." -ForegroundColor Gray
    Write-Host ""
}

function Show-Help {
    Write-Host "motea Configuration Manager" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\config-manager.ps1                    Interactive setup"
    Write-Host "  .\config-manager.ps1 -Provider neon     Quick setup with provider"
    Write-Host "  .\config-manager.ps1 -List              List available providers"
    Write-Host "  .\config-manager.ps1 -Help              Show this help"
    Write-Host ""
    Write-Host "Available providers:" -ForegroundColor Yellow
    foreach ($key in $Providers.Keys) {
        $provider = $Providers[$key]
        Write-Host "  $key : $($provider.Name) - $($provider.Description)"
    }
}

function Show-Providers {
    Write-Host "Available database providers:" -ForegroundColor Yellow
    Write-Host ""
    $index = 1
    foreach ($key in $Providers.Keys) {
        $provider = $Providers[$key]
        Write-Host "$index. $($provider.Name)" -ForegroundColor Green
        Write-Host "   $($provider.Description)" -ForegroundColor Gray
        Write-Host ""
        $index++
    }
}

function Select-Provider {
    Show-Providers
    
    while ($true) {
        $choice = Read-Host "Select a provider (1-3) or type provider name"
        
        # Handle numeric choice
        if ($choice -match '^\d+$') {
            $numChoice = [int]$choice
            if ($numChoice -ge 1 -and $numChoice -le 3) {
                $providerKeys = @($Providers.Keys)
                return $providerKeys[$numChoice - 1]
            }
        }
        
        # Handle provider name
        if ($Providers.ContainsKey($choice.ToLower())) {
            return $choice.ToLower()
        }
        
        Write-Host "Invalid choice. Please try again." -ForegroundColor Red
        Write-Host ""
    }
}

function Copy-ConfigFile {
    param([string]$Provider)
    
    $sourceFile = Join-Path $ConfigDir $Providers[$Provider].File
    
    if (-not (Test-Path $sourceFile)) {
        Write-Host "❌ Configuration file not found: $sourceFile" -ForegroundColor Red
        return $false
    }
    
    try {
        $content = Get-Content $sourceFile -Raw
        Set-Content -Path $EnvFile -Value $content
        Write-Host "✅ Configuration copied to .env.local" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Error copying configuration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Get-CustomConfig {
    param([string]$Provider)
    
    Write-Host ""
    Write-Host "📝 Let's customize your $($Providers[$Provider].Name) configuration:" -ForegroundColor Blue
    Write-Host ""
    
    $config = @{}
    
    # Database URL
    switch ($Provider) {
        'neon' {
            $config.DATABASE_URL = Read-Host "Enter your Neon database URL"
        }
        'supabase' {
            $config.DATABASE_URL = Read-Host "Enter your Supabase database URL"
        }
        default {
            $config.DATABASE_URL = Read-Host "Enter your PostgreSQL database URL"
        }
    }
    
    # Password
    $usePassword = Read-Host "Do you want to set an application password? (y/n)"
    if ($usePassword -eq 'y' -or $usePassword -eq 'yes') {
        $config.PASSWORD = Read-Host "Enter application password"
        $config.DISABLE_PASSWORD = ''
    } else {
        $config.PASSWORD = ''
        $config.DISABLE_PASSWORD = 'true'
    }
    
    # Optional settings
    $preloadCount = Read-Host "Number of notes to preload (default: 10)"
    $config.PRELOAD_NOTES_COUNT = if ($preloadCount) { $preloadCount } else { '10' }
    
    $sessionSecret = Read-Host "Session secret (leave empty for auto-generation)"
    $config.SESSION_SECRET = if ($sessionSecret) { $sessionSecret } else { New-RandomString -Length 32 }
    
    return $config
}

function New-RandomString {
    param([int]$Length = 32)
    
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $result = ''
    for ($i = 0; $i -lt $Length; $i++) {
        $result += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $result
}

function Update-EnvFile {
    param([hashtable]$Config)
    
    try {
        $content = Get-Content $EnvFile -Raw
        
        # Update configuration values
        foreach ($key in $Config.Keys) {
            $value = $Config[$key]
            if ($value -eq '') {
                # Comment out the line
                $pattern = "^$key=.*$"
                $content = $content -replace $pattern, "# $key=", 'Multiline'
            } else {
                # Update or add the value
                $pattern = "^#?\s*$key=.*$"
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, "$key=$value", 'Multiline'
                } else {
                    $content += "`n$key=$value"
                }
            }
        }
        
        Set-Content -Path $EnvFile -Value $content
        Write-Host ""
        Write-Host "✅ Configuration updated successfully!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Error updating configuration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Show-NextSteps {
    param([string]$Provider)
    
    Write-Host ""
    Write-Host "🎉 Configuration complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Review and edit .env.local if needed"
    Write-Host "2. Make sure your database is accessible"
    
    if ($Provider -eq 'self-hosted') {
        Write-Host "3. Start your PostgreSQL server"
        Write-Host "4. Create the database if it doesn't exist"
    }
    
    Write-Host "5. Run the application:"
    Write-Host "   npm run dev    (for development)"
    Write-Host "   npm run build && npm start    (for production)"
    
    Write-Host ""
    Write-Host "📚 For more information, see:" -ForegroundColor Cyan
    Write-Host "   - config/$($Providers[$Provider].File)"
    Write-Host "   - DOCKER.md (for Docker deployment)"
    Write-Host "   - README.md (for general setup)"
}

# Handle command line arguments
if ($Help) {
    Show-Help
    exit 0
}

if ($List) {
    Write-Host "Available database providers:" -ForegroundColor Blue
    foreach ($key in $Providers.Keys) {
        $provider = $Providers[$key]
        Write-Host "  $key : $($provider.Name) - $($provider.Description)"
    }
    exit 0
}

# Main execution
try {
    Show-Banner
    
    # Check if .env.local already exists
    if (Test-Path $EnvFile) {
        $overwrite = Read-Host ".env.local already exists. Overwrite? (y/n)"
        if ($overwrite -ne 'y' -and $overwrite -ne 'yes') {
            Write-Host "Configuration cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Select or use provided provider
    if ($Provider -and $Providers.ContainsKey($Provider.ToLower())) {
        $selectedProvider = $Provider.ToLower()
        Write-Host "Using provider: $($Providers[$selectedProvider].Name)" -ForegroundColor Green
    } else {
        $selectedProvider = Select-Provider
    }
    
    Write-Host ""
    Write-Host "Selected: $($Providers[$selectedProvider].Name)" -ForegroundColor Green
    
    # Copy base configuration
    if (-not (Copy-ConfigFile -Provider $selectedProvider)) {
        exit 1
    }
    
    # Customize configuration
    $config = Get-CustomConfig -Provider $selectedProvider
    
    # Update configuration file
    if (Update-EnvFile -Config $config) {
        Show-NextSteps -Provider $selectedProvider
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
