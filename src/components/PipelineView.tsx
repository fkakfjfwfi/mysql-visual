import { useEffect, useState } from 'react'
import type { Card, JoinLink, PipelineModel, Stage } from '../sql/types'

const CARD_H = 84
const GAP = 10

function preferredField(card: Card) {
  const names = ['name', 'title', 'city', 'author']
  return card.fields.find((field) => names.includes(field.name)) ?? card.fields[0]
}

function Slip({ card }: { card: Card }) {
  const lead = preferredField(card)
  const rest = card.fields.filter((field) => field !== lead)
  return (
    <article className={`slip ${card.state}`}>
      <header>
        {card.rank ? <em>{card.rank}</em> : null}
        <strong>{lead?.value ?? '行'}</strong>
      </header>
      {rest.length > 0 ? (
        <dl>
          {rest.map((field) => (
            <div key={field.name}>
              <dt>{field.name}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.note ? <p className="slip-note">{card.note}</p> : null}
      {card.state === 'dropped' ? <p className="slip-note">筛掉</p> : null}
    </article>
  )
}

function RowsStage({ stage }: { stage: Extract<Stage, { kind: 'rows' }> }) {
  return (
    <section className="stage">
      <header className="stage-head">
        <h3>{stage.title}</h3>
        <p>{stage.detail}</p>
      </header>
      <div className="slip-stack">
        {stage.cards.map((card) => (
          <Slip key={card.id} card={card} />
        ))}
      </div>
      {stage.hidden > 0 ? <p className="muted">还有 {stage.hidden} 行没有画出来</p> : null}
    </section>
  )
}

function linkText(link: JoinLink, left: Card[], right: Card[]) {
  const from = left.find((card) => card.id === link.leftId)
  const to = right.find((card) => card.id === link.rightId)
  const leftText = from ? preferredField(from)?.value : ''
  const rightText = to ? preferredField(to)?.value : ''
  return `${leftText} → ${rightText}`
}

function JoinStage({ stage, narrow }: { stage: Extract<Stage, { kind: 'join' }>; narrow: boolean }) {
  const leftIndex = new Map(stage.left.map((card, index) => [card.id, index]))
  const rightIndex = new Map(stage.right.map((card, index) => [card.id, index]))
  const height = Math.max(stage.left.length, stage.right.length, 1) * (CARD_H + GAP) - GAP
  return (
    <section className="stage stage-join">
      <header className="stage-head">
        <h3>{stage.title}</h3>
        <p>{stage.detail}</p>
      </header>
      {narrow ? (
        <div className="join-stack">
          <div>
            <p className="col-name">{stage.leftTitle}</p>
            {stage.left.map((card) => (
              <Slip key={card.id} card={card} />
            ))}
          </div>
          <ul className="pair-list">
            {stage.links.map((link) => (
              <li key={`${link.leftId}-${link.rightId}`} className={link.state}>
                {linkText(link, stage.left, stage.right)}
                {link.state === 'dropped' ? ' · 筛掉' : ''}
              </li>
            ))}
          </ul>
          <div>
            <p className="col-name">{stage.rightTitle}</p>
            {stage.right.map((card) => (
              <Slip key={card.id} card={card} />
            ))}
          </div>
        </div>
      ) : (
        <>
        <div className="join-names">
          <p className="col-name">{stage.leftTitle}</p>
          <p className="col-name">{stage.rightTitle}</p>
        </div>
        <div className="join-board" style={{ height }}>
          <div className="join-col">
            {stage.left.map((card) => (
              <Slip key={card.id} card={card} />
            ))}
          </div>
          <svg className="join-wires" width={88} height={height} aria-hidden="true">
            {stage.links.map((link) => {
              const y1 = (leftIndex.get(link.leftId) ?? 0) * (CARD_H + GAP) + CARD_H / 2
              const y2 = (rightIndex.get(link.rightId) ?? 0) * (CARD_H + GAP) + CARD_H / 2
              return (
                <path
                  key={`${link.leftId}-${link.rightId}`}
                  d={`M 0 ${y1} C 44 ${y1}, 44 ${y2}, 88 ${y2}`}
                  className={link.state === 'kept' ? 'wire-kept' : 'wire-dropped'}
                />
              )
            })}
          </svg>
          <div className="join-col">
            {stage.right.map((card) => (
              <Slip key={card.id} card={card} />
            ))}
          </div>
        </div>
        </>
      )}
      {stage.hidden > 0 ? <p className="muted">还有 {stage.hidden} 张卡片没有画出来</p> : null}
    </section>
  )
}

function GroupsStage({ stage }: { stage: Extract<Stage, { kind: 'groups' }> }) {
  return (
    <section className="stage">
      <header className="stage-head">
        <h3>{stage.title}</h3>
        <p>{stage.detail}</p>
      </header>
      <div className="piles">
        {stage.piles.map((pile) => (
          <div key={pile.id} className={`pile ${pile.state}`}>
            <header>
              {pile.rank ? <em>{pile.rank}</em> : null}
              <strong>{pile.label}</strong>
              <span>{pile.summary}</span>
            </header>
            <div className="pile-cards">
              {pile.cards.map((card) => (
                <Slip key={card.id} card={card} />
              ))}
            </div>
            {pile.state === 'dropped' ? <p className="slip-note">这一摞被筛掉</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function StageView({ stage, narrow }: { stage: Stage; narrow: boolean }) {
  if (stage.kind === 'rows') return <RowsStage stage={stage} />
  if (stage.kind === 'join') return <JoinStage stage={stage} narrow={narrow} />
  return <GroupsStage stage={stage} />
}

function useNarrow() {
  const query = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setNarrow(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export function PipelineView({ pipeline }: { pipeline: PipelineModel }) {
  const narrow = useNarrow()
  return (
    <div className="pipeline">
      <div className="pipeline-legend">
        <span>实线是对上的行</span>
        <span>变淡的是被筛掉的行</span>
        <span>分组是一摞卡片</span>
      </div>
      {pipeline.subqueries.map((subquery) => (
        <section key={subquery.sql} className="subquery">
          <header>
            <h3>先算子查询</h3>
            <p>这些值再送进外层的过滤</p>
          </header>
          <code>{subquery.sql}</code>
          <div className="pipeline-track compact">
            {subquery.stages.map((stage, index) => (
              <StageView key={`${stage.title}-${index}`} stage={stage} narrow={narrow} />
            ))}
          </div>
          <div className="chips" aria-label="子查询结果">
            {subquery.values.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </section>
      ))}
      {pipeline.note ? <p className="pipeline-note">{pipeline.note}</p> : null}
      <div className={narrow ? 'pipeline-track stacked' : 'pipeline-track'}>
        {pipeline.stages.map((stage, index) => (
          <StageView key={`${stage.title}-${index}`} stage={stage} narrow={narrow} />
        ))}
      </div>
    </div>
  )
}
