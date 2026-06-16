import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { unzipSync } from 'fflate'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'

function slugToName(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ')
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export default function VasUploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [dragOver,  setDragOver]  = useState(false)
  const [manifest,  setManifest]  = useState(null)   // parsed upload_manifest.json
  const [imgBlobs,  setImgBlobs]  = useState({})     // storage_path → Blob
  const [parseErr,  setParseErr]  = useState(null)

  // Editable fields
  const [scaleName,   setScaleName]   = useState('')
  const [question,    setQuestion]    = useState('')
  const [anchorLabels, setAnchorLabels] = useState(['','','','','',''])

  // Upload state
  const [uploading,  setUploading]  = useState(false)
  const [uploadMsg,  setUploadMsg]  = useState(null)
  const [uploadErr,  setUploadErr]  = useState(null)

  // Preview (live)
  const [showPreview, setShowPreview] = useState(false)

  function processZip(arrayBuffer) {
    setParseErr(null)
    setManifest(null)
    setImgBlobs({})
    try {
      const data = unzipSync(new Uint8Array(arrayBuffer))

      // Find manifest
      const manifestKey = Object.keys(data).find(k => k.endsWith('upload_manifest.json'))
      if (!manifestKey) throw new Error('upload_manifest.json not found in zip.')
      const mf = JSON.parse(new TextDecoder().decode(data[manifestKey]))

      // Collect images
      const blobs = {}
      const missing = []
      for (const f of mf.files ?? []) {
        const fileKey = Object.keys(data).find(k => k.endsWith(f.local_file.split('/').pop()))
        if (!fileKey) { missing.push(f.local_file); continue }
        blobs[f.storage_path] = new Blob([data[fileKey]], { type: f.mime_type ?? 'image/png' })
      }
      if (missing.length) throw new Error(`Missing files in zip: ${missing.join(', ')}`)

      // Pre-populate fields from slug
      const slug = mf.slug ?? (mf.files?.[0]?.storage_path?.split('/')[1] ?? '')
      const name = slugToName(slug)
      setScaleName(name)
      setQuestion('')
      setAnchorLabels(['','','','','',''])
      setManifest({ ...mf, slug })
      setImgBlobs(blobs)
    } catch (e) {
      setParseErr(e.message)
    }
  }

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => processZip(e.target.result)
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  async function handleUpload() {
    if (!manifest || !scaleName.trim() || !question.trim()) return
    setUploading(true)
    setUploadErr(null)
    setUploadMsg(null)

    try {
      const slug = slugify(scaleName)
      const anchors = []

      // Upload each image and build anchors
      for (let i = 0; i < manifest.files.length; i++) {
        const f    = manifest.files[i]
        const blob = imgBlobs[f.storage_path]
        if (!blob) throw new Error(`Image missing: ${f.storage_path}`)

        setUploadMsg(`Uploading image ${i + 1} of ${manifest.files.length}…`)
        const { error: upErr } = await supabase.storage
          .from('public-assets')
          .upload(f.storage_path, blob, { contentType: 'image/png', upsert: true })
        if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(f.storage_path)

        anchors.push({
          value:     i + 1,
          label:     anchorLabels[i]?.trim() || `Level ${i + 1}`,
          emoji_url: publicUrl,
        })
      }

      setUploadMsg('Saving scale…')

      // Insert vas_scales
      const { data: { user } } = await supabase.auth.getUser()
      const { data: scaleRow, error: scaleErr } = await supabase
        .from('vas_scales')
        .insert({
          slug,
          question: question.trim(),
          scale_type: 'emoji_6',
          anchors,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (scaleErr) throw new Error(`Scale insert failed: ${scaleErr.message}`)

      // Insert activities row
      const { error: actErr } = await supabase.from('activities').insert({
        category:    'vas',
        subcategory: `vas_${slug}`,
        label:       `VAS – ${scaleName.trim()}`,
        description: question.trim(),
      })
      if (actErr) console.warn('activities insert:', actErr.message)

      navigate('/admin/vas')
    } catch (e) {
      setUploadErr(e.message)
    } finally {
      setUploading(false)
      setUploadMsg(null)
    }
  }

  const canUpload = manifest && scaleName.trim() && question.trim() && !uploading

  // Build a preview scale object from current form state
  const previewScale = manifest ? {
    id:         '__preview__',
    slug:       slugify(scaleName),
    question:   question || 'Preview question',
    scale_type: 'emoji_6',
    anchors:    (manifest.files ?? []).map((f, i) => ({
      value:     i + 1,
      label:     anchorLabels[i] || `Level ${i + 1}`,
      emoji_url: imgBlobs[f.storage_path]
        ? URL.createObjectURL(imgBlobs[f.storage_path])
        : '',
    })),
  } : null

  return (
    <div>
      <h1 style={S.h1}>Upload Rating Scale</h1>
      <p style={S.sub}>Drop a <code style={S.code}>vas_scale_{'{slug}'}.zip</code> file produced by the VAS skill.</p>

      {/* Drop zone */}
      {!manifest && (
        <div
          style={{
            ...S.dropzone,
            borderColor: dragOver ? 'var(--pk)' : 'var(--bd)',
            background:  dragOver ? 'var(--bgp)' : '#fff',
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <span style={S.dropIcon}>📦</span>
          <p style={S.dropText}>Drop zip here or click to browse</p>
          <input
            ref={inputRef}
            type="file" accept=".zip"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {parseErr && <p style={S.errMsg}>{parseErr}</p>}

      {/* Form */}
      {manifest && (
        <div style={S.form}>
          <div style={S.formHeader}>
            <p style={S.formMeta}>
              <span style={S.chip}>{manifest.slug}</span>
              <span style={S.metaText}>{manifest.files.length} images found</span>
            </p>
            <button style={S.resetBtn} onClick={() => setManifest(null)}>✕ Choose different file</button>
          </div>

          <label style={S.label}>Scale name *</label>
          <input style={S.input} value={scaleName} onChange={e => setScaleName(e.target.value)} placeholder="e.g. Stress" />

          <label style={{ ...S.label, marginTop: 14 }}>Question *</label>
          <input style={S.input} value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Right now, how stressed are you feeling?" />

          <label style={{ ...S.label, marginTop: 14 }}>Anchor labels</label>
          <div style={S.anchorsGrid}>
            {(manifest.files ?? []).map((f, i) => (
              <div key={i} style={S.anchorCell}>
                {imgBlobs[f.storage_path] && (
                  <img
                    src={URL.createObjectURL(imgBlobs[f.storage_path])}
                    alt={`Level ${i+1}`}
                    style={S.thumbImg}
                  />
                )}
                <input
                  style={S.anchorInput}
                  value={anchorLabels[i]}
                  onChange={e => {
                    const next = [...anchorLabels]
                    next[i] = e.target.value
                    setAnchorLabels(next)
                  }}
                  placeholder={`Level ${i + 1}`}
                />
              </div>
            ))}
          </div>

          {/* Live preview toggle */}
          <button style={S.previewToggle} onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'Hide preview' : '▶ Preview scale'}
          </button>

          {showPreview && previewScale && (
            <div style={S.previewWrap}>
              <VasRenderer
                scale={previewScale}
                previewMode
                onComplete={() => setShowPreview(false)}
              />
            </div>
          )}

          {uploadMsg && <p style={S.uploadMsg}>{uploadMsg}</p>}
          {uploadErr && <p style={S.errMsg}>{uploadErr}</p>}

          <div style={S.actions}>
            <button
              style={{ ...S.uploadBtn, opacity: canUpload ? 1 : 0.45 }}
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {uploading ? 'Uploading…' : 'Upload Scale'}
            </button>
            <button style={S.cancelBtn} onClick={() => navigate('/admin/vas')}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  h1:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:  { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px' },
  code: { fontFamily: '"Space Mono",monospace', fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 },

  dropzone: {
    border: '2px dashed', borderRadius: 14, padding: '48px 32px',
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
    marginBottom: 20,
  },
  dropIcon: { fontSize: 36, display: 'block', marginBottom: 12 },
  dropText: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, color: 'var(--tx2)', margin: 0 },

  form: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 22px' },
  formHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  formMeta: { display: 'flex', alignItems: 'center', gap: 10, margin: 0 },
  chip:     { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--bgp)', color: 'var(--pk)', border: '1px solid var(--pkb)', borderRadius: 5, padding: '2px 7px' },
  metaText: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  resetBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },

  label: { display: 'block', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input: { width: '100%', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', boxSizing: 'border-box' },

  anchorsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 20 },
  anchorCell:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  thumbImg:     { width: 52, height: 52, objectFit: 'contain', borderRadius: 6 },
  anchorInput:  { width: '100%', fontSize: 11, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 6, padding: '4px 6px', textAlign: 'center', boxSizing: 'border-box' },

  previewToggle: { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', marginBottom: 16 },
  previewWrap:   { border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },

  uploadMsg: { fontSize: 13, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '8px 0' },
  errMsg:    { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: '12px 0' },

  actions:   { display: 'flex', gap: 10, marginTop: 8 },
  uploadBtn: { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
