/* build-menu.js — merges crawled data (.raw/parsed.json) with a curated
   EN/allergen overlay into data/menu.json (the single source of truth).
   Run: node build-menu.js   (re-runnable; safe to delete .raw afterwards) */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, '.raw', 'parsed.json'), 'utf8'));

// ---- 14 SFDA/EU allergen reference set ----
const ALLERGENS = [
  { key: 'gluten', ar: 'جلوتين', en: 'Gluten' },
  { key: 'crustaceans', ar: 'قشريات', en: 'Crustaceans' },
  { key: 'eggs', ar: 'بيض', en: 'Eggs' },
  { key: 'fish', ar: 'أسماك', en: 'Fish' },
  { key: 'peanuts', ar: 'فول سوداني', en: 'Peanuts' },
  { key: 'soy', ar: 'صويا', en: 'Soy' },
  { key: 'milk', ar: 'حليب', en: 'Milk' },
  { key: 'treenuts', ar: 'مكسرات', en: 'Tree nuts' },
  { key: 'celery', ar: 'كرفس', en: 'Celery' },
  { key: 'mustard', ar: 'خردل', en: 'Mustard' },
  { key: 'sesame', ar: 'سمسم', en: 'Sesame' },
  { key: 'sulphites', ar: 'كبريتات', en: 'Sulphites' },
  { key: 'lupin', ar: 'ترمس', en: 'Lupin' },
  { key: 'molluscs', ar: 'رخويات', en: 'Molluscs' }
];

// ---- category metadata (id -> name) confirmed by nav order + contents ----
const CATS = [
  { id: '22755', slug: 'pourover', ar: 'القهوة المقطّرة', en: 'Pour-Over', subAr: 'قهوة مختصة محضّرة بالتقطير', subEn: 'Specialty hand-brewed coffee' },
  { id: '22804', slug: 'espresso', ar: 'الإسبريسو', en: 'Espresso', subAr: 'حبوب مختصة فاخرة', subEn: 'Premium single-origin shots' },
  { id: '22756', slug: 'hot', ar: 'المشروبات الساخنة', en: 'Hot Drinks', subAr: 'إسبريسو ومشروبات حليب ساخنة', subEn: 'Espresso & hot milk drinks' },
  { id: '22757', slug: 'cold', ar: 'المشروبات الباردة', en: 'Cold Drinks', subAr: 'مشروبات قهوة مثلّجة', subEn: 'Iced coffee drinks' },
  { id: '22758', slug: 'matcha', ar: 'مشروبات ماتشا باردة', en: 'Cold Matcha', subAr: 'ماتشا يابانية مختصة', subEn: 'Japanese specialty matcha' },
  { id: '22759', slug: 'hibiscus', ar: 'كركديه', en: 'Hibiscus', subAr: 'كركديه طائفي منعش', subEn: 'Refreshing Taif hibiscus' },
  { id: '22760', slug: 'bakery', ar: 'المخبوزات والحلا', en: 'Bakery & Sweets', subAr: 'حلويات وكيك طازج', subEn: 'Fresh cakes & desserts' },
  { id: '22761', slug: 'addons', ar: 'الإضافات', en: 'Add-ons', subAr: 'إضافات وتعديلات على مشروبك', subEn: 'Extras & customizations' },
  { id: '23584', slug: 'mojito', ar: 'موهيتو', en: 'Mojito', subAr: 'موهيتو منعش بنكهات', subEn: 'Refreshing flavored mojitos' }
];

