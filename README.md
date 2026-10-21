# Ticketing Management Platform (Inbox / GoldMine Portal)

Enterprise-grade service desk, sprint execution, and tiered technical support escalation application.

## Project Structure

```text
ticketing_tool/
│
├── frontend/                     # React 19 Single Page Application (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── components/           # UI components
│   │   ├── context/              # React AppContext state management
│   │   ├── data/                 # Initial seed dataset
│   │   ├── pages/                # All 16 application page views
│   │   ├── services/             # Client storage & RBAC utilities
│   │   └── types/                # Domain TypeScript contracts
│   ├── public/                   # Static SVG assets & icons
│   ├── package.json              # Frontend dependencies & scripts
│   ├── tsconfig.json             # TypeScript configuration
│   └── vite.config.ts            # Vite 8 bundler configuration
│
├── backend/                      # NestJS Modular Backend (Node.js + PostgreSQL + Prisma)
│   ├── README.md                 # Backend setup guide and specifications
│   └── .env.example              # Backend environment variable template
│
├── docs/                         # Centralized architectural documentation
│   ├── 01_SYSTEM_ARCHITECTURE.md # Macro system architecture & integration guide
│   └── 02_CODING_STANDARDS.md    # Shared engineering standards & coding rules
│
├── BACKEND_ARCHITECTURE.md       # Foundational architecture specification
└── README.md                     # Root workspace documentation
```

## Running the Frontend

**Prerequisites:** Node.js (v18+)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:3000`.

## Backend Documentation & Setup

- The backend architecture is documented in [`docs/01_SYSTEM_ARCHITECTURE.md`](docs/01_SYSTEM_ARCHITECTURE.md) and [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md).
- Backend coding standards are defined in [`docs/02_CODING_STANDARDS.md`](docs/02_CODING_STANDARDS.md).
- To initialize the backend service, refer to [`backend/README.md`](backend/README.md).
