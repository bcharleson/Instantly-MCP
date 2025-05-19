# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.13] - 2025-05-18

### Fixed
- Reverted create_campaign to use from_email and from_name instead of email_list
- Added fallback mechanism that tries simple structure first, then complex structure
- Better handling of campaign creation with two different API formats
- Changed required fields to match api-fixes.ts recommendations

### Added
- Added account_id as optional field for campaign creation

## [2.0.12] - 2025-05-18

### Added
- Enhanced debug logging for 400 Bad Request errors
- Response body is now logged for 400 errors to help diagnose issues
- Better error diagnostics for create_campaign troubleshooting

## [2.0.11] - 2025-05-18

### Added
- Added timezone parameter to create_campaign with selectable options (default: America/New_York)
- Added days parameter to customize which days to send emails (default: Monday-Friday)
- Improved user experience by allowing campaign schedule customization

### Enhanced
- create_campaign now accepts timezone and days configuration
- Better defaults for campaign scheduling

## [2.0.10] - 2025-05-18

### Fixed
- Reverted create_campaign to match Instantly v2 API documentation exactly
- Changed to use email_list array instead of individual account fields
- Fixed send_email endpoint to use `/emails/send` path
- Fixed list_lead_lists authentication issue by explicitly specifying GET method
- Added complete campaign_schedule and sequences structure as required by API

## [2.0.9] - 2025-05-18

### Fixed
- Reverted create_campaign to simpler structure that actually works with API
- Changed back from email_list to account_id, from_email, and from_name
- Added debug logging for request bodies to help troubleshoot API issues
- Simplified campaign data structure based on api-fixes.ts findings

## [2.0.8] - 2025-05-18

### Fixed
- Complete rewrite of create_campaign to match Instantly v2 API requirements
- Added all required fields including campaign_schedule, sequences, and email settings
- Changed required fields from account_id to email_list
- Added proper default values for all campaign settings

## [2.0.7] - 2025-05-18

### Fixed
- Fixed create_account to use explicit field structure and proper defaults
- Fixed verify_email endpoint to use `/verify-email` path
- Added missing fields for create_account (warmup_enabled, provider)

## [2.0.6] - 2025-05-18

### Fixed
- Fixed list_leads endpoint to use `/lead/list` with POST method
- Fixed send_email endpoint to use `/mail/send`
- Updated create_lead schema to match actual API field names (firstName, lastName, companyName)
- Enhanced create_account with better default values and numeric conversion
- Fixed list_accounts to return raw results without pagination parsing

## [2.0.5] - 2024-01-XX

### Fixed
- Fixed send_email endpoint path to `/emails/send`
- Fixed verify_email endpoint path to `/verify-email`
- Fixed list_leads to use GET method
- Added default settings for create_campaign
- Added proper data structure handling for complex endpoints

### Added
- New `get_email` endpoint to fetch specific email by ID
- New `reply_to_email` endpoint for email replies
- Better error handling and response formatting

## [2.0.4] - 2024-01-XX

### Fixed
- Fixed 404 errors: Corrected API endpoint paths
  - `/lead_lists` → `/lists`
  - `/api_keys` → `/api-keys`
  - `/email_verification` → `/verify`
- Fixed 400 errors: Added required fields
  - `create_campaign` now requires `account_id`
  - `create_account` now requires `smtp_host` and `smtp_port`

## [2.0.3] - 2024-01-XX

### Fixed
- Critical bug: Actually pass authentication headers to fetch request
- This fixes the 401 Unauthorized error

## [2.0.2] - 2024-01-XX

### Added
- Debug logging for authentication troubleshooting
- Console output shows requests and responses for debugging

## [2.0.1] - 2024-01-XX

### Fixed
- Fixed API endpoint URLs to use underscores instead of hyphens (api_keys, lead_lists, etc.)
- Fixed warmup analytics endpoint URL

## [2.0.0] - 2024-01-XX

### Added (Complete Rewrite)
- Initial release of Instantly MCP server
- Support for all major Instantly v2 API endpoints
- Campaign management tools (list, create, update, activate)
- Analytics endpoints for campaigns and accounts
- Lead management (create, list, update, move)
- Email operations (send, list)
- Email verification
- Account management
- API key management
- Rate limiting support with informative messages
- Pagination support for all list endpoints
- Comprehensive error handling
- Example scripts for common use cases
- TypeScript support
- MCP SDK integration

### Security
- API key passed via command line arguments, not stored in code
- Secure Bearer token authentication

### Documentation
- Complete README with usage instructions
- Example MCP configuration
- API documentation references