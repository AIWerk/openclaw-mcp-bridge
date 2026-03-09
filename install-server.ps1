$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($args.Count -gt 0) {
    $ServerName = $args[0]
} else {
    Write-Host "Usage: install-server.ps1 <server-name>"
    Write-Host "Available servers:"
    Get-ChildItem -Path (Join-Path $RootDir "servers") -Directory | ForEach-Object {
        if (Test-Path (Join-Path $_.FullName "config.json")) {
            Write-Host "  $($_.Name)"
        }
    }
    exit 1
}

$ServerDir = Join-Path $RootDir "servers\$ServerName"
if (-not (Test-Path $ServerDir)) {
    Write-Host "Unknown server: $ServerName"
    Write-Host "Available servers:"
    Get-ChildItem -Path (Join-Path $RootDir "servers") -Directory | ForEach-Object {
        if (Test-Path (Join-Path $_.FullName "config.json")) {
            Write-Host "  $($_.Name)"
        }
    }
    exit 1
}

$ServerTitle = ($ServerName -replace '-', ' ' -split ' ' | ForEach-Object { if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } }) -join ' '
$OpenclawDir = Join-Path $env:USERPROFILE ".openclaw"
$EnvFile = Join-Path $OpenclawDir ".env"
$OpenclawJson = Join-Path $OpenclawDir "openclaw.json"
$ServerConfigFile = Join-Path $ServerDir "config.json"
$EnvVarsFile = Join-Path $ServerDir "env_vars"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Get-TokenUrl {
    switch ($ServerName) {
        "apify" { "https://console.apify.com/settings/integrations" }
        "github" { "https://github.com/settings/tokens" }
        "google-maps" { "https://console.cloud.google.com/apis/credentials" }
        "hetzner" { "https://console.hetzner.cloud/" }
        "hostinger" { "https://hpanel.hostinger.com/api" }
        "linear" { "https://linear.app/settings/api" }
        "miro" { "https://miro.com/app/settings/user-profile/apps" }
        "stripe" { "https://dashboard.stripe.com/apikeys" }
        "tavily" { "https://app.tavily.com/home" }
        "todoist" { "https://app.todoist.com/app/settings/integrations/developer" }
        "wise" { "https://wise.com/settings/api-tokens" }
        default { "" }
    }
}

function Check-Prerequisites {
    switch ($ServerName) {
        "github" { Require-Command docker }
        "linear" { Require-Command node; Require-Command npm }
        "wise" { Require-Command git; Require-Command node; Require-Command npm }
        "hetzner" { Require-Command git; Require-Command node; Require-Command npm }
        default { Require-Command node; Require-Command npx }
    }
}

function Install-ServerDependencies {
    switch ($ServerName) {
        "github" {
            Write-Host "Pulling GitHub MCP server Docker image..."
            docker pull ghcr.io/github/github-mcp-server | Out-Host
        }
        "linear" {
            Write-Host "Installing @anthropic-pb/linear-mcp-server globally..."
            npm install -g @anthropic-pb/linear-mcp-server | Out-Host
        }
        "wise" {
            $cloneDir = Join-Path $env:USERPROFILE ".openclaw\extensions\mcp-client\servers\wise\mcp-server"
            $parent = Split-Path $cloneDir -Parent
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
            if (Test-Path (Join-Path $cloneDir ".git")) {
                git -C $cloneDir pull --ff-only | Out-Host
            } else {
                git clone https://github.com/Szotasz/wise-mcp.git $cloneDir | Out-Host
            }
            Push-Location $cloneDir; npm install | Out-Host; npm run build | Out-Host; Pop-Location
        }
        "hetzner" {
            $cloneDir = Join-Path $env:USERPROFILE ".openclaw\extensions\mcp-client\servers\hetzner\mcp-server"
            $parent = Split-Path $cloneDir -Parent
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
            if (Test-Path (Join-Path $cloneDir ".git")) {
                git -C $cloneDir pull --ff-only | Out-Host
            } else {
                git clone https://github.com/dkruyt/mcp-hetzner.git $cloneDir | Out-Host
            }
            Push-Location $cloneDir; npm install | Out-Host; npm run build | Out-Host; Pop-Location
        }
        default { }
    }
}

function Get-PathOverride {
    switch ($ServerName) {
        "linear" {
            $npmRoot = npm root -g
            $distPath = Join-Path $npmRoot "@anthropic-pb/linear-mcp-server/dist/index.js"
            $buildPath = Join-Path $npmRoot "@anthropic-pb/linear-mcp-server/build/index.js"
            if (Test-Path $distPath) { return $distPath }
            if (Test-Path $buildPath) { return $buildPath }
            return $distPath
        }
        "wise" { return (Join-Path $env:USERPROFILE ".openclaw\extensions\mcp-client\servers\wise\mcp-server\dist\cli.js") }
        "hetzner" { return (Join-Path $env:USERPROFILE ".openclaw\extensions\mcp-client\servers\hetzner\mcp-server\dist\index.js") }
        default { return "" }
    }
}

function Ensure-Property {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)]$DefaultValue
    )
    if (-not ($Object.PSObject.Properties.Name -contains $Name)) {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $DefaultValue
    }
    return $Object.$Name
}

