import React, { useState } from 'react'
import { useStore } from '../store'
import { exportJSON, importJSON } from '../utils/exportImport'
import type { Project } from '../types'

const S_TOKEN  = 'nf:cloud_token'
const S_GIST   = 'nf:cloud_gist_id'
const S_PUSHED = 'nf:cloud_last_push'
const S_PULLED = 'nf:cloud_last_pull'
const FILENAME = 'narrative-flow-save.json'

interface Props { onClose: () => void }
type Status = 'idle' | 'busy' | 'ok' | 'error'

export default function CloudSync({ onClose }: Props) {
  const { project, isDirty } = useStore(s => ({ project: s.project, isDirty: s.isDirty }))
  const loadProject = useStore(s => s.loadProject)

  const [token,    setToken]    = useState(() => localStorage.getItem(S_TOKEN)  ?? '')
  const [gistId,   setGistId]   = useState(() => localStorage.getItem(S_GIST)   ?? '')
  const [lastPush, setLastPush] = useState(() => localStorage.getItem(S_PUSHED) ?? '')
  const [lastPull, setLastPull] = useState(() => localStorage.getItem(S_PULLED) ?? '')
  const [status,   setStatus]   = useState<Status>('idle')
  const [msg,      setMsg]      = useState('')

  function persistToken(t: string)  { setToken(t);  localStorage.setItem(S_TOKEN, t) }
  function persistGist(id: string)  { setGistId(id); localStorage.setItem(S_GIST, id) }

  async function gistRequest(method: string, url: string, body?: object) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization:  `Bearer ${token}`,
        Accept:         'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  async function handlePush() {
    if (!token) { setMsg('Enter a GitHub Personal Access Token first.'); setStatus('error'); return }
    setStatus('busy'); setMsg('Pushing to GitHub Gist…')
    try {
      const json = exportJSON(project)
      const body = {
        description: `Narrative Flow — ${project.name}`,
        public: false,
        files: { [FILENAME]: { content: json } }
      }
      let data: any
      if (gistId) {
        data = await gistRequest('PATCH', `https://api.github.com/gists/${gistId}`, body)
      } else {
        data = await gistRequest('POST', 'https://api.github.com/gists', body)
      }
      persistGist(data.id)
      const ts = new Date().toLocaleString()
      setLastPush(ts); localStorage.setItem(S_PUSHED, ts)
      setStatus('ok')
      setMsg(`Saved to Gist ${data.id}`)
    } catch (e: any) {
      setStatus('error'); setMsg(e.message ?? String(e))
    }
  }

  async function handlePull() {
    if (!token) { setMsg('Enter a GitHub Personal Access Token first.'); setStatus('error'); return }
    if (!gistId) { setMsg('No Gist ID — push first or paste a Gist ID below.'); setStatus('error'); return }
    if (isDirty && !confirm('You have unsaved changes. Overwrite with the cloud version?')) return
    setStatus('busy'); setMsg('Pulling from GitHub Gist…')
    try {
      const data: any = await gistRequest('GET', `https://api.github.com/gists/${gistId}`)
      const content = data.files?.[FILENAME]?.content
      if (!content) throw new Error(`"${FILENAME}" not found in Gist — did you push from Narrative Flow?`)
      const parsed = importJSON(content)
      if (!parsed) throw new Error('File is not a valid Narrative Flow project.')
      loadProject(parsed as Project)
      const ts = new Date().toLocaleString()
      setLastPull(ts); localStorage.setItem(S_PULLED, ts)
      setStatus('ok'); setMsg('Project loaded from cloud.')
    } catch (e: any) {
      setStatus('error'); setMsg(e.message ?? String(e))
    }
  }

  const statusColor = status === 'error' ? '#d04040' : status === 'ok' ? '#40a060' : '#9aa5bb'
  const statusBg    = status === 'error' ? '#2a0f0f' : status === 'ok' ? '#0f2a18' : '#1a2032'
  const statusIcon  = status === 'busy'  ? '⏳' : status === 'ok' ? '✓' : '✖'

  return (
    <div className="overlay">
      <div style={{
        background: '#1a2032', border: '1px solid #2a3448', borderRadius: 8,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', width: 500, padding: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3448', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8ecf4' }}>☁ Cloud Sync</div>
            <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 2 }}>Sync via GitHub Gist · private · no server needed</div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Token */}
          <div>
            <label className="field-label">GitHub Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={e => persistToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 4, lineHeight: 1.5 }}>
              Create one at <strong style={{ color: '#4a80d4' }}>github.com/settings/tokens</strong> → "Generate new token (classic)" → tick <strong>gist</strong> scope only. Stored locally in this browser.
            </div>
          </div>

          {/* Gist ID */}
          <div>
            <label className="field-label">Gist ID</label>
            <input
              value={gistId}
              onChange={e => persistGist(e.target.value)}
              placeholder="Auto-filled after first push — or paste an existing Gist ID"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
            {gistId && (
              <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 4 }}>
                Gist URL:{' '}
                <span
                  style={{ color: '#4a80d4', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => navigator.clipboard?.writeText(`https://gist.github.com/${gistId}`)}
                  title="Click to copy"
                >
                  gist.github.com/{gistId}
                </span>
              </div>
            )}
          </div>

          {/* Status */}
          {msg && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: statusBg, color: statusColor,
              border: `1px solid ${statusColor}40`
            }}>
              {statusIcon} {msg}
            </div>
          )}

          {/* Last sync times */}
          {(lastPush || lastPull) && (
            <div style={{ display: 'flex', gap: 20, fontSize: 11, color: '#5e6e8a' }}>
              {lastPush && <span>↑ Last push: {lastPush}</span>}
              {lastPull && <span>↓ Last pull: {lastPull}</span>}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, fontSize: 13 }}
              disabled={status === 'busy' || !token}
              onClick={handlePush}
            >↑ Push to Cloud</button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1, fontSize: 13 }}
              disabled={status === 'busy' || !token || !gistId}
              onClick={handlePull}
            >↓ Pull from Cloud</button>
          </div>

          {/* Mobile / phone hint */}
          <div style={{
            background: '#161b27', border: '1px solid #2a3448', borderRadius: 6,
            padding: '12px 14px', fontSize: 11, color: '#5e6e8a', lineHeight: 1.7
          }}>
            <div style={{ color: '#9aa5bb', fontWeight: 700, marginBottom: 6 }}>📱 Playing on your phone</div>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: '#9aa5bb' }}>Option A — HTML export:</strong> Click <em>HTML Export</em> in the toolbar → save the .html file → transfer it to your phone (AirDrop, Google Drive, email) → open in mobile browser. Fully offline, no account needed.
            </div>
            <div>
              <strong style={{ color: '#9aa5bb' }}>Option B — Shared Gist:</strong> Push here, then open the Gist URL on your phone and save the raw JSON. You can load it back in Narrative Flow on any device.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
