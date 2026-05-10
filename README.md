# Delivery Kenya

A full-stack delivery marketplace for two user types: sellers and drivers. Sellers find verified drivers for client deliveries, drivers discover sellers who need delivery help, both sides can chat, choose comfortable Kenyan languages, share browser location, and record cash or M-Pesa delivery payments.

## Project Structure

- `frontend` - Vite React app using Firebase Auth and Firestore.
- `backend` - Express API using Firebase Admin for protected profile, directory, conversation, and payment routes.

## Setup

1. Create a Firebase web app in the `delivery-67faf` project.
2. Copy `frontend/.env.example` to `frontend/.env` and fill in the Firebase web config.
3. Create a Firebase service account key.
4. Copy `backend/.env.example` to `backend/.env` and fill in the service account values.
5. Enable Firebase Authentication with Email/Password.
6. Create Firestore in production or test mode, then publish `firestore.rules`.

## Run Locally

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## Firebase Collections

- `users/{uid}` stores role, phone, county, languages, availability, trust data, and location.
- `conversations/{seller_driver_id}` stores participants.
- `conversations/{seller_driver_id}/messages/{messageId}` stores saved chat history.
- `payments/{paymentId}` stores payment method, amount, seller, driver, item, and status.

## Notes

- Passwords are enforced in the frontend before Firebase signup/signin: minimum characters are 10 for my project but you can use any value you want, with letters, numbers, underscore, and a symbol.
- Kenyan phone validation currently checks common mobile formats like `+254712345678` and `0712345678`.
- Browser geolocation requires user permission and works best on HTTPS in production.
- M-Pesa records are saved now. The backend has a Daraja-ready placeholder in `backend/src/mpesa.js`; live STK Push can be completed after you provide the consumer key, consumer secret, passkey, shortcode, and callback URL.
And thats it you have a full stack project.