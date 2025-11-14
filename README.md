# Comparative Rideshares

Compare prices and wait times across Uber, Lyft, and Taxi services in the Bay Area.

## Prerequisites

- Node.js 18+
- npm

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/rideshareappnew.git
   cd rideshareappnew
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Environment Variables

Create a `.env.local` file in the project root. See `ENV_EXAMPLE.md` for all required variables.

**Minimum required:**
```
DATABASE_URL="postgresql://user:YOUR_PASSWORD@localhost:5432/rideshareappnew?schema=public"
```

For Docker, create a `.env` file with:
```
POSTGRES_USER=rideshare
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=rideshareappnew
```

**Important:** Never commit `.env` or `.env.local` files to Git. They are already in `.gitignore`.

## Running with Docker

### Build and run (production)

```bash
docker compose up --build -d
```

The app will be available at `http://localhost:3000`.

To run the database only (useful during development):

```bash
docker compose up -d db
```

### Prisma & Database Commands

```bash
# apply migrations locally (creates the database schema)
npm run db:migrate

# run migrations in production environments
npm run db:deploy

# regenerate Prisma Client after schema changes
npm run db:generate

# open Prisma Studio data browser
npm run db:studio
```

### Development

To use hot reloading, continue to run `npm run dev` locally outside Docker.

## Features

- **Real-time surge pricing** with smart time-based multipliers
- **Best time recommendations** for optimal pricing
- **ETA sharing** to notify family/friends
- **Price alerts** for fare drop notifications
- **Interactive route mapping** with OpenStreetMap
- **Comprehensive comparison** across Uber, Lyft & Taxi

## Usage

1. Enter pickup location (e.g., "Santa Clara University")
2. Enter destination (e.g., "San Jose Airport")
3. Compare real-time prices with surge indicators
4. Set price alerts or share ETA with contacts
5. Click to book with your preferred service

## Technologies Used

- Next.js 14, TypeScript, Tailwind CSS
- React Leaflet, OpenStreetMap, OSRM API
- Vercel deployment

## Testing

```bash
npm test
```

```

```
