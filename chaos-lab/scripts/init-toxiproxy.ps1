# ==============================================================================
# Toxiproxy Initialization Script
# Registers proxies for Redis (26379 -> redis:6379) and Postgres (25432 -> postgres:5432)
# ==============================================================================

$toxiproxyUrl = "http://localhost:8474"

Write-Host "Waiting for Toxiproxy at $toxiproxyUrl..." -ForegroundColor Cyan

$retries = 10
while ($retries -gt 0) {
    try {
        $res = Invoke-RestMethod -Uri "$toxiproxyUrl/version" -Method Get -UserAgent "toxiproxy-cli" -ErrorAction Stop
        Write-Host "Toxiproxy is ready (Version: $($res.version))" -ForegroundColor Green
        break
    } catch {
        Start-Sleep -Seconds 1
        $retries--
    }
}

if ($retries -eq 0) {
    Write-Host "ERROR: Toxiproxy is not responding. Ensure 'docker compose up -d' is running." -ForegroundColor Red
    exit 1
}

# 1. Register Redis Toxic Proxy
$redisProxy = @{
    name = "orders-redis"
    listen = "0.0.0.0:26379"
    upstream = "host.docker.internal:6379"
    enabled = $true
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$toxiproxyUrl/proxies" -Method Post -Body $redisProxy -ContentType "application/json" -UserAgent "toxiproxy-cli" | Out-Null
    Write-Host "  [OK] Registered Redis Proxy: localhost:26379 -> host.docker.internal:6379" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Redis proxy already registered." -ForegroundColor Yellow
}

# 2. Register Postgres Toxic Proxy
$pgProxy = @{
    name = "orders-postgres"
    listen = "0.0.0.0:25432"
    upstream = "postgres:5432"
    enabled = $true
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$toxiproxyUrl/proxies" -Method Post -Body $pgProxy -ContentType "application/json" -UserAgent "toxiproxy-cli" | Out-Null
    Write-Host "  [OK] Registered Postgres Proxy: localhost:25432 -> postgres:5432" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Postgres proxy already registered." -ForegroundColor Yellow
}

Write-Host "`nToxiproxy initialization complete. Ready for chaos injection!" -ForegroundColor Cyan

