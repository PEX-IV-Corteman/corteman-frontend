export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
  errors: { field: string | null; messages: string[] }[]
}

export type MetodoPagamento = 'PIX' | 'CARTAO' | 'DINHEIRO'
export type DestinoRetirada = 'PESSOAL' | 'EMPRESA'

export type Servico = {
  servico_id: string
  nome_servico: string
  valor_servico: number | string
}

export type Atendimento = {
  atendimento_id: string
  servico_id: string
  valor_atendimento: number | string
  metodo_pagamento: MetodoPagamento
  realizado_em: string
}

export type Retirada = {
  retirada_id: string
  valor_retirada: number | string
  destino: DestinoRetirada
  justificativa: string
  realizada_em: string
}

// Em desenvolvimento, o proxy do Vite evita depender da configuração de CORS
// do servidor remoto. Em produção, VITE_API_URL continua sendo a fonte da URL.
const baseUrl = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : '')).replace(/\/$/, '')

function messageFrom(response: ApiResponse<unknown>) {
  return response.errors?.flatMap(error => error.messages).join(' ') || response.message || 'Não foi possível concluir a operação.'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique VITE_API_URL e se o back-end está em execução.')
  }

  const body = await response.json().catch(() => null) as ApiResponse<T> | null
  if (!response.ok || !body?.success) throw new Error(body ? messageFrom(body) : 'Resposta inválida do servidor.')
  return body.data
}

const json = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const api = {
  listServicos: () => request<Servico[]>('/servicos'),
  createServico: (data: Pick<Servico, 'nome_servico' | 'valor_servico'>) => request<Servico>('/servicos', json('POST', data)),
  updateServico: (id: string, data: Partial<Pick<Servico, 'nome_servico' | 'valor_servico'>>) => request<Servico>(`/servicos/${id}`, json('PUT', data)),
  deleteServico: (id: string) => request<null>(`/servicos/${id}`, { method: 'DELETE' }),

  listAtendimentos: () => request<Atendimento[]>('/atendimentos'),
  createAtendimento: (data: Pick<Atendimento, 'servico_id' | 'valor_atendimento' | 'metodo_pagamento'>) => request<Atendimento>('/atendimentos', json('POST', data)),
  updateAtendimento: (id: string, data: Partial<Pick<Atendimento, 'servico_id' | 'valor_atendimento' | 'metodo_pagamento' | 'realizado_em'>>) => request<Atendimento>(`/atendimentos/${id}`, json('PUT', data)),
  deleteAtendimento: (id: string) => request<null>(`/atendimentos/${id}`, { method: 'DELETE' }),

  listRetiradas: () => request<Retirada[]>('/retiradas'),
  createRetirada: (data: Pick<Retirada, 'valor_retirada' | 'destino' | 'justificativa'>) => request<Retirada>('/retiradas', json('POST', data)),
  updateRetirada: (id: string, data: Partial<Pick<Retirada, 'valor_retirada' | 'destino' | 'justificativa' | 'realizada_em'>>) => request<Retirada>(`/retiradas/${id}`, json('PUT', data)),
  deleteRetirada: (id: string) => request<null>(`/retiradas/${id}`, { method: 'DELETE' }),
}
