const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Rally Backend Server');
});

// Create a new endpoint to handle /connect-stripe
app.get('/connect-stripe', async (req, res) => {
  try {
    // Check if the coach has an existing Stripe account ID
    const existingAccountId = req.query.account_id;

    let account;
    if (existingAccountId) {
      // Retrieve the existing account
      account = await stripe.accounts.retrieve(existingAccountId);
    } else {
      // Create a new Stripe account for the coach
      account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
    }

    // Generate an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://rallycoaches.com/reauth',
      return_url: 'https://rallycoaches.com',
      type: 'account_onboarding',
    });

    // Redirect the coach to the Stripe onboarding link
    res.redirect(accountLink.url);
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency = 'usd' } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/create-coach-account', async (req, res) => {
  const { email, first_name, last_name, dob, address, phone, ssn_last_4, business_type, tax_id } = req.body;
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: business_type || 'individual',
      individual: {
        email,
        first_name,
        last_name,
        dob,
        address,
        phone,
        ssn_last_4,
      },
      company: business_type === 'company' ? { tax_id } : undefined,
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://rallycoaches.com/reauth',
      return_url: 'https://rallycoaches.com/return',
      type: 'account_onboarding',
    });

    res.json({ accountId: account.id, accountLink: accountLink.url });
  } catch (error) {
    console.error('Error creating coach account:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/generate-account-link', async (req, res) => {
  const { accountId } = req.body;
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://rallycoaches.com/reauth',
      return_url: 'https://rallycoaches.com/return',
      type: 'account_onboarding',
    });
    res.json({ accountLink: accountLink.url });
  } catch (error) {
    console.error('Error generating account link:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/retrieve-account-details', async (req, res) => {
  const { accountId } = req.body;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    res.json(account);
  } catch (error) {
    console.error('Error retrieving account details:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/transfer-funds', async (req, res) => {
  const { amount, currency = 'usd', coachAccountId } = req.body;
  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency,
      destination: coachAccountId,
    });
    res.json({ transfer });
  } catch (error) {
    console.error('Error transferring funds:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/check-coach-capabilities', async (req, res) => {
  const { accountId } = req.body;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    res.json({ capabilities: account.capabilities });
  } catch (error) {
    console.error('Error checking coach capabilities:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  const { price, coachAccountId } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Coaching Session',
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(price * 0.15), // 15% platform fee
        transfer_data: {
          destination: coachAccountId,
        },
      },
      success_url: 'https://www.rallycoaches.com/success',
      cancel_url: 'https://www.rallycoaches.com/cancel',
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment received for session:', session);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
