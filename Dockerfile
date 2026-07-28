FROM node:22-alpine
ARG AGENT_UID=1003
ARG AGENT_GID=1003
WORKDIR /app
RUN apk add --no-cache su-exec
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -g "$AGENT_GID" agent && adduser -D -u "$AGENT_UID" -G agent agent && chown -R agent:agent /app
USER agent
EXPOSE 3000
CMD ["npm", "start"]
