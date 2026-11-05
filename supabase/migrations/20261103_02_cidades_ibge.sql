-- SERÁ QUEM FAZ? — Etapa 2: busca por cidade (código oficial do IBGE).
-- Depende de 20261103_01_profissionais_avaliacoes.sql.
-- Aplicar inicialmente em homologação. Não faz importação de municípios:
-- o seletor carrega o catálogo oficial do IBGE no navegador.

alter table public.profiles add column if not exists city_ibge text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='sqf_profiles_city_ibge_format' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint sqf_profiles_city_ibge_format
      check (city_ibge is null or city_ibge ~ '^[0-9]{7}$');
  end if;
end $$;

create index if not exists idx_sqf_profiles_public_city
  on public.profiles(city_ibge,id) where account_type='prestador' and is_public=true;

-- Concessão restrita: o usuário pode atualizar a própria cidade graças à RLS
-- criada na migração anterior; account_type e id não são editáveis.
grant update (city_ibge) on public.profiles to authenticated;

-- Vincular cidade a novos cadastros do Supabase Auth.
create or replace function public.sqf_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_city_code text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'city_ibge','')), '');
  v_city_label text := left(trim(coalesce(new.raw_user_meta_data ->> 'city','')),100);
begin
  if v_city_code !~ '^[0-9]{7}$' then v_city_code := null; end if;
  insert into public.profiles (id, full_name, account_type, city, city_ibge)
  values (
    new.id,
    left(case when char_length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) >= 2
      then trim(new.raw_user_meta_data ->> 'full_name')
      when char_length(coalesce(split_part(new.email, '@', 1), '')) >= 2
      then split_part(new.email, '@', 1)
      else 'Usuário' end, 120),
    case when new.raw_user_meta_data ->> 'account_type' = 'prestador' then 'prestador' else 'cliente' end,
    v_city_label,
    v_city_code
  ) on conflict (id) do nothing;
  return new;
end;
$$;

-- Migração cuidadosa: preenche somente registros com cidade ainda vazia.
update public.profiles p
set city_ibge = nullif(trim(coalesce(u.raw_user_meta_data ->> 'city_ibge','')), ''),
    city = case when p.city = '' then left(trim(coalesce(u.raw_user_meta_data ->> 'city','')),100) else p.city end
from auth.users u
where u.id = p.id and p.city_ibge is null
  and (u.raw_user_meta_data ->> 'city_ibge') ~ '^[0-9]{7}$';

-- Perfis legados sem city_ibge não são mostrados em pesquisa geográfica
-- até que o titular salve novamente a cidade pelo painel.
-- IMPORTANTE: esta migração não confere validade geográfica dos códigos
-- no servidor (apenas o formato). Para produção, recomenda-se tabela IBGE
-- importada e FK sobre ela, além de controle de atendimento multi-cidades.
