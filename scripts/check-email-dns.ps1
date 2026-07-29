# check-email-dns.ps1 -- read-only audit of a domain's email authentication.
#
# Run it before and after each DNS change while getting radlab.zone ready to
# send (Google Workspace for personal mail, Resend for platform + course mail):
#
#     powershell -File scripts/check-email-dns.ps1
#     powershell -File scripts/check-email-dns.ps1 -Domain course.radlab.zone
#
# Queries two public resolvers rather than the local one, so it reports what
# the world sees and not a stale cache. When the two disagree the record is
# still propagating -- that is normal for the first hour, not an error.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI, so a
# non-ASCII character here would come back mangled.

param(
  [string]$Domain = 'radlab.zone',
  # Resend's bounce host is region-specific and the region is fixed when the
  # domain is added in Resend. Change this if the domain was added elsewhere.
  [string]$ResendRegion = 'us-east-1'
)

$resolvers = @('8.8.8.8', '1.1.1.1')

# PowerShell unrolls a one-element array on return, so these hand back a bare
# string for a single record and nothing at all for none. **Every caller must
# wrap the result in @()** -- otherwise $result[0] on a single record silently
# yields its first CHARACTER, which reads as a real answer and isn't.
# (Returning ,@(...) to force the array does not fix it: for the empty case
# the comma produces a one-element array holding an empty array, which then
# counts as "found".)
function Get-Txt($name, $server) {
  try {
    $r = Resolve-DnsName -Name $name -Type TXT -Server $server -ErrorAction Stop
    return @($r | Where-Object { $_.Strings } | ForEach-Object { $_.Strings -join '' })
  } catch { return @() }
}

function Get-Mx($name, $server) {
  try {
    $r = Resolve-DnsName -Name $name -Type MX -Server $server -ErrorAction Stop
    return @($r | Where-Object { $_.NameExchange } | ForEach-Object { $_.NameExchange })
  } catch { return @() }
}

$results = @()

function Report($label, $host_, $found, $ok, $detail) {
  $script:results += [pscustomobject]@{
    Check = $label; Host = $host_; Status = $(if ($ok) { 'OK' } elseif ($found) { 'CHECK' } else { 'MISSING' }); Detail = $detail
  }
}

Write-Output ""
Write-Output "Email DNS for $Domain (resolvers: $($resolvers -join ', '))"
Write-Output ("=" * 72)

# --- 1. SPF at the apex -------------------------------------------------
# Exactly one SPF record is allowed per name. Two is not "extra safe", it is
# a permerror, and receivers treat the whole check as broken.
$spf = @((Get-Txt $Domain $resolvers[0]) | Where-Object { $_ -like 'v=spf1*' })
if ($spf.Count -gt 1) {
  Report 'SPF (apex)' $Domain $true $false "MULTIPLE SPF RECORDS -- this is a permerror, merge them into one"
} elseif ($spf.Count -eq 1) {
  # One record is the pass condition. Whether it authorises Google Workspace
  # is reported but not required -- the domain may legitimately send elsewhere.
  $note = if ($spf[0] -like '*_spf.google.com*') { '' } else { '  [no _spf.google.com -- Workspace mail not authorised]' }
  Report 'SPF (apex)' $Domain $true $true ($spf[0] + $note)
} else {
  Report 'SPF (apex)' $Domain $false $false 'no v=spf1 record -- mail you send is not SPF-authorised'
}

# --- 2. Google Workspace DKIM ------------------------------------------
# 'google' is the default selector; a custom one set in the admin console
# would live at <selector>._domainkey and show as MISSING here.
$gdkim = @(Get-Txt "google._domainkey.$Domain" $resolvers[0])
Report 'DKIM (Google Workspace)' "google._domainkey.$Domain" ($gdkim.Count -gt 0) ($gdkim.Count -gt 0) `
  $(if ($gdkim.Count) { $gdkim[0].Substring(0, [Math]::Min(50, $gdkim[0].Length)) + '...' } else { 'not published -- enable in Admin console > Apps > Gmail > Authenticate email' })

# --- 3. DMARC -----------------------------------------------------------
$dmarc = @(Get-Txt "_dmarc.$Domain" $resolvers[0]) | Where-Object { $_ -like 'v=DMARC1*' }
$dmarc = @($dmarc)
if ($dmarc.Count) {
  $policy = if ($dmarc[0] -match 'p=([a-z]+)') { $matches[1] } else { '?' }
  $sub = if ($dmarc[0] -match 'sp=([a-z]+)') { $matches[1] } else { "inherits ($policy)" }
  Report 'DMARC' "_dmarc.$Domain" $true $true "policy=$policy subdomains=$sub | $($dmarc[0])"
} else {
  Report 'DMARC' "_dmarc.$Domain" $false $false 'no DMARC record'
}

# --- 4-6. Resend ---------------------------------------------------------
# Resend signs with the 'resend' selector and uses a send.<domain> subdomain
# for the Return-Path, which is why its SPF and MX go there and not on the
# apex -- so they never collide with the Google SPF record above.
$rdkim = @(Get-Txt "resend._domainkey.$Domain" $resolvers[0])
Report 'DKIM (Resend)' "resend._domainkey.$Domain" ($rdkim.Count -gt 0) ($rdkim.Count -gt 0) `
  $(if ($rdkim.Count) { 'published' } else { 'not published -- domain is not verified in Resend' })

$rspf = @(@(Get-Txt "send.$Domain" $resolvers[0]) | Where-Object { $_ -like 'v=spf1*' })
$rspfOk = ($rspf.Count -eq 1) -and ($rspf[0] -like '*amazonses.com*')
Report 'SPF (Resend bounce host)' "send.$Domain" ($rspf.Count -gt 0) $rspfOk `
  $(if ($rspf.Count) { $rspf[0] } else { 'not published' })

$expectedMx = "feedback-smtp.$ResendRegion.amazonses.com"
$rmx = @(Get-Mx "send.$Domain" $resolvers[0])
$rmxOk = ($rmx | Where-Object { $_ -like "feedback-smtp.*" }).Count -gt 0
Report 'MX (Resend bounce host)' "send.$Domain" ($rmx.Count -gt 0) $rmxOk `
  $(if ($rmx.Count) { $rmx -join ', ' } else { "not published -- expected $expectedMx" })

$results | Format-Table -AutoSize -Wrap

# --- propagation ---------------------------------------------------------
# Disagreement between resolvers means a change is still spreading. Only
# meaningful right after an edit; a persistent split points at a typo in one
# record rather than at propagation.
$a = (Get-Txt $Domain $resolvers[0]) -join '|'
$b = (Get-Txt $Domain $resolvers[1]) -join '|'
if ($a -ne $b) {
  Write-Output "NOTE: $($resolvers[0]) and $($resolvers[1]) disagree on the apex TXT set -- still propagating."
}

$missing = ($results | Where-Object { $_.Status -ne 'OK' }).Count
Write-Output ""
Write-Output $(if ($missing -eq 0) { "All checks OK." } else { "$missing check(s) not yet OK." })
Write-Output ""
