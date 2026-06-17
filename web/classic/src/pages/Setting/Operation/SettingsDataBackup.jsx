/*
Copyright (C) 2025 QuantumNous

Data Backup & Restore component for Classic theme
*/

import React, { useRef, useState } from 'react';
import { Card, Button, Spin, Toast } from '@douyinfe/semi-ui';
import { IconDownload, IconUpload } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

const SettingsDataBackup = () => {
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await API.get('/api/data-export/export', {
        responseType: 'blob',
      });
      if (response.status !== 200) {
        showError('导出失败');
        return;
      }
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newapi_backup_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess('数据导出成功');
    } catch (error) {
      showError('数据导出失败：' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      showError('请先选择要导入的 JSON 文件');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await API.post('/api/data-export/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { success, message, details } = res.data;
      if (success) {
        const parts = [
          details?.channels || '',
          details?.tokens || '',
          details?.users || '',
          details?.models || '',
          details?.system_config || '',
        ].filter(Boolean).join('，');
        showSuccess('数据导入成功：' + parts);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        showError(message || '导入失败');
      }
    } catch (error) {
      showError('数据导入失败：' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 导出 */}
      <Card title="导出数据">
        <p style={{ color: 'var(--semi-color-text-2)', marginBottom: '12px' }}>
          将所有渠道、令牌、用户、模型配置和系统设置导出为 JSON 文件。导出的文件结构清晰，按分类组织，方便阅读和编辑。
        </p>
        <Button
          icon={<IconDownload />}
          loading={exporting}
          onClick={handleExport}
          theme="solid"
        >
          {exporting ? '正在导出...' : '导出备份文件'}
        </Button>
      </Card>

      {/* 导入 */}
      <Card title="导入数据">
        <p style={{ color: 'var(--semi-color-text-2)', marginBottom: '12px' }}>
          上传之前导出的 JSON 备份文件，一键恢复所有数据。导入的数据会追加到现有数据中（不会覆盖）。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'block', marginBottom: '12px' }}
        />
        <Button
          icon={<IconUpload />}
          loading={importing}
          onClick={handleImport}
          theme="solid"
          style={{ marginTop: '8px' }}
        >
          {importing ? '正在导入...' : '导入备份文件'}
        </Button>
      </Card>
    </div>
  );
};

export default SettingsDataBackup;
