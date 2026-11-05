const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function fakeDom() {
  const document = {
    createElement(tag) {
      return {
        tagName: tag,
        className: '',
        attributes: {},
        children: [],
        style: {},
        textContent: '',
        setAttribute(name, value) { this.attributes[name] = String(value); },
        append(...children) { this.children.push(...children); }
      };
    }
  };
  const context = vm.createContext({ document, URL, window: {} });
  vm.runInContext(source('assets/profile-ui.js'), context);
  return context.window.SQFProfiles;
}

test('média 4,5 gera exatamente 90% de estrelas preenchidas, não cinco estrelas integrais', () => {
  const ui = fakeDom();
  const star = ui.stars(4.5);
  assert.equal(star.children[1].style.width, '90%');
  assert.equal(star.attributes['aria-label'], 'Nota 4,5 de 5');
  assert.equal(star.children[0].attributes['aria-hidden'], 'true');
  assert.equal(star.children[1].attributes['aria-hidden'], 'true');
  const line = ui.ratingLine([{ rating: 5 }, { rating: 4 }]);
  assert.equal(line.children[0].children[1].style.width, '90%');
  assert.equal(line.children[1].textContent, '4,5 / 5');
  assert.match(line.children[2].textContent, /2 avaliações/);
});

test('sem avaliações, não há pontuação arbitrária', () => {
  const ui = fakeDom();
  const line = ui.ratingLine([]);
  assert.equal(line.children[0].children[1].style.width, '0%');
  assert.match(line.children[1].textContent, /Ainda sem avaliações/);
});

test('migração restringe fotos por proprietário e publicação só de prestadores', () => {
  const sql = source('supabase/migrations/20261103_01_profissionais_avaliacoes.sql');
  for (const rule of ['profiles_avatar_owner', 'profiles_public_provider_only', 'photo_path_owner', 'sqf_reviews_insert']) {
    assert.ok(sql.includes(rule), `regra de segurança ausente: ${rule}`);
  }
  assert.match(sql, /drop policy if exists sqf_.* on storage\.objects/);
});


test('consulta pública de avaliações não requer ID interno de cliente', () => {
  const frontend = source('assets/provider.js');
  const sql = source('supabase/migrations/20261103_01_profissionais_avaliacoes.sql');
  assert.match(frontend, /sqf_public_reviews/);
  const hardened=source('supabase/migrations/20261103_03_confianca_seguranca.sql');
  assert.match(hardened, /sqf_public_reviews/);
  assert.doesNotMatch(hardened.match(/create or replace function public\.sqf_public_reviews[\s\S]*?\$\$;/)?.[0] || '', /r\.reviewer_id/);
});
