const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Rally Backend Server');
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
    res.status(500).send(error);
  }
});

app.post('/create-coach-account', async (req, res) => {
  console.log('Received request for /create-coach-account');
  const { email, first_name = 'First', last_name = 'Last', dob = { day: 1, month: 1, year: 1990 }, address = { line1: '1234 Main Street', city: 'San Francisco', state: 'CA', postal_code: '94111', country: 'US' } } = req.body;
  console.log('Request body:', req.body);
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email: email,
        first_name: first_name,
        last_name: last_name,
        dob: dob,
        address: address,
      },
    });

    // Generate account link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://rallycoaches.com/reauth',  // Update with actual URL
      return_url: 'https://rallycoaches.com/return',  // Update with actual URL
      type: 'account_onboarding',
    });

    console.log('Coach account created:', account);
    res.json({ accountId: account.id, accountLink: accountLink.url });
  } catch (error) {
    console.error('Error creating coach account:', error);
    res.status(500).send(error);
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
    res.status(500).send(error);
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
    res.status(500).send(error);
  }
});

app.post('/check-coach-capabilities', async (req, res) => {
  const { accountId } = req.body;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    res.json({ capabilities: account.capabilities });
  } catch (error) {
    res.status(500).send(error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
