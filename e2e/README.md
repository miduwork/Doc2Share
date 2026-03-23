# E2E (Playwright)

Chạy khi app đang chạy: `npm run dev`.

```bash
# Cài browsers (lần đầu)
npx playwright install chromium

# Chạy test (skip login/PDF nếu thiếu env)
BASE_URL=http://localhost:3000 E2E_LOGIN_EMAIL=... E2E_LOGIN_PASSWORD=... npm run test:e2e
```

- **BASE_URL**: Mặc định `http://localhost:3000`
- **E2E_LOGIN_EMAIL**, **E2E_LOGIN_PASSWORD**: Nếu thiếu, test login + PDF sẽ bị skip.
