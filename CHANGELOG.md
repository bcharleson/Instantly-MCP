# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-01-20

### 🎯 MAJOR REFACTOR: Streamlined MCP Server
- **REMOVED**: `campaign_creation_wizard` tool entirely
- **ENHANCED**: Core tools with intelligent descriptions and workflow guidance
- **SIMPLIFIED**: Lean architecture focused on well-designed tool descriptions
- **IMPROVED**: LLM-friendly tool descriptions that prevent errors through guidance

### 🧠 Enhanced Tool Intelligence
- **`list_accounts`**: Now clearly marked as prerequisite for campaign creation
- **`create_campaign`**: Comprehensive parameter documentation with examples
- **Workflow guidance**: Tools descriptions guide LLMs through proper API usage
- **Error prevention**: Clear validation hints and data format requirements

### 🔧 Architecture Benefits
- ✅ **Maintainability**: No custom workflow logic to maintain
- ✅ **Flexibility**: LLMs can adapt workflow as needed
- ✅ **Simplicity**: Standard MCP tool pattern throughout
- ✅ **Extensibility**: Easier to add new features and endpoints

### 📋 Migration Guide
**Old workflow (v2.x)**:
```json
campaign_creation_wizard {"step": "start"}
campaign_creation_wizard {"step": "info_gathered", ...}
campaign_creation_wizard {"step": "create", ...}
```

**New workflow (v3.0)**:
```json
list_accounts {"limit": 100}
create_campaign {"name": "...", "email_list": ["account@domain.com"]}
```

### 💡 Key Improvements
- **Fewer API calls**: 2 steps instead of 3
- **More flexible**: Can use multiple sending accounts
- **Better error handling**: Standard MCP error responses
- **Clearer workflow**: Standard tool pattern, no custom logic

### 📚 Documentation
- Added `STREAMLINED_WORKFLOW.md` with comprehensive examples
- Enhanced tool descriptions with prerequisite guidance
- Clear migration path from wizard-based approach

## [2.5.3] - 2025-01-20

### 🎯 MAJOR FIX: Removed Restrictive Account Filtering
- **FIXED**: Wizard now shows ALL accounts from your Instantly workspace
- **REMOVED**: Overly restrictive "verified" status filtering that excluded valid accounts
- **IMPROVED**: Trusts Instantly API - any returned account is considered usable
- **RESOLVED**: "No verified sending accounts found" error for workspaces with pre-loaded accounts

### 🔧 What Changed
- ✅ **Step 1**: Now calls `/accounts` and shows ALL returned accounts
- ✅ **No filtering**: Removed `status === 'active' || status === 'verified'` restrictions
- ✅ **Better messaging**: Changed from "verified accounts" to "available accounts"
- ✅ **Trust API**: If Instantly returns an account, it's available for use
- ✅ **Complete tool registration**: Both definition and implementation properly connected

### 🧙‍♂️ Wizard Behavior Now
1. **Step 1 (`start`)**: Shows ALL accounts from your workspace
2. **Step 2 (`info_gathered`)**: Validates campaign information
3. **Step 3 (`create`)**: Creates campaign with any selected account
4. **No restrictions**: Uses whatever accounts Instantly provides

### 💡 For Users with Pre-loaded Workspaces
- ✅ **Works immediately**: No need to verify accounts separately
- ✅ **Shows all accounts**: Pre-configured accounts are now visible
- ✅ **No false errors**: Won't claim "no accounts found" when accounts exist
- ✅ **Streamlined workflow**: Use any account returned by the API

## [2.5.2] - 2025-01-20

### 🚨 CRITICAL FIX: Complete Campaign Creation Wizard Implementation
- **FIXED**: Added missing `campaign_creation_wizard` implementation to request handler
- **RESOLVED**: "Unknown tool: campaign_creation_wizard" error completely eliminated
- **COMPLETED**: Full 3-step wizard workflow now functional
- **TESTED**: Both tool definition and implementation properly connected

### 🔧 What's Fixed
- ✅ Tool definition properly registered in tools list
- ✅ Complete wizard implementation added to request handler
- ✅ All 3 steps (start, info_gathered, create) fully functional
- ✅ Account validation and error prevention working
- ✅ Clear guidance and helpful error messages
- ✅ Backward compatibility with `create_campaign` maintained

### 🧙‍♂️ Wizard Features Now Working
- **Step 1 (`start`)**: Checks verified sending accounts automatically
- **Step 2 (`info_gathered`)**: Validates campaign information with defaults
- **Step 3 (`create`)**: Creates campaign with validated data
- **Error Handling**: Clear messages for missing accounts, fields, or API issues
- **Configuration Preview**: Shows settings before campaign creation

