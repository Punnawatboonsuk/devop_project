# DevOps Project (Nisit Deeden)

## Deployment (UAT Link Only)

For update/checkpoint sessions, the app must be tested via UAT link (not `localhost`).

Target UAT domain in this repo:
- `http://nisit-uat.local`

### 1. Prerequisites (DevOps team member machine)

- OS with Docker Desktop + Kubernetes tools installed
- Minikube
- `kubectl`
- GitHub self-hosted runner registered with labels: `self-hosted`, `windows`, `devops`
- Runner machine must be the same machine that can access Minikube cluster

### 2. Set hosts file (`.local` domain)

On every tester/TA machine that will open UAT link, add this line:

```txt
127.0.0.1 nisit-uat.local
```

Windows hosts file path:
- `C:\Windows\System32\drivers\etc\hosts`

### 3. CI/CD workflow

Workflow file:
- `.github/workflows/deploy-k8s.yml`

Current pipeline flow:
1. Checkout source
2. Verify `kubectl` + `minikube`
3. Enable Minikube ingress addon
4. Build images in Minikube:
   - `nisit-client:latest`
   - `nisit-server:latest`
5. Apply Kubernetes manifests:
   - `k8s/postgres.yaml`
   - `k8s/backend.yaml`
   - `k8s/frontend.yaml`
   - `k8s/ingress.yaml`
6. Wait for deployments rollout
7. Run migration pod (`node scripts/migrate.js`)

### 4. Kubernetes routing

Ingress host config:
- `k8s/ingress.yaml` -> host `nisit-uat.local`
- `/` -> `nisit-client` service
- `/api` -> `nisit-server` service

Backend UAT env in `k8s/backend.yaml`:
- `FRONTEND_URL=http://nisit-uat.local`
- `CORS_ORIGIN=http://nisit-uat.local`
- `GOOGLE_CALLBACK_URL=http://nisit-uat.local/api/auth/google/callback`

### 5. How to deploy for UAT

1. Push changes to `main` branch (or run workflow manually with `workflow_dispatch`)
2. Wait for GitHub Actions workflow `Deploy To Minikube` to complete
3. Verify resources:
   - `kubectl get pods,svc,ingress`
4. Open:
   - `http://nisit-uat.local`

### 6. TA/Stakeholder update checklist

- Access via `http://nisit-uat.local` only (no localhost URL shown)
- Frontend works from UAT domain
- API works through `/api/*`
- Login/session works from UAT domain
- Latest requested fixes from stakeholder are visible on deployed UAT
