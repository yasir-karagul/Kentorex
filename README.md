# waypoint — Project handbook

waypoint is a private, multi-project documentation workspace. Every registered account can create projects and manage their modules and notes from the project pages—there is no admin role or separate admin dashboard.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
```

Set `MONGODB_URI` and the Firebase/Turnstile values described below in `.env.local`, then run:

```powershell
npm run dev
npm run typecheck
```

Open `http://localhost:3000/register` to create an account. Verify its email and then sign in. After signing in, use **New project** in the project navigation to add projects.

## Manage project content

- **Add:** choose **New module** on a project overview. Set a name, collection, lifecycle, sections, and content.
- **Edit:** choose **Edit module** on that module's page. Update its metadata, section labels/keys, and Markdown content.
- **Import:** from a section in the module editor, select a `.md`, `.markdown`, or `.docx` file. DOCX text and basic structure are converted to Markdown. Imports are inserted into the selected section and saved when you choose **Save changes**.
- **Images and tables:** place the cursor in a documentation section and use **Add images** to upload up to eight PNG, JPEG, GIF, or WebP images (2 MB each; 12 MB total), or **Insert table** to add a Markdown table template at that location. Both are saved with the module. Wide tables and code blocks scroll horizontally.
- **Delete:** use **Delete module** in the module editor and confirm. Removing a section in the editor takes effect when the module is saved.
- **Display:** the project overview lists the modules; each module page renders its sections. Markdown headings, lists, tables, links, and code are supported.
- **Project code:** the source section below documentation provides a nested file hierarchy. Open a file to view or copy it; create, edit, delete, or import text files directly in the same section. Imported code is reviewed in the editor and saved when you choose **Save file**.

Each account can access only its own projects. Passwords are stored as scrypt hashes; login uses random, HTTP-only, same-site session cookies stored as hashes in MongoDB. Configure HTTPS in production so session cookies are sent securely.

## API

The browser uses these authenticated endpoints:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/resend-verification`, `POST /api/auth/logout`
- `GET /api/projects`, `POST /api/projects`
- `GET /api/modules?project=<slug>`, `POST /api/modules`, `PUT /api/modules?originalSlug=<slug>`, `DELETE /api/modules?project=<slug>&slug=<module>`
- `GET /api/files?project=<slug>`, `POST /api/files`, `PUT /api/files?project=<slug>&originalPath=<path>`, `DELETE /api/files?project=<slug>&path=<path>`
- `POST /api/content/import` with `project` and `file` multipart fields
- `POST /api/content/images` with `project` and one or more `files` multipart fields; `GET /api/content/images/<id>?project=<slug>` serves authenticated project images
- `POST /api/files/import` with `project` and `file` multipart fields for UTF-8 text files

Module and project payloads are validated with Zod in `lib/schemas.ts`. MongoDB is required for accounts, sessions, and saved content; waypoint does not use a read-only seed fallback.

The interface uses Next.js, React, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Zustand, Zod, and MongoDB. Add shadcn/ui components with `npx shadcn@latest add <name>`; `components.json` is configured.

## Account verification setup (free services; no custom domain required)

New registrations use the existing MongoDB-backed password and session system. Firebase Authentication sends the verification email using its built-in email delivery; the app does not use Resend or another mail provider. Firebase stores a separate verification identity with a randomly generated, undisclosed password, so a user's waypoint password is not copied to Firebase. A Firebase Admin check synchronizes the verified state at sign-in, and protected pages/APIs reject accounts whose stored verification state is false.

Existing accounts are not migrated or modified by this change: users with no `emailVerified` field remain compatible with their current passwords, sessions, data, and access. Only new accounts require verification. This avoids forcing a disruptive authentication migration.

### Firebase Authentication

1. Create a Firebase project and keep it on the **Spark (no-cost) plan**. In **Authentication → Sign-in method**, enable **Email/Password**.
2. In **Authentication → Settings → Authorized domains**, add the exact host used by `APP_URL`, for example `your-app.vercel.app`. Firebase expects actual hostnames rather than a literal `*.vercel.app` wildcard. Add each preview hostname only if you intend to use it; add `localhost` for local development if it is not already listed.
3. Keep Firebase's default hosted email action handler and enable the built-in **Email address verification** template. The verification link returns to `APP_URL/verify-email`; the page then links back to sign-in. No custom action domain or sender domain is required.
4. In **Project settings → General**, copy the project ID and Web API key. In **Project settings → Service accounts**, create a private key for the server-side Admin SDK. Store its service-account email and private key only as server environment variables; never commit them.

### Cloudflare Turnstile

1. Create a free Turnstile widget in Cloudflare and allow the app's exact hostname (the Vercel `*.vercel.app` hostname) and `localhost` for development.
2. Put its site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and its secret in `TURNSTILE_SECRET_KEY`. The browser token is checked with Cloudflare's Siteverify API on the server for both registration and resend requests; missing configuration or failed checks reject the request.

### Environment variables

Set these in `.env.local` for development and in the Vercel project's environment settings for production. Use the exact deployed HTTPS origin for `APP_URL`.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Private MongoDB connection string used for accounts, sessions, content, and authentication rate limits. |
| `MONGODB_DB` | No | Database name; defaults to `waypoint`. |
| `APP_URL` | Yes | Canonical website origin, e.g. `https://your-app.vercel.app`; verification redirects to `/verify-email`. |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID. |
| `FIREBASE_API_KEY` | Yes | Firebase project's Web API key, used server-side for Firebase Identity Toolkit email delivery. |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service-account email for Firebase Admin. |
| `FIREBASE_PRIVATE_KEY` | Yes | Service-account private key; preserve newlines or use `\n` escapes in Vercel. Server-only; never expose with a `NEXT_PUBLIC_` prefix. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Public Cloudflare Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | Yes | Private Cloudflare Turnstile secret, used only by the server. |

Authentication rate limits are stored in MongoDB so they apply across server instances: registration is limited by email and IP, and verification resend is limited to one request per minute and five per day per email, plus an IP limit. Configure a real Turnstile key pair for production; Cloudflare's test keys are not production protection. Deploy behind HTTPS and keep all server secrets in Vercel's encrypted environment-variable settings.
