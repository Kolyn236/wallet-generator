FROM node:24-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM nginx:1.28-alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
