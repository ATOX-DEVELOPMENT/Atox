// Выполняется внутри окна Atox: возвращает JSX того, что сейчас на экране.
(() => {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'])
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
  const RENAME = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', contenteditable: 'contentEditable', spellcheck: 'spellCheck', maxlength: 'maxLength', colspan: 'colSpan', rowspan: 'rowSpan', autocomplete: 'autoComplete', autofocus: 'autoFocus', crossorigin: 'crossOrigin', enterkeyhint: 'enterKeyHint', inputmode: 'inputMode', 'accept-charset': 'acceptCharset', srcset: 'srcSet', usemap: 'useMap' }
  const DROP = new Set(['xmlns', 'xmlns:xlink', 'data-reactroot'])
  const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const cssName = (name) => (name.startsWith('--') ? name : name.startsWith('-webkit-') || name.startsWith('-moz-') ? camel(name.replace(/^-/, '').replace(/^webkit/, 'Webkit').replace(/^moz/, 'Moz')) : camel(name))
  const q = (text) => JSON.stringify(text)
  // Значение атрибута JSX: строки в кавычках не знают `\"`, переносов и `&`, поэтому такие — выражением.
  const attrValue = (text) => (/["\\\n\r&]/.test(text) ? `{${q(text)}}` : `"${text}"`)

  const styleObject = (el) => {
    const parts = []
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style[i]
      parts.push(`${q(cssName(name))}: ${q(el.style.getPropertyValue(name))}`)
    }
    return parts.length ? `{{ ${parts.join(', ')} }}` : null
  }

  const attrs = (el) => {
    const out = []
    const svg = el instanceof SVGElement
    for (const name of el.getAttributeNames()) {
      if (DROP.has(name) || name.startsWith('on')) continue
      let value = el.getAttribute(name)
      if (name === 'style') {
        const style = styleObject(el)
        if (style) out.push(`style=${style}`)
        continue
      }
      if (name === 'value' && /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) continue
      if (name === 'checked' || name === 'selected') continue
      let key = RENAME[name]
      if (!key) {
        if (name.startsWith('aria-') || name.startsWith('data-')) key = name
        else if (name === 'xlink:href') key = 'href'
        else if (svg) key = camel(name.replace(':', '-'))
        else key = name
      }
      if (key === 'src' && /^(blob:|atox-|file:|https?:)/.test(value)) continue
      if (value === '' && !/^(aria-|data-)/.test(name) && !['alt', 'title', 'placeholder', 'value', 'href', 'd'].includes(name)) out.push(key)
      else out.push(`${key}=${attrValue(value)}`)
    }
    // Прокрученное место окна: страница возвращает его после отрисовки (AppWindow).
    if (el.scrollTop > 0) out.push(`data-scrolltop="${Math.round(el.scrollTop)}"`)
    if (el.tagName === 'INPUT') {
      if (['checkbox', 'radio'].includes(el.type)) { if (el.checked) out.push('defaultChecked') }
      else if (el.value) out.push(`defaultValue=${attrValue(el.value)}`)
    }
    return out.filter(Boolean)
  }

  const textNode = (text) => {
    if (!text.trim()) return text.includes(' ') || text.includes('\n') ? null : null
    const collapsed = text.replace(/\s+/g, ' ')
    if (/[{}<>&]/.test(collapsed) || /^\s|\s$/.test(collapsed) ) return `{${q(collapsed)}}`
    return collapsed
  }

  const children = (el, indent) => {
    const lines = []
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = textNode(node.nodeValue)
        if (t !== null) lines.push(indent + t)
      } else if (node.nodeType === 1) {
        const rendered = element(node, indent)
        if (rendered) lines.push(rendered)
      }
    }
    return lines
  }

  const element = (el, indent) => {
    if (SKIP.has(el.tagName)) return null
    if (el.hasAttribute('data-snapshot-skip')) return null
    // Скрытые панели (чаты, открытые раньше) в снимок не нужны: их не видно.
    if (el.hidden) return null
    const tag = el instanceof SVGElement ? el.tagName.replace(/^svg:/, '') : el.tagName.toLowerCase()
    const a = attrs(el)
    if (tag === 'iframe') return `${indent}<div ${[...a.filter((x) => !/^(src|sandbox|tabIndex|title)=?/.test(x))].join(' ')} />`.replace(' />', ' />')
    if (tag === 'canvas') return `${indent}<div ${a.filter((x) => !/^(width|height)=/.test(x)).join(' ')} />`
    const open = `<${tag}${a.length ? ' ' + a.join(' ') : ''}`
    if (VOID.has(tag)) return `${indent}${open} />`
    let kids
    if (tag === 'textarea') {
      const value = el.value
      return `${indent}${open}${value ? ` defaultValue=${attrValue(value)}` : ''} />`
    }
    kids = children(el, indent + '  ')
    if (kids.length === 0) return `${indent}${open} />`
    return `${indent}${open}>\n${kids.join('\n')}\n${indent}</${tag}>`
  }

  const root = document.querySelector('#root > *')
  return element(root, '      ')
})()
