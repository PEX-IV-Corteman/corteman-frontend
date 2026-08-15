import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Screen = 'home' | 'sale' | 'withdraw' | 'history' | 'settings'
type Payment = 'PIX' | 'Cartão' | 'Dinheiro'
type Tx = { id: number; kind: 'entrada' | 'retirada'; title: string; amount: number; time: string; payment?: Payment; detail?: string }
type Service = { id: number; name: string; value: number; category: 'Serviço' | 'Produto'; active: boolean }
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const Icon = ({ name, size = 22 }: { name: string; size?: number }) => <span className={`icon icon-${name}`} style={{ fontSize: size }} aria-hidden="true" />

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [services, setServices] = useState<Service[]>([
    { id: 1, name: 'Corte clássico', value: 35, category: 'Serviço', active: true },
    { id: 2, name: 'Barba', value: 25, category: 'Serviço', active: true },
    { id: 3, name: 'Corte + barba', value: 55, category: 'Serviço', active: true },
    { id: 4, name: 'Água', value: 3, category: 'Produto', active: true },
    { id: 5, name: 'Refrigerante', value: 6, category: 'Produto', active: true },
  ])
  const [transactions, setTransactions] = useState<Tx[]>([
    { id: 1, kind: 'entrada', title: 'Corte clássico', amount: 35, time: 'Hoje, 10:42', payment: 'PIX' },
    { id: 2, kind: 'entrada', title: 'Corte + barba', amount: 55, time: 'Hoje, 09:18', payment: 'Dinheiro' },
    { id: 3, kind: 'retirada', title: 'Compra de materiais', amount: 42, time: 'Ontem, 18:06', detail: 'Empresa' },
  ])
  const [toast, setToast] = useState('')
  const income = transactions.filter(t => t.kind === 'entrada').reduce((a, t) => a + t.amount, 1284.5)
  const outgo = transactions.filter(t => t.kind === 'retirada').reduce((a, t) => a + t.amount, 386)
  const available = Math.max(0, income - outgo - 650)
  const open = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2600) }
  const addTx = (item: Omit<Tx, 'id' | 'time'>) => { setTransactions(t => [{ ...item, id: Date.now(), time: 'Agora' }, ...t]); open('home'); notify(item.kind === 'entrada' ? 'Atendimento registrado!' : 'Retirada registrada!') }
  const body = useMemo(() => {
    if (screen === 'sale') return <Sale services={services.filter(s => s.active)} onSave={addTx} onBack={() => open('home')} />
    if (screen === 'withdraw') return <Withdraw available={available} onSave={addTx} onBack={() => open('home')} />
    if (screen === 'history') return <History transactions={transactions} onBack={() => open('home')} />
    if (screen === 'settings') return <Settings services={services} setServices={setServices} onBack={() => open('home')} notify={notify} />
    return <Home income={income} outgo={outgo} available={available} transactions={transactions} open={open} />
  }, [screen, income, outgo, available, transactions, services])
  return <main className="app-shell"><div className="mobile-frame">{body}{screen === 'home' && <Nav open={open} />}</div>{toast && <div className="toast"><Icon name="check" /> {toast}</div>}</main>
}

function Home({ income, outgo, available, transactions, open }: { income: number; outgo: number; available: number; transactions: Tx[]; open: (s: Screen) => void }) {
 return <><header className="home-head"><div><p className="eyebrow">SÁB, 08 DE AGOSTO</p><h1>Olá, Rogério <span>✦</span></h1><p className="muted">Rogério Barbearia</p></div><button className="avatar" onClick={() => open('settings')}>R</button></header>
 <section className="balance"><div className="balance-top"><span>Caixa disponível</span><button aria-label="Ocultar valor"><Icon name="eye" size={18}/></button></div><strong>{brl(income - outgo)}</strong><div className="balance-foot"><span><i className="dot"/> Mês em andamento</span><span>Ver detalhes <Icon name="arrow" size={14}/></span></div></section>
 <section className="quick"><h2>Registrar agora</h2><div className="quick-grid"><button className="quick-main" onClick={() => open('sale')}><span className="quick-icon"><Icon name="scissors" /></span><b>Novo atendimento</b><small>Venda ou serviço</small></button><button className="quick-secondary" onClick={() => open('withdraw')}><span className="quick-icon"><Icon name="wallet" /></span><b>Retirada</b><small>Do caixa</small></button></div></section>
 <section className="metrics"><article><span className="metric-icon up"><Icon name="trend"/></span><p>Entradas</p><b>{brl(income)}</b><small>+12% este mês</small></article><article><span className="metric-icon down"><Icon name="down"/></span><p>Saídas</p><b>{brl(outgo)}</b><small>Custos e retiradas</small></article></section>
 <section className="reserve"><div><p>Disponível para retirada</p><b>{brl(available)}</b><small>Após preservar sua reserva mensal</small></div><span><Icon name="shield" size={27}/></span></section>
 <section className="recent"><div className="section-title"><h2>Movimentações recentes</h2><button onClick={() => open('history')}>Ver todas</button></div>{transactions.slice(0, 3).map(t => <TxRow key={t.id} tx={t}/>)}</section></>
}