// ---- curated overlay: id -> { en, den (english desc), al (allergens[]) } ----
// nutrition (kcal/caffeine) intentionally null => pending café written approval (SFDA).
// _dupOf marks a duplicate row in the source to drop.
const OV = {
  '170272': { en: 'Diamante', den: 'Colombian, anaerobic process. Notes of blackcurrant, citrus, lavender & florals. Altitude 1400–1600 m.', al: [] },
  '170273': { en: 'V60 Ethiopia Sidamo', den: 'Ethiopian Sidamo heirloom. Fruity notes of blueberry, strawberry & grape. Natural process, 2000 m.', al: [] },
  '170275': { en: 'Coffee of the Day', den: 'Black filter coffee.', al: [] },
  '170276': { en: 'Cold Brew', den: 'Coffee steeped a full day for a high-concentration brew.', al: [] },
  '192502': { en: 'Ethiopia Kushere (Premium)', den: 'Premium Ethiopian coffee.', al: [] },
  '192998': { en: 'El Castillo Colombia', den: '', al: [] },
  '192999': { en: 'El Salvador', den: '', al: [] },
  '201079': { en: 'Tropical Fresh', den: '', al: [] },
  '180992': { en: 'El Salvador (Premium)', den: 'Premium El Salvador beans.', al: [] },
  '182671': { en: 'Ethiopia (Premium)', den: 'Espresso from the finest Ethiopian beans.', al: [] },
  '170278': { en: 'Macchiato', den: 'Double espresso, foam.', al: ['milk'] },
  '170279': { en: 'Hot Americano', den: 'Black coffee.', al: [] },
  '170280': { en: 'Cortado', den: 'Double espresso, milk.', al: ['milk'] },
  '170281': { en: 'Flat White', den: 'Double espresso, milk.', al: ['milk'] },
  '170282': { en: 'Cappuccino', den: 'Double espresso, milk.', al: ['milk'] },
  '170283': { en: 'Latte', den: 'Double espresso, milk.', al: ['milk'] },
  '170284': { en: 'Spanish Latte', den: 'Double espresso with our special Spanish recipe.', al: ['milk'] },
  '170288': { en: 'Caramel Latte', den: 'Milk, double espresso, caramel.', al: ['milk'] },
  '170289': { en: 'Hot Chocolate', den: 'Milk with Belgian chocolate.', al: ['milk'] },
  '170290': { en: 'Black Tea', den: 'English tea.', al: [] },
  '176539': { en: 'Coffee of the Day (Large)', den: 'Daily coffee from the finest beans (Costa Rican, Ethiopian, Colombian).', al: [] },
  '176540': { en: 'Coffee of the Day', den: 'Daily coffee from the finest beans (Costa Rican, Ethiopian, Colombian).', al: [] },
  '180991': { en: 'Green Tea', den: '', al: [] },
  '201078': { en: 'Coffee of the Day (Large)', den: '', al: [], _dupOf: '176539' },
  '170291': { en: 'Espresso Freddo', den: 'Steamed espresso, served cold.', al: [] },
  '170292': { en: 'Iced Americano', den: 'Black coffee.', al: [] },
  '170293': { en: 'Iced Latte', den: 'Double espresso with milk.', al: ['milk'] },
  '170294': { en: 'Iced Spanish Latte', den: 'Double espresso with our special Spanish recipe.', al: ['milk'] },
  '170298': { en: 'Caramel Macchiato', den: 'Espresso with foam.', al: ['milk'] },
  '170299': { en: 'Iced Chocolate', den: 'Milk with Belgian chocolate.', al: ['milk'] },
  '171004': { en: 'Water', den: '(Nova / Safa / Berain).', al: [] },
  '170300': { en: 'Classic Iced Matcha', den: 'Finest Japanese matcha, no additives. Milk options (soy, coconut, almond, dairy) + flavor add-ons.', al: ['milk'] },
  '170301': { en: 'Pink Matcha', den: 'Finest Japanese matcha, rose flavor, with soy milk.', al: ['soy'] },
  '170302': { en: 'Lavender Matcha', den: 'Finest Japanese matcha, lavender flavor, with coconut milk.', al: ['treenuts'] },
  '171003': { en: 'Berry Matcha', den: 'Finest Japanese matcha, berry flavor, soy milk, topped with freeze-dried berries.', al: ['soy'] },
  '170305': { en: 'Classic Hibiscus', den: '', al: [] },
  '170306': { en: 'Rose Hibiscus', den: 'Hibiscus with Taif rose flavor.', al: [] },
  '170309': { en: 'Chocolate Chip Cookie', den: 'Cookie with premium Belgian chocolate chips.', al: ['gluten', 'milk', 'eggs'] },
  '170310': { en: 'Coconut Mango Cake', den: 'Cake with mango sauce and coconut.', al: ['gluten', 'milk', 'eggs', 'treenuts'] },
  '170311': { en: 'Matilda Chocolate Cake', den: 'Matilda cake with Belgian chocolate.', al: ['gluten', 'milk', 'eggs'] },
  '170313': { en: 'Tiramisu', den: 'Premium ladyfinger layers soaked in coffee, cream, and a cocoa dusting.', al: ['gluten', 'milk', 'eggs'] },
  '170315': { en: 'Mango Cheesecake', den: 'Cheesecake topped with a mango sauce layer.', al: ['gluten', 'milk', 'eggs'] },
  '193000': { en: 'Dark Chocolate Cookie', den: 'Dark Belgian chocolate cookie.', al: ['gluten', 'milk', 'eggs'] },
  '193001': { en: 'Brownie', den: 'Premium brownie with Belgian chocolate.', al: ['gluten', 'milk', 'eggs'] },
  '201080': { en: 'Cinnamon Rolls', den: 'Cinnamon rolls.', al: ['gluten', 'milk', 'eggs'] },
  '170318': { en: 'Plant Milk Add-on (Almond / Coconut / Soy)', den: '', al: ['treenuts', 'soy'] },
  '170319': { en: 'Flavor Add-on', den: '', al: [] },
  '170977': { en: 'Hot Chocolate + Hot Espresso', den: '', al: ['milk'] },
  '170978': { en: 'Hot Chocolate + Iced Espresso', den: '', al: ['milk'] },
  '170303': { en: 'Blueberry Mojito', den: 'Mojito with blueberry and coconut flavor.', al: [] },
  '170304': { en: 'Peach Mojito', den: 'Mojito with peach and orange-blossom flavor.', al: [] }
};

