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

# scaffold next project
RUN CI=true npx --yes create-next-app@16.1.6 app \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm \
  --no-git

WORKDIR /home/user/app

# install deps
RUN npm install

# extra UI deps
RUN npm install \
  lucide-react \
  clsx \
  tailwind-merge \
  framer-motion

# install shadcn
RUN npx --yes shadcn@latest init -d
RUN npx --yes shadcn@latest add --all -y

EXPOSE 3000

CMD ["/compile_page.sh"]