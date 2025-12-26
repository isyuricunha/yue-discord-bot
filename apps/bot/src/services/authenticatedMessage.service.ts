import crypto from 'node:crypto'

import axios from 'axios'
import type { Message, User } from 'discord.js'
import { AttachmentBuilder } from 'discord.js'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import extractChunks from 'png-chunks-extract'
import encodeChunks from 'png-chunks-encode'
import textChunk from 'png-chunk-text'

import { CONFIG } from '../config'

type signed_payload = {
  v: 1
  guildId: string | null
  channelId: string | null
  messageId: string
  authorId: string
  createdAt: string
  contentPreview: string | null
  requestedById: string
}

type verification_result =
  | { success: true; payload: signed_payload }
  | { success: false; error: string }

const chunk_key = 'yuebot-authenticated-message'

function hmac_signature(payload: string) {
  return crypto.createHmac('sha256', CONFIG.internalApi.secret).update(payload).digest('hex')
}

function build_envelope(payload: signed_payload) {
  const payload_json = JSON.stringify(payload)
  const sig = hmac_signature(payload_json)
  return JSON.stringify({ payload: payload_json, sig })
}

function parse_envelope(input: string): verification_result {
  try {
    const parsed = JSON.parse(input) as { payload?: unknown; sig?: unknown }
    if (typeof parsed.payload !== 'string' || typeof parsed.sig !== 'string') {
      return { success: false as const, error: 'Envelope inválido.' }
    }

    const expected = hmac_signature(parsed.payload)
    const expected_buf = Buffer.from(expected)
    const received_buf = Buffer.from(parsed.sig)
    if (expected_buf.length !== received_buf.length || !crypto.timingSafeEqual(expected_buf, received_buf)) {
      return { success: false as const, error: 'Assinatura inválida (imagem alterada ou não oficial).' }
    }

    const payload = JSON.parse(parsed.payload) as signed_payload
    if (payload?.v !== 1 || typeof payload.messageId !== 'string' || typeof payload.authorId !== 'string') {
      return { success: false as const, error: 'Payload inválido.' }
    }

    return { success: true as const, payload }
  } catch (err) {
    const error = err as Error
    return { success: false as const, error: error.message }
  }
}

function clamp_text(text: string, max: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

export class AuthenticatedMessageService {
  async render_signed_message_image(input: { message: Message; requestedBy: User }): Promise<AttachmentBuilder> {
    const author = input.message.author

    const payload: signed_payload = {
      v: 1,
      guildId: input.message.guildId ?? null,
      channelId: input.message.channelId ?? null,
      messageId: input.message.id,
      authorId: author.id,
      createdAt: input.message.createdAt.toISOString(),
      contentPreview: input.message.content ? clamp_text(input.message.content, 300) : null,
      requestedById: input.requestedBy.id,
    }

    const canvas = createCanvas(1000, 520)
    const ctx = canvas.getContext('2d')

    // background
    ctx.fillStyle = '#0b0f17'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // card
    const card_x = 30
    const card_y = 30
    const card_w = canvas.width - 60
    const card_h = canvas.height - 60
    ctx.fillStyle = '#111827'
    ctx.fillRect(card_x, card_y, card_w, card_h)

    // accent bar
    ctx.fillStyle = '#ff6a00'
    ctx.fillRect(card_x, card_y, card_w, 6)

    // avatar
    const avatar_url = author.displayAvatarURL({ extension: 'png', size: 128 })
    try {
      const avatar = await loadImage(avatar_url)
      ctx.drawImage(avatar, 60, 88, 96, 96)
    } catch {
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(60, 88, 96, 96)
    }

    // header
    ctx.fillStyle = '#e5e7eb'
    ctx.font = 'bold 26px Sans'
    ctx.fillText(author.tag, 175, 120)

    ctx.fillStyle = '#9ca3af'
    ctx.font = '16px Sans'
    ctx.fillText(new Date(payload.createdAt).toLocaleString('pt-BR'), 175, 146)

    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px Sans'
    ctx.fillText(`Solicitado por: ${input.requestedBy.username} (ID ${input.requestedBy.id})`, 175, 170)

    // content title
    ctx.fillStyle = '#e5e7eb'
    ctx.font = 'bold 16px Sans'
    ctx.fillText('Conteúdo', 60, 220)

    // content
    ctx.fillStyle = '#e5e7eb'
    ctx.font = '18px Sans'

    const content = payload.contentPreview ?? '(sem conteúdo)'
    const lines = wrap_text(ctx, content, 880)
    let y = 250
    for (const line of lines.slice(0, 8)) {
      ctx.fillText(line, 60, y)
      y += 26
    }

    // ids block
    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px Sans'
    const ids_y = 470
    ctx.fillText(`ID do usuário: ${payload.authorId}`, 60, ids_y)
    ctx.fillText(`ID do servidor: ${payload.guildId ?? '—'}`, 60, ids_y + 20)
    ctx.fillText(`ID do canal: ${payload.channelId ?? '—'}`, 60, ids_y + 40)
    ctx.fillText(`ID da mensagem: ${payload.messageId}`, 60, ids_y + 60)

    // footer hint
    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px Sans'
    const hint = 'Desconfiado? Use /verificarmensagem para confirmar a autenticidade desta imagem.'
    ctx.fillText(hint, 520, ids_y + 60)

    const png_buffer = canvas.toBuffer('image/png')

    const envelope = build_envelope(payload)
    const with_metadata = embed_text_chunk(png_buffer, chunk_key, envelope)

    return new AttachmentBuilder(with_metadata, { name: `mensagem-${payload.messageId}.png` })
  }

  async verify_signed_message_image(input: { url: string }): Promise<verification_result> {
    let buffer: Buffer
    try {
      const response = await axios.get<ArrayBuffer>(input.url, { responseType: 'arraybuffer' })
      buffer = Buffer.from(response.data)
    } catch {
      return { success: false as const, error: 'Falha ao baixar a imagem.' }
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
      return { success: false as const, error: 'Imagem inválida (formato não suportado). Use uma imagem PNG gerada pelo bot.' }
    }

    let envelope: string | null = null
    try {
      envelope = extract_text_chunk(buffer, chunk_key)
    } catch {
      return { success: false as const, error: 'Imagem inválida (não foi possível ler os dados de autenticação).' }
    }
    if (!envelope) {
      return { success: false as const, error: 'Esta imagem não contém dados de autenticação.' }
    }

    return parse_envelope(envelope)
  }
}

function wrap_text(ctx: SKRSContext2D, text: string, max_width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = ctx.measureText(test).width
    if (width > max_width && current) {
      lines.push(current)
      current = word
      continue
    }
    current = test
  }

  if (current) lines.push(current)
  return lines
}

function embed_text_chunk(png: Buffer, key: string, value: string): Buffer {
  const chunks = extractChunks(png)
  const t = textChunk.encode(key, value)

  // Insert before IEND
  const iend_index = chunks.findIndex((c) => c.name === 'IEND')
  if (iend_index === -1) {
    throw new Error('PNG inválido: sem IEND')
  }

  const next = [...chunks.slice(0, iend_index), t, ...chunks.slice(iend_index)]
  return Buffer.from(encodeChunks(next))
}

function extract_text_chunk(png: Buffer, key: string): string | null {
  const chunks = extractChunks(png)

  for (const c of chunks) {
    if (c.name !== 'tEXt') continue
    const decoded = textChunk.decode(c.data)
    if (decoded.keyword === key) return decoded.text
  }

  return null
}

export const authenticatedMessageService = new AuthenticatedMessageService()
