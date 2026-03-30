// app/components/IntakeDropzone.tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AttachedFile {
  name: string
  type: string
  data: string // base64
  preview?: string // object URL for image thumbnails
}

interface IntakeDropzoneProps {
  text: string
  onTextChange: (text: string) => void
  files: AttachedFile[]
  onFilesChange: (files: AttachedFile[]) => void
  disabled?: boolean
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB per file (Claude vision limit)

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:...;base64, prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export type { AttachedFile }

export default function IntakeDropzone({ text, onTextChange, files, onFilesChange, disabled }: IntakeDropzoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: AttachedFile[] = []
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      const data = await fileToBase64(file)
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      newFiles.push({ name: file.name, type: file.type, data, preview })
    }
    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles])
    }
  }, [files, onFilesChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    processFiles(e.dataTransfer.files)
  }, [disabled, processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }, [disabled])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const removeFile = useCallback((index: number) => {
    if (files[index]?.preview) {
      URL.revokeObjectURL(files[index].preview!)
    }
    const updated = files.filter((_, i) => i !== index)
    onFilesChange(updated)
  }, [files, onFilesChange])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on unmount

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea with dropzone overlay */}
      <div
        className="relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          disabled={disabled}
          rows={8}
          placeholder="Paste a customer email, type field notes, drop photos of measurements — whatever you've got"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            background: '#1c1c1a',
            border: `1px solid ${dragOver ? '#fff' : '#2a2a28'}`,
            color: '#fff',
            padding: '0.75rem',
            width: '100%',
            resize: 'vertical',
            transition: 'border-color 0.15s',
          }}
        />
        {dragOver && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '2px dashed #fff' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>
              DROP FILES HERE
            </span>
          </div>
        )}
      </div>

      {/* File picker button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            color: '#888884',
            background: 'transparent',
            border: '1px solid #2a2a28',
            padding: '0.4rem 0.75rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          className="hover:text-white hover:border-white transition-colors"
        >
          + ATTACH PHOTOS / PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        {files.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555552' }}>
            {files.length} file{files.length !== 1 ? 's' : ''} attached
          </span>
        )}
      </div>

      {/* Thumbnail strip */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="relative group"
              style={{
                width: '72px', height: '72px',
                background: '#1c1c1a', border: '1px solid #2a2a28',
                overflow: 'hidden', flexShrink: 0,
              }}
            >
              {file.preview ? (
                <img src={file.preview} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#888884' }}>PDF</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  width: '18px', height: '18px',
                  fontSize: '0.6rem', lineHeight: '18px', textAlign: 'center',
                  border: 'none', cursor: 'pointer',
                }}
              >
                x
              </button>
              <div
                className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'rgba(0,0,0,0.7)', padding: '2px 4px',
                  fontFamily: 'var(--font-mono)', fontSize: '0.4rem', color: '#888884',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
