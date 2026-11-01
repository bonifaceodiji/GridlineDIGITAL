# Gridline Digital: Security Review and Hardening Report

## Result of the backdoor hunt
All four uploaded files were scanned for hidden code. None found: no obfuscated or encoded code, no eval, no hidden frames, no cookie or clipboard access, no tracking beacons, no hidden instructions aimed at AI tools, and no unexpected hosts. The only outside addresses are your Supabase project, Google Fonts, wa.me and (admin only) the jsDelivr CDN, which is now removed.

## Findings and fixes
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | Admin pages loaded Supabase from a public CDN with no version pin or integrity check. If that CDN or package were ever compromised, the attacker's code would run on your login page and steal passwords. | Library copied into `admin/vendor/` (pinned 2.45.4, unmodified). No third-party scripts remain in `/admin`. |
| 2 | High | No Content-Security-Policy. Any injected script could read the login session stored in the browser. | Strict CSP on all pages (meta tag and `_headers`). Admin: scripts and styles only from your own files, connections only to your Supabase. All inline code moved to separate files so no inline script is ever allowed. |
| 3 | High | The form posted to a `leads` table that did not exist in the setup, so enquiries were silently lost. The first person to create it quickly could also have made it readable by the public. | Hardened `leads` table: public may only insert 5 named columns; cannot read, edit or delete; values validated at database level; flood brake of 20 per minute. |
| 4 | High | Admin identity was matched by email address. Email can be re-registered or changed, so an attacker who registered the owner's email first could claim admin. | Admin is bound to the immutable account ID (`admin_users`). Every protected function also demands the 6-digit code (AAL2). |
| 5 | Medium | Function permissions: `revoke from public` does not remove the explicit grants Supabase gives the anonymous role, so anonymous visitors could call admin functions (they were refused, but should never reach them). | Explicit `revoke ... from anon` on every function; execute granted only to signed-in accounts. |
| 6 | Medium | A half-finished authenticator setup showed a blank QR code and left the account stuck. | Stale unverified factors are removed and a fresh QR code is issued. QR image checked to be a safe image type. |
| 7 | Medium | Login errors said whether an email existed or was approved (account enumeration). No back-off on repeated attempts. | One generic message for every failure. Escalating wait after failed attempts (1s doubling to 60s). |
| 8 | Medium | The public form had no spam or bot protection. | Hidden honeypot field, 30 second cooldown, length limits in the form and database, 8 second timeout. Add CAPTCHA (see checklist). |
| 9 | Medium | Dashboard session never expired when left open, and sessions could be injected through the page address. | Automatic sign-out after 15 minutes idle. Session-from-URL turned off. Server errors no longer shown to the screen. |
| 10 | Low | `innerHTML` used for the offer box. Content was constant, but it is a risky habit. | Replaced with safe DOM building. No `innerHTML` remains in login or site code. |
| 11 | Low | Publishable key was also sent as a bearer token. | Only the `apikey` header is sent. |
| 12 | Low | Missing headers: clickjacking, MIME sniffing, referrer leaks, caching of admin pages. | `_headers` file: frame blocking, nosniff, strict referrer, HSTS, no-store for `/admin/*`. |
| 13 | Low | Display name from sign-up was unlimited and attacker-controlled. | Limited to 80 characters at database level (already HTML-escaped when shown). |

## Risks only YOU can close (cannot be fixed in code)
1. **Disable public sign-ups** in Supabase (Authentication, Sign In / Providers). This is the most important setting.
2. **Enrol your authenticator app the moment you create the admin account.** Until the first code is set up, anyone who knows the password could add their own phone as the second factor.
3. Turn on **Confirm email**, **TOTP MFA**, and a **CAPTCHA** (Cloudflare Turnstile or hCaptcha) under Authentication settings. Set a minimum password length of 12 or more, and leaked-password protection if your plan offers it.
4. Put **Cloudflare Access** (free) in front of `/admin/*` so only your email can even load the login page.
5. Never put the `service_role` or secret key in any browser file. The `sb_publishable_` key is designed to be public, as long as the SQL in this package is applied.
6. Run `supabase/setup.sql`, then check the final line returns exactly your email.
7. Use a unique password in a password manager, and save your authenticator backup or recovery method.
8. Store future WhatsApp tokens only in server-side secrets, never in the browser or database tables that the browser can touch.
9. If you enable ad pixels, they add third-party scripts to the public site (allowed in the CSP). Never add them to `/admin`.
10. Add a privacy notice and cookie consent for visitors, since enquiries store names and emails.

## Test after deploying
- Open `/admin/dashboard.html` signed out: it must bounce to login.
- Sign in with a non-admin account: must be denied.
- Sign in with the password only, skipping the code: dashboard must stay blocked.
- In the browser console on the public site run a request for `/rest/v1/leads?select=*`: it must be refused.