function Sale({ services, onSave, onBack }: { services: Service[]; onSave: (t: Omit<Tx, 'id' | 'time'>) => void; onBack: () => void }) {
 const [selected, setSelected] = useState(services[0]?.id ?? 0); const item = services.find(s => s.id === selected) ?? services[0]; const [value, setValue] = useState(item?.value ?? 0); const [payment, setPayment] = useState<Payment>('PIX')
 const choose = (s: Service) => { setSelected(s.id); setValue(s.value) }
 return <div className="screen"><Header title="Novo atendimento" back={onBack}/><p className="lead">Registre em poucos toques e volte ao cliente.</p><label>O que foi vendido?</label><div className="choices">{services.map(s => <button key={s.id} className={selected === s.id ? 'choice selected' : 'choice'} onClick={() => choose(s)}><span className="choice-mark">{s.category === 'Serviço' ? <Icon name="scissors"/> : <Icon name="cup"/>}</span><span><b>{s.name}</b><small>{s.category}</small></span><strong>{brl(s.value)}</strong></button>)}</div><label>Valor cobrado</label><div className="money-input"><span>R$</span><input value={value} type="number" min="0" step="0.5" onChange={e => setValue(Number(e.target.value))}/></div><label>Forma de pagamento</label><div className="payments">{(['PIX','Cartão','Dinheiro'] as Payment[]).map(p => <button key={p} className={payment === p ? 'active' : ''} onClick={() => setPayment(p)}>{p === 'PIX' && <Icon name="pix"/>}{p}</button>)}</div><p className="auto"><Icon name="clock" size={16}/> Data e hora registradas automaticamente</p><button className="primary sticky" onClick={() => item && onSave({kind:'entrada', title:item.name, amount:value, payment})}>Salvar atendimento <Icon name="arrow"/></button></div>
}

function Withdraw({ available, onSave, onBack }: { available: number; onSave: (t: Omit<Tx, 'id' | 'time'>) => void; onBack: () => void }) { const [value,setValue]=useState(0); const [type,setType]=useState<'Pessoal'|'Empresa'>('Pessoal'); const [reason,setReason]=useState(''); const warning=value > available; return <div className="screen"><Header title="Registrar retirada" back={onBack}/><p className="lead">Registre saídas para manter o caixa sempre claro.</p><label>Quanto saiu do caixa?</label><div className="money-input big"><span>R$</span><input value={value || ''} placeholder="0,00" type="number" min="0" onChange={e=>setValue(Number(e.target.value))}/></div><div className="available-note"><Icon name="shield"/> <span>Disponível hoje: <b>{brl(available)}</b></span></div><label>Tipo de retirada</label><div className="type-grid"><button className={type==='Pessoal'?'active':''} onClick={()=>setType('Pessoal')}><Icon name="person"/><b>Pessoal</b><small>Pró-labore ou uso pessoal</small></button><button className={type==='Empresa'?'active':''} onClick={()=>setType('Empresa')}><Icon name="store"/><b>Empresa</b><small>Compra ou gasto extra</small></button></div><label htmlFor="reason">Justificativa <em>opcional</em></label><textarea id="reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: compra de produtos" />{warning && <div className="warning"><Icon name="warning"/><span><b>Atenção à reserva</b> Esta retirada supera o valor disponível sem comprometer sua reserva.</span></div>}<button className="primary sticky" disabled={!value} onClick={()=>onSave({kind:'retirada', title:reason || `Retirada ${type.toLowerCase()}`, amount:value, detail:type})}>Confirmar retirada <Icon name="arrow"/></button></div> }

function History({ transactions, onBack }: { transactions: Tx[]; onBack: () => void }) { return <div className="screen"><Header title="Movimentações" back={onBack}/><div className="filter"><button className="active">Tudo</button><button>Entradas</button><button>Saídas</button><button><Icon name="calendar"/> Agosto</button></div><div className="day-label">HOJE</div>{transactions.map(t => <TxRow tx={t} key={t.id}/>)}</div> }

