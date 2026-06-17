# 使用 Go 1.21 作为构建环境
FROM golang:1.21-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache git gcc musl-dev sqlite-dev

# 设置工作目录
WORKDIR /app

# 复制 go.mod 和 go.sum
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 编译（禁用 CGO，静态链接）
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o new-api main.go

# 使用轻量级镜像运行
FROM alpine:latest

# 安装 ca-certificates 用于 HTTPS
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# 从 builder 复制编译好的二进制文件
COPY --from=builder /app/new-api .

# 设置时区
ENV TZ=Asia/Shanghai

# Hugging Face Spaces 要求暴露 7860 端口
ENV PORT=7860

# 暴露端口
EXPOSE 7860

# 启动命令
CMD ["./new-api"]
