package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ExportData 导出所有数据
type ExportData struct {
	Version      string           `json:"version"`
	ExportTime   int64            `json:"export_time"`
	Channels     []*model.Channel `json:"channels"`
	Tokens       []*model.Token   `json:"tokens"`
	Users        []*model.User    `json:"users"`
	Models       []*model.Model   `json:"models"`
	Options      []*model.Option  `json:"options"`
}

// ImportData 导入数据结构
type ImportData struct {
	Version    string           `json:"version"`
	ExportTime int64            `json:"export_time"`
	Channels   []*model.Channel `json:"channels"`
	Tokens     []*model.Token   `json:"tokens"`
	Users      []*model.User    `json:"users"`
	Models     []*model.Model   `json:"models"`
	Options    []*model.Option  `json:"options"`
}

// ExportAllData 导出所有数据（仅 root 用户可用）
func ExportAllData(c *gin.Context) {
	// 获取当前用户
	user := c.GetString("username")
	if user == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "未登录",
		})
		return
	}

	// 检查是否为 root 用户
	userObj, err := model.GetUserByName(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取用户信息失败",
		})
		return
	}

	if userObj.Role != common.RoleRootUser {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "只有 root 用户可以导出数据",
		})
		return
	}

	// 导出渠道数据
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "导出渠道数据失败: " + err.Error(),
		})
		return
	}

	// 导出令牌数据 - 获取所有用户的所有令牌
	var tokens []*model.Token
	err = model.DB.Find(&tokens).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "导出令牌数据失败: " + err.Error(),
		})
		return
	}

	// 导出用户数据
	pageInfo := &common.PageInfo{Page: 0, PageSize: 0}
	users, _, err := model.GetAllUsers(pageInfo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "导出用户数据失败: " + err.Error(),
		})
		return
	}

	// 导出模型配置数据
	models, err := model.GetAllModels(0, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "导出模型配置数据失败: " + err.Error(),
		})
		return
	}

	// 导出系统设置数据
	options, err := model.AllOption()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "导出系统设置数据失败: " + err.Error(),
		})
		return
	}

	// 构建导出数据
	exportData := ExportData{
		Version:    "1.0",
		ExportTime: time.Now().Unix(),
		Channels:   channels,
		Tokens:     tokens,
		Users:      users,
		Models:     models,
		Options:    options,
	}

	// 生成文件名
	filename := fmt.Sprintf("newapi_backup_%d.json", time.Now().Unix())

	// 设置响应头，触发文件下载
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.JSON(http.StatusOK, exportData)
}

// ImportAllData 导入所有数据（仅 root 用户可用）
func ImportAllData(c *gin.Context) {
	// 获取当前用户
	user := c.GetString("username")
	if user == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "未登录",
		})
		return
	}

	// 检查是否为 root 用户
	userObj, err := model.GetUserByName(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取用户信息失败",
		})
		return
	}

	if userObj.Role != common.RoleRootUser {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "只有 root 用户可以导入数据",
		})
		return
	}

	// 读取上传的文件
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "读取文件失败: " + err.Error(),
		})
		return
	}
	defer file.Close()

	// 读取文件内容
	fileContent, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "读取文件内容失败: " + err.Error(),
		})
		return
	}

	// 解析 JSON
	var importData ImportData
	if err := json.Unmarshal(fileContent, &importData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "解析 JSON 失败: " + err.Error(),
		})
		return
	}

	// 验证数据版本
	if importData.Version == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的数据格式：缺少版本信息",
		})
		return
	}

	// 导入渠道数据
	if len(importData.Channels) > 0 {
		for _, channel := range importData.Channels {
			// 重置 ID，让数据库自动生成
			channel.Id = 0
			if err := model.DB.Create(channel).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "导入渠道数据失败: " + err.Error(),
				})
				return
			}
		}
	}

	// 导入令牌数据
	if len(importData.Tokens) > 0 {
		for _, token := range importData.Tokens {
			// 重置 ID，让数据库自动生成
			token.Id = 0
			if err := model.DB.Create(token).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "导入令牌数据失败: " + err.Error(),
				})
				return
			}
		}
	}

	// 导入用户数据
	if len(importData.Users) > 0 {
		for _, user := range importData.Users {
			// 重置 ID，让数据库自动生成
			user.Id = 0
			if err := model.DB.Create(user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "导入用户数据失败: " + err.Error(),
				})
				return
			}
		}
	}

	// 导入模型配置数据
	if len(importData.Models) > 0 {
		for _, m := range importData.Models {
			// 重置 ID，让数据库自动生成
			m.Id = 0
			if err := model.DB.Create(m).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "导入模型配置数据失败: " + err.Error(),
				})
				return
			}
		}
	}

	// 导入系统设置数据
	if len(importData.Options) > 0 {
		for _, option := range importData.Options {
			// 使用 Save 方法，如果存在则更新，不存在则创建
			if err := model.DB.Save(option).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "导入系统设置数据失败: " + err.Error(),
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "数据导入成功",
		"data": gin.H{
			"channels_count": len(importData.Channels),
			"tokens_count":   len(importData.Tokens),
			"users_count":    len(importData.Users),
			"models_count":   len(importData.Models),
			"options_count":  len(importData.Options),
		},
	})
}
