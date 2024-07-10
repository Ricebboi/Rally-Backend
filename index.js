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
  const { amount, currency } = req.body;
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
    const { email } = req.body;
    console.log('Request body:', req.body);
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          transfers: { requested: true },
        },
      });
      console.log('Coach account created:', account);
      res.json({ accountId: account.id });
    } catch (error) {
      console.error('Error creating coach account:', error);
      res.status(500).send(error);
    }
  });

app.post('/transfer-funds', async (req, res) => {
  console.log('Received request for /transfer-funds');
  const { amount, coachAccountId } = req.body;
  console.log('Request body:', req.body);
  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: 'usd',
      destination: coachAccountId,
    });
    console.log('Funds transferred:', transfer);
    res.json({ transfer });
  } catch (error) {
    console.error('Error transferring funds:', error);
    res.status(500).send(error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
