FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

# Add this line to install git
RUN apk add --no-cache git

COPY . .

CMD ["node", "index.js"]
