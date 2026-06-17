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

// ============================================================
// 数据导出导入功能
// 仅 root 用户可用
// 导出：GET /api/data-export/export -> 下载分类清晰的 JSON 文件
// 导入：POST /api/data-export/import -> 上传 JSON 文件一键恢复
// ============================================================

// Section 数据分区结构，每个分区有标题、说明和数据
type Section struct {
	Title       string      `json:"title"`       // 分区标题
	Description string      `json:"description"` // 分区说明
	Count       int         `json:"count"`       // 数据条数
	Data        interface{} `json:"data"`        // 数据内容
}

// ExportFile 导出文件结构，分类清晰
type ExportFile struct {
	// 文件头信息
	Meta struct {
		Version     string `json:"version"`      // 数据格式版本
		ProductName string `json:"product_name"` // 产品名称
		ExportTime  string `json:"export_time"`  // 导出时间（可读格式）
		ExportedBy  string `json:"exported_by"`  // 导出者
		TotalItems  int    `json:"total_items"`  // 总数据条数
	} `json:"meta"`

	// 各数据分区
	Channels     Section `json:"channels"`      // 渠道配置
	Tokens       Section `json:"tokens"`        // 令牌配置
	Users        Section `json:"users"`         // 用户数据
	Models       Section `json:"models"`        // 模型配置
	SystemConfig Section `json:"system_config"` // 系统设置
}

// ImportFile 导入文件结构（与导出一致）
type ImportFile struct {
	Meta         struct {
		Version     string `json:"version"`
		ProductName string `json:"product_name"`
		ExportTime  string `json:"export_time"`
		ExportedBy  string `json:"exported_by"`
		TotalItems  int    `json:"total_items"`
	} `json:"meta"`
	Channels     Section `json:"channels"`
	Tokens       Section `json:"tokens"`
	Users        Section `json:"users"`
	Models       Section `json:"models"`
	SystemConfig Section `json:"system_config"`
}

// ExportAllData 导出所有数据为分类清晰的 JSON 文件
func ExportAllData(c *gin.Context) {
	// 1. 权限验证
	user := c.GetString("username")
	if user == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "未登录",
		})
		return
	}

	// 使用 ValidateAndFill 验证并获取用户信息
	userObj := model.User{Username: user}
	err := userObj.ValidateAndFill()
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

	// 2. 解析导出选项（支持选择性导出）
	// 前端通过 query 参数指定要导出的数据类型，默认全部导出
	exportChannels := c.DefaultQuery("channels", "true") == "true"
	exportTokens := c.DefaultQuery("tokens", "true") == "true"
	exportUsers := c.DefaultQuery("users", "true") == "true"
	exportModels := c.DefaultQuery("models", "true") == "true"
	exportConfig := c.DefaultQuery("config", "true") == "true"

	// 如果什么都没选，返回错误
	if !exportChannels && !exportTokens && !exportUsers && !exportModels && !exportConfig {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请至少选择一项要导出的数据",
		})
		return
	}

	// 3. 逐项导出数据
	exportFile := ExportFile{}

	// 填充文件头
	exportFile.Meta.Version = "1.0"
	exportFile.Meta.ProductName = "NewAPI"
	exportFile.Meta.ExportTime = time.Now().Format("2006-01-02 15:04:05")
	exportFile.Meta.ExportedBy = user

	// --- 渠道数据 ---
	if exportChannels {
		channels, err := model.GetAllChannels(0, 0, true, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "导出渠道数据失败: " + err.Error(),
			})
			return
		}
		exportFile.Channels = Section{
			Title:       "渠道配置 (Channels)",
			Description: "所有 API 渠道的配置信息，包括上游 API 地址、密钥、模型列表、模型映射等",
			Count:       len(channels),
			Data:        channels,
		}
		exportFile.Meta.TotalItems += len(channels)
	}

	// --- 令牌数据 ---
	if exportTokens {
		var tokens []*model.Token
		err = model.DB.Find(&tokens).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "导出令牌数据失败: " + err.Error(),
			})
			return
		}
		exportFile.Tokens = Section{
			Title:       "令牌配置 (Tokens)",
			Description: "所有 API 令牌的配置信息，包括额度限制、模型限制、IP 限制、分组等",
			Count:       len(tokens),
			Data:        tokens,
		}
		exportFile.Meta.TotalItems += len(tokens)
	}

	// --- 用户数据 ---
	if exportUsers {
		pageInfo := &common.PageInfo{Page: 0, PageSize: 0}
		users, _, err := model.GetAllUsers(pageInfo)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "导出用户数据失败: " + err.Error(),
			})
			return
		}
		exportFile.Users = Section{
			Title:       "用户数据 (Users)",
			Description: "所有用户的基本信息，包括用户名、角色、额度、分组等（密码已脱敏）",
			Count:       len(users),
			Data:        users,
		}
		exportFile.Meta.TotalItems += len(users)
	}

	// --- 模型配置 ---
	if exportModels {
		models, err := model.GetAllModels(0, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "导出模型配置失败: " + err.Error(),
			})
			return
		}
		exportFile.Models = Section{
			Title:       "模型配置 (Models)",
			Description: "所有模型的配置信息，包括模型名称、描述、标签、状态、绑定渠道等",
			Count:       len(models),
			Data:        models,
		}
		exportFile.Meta.TotalItems += len(models)
	}

	// --- 系统设置 ---
	if exportConfig {
		options, err := model.AllOption()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "导出系统设置失败: " + err.Error(),
			})
			return
		}
		exportFile.SystemConfig = Section{
			Title:       "系统设置 (System Config)",
			Description: "所有系统配置项，包括注册设置、邮件设置、支付设置、界面设置等",
			Count:       len(options),
			Data:        options,
		}
		exportFile.Meta.TotalItems += len(options)
	}

	// 3. 生成文件并下载
	filename := fmt.Sprintf("newapi_backup_%s.json", time.Now().Format("20060102_150405"))

	// 使用 json.MarshalIndent 生成格式化的 JSON（带缩进，方便阅读）
	jsonBytes, err := json.MarshalIndent(exportFile, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "生成 JSON 失败: " + err.Error(),
		})
		return
	}

	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/json; charset=utf-8", jsonBytes)
}

