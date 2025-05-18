# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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