# Agent Notes

## Frontend (`frontend/`)
- Axios falls back to `http://localhost:3000` in development to prevent protocol mismatches when the frontend is served over HTTPS but the backend only exposes HTTP.
- Set `VITE_API_URL` for non-development deployments where the API lives on a different origin.
- The authentication flow now posts an `identifier` (username or email) plus `password` to `/api/auth/login`; keep this shape in sync between the frontend store and backend validation when making auth changes.

