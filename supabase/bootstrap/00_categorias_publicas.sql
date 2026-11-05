-- SERÁ QUEM FAZ? - preparação opcional do catálogo de categorias.
-- IMPORTANTE: backup antes de aplicar; execute somente no projeto correto.
-- Esta preparação é pré-requisito da migração 01 quando a tabela categories não existe.
-- NÃO modifica registros existentes e NÃO cria profissionais fictícios.
-- Novas linhas têm image_url=NULL: fotos originais só podem ser restauradas pelo administrador.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Exige estrutura compatível; não tenta remodelar um catálogo já existente.
do $$
begin
  if exists (
    select 1 from (values ('id'),('name'),('description'),('image_url'),('status'),('created_at')) as required(column_name)
    where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='categories' and c.column_name=required.column_name)
  ) then
    raise exception 'categories existe, mas não tem as colunas exigidas. Revise o esquema antes de alterar';
  end if;
end $$;

-- Habilita RLS; apenas categorias explicitamente ativas podem ser lidas por essa política.
-- Antes de produção, audite políticas antigas para evitar permissões mais amplas.
alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;
do $$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='categories' and policyname='sqf_categories_active_read') then
   create policy sqf_categories_active_read on public.categories for select to anon, authenticated
   using (status='active');
 end if;
end $$;

-- Insere sugestões editoriais somente se a tabela não tiver nenhuma linha.
-- Não modifica status, IDs, URLs nem imagens das categorias já cadastradas.
do $$
declare has_auto_id boolean;
begin
  select (column_default is not null or is_identity='YES') into has_auto_id
  from information_schema.columns
  where table_schema='public' and table_name='categories' and column_name='id';

  if not has_auto_id then
    raise notice 'categories.id sem valor automático: catálogo não foi preenchido. Verifique o tipo de ID e a migração original';
  elsif not exists(select 1 from public.categories) then
    insert into public.categories (name,description,status) values
    ('Advogado', 'Serviços jurídicos e consultoria legal.'),
    ('Ar-Condicionado', 'Instalação, limpeza e manutenção de sistemas de climatização.'),
    ('Arquitetura', 'Projetos arquitetônicos e consultoria de ambientes.'),
    ('Automação Residencial', 'Instalação e configuração de automação residencial.'),
    ('Barbeiro', 'Cortes masculinos, barba e cuidados de barbearia.'),
    ('Buffet', 'Alimentação e serviços de buffet para eventos.'),
    ('Cabeleireiro', 'Cortes, penteados e tratamentos capilares.'),
    ('Construção', 'Obras, reformas e serviços de construção civil.'),
    ('Contador', 'Serviços contábeis, fiscais e orientação tributária.'),
    ('Costureiro', 'Confecção, ajustes e reparos de roupas.'),
    ('Decoração', 'Decoração de ambientes e eventos.'),
    ('Designer', 'Design gráfico, identidade visual e criação de artes.'),
    ('Eletricista', 'Instalação, reparo e manutenção de redes elétricas.'),
    ('Encanador', 'Reparos hidráulicos, vazamentos e tubulações.'),
    ('Eventos', 'Serviços para festas, eventos e celebrações.'),
    ('Fotocópias e Impressões', 'Cópias, impressões e digitalização de documentos.'),
    ('Fotógrafo', 'Fotografia profissional e ensaios.'),
    ('Fotógrafo de Eventos', 'Fotografia de casamentos, festas e eventos.'),
    ('Informática', 'Manutenção de computadores e suporte técnico.'),
    ('Jardinagem', 'Cuidado de plantas, jardins e áreas verdes.'),
    ('Limpeza', 'Limpeza residencial, comercial e pós-obra.'),
    ('Manicure', 'Cuidados e estética de unhas.'),
    ('Maquiagem', 'Produção de maquiagem para eventos.'),
    ('Mecânica', 'Diagnóstico, manutenção e reparos automotivos.'),
    ('Montagem de Móveis', 'Montagem e instalação de móveis.'),
    ('Motoboy', 'Entregas e transportes locais.'),
    ('Mudanças', 'Transporte e apoio em mudanças.'),
    ('Pedreiro', 'Alvenaria, acabamento e pequenos reparos.'),
    ('Pintura', 'Pintura residencial, comercial e acabamento.'),
    ('Professor Particular', 'Aulas particulares e reforço escolar.'),
    ('Refrigeração', 'Manutenção e reparo de equipamentos de refrigeração.'),
    ('Serralheria', 'Fabricação e reparo de estruturas metálicas.'),
    ('Técnico em Celulares', 'Manutenção e reparo de smartphones.'),
    ('Técnico em Eletrodomésticos', 'Reparo de equipamentos domésticos.'),
    ('Veterinário', 'Cuidados veterinários e orientação animal.'),
    ('Vidraçaria', 'Instalação e manutenção de vidros e espelhos.'),
    ('Segurança Eletrônica', 'Instalação de câmeras, alarmes e sensores.'),
    ('Energia Solar', 'Instalação e manutenção de sistemas fotovoltaicos.'),
    ('Beleza e Estética', 'Cuidados pessoais e tratamentos estéticos.'),
    ('Marketing Digital', 'Criação e gestão de campanhas digitais.'),
    ('Cuidador de Idosos', 'Acompanhamento e apoio nas atividades diárias.'),
    ('Fisioterapia', 'Atendimentos de fisioterapia conforme habilitação profissional.'),
    ('Diarista', 'Serviços de limpeza e organização por diária.'),
    ('Lavanderia', 'Lavagem, passadoria e cuidados com roupas.'),
    ('Instalação de Internet', 'Instalação e manutenção de conexões e redes.'),
    ('Confeitaria', 'Bolos, doces e produção sob encomenda.'),
    ('Paisagismo', 'Planejamento e conservação de jardins e paisagens.'),
    ('Transporte', 'Serviços de transporte e pequenas cargas.'),
    ('Personal Trainer', 'Treinamento físico individualizado com profissional habilitado.'),
    ('Soldador', 'Serviços de soldagem e manutenção metálica.'),
    ('Impermeabilização', 'Aplicação de sistemas para prevenção de infiltrações.');
  else
    raise notice 'Categorias já existentes mantidas sem nenhuma alteração';
  end if;
end $$;

-- Após execução, valide: SELECT status, count(*) FROM public.categories GROUP BY status;
-- A UI mostra o catálogo real somente quando Supabase retorna categorias ativas.
