import { useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, Textarea } from '../components/ui'
import { toast_error } from '../store/toast'

const API_URL = getApiUrl()
type message = { role: 'user' | 'assistant'; content: string }

export default function PanelAssistantPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const [messages, setMessages] = useState<message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const send = async () => {
    const content = input.trim()
    if (!guildId || !content || sending) return
    setInput(''); setSending(true); setMessages((current) => [...current, { role: 'user', content }])
    try {
      const response = await axios.post(`${API_URL}/api/guilds/${guildId}/panel-ai/chat`, { message: content })
      setMessages((current) => [...current, { role: 'assistant', content: response.data.response }])
    } catch (error: any) { toast_error(error.response?.data?.error || 'A Ella está indisponível.', 'Ella') }
    finally { setSending(false) }
  }
  return <div className="mx-auto w-full max-w-3xl space-y-6"><div><h1 className="text-2xl font-bold">Ella</h1><p className="mt-1 text-sm text-muted-foreground">Ajuda com este servidor e com o painel. Ações nunca são executadas sem confirmação.</p></div><Card><CardContent className="space-y-4 p-6"><div className="min-h-72 space-y-3">{messages.length === 0 && <p className="text-sm text-muted-foreground">Pergunte sobre configurações, recursos ou próximos passos.</p>}{messages.map((item, index) => <div key={index} className={item.role === 'user' ? 'ml-10 rounded-xl bg-accent/10 p-3 text-sm' : 'mr-10 rounded-xl bg-muted p-3 text-sm'}>{item.content}</div>)}</div><div className="flex gap-2"><Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escreva sua pergunta..." maxLength={4000} /><Button onClick={send} isLoading={sending}>Enviar</Button></div></CardContent></Card></div>
}