// ImportAllData 导入 JSON 文件，一键恢复所有数据
func ImportAllData(c *gin.Context) {
	// 1. 权限验证
	user := c.GetString("username")
	if user == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "未登录",
		})
		return
	}

	// 使用 ValidateAndFill 验证并获取用户信息
	userObj := model.User{Username: user}
	err := userObj.ValidateAndFill()
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

	// 2. 读取上传的文件
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "读取文件失败，请确保上传了 JSON 文件: " + err.Error(),
		})
		return
	}
	defer file.Close()

	fileContent, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "读取文件内容失败: " + err.Error(),
		})
		return
	}

	// 3. 解析 JSON
	var importFile ImportFile
	if err := json.Unmarshal(fileContent, &importFile); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "解析 JSON 失败，请检查文件格式是否正确: " + err.Error(),
		})
		return
	}

	// 4. 验证文件格式
	if importFile.Meta.Version == "" || importFile.Meta.ProductName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的备份文件：缺少版本信息或产品标识",
		})
		return
	}

	// 5. 逐项导入数据
	result := gin.H{}

	// --- 导入渠道 ---
	if importFile.Channels.Count > 0 && importFile.Channels.Data != nil {
		dataBytes, _ := json.Marshal(importFile.Channels.Data)
		var channels []*model.Channel
		if err := json.Unmarshal(dataBytes, &channels); err == nil {
			count := 0
			for _, channel := range channels {
				channel.Id = 0 // 重置 ID
				if err := model.DB.Create(channel).Error; err == nil {
					count++
				}
			}
			result["channels"] = fmt.Sprintf("成功导入 %d 个渠道", count)
		} else {
			result["channels"] = "导入失败: " + err.Error()
		}
	} else {
		result["channels"] = "跳过（无数据）"
	}

	// --- 导入令牌 ---
	if importFile.Tokens.Count > 0 && importFile.Tokens.Data != nil {
		dataBytes, _ := json.Marshal(importFile.Tokens.Data)
		var tokens []*model.Token
		if err := json.Unmarshal(dataBytes, &tokens); err == nil {
			count := 0
			for _, token := range tokens {
				token.Id = 0
				if err := model.DB.Create(token).Error; err == nil {
					count++
				}
			}
			result["tokens"] = fmt.Sprintf("成功导入 %d 个令牌", count)
		} else {
			result["tokens"] = "导入失败: " + err.Error()
		}
	} else {
		result["tokens"] = "跳过（无数据）"
	}

	// --- 导入用户 ---
	if importFile.Users.Count > 0 && importFile.Users.Data != nil {
		dataBytes, _ := json.Marshal(importFile.Users.Data)
		var users []*model.User
		if err := json.Unmarshal(dataBytes, &users); err == nil {
			count := 0
			for _, u := range users {
				u.Id = 0
				if err := model.DB.Create(u).Error; err == nil {
					count++
				}
			}
			result["users"] = fmt.Sprintf("成功导入 %d 个用户", count)
		} else {
			result["users"] = "导入失败: " + err.Error()
		}
	} else {
		result["users"] = "跳过（无数据）"
	}

	// --- 导入模型配置 ---
	if importFile.Models.Count > 0 && importFile.Models.Data != nil {
		dataBytes, _ := json.Marshal(importFile.Models.Data)
		var models []*model.Model
		if err := json.Unmarshal(dataBytes, &models); err == nil {
			count := 0
			for _, m := range models {
				m.Id = 0
				if err := model.DB.Create(m).Error; err == nil {
					count++
				}
			}
			result["models"] = fmt.Sprintf("成功导入 %d 个模型配置", count)
		} else {
			result["models"] = "导入失败: " + err.Error()
		}
	} else {
		result["models"] = "跳过（无数据）"
	}

	// --- 导入系统设置 ---
	if importFile.SystemConfig.Count > 0 && importFile.SystemConfig.Data != nil {
		dataBytes, _ := json.Marshal(importFile.SystemConfig.Data)
		var options []*model.Option
		if err := json.Unmarshal(dataBytes, &options); err == nil {
			count := 0
			for _, option := range options {
				if err := model.DB.Save(option).Error; err == nil {
					count++
				}
			}
			result["system_config"] = fmt.Sprintf("成功导入 %d 个系统设置", count)
		} else {
			result["system_config"] = "导入失败: " + err.Error()
		}
	} else {
		result["system_config"] = "跳过（无数据）"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "数据导入完成",
		"source": fmt.Sprintf("来自 %s 的备份（导出时间：%s）", importFile.Meta.ExportedBy, importFile.Meta.ExportTime),
		"details": result,
	})
}
