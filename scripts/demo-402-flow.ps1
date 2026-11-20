# 60-Second Live Terminal Demo: 402-in-a-Box Metering & Idempotency
# PowerShell 5.1+ compatible. Never embeds or prints API keys.
param(
  [string]$Endpoint = "https://mcp.vashishta.srigenmedia.com/mcp",
  [string]$ApiKey = $env:MCP_402_API_KEY
)

$ErrorActionPreference = "Stop"
$payload = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ephemeris.compute_varga","arguments":{"year":1981,"month":9,"day":9,"hour":5,"minute":10,"lat":20.2961,"lon":85.8245}}}'

Write-Host "`n[1/3] Unauthenticated POST $Endpoint -> Expect HTTP 402 + PAYMENT-REQUIRED" -ForegroundColor Cyan
try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Endpoint -ContentType "application/json" -Body $payload | Out-Null
} catch {
  $resp = $_.Exception.Response
  if ($null -eq $resp) { throw }
  $code = [int]$resp.StatusCode
  $hdr = $resp.Headers["PAYMENT-REQUIRED"]
  Write-Host ("HTTP {0} | PAYMENT-REQUIRED present: {1}" -f $code, (-not [string]::IsNullOrWhiteSpace($hdr))) -ForegroundColor Yellow
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Host "`n[2/3] Set `$env:MCP_402_API_KEY (from https://vashishta.srigenmedia.com/developers/402) to run steps 2 & 3." -ForegroundColor Gray
  exit 0
}

$idemKey = [guid]::NewGuid().ToString()
$headers = @{
  "Authorization"   = "Bearer $ApiKey"
  "Idempotency-Key" = $idemKey
}

Write-Host "`n[2/3] Authenticated Metered Call (Idempotency-Key: $idemKey) -> Expect HTTP 200 + PAYMENT-RESPONSE" -ForegroundColor Cyan
$r1 = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Endpoint -ContentType "application/json" -Headers $headers -Body $payload
Write-Host ("HTTP {0} | PAYMENT-RESPONSE: {1}" -f $r1.StatusCode, $r1.Headers["PAYMENT-RESPONSE"]) -ForegroundColor Green

Write-Host "`n[3/3] Identical Replay with same Idempotency-Key -> Expect HTTP 200 with 0 extra debit" -ForegroundColor Cyan
$r2 = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Endpoint -ContentType "application/json" -Headers $headers -Body $payload
Write-Host ("HTTP {0} | PAYMENT-RESPONSE: {1}" -f $r2.StatusCode, $r2.Headers["PAYMENT-RESPONSE"]) -ForegroundColor Green
