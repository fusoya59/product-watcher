FROM ubuntu:18.04

# get node
RUN apt update -y && \
  apt install curl -y && \
  curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
  apt install nodejs -yq

# install chromium dependencies
RUN apt install -yq libxcursor1 \
  libnss3 \
  libcups2 \
  libxss1 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libgtk-3-0 \
  libx11-xcb1 \
  libxcb-dri3-0

# setup the app
RUN mkdir -p /product-watcher
WORKDIR /product-watcher
COPY index.js ./index.js
COPY *.json ./
COPY src ./src

# setup user for puppeteer for sandbox mode
RUN groupadd -r pptruser && \
  useradd -r -g pptruser -G audio,video pptruser && \
  mkdir -p /home/pptruser/Downloads && \
  chown -R pptruser:pptruser /home/pptruser && \
  chown -R pptruser:pptruser /product-watcher

# install app dependencies
RUN npm install --production 

USER pptruser

CMD ["npm", "start"]
