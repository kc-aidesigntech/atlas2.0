grant usage on schema atlas to anon, authenticated;
grant select on table atlas.z_code_headers to anon, authenticated;

alter table atlas.z_code_headers enable row level security;

drop policy if exists z_code_headers_public_select on atlas.z_code_headers;
create policy z_code_headers_public_select on atlas.z_code_headers
for select
to public
using (true);
