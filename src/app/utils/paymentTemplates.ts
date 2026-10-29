export const getPaymentSuccessHtml = (sessionId?: string) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - Sami & Nawari</title>
        <link rel="icon" type="image/png" href="/favicon.png">
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            body {
                background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
                color: #c9d1d9;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
            }
            .card {
                background: #1c2128;
                border: 1px solid #30363d;
                border-radius: 16px;
                padding: 40px 32px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                animation: fadeIn 0.5s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-wrapper {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(46, 160, 67, 0.15);
                border: 2px solid #2ea043;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
            }
            .icon-wrapper svg {
                width: 40px;
                height: 40px;
                color: #3fb950;
            }
            h1 {
                font-size: 24px;
                color: #f0f6fc;
                margin-bottom: 12px;
                font-weight: 600;
            }
            p {
                font-size: 15px;
                color: #8b949e;
                line-height: 1.6;
                margin-bottom: 24px;
            }
            .session-box {
                background: #0d1117;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 28px;
                text-align: left;
            }
            .session-label {
                font-size: 11px;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .session-id {
                font-family: monospace;
                font-size: 13px;
                color: #58a6ff;
                word-break: break-all;
            }
            .badge {
                display: inline-block;
                padding: 6px 14px;
                background: rgba(56, 139, 253, 0.15);
                color: #58a6ff;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-wrapper">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h1>Payment Successful!</h1>
            <p>Thank you! Your payment has been processed successfully. Your order is now confirmed and being prepared.</p>
            ${
                sessionId
                    ? `<div class="session-box">
                    <div class="session-label">Stripe Session ID</div>
                    <div class="session-id">${sessionId}</div>
                </div>`
                    : ""
            }
            <div class="badge">You can close this tab now</div>
        </div>
    </body>
    </html>
    `;
};

export const getPaymentCancelHtml = () => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled - Sami & Nawari</title>
        <link rel="icon" type="image/png" href="/favicon.png">
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            body {
                background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
                color: #c9d1d9;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
            }
            .card {
                background: #1c2128;
                border: 1px solid #30363d;
                border-radius: 16px;
                padding: 40px 32px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                animation: fadeIn 0.5s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-wrapper {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(248, 81, 73, 0.15);
                border: 2px solid #f85149;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
            }
            .icon-wrapper svg {
                width: 40px;
                height: 40px;
                color: #f85149;
            }
            h1 {
                font-size: 24px;
                color: #f0f6fc;
                margin-bottom: 12px;
                font-weight: 600;
            }
            p {
                font-size: 15px;
                color: #8b949e;
                line-height: 1.6;
                margin-bottom: 28px;
            }
            .badge {
                display: inline-block;
                padding: 6px 14px;
                background: rgba(248, 81, 73, 0.15);
                color: #ff7b72;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-wrapper">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </div>
            <h1>Payment Cancelled</h1>
            <p>Your payment session was cancelled or could not be completed. No money was charged from your account.</p>
            <div class="badge">You can close this tab and try again</div>
        </div>
    </body>
    </html>
    `;
};

