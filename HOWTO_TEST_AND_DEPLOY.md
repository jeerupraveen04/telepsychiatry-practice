HOWTO: Test and Deploy the Telepsychiatry Project

This document explains how to run the project locally, run quick sanity checks, and basic deployment options.

1) Quick contract (what this repo contains)
- frontend/: Static frontend (index.html, doctor.html, CSS, JS, intake-form/)
- backend/: Node/Express backend with `server.js` and `test-server.js` plus package.json

2) Local development (recommended)
- Requirements: Node.js (16+), npm, PostgreSQL (optional for local DB testing)

- Install dependencies for backend:

```bash
cd "./"
cd backend
npm install
```

- Set up environment variables (create a `.env` file in `backend/`):

```env
PORT=3000
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telepsychiatry
```

- Create the Postgres database (if using postgres):

```bash
createdb telepsychiatry
```

- Start the backend server:

```bash
cd backend
npm start
```

The server will serve static files and API endpoints. Open:
- Patient form: http://localhost:3123/frontend/index.html
- Doctor portal: http://localhost:3123/frontend/doctor.html

3) Quick smoke tests
- Submit the form via the patient page and check the server console for successful DB insert logs.
- Visit `/api/patients` in the browser to confirm the list endpoint returns JSON.
- Use `curl` to test endpoints quickly:

```bash
# List patients
curl http://localhost:3000/api/patients

# Submit test payload
curl -X POST http://localhost:3000/api/submit -H 'Content-Type: application/json' -d '{"legalName":"Test User","dob":"1990-01-01"}'
```

4) Running without Postgres (quick static test server)
If you just want to preview static files without Node/Express, run the lightweight test server:

```bash
node backend/test-server.js
# open http://127.0.0.1:8080/frontend/index.html
```

5) Basic deployment options
- Heroku / Render / Railway: These platforms support Node.js apps; set the environment variables using their dashboard and push the repo.
- Docker: Create a simple Dockerfile for the backend and use a managed Postgres service.

Example minimal Dockerfile (backend):

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node","server.js"]
```

6) Tests
- This repo does not include unit tests. For basic validation, add a simple integration test that posts to `/api/submit` and checks the DB or response.
- Suggested quick test with Node and jest/supertest (optional): create `tests/api.test.js` that starts the server and performs a POST and GET.

7) Next steps / Recommendations
- Add a small script to validate that static assets are being served (smoke test).
- Add basic integration tests (jest + supertest) for `/api/submit` and `/api/patients`.
- If deploying to production, configure secure DB credentials, enable TLS, and consider using a dedicated object store for attachments.