Write-Host "========================================"
Write-Host "Installing $ServerTitle MCP Server"
Write-Host "========================================"

if (-not (Test-Path $EnvVarsFile)) {
    throw "Missing env_vars file in $ServerDir"
}

$EnvVarName = (Get-Content $EnvVarsFile -TotalCount 1).Trim()
if ([string]::IsNullOrWhiteSpace($EnvVarName)) {
    throw "env_vars file does not contain a variable name"
}

Check-Prerequisites
Install-ServerDependencies

$tokenUrl = Get-TokenUrl
Write-Host "Get your API token here: $tokenUrl"
$Token = ""
while ([string]::IsNullOrWhiteSpace($Token)) {
    $Token = Read-Host "Enter your API token"
    if ([string]::IsNullOrWhiteSpace($Token)) { Write-Host "Token cannot be empty." }
}

New-Item -ItemType Directory -Force -Path $OpenclawDir | Out-Null
if (-not (Test-Path $EnvFile)) { New-Item -ItemType File -Force -Path $EnvFile | Out-Null }

$envExists = Select-String -Path $EnvFile -Pattern "^$([regex]::Escape($EnvVarName))=" -Quiet
if (-not $envExists) {
    Add-Content -Path $EnvFile -Value "$EnvVarName=$Token"
    Write-Host "Added $EnvVarName to $EnvFile"
} else {
    Write-Host "$EnvVarName already exists in $EnvFile; leaving existing value unchanged"
}

if (-not (Test-Path $OpenclawJson)) { Set-Content -Path $OpenclawJson -Value "{}" -Encoding UTF8 }

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$backupFile = "$OpenclawJson.bak-$timestamp"
Copy-Item -Path $OpenclawJson -Destination $backupFile -Force
Write-Host "Backup created: $backupFile"

$cfgRaw = Get-Content -Path $OpenclawJson -Raw
if ([string]::IsNullOrWhiteSpace($cfgRaw)) { $cfgRaw = "{}" }
$cfg = $cfgRaw | ConvertFrom-Json
$serverConfig = Get-Content -Path $ServerConfigFile -Raw | ConvertFrom-Json

$pathOverride = Get-PathOverride
if (-not [string]::IsNullOrWhiteSpace($pathOverride) -and $serverConfig.args -and $serverConfig.args.Count -gt 0) {
    for ($i = 0; $i -lt $serverConfig.args.Count; $i++) {
        if ($serverConfig.args[$i] -is [string] -and $serverConfig.args[$i].StartsWith("path/to/")) {
            $serverConfig.args[$i] = $pathOverride
        }
    }
}

$plugins = Ensure-Property -Object $cfg -Name "plugins" -DefaultValue ([PSCustomObject]@{})
$allow = Ensure-Property -Object $plugins -Name "allow" -DefaultValue @()
if ($allow -notcontains "mcp-client") { $plugins.allow = @($allow) + "mcp-client" }
$entries = Ensure-Property -Object $plugins -Name "entries" -DefaultValue ([PSCustomObject]@{})
if (-not ($entries.PSObject.Properties.Name -contains "mcp-client")) {
    $entries | Add-Member -NotePropertyName "mcp-client" -NotePropertyValue ([PSCustomObject]@{})
}
$mcpClient = $entries."mcp-client"
if (-not ($mcpClient.PSObject.Properties.Name -contains "enabled")) { $mcpClient | Add-Member -NotePropertyName "enabled" -NotePropertyValue $true }
$mcpConfig = Ensure-Property -Object $mcpClient -Name "config" -DefaultValue ([PSCustomObject]@{})
if (-not ($mcpConfig.PSObject.Properties.Name -contains "toolPrefix")) { $mcpConfig | Add-Member -NotePropertyName "toolPrefix" -NotePropertyValue $true }
if (-not ($mcpConfig.PSObject.Properties.Name -contains "reconnectIntervalMs")) { $mcpConfig | Add-Member -NotePropertyName "reconnectIntervalMs" -NotePropertyValue 30000 }
if (-not ($mcpConfig.PSObject.Properties.Name -contains "connectionTimeoutMs")) { $mcpConfig | Add-Member -NotePropertyName "connectionTimeoutMs" -NotePropertyValue 10000 }
if (-not ($mcpConfig.PSObject.Properties.Name -contains "requestTimeoutMs")) { $mcpConfig | Add-Member -NotePropertyName "requestTimeoutMs" -NotePropertyValue 60000 }
$servers = Ensure-Property -Object $mcpConfig -Name "servers" -DefaultValue ([PSCustomObject]@{})
if ($servers.PSObject.Properties.Name -contains $ServerName) { $servers.PSObject.Properties.Remove($ServerName) }
$servers | Add-Member -NotePropertyName $ServerName -NotePropertyValue $serverConfig

$cfg | ConvertTo-Json -Depth 30 | Set-Content -Path $OpenclawJson -Encoding UTF8
Write-Host "Updated $OpenclawJson for server $ServerName"

Write-Host "Restart your OpenClaw gateway"
