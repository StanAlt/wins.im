'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SITE_URL, type WheelRow, type ProfileRow } from '@/lib/constants'
import { nanoid } from 'nanoid'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [wheels, setWheels] = useState<WheelRow[]>([])
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [profileRes, wheelsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wheels').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (wheelsRes.data) setWheels(wheelsRes.data)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  const handleCreate = async () => {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slug = nanoid(8)
    const { data, error } = await supabase
      .from('wheels')
      .insert({ admin_id: user.id, title: 'My Wheel', slug })
      .select()
      .single()

    if (data && !error) {
      router.push(`/dashboard/wheel/${data.id}`)
    }
    setCreating(false)
  }

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      return
    }
    await supabase.from('wheels').delete().eq('id', id)
    setWheels(wheels.filter(w => w.id !== id))
    setDeleteConfirm(null)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirm(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${SITE_URL}/w/${slug}`)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
          <div className="text-white/40 text-sm">Loading your wheels...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto border-b border-white/[0.06]">
        <h1
          className="text-2xl font-bold cursor-pointer"
          style={{ fontFamily: 'var(--font-display)' }}
          onClick={() => router.push('/')}
        >
          <span className="text-white">wins</span>
          <span style={{ color: 'var(--color-orange)' }}>.im</span>
        </h1>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-sm text-white/60">{profile.display_name}</span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            Your Wheels
          </h2>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-3 rounded-full font-semibold text-white transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-glow-orange)' }}
          >
            {creating ? 'Creating...' : 'Create New Wheel'}
          </button>
        </div>

        {wheels.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl border border-white/[0.06]"
            style={{ background: 'var(--gradient-card)' }}
          >
            <div className="text-5xl mb-4">🎡</div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Create your first wheel
            </h3>
            <p className="text-white/50 text-sm">Click the button above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wheels.map((wheel) => (
              <div
                key={wheel.id}
                className="p-5 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
                style={{ background: 'var(--gradient-card)' }}
                onClick={() => router.push(`/dashboard/wheel/${wheel.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                    {wheel.title}
                  </h3>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor:
                        wheel.status === 'open' ? 'rgba(34,197,94,0.15)' :
                        wheel.status === 'completed' ? 'rgba(255,107,44,0.15)' :
                        wheel.status === 'spinning' ? 'rgba(139,92,246,0.15)' :
                        'rgba(255,255,255,0.1)',
                      color:
                        wheel.status === 'open' ? '#22C55E' :
                        wheel.status === 'completed' ? '#FF6B2C' :
                        wheel.status === 'spinning' ? '#8B5CF6' :
                        'rgba(255,255,255,0.5)',
                    }}
                  >
                    {wheel.status}
                  </span>
                </div>
                {wheel.prize_description && (
                  <p className="text-sm text-white/40 mb-3">{wheel.prize_description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span>{new Date(wheel.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => copyLink(wheel.slug)}
                    className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/60 transition-colors cursor-pointer"
                  >
                    {copiedSlug === wheel.slug ? 'Copied!' : 'Copy link'}
                  </button>
                  {deleteConfirm === wheel.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(wheel.id)}
                        className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-medium transition-colors cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="text-xs px-3 py-1 rounded-full bg-white/5 text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDelete(wheel.id)}
                      className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
