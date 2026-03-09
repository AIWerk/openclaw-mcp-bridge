# OpenClaw MCP Client Plugin - Windows Uninstaller
$ErrorActionPreference = "Stop"

$PluginDir = "$env:USERPROFILE\.openclaw\extensions\mcp-client"
$ConfigFile = "$env:USERPROFILE\.openclaw\openclaw.json"
$EnvFile = "$env:USERPROFILE\.openclaw\.env"

Write-Host "🗑️  Uninstalling OpenClaw MCP Client Plugin..." -ForegroundColor Cyan
Write-Host ""

# 1. Remove all server tokens from .env
if ((Test-Path $EnvFile) -and (Test-Path "$PluginDir\servers")) {
    Get-ChildItem "$PluginDir\servers\*\env_vars" -ErrorAction SilentlyContinue | ForEach-Object {
        $envVarName = (Get-Content $_.FullName -TotalCount 1).Trim()
        $envContent = Get-Content $EnvFile
        $filtered = $envContent | Where-Object { $_ -notmatch "^$envVarName=" }
        if ($filtered.Count -lt $envContent.Count) {
            $filtered | Set-Content $EnvFile -Encoding UTF8
            Write-Host "🔑 Removed $envVarName from .env" -ForegroundColor Green
        }
    }
}

# 2. Remove skill junction
foreach ($skillsDir in @("$env:USERPROFILE\clawd\skills", "$env:USERPROFILE\.openclaw\workspace\skills", "$env:USERPROFILE\.openclaw\skills", "$env:USERPROFILE\openclaw\skills")) {
    $link = "$skillsDir\add-mcp-server"
    if (Test-Path $link) {
        Remove-Item $link -Force -Recurse
        Write-Host "🧠 Removed skill junction from $skillsDir\" -ForegroundColor Green
    }
}

# 3. Backup and clean openclaw.json
if (Test-Path $ConfigFile) {
    $backupFile = "$ConfigFile.bak-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item $ConfigFile $backupFile
    Write-Host "📋 Backup: $backupFile"

    try {
        $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        $changed = $false
        if ($cfg.plugins.entries.PSObject.Properties.Name -contains 'mcp-client') {
            $cfg.plugins.entries.PSObject.Properties.Remove('mcp-client')
            $changed = $true
        }
        if ($cfg.plugins.allow -contains 'mcp-client') {
            $cfg.plugins.allow = @($cfg.plugins.allow | Where-Object { $_ -ne 'mcp-client' })
            $changed = $true
        }
        if ($changed) {
            $cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile -Encoding UTF8
            Write-Host "📋 Removed mcp-client from openclaw.json" -ForegroundColor Green
        } else {
            Write-Host "📋 mcp-client not found in config (already clean)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Could not update config: $_" -ForegroundColor Yellow
    }
}

# 4. Remove plugin directory
Remove-Item $PluginDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "📦 Removed $PluginDir" -ForegroundColor Green

# 5. Restart gateway
Write-Host ""
$restart = Read-Host "Restart gateway now? [Y/n]"
if ([string]::IsNullOrEmpty($restart) -or $restart -match '^[Yy]$') {
    try {
        Restart-Service openclaw-gateway -ErrorAction Stop
        Write-Host "✅ Gateway restarted." -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Auto-restart failed. Run: Restart-Service openclaw-gateway" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭️  Run manually: Restart-Service openclaw-gateway"
}

Write-Host ""
Write-Host "✅ MCP Client Plugin uninstalled." -ForegroundColor Green
Write-Host ""
Write-Host "To reinstall:"
Write-Host "  irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.ps1 | iex"
Write-Host ""
