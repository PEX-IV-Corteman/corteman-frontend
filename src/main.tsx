import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api, type Atendimento, type DestinoRetirada, type MetodoPagamento, type Retirada, type Servico } from './api'
import './styles.css'

type Screen = 'home' | 'sale' | 'withdraw' | 'history' | 'services' | 'edit-sale' | 'edit-withdraw'
type Transaction = { id: string; kind: 'entrada' | 'retirada'; title: string; value: number; when: string; timestamp: string; meta: string; original: Atendimento | Retirada }
const money = (value: number | string) => Number(value || 0)
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Agora'
const Icon = ({ name, size = 22 }: { name: string; size?: number }) => <span className={`icon icon-${name}`} style={{ fontSize: size }} aria-hidden="true" />

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [services, setServices] = useState<Servico[]>([])
  const [attendances, setAttendances] = useState<Atendimento[]>([])
  const [withdrawals, setWithdrawals] = useState<Retirada[]>([])
  const [editing, setEditing] = useState<Atendimento | Retirada | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const notify = (text: string) => { setMessage(text); setTimeout(() => setMessage(''), 3000) }
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [a, b, c] = await Promise.all([api.listServicos(), api.listAtendimentos(), api.listRetiradas()]); setServices(a); setAttendances(b); setWithdrawals(c) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const open = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const serviceNames = useMemo(() => new Map(services.map(s => [s.servico_id, s.nome_servico])), [services])
  const transactions = useMemo<Transaction[]>(() => [
    ...attendances.map(item => ({ id: item.atendimento_id, kind: 'entrada' as const, title: serviceNames.get(item.servico_id) ?? 'Serviço removido', value: money(item.valor_atendimento), when: dateTime(item.realizado_em), timestamp: item.realizado_em, meta: paymentLabel(item.metodo_pagamento), original: item })),
    ...withdrawals.map(item => ({ id: item.retirada_id, kind: 'retirada' as const, title: item.justificativa || `Retirada ${destinationLabel(item.destino).toLowerCase()}`, value: money(item.valor_retirada), when: dateTime(item.realizada_em), timestamp: item.realizada_em, meta: destinationLabel(item.destino), original: item })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [attendances, withdrawals, serviceNames])
  const income = attendances.reduce((total, item) => total + money(item.valor_atendimento), 0)
  const outgo = withdrawals.reduce((total, item) => total + money(item.valor_retirada), 0)
  async function run(action: () => Promise<unknown>, success: string, errorMessage?: (reason: unknown) => string) { try { await action(); await load(); open('home'); notify(success) } catch (reason) { setError(errorMessage ? errorMessage(reason) : reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.') } }
  async function remove(item: Transaction) { if (!window.confirm(`Excluir “${item.title}”? Esta ação não pode ser desfeita.`)) return; await run(() => item.kind === 'entrada' ? api.deleteAtendimento(item.id) : api.deleteRetirada(item.id), 'Registro excluído.') }
  function edit(item: Transaction) { setEditing(item.original); open(item.kind === 'entrada' ? 'edit-sale' : 'edit-withdraw') }
  let content: React.ReactNode
  if (loading) content = <Loading />
  else if (screen === 'sale' || screen === 'edit-sale') content = <Sale services={services} initial={screen === 'edit-sale' ? editing as Atendimento : undefined} onBack={() => open('home')} onSave={(data, id) => run(() => id ? api.updateAtendimento(id, data) : api.createAtendimento(data), id ? 'Atendimento atualizado.' : 'Atendimento registrado.')} />
  else if (screen === 'withdraw' || screen === 'edit-withdraw') content = <Withdraw initial={screen === 'edit-withdraw' ? editing as Retirada : undefined} available={Math.max(0, income - outgo)} onBack={() => open('home')} onSave={(data, id) => run(() => id ? api.updateRetirada(id, data) : api.createRetirada(data), id ? 'Retirada atualizada.' : 'Retirada registrada.')} />
  else if (screen === 'history') content = <History transactions={transactions} onBack={() => open('home')} onEdit={edit} onDelete={remove}/>
  else if (screen === 'services') content = <Services services={services} onBack={() => open('home')} onCreate={data => run(() => api.createServico(data), 'Serviço criado.')} onUpdate={(id, data) => run(() => api.updateServico(id, data), 'Serviço atualizado.')} onDelete={id => run(() => api.deleteServico(id), 'Serviço excluído.', reason => reason instanceof Error && reason.message === 'Erro ao excluir serviço.' ? 'Não é possível excluir este serviço porque ele possui atendimentos registrados.' : reason instanceof Error ? reason.message : 'Não foi possível excluir o serviço.')} />
  else content = <Home income={income} outgo={outgo} transactions={transactions} open={open}/>
  const serviceHasAttendances = error === 'Não é possível excluir este serviço porque ele possui atendimentos registrados.'
  return <main className="app-shell"><div className="mobile-frame">{error && <div className="api-error"><span>{error}</span><button onClick={() => { setError(''); if (!serviceHasAttendances) void load() }}>{serviceHasAttendances ? 'Entendi' : 'Tentar novamente'}</button></div>}{content}{screen === 'home' && <Nav open={open}/>}</div>{message && <div className="toast"><Icon name="check"/> {message}</div>}</main>
}
function Loading() { return <div className="loading"><Icon name="clock" size={30}/><b>Carregando dados da barbearia…</b><small>Conectando ao back-end</small></div> }
function Home({ income, outgo, transactions, open }: { income:number; outgo:number; transactions:Transaction[]; open:(s:Screen)=>void }) { const cash = income - outgo; return <><header className="home-head"><div><p className="eyebrow">CONTROLE FINANCEIRO</p><h1>Olá, Rogério <span>✦</span></h1><p className="muted">Rogério Barbearia</p></div><button className="avatar" onClick={() => open('services')}>R</button></header><section className="balance"><div className="balance-top"><span>Caixa disponível</span><Icon name="eye" size={18}/></div><strong>{brl(cash)}</strong><div className="balance-foot"><span><i className="dot"/> Dados atualizados</span><span>{transactions.length} registros</span></div></section><section className="quick"><h2>Registrar agora</h2><div className="quick-grid"><button className="quick-main" onClick={() => open('sale')}><span className="quick-icon"><Icon name="scissors"/></span><b>Novo atendimento</b><small>Serviço realizado</small></button><button className="quick-secondary" onClick={() => open('withdraw')}><span className="quick-icon"><Icon name="wallet"/></span><b>Retirada</b><small>Do caixa</small></button></div></section><section className="metrics"><article><span className="metric-icon up"><Icon name="trend"/></span><p>Entradas</p><b>{brl(income)}</b><small>Atendimentos</small></article><article><span className="metric-icon down"><Icon name="down"/></span><p>Saídas</p><b>{brl(outgo)}</b><small>Retiradas</small></article></section><section className="recent"><div className="section-title"><h2>Movimentações recentes</h2><button onClick={() => open('history')}>Ver todas</button></div>{transactions.length ? transactions.slice(0,3).map(item => <TransactionRow key={item.id} item={item}/>) : <Empty text="Ainda não há movimentações."/>}</section></> }
function Sale({ services, initial, onBack, onSave }: { services:Servico[]; initial?:Atendimento; onBack:()=>void; onSave:(data:Pick<Atendimento,'servico_id'|'valor_atendimento'|'metodo_pagamento'>, id?:string)=>void }) { const [serviceId,setServiceId]=useState(initial?.servico_id ?? services[0]?.servico_id ?? ''); const selected=services.find(s=>s.servico_id===serviceId); const [value,setValue]=useState(String(initial ? money(initial.valor_atendimento) : selected ? money(selected.valor_servico) : '')); const [payment,setPayment]=useState<MetodoPagamento>(initial?.metodo_pagamento ?? 'PIX'); function choose(service:Servico){setServiceId(service.servico_id);setValue(String(money(service.valor_servico)))} return <div className="screen"><Header title={initial?'Editar atendimento':'Novo atendimento'} back={onBack}/><p className="lead">{initial?'Atualize os dados do atendimento.':'Registre em poucos toques e volte ao cliente.'}</p>{services.length ? <><label>Serviço realizado</label><div className="choices">{services.map(s=><button key={s.servico_id} className={serviceId===s.servico_id?'choice selected':'choice'} onClick={()=>choose(s)}><span className="choice-mark"><Icon name="scissors"/></span><span><b>{s.nome_servico}</b><small>Serviço cadastrado</small></span><strong>{brl(money(s.valor_servico))}</strong></button>)}</div><label>Valor cobrado</label><div className="money-input"><span>R$</span><input value={value} type="number" min="0.01" step="0.01" onChange={e=>setValue(e.target.value)}/></div><label>Forma de pagamento</label><div className="payments">{(['PIX','CARTAO','DINHEIRO'] as MetodoPagamento[]).map(item=><button key={item} className={payment===item?'active':''} onClick={()=>setPayment(item)}>{paymentLabel(item)}</button>)}</div><button className="primary sticky" disabled={!serviceId || Number(value)<=0} onClick={()=>onSave({servico_id:serviceId,valor_atendimento:Number(value),metodo_pagamento:payment},initial?.atendimento_id)}>{initial?'Salvar alterações':'Salvar atendimento'} <Icon name="arrow"/></button></> : <Empty text="Cadastre ao menos um serviço antes de registrar um atendimento." action="Voltar" onAction={onBack}/>}</div> }
function Withdraw({ initial, available, onBack, onSave }: { initial?:Retirada; available:number; onBack:()=>void; onSave:(data:Pick<Retirada,'valor_retirada'|'destino'|'justificativa'>,id?:string)=>void }) {
  const [value, setValue] = useState(String(initial ? money(initial.valor_retirada) : ''))
  const [destination, setDestination] = useState<DestinoRetirada>(initial?.destino ?? 'PESSOAL')
  const [reason, setReason] = useState(initial?.justificativa ?? '')
  const reasonIsValid = reason.trim().length > 0

  return <div className="screen"><Header title={initial ? 'Editar retirada' : 'Registrar retirada'} back={onBack}/><p className="lead">Registre saídas para manter o caixa sempre claro.</p><label>Quanto saiu do caixa?</label><div className="money-input big"><span>R$</span><input value={value} placeholder="0,00" type="number" min="0.01" step="0.01" onChange={e => setValue(e.target.value)}/></div>{!initial && <div className="available-note"><Icon name="shield"/><span>Caixa atual: <b>{brl(available)}</b></span></div>}<label>Destino da retirada</label><div className="type-grid"><button className={destination === 'PESSOAL' ? 'active' : ''} onClick={() => setDestination('PESSOAL')}><Icon name="person"/><b>Pessoal</b><small>Pró-labore ou uso pessoal</small></button><button className={destination === 'EMPRESA' ? 'active' : ''} onClick={() => setDestination('EMPRESA')}><Icon name="store"/><b>Empresa</b><small>Compra ou gasto extra</small></button></div><label>Justificativa</label><textarea required value={reason} maxLength={80} onChange={e => setReason(e.target.value)} placeholder="Ex.: compra de produtos"/><button className="primary sticky" disabled={Number(value) <= 0 || !reasonIsValid} onClick={() => onSave({ valor_retirada: Number(value), destino: destination, justificativa: reason.trim() }, initial?.retirada_id)}>{initial ? 'Salvar alterações' : 'Confirmar retirada'} <Icon name="arrow"/></button></div>
}
function History({ transactions,onBack,onEdit,onDelete }: { transactions:Transaction[];onBack:()=>void;onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void }) { return <div className="screen"><Header title="Movimentações" back={onBack}/><p className="lead">Toque em um registro para editar ou use a lixeira para excluir.</p>{transactions.length ? transactions.map(item=><TransactionRow key={item.id} item={item} actions onEdit={()=>onEdit(item)} onDelete={()=>onDelete(item)}/>) : <Empty text="Nenhuma movimentação cadastrada."/>}</div> }
function Services({ services,onBack,onCreate,onUpdate,onDelete }: { services:Servico[];onBack:()=>void;onCreate:(data:Pick<Servico,'nome_servico'|'valor_servico'>)=>void;onUpdate:(id:string,data:Partial<Pick<Servico,'nome_servico'|'valor_servico'>>)=>void;onDelete:(id:string)=>void }) {
  const [editing, setEditing] = useState<Servico | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<Servico | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const submit = () => {
    if (!name.trim() || Number(price) <= 0) return
    if (editing) onUpdate(editing.servico_id, { nome_servico: name.trim(), valor_servico: Number(price) })
    else onCreate({ nome_servico: name.trim(), valor_servico: Number(price) })
    setEditing(null); setName(''); setPrice('')
  }
  const begin = (service?: Servico) => { setEditing(service ?? null); setName(service?.nome_servico ?? ''); setPrice(service ? String(money(service.valor_servico)) : '') }
  const confirmDeletion = () => {
    if (!pendingDeletion) return
    onDelete(pendingDeletion.servico_id)
    setPendingDeletion(null)
  }

  return <div className="screen"><Header title="Serviços" back={onBack}/><p className="lead">Cadastre os serviços que aparecem no atendimento.</p><div className="settings-list">{services.map(service => <div className="service-row" key={service.servico_id}><span className="service-icon"><Icon name="scissors"/></span><span><b>{service.nome_servico}</b><small>Serviço cadastrado</small></span><strong>{brl(money(service.valor_servico))}</strong><button className="icon-button" aria-label="Editar serviço" onClick={() => begin(service)}><Icon name="edit"/></button><button className="icon-button danger" aria-label="Excluir serviço" onClick={() => setPendingDeletion(service)}><Icon name="trash"/></button></div>)}</div><div className="add-card"><b>{editing ? 'Editar serviço' : 'Adicionar serviço'}</b><div><input placeholder="Nome do serviço" maxLength={80} value={name} onChange={e => setName(e.target.value)}/><input placeholder="Valor" type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)}/></div><button className="primary" disabled={!name.trim() || Number(price) <= 0} onClick={submit}>{editing ? 'Salvar serviço' : 'Adicionar serviço'}</button>{editing && <button className="outline" onClick={() => begin()}>Cancelar edição</button>}</div>{pendingDeletion && <div className="confirm-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-service-title"><p className="eyebrow">EXCLUIR SERVIÇO</p><h2 id="delete-service-title">Excluir “{pendingDeletion.nome_servico}”?</h2><p>Esta ação não pode ser desfeita.</p><div className="confirm-actions"><button className="delete-confirm" onClick={confirmDeletion}>Excluir</button><button className="cancel-confirm" onClick={() => setPendingDeletion(null)}>Cancelar</button></div></section></div>}</div>
}
function TransactionRow({ item,actions,onEdit,onDelete }: { item:Transaction; actions?:boolean;onEdit?:()=>void;onDelete?:()=>void }) { return <article className="tx"><span className={item.kind==='entrada'?'tx-icon income':'tx-icon expense'}><Icon name={item.kind==='entrada'?'arrow':'down'}/></span><div><b>{item.title}</b><small>{item.when} · {item.meta}</small></div><strong className={item.kind==='entrada'?'positive':''}>{item.kind==='entrada'?'+':'−'} {brl(item.value)}</strong>{actions&&<span className="tx-actions"><button onClick={onEdit} aria-label="Editar"><Icon name="edit"/></button><button onClick={onDelete} aria-label="Excluir"><Icon name="trash"/></button></span>}</article> }
function Empty({ text,action,onAction }: { text:string;action?:string;onAction?:()=>void }) { return <div className="empty"><Icon name="bulb"/><p>{text}</p>{action&&<button className="outline" onClick={onAction}>{action}</button>}</div> }
function Header({ title,back }: {title:string;back:()=>void}) { return <header className="screen-head"><button className="back" onClick={back}><Icon name="back"/></button><h1>{title}</h1></header> }
function Nav({open}:{open:(s:Screen)=>void}) { return <nav><button className="active" onClick={()=>open('home')}><Icon name="home"/><span>Início</span></button><button onClick={()=>open('history')}><Icon name="chart"/><span>Histórico</span></button><button className="nav-add" onClick={()=>open('sale')}><Icon name="plus"/></button><button onClick={()=>open('withdraw')}><Icon name="wallet"/><span>Retirada</span></button><button onClick={()=>open('services')}><Icon name="settings"/><span>Serviços</span></button></nav> }
function paymentLabel(value: MetodoPagamento) { return value === 'CARTAO' ? 'Cartão' : value[0] + value.slice(1).toLowerCase() }
function destinationLabel(value: DestinoRetirada) { return value === 'PESSOAL' ? 'Pessoal' : 'Empresa' }
createRoot(document.getElementById('root')!).render(<App />)
