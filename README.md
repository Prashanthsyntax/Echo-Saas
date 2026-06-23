# Echo - AI Video Recording and Automations

![alt text](images/Hero.png)

## Getting Started

First, run the development server:

```bash
npm run dev

```

### End to End Pipeline

![alt text](images/echo_roadmap.png)

Open Prisma Studio:

```bash
npx prisma studio
```

![alt text](images/prisma.png)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

![alt text](images/stripe_payment_done.png)
