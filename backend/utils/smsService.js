/**
 * LaundriGo SMS Notification Service
 * Supports:
 * 1. Semaphore (https://semaphore.co) - Standard Philippine SMS Gateway
 * 2. Twilio (https://www.twilio.com) - Global SMS Gateway
 * 
 * Complies with Philippine mobile number standards (Poblacion, Lagonglong, Misamis Oriental)
 */

/**
 * Normalizes and validates a Philippine mobile number
 * Supported formats: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX, 9XXXXXXXXX
 * Returns { valid: boolean, local: string (09...), international: string (+639...), error?: string }
 */
function normalizePhilippineMobile(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return { valid: false, error: 'Phone number is required.' };
    }

    // Strip all non-digit characters except leading '+'
    let cleaned = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');

    // Check if starts with +63
    if (cleaned.startsWith('+63')) {
        cleaned = cleaned.substring(1); // remove + -> 639XXXXXXXXX
    }

    // Now cleaned could be:
    // 639XXXXXXXXX (12 digits)
    // 09XXXXXXXXX (11 digits)
    // 9XXXXXXXXX (10 digits)
    let localFormat = '';
    let internationalFormat = '';

    if (/^639\d{9}$/.test(cleaned)) {
        localFormat = '0' + cleaned.substring(2);
        internationalFormat = '+' + cleaned;
    } else if (/^09\d{9}$/.test(cleaned)) {
        localFormat = cleaned;
        internationalFormat = '+63' + cleaned.substring(1);
    } else if (/^9\d{9}$/.test(cleaned)) {
        localFormat = '0' + cleaned;
        internationalFormat = '+63' + cleaned;
    } else {
        return { 
            valid: false, 
            error: `Invalid Philippine mobile number format "${phoneNumber}". Must be an 11-digit mobile number starting with 09 (e.g., 09123456789).` 
        };
    }

    return {
        valid: true,
        local: localFormat,           // e.g. 09123456789 (Semaphore format)
        international: internationalFormat // e.g. +639123456789 (Twilio format)
    };
}

/**
 * Check which SMS provider (if any) is configured in environment variables
 */
function getSmsProviderConfig() {
    const semaphoreKey = process.env.SEMAPHORE_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (semaphoreKey && semaphoreKey.trim() !== '' && !semaphoreKey.includes('your_semaphore')) {
        return {
            configured: true,
            provider: 'semaphore',
            apiKey: semaphoreKey.trim(),
            senderName: process.env.SEMAPHORE_SENDER_NAME || 'SEMAPHORE'
        };
    }

    if (
        twilioSid && twilioSid.trim() !== '' && !twilioSid.includes('your_twilio') &&
        twilioToken && twilioToken.trim() !== '' &&
        twilioPhone && twilioPhone.trim() !== ''
    ) {
        return {
            configured: true,
            provider: 'twilio',
            accountSid: twilioSid.trim(),
            authToken: twilioToken.trim(),
            fromNumber: twilioPhone.trim()
        };
    }

    return {
        configured: false,
        reason: 'No SMS provider configured. Set SEMAPHORE_API_KEY (Semaphore) or TWILIO credentials in backend/.env.'
    };
}

/**
 * Send an SMS message using the configured provider
 * Returns:
 *   { success: true, status: 'sent', provider: 'semaphore'|'twilio', reference: string, recipient: string }
 *   OR
 *   { success: false, status: 'not_configured'|'failed', error: string, recipient?: string }
 */
async function sendSms(phoneNumber, message) {
    const validation = normalizePhilippineMobile(phoneNumber);
    if (!validation.valid) {
        return {
            success: false,
            status: 'failed',
            error: validation.error
        };
    }

    const config = getSmsProviderConfig();
    if (!config.configured) {
        console.warn(`[SMS Service] Warning: SMS delivery skipped because ${config.reason}`);
        return {
            success: false,
            status: 'not_configured',
            error: config.reason,
            recipient: validation.local
        };
    }

    try {
        if (config.provider === 'semaphore') {
            console.log(`[SMS Service] Dispatching SMS via Semaphore to ${validation.local}...`);
            const response = await fetch('https://api.semaphore.co/api/v4/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apikey: config.apiKey,
                    number: validation.local,
                    message: message,
                    sendername: config.senderName
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = Array.isArray(data) ? JSON.stringify(data) : (data.message || response.statusText);
                throw new Error(`Semaphore API returned error (${response.status}): ${errMsg}`);
            }

            // Semaphore returns array of message details
            const ref = Array.isArray(data) && data[0] && data[0].message_id 
                ? String(data[0].message_id) 
                : 'SEMAPHORE_' + Date.now();

            console.log(`[SMS Service] ✓ SMS successfully accepted by Semaphore. Reference: ${ref}`);
            return {
                success: true,
                status: 'sent',
                provider: 'semaphore',
                reference: ref,
                recipient: validation.local
            };
        } else if (config.provider === 'twilio') {
            console.log(`[SMS Service] Dispatching SMS via Twilio to ${validation.international}...`);
            const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
            const params = new URLSearchParams();
            params.append('To', validation.international);
            params.append('From', config.fromNumber);
            params.append('Body', message);

            const basicAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(`Twilio API returned error (${response.status}): ${data.message || response.statusText}`);
            }

            console.log(`[SMS Service] ✓ SMS successfully accepted by Twilio. SID: ${data.sid}`);
            return {
                success: true,
                status: 'sent',
                provider: 'twilio',
                reference: data.sid,
                recipient: validation.international
            };
        }
    } catch (err) {
        console.error('[SMS Service] ❌ Failed to dispatch SMS:', err.message);
        return {
            success: false,
            status: 'failed',
            error: err.message,
            recipient: validation.local
        };
    }
}

/**
 * Driver Approval SMS Template and Delivery Helper
 */
async function sendDriverApprovalNotification(driverName, phoneNumber) {
    const formattedName = driverName ? driverName.trim() : 'Driver';
    const message = `Hello ${formattedName}, your LaundriGo driver application has been approved. You can now log in to your account and access your driver dashboard. Thank you!`;
    return await sendSms(phoneNumber, message);
}

module.exports = {
    normalizePhilippineMobile,
    getSmsProviderConfig,
    sendSms,
    sendDriverApprovalNotification
};
