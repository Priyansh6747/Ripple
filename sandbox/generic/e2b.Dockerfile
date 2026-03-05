FROM node:21-slim

ENV NODE_ENV=development
ENV PORT=3000

# Install system tools
RUN apt-get update \
 && apt-get install -y \
    curl \
    git \
    ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Create user workspace
WORKDIR /home/user

# Copy startup script
COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

# Create Next.js template
RUN npx --yes create-next-app@16.1.6 next-template \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm \
  --no-git

# Install common UI dependencies (AI will likely use these)
WORKDIR /home/user/next-template

RUN npm install \
  lucide-react \
  clsx \
  tailwind-merge \
  framer-motion

# Install shadcn UI
RUN npx --yes shadcn@3.8.5 init --yes -b neutral --force
RUN npx --yes shadcn@3.8.5 add --all --yes

# Move template to workspace root
WORKDIR /home/user
RUN mv next-template/* . && rm -rf next-template

# Expose Next dev port
EXPOSE 3000

# Start sandbox
CMD ["/compile_page.sh"]