# MongoDB Atlas setup for AGSV Fantasy

## 1. Create a cluster

1. Sign in at [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. **Create** → choose **M0 Free** (or a paid tier).
3. Pick a cloud region close to your users (e.g. Sydney if most users are in Australia).
4. Name the cluster (e.g. `agsv-fantasy`) and create it.

## 2. Database user

1. **Database Access** → **Add New Database User**.
2. Authentication: **Password**.
3. Username / password — save these somewhere safe.
4. Privileges: **Read and write to any database** (or restrict to database `agsv`).
5. **Add User**.

## 3. Network access

1. **Network Access** → **Add IP Address**.
2. For local dev: **Add Current IP Address**.
3. For Vercel (serverless): **Allow Access from Anywhere** (`0.0.0.0/0`) — required because Vercel IPs change.

## 4. Connection string

1. **Database** → **Connect** → **Drivers**.
2. Driver: **Node.js**, version 6+.
3. Copy the URI. It looks like:

   ```
   mongodb+srv://myuser:<password>@cluster0.abcd123.mongodb.net/?retryWrites=true&w=majority
   ```

4. Edit the URI:
   - Replace `<password>` with your real password (URL-encode special characters: `@` → `%40`, etc.).
   - Add the database name before `?`: `/agsv`

   Example:

   ```
   mongodb+srv://myuser:MyP%40ss@cluster0.abcd123.mongodb.net/agsv?retryWrites=true&w=majority
   ```

## 5. Configure this project

```bash
cp .env.example .env
# Edit .env and paste MONGODB_URI and SESSION_SECRET

npm install
npm run migrate:mongo
npm start
```

You should see: `Storage: mongodb (Atlas)`.

## 6. Vercel environment variables

In the Vercel project → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `MONGODB_URI` | Same URI as `.env` |
| `SESSION_SECRET` | Long random string (`openssl rand -hex 32`) |
| `NODE_ENV` | `production` |

Redeploy after adding variables. Run `npm run migrate:mongo` once from your machine (with production URI) to seed production data, or run it against a staging URI first.

## Collections

| Collection | Contents |
|------------|----------|
| `schools` | School list |
| `users` | Accounts, credits, password hashes |
| `bets` | All bets |
| `sports` | Full AFL / soccer / badminton JSON per sport |

## Without Atlas (local only)

Leave `MONGODB_URI` unset. The app keeps using `users.json`, `bets.json`, and `data/*.json`.

## Troubleshooting

- **Authentication failed** — wrong password or user; check URL encoding.
- **IP not whitelisted** — add your IP or `0.0.0.0/0` in Network Access.
- **Empty sports after migrate** — re-run `npm run migrate:mongo`.
- **Sessions reset on Vercel** — set `SESSION_SECRET` in Vercel env (do not rely on `.session-secret` file).
