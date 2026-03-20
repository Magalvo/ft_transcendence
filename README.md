# ft_transcendence

Fresh-clone bootstrap is centered on the root `Makefile`.

Run:

```bash
make
```

That single command will:

- create `backend/Auth/.env` if it does not exist
- create `.secrets/google_client_secret.txt` as an empty placeholder if it does not exist
- generate `.secrets/jwt_secret.txt` automatically if it is missing or empty
- build the Docker images
- install dependencies during the image builds
- start the full Docker Compose stack

Notes:

- `GOOGLE_CLIENT_SECRET` is intentionally allowed to stay empty after a fresh clone. Google OAuth remains disabled until `.secrets/google_client_secret.txt` is filled with the real secret and the stack is restarted.
- The `.secrets` directory is kept in the repo only as an empty placeholder. Sensitive values should be added locally after cloning.
- Prerequisites are Docker Desktop (or Docker Engine with Compose) and `make`.
