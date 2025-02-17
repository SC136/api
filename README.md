# WhatsApp API Integration

This Node.js application creates an API endpoint that sends messages to a WhatsApp group using whatsapp-web.js.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the application:
   ```
   node app.js
   ```

3. When you first run the application, it will display a QR code in the terminal. Scan this QR code with WhatsApp on your phone to authenticate:
   - Open WhatsApp on your phone
   - Go to Settings > WhatsApp Web/Desktop
   - Scan the QR code displayed in your terminal

4. Make sure you have a WhatsApp group named "family" where you want to send messages.

5. To trigger the message, visit:
   ```
   http://localhost:3000/hello
   ```

## Requirements

- Node.js
- A WhatsApp account
- Membership in a WhatsApp group named "family"

## Note

The WhatsApp session will need to be re-authenticated if you restart the application or if the session expires.
