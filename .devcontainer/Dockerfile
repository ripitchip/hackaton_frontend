FROM mcr.microsoft.com/devcontainers/typescript-node:latest

# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspaces
