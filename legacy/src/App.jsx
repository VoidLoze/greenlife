import { useEffect, useMemo, useState } from 'react'
import './App.css'
import catalogMaster from '../public/products2.json'

const categories = [
  { id: 'all', label: { ru: 'Все', kk: 'Барлық' } },
  { id: 'Средства для стирки', label: { ru: 'Средства для стирки', kk: 'Кір жуу құралдары' } },
  { id: 'Средства для мытья посуды и продуктов', label: { ru: 'Средства для мытья посуды и продуктов', kk: 'Ыдыс-аяқ пен тағамдарды жуу құралдары' } },
  { id: 'Средства для уборки дома', label: { ru: 'Средства для уборки дома', kk: 'Үй тазалау құралдары' } },
  { id: 'Хозяйственные товары', label: { ru: 'Хозяйственные товары', kk: 'Шаруашылық тауарлары' } },
  { id: 'Уход за волосами', label: { ru: 'Уход за волосами', kk: 'Шаш күтімі' } },
  { id: 'Товары для дома и личного ухода', label: { ru: 'Товары для дома и личного ухода', kk: 'Үй және жеке күтім тауарлары' } },
  { id: 'Уход за собой и товары для здоровья', label: { ru: 'Уход за собой и товары для здоровья', kk: 'Өзіңізге күтім және денсаулық тауарлары' } },
]

const topTabs = [
  { id: 'catalog', label: { ru: 'Коллекция', kk: 'Жинақ' } },
  { id: 'partner-program', label: { ru: 'Партнерство', kk: 'Серіктестік' } },
]

const partnerProgramOptions = [
  {
    id: 'partner-discount-card',
    name: 'Выбор дисконтной карты',
    brand: 'Greenleaf',
    badge: 'Партнерская программа',
    category: 'Партнерская программа',
    summary: 'Подходит для клиентов, которые хотят начать сотрудничество с накопительной системой скидок.',
    description: 'Дисконтная карта позволяет получать выгодные условия при последующих покупках и участвовать в партнерской программе.',
    price: 0,
    partnerPrice: 0,
    unit: 'карта',
    palette: 'sage',
    image: '/cards/IMG_5334.jpeg',
    accents: ['Накопительная система скидок', 'Удобная программа лояльности', 'Подходит для регулярных клиентов'],
  },
  {
    id: 'partner-card-plus-item',
    name: 'Карта + доп товар',
    brand: 'Greenleaf',
    badge: 'Партнерская программа',
    category: 'Партнерская программа',
    summary: 'Комбо-опция: карта плюс дополнительный товар в рамках партнерского участия.',
    description: 'Опция включает карту участия и дополнительный товар для более выгодного участия в программе с расширенными условиями.',
    price: 0,
    partnerPrice: 0,
    unit: 'комбо',
    palette: 'mint',
    image: '/cards/IMG_5335.jpeg',
    accents: ['Дополнительный товар', 'Более выгодные условия', 'Подходит для расширенного участия'],
  },
  {
    id: 'partner-full-cost',
    name: 'Товар по 100% стоимости',
    brand: 'Greenleaf',
    badge: 'Партнерская программа',
    category: 'Партнерская программа',
    summary: 'Выбор без скидки: товар приобретается по полной стоимости, без участия в бонусной программе.',
    description: 'Этот вариант подходит тем клиентам, кто покупает товар по полной стоимости без скидок и без участия в партнерской акции.',
    price: 0,
    partnerPrice: 0,
    unit: 'товар',
    palette: 'gold',
    image: '/cards/IMG_5336.jpeg',
    accents: ['Полная стоимость', 'Без акции', 'Простой стандартный вариант'],
  },
]

const fallbackImage = '/imagesR/1.png'
const paletteCycle = ['rose', 'mint', 'sky', 'peach', 'sage', 'blue', 'gold', 'lime', 'purple', 'forest', 'pink', 'amber']
const directTitleFixes = {
  'деликатного белья)': 'iLiFE Гель для стирки деликатного белья, 1 кг',
  'приготовлением': 'iLiFE Гель для стирки деликатного белья, 1 кг',
  'подействовать': 'iLiFE Средство для устранения неприятного запаха, 500 г',
  'пластик, резина)': 'iLiFE Средство для защиты пластика и резины, 500 г',
}