function Settings({ services, setServices, onBack, notify }: { services: Service[]; setServices: React.Dispatch<React.SetStateAction<Service[]>>; onBack: () => void; notify: (m:string)=>void }) { const [tab,setTab]=useState<'Serviços'|'Custos'|'Limites'>('Serviços'); const [name,setName]=useState(''); const [price,setPrice]=useState(''); const add = () => { if(!name || !price) return; setServices(s => [...s,{id:Date.now(),name,value:Number(price),category:'Serviço',active:true}]); setName('');setPrice('');notify('Serviço adicionado!')}; return <div className="screen"><Header title="Organização" back={onBack}/><p className="lead">Ajuste sua rotina em um momento tranquilo.</p><div className="tabs">{(['Serviços','Custos','Limites'] as const).map(t=><button onClick={()=>setTab(t)} className={tab===t?'active':''} key={t}>{t}</button>)}</div>{tab==='Serviços'&&<><div className="settings-list">{services.map(s=><div className="service-row" key={s.id}><span className="service-icon"><Icon name={s.category==='Serviço'?'scissors':'cup'}/></span><span><b>{s.name}</b><small>{s.category}</small></span><strong>{brl(s.value)}</strong><button className={s.active?'switch on':'switch'} aria-label="Alternar serviço" onClick={()=>setServices(a=>a.map(x=>x.id===s.id?{...x,active:!x.active}:x))}><i/></button></div>)}</div><div className="add-card"><b>Adicionar serviço</b><div><input placeholder="Nome do serviço" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Valor" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></div><button className="outline" onClick={add}>+ Adicionar</button></div></>}{tab==='Custos'&&<SettingsCosts notify={notify}/>} {tab==='Limites'&&<Limits notify={notify}/>}</div> }
function SettingsCosts({notify}:{notify:(m:string)=>void}) { return <div className="config"><div className="info-box"><Icon name="bulb"/><span>Cadastre os custos que se repetem para proteger seu caixa.</span></div><label>Nome do custo</label><input placeholder="Ex.: Aluguel"/><label>Tipo e periodicidade</label><div className="two-inputs"><select><option>Fixo</option><option>Variável</option></select><select><option>Mensal</option><option>Semanal</option><option>Anual</option></select></div><label>Valor</label><div className="money-input"><span>R$</span><input placeholder="0,00" type="number"/></div><button className="primary" onClick={()=>notify('Custo salvo!')}>Salvar custo</button></div>}
function Limits({notify}:{notify:(m:string)=>void}) { return <div className="config"><div className="plan-card"><span><Icon name="shield"/></span><div><b>Proteja a saúde do negócio</b><p>Estes valores definem o que pode ser retirado do caixa.</p></div></div><label>Reserva mínima mensal</label><div className="money-input"><span>R$</span><input defaultValue="650" type="number"/></div><label>Limite para retirada pessoal</label><div className="money-input"><span>R$</span><input defaultValue="800" type="number"/></div><button className="primary" onClick={()=>notify('Planejamento atualizado!')}>Salvar planejamento</button></div>}
function Header({title,back}:{title:string;back:()=>void}) { return <header className="screen-head"><button className="back" onClick={back}><Icon name="back"/></button><h1>{title}</h1></header> }
function TxRow({tx}:{tx:Tx}) { return <article className="tx"><span className={tx.kind==='entrada'?'tx-icon income':'tx-icon expense'}><Icon name={tx.kind==='entrada'?'arrow':'down'}/></span><div><b>{tx.title}</b><small>{tx.time} {tx.payment ? `· ${tx.payment}` : tx.detail ? `· ${tx.detail}` : ''}</small></div><strong className={tx.kind==='entrada'?'positive':''}>{tx.kind==='entrada'?'+':'−'} {brl(tx.amount)}</strong></article> }
function Nav({open}:{open:(s:Screen)=>void}) { return <nav><button className="active" onClick={()=>open('home')}><Icon name="home"/><span>Início</span></button><button onClick={()=>open('history')}><Icon name="chart"/><span>Histórico</span></button><button className="nav-add" onClick={()=>open('sale')}><Icon name="plus"/></button><button onClick={()=>open('withdraw')}><Icon name="wallet"/><span>Retirada</span></button><button onClick={()=>open('settings')}><Icon name="settings"/><span>Organizar</span></button></nav> }
createRoot(document.getElementById('root')!).render(<App />)
