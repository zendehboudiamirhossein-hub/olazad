'use client'

import { useEffect, useState } from 'react'
import { apiJson } from '@/lib/client-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Package, Plus, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface AppRelease {
  id: string
  version: string
  versionCode: number
  downloadUrl: string
  changelog?: string | null
  minAndroid?: number | null
  isActive: boolean
  forceUpdate: boolean
  releasedAt: string
}

export function ReleasesView() {
  const [releases, setReleases] = useState<AppRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiJson<{ releases: AppRelease[] }>('/api/admin/releases')
      setReleases(data.releases)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function del(id: string) {
    if (!confirm('حذف این نسخه؟')) return
    try {
      await apiJson(`/api/admin/releases/${id}`, { method: 'DELETE' })
      toast.success('نسخه حذف شد')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">نسخه‌های اپلیکیشن</h1>
          <p className="text-muted-foreground mt-1">مدیریت نسخه‌های آزادگرام کلاینت</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="h-4 w-4 ml-2" /> انتشار نسخه جدید
            </Button>
          </DialogTrigger>
          <ReleaseDialog onSaved={() => { setShowAdd(false); load() }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نسخه</TableHead>
                <TableHead className="text-right">کد</TableHead>
                <TableHead className="text-right hidden md:table-cell">تاریخ انتشار</TableHead>
                <TableHead className="text-right">آپدیت اجباری</TableHead>
                <TableHead className="text-right">فعال</TableHead>
                <TableHead className="text-right">لینک</TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    در حال بارگذاری...
                  </TableCell>
                </TableRow>
              ) : releases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    نسخه‌ای منتشر نشده
                  </TableCell>
                </TableRow>
              ) : releases.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">v{r.version}</TableCell>
                  <TableCell className="font-mono text-xs">{r.versionCode}</TableCell>
                  <TableCell className="text-xs hidden md:table-cell">
                    {new Date(r.releasedAt).toLocaleDateString('fa-IR')}
                  </TableCell>
                  <TableCell>
                    {r.forceUpdate
                      ? <span className="text-xs text-rose-600">بله</span>
                      : <span className="text-xs text-muted-foreground">خیر</span>}
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.isActive} disabled />
                  </TableCell>
                  <TableCell>
                    <a
                      href={r.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      دانلود <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" title="حذف نسخه" onClick={() => del(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm">
            <div className="font-medium mb-2">استفاده از کلاینت:</div>
            <p className="text-muted-foreground leading-relaxed">
              کاربران پس از نصب APK آزادگرام، به‌محض اجرای برنامه نسخه‌ی فعلی به‌صورت خودکار بررسی می‌شود.
              در صورت انتشار نسخه با آپدیت اجباری، کاربر تا به‌روزرسانی نتواند وارد شود.
              چنجلاگ در داخل برنامه نمایش داده می‌شود.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReleaseDialog({ onSaved }: { onSaved: () => void }) {
  const [version, setVersion] = useState('1.0.0')
  const [versionCode, setVersionCode] = useState('1')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [changelog, setChangelog] = useState('')
  const [minAndroid, setMinAndroid] = useState('26')
  const [forceUpdate, setForceUpdate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!version || !versionCode || !downloadUrl) {
      toast.error('نسخه، کد و لینک الزامی هستند')
      return
    }
    setSaving(true)
    try {
      await apiJson('/api/admin/releases', {
        method: 'POST',
        body: JSON.stringify({
          version, versionCode: parseInt(versionCode), downloadUrl,
          changelog, minAndroid: parseInt(minAndroid), forceUpdate,
          isActive: true
        })
      })
      toast.success('نسخه منتشر شد')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>انتشار نسخه جدید آزادگرام</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>شماره نسخه</Label>
            <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>کد نسخه (عددی)</Label>
            <Input type="number" value={versionCode} onChange={e => setVersionCode(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>لینک دانلود APK *</Label>
          <Input value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://.../azadgram-1.0.0.apk" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>چنجلاگ (تغییرات)</Label>
          <Textarea value={changelog} onChange={e => setChangelog(e.target.value)} rows={4}
            placeholder="✓ اضافه شدن قابلیت..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>حداقل نسخه اندروید (API)</Label>
            <Input type="number" value={minAndroid} onChange={e => setMinAndroid(e.target.value)} dir="ltr" />
          </div>
          <div className="flex items-center gap-2 pt-7">
            <Switch checked={forceUpdate} onCheckedChange={setForceUpdate} />
            <Label>آپدیت اجباری</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving} className="bg-primary">
          <Package className="h-4 w-4 ml-2" />
          {saving ? 'در حال انتشار...' : 'انتشار'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
