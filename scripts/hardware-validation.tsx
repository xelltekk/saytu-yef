import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import JsBarcode from 'jsbarcode'
import { Printer, ScanBarcode, ShieldCheck, X } from 'lucide-react'
import { useBarcodeScanner } from '../src/hooks/useBarcodeScanner'
import { printReceipt, printInvoice, type ReceiptData } from '../src/lib/receipt'
import { printBarcodeLabels } from '../src/lib/barcodes'

const code='2901234567896'
const receipt:ReceiptData={businessName:'TEST MATERIEL - SANS VENTE',reference:'TEST-LECTEUR',date:'13/10/2026',methodLabel:'Test',statusLabel:'Document test',
  items:[{name:'Article de controle',qty:2,unitPrice:35000,total:70000}],subtotal:70000,discountAmount:7000,taxAmount:0,total:63000,amountPaid:30000,amountDue:33000}
function Probe(){
  const [value,setValue]=useState(''),[count,setCount]=useState(0),[modal,setModal]=useState(false)
  const image=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{if(image.current)JsBarcode(image.current,code,{format:'EAN13',width:3,height:90,margin:30,fontSize:20})},[])
  useBarcodeScanner({onScan:next=>{setValue(next);setCount(n=>n+1)}})
  return <main>
    <header><ScanBarcode size={24}/><h1>Saytu Yef</h1><span>Validation boutique / Hors production</span></header>
    <section><h2>Lecteur</h2><canvas ref={image}/><dl><dt>Code attendu</dt><dd>{code}</dd><dt>Code lu</dt><dd data-testid="scan-value">{value || '-'}</dd>
      <dt>Lectures</dt><dd data-testid="scan-count">{count}</dd><dt>Resultat</dt><dd>{value?value===code?'Conforme':'Code different':'En attente'}</dd></dl>
      <label>Saisie libre<input aria-label="Saisie libre"/></label>
      <button onClick={()=>setModal(true)}><ShieldCheck size={18}/>Controle paiement</button></section>
    <section><h2>Imprimante</h2><div className="actions">
      <button onClick={()=>printReceipt(receipt)}><Printer size={18}/>Ticket test 80 mm</button>
      <button onClick={()=>printInvoice({...receipt,invoiceNumber:'TEST-FACTURE'})}><Printer size={18}/>Facture test A4</button></div></section>
    <section><h2>Etiquette</h2><button onClick={()=>printBarcodeLabels([{id:'test',name:'TEST MATERIEL',barcode:code,selling_price:35000,copies:1,currency:'XOF'}],'TEST MATERIEL')}><Printer size={18}/>Etiquette test A4</button></section>
    {modal&&<div className="overlay"><div role="dialog" aria-modal="true" aria-label="Controle paiement"><h2>Controle paiement</h2>
      <button onClick={()=>setModal(false)} aria-label="Fermer"><X size={18}/></button><p>Document test</p></div></div>}
  </main>
}
createRoot(document.getElementById('root')!).render(<Probe/> )
