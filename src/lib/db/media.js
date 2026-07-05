import { isSupabaseConfigured, requireSupabase } from '../supabase.js'
import { memoryUploadMedia } from '../intake/memoryStore.js'

function extForMime(mime) {
  if (!mime) return 'bin'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'bin'
}

export async function uploadMedia(intakeId, { kind, file, textContent, durationSeconds }) {
  if (!isSupabaseConfigured) {
    return memoryUploadMedia(intakeId, { kind, file, textContent, durationSeconds })
  }
  const sb = requireSupabase()

  if (kind === 'text') {
    const { data, error } = await sb
      .from('intake_media')
      .insert({
        intake_id: intakeId,
        kind: 'text',
        text_content: textContent,
        mime_type: 'text/plain',
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  const mediaId = crypto.randomUUID()
  const ext = extForMime(file.type)
  const storagePath = `${intakeId}/${mediaId}.${ext}`

  const { error: uploadError } = await sb.storage.from('intake-media').upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await sb
    .from('intake_media')
    .insert({
      intake_id: intakeId,
      kind,
      storage_path: storagePath,
      mime_type: file.type,
      duration_seconds: durationSeconds ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
