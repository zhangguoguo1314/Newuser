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
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SettingsSection } from '../components/settings-section'

type ExportOption = {
  key: string
  labelKey: string
  defaultChecked: boolean
}

const EXPORT_OPTIONS: ExportOption[] = [
  { key: 'channels', labelKey: 'settings.operations.dataBackup.optChannels', defaultChecked: true },
  { key: 'tokens', labelKey: 'settings.operations.dataBackup.optTokens', defaultChecked: true },
  { key: 'users', labelKey: 'settings.operations.dataBackup.optUsers', defaultChecked: true },
  { key: 'models', labelKey: 'settings.operations.dataBackup.optModels', defaultChecked: true },
  { key: 'config', labelKey: 'settings.operations.dataBackup.optConfig', defaultChecked: true },
]

export function DataBackupSection() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportSelections, setExportSelections] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPORT_OPTIONS.map((o) => [o.key, o.defaultChecked]))
  )

  const toggleExportOption = (key: string) => {
    setExportSelections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectAll = () => {
    const allSelected = EXPORT_OPTIONS.every((o) => exportSelections[o.key])
    const newValue = !allSelected
    setExportSelections(Object.fromEntries(EXPORT_OPTIONS.map((o) => [o.key, newValue])))
  }

  const isAllSelected = EXPORT_OPTIONS.every((o) => exportSelections[o.key])
  const hasAnySelection = EXPORT_OPTIONS.some((o) => exportSelections[o.key])

  // 导出数据
  const handleExport = async () => {
    if (!hasAnySelection) {
      toast.error(t('settings.operations.dataBackup.selectAtLeastOne'))
      return
    }
    setExporting(true)
    try {
      const params = new URLSearchParams()
      EXPORT_OPTIONS.forEach((o) => {
        params.set(o.key, exportSelections[o.key] ? 'true' : 'false')
      })
      const response = await api.get(`/api/data-export/export?${params.toString()}`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/json' })
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
      const msg = error?.response?.data?.message || error.message || t('settings.operations.dataBackup.exportFailed')
      toast.error(msg)
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
      const response = await api.post('/api/data-export/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = response.data
      if (data.success) {
        const parts = [
          data.details?.channels || '',
          data.details?.tokens || '',
          data.details?.users || '',
          data.details?.models || '',
          data.details?.system_config || '',
        ].filter(Boolean).join(', ')
        toast.success(`${t('settings.operations.dataBackup.importSuccess')}${parts ? ': ' + parts : ''}`)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        toast.error(data.message || t('settings.operations.dataBackup.importFailed'))
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || t('settings.operations.dataBackup.importFailed')
      toast.error(msg)
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
            {/* 选择导出项 */}
            <div className="mb-4 space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="export-select-all"
                  checked={isAllSelected}
                  onCheckedChange={selectAll}
                />
                <Label htmlFor="export-select-all" className="text-sm font-medium cursor-pointer">
                  {t('settings.operations.dataBackup.selectAll')}
                </Label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXPORT_OPTIONS.map((option) => (
                  <div key={option.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`export-${option.key}`}
                      checked={exportSelections[option.key]}
                      onCheckedChange={() => toggleExportOption(option.key)}
                    />
                    <Label htmlFor={`export-${option.key}`} className="text-sm cursor-pointer">
                      {t(option.labelKey)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleExport} disabled={exporting || !hasAnySelection}>
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
