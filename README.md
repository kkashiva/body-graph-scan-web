# Body Scan

**Qwen AI Build Day Hackathon -- Healthcare Track, Challenge #2**

Measuring body fat % typically requires specialized, expensive equipment (DEXA scans, BodPod, hydrostatic weighing). Most people don't have easy access. Body Scan solves this by estimating body fat percentage and body measurements from just two photos -- a front view and a side profile.

## How It Works

1. **User inputs** their gender, age, height, and weight.
2. **User uploads** a front-facing and side-profile body photo.
3. **AI graph pipeline** breaks each image into isolated body regions (jawline, neck, triceps, belly, love handles, forearms, etc.) and analyzes each one independently using a Vision-Language Model.
4. **Fan-in aggregation** combines per-region estimates with configurable weights to produce a final body fat % and circumference measurements.
5. **Results are stored** so users can track their body composition trends over time with charts.

### Why a Graph Architecture?

Asking a single VLM to analyze an entire body photo at once leads to hallucination and unreliable estimates. By **fanning out** the image into focused regions -- each analyzed in isolation with managed context -- and then **fanning in** the results with tunable weights, we get significantly more accurate and reproducible data.

This is implemented using [LangGraph](https://langchain-ai.github.io/langgraphjs/) (LangChain), where each graph node represents a specific body region analysis. The architecture also supports:

- **Swappable LLMs** -- switch between Gemini and Qwen models per node
- **Configurable weights** -- control how much each body region contributes to the final estimate
- **Training pipeline** -- refine feature extraction and weights from labeled datasets (supervised learning)

### Estimation Method

Inspired by the **US Navy circumference method**, which estimates body fat from neck, waist, and hip circumferences combined with height. In our approach, the VLM-derived circumferences replace tape measurements:

- **Male:** BF% = 86.010 x log10(waist - neck) - 70.041 x log10(height) + 36.76
- **Female:** BF% = 163.205 x log10(waist + hip - neck) - 97.684 x log10(height) + 78.387

Height is the only user-provided measurement. All circumferences are estimated from the photos.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Database | PostgreSQL on [Neon](https://neon.tech) |
| Auth | Neon Auth (Google OAuth) |
| AI Pipeline | LangGraph (LangChain JS) -- fan-out/fan-in graph |
| LLM Providers | Qwen VL, Google Gemini |
| Hosting | Vercel |

## Architecture

See detailed diagrams:
- [Database ERD](docs/ERD.md)
- [Information Flow Diagram](docs/IFD.md)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database with Auth enabled
- Google OAuth credentials configured in Neon Auth

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEON_AUTH_BASE_URL` | Neon Auth endpoint URL |
| `NEON_AUTH_COOKIE_SECRET` | Auth cookie secret (`openssl rand -base64 32`) |

## Project Structure

```
src/
  app/
    login/               # Google OAuth sign-in
    (authenticated)/     # Protected routes
      dashboard/         # Scan history + trendline charts
      scan/new/          # Upload photos for analysis
      scan/[id]/         # Scan results detail
      profile/           # User measurements (gender, DOB, height, weight)
    api/auth/[...path]/  # Neon Auth handler
  lib/
    auth/                # Auth server + client config
    db.ts                # Neon SQL client
  db/
    migrations/          # Numbered SQL migration files
    migrate.ts           # Migration runner
```

## Target Audience

Health-conscious people following a fitness routine who want to track body composition changes over time without expensive equipment. Users are expected to have access to a regular scale and tape measure for height -- the app handles everything else from photos.

## License

MIT