const resolveCategory = (title = '', description = '', type = '') => {
  const haystack = `${title} ${description}`.toLowerCase()

  if (/(yibeile.*детская зубная паста.*тройным экстрактом фруктов|детская зубная паста.*тройным экстрактом фруктов)/i.test(haystack)) {
    return 'Товары для дома и личного ухода'
  }

  if (/(carich.*молочко для тела с фруктовыми кислотами|молочко для тела с фруктовыми кислотами)/i.test(haystack)) {
    return 'Товары для дома и личного ухода'
  }

  const normalizedType = String(type || '').trim()
  if (normalizedType) {
    return normalizedType
  }

  if (/(стирк|порошок|отбелив|средство для стирки)/i.test(haystack)) {
    return 'Средства для стирки'
  }

  if (/(мытья посуды|посуды|продукт|чистящее|средство для мытья)/i.test(haystack)) {
    return 'Средства для мытья посуды и продуктов'
  }

  if (/(уборк|пол|ванн|туалет|стиральн|дезинф|салфетки для пола|средство для уборки)/i.test(haystack)) {
    return 'Средства для уборки дома'
  }

  if (/(хозяйствен|салфет|губка|пластина|ловушка|пакет|тряпк|ткань|металлическая|мочалк|подгуз|салфетки|полотенце)/i.test(haystack)) {
    return 'Хозяйственные товары'
  }

  if (/(волос|шампун|кондиционер|маска для волос|бальзам|спрей для волос|масло для волос)/i.test(haystack)) {
    return 'Уход за волосами'
  }

  if (/(зубная паста|зубная|паста для зубов|паста)/i.test(haystack)) {
    return 'Уход за собой и товары для здоровья'
  }

  if (/(крем|лосьон|мыло|гель для душа|гель|пена|скраб|тоник|молочко|щетка|бальзам|маска)/i.test(haystack)) {
    return 'Товары для дома и личного ухода'
  }

  if (/(витамин|капсула|таблетк|чай|коллаген|пробиот|омега|масло|суплемент|пептид|здоровье|гигиен|прокладки|дезодорант)/i.test(haystack)) {
    return 'Уход за собой и товары для здоровья'
  }

  return 'Товары для дома и личного ухода'
}

const normalizeTitle = (title = '', description = '') => {
  const raw = String(title || '').trim().replace(/\s+/g, ' ')
  const source = String(description || title || '').trim().replace(/\s+/g, ' ')

  if (!raw) return source

  const directFix = directTitleFixes[raw.toLowerCase()] || directTitleFixes[raw.toLowerCase().replace(/[.,;!?)]$/g, '').trim()]
  if (directFix) {
    return directFix
  }

  const sizeMatch =
    raw.match(/^(.+?)(?:,\s*|\s+)(\d+\s*(?:г|мл|кг|л))(?:\s*[),.;]|$)/i) ||
    raw.match(/^(.+?)(?:\s*\(\s*)(\d+\s*(?:г|мл|кг|л))\s*\)(?=\s|$)/i)

  if (sizeMatch) {
    const name = sizeMatch[1].replace(/[\s,]+$/, '').trim()
    const measure = sizeMatch[2].trim()
    return `${name}, ${measure}`
  }

  const stopMatch = raw.match(
    /^(.+?)(?:\s+(?:Содержит|Подходит|Обеспечивает|Увлажняет|Поддерживает|Глубоко|Эффективно|Легко|Создает|Очищает|Питает|Удаляет|Снимает|Делает|Освежает|Устраняет|Обогащен|Бережно|Мягко|Без|Натуральное|Гипоаллергенные|Для|Способствует|Усиляет|Регулирует|Повышает|Восстанавливает|Сохраняет|Рекомендуется|Обладает|Идеально|Разработана)\b.*)$/i,
  )

  if (stopMatch) {
    return stopMatch[1].trim()
  }

  if (raw.length > 90 || /^(деликатного|приготовлением|содержит|подходит|безопасен|мягкие|глубоко|легко|очищает|обеспечивает|мгновенно)/i.test(raw)) {
    const fallbackMatch =
      source.match(/^(.+?)(?:,\s*|\s+)(\d+\s*(?:г|мл|кг|л))(?:\s*[),.;]|$)/i) ||
      source.match(/^(.+?)(?:\s*\(\s*)(\d+\s*(?:г|мл|кг|л))\s*\)(?=\s|$)/i)

    if (fallbackMatch) {
      const name = fallbackMatch[1].replace(/[\s,]+$/, '').trim()
      const measure = fallbackMatch[2].trim()
      return `${name}, ${measure}`
    }
  }

  return raw
}

