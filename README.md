# Short Link Manager

行銷部專用短網址管理系統 (Internal Marketing URL Shortener)

## Features

- **Short URL Management** - Create, edit, and manage short links with custom codes
- **UTM Builder** - Built-in UTM parameter builder with templates and batch creation
- **Analytics** - Track clicks, referrers, devices, and geographic data
- **QR Code Generation** - Auto-generate QR codes for each link
- **Role-based Access** - Admin, Manager, Member, and Viewer roles
- **Internationalization** - Support for English and Traditional Chinese

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 (Google OAuth)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **i18n**: next-intl

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd shortlink-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `ALLOWED_EMAIL_DOMAIN` - (Optional) Restrict to company domain

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

## Project Structure

```
src/
├── app/
│   ├── [locale]/           # i18n routes
│   │   ├── (dashboard)/    # Protected dashboard routes
│   │   │   ├── dashboard/
│   │   │   ├── links/
│   │   │   ├── templates/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── api/
│   │   └── auth/           # NextAuth.js API routes
│   ├── auth/               # Auth pages (signin, error)
│   └── s/[code]/           # Short link redirect handler
├── components/
│   ├── layout/             # Layout components (Sidebar, etc.)
│   ├── ui/                 # Reusable UI components
│   ├── links/              # Link-related components
│   └── analytics/          # Analytics components
├── lib/
│   ├── auth.ts             # NextAuth.js configuration
│   ├── prisma.ts           # Prisma client
│   └── utils/              # Utility functions
├── i18n/                   # i18n configuration
└── messages/               # Translation files
```

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access, user management, system settings |
| Manager | View all links/reports, edit team links |
| Member | Create/edit/delete own links only |
| Viewer | View specific shared reports only |

## Deployment

### Zeabur

1. Connect your GitHub repository
2. Set environment variables in Zeabur dashboard
3. Add PostgreSQL service
4. Deploy

### Other Platforms

The app is compatible with any platform that supports Next.js:
- Vercel
- Railway
- Render
- Docker

## License

Private - Internal use only
