-- Migration 003: Seed default products

INSERT INTO products (name, slug, description, features, ideal_for, capacity, delivery_time, sort_order)
VALUES
(
  'Plataforma 360 Tradicional',
  'plataforma-360-tradicional',
  'A Plataforma 360 Tradicional captura vídeos incríveis em 360 graus, perfeita para espaços menores e eventos intimistas. Os vídeos ficam prontos em menos de 1 minuto!',
  '["Vídeos em 360° com efeitos especiais", "Pronta entrega em menos de 1 minuto", "Compartilhamento instantâneo via QR Code", "Iluminação profissional incluída", "Operador dedicado durante todo o evento"]'::jsonb,
  'Espaços menores, festas, aniversários, confraternizações',
  '1-4 pessoas por vez',
  'Vídeos prontos em menos de 1 minuto',
  1
),
(
  'Plataforma 360 Aérea',
  'plataforma-360-aerea',
  'A Plataforma 360 Aérea é a experiência definitiva em vídeos 360 graus! Comporta até 12 pessoas simultaneamente com qualidade profissional cinematográfica.',
  '["Comporta até 12 pessoas simultaneamente", "Qualidade profissional cinematográfica", "Efeitos especiais avançados (slow motion, confetes digitais)", "Ideal para grandes eventos e festas", "Experiência única e memorável", "Operador e técnico dedicados"]'::jsonb,
  'Casamentos, formaturas, eventos corporativos, festas grandes',
  'Até 12 pessoas simultaneamente',
  'Vídeos prontos em poucos minutos',
  2
),
(
  'Espelho Mágico Fotográfico',
  'espelho-magico-fotografico',
  'O Espelho Mágico Fotográfico oferece impressão instantânea de fotos com qualidade de estúdio. Uma experiência interativa e divertida que encanta todos os convidados!',
  '["Impressão instantânea de fotos", "Qualidade de estúdio profissional", "Molduras e layouts personalizáveis", "Tela interativa com animações", "Compartilhamento digital via QR Code", "Props e acessórios incluídos"]'::jsonb,
  'Casamentos, aniversários, eventos corporativos, feiras',
  'Individual ou em grupo',
  'Fotos impressas na hora',
  3
);
