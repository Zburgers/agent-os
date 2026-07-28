FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -S agent && adduser -S agent -G agent && chown -R agent:agent /app
USER agent
EXPOSE 3000
CMD ["npm", "start"]
