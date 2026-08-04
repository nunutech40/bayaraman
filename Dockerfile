FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

WORKDIR /app
COPY . .
# Route collection needs server-only values. They exist only for this build
# command and are not persisted as runtime image environment variables.
RUN AUTH_SESSION_SECRET=bayaraman-build-placeholder-auth-secret-32bytes \
    JOB_SCHEDULER_SECRET=bayaraman-build-placeholder-job-secret-32bytes \
    DATABASE_URL=postgresql://bayaraman:build_placeholder@127.0.0.1:5432/bayaraman \
    npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app ./

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
