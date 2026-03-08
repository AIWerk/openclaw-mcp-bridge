# OpenClaw MCP Client Plugin - Windows Installer
# Usage: irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.ps1 | iex
$ErrorActionPreference = "Stop"

$PluginDir = "$env:USERPROFILE\.openclaw\extensions\mcp-client"
$ConfigFile = "$env:USERPROFILE\.openclaw\openclaw.json"

Write-Host "📦 Installing OpenClaw MCP Client Plugin..." -ForegroundColor Cyan

# 1. Clone or update
if (Test-Path "$PluginDir\.git") {
    Write-Host "⬆️  Updating existing installation..."
    Push-Location $PluginDir
    git pull --ff-only
    Pop-Location
} else {
    Write-Host "📥 Cloning plugin..."
    $parent = Split-Path $PluginDir -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    git clone https://github.com/AIWerk/openclaw-mcp-bridge.git $PluginDir
}

# 2. Add to openclaw.json if not already present
if (Test-Path $ConfigFile) {
    $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json

    if (-not $cfg.plugins) { $cfg | Add-Member -NotePropertyName plugins -NotePropertyValue ([PSCustomObject]@{}) }
    if (-not $cfg.plugins.allow) { $cfg.plugins | Add-Member -NotePropertyName allow -NotePropertyValue @() }
    if (-not $cfg.plugins.entries) { $cfg.plugins | Add-Member -NotePropertyName entries -NotePropertyValue ([PSCustomObject]@{}) }

    if ($cfg.plugins.allow -notcontains "mcp-client") {
        $cfg.plugins.allow = @($cfg.plugins.allow) + "mcp-client"
    }

    if (-not $cfg.plugins.entries."mcp-client") {
        $cfg.plugins.entries | Add-Member -NotePropertyName "mcp-client" -NotePropertyValue ([PSCustomObject]@{
            enabled = $true
            config = [PSCustomObject]@{
                servers = [PSCustomObject]@{}
                toolPrefix = $true
                reconnectIntervalMs = 30000
                connectionTimeoutMs = 10000
                requestTimeoutMs = 60000
            }
        })
        Write-Host "✅ Plugin added to config" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Plugin already in config" -ForegroundColor Yellow
    }

    $cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile -Encoding UTF8
} else {
    Write-Host "⚠️  Config not found at $ConfigFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ MCP Client Plugin installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add MCP servers to config: openclaw config edit"
Write-Host "  2. Restart gateway: openclaw gateway restart"
Write-Host ""
