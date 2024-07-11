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
    // Create a new Stripe account for the coach
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Generate an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://rallycoaches.com/reauth',
      return_url: 'https://rallycoaches.com/return',
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
  console.log('Received request for /create-payment-intent');
  const { amount, currency = 'usd' } = req.body;
  console.log('Request body:', req.body);
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    console.log('Payment intent created:', paymentIntent);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).send({ error: error.message });
  }
});

app.post('/create-coach-account', async (req, res) => {
  console.log('Received request for /create-coach-account');
  const { email, first_name, last_name, dob, address, phone, ssn_last_4, business_type, tax_id } = req.body;
  console.log('Request body:', req.body);
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

    console.log('Coach account created:', account);
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
  console.log('Received request for /transfer-funds');
  const { amount, currency = 'usd', coachAccountId } = req.body;
  console.log('Request body:', req.body);
  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency,
      destination: coachAccountId,
    });
    console.log('Funds transferred:', transfer);
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
  const { priceId, coachAccountId } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 123, // Adjust as needed
        transfer_data: {
          destination: coachAccountId,
        },
      },
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
