import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }))
vi.mock('react', () => ({ useRef: <T>(value:T) => ({current:value}), useEffect: (fn:() => void | (() => void)) => {
  const cleanup=fn(); if (cleanup) effects.cleanups.push(cleanup)
} }))
import { useBarcodeScanner } from './useBarcodeScanner'

class ElementFixture {
  isContentEditable=false
  constructor(public tagName='DIV') {}
}
let now:number
let modal:boolean
let active:ElementFixture | null
let listeners:Map<string, (event:KeyboardEvent) => void>
const scanned=vi.fn()
function key(value:string, delay=10, target:ElementFixture | null=null) {
  now+=delay
  const event={key:value,target,timeStamp:now,preventDefault:vi.fn(),defaultPrevented:false} as unknown as KeyboardEvent
  listeners.get('keydown')?.(event)
  return event
}
function scan(value:string, suffix='Enter') { for (const char of value) key(char); key(suffix) }
beforeEach(() => {
  vi.useFakeTimers(); scanned.mockReset(); now=100; modal=false; active=null; listeners=new Map()
  vi.stubGlobal('HTMLElement',ElementFixture)
  vi.stubGlobal('performance',{now:()=>now})
  vi.stubGlobal('document',{querySelector:()=>modal ? {} : null,get activeElement(){return active}})
  vi.stubGlobal('window',{setTimeout,clearTimeout,addEventListener:(name:string, fn:(event:KeyboardEvent)=>void)=>listeners.set(name,fn),
    removeEventListener:(name:string)=>listeners.delete(name)})
})
afterEach(() => { effects.cleanups.splice(0).forEach(fn=>fn()); vi.useRealTimers(); vi.unstubAllGlobals() })
describe('keyboard-wedge scanner safety', () => {
  for (const suffix of ['Enter','Tab']) it(`accepts a fast scan exactly once with ${suffix}`, () => {
    useBarcodeScanner({onScan:scanned}); scan('2901234567898',suffix); vi.runAllTimers()
    expect(scanned).toHaveBeenCalledExactlyOnceWith('2901234567898')
  })
  it('accepts a scan without a suffix after idle', () => {
    useBarcodeScanner({onScan:scanned}); for (const char of 'SKU-123') key(char); vi.advanceTimersByTime(180)
    expect(scanned).toHaveBeenCalledExactlyOnceWith('SKU-123')
  })
  it('does not treat slow manual typing as a scan', () => {
    useBarcodeScanner({onScan:scanned}); for (const char of '123456') key(char,120); key('Enter'); vi.runAllTimers()
    expect(scanned).not.toHaveBeenCalled()
  })
  it('preserves the first digit across a short cold-start delay', () => {
    useBarcodeScanner({onScan:scanned}); key('2'); key('9',120); for(const char of '01234567896')key(char); key('Enter')
    expect(scanned).toHaveBeenCalledExactlyOnceWith('2901234567896')
  })
  it('does not scan from inputs and discards a partial buffer on focus change', () => {
    useBarcodeScanner({onScan:scanned}); key('9'); key('9'); key('9',10,new ElementFixture('INPUT')); scan('ABCD')
    expect(scanned).toHaveBeenCalledExactlyOnceWith('ABCD')
  })
  it('does not change the cart while any modal is open, including a pending idle flush', () => {
    useBarcodeScanner({onScan:scanned}); for (const char of '123456') key(char); modal=true; vi.runAllTimers(); scan('123456')
    expect(scanned).not.toHaveBeenCalled()
  })
  it('drops incomplete scans on blur and ignores a disabled reader', () => {
    useBarcodeScanner({onScan:scanned}); for (const char of '123456') key(char); listeners.get('blur')?.({} as KeyboardEvent); vi.runAllTimers()
    expect(scanned).not.toHaveBeenCalled()
    effects.cleanups.splice(0).forEach(fn=>fn()); useBarcodeScanner({enabled:false,onScan:scanned}); scan('123456')
    expect(scanned).not.toHaveBeenCalled()
  })
})