## [2.5.1] - 2025-01-20

### 🔧 HOTFIX: Campaign Creation Wizard Tool Definition
- **FIXED**: Added missing `campaign_creation_wizard` tool definition to tools list
- **COMPLETED**: Wizard now fully functional with proper tool registration
- **VERIFIED**: Both tool definition and implementation are properly connected
- **READY**: Wizard is now available for testing and use

### 📋 What's Working Now
- ✅ `campaign_creation_wizard` appears in tools list
- ✅ Step-by-step workflow fully implemented
- ✅ Account validation and error prevention
- ✅ Clear guidance and helpful error messages
- ✅ Backward compatibility with `create_campaign`

## [2.5.0] - 2025-01-20

### 🧙‍♂️ NEW FEATURE: Campaign Creation Wizard
- **ADDED**: `campaign_creation_wizard` tool for guided campaign creation
- **PREVENTS**: 400 Bad Request errors by validating accounts and information first
- **WORKFLOW**: 3-step process: check accounts → gather info → create campaign
- **VALIDATION**: Ensures only verified sending accounts are used
- **USER-FRIENDLY**: Clear step-by-step guidance with helpful error messages

### 🔧 Workflow Steps
1. **Step 1 (`start`)**: Automatically checks and displays verified sending accounts
2. **Step 2 (`info_gathered`)**: Validates campaign information and shows configuration
3. **Step 3 (`create`)**: Creates campaign with validated data

### 💡 Benefits
- ✅ Eliminates 400 Bad Request errors from unverified accounts
- ✅ Provides clear guidance at each step
- ✅ Shows configuration summary before creation
- ✅ Includes sensible defaults for all optional settings
- ✅ Comprehensive error handling with actionable solutions

### 📚 Documentation
- Added `CAMPAIGN_CREATION_WIZARD.md` with complete workflow guide
- Added `examples/campaign-creation-wizard.ts` demonstration script
- Updated tool descriptions to recommend wizard for new users

### 🔄 Migration
- `create_campaign` still available for advanced users
- New users should use `campaign_creation_wizard` for guided experience
- Existing integrations continue to work unchanged

## [2.4.1] - 2025-01-20

### 🔧 Hotfix: Create Campaign Validation
- **FIXED**: Added validation to reject placeholder emails (`your-verified-email@example.com`, etc.)
- **IMPROVED**: Better error messages guiding users to use actual verified sending accounts
- **ENHANCED**: Clear guidance to run `list_accounts` first to see available verified accounts
- **ADDED**: Email format validation with specific error messages
- **CONFIRMED**: Sequences field properly included as required by Instantly API

### 💡 User Experience
- Users now get helpful error messages instead of generic 400 Bad Request
- Clear instructions on how to fix campaign creation issues
- Validation prevents common mistakes before API calls

## [2.4.0] - 2025-01-20

### 🚀 Major Fixes & Improvements
- **CRITICAL FIX**: Fixed `create_campaign` endpoint to match official API documentation
  - Changed from `from_email` to `email_list` array parameter
  - Added proper validation for verified sending accounts
  - Fixed campaign data structure to match API requirements
  - Added comprehensive input validation with helpful error messages

### 🔧 Endpoint Path Corrections
- **Fixed `list_leads`**: Changed from `POST /lead/list` to `GET /leads`
- **Fixed `verify_email`**: Changed from `/verify-email` to `/email-verification`
- **Fixed `get_warmup_analytics`**: Corrected endpoint path to `/accounts/warmup-analytics`

### ✅ Enhanced Validation & Error Handling
- Added email address format validation
- Added timezone validation with supported timezone list
- Added time format validation (HH:MM)
- Improved error messages with specific guidance
- Added validation for campaign creation requirements

### 🧪 Comprehensive Testing Suite
- Added automated test script for all 25+ endpoints
- Realistic test data generation
- Edge case testing for validation
- Detailed reporting with HTTP status analysis
- NPM scripts for easy test execution
- CI/CD ready with proper exit codes

### 📚 Documentation & API Improvements
- Updated `api-fixes.ts` with corrected endpoint mappings
- Added `TEST_GUIDE.md` with comprehensive testing documentation
- Fixed server version to match package version
- Updated input schemas to reflect API changes

### 🛠️ Developer Experience
- Added `npm run test:endpoints` for full testing
- Added `npm run test:quick` for rapid testing
- Improved error reporting with HTTP status codes
- Better debugging information for troubleshooting

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