// ---- estimated nutrition: id -> { kcal, caf } (mg caffeine) ----
// ESTIMATES for display per client choice; café confirms via admin. Shown with a disclaimer.
const NUT = {
  '170272': { kcal: 8, caf: 140 }, '170273': { kcal: 8, caf: 140 }, '170275': { kcal: 5, caf: 95 },
  '170276': { kcal: 5, caf: 200 }, '192502': { kcal: 8, caf: 140 }, '192998': { kcal: 8, caf: 140 },
  '192999': { kcal: 8, caf: 140 }, '201079': { kcal: 10, caf: 130 },
  '180992': { kcal: 10, caf: 125 }, '182671': { kcal: 10, caf: 125 },
  '170278': { kcal: 30, caf: 125 }, '170279': { kcal: 10, caf: 125 }, '170280': { kcal: 70, caf: 125 },
  '170281': { kcal: 120, caf: 130 }, '170282': { kcal: 110, caf: 125 }, '170283': { kcal: 150, caf: 125 },
  '170284': { kcal: 220, caf: 125 }, '170288': { kcal: 250, caf: 125 }, '170289': { kcal: 300, caf: 20 },
  '170290': { kcal: 2, caf: 47 }, '176539': { kcal: 10, caf: 150 }, '176540': { kcal: 8, caf: 110 },
  '180991': { kcal: 2, caf: 28 },
  '170291': { kcal: 15, caf: 125 }, '170292': { kcal: 10, caf: 125 }, '170293': { kcal: 140, caf: 125 },
  '170294': { kcal: 230, caf: 125 }, '170298': { kcal: 250, caf: 125 }, '170299': { kcal: 280, caf: 20 },
  '171004': { kcal: 0, caf: 0 },
  '170300': { kcal: 120, caf: 70 }, '170301': { kcal: 180, caf: 70 }, '170302': { kcal: 190, caf: 70 },
  '171003': { kcal: 200, caf: 70 },
  '170305': { kcal: 80, caf: 0 }, '170306': { kcal: 90, caf: 0 },
  '170309': { kcal: 220, caf: 5 }, '170310': { kcal: 400, caf: 0 }, '170311': { kcal: 410, caf: 10 },
  '170313': { kcal: 380, caf: 30 }, '170315': { kcal: 420, caf: 0 }, '193000': { kcal: 220, caf: 10 },
  '193001': { kcal: 350, caf: 15 }, '201080': { kcal: 330, caf: 0 },
  '170318': { kcal: 30, caf: 0 }, '170319': { kcal: 20, caf: 0 }, '170977': { kcal: 300, caf: 125 },
  '170978': { kcal: 300, caf: 125 },
  '170303': { kcal: 140, caf: 0 }, '170304': { kcal: 140, caf: 0 }
};

