const crypto = require('crypto');

  module.exports = async function handler(req, res) {
        // Allow CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
              return res.status(200).end();
            }

            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
              }

                try {
                const { cart, total, customerEmail, shippingInfo, orderId, promoCode, promoDiscount } = req.body;

                    const API_KEY = process.env.BANKFUL_API_KEY;
                    const API_SECRET = process.env.BANKFUL_API_SECRET;

                if (!API_KEY || !API_SECRET) {
                  return res.status(500).json({ error: 'Bankful API credentials not configured' });
                }

                const amountCents = Math.round(total * 100);
                const orderRef = orderId || `order_${Date.now()}`;
                const successUrl = `${process.env.VITE_APP_URL || 'https://test-site-1-xi.vercel.app'}/order-success`;
                  const cancelUrl = `${process.env.VITE_APP_URL || 'https://test-site-1-xi.vercel.app'}/checkout`;

                        // Build the payload for Bankful hosted payment page
                          const payload = {
                              apiKey: API_KEY,
                              amount: amountCents,
                              currency: 'USD',
                              orderID: orderRef,
                        customerEmail: customerEmail || (shippingInfo && shippingInfo.email) || '',
                        customerFirstName: (shippingInfo && shippingInfo.firstName) || '',
                        customerLastName: (shippingInfo && shippingInfo.lastName) || '',
                              successURL: successUrl,
                              cancelURL: cancelUrl,
                              description: 'Eclipse Research Order',
                      };

                          // Generate SHA256 signature: sort all non-empty fields alphabetically, concatenate values, hash with secret
                      const sortedKeys = Object.keys(payload)
                      .filter(k => payload[k] !== '' && payload[k] !== null && payload[k] !== undefined)
                      .sort();

                      const signatureString = sortedKeys.map(k => payload[k]).join('') + API_SECRET;
                      const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

                              payload.signature = signature;

                          // POST to Bankful hosted payment page endpoint
                              const bankfulResponse = await fetch('https://api.paybybankful.com/front-calls/go-in/hosted-page-pay', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(payload),
                              });

                          const responseText = await bankfulResponse.text();
                              let data;
                              try {
                            data = JSON.parse(responseText);
                            } catch (e) {
                                  // Bankful might return a URL directly or HTML redirect
                            if (bankfulResponse.status >= 200 && bankfulResponse.status < 400) {
                              return res.status(200).json({ url: responseText.trim() });
                            }
                            return res.status(500).json({ error: 'Bankful returned unexpected response', details: responseText });
                          }

                          if (!bankfulResponse.ok) {
                            return res.status(bankfulResponse.status).json({ error: 'Bankful API error', details: data });
                          }

                          // Return the redirect URL to the frontend
                          return res.status(200).json(data);

                          } catch (err) {
                            console.error('Bankful session error:', err);
                            return res.status(500).json({ error: err.message });
                          }
                        };
