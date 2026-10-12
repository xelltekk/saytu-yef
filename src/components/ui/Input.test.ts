import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe,expect,it } from 'vitest'
import { Input,Select,Textarea } from './Input'

describe('accessible form controls', () => {
  it('associates all labels with stable control identifiers', () => {
    const html = renderToStaticMarkup(createElement('div',null,
      createElement(Input,{ label:'Amount',id:'amount' }),
      createElement(Select,{ label:'Method',options:[{ value:'cash',label:'Cash' }] }),
      createElement(Textarea,{ label:'Note' })))
    const targets = [...html.matchAll(/<label for="([^"]+)"/g)].map((match) => match[1])
    expect(targets).toHaveLength(3)
    expect(new Set(targets).size).toBe(3)
    for (const target of targets) expect(html).toContain(`id="${target}"`)
  })
})
