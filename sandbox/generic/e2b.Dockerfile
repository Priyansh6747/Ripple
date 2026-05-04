FROM node:22-slim

ENV NODE_ENV=development
ENV PORT=3000

RUN apt-get update \
 && apt-get install -y curl git ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

RUN git clone https://github.com/Priyansh6747/RippleTemplates.git app

WORKDIR /home/user/app

RUN npm install

EXPOSE 3000

CMD ["/compile_page.sh"]