const buildProductDescription = (title = '', category = '') => {
  const text = String(title || '').toLowerCase()

  if (/стирк|порошок|гель|средство для стирки|салфетки для пола|средство для мытья|пятен|чистки|отбелив|дезодор|мытья/i.test(text)) {
    return 'Эффективное средство для стирки, уборки и очистки поверхностей. Подходит для ежедневного использования и помогает поддерживать чистоту дома.'
  }

  if (/шампун|бальзам|маска для волос|кондиционер|смывка|ополаскиватель|средство для волос/i.test(text)) {
    return 'Средство для ухода за волосами и кожей головы. Помогает бережно очищать, смягчать и поддерживать здоровый блеск.'
  }

  if (/крем|лосьон|гель для душа|молочко|мыло|тоник|скраб|пена|лосьон для тела|гель для тела/i.test(text)) {
    return 'Средство для ежедневного ухода за кожей. Обеспечивает мягкость, комфорт и поддержание свежести в течение дня.'
  }

  if (/детск|подгуз|салфетк|зубная паста|щетка|зубная щетка|для малышей|для детей/i.test(text)) {
    return 'Детский уход для бережного очищения, комфорта и ежедневного использования. Подходит для мягкого и безопасного ухода.'
  }

  if (/витамин|капсула|таблетк|чай|коллаген|пробиот|омега|масло|бальзам|суплемент|пептид|глюкозамин|кальций|крем для лица|маска для лица/i.test(text)) {
    return 'Средство для поддержания здоровья, ежедневного ухода и комфортного самочувствия. Подходит для регулярного применения.'
  }

  if (/салфетк|полотенце|тряпк|хлопок|бумажн|микрофибр|ткань|пакет|тряпка/i.test(text)) {
    return 'Практичное средство для уборки и повседневного ухода дома. Удобно в применении и подходит для регулярного использования.'
  }

  if (category === 'Продукты для здоровья') {
    return 'Продукт для ежедневного ухода и поддержки здоровья. Подходит для регулярного применения в рамках повседневной заботы.'
  }

  if (category === 'Косметика и уход') {
    return 'Косметическое средство для ухода за телом, лицом и волосами. Делает повседневный уход простым и комфортным.'
  }

  return 'Удобное средство для повседневного использования. Помогает поддерживать чистоту, комфорт и заботу в быту.'
}

const buildAccents = (title = '', category = '') => {
  const text = String(title || '').toLowerCase()

  if (/стирк|порошок|средство для стирки|мытья|чистки|дезодор/i.test(text)) {
    return ['Подходит для ежедневной уборки', 'Эффективно очищает', 'Удобно в использовании']
  }

  if (/шампун|бальзам|маска для волос|кондиционер|ополаскиватель/i.test(text)) {
    return ['Уход за волосами', 'Поддерживает мягкость', 'Для регулярного использования']
  }

  if (/крем|гель для душа|мыло|лосьон|молочко|пена/i.test(text)) {
    return ['Мягкий уход', 'Поддерживает комфорт', 'Ежедневное применение']
  }

  if (/детск|подгуз|салфетк|зубная паста|щетка/i.test(text)) {
    return ['Детский комфорт', 'Бережный уход', 'Безопасное использование']
  }

  if (/витамин|капсула|таблетк|чай|пробиот|омега|коллаген|пептид/i.test(text)) {
    return ['Поддержка здоровья', 'Комфортный ежедневный уход', 'Регулярное применение']
  }

  if (category === 'Товары для дома') {
    return ['Для дома и быта', 'Удобный формат', 'Ежедневная польза']
  }

  return ['Повседневный уход', 'Удобно использовать', 'Надёжный результат']
}

const normalizeProduct = (product, index) => {
  const title = normalizeTitle(product.title || product.name || 'Товар', product.description || product.summary || '')
  const price = Number(product.price || 0)
  const id = product.id || `greenleaf-${String(index + 1).padStart(4, '0')}`
  const category = product.category || product.type || resolveCategory(title, product.description || '', product.type || '')
  const description = buildProductDescription(title, category)
  const orderedImage = `${index + 1}.png`

  return {
    ...product,
    id,
    name: title,
    brand: product.brand || (title.toLowerCase().includes('ilife') ? 'iLiFE' : title.toLowerCase().includes('carich') ? 'CARICH' : 'Greenleaf'),
    category,
    price,
    partnerPrice: Math.round(price / 2),
    unit: product.unit || '',
    badge: product.badge || 'Каталог',
    summary: description.slice(0, 120),
    description,
    accents: Array.isArray(product.accents) && product.accents.length ? product.accents : buildAccents(title, category),
    palette: product.palette || paletteCycle[index % paletteCycle.length],
    image: `/imagesR/${orderedImage}`,
  }
}

const products = [...catalogMaster].map((product, index) => normalizeProduct(product, index))

const storageKey = 'greenleaf-cart'
const supportPhone = '77076173928'
const supportPhoneDisplay = '+7 707 617 39 28'

const categoryLabelMap = {
  ru: {
    'Средства для стирки': 'Средства для стирки',
    'Средства для мытья посуды и продуктов': 'Средства для мытья посуды и продуктов',
    'Средства для уборки дома': 'Средства для уборки дома',
    'Хозяйственные товары': 'Хозяйственные товары',
    'Уход за волосами': 'Уход за волосами',
    'Товары для дома и личного ухода': 'Товары для дома и личного ухода',
    'Уход за собой и товары для здоровья': 'Уход за собой и товары для здоровья',
  },
  kk: {
    'Средства для стирки': 'Кір жуу құралдары',
    'Средства для мытья посуды и продуктов': 'Ыдыс-аяқ пен тағамдарды жуу құралдары',
    'Средства для уборки дома': 'Үй тазалау құралдары',
    'Хозяйственные товары': 'Шаруашылық тауарлары',
    'Уход за волосами': 'Шаш күтімі',
    'Товары для дома и личного ухода': 'Үй және жеке күтім тауарлары',
    'Уход за собой и товары для здоровья': 'Өзіңізге күтім және денсаулық тауарлары',
  },
}

