FROM node:24-alpine AS ui-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS ui
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=ui-build /app/dist /usr/share/nginx/html

FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=ui-build /app/dist-server ./dist-server
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
