# Shippi SmartTicket Assistant

A Chrome extension that enhances the Jira ticket creation experience by providing smart suggestions and automation features.

## Features
- Automated ticket creation from Slack messages
- Smart field suggestions
- Seamless integration with Jira

## Installation
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this directory

## Development
To modify or enhance the extension:
1. Make your changes to the source files
2. Reload the extension in Chrome

## Security
### API Keys and Authentication
- This extension requires an OpenAI API key to function
- API keys are stored securely in Chrome's built-in storage system
- Never share your API keys or commit them to version control

### Permissions
The extension requires the following permissions:
- `storage`: For storing user preferences and API keys
- `activeTab`: For interacting with the current Jira ticket
- Access to Atlassian and OpenAI APIs for core functionality

### Data Handling
- All data processing happens locally in your browser
- The extension only sends ticket content to OpenAI for enhancement
- Input is sanitized before processing
- Rate limiting is implemented to prevent API abuse
- Local storage is automatically cleaned every 24 hours

### Best Practices
1. Always review enhanced ticket content before saving
2. Keep your API keys private and secure
3. Regularly update the extension to get the latest security improvements

## License
See the [LICENSE](LICENSE) file for details.