const normalizeCategoryLabel = (value, language = 'ru') => {
  const raw = String(value || '')
  if (!raw) return language === 'kk' ? 'Каталог' : 'Каталог'
  const exact = categoryLabelMap[language]?.[raw]
  if (exact) return exact
  const fallback = categories.find((category) => category.id === raw)
  if (fallback) return fallback.label[language]
  return raw
}

const translateProductName = (title, language = 'ru') => {
  if (language !== 'kk') return title

  let translated = String(title || '')

  const replacements = [
    ['iLiFE Гель для стирки', 'iLiFE Кір жуу гелі'],
    ['Гель для стирки против чесоточного зудня', 'Чесоткадан қорғайтын кір жуу гелі'],
    ['Гель для стирки цветного белья “Защита цвета”', 'Түсті киімдерге арналған түс қорғау кір жуу гелі'],
    ['Отбеливающий гель для стирки с энзимами', 'Энзимдермен ақартатын кір жуу гелі'],
    ['Многофункциональный гель для стирки', 'Көпфункционалды кір жуу гелі'],
    ['Многофункциональный гель для стирки (цветочный аромат)', 'Көпфункционалды кір жуу гелі (гүлді хош иіс)'],
    ['Моющее средство с ароматом чая', 'Шай хош иісті жуғыш құрал'],
    ['Моющее средство с фруктовым ароматом', 'Жеміс хош иісті жуғыш құрал'],
    ['Моющее средство с энзимами и минеральной солью', 'Энзимдер мен минералды тұзбен жуғыш құрал'],
    ['Средство для мытья фруктов, овощей, посуды и столовых приборов (дезинфицирующее)', 'Жемістерді, көкөністерді, ыдыс-аяқ пен ас үй құралдарын жуу (дезинфекциялау) құралы'],
    ['Дезодорирующее средство для одежды (антибактериальное)', 'Киімге арналған антимикробты дезодорант'],
    ['Средство для удаления неприятного запаха', 'Ыңғайсыз иісті кетіру құралы'],
    ['Гель для мытья', 'Жуу гелі'],
    ['Гель для душа', 'Душ гелі'],
    ['Мыло', 'Сабын'],
    ['Крем', 'Крем'],
    ['Лосьон', 'Лосьон'],
    ['Шампунь', 'Шампунь'],
    ['Кондиционер', 'Кондиционер'],
    ['Бальзам', 'Бальзам'],
    ['Маска для волос', 'Шаш маскасы'],
    ['Средство для волос', 'Шашқа арналған құрал'],
    ['Пенка', 'Пена'],
    ['Скраб', 'Скраб'],
    ['Тоник', 'Тоник'],
    ['Спрей', 'Спрей'],
    ['Зубная паста', 'Тіс пастасы'],
    ['Щетка', 'Щетка'],
    ['Мочалка', 'Мочалка'],
    ['Дезодорант', 'Дезодорант'],
    ['Салфетки', 'Салфетка'],
    ['Полотенце', 'Сүлгі'],
    ['Пакет', 'Қап'],
    ['Тряпка', 'Түтік'],
  ]

  replacements.forEach(([from, to]) => {
    translated = translated.replace(from, to)
  })

  return translated
}

