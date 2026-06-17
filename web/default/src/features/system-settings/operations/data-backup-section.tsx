/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsSection } from '../components/settings-section'

export function DataBackupSection() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // 导出数据
  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/data-export/export', {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || '导出失败')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `newapi_backup_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '')}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(t('settings.operations.dataBackup.exportSuccess'))
    } catch (error: any) {
      toast.error(error.message || t('settings.operations.dataBackup.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  // 导入数据
  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error(t('settings.operations.dataBackup.selectFile'))
      return
    }

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/data-export/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || '导入失败')
      }
      toast.success(
        `${t('settings.operations.dataBackup.importSuccess')}: ${data.details?.channels || ''} ${data.details?.tokens || ''} ${data.details?.users || ''} ${data.details?.models || ''} ${data.details?.system_config || ''}`
      )
      // 清空文件选择
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      toast.error(error.message || t('settings.operations.dataBackup.importFailed'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <SettingsSection title={t('settings.operations.dataBackup.title')}>
      <div className="flex flex-col gap-4">
        {/* 导出 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              {t('settings.operations.dataBackup.exportTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('settings.operations.dataBackup.exportDescription')}
            </p>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting
                ? t('settings.operations.dataBackup.exporting')
                : t('settings.operations.dataBackup.exportButton')}
            </Button>
          </CardContent>
        </Card>

        {/* 导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              {t('settings.operations.dataBackup.importTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('settings.operations.dataBackup.importDescription')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="mb-3 block w-full max-w-sm text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
            <Button onClick={handleImport} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              {importing
                ? t('settings.operations.dataBackup.importing')
                : t('settings.operations.dataBackup.importButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SettingsSection>
  )
}
