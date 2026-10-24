import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Highlight } from './Highlight'
import { CheckIcon, ChevronDown } from './Icons'

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  /** Plain text used for type-ahead and the trigger tooltip when the label is not a string. */
  text?: string
  hint?: ReactNode
  disabled?: boolean
}

interface SelectProps<V extends string> {
  value: V
  options: SelectOption<V>[]
  onChange: (value: V) => void
  placeholder?: string
  'aria-label'?: string
  id?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  style?: CSSProperties
}

interface MenuPosition {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

const MENU_GAP = 6
const MENU_MAX = 320

function textOf<V extends string>(option: SelectOption<V>) {
  return option.text ?? (typeof option.label === 'string' ? option.label : String(option.value))
}

/** Keeps a fixed-position menu glued to its anchor (flips upwards near the bottom edge) and closes it on outside clicks. */
function useFloatingMenu(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  const [position, setPosition] = useState<MenuPosition | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - MENU_GAP - 8
    const above = rect.top - MENU_GAP - 8
    const width = Math.max(rect.width, 180)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    if (below >= Math.min(MENU_MAX, 220) || below >= above) {
      setPosition({ left, width, top: rect.bottom + MENU_GAP, maxHeight: Math.min(MENU_MAX, below) })
    } else {
      setPosition({ left, width, bottom: window.innerHeight - rect.top + MENU_GAP, maxHeight: Math.min(MENU_MAX, above) })
    }
  }, [anchorRef])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) onOutside()
    }
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      place()
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place, onOutside, anchorRef, menuRef])

  const style: CSSProperties | undefined = position
    ? { left: position.left, minWidth: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }
    : undefined
  return { position, style, flipped: position?.bottom != null }
}

function stopEscape(e: React.KeyboardEvent) {
  // Only the list closes; a surrounding modal or drawer must stay open.
  e.preventDefault()
  e.stopPropagation()
  e.nativeEvent.stopImmediatePropagation()
}

/**
 * Site-styled replacement for the native <select>: the open list is drawn in the store palette (the OS one is not),
 * rendered in a portal so tables and modals cannot clip it, and fully usable from the keyboard.
 */
export function Select<V extends string>({
  value,
  options,
  onChange,
  placeholder = '—',
  id,
  disabled,
  size = 'md',
  className,
  style,
  ...rest
}: SelectProps<V>) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typeahead = useRef({ text: '', at: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const closeOutside = useCallback(() => setOpen(false), [])
  const { position, style: menuStyle, flipped } = useFloatingMenu(open, triggerRef, menuRef, closeOutside)

  const openMenu = () => {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled))
    setOpen(true)
  }

  const close = useCallback((focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    if (option.value !== value) onChange(option.value)
    close()
  }

  useEffect(() => {
    if (!open || active < 0) return
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, position])

  const step = (from: number, delta: number) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + delta * i + options.length * 2) % options.length
      if (!options[next].disabled) return next
    }
    return from
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => step(i < 0 ? -1 : i, 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => step(i < 0 ? options.length : i, -1))
        return
      case 'Home':
        e.preventDefault()
        setActive(step(-1, 1))
        return
      case 'End':
        e.preventDefault()
        setActive(step(options.length, -1))
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        return
      case 'Escape':
        stopEscape(e)
        close()
        return
      case 'Tab':
        close(false)
        return
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now()
      const buffer = now - typeahead.current.at > 700 ? e.key : typeahead.current.text + e.key
      typeahead.current = { text: buffer, at: now }
      const match = options.findIndex((o) => !o.disabled && textOf(o).toLowerCase().startsWith(buffer.toLowerCase()))
      if (match >= 0) setActive(match)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={clsx('select-trigger', size === 'sm' && 'select-sm', open && 'open', !selected && 'placeholder', className)}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={rest['aria-label']}
        title={selected ? textOf(selected) : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="select-chevron" />
      </button>
      {open &&
        position &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            className={clsx('select-menu', flipped && 'up')}
            style={menuStyle}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={clsx('select-option', index === active && 'active', option.value === value && 'selected', option.disabled && 'disabled')}
                onPointerEnter={() => !option.disabled && setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
              >
                <span className="select-option-label">
                  {option.label}
                  {option.hint && <small>{option.hint}</small>}
                </span>
                {option.value === value && <CheckIcon size={16} className="select-check" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}

const AUTOCOMPLETE_LIMIT = 8

/** Free-text input with site-styled suggestions (replaces the OS-styled native <datalist>). */
export function Autocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  maxLength,
  id,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  maxLength?: number
  id?: string
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase()
    const unique = [...new Set(suggestions)]
    if (!needle) return unique.slice(0, AUTOCOMPLETE_LIMIT)
    const starts = unique.filter((s) => s.toLowerCase().startsWith(needle))
    const contains = unique.filter((s) => !s.toLowerCase().startsWith(needle) && s.toLowerCase().includes(needle))
    const list = [...starts, ...contains]
    return list.length === 1 && list[0].toLowerCase() === needle ? [] : list.slice(0, AUTOCOMPLETE_LIMIT)
  }, [value, suggestions])

  const visible = open && matches.length > 0
  const closeOutside = useCallback(() => setOpen(false), [])
  const { position, style: menuStyle, flipped } = useFloatingMenu(visible, inputRef, menuRef, closeOutside)

  const choose = (index: number) => {
    const match = matches[index]
    if (match == null) return
    onChange(match)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (matches.length ? (i + 1) % matches.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (matches.length ? (i <= 0 ? matches.length - 1 : i - 1) : -1))
    } else if (e.key === 'Enter' && visible && active >= 0) {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape' && visible) {
      stopEscape(e)
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
      />
      {visible &&
        position &&
        createPortal(
          <ul ref={menuRef} id={listId} role="listbox" className={clsx('select-menu', flipped && 'up')} style={menuStyle}>
            {matches.map((match, index) => (
              <li
                key={match}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={clsx('select-option', index === active && 'active')}
                onPointerEnter={() => setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
              >
                <span className="select-option-label">
                  <span>
                    <Highlight text={match} query={value} />
                  </span>
                </span>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