const translateProductCopy = (product, language = 'ru') => {
  const isKk = language === 'kk'
  if (!isKk) {
    return {
      ...product,
      name: product.name,
      category: normalizeCategoryLabel(product.category, 'ru'),
      summary: product.summary,
      description: product.description,
      accents: product.accents || [],
    }
  }

  const accentMap = {
    'Подходит для ежедневной уборки': 'Күнделікті тазалау үшін жарайды',
    'Эффективно очищает': 'Тиімді тазалайды',
    'Удобно в использовании': 'Қолдану ыңғайлы',
    'Уход за волосами': 'Шаш күтімі',
    'Поддерживает мягкость': 'Жұмсақтықты сақтайды',
    'Для регулярного использования': 'Тұрақты қолдануға',
    'Мягкий уход': 'Жұмсақ күтім',
    'Поддерживает комфорт': 'Қайырымдылықты сақтайды',
    'Ежедневное применение': 'Күнделікті қолдану',
    'Детский комфорт': 'Балаларға ыңғайлы',
    'Бережный уход': 'Әдемі күтім',
    'Безопасное использование': 'Қауіпсіз қолдану',
    'Поддержка здоровья': 'Денсаулықты қолдау',
    'Комфортный ежедневный уход': 'Ыңғайлы күнделікті күтім',
    'Регулярное применение': 'Тұрақты қолдану',
    'Для дома и быта': 'Үй және тұрмыстық қажеттілік үшін',
    'Удобный формат': 'Ыңғайлы формат',
    'Ежедневная польза': 'Күнделікті пайда',
    'Повседневный уход': 'Күнделікті күтім',
    'Удобно использовать': 'Қолдану ыңғайлы',
    'Надёжный результат': 'Сенімді нәтиже',
  }

  const descriptionMap = {
    'Эффективное средство для стирки, уборки и очистки поверхностей. Подходит для ежедневного использования и помогает поддерживать чистоту дома.': 'Тиімді кір жуу, тазалау және бетін тазарту құралы. Күнделікті қолдануға жарайды және үйдегі тазалықты сақтауға көмектеседі.',
    'Средство для ухода за волосами и кожей головы. Помогает бережно очищать, смягчать и поддерживать здоровый блеск.': 'Шаш пен шаш түбінің күтімі үшін құрал. Беріктеу, жұмсарту және сау жылтырлықты сақтау үшін көмектеседі.',
    'Средство для ежедневного ухода за кожей. Обеспечивает мягкость, комфорт и поддержание свежести в течение дня.': 'Күнделікті тері күтімі үшін құрал. Жұмсақтық, жайлылық және күн бойы сергік сезім береді.',
    'Детский уход для бережного очищения, комфорта и ежедневного использования. Подходит для мягкого и безопасного ухода.': 'Балаларға арналған жұмсақ тазалау, жайлылық және күнделікті қолдану үшін күтім. Жұмсақ әрі қауіпсіз күтімге жарайды.',
    'Средство для поддержания здоровья, ежедневного ухода и комфортного самочувствия. Подходит для регулярного применения.': 'Денсаулықты сақтау, күнделікті күтім және жайлы өзін-өзі сезіну үшін құрал. Тұрақты қолдануға жарайды.',
    'Практичное средство для уборки и повседневного ухода дома. Удобно в применении и подходит для регулярного использования.': 'Үй тазалау мен күнделікті күтім үшін практикалық құрал. Қолдану ыңғайлы және тұрақты пайдалану үшін жарайды.',
    'Продукт для ежедневного ухода и поддержки здоровья. Подходит для регулярного применения в рамках повседневной заботы.': 'Күнделікті күтім мен денсаулықты қолдау үшін өнім. Күнделікті қамқорлық аясында тұрақты қолдануға жарайды.',
    'Косметическое средство для ухода за телом, лицом и волосами. Делает повседневный уход простым и комфортным.': 'Дене, бет және шаш күтімі үшін косметикалық құрал. Күнделікті күтімді жеңіл әрі жайлы әрі жасайды.',
    'Удобное средство для повседневного использования. Помогает поддерживать чистоту, комфорт и заботу в быту.': 'Күнделікті қолдануға ыңғайлы құрал. Таза, жайлы және үй жағдайындағы қамқорлықты сақтауға көмектеседі.',
  }

  const translatedDescription = descriptionMap[product.description] || product.description
  const translatedSummary = translatedDescription
    ? translatedDescription.length > 120
      ? `${translatedDescription.slice(0, 117).trim()}...`
      : translatedDescription
    : product.summary

  return {
    ...product,
    name: translateProductName(product.name || product.title, 'kk'),
    category: normalizeCategoryLabel(product.category, 'kk'),
    summary: translatedSummary,
    description: translatedDescription,
    accents: (product.accents || []).map((accent) => accentMap[accent] || accent),
  }
}

const translations = {
  ru: {
    cart: 'Корзина',
    city: 'г. Алматы',
    address: 'ул. Бонапарта 5',
    telegram: 'Telegram',
    catalog: 'Коллекция',
    partner: 'Партнерство',
    all: 'Все',
    noResults: 'По вашему запросу ничего не найдено.',
    searchPlaceholder: 'Поиск по товарам',
    search: 'Поиск',
    catalogTitle: 'Каталог',
    heroTag: 'Maison Greenleaf',
    heroTitle: 'Тишина, красота и забота в каждом ритуале',
    heroText: 'Подборка средств для дома, тела и повседневного комфорта — созданная для спокойного, утончённого образа жизни.',
    viewCatalog: 'Смотреть каталог',
    telegramCTA: 'Написать в Telegram',
    stat1: 'Редкая подборка',
    stat2: 'Партнёрские цены',
    stat3: 'WhatsApp заказ',
    productDetails: 'Подробнее',
    addToCart: 'В корзину',
    emptyCart: 'Пока пусто. Добавьте товары из каталога.',
    total: 'Итого',
    orderWhatsApp: 'Заказать в WhatsApp',
    volume: 'Объём:',
    retailPrice: 'Розничная цена',
    partnerPrice: 'Партнёрская цена',
    partnerProgram: 'Партнерская программа',
    partnerTitle: 'Подберите удобный формат участия',
    choose: 'Выбрать',
    brand: 'Greenleaf',
    partnerEmpty: 'Партнерской программы',
    partnerTiers: ['Премиум', 'Стандарт', 'Базовая'],
    partnerPriceLabel: 'Стоимость',
    partnerPartnerLabel: 'Партнёрская',
    partnerCardSerials: ['DISCOUNT CARD', 'MEMBERSHIP CARD', 'STANDARD CARD'],
  },
  kk: {
    cart: 'Себет',
    city: 'Алматы қ.',
    address: 'Бонапарт 5 көш.',
    telegram: 'Telegram',
    catalog: 'Жинақ',
    partner: 'Серіктестік',
    all: 'Барлық',
    noResults: 'Сіздің сұранысыңызға ештеңе табылмады.',
    searchPlaceholder: 'Тауарларды іздеу',
    search: 'Іздеу',
    catalogTitle: 'Каталог',
    heroTag: 'Maison Greenleaf',
    heroTitle: 'Тыныштық, сұлулық және күтім әрбір рәсімде',
    heroText: 'Үй, дене және күнделікті жайлылық үшін құралдар — тыныш, refined өмір салтына арналған.',
    viewCatalog: 'Каталогты көру',
    telegramCTA: 'Telegram-ға жазу',
    stat1: 'Сирек жинақ',
    stat2: 'Серіктестік бағалары',
    stat3: 'WhatsApp тапсырыс',
    productDetails: 'Толығырақ',
    addToCart: 'Себетке',
    emptyCart: 'Әлі бос. Каталогтан тауар қосыңыз.',
    total: 'Барлығы',
    orderWhatsApp: 'WhatsApp арқылы тапсырыс беру',
    volume: 'Көлем:',
    retailPrice: 'Баспасөз бағасы',
    partnerPrice: 'Серіктестік бағасы',
    partnerProgram: 'Серіктестік бағдарламасы',
    partnerTitle: 'Қатысу үшін ыңғайлы формат таңдаңыз',
    choose: 'Таңдау',
    brand: 'Greenleaf',
    partnerEmpty: 'Серіктестік бағдарламасы',
    partnerTiers: ['Премиум', 'Стандарт', 'Базалық'],
    partnerPriceLabel: 'Бағасы',
    partnerPartnerLabel: 'Серіктестік',
    partnerCardSerials: ['Жеңілдік картасы', 'Мүшелік картасы', 'Стандартты карта'],
  },
}

