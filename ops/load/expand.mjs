import { FIXTURE_KIND, validateFixture } from './spec.mjs'

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const marker = (fixture, account) => ({ kind: FIXTURE_KIND, runId: fixture.runId, shops: fixture.shops,
  variantsPerShop: fixture.variantsPerShop, salesPerShop: fixture.salesPerShop,
  actorId: account.actorId, ownerId: account.ownerId, role: account.role })

export function expandedFixture(fixture, decode) {
  validateFixture(fixture, 'smoke', decode, 0)
  if (fixture.baseUrl !== 'http://127.0.0.1:55321' || fixture.shops !== 2
    || fixture.variantsPerShop > 1200 || fixture.salesPerShop > 18250) throw new Error('Extension reservee au petit laboratoire a deux boutiques')
  const accounts = fixture.accounts.map((account) => ({ ...account }))
  for (const owner of accounts.filter((account) => account.role === 'admin')) {
    const cashiers = accounts.filter((account) => account.ownerId === owner.actorId && account.role === 'cashier')
    if (cashiers.length !== 3) throw new Error('Trois caissiers fictifs requis par boutique')
    owner.expectedSales = 18250
    cashiers.forEach((account, index) => { account.expectedSales = Math.floor(18250 / 3) + (index < 18250 % 3 ? 1 : 0) })
  }
  return { ...fixture, variantsPerShop: 1200, salesPerShop: 18250, accounts }
}

export function expansionSql(before, after) {
  const owners = before.accounts.filter((account) => account.role === 'admin')
  const identities = before.accounts.map((account, index) => `(${quote(account.actorId)}::uuid,
    ${quote(JSON.stringify(marker(before, account)))}::jsonb,
    ${quote(JSON.stringify(marker(after, after.accounts[index])))}::jsonb)`).join(',')
  const blocks = owners.map((owner, index) => {
    const prefix = owner.barcode.replace(/1$/, '')
    if (!owner.barcode.endsWith('-1')) throw new Error('Code fictif initial requis')
    const cashiers = before.accounts.filter((account) => account.ownerId === owner.actorId && account.role === 'cashier')
    return `
      DO $$ BEGIN
        IF (SELECT count(*) FROM public.products WHERE user_id=${quote(owner.actorId)}) NOT IN (${before.variantsPerShop},1200)
          OR (SELECT count(*) FROM public.sales WHERE user_id=${quote(owner.actorId)}) NOT IN (${before.salesPerShop},18250)
          THEN RAISE EXCEPTION 'Volume local inattendu'; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=${quote(owner.productId)} AND user_id=${quote(owner.actorId)}
          AND barcode=${quote(owner.barcode)}) THEN RAISE EXCEPTION 'Variante initiale absente'; END IF;
      END $$;
      INSERT INTO public.products(id,user_id,name,product_group_id,barcode,buying_price,selling_price,quantity,currency,status)
        SELECT md5(${quote(owner.actorId)} || '-product-' || n)::uuid,${quote(owner.actorId)},
          'Produit fictif ' || ((n-1)/2+1),md5(${quote(owner.actorId)} || '-' || ((n-1)/2))::uuid,
          ${quote(prefix)} || n,400,1000,100,'XOF','active'
        FROM generate_series(${before.variantsPerShop + 1},1200) n ON CONFLICT (id) DO NOTHING;
      CREATE TEMP TABLE fixture_sales_${index} ON COMMIT DROP AS
        SELECT md5(${quote(owner.actorId)} || '-sale-' || n)::uuid id,n,
          '2025-01-01T00:00:00Z'::timestamptz + ((n-1)::double precision/18250)*interval '365 days' created_at
        FROM generate_series(${before.salesPerShop + 1},18250) n;
      INSERT INTO public.sales(id,user_id,seller_id,subtotal,discount,tax,total,amount_paid,amount_due,payment_method,payment_status,created_at)
        SELECT id,${quote(owner.actorId)},(ARRAY[${cashiers.map((account) => quote(account.actorId) + '::uuid').join(',')}])[(n-1)%3+1],
          1000,0,0,1000,1000,0,'cash','completed',created_at FROM fixture_sales_${index} ON CONFLICT(id) DO NOTHING;
      INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price,total,unit_cost,created_at)
        SELECT s.id,p.id,p.name,1,1000,1000,400,s.created_at FROM fixture_sales_${index} s
          JOIN public.products p ON p.user_id=${quote(owner.actorId)} AND p.barcode=${quote(prefix)} || ((s.n-1)%1200+1)
        WHERE NOT EXISTS(SELECT 1 FROM public.sale_items i WHERE i.sale_id=s.id);
      INSERT INTO public.sale_payments(sale_id,user_id,recorded_by_id,amount,payment_method,created_at)
        SELECT s.id,s.user_id,s.seller_id,1000,'cash',s.created_at FROM public.sales s JOIN fixture_sales_${index} f ON f.id=s.id
        WHERE NOT EXISTS(SELECT 1 FROM public.sale_payments p WHERE p.sale_id=s.id);
      DO $$ BEGIN
        IF (SELECT count(*) FROM public.products WHERE user_id=${quote(owner.actorId)})<>1200
          OR (SELECT count(*) FROM public.sales WHERE user_id=${quote(owner.actorId)})<>18250
          OR (SELECT count(*) FROM public.sale_items i JOIN public.sales s ON s.id=i.sale_id WHERE s.user_id=${quote(owner.actorId)})<>18250
          OR (SELECT count(*) FROM public.sale_payments WHERE user_id=${quote(owner.actorId)})<>18250
          THEN RAISE EXCEPTION 'Extension locale incomplete'; END IF;
      END $$;`
  })
  return `BEGIN;
    SET LOCAL statement_timeout='120s';
    SELECT pg_advisory_xact_lock(hashtext('saytu-yef-load-lab-expand'));
    CREATE TEMP TABLE expected_identity(actor_id uuid,old_body jsonb,new_body jsonb) ON COMMIT DROP;
    INSERT INTO expected_identity VALUES ${identities};
    DO $$ BEGIN
      IF (SELECT count(*) FROM load_lab.identity)<>${before.accounts.length}
        OR EXISTS(SELECT 1 FROM expected_identity e LEFT JOIN load_lab.identity i USING(actor_id)
          WHERE i.actor_id IS NULL OR (i.body<>e.old_body AND i.body<>e.new_body))
        THEN RAISE EXCEPTION 'Identite du laboratoire differente'; END IF;
    END $$;
    -- Fixture construction only; never exercise checkout with stock triggers disabled.
    ALTER TABLE public.sale_items DISABLE TRIGGER USER;
    ${blocks.join('\n')}
    ALTER TABLE public.sale_items ENABLE TRIGGER USER;
    UPDATE load_lab.identity i SET body=e.new_body FROM expected_identity e WHERE e.actor_id=i.actor_id;
    COMMIT;
    ANALYZE public.profiles; ANALYZE public.products; ANALYZE public.sales; ANALYZE public.sale_items; ANALYZE public.sale_payments;`
}
