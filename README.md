# Solana Token Info Viewer

A simple web application that allows you to view information about Solana tokens by entering their addresses.

## Features

- Minimal and clean user interface
- Click the "+" button to enter a Solana token address
- Tab system to manage and switch between multiple tokens
- Displays comprehensive token information in a compact header
- Responsive design that works on desktop and mobile

## Usage

1. Open `index.html` in your web browser
2. Click the "+" button in the middle of the screen
3. Enter a valid Solana token address when prompted (e.g., `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` for Jupiter)
4. View the token's information in the header
5. To add more tokens, click the "+" button again and enter another address
6. Click on tabs to switch between different tokens
7. Click the "×" button to close the currently active tab

## Example Token Addresses

- Jupiter (JUP): `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`
- Solana (SOL): `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## Technical Details

The application uses:
- HTML5 for structure
- CSS3 for styling
- Vanilla JavaScript with JSDoc comments
- Jupiter API for token information retrieval
- Browser's localStorage to persist token data (coming soon)

No server-side components are required as this is a client-side only application.

## License

MIT 