const getLocalizedPartnerOption = (product, index, language = 'ru') => {
  const baseAccents = {
    'partner-discount-card': ['Жинақтылық жүйесі', 'Ыңғайлы адалдық бағдарламасы', 'Тұрақты клиенттерге жарайды'],
    'partner-card-plus-item': ['Қосымша тауар', 'Көбірек тиімді шарттар', 'Кеңейтілген қатысуға жарайды'],
    'partner-full-cost': ['Толық баға', 'Акциясыз', 'Қарапайым стандартты нұсқа'],
  }

  if (language !== 'kk') {
    return {
      ...product,
      name: product.name,
      summary: product.summary,
      tier: translations.ru.partnerTiers[index] || product.name,
      priceLabel: translations.ru.partnerPriceLabel,
      partnerLabel: translations.ru.partnerPartnerLabel,
      serial: translations.ru.partnerCardSerials[index] || 'CARD',
      accents: product.accents,
    }
  }

  const partnerNames = {
    'partner-discount-card': 'Жеңілдік картасын таңдау',
    'partner-card-plus-item': 'Карта + қосымша тауар',
    'partner-full-cost': '100% бағамен тауар',
  }

  const partnerSummaries = {
    'partner-discount-card': 'Клиенттер үшін жинақтылық жүйесі бар, әрі қарай сатып алуларда тиімді шарттар алуға мүмкіндік беретін нұсқа.',
    'partner-card-plus-item': 'Комбо-опция: қатысу картасы плюс қосымша тауар, кеңейтілген қатысу шарттарымен.',
    'partner-full-cost': 'Жеңілдіксіз нұсқа: тауар толық бағамен, бонустық бағдарлама қатысуынсыз сатып алынады.',
  }

  return {
    ...product,
    name: partnerNames[product.id] || product.name,
    summary: partnerSummaries[product.id] || product.summary,
    tier: translations.kk.partnerTiers[index] || product.name,
    priceLabel: translations.kk.partnerPriceLabel,
    partnerLabel: translations.kk.partnerPartnerLabel,
    serial: translations.kk.partnerCardSerials[index] || 'CARD',
    accents: baseAccents[product.id] || product.accents,
  }
}

