const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Rally Backend Server');
});

app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/create-coach-account', async (req, res) => {
  const { email } = req.body;
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
    });
    res.json({ accountId: account.id });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/transfer-funds', async (req, res) => {
  const { amount, coachAccountId } = req.body;
  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: 'usd',
      destination: coachAccountId,
    });
    res.json({ transfer });
  } catch (error) {
    res.status(500).send(error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
