# 基于 NewAPI 官方 Dockerfile 修改，适配 Hugging Face Spaces
# 多阶段构建：前端(bun) -> 后端(Go) -> 运行(Alpine)

# ============ 阶段1：构建 Default 前端 ============
FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --frozen-lockfile
COPY ./web/default ./default
COPY ./VERSION /build/VERSION
RUN cd default && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

# ============ 阶段2：构建 Classic 前端 ============
FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder-classic

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --frozen-lockfile
COPY ./web/classic ./classic
COPY ./VERSION /build/VERSION
RUN cd classic && VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

# ============ 阶段3：编译 Go 后端 ============
FROM golang:1.26.1-alpine AS builder2
ENV GO111MODULE=on CGO_ENABLED=0
ENV GOOS=linux GOARCH=amd64

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /build/web/default/dist ./web/default/dist
COPY --from=builder-classic /build/web/classic/dist ./web/classic/dist
RUN go build -ldflags "-s -w" -o new-api

# ============ 阶段4：运行 ============
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/
COPY --from=builder2 /build/new-api .

ENV TZ=Asia/Shanghai
ENV PORT=7860

EXPOSE 7860

ENTRYPOINT ["/root/new-api"]
