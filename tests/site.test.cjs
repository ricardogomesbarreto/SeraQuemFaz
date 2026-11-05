const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['index.html','categorias.html','entrar.html','cadastro.html','painel.html','termos.html','privacidade.html','categoria.html','prestador.html'];

test('páginas HTML existem com nome oficial, idioma e CSS unificado', () => {
  for (const file of pages) {
    const html=read(file);
    assert.match(html,/<html lang="pt-BR">/);
    assert.match(html,/<title>[^<]*SERÁ QUEM FAZ\?/);
    assert.match(html,/assets\/site\.css/);
    assert.match(html,/assets\/brand\/favicon\.ico/);
    assert.doesNotMatch(html,/(?:Nova pasta|quemfaz_cadastro\/|href="\/API\/)/i);
  }
});

test('links e assets locais referenciados nas páginas resolvem no pacote', () => {
  for (const file of pages) {
    const html=read(file);
    const tags=html.match(/<(a|script|link|img)\b[^>]*>/gi) || [];
    for (const tag of tags) {
      for (const m of tag.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
        const url=m[1];
        if (/^(?:#|https?:|mailto:|tel:|data:)/i.test(url)) continue;
        const clean = decodeURIComponent(url.split(/[?#]/)[0]);
        const full = path.resolve(root, clean);
        assert.ok(full.startsWith(root+path.sep), `path traversal em ${file}: ${url}`);
        assert.ok(fs.existsSync(full), `link quebrado em ${file}: ${url}`);
      }
    }
  }
});

test('a homepage consulta cidade antes de entrar no catálogo', () => {
  const html=read('index.html');
  assert.match(html,/<form[^>]*action="categorias\.html"[^>]*class="search-panel city-first-form"[^>]*method="get"/);
  assert.match(html,/<input[^>]*id="homeCity"[^>]*type="search"/);
  assert.match(html,/<input[^>]*id="homeCityId"[^>]*name="cidade"/);
  assert.doesNotMatch(html, /id="busca"/);
});

test('JS do catálogo não injeta HTML vindo do banco', () => {
  const script=read('assets/categories.js');
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.match(script, /heading\.textContent\s*=/);
  assert.match(script, /body\.textContent\s*=/);
  assert.match(script, /categoryImage/);
});

test('nenhuma API de geolocalização automática nem marketing numérico não comprovado', () => {
  const scripts=fs.readdirSync(path.join(root,'assets')).filter(f=>f.endsWith('.js')).map(f=>read('assets/'+f)).join('\n');
  assert.doesNotMatch(scripts, /getCurrentPosition\s*\(/);
  assert.doesNotMatch(read('index.html'), /\+\s*(?:1000|8000)\b/);
});

test('existe integração de login, cadastro, reset e logout com Supabase Auth', () => {
  const auth=read('assets/auth.js'), account=read('assets/account.js');
  assert.match(auth,/\.auth\.signInWithPassword\(/);
  assert.match(auth,/\.auth\.signUp\(/);
  assert.match(auth,/\.auth\.resetPasswordForEmail\(/);
  assert.match(auth,/\.auth\.updateUser\(/);
  assert.match(auth,/PASSWORD_RECOVERY/);
  assert.match(account,/\.auth\.getUser\(/);
  assert.match(account,/\.auth\.signOut\(/);
  assert.ok(fs.existsSync(path.join(root,'painel.html')));
});

test('chave publicável não é service_role e URL é do projeto existente', () => {
  const cfg=read('assets/supabase-config.js');
  assert.match(cfg,/sb_publishable_/);
  assert.match(cfg,/supabase\.co/);
  assert.doesNotMatch(cfg,/eyJhbGci|service_role\s*[:=]/);
});

test('busca de categoria é case/acento-insensitive, inclusive descrição', () => {
  const context = { window:{} }; vm.createContext(context);
  vm.runInContext(read('assets/utils.js'), context);
  const util=context.window.SQFUtils;
  assert.equal(util.matchesCategory({name:'Mecânico',description:'Manutenção automotiva'}, 'mecanico'),true);
  assert.equal(util.matchesCategory({name:'Mecânico',description:'Manutenção automotiva'}, 'manutencao'),true);
  assert.equal(util.matchesCategory({name:'Mecânico',description:'Manutenção automotiva'}, 'eletricista'),false);
  assert.equal(util.matchesCategory({name:'Mecânico'}, ''),true);
});

test('URLs de imagens inseguras são bloqueadas', () => {
  const context = { window:{}, URL }; vm.createContext(context);
  vm.runInContext(read('assets/utils.js'), context);
  const safe=context.window.SQFUtils.safeImageUrl;
  for (const uri of ['javascript:alert(1)','data:text/html,<svg>','http://example.com/image.png','file:///etc/passwd','/relative.png'])
    assert.equal(safe(uri),null);
  assert.equal(safe('https://example.com/image.png'),'https://example.com/image.png');
});

test('documentação distingue contratação não implementada das avaliações previstas no código', () => {
  const privacy=read('privacidade.html'), legal=read('termos.html');
  assert.match(privacy,/LGPD/);
  assert.match(legal,/homologação/);
  assert.match(read('README.md'),/RLS/);
});


test('cabeçalho e rodapé com a mesma identidade em todas as páginas', () => {
  const normalized = src => src.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0]
    .replace(/aria-current="page" /g, '').replace(/ class="current"/g, '').replace(/class="current" /g,'')
    .replace(/ class="current" data-nav=/g, ' data-nav=');
  const headers = pages.map(page => normalized(read(page)));
  assert.ok(headers.every(Boolean));
  assert.ok(headers.every(h => /assets\/brand\/logo-horizontal\.png/.test(h)));
  assert.ok(pages.every(page => read(page).includes('<footer class="site-footer">')));
  assert.ok(pages.every(page => read(page).includes('assets/site.js')));
  assert.ok(pages.every(page => read(page).includes('href="categorias.html"')));
});

test('sidebar oferece pesquisa, ordenação, filtro por imagem e fechamento móvel', () => {
  const html=read('categorias.html'), js=read('assets/categories.js');
  for(const id of ['catalogSidebar','filterToggle','filterClose','filterBackdrop','sortSelect','withImage','categoryQuery','resetFilters','resultsDescription','catalogCount']) {
    assert.ok(html.includes(`id="${id}"`), `falta controle ${id}`);
  }
  assert.match(js,/Intl\.Collator\('pt-BR'/);
  assert.match(js,/categoryImage/);
  assert.match(js,/showFilters\(false\)/);
  assert.match(js,/window\.history\.replaceState/);
  assert.match(js,/data-search-suggestion/);
});

test('landing page contém conteúdo institucional coerente e FAQ sem dados fabricados', () => {
  const html=read('index.html');
  for(const term of ['hero-trust','value-strip','audience-section','faq-section','professional-section','serviço'])
    assert.ok(html.includes(term),`faltou seção ${term}`);
  assert.match(html,/SERÁ QUEM FAZ\?/);
  assert.doesNotMatch(html,/\+8000|\+1000|5 estrelas|milhares de clientes/i);
});

test('README centraliza proposta, status, roadmap e organização de diretórios', () => {
  const readme=read('README.md');
  for(const term of ['Proposta de valor','catálogo com sidebar','Funcionalidades e estágio atual','Roadmap proposto','LGPD','RLS','Supabase','Santa Inês'])
    assert.ok(readme.toLowerCase().includes(term.toLowerCase()),`documentação sem ${term}`);
  assert.ok(readme.length > 3500,'documentação principal incompleta');
  assert.match(readme,/docs\/README\.md/);
});

test('marca oficial é reutilizada nos nove cabeçalhos e rodapés', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /brand-logo[^>]+logo-horizontal\.png/);
    assert.match(html, /footer-brand[\s\S]*?logo-horizontal-footer\.png/);
  }
  for(const file of ['logo-horizontal.png','logo-vertical.png','logo-monocromatica.png','simbolo.png','icone-192.png','icone-512.png','favicon.ico'])
    assert.ok(fs.statSync(path.join(root,'assets/brand',file)).size>200, `Asset de marca inválido: ${file}`);
});

test('cada categoria direciona ao detalhe e exibe profissionais publicados', () => {
  const cat = read('assets/categories.js');
  assert.match(cat, /categoria\.html\?id=/);
  const detail = read('assets/category-detail.js');
  for(const fragment of [".from('categories')", ".from('provider_services')", ".from('profiles')", "sqf_public_reviews", 'prestador.html?id='])
    assert.ok(detail.includes(fragment), `ausente na página de categoria: ${fragment}`);
  assert.doesNotMatch(detail, /\.innerHTML\s*=/);
});

test('perfil do prestador publica portfólio, avaliações e pontuação real', () => {
  const src = read('assets/provider.js');
  for (const fragment of ['portfolio_photos','provider_services','reviews','reviewer_id','rating','comment','reviewForm', 'account_type'])
    assert.ok(src.includes(fragment),`campo ausente no perfil público: ${fragment}`);
  assert.match(src, /publishedReviews/);
  assert.doesNotMatch(src, /\.innerHTML\s*=/);
  const ui = read('assets/profile-ui.js');
  assert.match(ui, /reduce\(/);
  assert.match(ui, /toFixed\(1\)/);
  assert.match(ui, /textContent/);
});

test('painel do prestador permite editar serviços, avatar e galeria', () => {
  const html = read('painel.html');
  for (const id of ['avatarFile','profilePublic','profileBio','newServiceCategory','newServiceTitle','portfolioFile','portfolioCaption','myServices','myGallery'])
    assert.ok(html.includes(`id="${id}"`),`campo não encontrado: ${id}`);
  const src=read('assets/account.js');
  for(const term of ['storage.from(bucket).upload(', "from('provider_services').insert", "from('portfolio_photos').insert", "from('profiles').update"])
    assert.ok(src.includes(term),`implementação ausente: ${term}`);
  assert.match(src,/image\/png/);
  assert.match(src,/5\*1024\*1024/);
});

test('migration cria RLS, armazenamento controlado, notas e restrições', () => {
  const sql=read('supabase/migrations/20261103_01_profissionais_avaliacoes.sql');
  for(const term of ['create table if not exists public.profiles','create table if not exists public.provider_services','create table if not exists public.portfolio_photos','create table if not exists public.reviews', 'enable row level security','auth.uid()', 'sqf_avatar_insert','sqf_portfolio_insert','sqf_reviews_insert','review_not_self','unique(provider_id, reviewer_id)', "'sqf-avatars'", "'sqf-portfolios'"])
    assert.ok(sql.toLowerCase().includes(term.toLowerCase()),`regra de backend ausente: ${term}`);
  assert.match(sql,/grant update \(rating, comment\) on public\.reviews/);
  assert.match(sql,/sqf_profiles_read[\s\S]*?is_public/);
});

test('README descreve o banco consolidado e a homologação pendente sem declarar liberação comercial', () => {
  const doc=read('README.md');
  assert.match(doc,/sqf_account_settings/);
  assert.match(doc,/5\.571 municípios/);
  assert.match(doc,/não repita o histórico SQL/i);
  assert.match(doc,/cobrança real|checkout desativado|pagamento.*desativad/i);
  assert.match(doc,/direitos de uso.*não estão garantidos/i);
});

test('documenta conflito entre migrações legadas e backend consolidado', () => {
  const doc=read('supabase/README.md');
  const state=read('docs/operacao/STATUS-SUPABASE-v3.9.8.md');
  assert.match(doc,/sqf_request_verification/);
  assert.match(doc,/NÃO execute|Não execute/);
  assert.match(state,/5\.571 municípios/);
  assert.match(state,/Nenhuma cobrança real ativada|Nenhuma cobrança habilitada|controle de assinatura obrigatória/i);
});