// café entered some descriptions with no spaces between visual lines — restore boundaries
function cleanDesc(s) {
  if (!s) return '';
  return s
    .replace(/([؀-ۿ])(إيحاءات|معالجة|إرتفاع|الإرتفاع|الارتفاع|إختيارات|اختيارات)/g, '$1 $2')
    .replace(/\)([؀-ۿ])/g, ') $1')
    .replace(/([؀-ۿ])\(/g, '$1 (')
    .replace(/\s+/g, ' ')
    .trim();
}

const warnings = [];
const catsOut = [];
let totalItems = 0;

for (const c of CATS) {
  const src = parsed[c.id];
  if (!src) { warnings.push('MISSING CATEGORY ' + c.id); continue; }
  const items = [];
  for (const it of src.items) {
    const ov = OV[it.id] || {};
    if (ov._dupOf) { warnings.push('dropped duplicate ' + it.id + ' "' + it.name + '" (dup of ' + ov._dupOf + ')'); continue; }
    if (!OV[it.id]) warnings.push('NO OVERLAY for ' + it.id + ' ' + it.name);
    const price = it.price ? Number(String(it.price).replace(/,/g, '')) : null;
    const nut = NUT[it.id] || { kcal: null, caf: null };
    if (!NUT[it.id]) warnings.push('NO NUTRITION for ' + it.id + ' ' + it.name);
    items.push({
      id: it.id,
      name_ar: it.name,
      name_en: ov.en || 'TODO',
      desc_ar: cleanDesc(it.desc),
      desc_en: ov.den !== undefined ? ov.den : 'TODO',
      price: price,
      currency: 'SAR',
      image: null,
      allergens: ov.al || [],
      allergens_confirmed: false,
      kcal: nut.kcal,
      caffeine_mg: nut.caf,
      nutrition_estimated: true,
      high_sodium: false,
      available: true
    });
    totalItems++;
  }
  catsOut.push({ id: c.id, slug: c.slug, name_ar: c.ar, name_en: c.en, sub_ar: c.subAr, sub_en: c.subEn, items });
}

const menu = {
  _meta: {
    schema_version: 1,
    generated: '2026-06-05',
    source: 'https://luxury-crop.easymenu.site (crawled — data only, no design)',
    note: 'kcal & caffeine_mg are ESTIMATES for display (nutrition_estimated=true) — café confirms via admin; UI shows a disclaimer. allergens are inferred from ingredients and must be confirmed (allergens_confirmed=false).'
  },
  brand: {
    name_ar: 'محصول فاخر',
    name_en: 'Luxury Crop',
    tagline_ar: 'قهوة مختصة',
    tagline_en: 'Specialty Coffee',
    logo: 'assets/logo.png',
    theme: { bg: '#ffffff', ink: '#0a0a0a', accent: '#e1352b', muted: '#6b6b6b' },
    location_ar: 'الطائف',
    location_en: 'Taif',
    rating: 4.8,
    instagram: 'https://instagram.com/luxurycrop1',
    tiktok: '',
    maps: 'https://maps.app.goo.gl/AF6MZdCkoQJ8n6vCA',
    whatsapp_admin: '201065736335'
  },
  allergen_ref: ALLERGENS,
  categories: catsOut
};

fs.writeFileSync(path.join(ROOT, 'data', 'menu.json'), JSON.stringify(menu, null, 2));
console.log('Total categories:', catsOut.length, '| Total items:', totalItems);
console.log('\n--- WARNINGS ---');
warnings.forEach((w) => console.log(' -', w));
let noimg = 0;
catsOut.forEach((c) => c.items.forEach((i) => { if (!i.image) noimg++; }));
console.log('\nItems with no source image:', noimg, 'of', totalItems);
