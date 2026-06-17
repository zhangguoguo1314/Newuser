/*
Copyright (C) 2025 QuantumNous

Data Backup & Restore component for Classic theme
*/

import React, { useRef, useState } from 'react';
import { Card, Button, Checkbox, Toast } from '@douyinfe/semi-ui';
import { IconDownload, IconUpload } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

const EXPORT_OPTIONS = [
  { key: 'channels', label: '渠道配置 (Channels)', defaultChecked: true },
  { key: 'tokens', label: '令牌配置 (Tokens)', defaultChecked: true },
  { key: 'users', label: '用户数据 (Users)', defaultChecked: true },
  { key: 'models', label: '模型配置 (Models)', defaultChecked: true },
  { key: 'config', label: '系统设置 (System Config)', defaultChecked: true },
];

const SettingsDataBackup = () => {
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selections, setSelections] = useState(
    Object.fromEntries(EXPORT_OPTIONS.map((o) => [o.key, o.defaultChecked]))
  );

  const toggleOption = (key) => {
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllSelected = EXPORT_OPTIONS.every((o) => selections[o.key]);
  const hasAnySelection = EXPORT_OPTIONS.some((o) => selections[o.key]);

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    setSelections(Object.fromEntries(EXPORT_OPTIONS.map((o) => [o.key, checked])));
  };

  const handleExport = async () => {
    if (!hasAnySelection) {
      showError('请至少选择一项要导出的数据');
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      EXPORT_OPTIONS.forEach((o) => {
        params.set(o.key, selections[o.key] ? 'true' : 'false');
      });
      const response = await API.get(`/api/data-export/export?${params.toString()}`, {
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
          将所有渠道、令牌、用户、模型配置和系统设置导出为 JSON 文件。可选择要导出的数据类型。
        </p>
        {/* 选择导出项 */}
        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--semi-color-border)' }}>
            <Checkbox checked={isAllSelected} onChange={handleSelectAll}>
              <strong>全选 / 取消全选</strong>
            </Checkbox>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
            {EXPORT_OPTIONS.map((option) => (
              <Checkbox
                key={option.key}
                checked={selections[option.key]}
                onChange={() => toggleOption(option.key)}
              >
                {option.label}
              </Checkbox>
            ))}
          </div>
        </div>
        <Button
          icon={<IconDownload />}
          loading={exporting}
          onClick={handleExport}
          disabled={!hasAnySelection}
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