function App() {
  const [language, setLanguage] = useState('ru')
  const [activeView, setActiveView] = useState('catalog')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState(() => {
    try {
      const existing = localStorage.getItem(storageKey)
      return existing ? JSON.parse(existing) : []
    } catch {
      return []
    }
  })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const t = translations[language]
  const getLocalizedProduct = (product) => translateProductCopy(product, language)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart))
  }, [cart])

  const visibleProducts = useMemo(() => {
    if (activeView !== 'catalog') {
      return []
    }

    let filteredProducts = selectedCategory === 'all' ? products : products.filter((product) => product.category === selectedCategory)

    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return filteredProducts
    }

    const searchTokens = normalizedQuery.split(/\s+/).filter(Boolean)

    return filteredProducts.filter((product) => {
      const title = (product.name || '').toLowerCase()
      return searchTokens.every((token) => title.includes(token))
    })
  }, [selectedCategory, searchQuery])

  const addToCart = (product) => {
    setCart((current) => {
      const existingItem = current.find((item) => item.id === product.id)
      if (existingItem) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...current, { ...product, quantity: 1 }]
    })
    setCartOpen(true)
  }

  const decreaseItem = (productId) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const whatsappMessage = [
    'Здравствуйте! Хочу заказать товары Greenleaf:',
    ...cart.map((item) => `- ${item.name} x${item.quantity} - ${item.price.toLocaleString('ru-RU')} тг`),
    '',
    `Итого: ${totalPrice.toLocaleString('ru-RU')} тг`,
  ].join('\n')

  const whatsappText = encodeURIComponent(whatsappMessage)
  const checkoutLink = `https://api.whatsapp.com/send?phone=${supportPhone}&text=${whatsappText}`

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-column">
          <div className="brand-mark">GL</div>
          <div>
            <div className="brand-name">Greenleaf</div>
            <small>Greenleaf.kz</small>
          </div>
        </div>

        <div className="contact-bar">
          <span>{t.city}</span>
          <span>{t.address}</span>
          <a href="https://t.me/+5NLkt7yDuxJlZTUy" target="_blank" rel="noreferrer">
            {t.telegram}
          </a>
          <a href={`tel:+${supportPhone}`}>{supportPhoneDisplay}</a>
        </div>

        <div className="header-actions">
          <div className="lang-switch" aria-label="Language switcher">
            <button
              type="button"
              className={language === 'ru' ? 'lang-button active' : 'lang-button'}
              onClick={() => setLanguage('ru')}
            >
              RU
            </button>
            <button
              type="button"
              className={language === 'kk' ? 'lang-button active' : 'lang-button'}
              onClick={() => setLanguage('kk')}
            >
              KZ
            </button>
          </div>

          <button type="button" className="cart-button" onClick={() => setCartOpen((open) => !open)}>
            {t.cart} <strong>{totalItems}</strong>
          </button>
        </div>
      </header>

      <main className="catalog-layout">
        <div className="category-tabs main-nav" aria-label="Основные разделы сайта">
          {topTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeView === tab.id ? 'tab active' : 'tab'}
              onClick={() => {
                setActiveView(tab.id)
                if (tab.id === 'catalog') {
                  setSelectedCategory('all')
                }
              }}
            >
              {tab.label[language]}
            </button>
          ))}
        </div>

        {activeView === 'catalog' ? (
          <>
            <section className="hero-banner">
              <img src="/pdf-pages/page_17.png" alt="Каталог Greenleaf cosmetics" />
              <div className="hero-copy">
                <span className="tag">{t.heroTag}</span>
                <h1>{t.heroTitle}</h1>
                <p>{t.heroText}</p>
                <div className="cta-row">
                  <button type="button" className="nav-link-button" onClick={() => setSelectedCategory('all')}>
                    {t.viewCatalog}
                  </button>
                  <a href="https://t.me/+5NLkt7yDuxJlZTUy" target="_blank" rel="noreferrer">
                    {t.telegramCTA}
                  </a>
                </div>
                <div className="hero-stats" aria-label="Преимущества магазина">
                  <span>{t.stat1}</span>
                  <span>{t.stat2}</span>
                  <span>{t.stat3}</span>
                </div>
              </div>
            </section>

            <section className="catalog-section" id="catalog">
            <div className="section-head">
              <div>
                <span className="eyebrow">{t.catalogTitle}</span>
              </div>

              <div className="catalog-controls">
                <div className="catalog-filter-group" aria-label="Фильтр по категориям">
                  <button
                    type="button"
                    className={selectedCategory === 'all' ? 'all-button active' : 'all-button'}
                    onClick={() => setSelectedCategory('all')}
                  >
                    {t.all}
                  </button>

                  <label className="category-select-wrap" aria-label="Выбрать категорию товара">
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="category-select"
                    >
                      {categories
                        .filter((category) => category.id !== 'all')
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label[language]}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="search-wrap">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                    className="search-input"
                  />
                  <button type="button" className="search-button" onClick={() => setSearchQuery(searchQuery.trim())}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
                      <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {t.search}
                  </button>
                </div>
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="no-results">{t.noResults}</div>
            ) : (
              <div className="product-grid">
                {visibleProducts.map((product) => {
                  const localizedProduct = getLocalizedProduct(product)
                  return (
                    <article
                      className="product-card"
                      key={product.id}
                      onClick={() => setSelectedProduct(localizedProduct)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedProduct(localizedProduct)
                        }
                      }}
                    >
                      <div className={`product-visual ${localizedProduct.palette}`}>
                        <img src={localizedProduct.image || '/pdf-pages/page_17.png'} alt={localizedProduct.name} />
                        <span>{localizedProduct.brand}</span>
                      </div>

                      <div className="product-meta">
                        <div className="product-badge">{localizedProduct.badge}</div>
                        <h3>{localizedProduct.name}</h3>
                        <p>{localizedProduct.summary}</p>
                        <div className="product-specs">
                          <span>{t.volume} {localizedProduct.unit}</span>
                        </div>
                      </div>

                      <div className="price-block">
                        <div>
                          <small>{language === 'kk' ? 'Баспасөз' : 'Розничная'}</small>
                          <strong>{localizedProduct.price.toLocaleString('ru-RU')} тг</strong>
                        </div>
                        <div>
                          <small>{language === 'kk' ? 'Серіктестік' : 'Партнёрская'}</small>
                          <strong>{localizedProduct.partnerPrice.toLocaleString('ru-RU')} тг</strong>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedProduct(localizedProduct)
                          }}
                        >
                          {t.productDetails}
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={(event) => {
                            event.stopPropagation()
                            addToCart(localizedProduct)
                          }}
                        >
                          {t.addToCart}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
          </>
        ) : (
          <section className="partner-page" aria-label="Партнерская программа">
            <div className="section-head partner-head">
              <div>
                <span className="eyebrow">{t.partnerProgram}</span>
                <h2>{t.partnerTitle}</h2>
              </div>
            </div>

            <div className="partner-grid">
              {partnerProgramOptions.map((product, index) => {
                const localizedPartner = getLocalizedPartnerOption(product, index, language)

                return (
                  <article className={`partner-card partner-tone-${index + 1}`} key={product.id}>
                    <div className={`product-visual ${product.palette}`}>
                      <div className="partner-card-preview">
                        <div className="partner-card-header">
                          <span className="partner-mark">✦</span>
                          <span className="partner-brand-name">GREENLEAF</span>
                        </div>

                        <div className="partner-card-main">
                          <span className="partner-chip" aria-hidden="true" />
                          <span className="partner-card-name">GREENLEAF</span>
                        </div>

                        <div className="partner-card-serial">{localizedPartner.serial}</div>
                        <div className="partner-card-leaf" aria-hidden="true" />
                      </div>
                      <img src={product.image} alt={localizedPartner.name} />
                    </div>

                    <div className="partner-tier">{localizedPartner.tier}</div>

                    <div className="product-meta">
                      <h3>{localizedPartner.name}</h3>
                      <p>{localizedPartner.summary}</p>
                    </div>

                    <div className="partner-features" aria-label={language === 'kk' ? 'Серіктестік бағдарламасының артықшылықтары' : 'Преимущества партнерской программы'}>
                      {(localizedPartner.accents || product.accents).map((accent) => (
                        <span key={`${product.id}-${accent}`} className="partner-feature">{accent}</span>
                      ))}
                    </div>

                    <div className="price-block">
                      <div>
                        <small>{localizedPartner.priceLabel}</small>
                        <strong>{product.price.toLocaleString('ru-RU')} тг</strong>
                      </div>
                      <div>
                        <small>{localizedPartner.partnerLabel}</small>
                        <strong>{product.partnerPrice.toLocaleString('ru-RU')} тг</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="primary partner-add-button"
                      onClick={() => addToCart(product)}
                    >
                      <span className="partner-add-sign">＋</span>
                      <span>{t.choose}</span>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <aside className={cartOpen ? 'cart-panel open' : 'cart-panel'}>
        <div className="cart-header">
          <h3>{t.cart}</h3>
          <button type="button" onClick={() => setCartOpen(false)}>×</button>
        </div>

        {cart.length === 0 ? (
          <p className="empty-cart">{t.emptyCart}</p>
        ) : (
          <div className="cart-body">
            <ul className="cart-list">
              {cart.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.price.toLocaleString('ru-RU')} ₸ × {item.quantity}</span>
                  </div>
                  <div className="quantity-controls">
                    <button type="button" onClick={() => decreaseItem(item.id)}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => addToCart(item)}>+</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-total">
              <span>{t.total}</span>
              <strong>{totalPrice.toLocaleString('ru-RU')} ₸</strong>
            </div>

            <a className="checkout-button" href={checkoutLink} target="_blank" rel="noreferrer">
              {t.orderWhatsApp}
            </a>
          </div>
        )}
      </aside>

      {selectedProduct && (
        <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setSelectedProduct(null)}>
              ×
            </button>
            <div className={`product-visual modal-visual ${selectedProduct.palette}`}>
              <img src={selectedProduct.image || '/pdf-pages/page_17.png'} alt={selectedProduct.name} />
              <span>{selectedProduct.brand}</span>
            </div>
            <div className="modal-copy">
              <span className="eyebrow">{selectedProduct.category}</span>
              <h3>{selectedProduct.name}</h3>
              <div className="modal-meta-line">
                <span>{t.volume}</span>
                <strong>{selectedProduct.unit}</strong>
              </div>
              <p>{selectedProduct.description}</p>
              <ul>
                {(selectedProduct.accents || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="modal-prices">
                <div>
                  <small>{t.retailPrice}</small>
                  <strong>{selectedProduct.price.toLocaleString('ru-RU')} ₸</strong>
                </div>
                <div>
                  <small>{t.partnerPrice}</small>
                  <strong>{selectedProduct.partnerPrice.toLocaleString('ru-RU')} ₸</strong>
                </div>
              </div>
              <button
                type="button"
                className="primary modal-action"
                onClick={() => addToCart(selectedProduct)}
              >
                {t.addToCart}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
