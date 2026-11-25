// Google libaddressinput administrative areas, snapshot 2026-11-23.
// Source and license: see country-address-metadata.ts and country-address.LICENSE.
export type CountryRegion = { code: string; label: string; aliases: readonly string[] };
const COUNTRY_REGIONS: Readonly<Record<string, readonly CountryRegion[]>> = {
  AD: [
    {
      code: '07',
      label: 'Andorra la Vella',
      aliases: ["Parròquia d'Andorra la Vella", 'Andorra la Vella', '07'],
    },
    {
      code: '02',
      label: 'Canillo',
      aliases: ['Canillo', '02'],
    },
    {
      code: '03',
      label: 'Encamp',
      aliases: ['Encamp', '03'],
    },
    {
      code: '08',
      label: 'Escaldes-Engordany',
      aliases: ['Escaldes-Engordany', '08'],
    },
    {
      code: '04',
      label: 'La Massana',
      aliases: ['La Massana', '04'],
    },
    {
      code: '05',
      label: 'Ordino',
      aliases: ['Ordino', '05'],
    },
    {
      code: '06',
      label: 'Sant Julià de Lòria',
      aliases: ['Sant Julià de Lòria', '06'],
    },
  ],
  AE: [
    {
      code: 'AZ',
      label: 'Abu Dhabi',
      aliases: ['أبو ظبي', 'Abu Dhabi', 'AZ'],
    },
    {
      code: 'SH',
      label: 'Sharjah',
      aliases: ['إمارة الشارقةّ', 'Sharjah', 'الشارقة', 'SH'],
    },
    {
      code: 'FU',
      label: 'Fujairah',
      aliases: ['الفجيرة', 'Fujairah', 'FU'],
    },
    {
      code: 'UQ',
      label: 'Umm Al Quwain',
      aliases: ['ام القيوين', 'Umm Al Quwain', 'UQ'],
    },
    {
      code: 'DU',
      label: 'Dubai',
      aliases: ['إمارة دبيّ', 'Dubai', 'دبي', 'DU'],
    },
    {
      code: 'RK',
      label: 'Ras al Khaimah',
      aliases: ['إمارة رأس الخيمة', 'Ras al Khaimah', 'رأس الخيمة', 'RK'],
    },
    {
      code: 'AJ',
      label: 'Ajman',
      aliases: ['عجمان', 'Ajman', 'AJ'],
    },
  ],
  AM: [
    {
      code: 'AG',
      label: 'Aragatsotn',
      aliases: ['Արագածոտն', 'Aragatsotn', 'AG'],
    },
    {
      code: 'AR',
      label: 'Ararat',
      aliases: ['Արարատ', 'Ararat', 'AR'],
    },
    {
      code: 'AV',
      label: 'Armavir',
      aliases: ['Արմավիր', 'Armavir', 'AV'],
    },
    {
      code: 'GR',
      label: 'Gegharkunik',
      aliases: ['Գեղարքունիք', 'Gegharkunik', 'GR'],
    },
    {
      code: 'ER',
      label: 'Yerevan',
      aliases: ['Երևան', 'Yerevan', 'ER'],
    },
    {
      code: 'LO',
      label: 'Lori',
      aliases: ['Լոռի', 'Lori', 'LO'],
    },
    {
      code: 'KT',
      label: 'Kotayk',
      aliases: ['Կոտայք', 'Kotayk', 'KT'],
    },
    {
      code: 'SH',
      label: 'Shirak',
      aliases: ['Շիրակ', 'Shirak', 'SH'],
    },
    {
      code: 'SU',
      label: 'Syunik',
      aliases: ['Սյունիք', 'Syunik', 'SU'],
    },
    {
      code: 'VD',
      label: 'Vayots Dzor',
      aliases: ['Վայոց ձոր', 'Vayots Dzor', 'VD'],
    },
    {
      code: 'TV',
      label: 'Tavush',
      aliases: ['Տավուշ', 'Tavush', 'TV'],
    },
  ],
  AR: [
    {
      code: 'B',
      label: 'Buenos Aires',
      aliases: ['Buenos Aires', 'B'],
    },
    {
      code: 'K',
      label: 'Catamarca',
      aliases: ['Catamarca', 'K'],
    },
    {
      code: 'H',
      label: 'Chaco',
      aliases: ['Chaco', 'H'],
    },
    {
      code: 'U',
      label: 'Chubut',
      aliases: ['Chubut', 'U'],
    },
    {
      code: 'C',
      label: 'Ciudad Autónoma de Buenos Aires',
      aliases: ['Ciudad Autónoma de Buenos Aires', 'C'],
    },
    {
      code: 'X',
      label: 'Córdoba',
      aliases: ['Córdoba', 'X'],
    },
    {
      code: 'W',
      label: 'Corrientes',
      aliases: ['Corrientes', 'W'],
    },
    {
      code: 'E',
      label: 'Entre Ríos',
      aliases: ['Entre Ríos', 'E'],
    },
    {
      code: 'P',
      label: 'Formosa',
      aliases: ['Formosa', 'P'],
    },
    {
      code: 'Y',
      label: 'Jujuy',
      aliases: ['Jujuy', 'Y'],
    },
    {
      code: 'L',
      label: 'La Pampa',
      aliases: ['La Pampa', 'L'],
    },
    {
      code: 'F',
      label: 'La Rioja',
      aliases: ['La Rioja', 'F'],
    },
    {
      code: 'M',
      label: 'Mendoza',
      aliases: ['Mendoza', 'M'],
    },
    {
      code: 'N',
      label: 'Misiones',
      aliases: ['Misiones', 'N'],
    },
    {
      code: 'Q',
      label: 'Neuquén',
      aliases: ['Neuquén', 'Q'],
    },
    {
      code: 'R',
      label: 'Río Negro',
      aliases: ['Río Negro', 'R'],
    },
    {
      code: 'A',
      label: 'Salta',
      aliases: ['Salta', 'A'],
    },
    {
      code: 'J',
      label: 'San Juan',
      aliases: ['San Juan', 'J'],
    },
    {
      code: 'D',
      label: 'San Luis',
      aliases: ['San Luis', 'D'],
    },
    {
      code: 'Z',
      label: 'Santa Cruz',
      aliases: ['Santa Cruz', 'Z'],
    },
    {
      code: 'S',
      label: 'Santa Fe',
      aliases: ['Santa Fe', 'S'],
    },
    {
      code: 'G',
      label: 'Santiago del Estero',
      aliases: ['Santiago del Estero', 'G'],
    },
    {
      code: 'V',
      label: 'Tierra del Fuego',
      aliases: ['Tierra del Fuego', 'V'],
    },
    {
      code: 'T',
      label: 'Tucumán',
      aliases: ['Tucumán', 'T'],
    },
  ],
  AU: [
    {
      code: 'ACT',
      label: 'Australian Capital Territory',
      aliases: ['ACT', 'Australian Capital Territory'],
    },
    {
      code: 'JBT',
      label: 'Jervis Bay Territory',
      aliases: ['JBT', 'Jervis Bay Territory'],
    },
    {
      code: 'NSW',
      label: 'New South Wales',
      aliases: ['NSW', 'New South Wales'],
    },
    {
      code: 'NT',
      label: 'Northern Territory',
      aliases: ['NT', 'Northern Territory'],
    },
    {
      code: 'QLD',
      label: 'Queensland',
      aliases: ['QLD', 'Queensland'],
    },
    {
      code: 'SA',
      label: 'South Australia',
      aliases: ['SA', 'South Australia'],
    },
    {
      code: 'TAS',
      label: 'Tasmania',
      aliases: ['TAS', 'Tasmania'],
    },
    {
      code: 'VIC',
      label: 'Victoria',
      aliases: ['VIC', 'Victoria'],
    },
    {
      code: 'WA',
      label: 'Western Australia',
      aliases: ['WA', 'Western Australia'],
    },
  ],
  BB: [
    {
      code: '01',
      label: 'Christ Church',
      aliases: ['Christ Church', '01'],
    },
    {
      code: '02',
      label: 'Saint Andrew',
      aliases: ['Saint Andrew', '02'],
    },
    {
      code: '03',
      label: 'Saint George',
      aliases: ['Saint George', '03'],
    },
    {
      code: '04',
      label: 'Saint James',
      aliases: ['Saint James', '04'],
    },
    {
      code: '05',
      label: 'Saint John',
      aliases: ['Saint John', '05'],
    },
    {
      code: '06',
      label: 'Saint Joseph',
      aliases: ['Saint Joseph', '06'],
    },
    {
      code: '07',
      label: 'Saint Lucy',
      aliases: ['Saint Lucy', '07'],
    },
    {
      code: '08',
      label: 'Saint Michael',
      aliases: ['Saint Michael', '08'],
    },
    {
      code: '09',
      label: 'Saint Peter',
      aliases: ['Saint Peter', '09'],
    },
    {
      code: '10',
      label: 'Saint Philip',
      aliases: ['Saint Philip', '10'],
    },
    {
      code: '11',
      label: 'Saint Thomas',
      aliases: ['Saint Thomas', '11'],
    },
  ],
  BR: [
    {
      code: 'AC',
      label: 'Acre',
      aliases: ['AC', 'Acre'],
    },
    {
      code: 'AL',
      label: 'Alagoas',
      aliases: ['AL', 'Alagoas'],
    },
    {
      code: 'AP',
      label: 'Amapá',
      aliases: ['AP', 'Amapá'],
    },
    {
      code: 'AM',
      label: 'Amazonas',
      aliases: ['AM', 'Amazonas'],
    },
    {
      code: 'BA',
      label: 'Bahia',
      aliases: ['BA', 'Bahia'],
    },
    {
      code: 'CE',
      label: 'Ceará',
      aliases: ['CE', 'Ceará'],
    },
    {
      code: 'DF',
      label: 'Distrito Federal',
      aliases: ['DF', 'Distrito Federal'],
    },
    {
      code: 'ES',
      label: 'Espírito Santo',
      aliases: ['ES', 'Espírito Santo'],
    },
    {
      code: 'GO',
      label: 'Goiás',
      aliases: ['GO', 'Goiás'],
    },
    {
      code: 'MA',
      label: 'Maranhão',
      aliases: ['MA', 'Maranhão'],
    },
    {
      code: 'MT',
      label: 'Mato Grosso',
      aliases: ['MT', 'Mato Grosso'],
    },
    {
      code: 'MS',
      label: 'Mato Grosso do Sul',
      aliases: ['MS', 'Mato Grosso do Sul'],
    },
    {
      code: 'MG',
      label: 'Minas Gerais',
      aliases: ['MG', 'Minas Gerais'],
    },
    {
      code: 'PA',
      label: 'Pará',
      aliases: ['PA', 'Pará'],
    },
    {
      code: 'PB',
      label: 'Paraíba',
      aliases: ['PB', 'Paraíba'],
    },
    {
      code: 'PR',
      label: 'Paraná',
      aliases: ['PR', 'Paraná'],
    },
    {
      code: 'PE',
      label: 'Pernambuco',
      aliases: ['PE', 'Pernambuco'],
    },
    {
      code: 'PI',
      label: 'Piauí',
      aliases: ['PI', 'Piauí'],
    },
    {
      code: 'RJ',
      label: 'Rio de Janeiro',
      aliases: ['RJ', 'Rio de Janeiro'],
    },
    {
      code: 'RN',
      label: 'Rio Grande do Norte',
      aliases: ['RN', 'Rio Grande do Norte'],
    },
    {
      code: 'RS',
      label: 'Rio Grande do Sul',
      aliases: ['RS', 'Rio Grande do Sul'],
    },
    {
      code: 'RO',
      label: 'Rondônia',
      aliases: ['RO', 'Rondônia'],
    },
    {
      code: 'RR',
      label: 'Roraima',
      aliases: ['RR', 'Roraima'],
    },
    {
      code: 'SC',
      label: 'Santa Catarina',
      aliases: ['SC', 'Santa Catarina'],
    },
    {
      code: 'SP',
      label: 'São Paulo',
      aliases: ['SP', 'São Paulo'],
    },
    {
      code: 'SE',
      label: 'Sergipe',
      aliases: ['SE', 'Sergipe'],
    },
    {
      code: 'TO',
      label: 'Tocantins',
      aliases: ['TO', 'Tocantins'],
    },
  ],
  BS: [
    {
      code: 'Abaco',
      label: 'Abaco Islands',
      aliases: ['Abaco', 'Abaco Islands'],
    },
    {
      code: 'AK',
      label: 'Acklins',
      aliases: ['Acklins', 'AK'],
    },
    {
      code: 'Andros',
      label: 'Andros Island',
      aliases: ['Andros', 'Andros Island'],
    },
    {
      code: 'BY',
      label: 'Berry Islands',
      aliases: ['Berry Islands', 'BY'],
    },
    {
      code: 'BI',
      label: 'Bimini',
      aliases: ['Bimini', 'BI'],
    },
    {
      code: 'CI',
      label: 'Cat Island',
      aliases: ['Cat Island', 'CI'],
    },
    {
      code: 'Crooked Island',
      label: 'Crooked Island',
      aliases: ['Crooked Island'],
    },
    {
      code: 'Eleuthera',
      label: 'Eleuthera',
      aliases: ['Eleuthera'],
    },
    {
      code: 'EX',
      label: 'Exuma and Cays',
      aliases: ['Exuma', 'Exuma and Cays', 'EX'],
    },
    {
      code: 'Grand Bahama',
      label: 'Grand Bahama',
      aliases: ['Grand Bahama'],
    },
    {
      code: 'HI',
      label: 'Harbour Island',
      aliases: ['Harbour Island', 'HI'],
    },
    {
      code: 'IN',
      label: 'Inagua',
      aliases: ['Inagua', 'IN'],
    },
    {
      code: 'LI',
      label: 'Long Island',
      aliases: ['Long Island', 'LI'],
    },
    {
      code: 'MG',
      label: 'Mayaguana',
      aliases: ['Mayaguana', 'MG'],
    },
    {
      code: 'N.P.',
      label: 'New Providence',
      aliases: ['N.P.', 'New Providence'],
    },
    {
      code: 'RI',
      label: 'Ragged Island',
      aliases: ['Ragged Island', 'RI'],
    },
    {
      code: 'RC',
      label: 'Rum Cay',
      aliases: ['Rum Cay', 'RC'],
    },
    {
      code: 'SS',
      label: 'San Salvador',
      aliases: ['San Salvador', 'SS'],
    },
    {
      code: 'SW',
      label: 'Spanish Wells',
      aliases: ['Spanish Wells', 'SW'],
    },
  ],
  BY: [
    {
      code: 'BR',
      label: 'Bresckaja voblasć',
      aliases: ['Брэсцкая вобласць', 'Bresckaja voblasć', 'BR'],
    },
    {
      code: 'VI',
      label: 'Viciebskaja voblasć',
      aliases: ['Віцебская вобласць', 'Viciebskaja voblasć', 'VI'],
    },
    {
      code: 'HO',
      label: 'Homieĺskaja voblasć',
      aliases: ['Гомельская вобласць', 'Homieĺskaja voblasć', 'HO'],
    },
    {
      code: 'HM',
      label: 'Horad Minsk',
      aliases: ['горад Мінск', 'Horad Minsk', 'HM'],
    },
    {
      code: 'HR',
      label: 'Hrodzienskaja voblasć',
      aliases: ['Гродзенская вобласць', 'Hrodzienskaja voblasć', 'HR'],
    },
    {
      code: 'MA',
      label: 'Mahilioŭskaja voblasć',
      aliases: ['Магілёўская вобласць', 'Mahilioŭskaja voblasć', 'MA'],
    },
    {
      code: 'MI',
      label: 'Minskaja voblasć',
      aliases: ['Мінская вобласць', 'Minskaja voblasć', 'MI'],
    },
  ],
  CA: [
    {
      code: 'AB',
      label: 'Alberta',
      aliases: ['AB', 'Alberta'],
    },
    {
      code: 'BC',
      label: 'British Columbia',
      aliases: ['BC', 'British Columbia'],
    },
    {
      code: 'MB',
      label: 'Manitoba',
      aliases: ['MB', 'Manitoba'],
    },
    {
      code: 'NB',
      label: 'New Brunswick',
      aliases: ['NB', 'New Brunswick'],
    },
    {
      code: 'NL',
      label: 'Newfoundland and Labrador',
      aliases: ['NL', 'Newfoundland and Labrador'],
    },
    {
      code: 'NT',
      label: 'Northwest Territories',
      aliases: ['NT', 'Northwest Territories'],
    },
    {
      code: 'NS',
      label: 'Nova Scotia',
      aliases: ['NS', 'Nova Scotia'],
    },
    {
      code: 'NU',
      label: 'Nunavut',
      aliases: ['NU', 'Nunavut'],
    },
    {
      code: 'ON',
      label: 'Ontario',
      aliases: ['ON', 'Ontario'],
    },
    {
      code: 'PE',
      label: 'Prince Edward Island',
      aliases: ['PE', 'Prince Edward Island'],
    },
    {
      code: 'QC',
      label: 'Quebec',
      aliases: ['QC', 'Quebec'],
    },
    {
      code: 'SK',
      label: 'Saskatchewan',
      aliases: ['SK', 'Saskatchewan'],
    },
    {
      code: 'YT',
      label: 'Yukon',
      aliases: ['YT', 'Yukon'],
    },
  ],
  CL: [
    {
      code: 'AN',
      label: 'Antofagasta',
      aliases: ['Antofagasta', 'AN'],
    },
    {
      code: 'AR',
      label: 'Araucanía',
      aliases: ['Araucanía', 'AR'],
    },
    {
      code: 'AP',
      label: 'Arica y Parinacota',
      aliases: ['Arica y Parinacota', 'AP'],
    },
    {
      code: 'AT',
      label: 'Atacama',
      aliases: ['Atacama', 'AT'],
    },
    {
      code: 'AI',
      label: 'Aysén del General Carlos Ibáñez del Campo',
      aliases: ['Aysén', 'Aysén del General Carlos Ibáñez del Campo', 'AI'],
    },
    {
      code: 'BI',
      label: 'Biobío',
      aliases: ['Biobío', 'BI'],
    },
    {
      code: 'CO',
      label: 'Coquimbo',
      aliases: ['Coquimbo', 'CO'],
    },
    {
      code: 'LI',
      label: "Libertador General Bernardo O'Higgins",
      aliases: ["O'Higgins", "Libertador General Bernardo O'Higgins", 'LI'],
    },
    {
      code: 'LL',
      label: 'Los Lagos',
      aliases: ['Los Lagos', 'LL'],
    },
    {
      code: 'LR',
      label: 'Los Ríos',
      aliases: ['Los Ríos', 'LR'],
    },
    {
      code: 'MA',
      label: 'Magallanes y de la Antártica Chilena',
      aliases: ['Magallanes', 'Magallanes y de la Antártica Chilena', 'MA'],
    },
    {
      code: 'ML',
      label: 'Maule',
      aliases: ['Maule', 'ML'],
    },
    {
      code: 'RM',
      label: 'Metropolitana de Santiago',
      aliases: ['Región Metropolitana', 'Metropolitana de Santiago', 'RM'],
    },
    {
      code: 'NB',
      label: 'Ñuble',
      aliases: ['Ñuble', 'NB'],
    },
    {
      code: 'TA',
      label: 'Tarapacá',
      aliases: ['Tarapacá', 'TA'],
    },
    {
      code: 'VS',
      label: 'Valparaíso',
      aliases: ['Valparaíso', 'VS'],
    },
  ],
  CN: [
    {
      code: 'AH',
      label: 'Anhui Sheng',
      aliases: ['安徽省', 'Anhui Sheng', 'AH'],
    },
    {
      code: 'MO',
      label: 'Macau',
      aliases: ['澳门', 'Macau', 'MO'],
    },
    {
      code: 'BJ',
      label: 'Beijing Shi',
      aliases: ['北京市', 'Beijing Shi', 'BJ'],
    },
    {
      code: 'CQ',
      label: 'Chongqing Shi',
      aliases: ['重庆市', 'Chongqing Shi', 'CQ'],
    },
    {
      code: 'FJ',
      label: 'Fujian Sheng',
      aliases: ['福建省', 'Fujian Sheng', 'FJ'],
    },
    {
      code: 'GS',
      label: 'Gansu Sheng',
      aliases: ['甘肃省', 'Gansu Sheng', 'GS'],
    },
    {
      code: 'GD',
      label: 'Guangdong Sheng',
      aliases: ['广东省', 'Guangdong Sheng', 'GD'],
    },
    {
      code: 'GX',
      label: 'Guangxi Zhuangzuzizhiqu',
      aliases: ['广西壮族自治区', 'Guangxi Zhuangzuzizhiqu', '广西', 'GX'],
    },
    {
      code: 'GZ',
      label: 'Guizhou Sheng',
      aliases: ['贵州省', 'Guizhou Sheng', 'GZ'],
    },
    {
      code: 'HI',
      label: 'Hainan Sheng',
      aliases: ['海南省', 'Hainan Sheng', 'HI'],
    },
    {
      code: 'HE',
      label: 'Hebei Sheng',
      aliases: ['河北省', 'Hebei Sheng', 'HE'],
    },
    {
      code: 'HA',
      label: 'Henan Sheng',
      aliases: ['河南省', 'Henan Sheng', 'HA'],
    },
    {
      code: 'HL',
      label: 'Heilongjiang Sheng',
      aliases: ['黑龙江省', 'Heilongjiang Sheng', 'HL'],
    },
    {
      code: 'HB',
      label: 'Hubei Sheng',
      aliases: ['湖北省', 'Hubei Sheng', 'HB'],
    },
    {
      code: 'HN',
      label: 'Hunan Sheng',
      aliases: ['湖南省', 'Hunan Sheng', 'HN'],
    },
    {
      code: 'JL',
      label: 'Jilin Sheng',
      aliases: ['吉林省', 'Jilin Sheng', 'JL'],
    },
    {
      code: 'JS',
      label: 'Jiangsu Sheng',
      aliases: ['江苏省', 'Jiangsu Sheng', 'JS'],
    },
    {
      code: 'JX',
      label: 'Jiangxi Sheng',
      aliases: ['江西省', 'Jiangxi Sheng', 'JX'],
    },
    {
      code: 'LN',
      label: 'Liaoning Sheng',
      aliases: ['辽宁省', 'Liaoning Sheng', 'LN'],
    },
    {
      code: 'NM',
      label: 'Neimenggu Zizhiqu',
      aliases: ['内蒙古自治区', 'Neimenggu Zizhiqu', '内蒙古', 'NM'],
    },
    {
      code: 'NX',
      label: 'Ningxia Huizuzizhiqu',
      aliases: ['宁夏回族自治区', 'Ningxia Huizuzizhiqu', '宁夏', 'NX'],
    },
    {
      code: 'QH',
      label: 'Qinghai Sheng',
      aliases: ['青海省', 'Qinghai Sheng', 'QH'],
    },
    {
      code: 'SD',
      label: 'Shandong Sheng',
      aliases: ['山东省', 'Shandong Sheng', 'SD'],
    },
    {
      code: 'SX',
      label: 'Shanxi Sheng',
      aliases: ['山西省', 'Shanxi Sheng', 'SX'],
    },
    {
      code: 'SN',
      label: 'Shaanxi Sheng',
      aliases: ['陕西省', 'Shaanxi Sheng', 'SN'],
    },
    {
      code: 'SH',
      label: 'Shanghai Shi',
      aliases: ['上海市', 'Shanghai Shi', 'SH'],
    },
    {
      code: 'SC',
      label: 'Sichuan Sheng',
      aliases: ['四川省', 'Sichuan Sheng', 'SC'],
    },
    {
      code: 'TW',
      label: 'Taiwan',
      aliases: ['台湾', 'Taiwan', 'TW'],
    },
    {
      code: 'TJ',
      label: 'Tianjin Shi',
      aliases: ['天津市', 'Tianjin Shi', 'TJ'],
    },
    {
      code: 'XZ',
      label: 'Xizang Zizhiqu',
      aliases: ['西藏自治区', 'Xizang Zizhiqu', '西藏', 'XZ'],
    },
    {
      code: 'HK',
      label: 'Hong Kong',
      aliases: ['香港', 'Hong Kong', 'HK'],
    },
    {
      code: 'XJ',
      label: 'Xinjiang Weiwuerzizhiqu',
      aliases: ['新疆维吾尔自治区', 'Xinjiang Weiwuerzizhiqu', '新疆', 'XJ'],
    },
    {
      code: 'YN',
      label: 'Yunnan Sheng',
      aliases: ['云南省', 'Yunnan Sheng', 'YN'],
    },
    {
      code: 'ZJ',
      label: 'Zhejiang Sheng',
      aliases: ['浙江省', 'Zhejiang Sheng', 'ZJ'],
    },
  ],
  CO: [
    {
      code: 'AMA',
      label: 'Amazonas',
      aliases: ['Amazonas', 'AMA'],
    },
    {
      code: 'ANT',
      label: 'Antioquia',
      aliases: ['Antioquia', 'ANT'],
    },
    {
      code: 'ARA',
      label: 'Arauca',
      aliases: ['Arauca', 'ARA'],
    },
    {
      code: 'ATL',
      label: 'Atlántico',
      aliases: ['Atlántico', 'ATL'],
    },
    {
      code: 'DC',
      label: 'Bogotá',
      aliases: ['Bogotá', 'DC'],
    },
    {
      code: 'BOL',
      label: 'Bolívar',
      aliases: ['Bolívar', 'BOL'],
    },
    {
      code: 'BOY',
      label: 'Boyacá',
      aliases: ['Boyacá', 'BOY'],
    },
    {
      code: 'CAL',
      label: 'Caldas',
      aliases: ['Caldas', 'CAL'],
    },
    {
      code: 'CAQ',
      label: 'Caquetá',
      aliases: ['Caquetá', 'CAQ'],
    },
    {
      code: 'CAS',
      label: 'Casanare',
      aliases: ['Casanare', 'CAS'],
    },
    {
      code: 'CAU',
      label: 'Cauca',
      aliases: ['Cauca', 'CAU'],
    },
    {
      code: 'CES',
      label: 'Cesar',
      aliases: ['Cesar', 'CES'],
    },
    {
      code: 'CHO',
      label: 'Chocó',
      aliases: ['Chocó', 'CHO'],
    },
    {
      code: 'COR',
      label: 'Córdoba',
      aliases: ['Córdoba', 'COR'],
    },
    {
      code: 'CUN',
      label: 'Cundinamarca',
      aliases: ['Cundinamarca', 'CUN'],
    },
    {
      code: 'GUA',
      label: 'Guainía',
      aliases: ['Guainía', 'GUA'],
    },
    {
      code: 'GUV',
      label: 'Guaviare',
      aliases: ['Guaviare', 'GUV'],
    },
    {
      code: 'HUI',
      label: 'Huila',
      aliases: ['Huila', 'HUI'],
    },
    {
      code: 'LAG',
      label: 'La Guajira',
      aliases: ['La Guajira', 'LAG'],
    },
    {
      code: 'MAG',
      label: 'Magdalena',
      aliases: ['Magdalena', 'MAG'],
    },
    {
      code: 'MET',
      label: 'Meta',
      aliases: ['Meta', 'MET'],
    },
    {
      code: 'NAR',
      label: 'Nariño',
      aliases: ['Nariño', 'NAR'],
    },
    {
      code: 'NSA',
      label: 'Norte de Santander',
      aliases: ['Norte de Santander', 'NSA'],
    },
    {
      code: 'PUT',
      label: 'Putumayo',
      aliases: ['Putumayo', 'PUT'],
    },
    {
      code: 'QUI',
      label: 'Quindío',
      aliases: ['Quindío', 'QUI'],
    },
    {
      code: 'RIS',
      label: 'Risaralda',
      aliases: ['Risaralda', 'RIS'],
    },
    {
      code: 'SAP',
      label: 'San Andrés y Providencia',
      aliases: ['San Andrés y Providencia', 'SAP'],
    },
    {
      code: 'SAN',
      label: 'Santander',
      aliases: ['Santander', 'SAN'],
    },
    {
      code: 'SUC',
      label: 'Sucre',
      aliases: ['Sucre', 'SUC'],
    },
    {
      code: 'TOL',
      label: 'Tolima',
      aliases: ['Tolima', 'TOL'],
    },
    {
      code: 'VAC',
      label: 'Valle del Cauca',
      aliases: ['Valle del Cauca', 'VAC'],
    },
    {
      code: 'VAU',
      label: 'Vaupés',
      aliases: ['Vaupés', 'VAU'],
    },
    {
      code: 'VID',
      label: 'Vichada',
      aliases: ['Vichada', 'VID'],
    },
  ],
  CR: [
    {
      code: 'A',
      label: 'Alajuela',
      aliases: ['Alajuela', 'A'],
    },
    {
      code: 'C',
      label: 'Cartago',
      aliases: ['Cartago', 'C'],
    },
    {
      code: 'G',
      label: 'Guanacaste',
      aliases: ['Guanacaste', 'G'],
    },
    {
      code: 'H',
      label: 'Heredia',
      aliases: ['Heredia', 'H'],
    },
    {
      code: 'L',
      label: 'Limón',
      aliases: ['Limón', 'L'],
    },
    {
      code: 'P',
      label: 'Puntarenas',
      aliases: ['Puntarenas', 'P'],
    },
    {
      code: 'SJ',
      label: 'San José',
      aliases: ['San José', 'SJ'],
    },
  ],
  CU: [
    {
      code: '15',
      label: 'Artemisa',
      aliases: ['Artemisa', '15'],
    },
    {
      code: '09',
      label: 'Camagüey',
      aliases: ['Camagüey', '09'],
    },
    {
      code: '08',
      label: 'Ciego de Ávila',
      aliases: ['Ciego de Ávila', '08'],
    },
    {
      code: '06',
      label: 'Cienfuegos',
      aliases: ['Cienfuegos', '06'],
    },
    {
      code: '12',
      label: 'Granma',
      aliases: ['Granma', '12'],
    },
    {
      code: '14',
      label: 'Guantánamo',
      aliases: ['Guantánamo', '14'],
    },
    {
      code: '11',
      label: 'Holguín',
      aliases: ['Holguín', '11'],
    },
    {
      code: '99',
      label: 'Isla de la Juventud',
      aliases: ['Isla de la Juventud', '99'],
    },
    {
      code: '03',
      label: 'La Habana',
      aliases: ['La Habana', '03'],
    },
    {
      code: '10',
      label: 'Las Tunas',
      aliases: ['Las Tunas', '10'],
    },
    {
      code: '04',
      label: 'Matanzas',
      aliases: ['Matanzas', '04'],
    },
    {
      code: '16',
      label: 'Mayabeque',
      aliases: ['Mayabeque', '16'],
    },
    {
      code: '01',
      label: 'Pinar del Río',
      aliases: ['Pinar del Río', '01'],
    },
    {
      code: '07',
      label: 'Sancti Spíritus',
      aliases: ['Sancti Spíritus', '07'],
    },
    {
      code: '13',
      label: 'Santiago de Cuba',
      aliases: ['Santiago de Cuba', '13'],
    },
    {
      code: '05',
      label: 'Villa Clara',
      aliases: ['Villa Clara', '05'],
    },
  ],
  CV: [
    {
      code: 'BV',
      label: 'Boa Vista',
      aliases: ['Boa Vista', 'BV'],
    },
    {
      code: 'BR',
      label: 'Brava',
      aliases: ['Brava', 'BR'],
    },
    {
      code: 'Fogo',
      label: 'Fogo',
      aliases: ['Fogo'],
    },
    {
      code: 'MA',
      label: 'Maio',
      aliases: ['Maio', 'MA'],
    },
    {
      code: 'SL',
      label: 'Sal',
      aliases: ['Sal', 'SL'],
    },
    {
      code: 'Santiago',
      label: 'Santiago',
      aliases: ['Santiago'],
    },
    {
      code: 'Santo Antão',
      label: 'Santo Antão',
      aliases: ['Santo Antão'],
    },
    {
      code: 'São Nicolau',
      label: 'São Nicolau',
      aliases: ['São Nicolau'],
    },
    {
      code: 'SV',
      label: 'São Vicente',
      aliases: ['São Vicente', 'SV'],
    },
  ],
  EE: [
    {
      code: '37',
      label: 'Harjumaa',
      aliases: ['Harjumaa', '37'],
    },
    {
      code: '39',
      label: 'Hiiumaa',
      aliases: ['Hiiumaa', '39'],
    },
    {
      code: '45',
      label: 'Ida-Virumaa',
      aliases: ['Ida-Virumaa', '45'],
    },
    {
      code: '50',
      label: 'Jõgevamaa',
      aliases: ['Jõgevamaa', '50'],
    },
    {
      code: '52',
      label: 'Järvamaa',
      aliases: ['Järvamaa', '52'],
    },
    {
      code: '60',
      label: 'Lääne-Virumaa',
      aliases: ['Lääne-Virumaa', '60'],
    },
    {
      code: '56',
      label: 'Läänemaa',
      aliases: ['Läänemaa', '56'],
    },
    {
      code: '64',
      label: 'Põlvamaa',
      aliases: ['Põlvamaa', '64'],
    },
    {
      code: '68',
      label: 'Pärnumaa',
      aliases: ['Pärnumaa', '68'],
    },
    {
      code: '71',
      label: 'Raplamaa',
      aliases: ['Raplamaa', '71'],
    },
    {
      code: '74',
      label: 'Saaremaa',
      aliases: ['Saaremaa', '74'],
    },
    {
      code: '79',
      label: 'Tartumaa',
      aliases: ['Tartumaa', '79'],
    },
    {
      code: '81',
      label: 'Valgamaa',
      aliases: ['Valgamaa', '81'],
    },
    {
      code: '84',
      label: 'Viljandimaa',
      aliases: ['Viljandimaa', '84'],
    },
    {
      code: '87',
      label: 'Võrumaa',
      aliases: ['Võrumaa', '87'],
    },
  ],
  EG: [
    {
      code: 'ASN',
      label: 'Aswan Governorate',
      aliases: ['أسوان', 'Aswan Governorate', 'ASN'],
    },
    {
      code: 'AST',
      label: 'Asyut Governorate',
      aliases: ['أسيوط', 'Asyut Governorate', 'AST'],
    },
    {
      code: 'ALX',
      label: 'Alexandria Governorate',
      aliases: ['الإسكندرية', 'Alexandria Governorate', 'ALX'],
    },
    {
      code: 'IS',
      label: 'Ismailia Governorate',
      aliases: ['الإسماعيلية', 'Ismailia Governorate', 'IS'],
    },
    {
      code: 'LX',
      label: 'Luxor Governorate',
      aliases: ['الأقصر', 'Luxor Governorate', 'LX'],
    },
    {
      code: 'BA',
      label: 'Red Sea Governorate',
      aliases: ['البحر الأحمر', 'Red Sea Governorate', 'BA'],
    },
    {
      code: 'BH',
      label: 'El Beheira Governorate',
      aliases: ['البحيرة', 'El Beheira Governorate', 'BH'],
    },
    {
      code: 'GZ',
      label: 'Giza Governorate',
      aliases: ['الجيزة', 'Giza Governorate', 'GZ'],
    },
    {
      code: 'DK',
      label: 'Dakahlia Governorate',
      aliases: ['الدقهلية', 'Dakahlia Governorate', 'DK'],
    },
    {
      code: 'SUZ',
      label: 'Suez Governorate',
      aliases: ['السويس', 'Suez Governorate', 'SUZ'],
    },
    {
      code: 'SHR',
      label: 'Ash Sharqia Governorate',
      aliases: ['الشرقية', 'Ash Sharqia Governorate', 'SHR'],
    },
    {
      code: 'GH',
      label: 'Gharbia Governorate',
      aliases: ['الغربية', 'Gharbia Governorate', 'GH'],
    },
    {
      code: 'FYM',
      label: 'Faiyum Governorate',
      aliases: ['الفيوم', 'Faiyum Governorate', 'FYM'],
    },
    {
      code: 'C',
      label: 'Cairo Governorate',
      aliases: ['القاهرة', 'Cairo Governorate', 'C'],
    },
    {
      code: 'KB',
      label: 'Qalyubia Governorate',
      aliases: ['القليوبية', 'Qalyubia Governorate', 'KB'],
    },
    {
      code: 'MNF',
      label: 'Menofia Governorate',
      aliases: ['المنوفية', 'Menofia Governorate', 'MNF'],
    },
    {
      code: 'MN',
      label: 'Menia Governorate',
      aliases: ['المنيا', 'Menia Governorate', 'MN'],
    },
    {
      code: 'WAD',
      label: 'New Valley Governorate',
      aliases: ['الوادي الجديد', 'New Valley Governorate', 'WAD'],
    },
    {
      code: 'BNS',
      label: 'Beni Suef Governorate',
      aliases: ['بني سويف', 'Beni Suef Governorate', 'BNS'],
    },
    {
      code: 'PTS',
      label: 'Port Said Governorate',
      aliases: ['بورسعيد', 'Port Said Governorate', 'PTS'],
    },
    {
      code: 'JS',
      label: 'South Sinai Governorate',
      aliases: ['جنوب سيناء', 'South Sinai Governorate', 'JS'],
    },
    {
      code: 'DT',
      label: 'Damietta Governorate',
      aliases: ['دمياط', 'Damietta Governorate', 'DT'],
    },
    {
      code: 'SHG',
      label: 'Sohag Governorate',
      aliases: ['سوهاج', 'Sohag Governorate', 'SHG'],
    },
    {
      code: 'SIN',
      label: 'North Sinai Governorate',
      aliases: ['شمال سيناء', 'North Sinai Governorate', 'SIN'],
    },
    {
      code: 'KN',
      label: 'Qena Governorate',
      aliases: ['قنا', 'Qena Governorate', 'KN'],
    },
    {
      code: 'KFS',
      label: 'Kafr El Sheikh Governorate',
      aliases: ['كفر الشيخ', 'Kafr El Sheikh Governorate', 'KFS'],
    },
    {
      code: 'MT',
      label: 'Matrouh Governorate',
      aliases: ['مطروح', 'Matrouh Governorate', 'MT'],
    },
  ],
  ES: [
    {
      code: 'VI',
      label: 'Álava',
      aliases: ['VI', 'Álava'],
    },
    {
      code: 'AB',
      label: 'Albacete',
      aliases: ['AB', 'Albacete'],
    },
    {
      code: 'A',
      label: 'Alicante',
      aliases: ['A', 'Alicante'],
    },
    {
      code: 'AL',
      label: 'Almería',
      aliases: ['AL', 'Almería'],
    },
    {
      code: 'O',
      label: 'Asturias',
      aliases: ['O', 'Asturias'],
    },
    {
      code: 'AV',
      label: 'Ávila',
      aliases: ['AV', 'Ávila'],
    },
    {
      code: 'BA',
      label: 'Badajoz',
      aliases: ['BA', 'Badajoz'],
    },
    {
      code: 'B',
      label: 'Barcelona',
      aliases: ['B', 'Barcelona'],
    },
    {
      code: 'BU',
      label: 'Burgos',
      aliases: ['BU', 'Burgos'],
    },
    {
      code: 'CC',
      label: 'Cáceres',
      aliases: ['CC', 'Cáceres'],
    },
    {
      code: 'CA',
      label: 'Cádiz',
      aliases: ['CA', 'Cádiz'],
    },
    {
      code: 'S',
      label: 'Cantabria',
      aliases: ['S', 'Cantabria'],
    },
    {
      code: 'CS',
      label: 'Castellón',
      aliases: ['CS', 'Castellón'],
    },
    {
      code: 'CE',
      label: 'Ceuta',
      aliases: ['CE', 'Ceuta'],
    },
    {
      code: 'CR',
      label: 'Ciudad Real',
      aliases: ['CR', 'Ciudad Real'],
    },
    {
      code: 'CO',
      label: 'Córdoba',
      aliases: ['CO', 'Córdoba'],
    },
    {
      code: 'CU',
      label: 'Cuenca',
      aliases: ['CU', 'Cuenca'],
    },
    {
      code: 'GI',
      label: 'Girona',
      aliases: ['GI', 'Girona'],
    },
    {
      code: 'GR',
      label: 'Granada',
      aliases: ['GR', 'Granada'],
    },
    {
      code: 'GU',
      label: 'Guadalajara',
      aliases: ['GU', 'Guadalajara'],
    },
    {
      code: 'SS',
      label: 'Guipúzcoa',
      aliases: ['SS', 'Guipúzcoa'],
    },
    {
      code: 'H',
      label: 'Huelva',
      aliases: ['H', 'Huelva'],
    },
    {
      code: 'HU',
      label: 'Huesca',
      aliases: ['HU', 'Huesca'],
    },
    {
      code: 'PM',
      label: 'Islas Baleares',
      aliases: ['PM', 'Islas Baleares'],
    },
    {
      code: 'J',
      label: 'Jaén',
      aliases: ['J', 'Jaén'],
    },
    {
      code: 'C',
      label: 'La Coruña',
      aliases: ['C', 'La Coruña'],
    },
    {
      code: 'LO',
      label: 'La Rioja',
      aliases: ['LO', 'La Rioja'],
    },
    {
      code: 'GC',
      label: 'Las Palmas',
      aliases: ['GC', 'Las Palmas'],
    },
    {
      code: 'LE',
      label: 'León',
      aliases: ['LE', 'León'],
    },
    {
      code: 'L',
      label: 'Lérida',
      aliases: ['L', 'Lérida'],
    },
    {
      code: 'LU',
      label: 'Lugo',
      aliases: ['LU', 'Lugo'],
    },
    {
      code: 'M',
      label: 'Madrid',
      aliases: ['M', 'Madrid'],
    },
    {
      code: 'MA',
      label: 'Málaga',
      aliases: ['MA', 'Málaga'],
    },
    {
      code: 'ML',
      label: 'Melilla',
      aliases: ['ML', 'Melilla'],
    },
    {
      code: 'MU',
      label: 'Murcia',
      aliases: ['MU', 'Murcia'],
    },
    {
      code: 'NA',
      label: 'Navarra',
      aliases: ['NA', 'Navarra'],
    },
    {
      code: 'OR',
      label: 'Ourense',
      aliases: ['OR', 'Ourense'],
    },
    {
      code: 'P',
      label: 'Palencia',
      aliases: ['P', 'Palencia'],
    },
    {
      code: 'PO',
      label: 'Pontevedra',
      aliases: ['PO', 'Pontevedra'],
    },
    {
      code: 'SA',
      label: 'Salamanca',
      aliases: ['SA', 'Salamanca'],
    },
    {
      code: 'TF',
      label: 'Santa Cruz de Tenerife',
      aliases: ['TF', 'Santa Cruz de Tenerife'],
    },
    {
      code: 'SG',
      label: 'Segovia',
      aliases: ['SG', 'Segovia'],
    },
    {
      code: 'SE',
      label: 'Sevilla',
      aliases: ['SE', 'Sevilla'],
    },
    {
      code: 'SO',
      label: 'Soria',
      aliases: ['SO', 'Soria'],
    },
    {
      code: 'T',
      label: 'Tarragona',
      aliases: ['T', 'Tarragona'],
    },
    {
      code: 'TE',
      label: 'Teruel',
      aliases: ['TE', 'Teruel'],
    },
    {
      code: 'TO',
      label: 'Toledo',
      aliases: ['TO', 'Toledo'],
    },
    {
      code: 'V',
      label: 'Valencia',
      aliases: ['V', 'Valencia'],
    },
    {
      code: 'VA',
      label: 'Valladolid',
      aliases: ['VA', 'Valladolid'],
    },
    {
      code: 'BI',
      label: 'Vizcaya',
      aliases: ['BI', 'Vizcaya'],
    },
    {
      code: 'ZA',
      label: 'Zamora',
      aliases: ['ZA', 'Zamora'],
    },
    {
      code: 'Z',
      label: 'Zaragoza',
      aliases: ['Z', 'Zaragoza'],
    },
  ],
  FM: [
    {
      code: 'TRK',
      label: 'Chuuk',
      aliases: ['Chuuk', 'TRK'],
    },
    {
      code: 'KSA',
      label: 'Kosrae',
      aliases: ['Kosrae', 'KSA'],
    },
    {
      code: 'PNI',
      label: 'Pohnpei',
      aliases: ['Pohnpei', 'PNI'],
    },
    {
      code: 'YAP',
      label: 'Yap',
      aliases: ['Yap', 'YAP'],
    },
  ],
  HK: [
    {
      code: 'Kowloon',
      label: '九龍',
      aliases: ['Kowloon', '九龍'],
    },
    {
      code: 'Hong Kong Island',
      label: '香港島',
      aliases: ['Hong Kong Island', '香港島'],
    },
    {
      code: 'New Territories',
      label: '新界',
      aliases: ['New Territories', '新界'],
    },
  ],
  HN: [
    {
      code: 'AT',
      label: 'Atlántida',
      aliases: ['Atlántida', 'AT'],
    },
    {
      code: 'CH',
      label: 'Choluteca',
      aliases: ['Choluteca', 'CH'],
    },
    {
      code: 'CL',
      label: 'Colón',
      aliases: ['Colón', 'CL'],
    },
    {
      code: 'CM',
      label: 'Comayagua',
      aliases: ['Comayagua', 'CM'],
    },
    {
      code: 'CP',
      label: 'Copán',
      aliases: ['Copán', 'CP'],
    },
    {
      code: 'CR',
      label: 'Cortés',
      aliases: ['Cortés', 'CR'],
    },
    {
      code: 'EP',
      label: 'El Paraíso',
      aliases: ['El Paraíso', 'EP'],
    },
    {
      code: 'FM',
      label: 'Francisco Morazán',
      aliases: ['Francisco Morazán', 'FM'],
    },
    {
      code: 'GD',
      label: 'Gracias a Dios',
      aliases: ['Gracias a Dios', 'GD'],
    },
    {
      code: 'IN',
      label: 'Intibucá',
      aliases: ['Intibucá', 'IN'],
    },
    {
      code: 'IB',
      label: 'Islas de la Bahía',
      aliases: ['Islas de la Bahía', 'IB'],
    },
    {
      code: 'LP',
      label: 'La Paz',
      aliases: ['La Paz', 'LP'],
    },
    {
      code: 'LE',
      label: 'Lempira',
      aliases: ['Lempira', 'LE'],
    },
    {
      code: 'OC',
      label: 'Ocotepeque',
      aliases: ['Ocotepeque', 'OC'],
    },
    {
      code: 'OL',
      label: 'Olancho',
      aliases: ['Olancho', 'OL'],
    },
    {
      code: 'SB',
      label: 'Santa Bárbara',
      aliases: ['Santa Bárbara', 'SB'],
    },
    {
      code: 'VA',
      label: 'Valle',
      aliases: ['Valle', 'VA'],
    },
    {
      code: 'YO',
      label: 'Yoro',
      aliases: ['Yoro', 'YO'],
    },
  ],
  ID: [
    {
      code: 'AC',
      label: 'Aceh',
      aliases: ['Aceh', 'AC'],
    },
    {
      code: 'BA',
      label: 'Bali',
      aliases: ['Bali', 'BA'],
    },
    {
      code: 'BT',
      label: 'Banten',
      aliases: ['Banten', 'BT'],
    },
    {
      code: 'BE',
      label: 'Bengkulu',
      aliases: ['Bengkulu', 'BE'],
    },
    {
      code: 'YO',
      label: 'Special Region of Yogyakarta',
      aliases: ['Daerah Istimewa Yogyakarta', 'Special Region of Yogyakarta', 'YO'],
    },
    {
      code: 'JK',
      label: 'Jakarta',
      aliases: ['DKI Jakarta', 'Jakarta', 'JK'],
    },
    {
      code: 'GO',
      label: 'Gorontalo',
      aliases: ['Gorontalo', 'GO'],
    },
    {
      code: 'JA',
      label: 'Jambi',
      aliases: ['Jambi', 'JA'],
    },
    {
      code: 'JB',
      label: 'West Java',
      aliases: ['Jawa Barat', 'West Java', 'JB'],
    },
    {
      code: 'JT',
      label: 'Central Java',
      aliases: ['Jawa Tengah', 'Central Java', 'JT'],
    },
    {
      code: 'JI',
      label: 'East Java',
      aliases: ['Jawa Timur', 'East Java', 'JI'],
    },
    {
      code: 'KB',
      label: 'West Kalimantan',
      aliases: ['Kalimantan Barat', 'West Kalimantan', 'KB'],
    },
    {
      code: 'KS',
      label: 'South Kalimantan',
      aliases: ['Kalimantan Selatan', 'South Kalimantan', 'KS'],
    },
    {
      code: 'KT',
      label: 'Central Kalimantan',
      aliases: ['Kalimantan Tengah', 'Central Kalimantan', 'KT'],
    },
    {
      code: 'KI',
      label: 'East Kalimantan',
      aliases: ['Kalimantan Timur', 'East Kalimantan', 'KI'],
    },
    {
      code: 'KU',
      label: 'North Kalimantan',
      aliases: ['Kalimantan Utara', 'North Kalimantan', 'KU'],
    },
    {
      code: 'BB',
      label: 'Bangka Belitung Islands',
      aliases: ['Kepulauan Bangka Belitung', 'Bangka Belitung Islands', 'BB'],
    },
    {
      code: 'KR',
      label: 'Riau Islands',
      aliases: ['Kepulauan Riau', 'Riau Islands', 'KR'],
    },
    {
      code: 'LA',
      label: 'Lampung',
      aliases: ['Lampung', 'LA'],
    },
    {
      code: 'MA',
      label: 'Maluku',
      aliases: ['Maluku', 'MA'],
    },
    {
      code: 'MU',
      label: 'North Maluku',
      aliases: ['Maluku Utara', 'North Maluku', 'MU'],
    },
    {
      code: 'NB',
      label: 'West Nusa Tenggara',
      aliases: ['Nusa Tenggara Barat', 'West Nusa Tenggara', 'NB'],
    },
    {
      code: 'NT',
      label: 'East Nusa Tenggara',
      aliases: ['Nusa Tenggara Timur', 'East Nusa Tenggara', 'NT'],
    },
    {
      code: 'PA',
      label: 'Papua',
      aliases: ['Papua', 'PA'],
    },
    {
      code: 'PB',
      label: 'West Papua',
      aliases: ['Papua Barat', 'West Papua', 'PB'],
    },
    {
      code: 'RI',
      label: 'Riau',
      aliases: ['Riau', 'RI'],
    },
    {
      code: 'SR',
      label: 'West Sulawesi',
      aliases: ['Sulawesi Barat', 'West Sulawesi', 'SR'],
    },
    {
      code: 'SN',
      label: 'South Sulawesi',
      aliases: ['Sulawesi Selatan', 'South Sulawesi', 'SN'],
    },
    {
      code: 'ST',
      label: 'Central Sulawesi',
      aliases: ['Sulawesi Tengah', 'Central Sulawesi', 'ST'],
    },
    {
      code: 'SG',
      label: 'South East Sulawesi',
      aliases: ['Sulawesi Tenggara', 'South East Sulawesi', 'SG'],
    },
    {
      code: 'SA',
      label: 'North Sulawesi',
      aliases: ['Sulawesi Utara', 'North Sulawesi', 'SA'],
    },
    {
      code: 'SB',
      label: 'West Sumatra',
      aliases: ['Sumatera Barat', 'West Sumatra', 'SB'],
    },
    {
      code: 'SS',
      label: 'South Sumatra',
      aliases: ['Sumatera Selatan', 'South Sumatra', 'SS'],
    },
    {
      code: 'SU',
      label: 'North Sumatra',
      aliases: ['Sumatera Utara', 'North Sumatra', 'SU'],
    },
  ],
  IE: [
    {
      code: 'CW',
      label: 'Co. Carlow',
      aliases: ['Co. Carlow', 'CW'],
    },
    {
      code: 'CN',
      label: 'Co. Cavan',
      aliases: ['Co. Cavan', 'CN'],
    },
    {
      code: 'CE',
      label: 'Co. Clare',
      aliases: ['Co. Clare', 'CE'],
    },
    {
      code: 'CO',
      label: 'Co. Cork',
      aliases: ['Co. Cork', 'CO'],
    },
    {
      code: 'DL',
      label: 'Co. Donegal',
      aliases: ['Co. Donegal', 'DL'],
    },
    {
      code: 'D',
      label: 'Co. Dublin',
      aliases: ['Co. Dublin', 'D'],
    },
    {
      code: 'G',
      label: 'Co. Galway',
      aliases: ['Co. Galway', 'G'],
    },
    {
      code: 'KY',
      label: 'Co. Kerry',
      aliases: ['Co. Kerry', 'KY'],
    },
    {
      code: 'KE',
      label: 'Co. Kildare',
      aliases: ['Co. Kildare', 'KE'],
    },
    {
      code: 'KK',
      label: 'Co. Kilkenny',
      aliases: ['Co. Kilkenny', 'KK'],
    },
    {
      code: 'LS',
      label: 'Co. Laois',
      aliases: ['Co. Laois', 'LS'],
    },
    {
      code: 'LM',
      label: 'Co. Leitrim',
      aliases: ['Co. Leitrim', 'LM'],
    },
    {
      code: 'LK',
      label: 'Co. Limerick',
      aliases: ['Co. Limerick', 'LK'],
    },
    {
      code: 'LD',
      label: 'Co. Longford',
      aliases: ['Co. Longford', 'LD'],
    },
    {
      code: 'LH',
      label: 'Co. Louth',
      aliases: ['Co. Louth', 'LH'],
    },
    {
      code: 'MO',
      label: 'Co. Mayo',
      aliases: ['Co. Mayo', 'MO'],
    },
    {
      code: 'MH',
      label: 'Co. Meath',
      aliases: ['Co. Meath', 'MH'],
    },
    {
      code: 'MN',
      label: 'Co. Monaghan',
      aliases: ['Co. Monaghan', 'MN'],
    },
    {
      code: 'OY',
      label: 'Co. Offaly',
      aliases: ['Co. Offaly', 'OY'],
    },
    {
      code: 'RN',
      label: 'Co. Roscommon',
      aliases: ['Co. Roscommon', 'RN'],
    },
    {
      code: 'SO',
      label: 'Co. Sligo',
      aliases: ['Co. Sligo', 'SO'],
    },
    {
      code: 'TA',
      label: 'Co. Tipperary',
      aliases: ['Co. Tipperary', 'TA'],
    },
    {
      code: 'WD',
      label: 'Co. Waterford',
      aliases: ['Co. Waterford', 'WD'],
    },
    {
      code: 'WH',
      label: 'Co. Westmeath',
      aliases: ['Co. Westmeath', 'WH'],
    },
    {
      code: 'WX',
      label: 'Co. Wexford',
      aliases: ['Co. Wexford', 'WX'],
    },
    {
      code: 'WW',
      label: 'Co. Wicklow',
      aliases: ['Co. Wicklow', 'WW'],
    },
  ],
  IN: [
    {
      code: 'AN',
      label: 'Andaman & Nicobar',
      aliases: ['Andaman and Nicobar Islands', 'Andaman & Nicobar', 'AN'],
    },
    {
      code: 'AP',
      label: 'Andhra Pradesh',
      aliases: ['Andhra Pradesh', 'AP'],
    },
    {
      code: 'AR',
      label: 'Arunachal Pradesh',
      aliases: ['Arunachal Pradesh', 'AR'],
    },
    {
      code: 'AS',
      label: 'Assam',
      aliases: ['Assam', 'AS'],
    },
    {
      code: 'BR',
      label: 'Bihar',
      aliases: ['Bihar', 'BR'],
    },
    {
      code: 'CH',
      label: 'Chandigarh',
      aliases: ['Chandigarh', 'CH'],
    },
    {
      code: 'CG',
      label: 'Chhattisgarh',
      aliases: ['Chhattisgarh', 'CG'],
    },
    {
      code: 'DH',
      label: 'Dadra & Nagar Haveli & Daman & Diu',
      aliases: [
        'Dadra and Nagar Haveli and Daman and Diu',
        'Dadra & Nagar Haveli & Daman & Diu',
        'DH',
      ],
    },
    {
      code: 'DL',
      label: 'Delhi',
      aliases: ['Delhi', 'DL'],
    },
    {
      code: 'GA',
      label: 'Goa',
      aliases: ['Goa', 'GA'],
    },
    {
      code: 'GJ',
      label: 'Gujarat',
      aliases: ['Gujarat', 'GJ'],
    },
    {
      code: 'HR',
      label: 'Haryana',
      aliases: ['Haryana', 'HR'],
    },
    {
      code: 'HP',
      label: 'Himachal Pradesh',
      aliases: ['Himachal Pradesh', 'HP'],
    },
    {
      code: 'JK',
      label: 'Jammu & Kashmir',
      aliases: ['Jammu and Kashmir', 'Jammu & Kashmir', 'JK'],
    },
    {
      code: 'JH',
      label: 'Jharkhand',
      aliases: ['Jharkhand', 'JH'],
    },
    {
      code: 'KA',
      label: 'Karnataka',
      aliases: ['Karnataka', 'KA'],
    },
    {
      code: 'KL',
      label: 'Kerala',
      aliases: ['Kerala', 'KL'],
    },
    {
      code: 'LA',
      label: 'Ladakh',
      aliases: ['Ladakh', 'LA'],
    },
    {
      code: 'LD',
      label: 'Lakshadweep',
      aliases: ['Lakshadweep', 'LD'],
    },
    {
      code: 'MP',
      label: 'Madhya Pradesh',
      aliases: ['Madhya Pradesh', 'MP'],
    },
    {
      code: 'MH',
      label: 'Maharashtra',
      aliases: ['Maharashtra', 'MH'],
    },
    {
      code: 'MN',
      label: 'Manipur',
      aliases: ['Manipur', 'MN'],
    },
    {
      code: 'ML',
      label: 'Meghalaya',
      aliases: ['Meghalaya', 'ML'],
    },
    {
      code: 'MZ',
      label: 'Mizoram',
      aliases: ['Mizoram', 'MZ'],
    },
    {
      code: 'NL',
      label: 'Nagaland',
      aliases: ['Nagaland', 'NL'],
    },
    {
      code: 'OD',
      label: 'Odisha',
      aliases: ['Odisha', 'OD'],
    },
    {
      code: 'PY',
      label: 'Puducherry',
      aliases: ['Puducherry', 'PY'],
    },
    {
      code: 'PB',
      label: 'Punjab',
      aliases: ['Punjab', 'PB'],
    },
    {
      code: 'RJ',
      label: 'Rajasthan',
      aliases: ['Rajasthan', 'RJ'],
    },
    {
      code: 'SK',
      label: 'Sikkim',
      aliases: ['Sikkim', 'SK'],
    },
    {
      code: 'TN',
      label: 'Tamil Nadu',
      aliases: ['Tamil Nadu', 'TN'],
    },
    {
      code: 'TS',
      label: 'Telangana',
      aliases: ['Telangana', 'TS'],
    },
    {
      code: 'TR',
      label: 'Tripura',
      aliases: ['Tripura', 'TR'],
    },
    {
      code: 'UP',
      label: 'Uttar Pradesh',
      aliases: ['Uttar Pradesh', 'UP'],
    },
    {
      code: 'UK',
      label: 'Uttarakhand',
      aliases: ['Uttarakhand', 'UK'],
    },
    {
      code: 'WB',
      label: 'West Bengal',
      aliases: ['West Bengal', 'WB'],
    },
  ],
  IQ: [
    {
      code: 'AR',
      label: 'Erbil',
      aliases: ['أربيل', 'Erbil', 'AR'],
    },
    {
      code: 'KR',
      label: 'Kurdistan Region',
      aliases: ['إقليم كوردستان', 'Kurdistan Region', 'KR'],
    },
    {
      code: 'AN',
      label: 'Al Anbar',
      aliases: ['الانبار', 'Al Anbar', 'AN'],
    },
    {
      code: 'BA',
      label: 'Basra',
      aliases: ['البصرة', 'Basra', 'BA'],
    },
    {
      code: 'SU',
      label: 'Sulaymaniyah',
      aliases: ['السليمانية', 'Sulaymaniyah', 'SU'],
    },
    {
      code: 'QA',
      label: 'Al-Qādisiyyah',
      aliases: ['القادسية', 'Al-Qādisiyyah', 'QA'],
    },
    {
      code: 'MU',
      label: 'Al Muthanna',
      aliases: ['المثنى', 'Al Muthanna', 'MU'],
    },
    {
      code: 'NA',
      label: 'Najaf',
      aliases: ['النجف', 'Najaf', 'NA'],
    },
    {
      code: 'BB',
      label: 'Babylon',
      aliases: ['بابل', 'Babylon', 'BB'],
    },
    {
      code: 'BG',
      label: 'Baghdad',
      aliases: ['بغداد', 'Baghdad', 'BG'],
    },
    {
      code: 'DA',
      label: 'Duhok',
      aliases: ['دهوك', 'Duhok', 'DA'],
    },
    {
      code: 'DI',
      label: 'Diyala',
      aliases: ['ديالى', 'Diyala', 'DI'],
    },
    {
      code: 'DQ',
      label: 'Dhi Qar',
      aliases: ['ذي قار', 'Dhi Qar', 'DQ'],
    },
    {
      code: 'SD',
      label: 'Saladin',
      aliases: ['صلاح الدين', 'Saladin', 'SD'],
    },
    {
      code: 'KA',
      label: 'Karbala',
      aliases: ['كربلاء', 'Karbala', 'KA'],
    },
    {
      code: 'KI',
      label: 'Kirkuk',
      aliases: ['كركوك', 'Kirkuk', 'KI'],
    },
    {
      code: 'MA',
      label: 'Maysan',
      aliases: ['ميسان', 'Maysan', 'MA'],
    },
    {
      code: 'NI',
      label: 'Nineveh',
      aliases: ['نينوى', 'Nineveh', 'NI'],
    },
    {
      code: 'WA',
      label: 'Wasit',
      aliases: ['واسط', 'Wasit', 'WA'],
    },
  ],
  IR: [
    {
      code: '03',
      label: 'East Azerbaijan Province',
      aliases: ['استان آذربایجان شرقی', 'East Azerbaijan Province', '03'],
    },
    {
      code: '04',
      label: 'West Azerbaijan Province',
      aliases: ['استان آذربایجان غربی', 'West Azerbaijan Province', '04'],
    },
    {
      code: '24',
      label: 'Ardabil Province',
      aliases: ['استان اردبیل', 'Ardabil Province', '24'],
    },
    {
      code: '10',
      label: 'Isfahan Province',
      aliases: ['استان اصفهان', 'Isfahan Province', '10'],
    },
    {
      code: '30',
      label: 'Alborz Province',
      aliases: ['استان البرز', 'Alborz Province', '30'],
    },
    {
      code: '16',
      label: 'Ilam Province',
      aliases: ['استان ایلام', 'Ilam Province', '16'],
    },
    {
      code: '18',
      label: 'Bushehr Province',
      aliases: ['استان بوشهر', 'Bushehr Province', '18'],
    },
    {
      code: '23',
      label: 'Tehran Province',
      aliases: ['استان تهران', 'Tehran Province', '23'],
    },
    {
      code: '14',
      label: 'Chaharmahal and Bakhtiari Province',
      aliases: ['استان چهارمحال و بختیاری', 'Chaharmahal and Bakhtiari Province', '14'],
    },
    {
      code: '29',
      label: 'South Khorasan Province',
      aliases: ['استان خراسان جنوبی', 'South Khorasan Province', '29'],
    },
    {
      code: '09',
      label: 'Razavi Khorasan Province',
      aliases: ['استان خراسان رضوی', 'Razavi Khorasan Province', '09'],
    },
    {
      code: '28',
      label: 'North Khorasan Province',
      aliases: ['استان خراسان شمالی', 'North Khorasan Province', '28'],
    },
    {
      code: '06',
      label: 'Khuzestan Province',
      aliases: ['استان خوزستان', 'Khuzestan Province', '06'],
    },
    {
      code: '19',
      label: 'Zanjan Province',
      aliases: ['استان زنجان', 'Zanjan Province', '19'],
    },
    {
      code: '20',
      label: 'Semnan Province',
      aliases: ['استان سمنان', 'Semnan Province', '20'],
    },
    {
      code: '11',
      label: 'Sistan and Baluchestan Province',
      aliases: ['استان سیستان و بلوچستان', 'Sistan and Baluchestan Province', '11'],
    },
    {
      code: '07',
      label: 'Fars Province',
      aliases: ['استان فارس', 'Fars Province', '07'],
    },
    {
      code: '26',
      label: 'Qazvin Province',
      aliases: ['استان قزوین', 'Qazvin Province', '26'],
    },
    {
      code: '25',
      label: 'Qom Province',
      aliases: ['استان قم', 'Qom Province', '25'],
    },
    {
      code: '12',
      label: 'Kurdistan Province',
      aliases: ['استان کردستان', 'Kurdistan Province', '12'],
    },
    {
      code: '08',
      label: 'Kerman Province',
      aliases: ['استان کرمان', 'Kerman Province', '08'],
    },
    {
      code: '05',
      label: 'Kermanshah Province',
      aliases: ['استان کرمانشاه', 'Kermanshah Province', '05'],
    },
    {
      code: '17',
      label: 'Kohgiluyeh and Boyer-Ahmad Province',
      aliases: ['استان کهگیلویه و بویراحمد', 'Kohgiluyeh and Boyer-Ahmad Province', '17'],
    },
    {
      code: '27',
      label: 'Golestan Province',
      aliases: ['استان گلستان', 'Golestan Province', '27'],
    },
    {
      code: '01',
      label: 'Gilan Province',
      aliases: ['استان گیلان', 'Gilan Province', '01'],
    },
    {
      code: '15',
      label: 'Lorestan Province',
      aliases: ['استان لرستان', 'Lorestan Province', '15'],
    },
    {
      code: '02',
      label: 'Mazandaran Province',
      aliases: ['استان مازندران', 'Mazandaran Province', '02'],
    },
    {
      code: '00',
      label: 'Markazi Province',
      aliases: ['استان مرکزی', 'Markazi Province', '00'],
    },
    {
      code: '22',
      label: 'Hormozgan Province',
      aliases: ['استان هرمزگان', 'Hormozgan Province', '22'],
    },
    {
      code: '13',
      label: 'Hamadan Province',
      aliases: ['استان همدان', 'Hamadan Province', '13'],
    },
    {
      code: '21',
      label: 'Yazd Province',
      aliases: ['استان یزد', 'Yazd Province', '21'],
    },
  ],
  IT: [
    {
      code: 'AG',
      label: 'Agrigento',
      aliases: ['AG', 'Agrigento'],
    },
    {
      code: 'AL',
      label: 'Alessandria',
      aliases: ['AL', 'Alessandria'],
    },
    {
      code: 'AN',
      label: 'Ancona',
      aliases: ['AN', 'Ancona'],
    },
    {
      code: 'AO',
      label: 'Aosta',
      aliases: ['AO', 'Aosta'],
    },
    {
      code: 'AR',
      label: 'Arezzo',
      aliases: ['AR', 'Arezzo'],
    },
    {
      code: 'AP',
      label: 'Ascoli Piceno',
      aliases: ['AP', 'Ascoli Piceno'],
    },
    {
      code: 'AT',
      label: 'Asti',
      aliases: ['AT', 'Asti'],
    },
    {
      code: 'AV',
      label: 'Avellino',
      aliases: ['AV', 'Avellino'],
    },
    {
      code: 'BA',
      label: 'Bari',
      aliases: ['BA', 'Bari'],
    },
    {
      code: 'BT',
      label: 'Barletta-Andria-Trani',
      aliases: ['BT', 'Barletta-Andria-Trani'],
    },
    {
      code: 'BL',
      label: 'Belluno',
      aliases: ['BL', 'Belluno'],
    },
    {
      code: 'BN',
      label: 'Benevento',
      aliases: ['BN', 'Benevento'],
    },
    {
      code: 'BG',
      label: 'Bergamo',
      aliases: ['BG', 'Bergamo'],
    },
    {
      code: 'BI',
      label: 'Biella',
      aliases: ['BI', 'Biella'],
    },
    {
      code: 'BO',
      label: 'Bologna',
      aliases: ['BO', 'Bologna'],
    },
    {
      code: 'BZ',
      label: 'Bolzano',
      aliases: ['BZ', 'Bolzano'],
    },
    {
      code: 'BS',
      label: 'Brescia',
      aliases: ['BS', 'Brescia'],
    },
    {
      code: 'BR',
      label: 'Brindisi',
      aliases: ['BR', 'Brindisi'],
    },
    {
      code: 'CA',
      label: 'Cagliari',
      aliases: ['CA', 'Cagliari'],
    },
    {
      code: 'CL',
      label: 'Caltanissetta',
      aliases: ['CL', 'Caltanissetta'],
    },
    {
      code: 'CB',
      label: 'Campobasso',
      aliases: ['CB', 'Campobasso'],
    },
    {
      code: 'CE',
      label: 'Caserta',
      aliases: ['CE', 'Caserta'],
    },
    {
      code: 'CT',
      label: 'Catania',
      aliases: ['CT', 'Catania'],
    },
    {
      code: 'CZ',
      label: 'Catanzaro',
      aliases: ['CZ', 'Catanzaro'],
    },
    {
      code: 'CH',
      label: 'Chieti',
      aliases: ['CH', 'Chieti'],
    },
    {
      code: 'CO',
      label: 'Como',
      aliases: ['CO', 'Como'],
    },
    {
      code: 'CS',
      label: 'Cosenza',
      aliases: ['CS', 'Cosenza'],
    },
    {
      code: 'CR',
      label: 'Cremona',
      aliases: ['CR', 'Cremona'],
    },
    {
      code: 'KR',
      label: 'Crotone',
      aliases: ['KR', 'Crotone'],
    },
    {
      code: 'CN',
      label: 'Cuneo',
      aliases: ['CN', 'Cuneo'],
    },
    {
      code: 'EN',
      label: 'Enna',
      aliases: ['EN', 'Enna'],
    },
    {
      code: 'FM',
      label: 'Fermo',
      aliases: ['FM', 'Fermo'],
    },
    {
      code: 'FE',
      label: 'Ferrara',
      aliases: ['FE', 'Ferrara'],
    },
    {
      code: 'FI',
      label: 'Firenze',
      aliases: ['FI', 'Firenze'],
    },
    {
      code: 'FG',
      label: 'Foggia',
      aliases: ['FG', 'Foggia'],
    },
    {
      code: 'FC',
      label: 'Forlì-Cesena',
      aliases: ['FC', 'Forlì-Cesena'],
    },
    {
      code: 'FR',
      label: 'Frosinone',
      aliases: ['FR', 'Frosinone'],
    },
    {
      code: 'GA',
      label: 'Gallura Nord-Est Sardegna',
      aliases: ['GA', 'Gallura Nord-Est Sardegna'],
    },
    {
      code: 'GE',
      label: 'Genova',
      aliases: ['GE', 'Genova'],
    },
    {
      code: 'GO',
      label: 'Gorizia',
      aliases: ['GO', 'Gorizia'],
    },
    {
      code: 'GR',
      label: 'Grosseto',
      aliases: ['GR', 'Grosseto'],
    },
    {
      code: 'IM',
      label: 'Imperia',
      aliases: ['IM', 'Imperia'],
    },
    {
      code: 'IS',
      label: 'Isernia',
      aliases: ['IS', 'Isernia'],
    },
    {
      code: 'AQ',
      label: "L'Aquila",
      aliases: ['AQ', "L'Aquila"],
    },
    {
      code: 'SP',
      label: 'La Spezia',
      aliases: ['SP', 'La Spezia'],
    },
    {
      code: 'LT',
      label: 'Latina',
      aliases: ['LT', 'Latina'],
    },
    {
      code: 'LE',
      label: 'Lecce',
      aliases: ['LE', 'Lecce'],
    },
    {
      code: 'LC',
      label: 'Lecco',
      aliases: ['LC', 'Lecco'],
    },
    {
      code: 'LI',
      label: 'Livorno',
      aliases: ['LI', 'Livorno'],
    },
    {
      code: 'LO',
      label: 'Lodi',
      aliases: ['LO', 'Lodi'],
    },
    {
      code: 'LU',
      label: 'Lucca',
      aliases: ['LU', 'Lucca'],
    },
    {
      code: 'MC',
      label: 'Macerata',
      aliases: ['MC', 'Macerata'],
    },
    {
      code: 'MN',
      label: 'Mantova',
      aliases: ['MN', 'Mantova'],
    },
    {
      code: 'MS',
      label: 'Massa-Carrara',
      aliases: ['MS', 'Massa-Carrara'],
    },
    {
      code: 'MT',
      label: 'Matera',
      aliases: ['MT', 'Matera'],
    },
    {
      code: 'VS',
      label: 'Medio Campidano',
      aliases: ['VS', 'Medio Campidano'],
    },
    {
      code: 'ME',
      label: 'Messina',
      aliases: ['ME', 'Messina'],
    },
    {
      code: 'MI',
      label: 'Milano',
      aliases: ['MI', 'Milano'],
    },
    {
      code: 'MO',
      label: 'Modena',
      aliases: ['MO', 'Modena'],
    },
    {
      code: 'MB',
      label: 'Monza e Brianza',
      aliases: ['MB', 'Monza e Brianza'],
    },
    {
      code: 'NA',
      label: 'Napoli',
      aliases: ['NA', 'Napoli'],
    },
    {
      code: 'NO',
      label: 'Novara',
      aliases: ['NO', 'Novara'],
    },
    {
      code: 'NU',
      label: 'Nuoro',
      aliases: ['NU', 'Nuoro'],
    },
    {
      code: 'OG',
      label: 'Ogliastra',
      aliases: ['OG', 'Ogliastra'],
    },
    {
      code: 'OR',
      label: 'Oristano',
      aliases: ['OR', 'Oristano'],
    },
    {
      code: 'PD',
      label: 'Padova',
      aliases: ['PD', 'Padova'],
    },
    {
      code: 'PA',
      label: 'Palermo',
      aliases: ['PA', 'Palermo'],
    },
    {
      code: 'PR',
      label: 'Parma',
      aliases: ['PR', 'Parma'],
    },
    {
      code: 'PV',
      label: 'Pavia',
      aliases: ['PV', 'Pavia'],
    },
    {
      code: 'PG',
      label: 'Perugia',
      aliases: ['PG', 'Perugia'],
    },
    {
      code: 'PU',
      label: 'Pesaro e Urbino',
      aliases: ['PU', 'Pesaro e Urbino'],
    },
    {
      code: 'PE',
      label: 'Pescara',
      aliases: ['PE', 'Pescara'],
    },
    {
      code: 'PC',
      label: 'Piacenza',
      aliases: ['PC', 'Piacenza'],
    },
    {
      code: 'PI',
      label: 'Pisa',
      aliases: ['PI', 'Pisa'],
    },
    {
      code: 'PT',
      label: 'Pistoia',
      aliases: ['PT', 'Pistoia'],
    },
    {
      code: 'PN',
      label: 'Pordenone',
      aliases: ['PN', 'Pordenone'],
    },
    {
      code: 'PZ',
      label: 'Potenza',
      aliases: ['PZ', 'Potenza'],
    },
    {
      code: 'PO',
      label: 'Prato',
      aliases: ['PO', 'Prato'],
    },
    {
      code: 'RG',
      label: 'Ragusa',
      aliases: ['RG', 'Ragusa'],
    },
    {
      code: 'RA',
      label: 'Ravenna',
      aliases: ['RA', 'Ravenna'],
    },
    {
      code: 'RC',
      label: 'Reggio Calabria',
      aliases: ['RC', 'Reggio Calabria'],
    },
    {
      code: 'RE',
      label: 'Reggio Emilia',
      aliases: ['RE', 'Reggio Emilia'],
    },
    {
      code: 'RI',
      label: 'Rieti',
      aliases: ['RI', 'Rieti'],
    },
    {
      code: 'RN',
      label: 'Rimini',
      aliases: ['RN', 'Rimini'],
    },
    {
      code: 'RM',
      label: 'Roma',
      aliases: ['RM', 'Roma'],
    },
    {
      code: 'RO',
      label: 'Rovigo',
      aliases: ['RO', 'Rovigo'],
    },
    {
      code: 'SA',
      label: 'Salerno',
      aliases: ['SA', 'Salerno'],
    },
    {
      code: 'SS',
      label: 'Sassari',
      aliases: ['SS', 'Sassari'],
    },
    {
      code: 'SV',
      label: 'Savona',
      aliases: ['SV', 'Savona'],
    },
    {
      code: 'SI',
      label: 'Siena',
      aliases: ['SI', 'Siena'],
    },
    {
      code: 'SR',
      label: 'Siracusa',
      aliases: ['SR', 'Siracusa'],
    },
    {
      code: 'SO',
      label: 'Sondrio',
      aliases: ['SO', 'Sondrio'],
    },
    {
      code: 'SU',
      label: 'Sud Sardegna',
      aliases: ['SU', 'Sud Sardegna'],
    },
    {
      code: 'SD',
      label: 'Sulcis Iglesiente',
      aliases: ['SD', 'Sulcis Iglesiente'],
    },
    {
      code: 'TA',
      label: 'Taranto',
      aliases: ['TA', 'Taranto'],
    },
    {
      code: 'TE',
      label: 'Teramo',
      aliases: ['TE', 'Teramo'],
    },
    {
      code: 'TR',
      label: 'Terni',
      aliases: ['TR', 'Terni'],
    },
    {
      code: 'TO',
      label: 'Torino',
      aliases: ['TO', 'Torino'],
    },
    {
      code: 'TP',
      label: 'Trapani',
      aliases: ['TP', 'Trapani'],
    },
    {
      code: 'TN',
      label: 'Trento',
      aliases: ['TN', 'Trento'],
    },
    {
      code: 'TV',
      label: 'Treviso',
      aliases: ['TV', 'Treviso'],
    },
    {
      code: 'TS',
      label: 'Trieste',
      aliases: ['TS', 'Trieste'],
    },
    {
      code: 'UD',
      label: 'Udine',
      aliases: ['UD', 'Udine'],
    },
    {
      code: 'VA',
      label: 'Varese',
      aliases: ['VA', 'Varese'],
    },
    {
      code: 'VE',
      label: 'Venezia',
      aliases: ['VE', 'Venezia'],
    },
    {
      code: 'VB',
      label: 'Verbano-Cusio-Ossola',
      aliases: ['VB', 'Verbano-Cusio-Ossola'],
    },
    {
      code: 'VC',
      label: 'Vercelli',
      aliases: ['VC', 'Vercelli'],
    },
    {
      code: 'VR',
      label: 'Verona',
      aliases: ['VR', 'Verona'],
    },
    {
      code: 'VV',
      label: 'Vibo Valentia',
      aliases: ['VV', 'Vibo Valentia'],
    },
    {
      code: 'VI',
      label: 'Vicenza',
      aliases: ['VI', 'Vicenza'],
    },
    {
      code: 'VT',
      label: 'Viterbo',
      aliases: ['VT', 'Viterbo'],
    },
  ],
  JM: [
    {
      code: '13',
      label: 'Clarendon',
      aliases: ['Clarendon', '13'],
    },
    {
      code: '09',
      label: 'Hanover',
      aliases: ['Hanover', '09'],
    },
    {
      code: '01',
      label: 'Kingston',
      aliases: ['Kingston', '01'],
    },
    {
      code: '12',
      label: 'Manchester',
      aliases: ['Manchester', '12'],
    },
    {
      code: '04',
      label: 'Portland',
      aliases: ['Portland', '04'],
    },
    {
      code: '02',
      label: 'St. Andrew',
      aliases: ['St. Andrew', '02'],
    },
    {
      code: '06',
      label: 'St. Ann',
      aliases: ['St. Ann', '06'],
    },
    {
      code: '14',
      label: 'St. Catherine',
      aliases: ['St. Catherine', '14'],
    },
    {
      code: '11',
      label: 'St. Elizabeth',
      aliases: ['St. Elizabeth', '11'],
    },
    {
      code: '08',
      label: 'St. James',
      aliases: ['St. James', '08'],
    },
    {
      code: '05',
      label: 'St. Mary',
      aliases: ['St. Mary', '05'],
    },
    {
      code: '03',
      label: 'St. Thomas',
      aliases: ['St. Thomas', '03'],
    },
    {
      code: '07',
      label: 'Trelawny',
      aliases: ['Trelawny', '07'],
    },
    {
      code: '10',
      label: 'Westmoreland',
      aliases: ['Westmoreland', '10'],
    },
  ],
  JP: [
    {
      code: '01',
      label: 'Hokkaido',
      aliases: ['北海道', 'Hokkaido', '01'],
    },
    {
      code: '02',
      label: 'Aomori',
      aliases: ['青森県', 'Aomori', '02'],
    },
    {
      code: '03',
      label: 'Iwate',
      aliases: ['岩手県', 'Iwate', '03'],
    },
    {
      code: '04',
      label: 'Miyagi',
      aliases: ['宮城県', 'Miyagi', '04'],
    },
    {
      code: '05',
      label: 'Akita',
      aliases: ['秋田県', 'Akita', '05'],
    },
    {
      code: '06',
      label: 'Yamagata',
      aliases: ['山形県', 'Yamagata', '06'],
    },
    {
      code: '07',
      label: 'Fukushima',
      aliases: ['福島県', 'Fukushima', '07'],
    },
    {
      code: '08',
      label: 'Ibaraki',
      aliases: ['茨城県', 'Ibaraki', '08'],
    },
    {
      code: '09',
      label: 'Tochigi',
      aliases: ['栃木県', 'Tochigi', '09'],
    },
    {
      code: '10',
      label: 'Gunma',
      aliases: ['群馬県', 'Gunma', '10'],
    },
    {
      code: '11',
      label: 'Saitama',
      aliases: ['埼玉県', 'Saitama', '11'],
    },
    {
      code: '12',
      label: 'Chiba',
      aliases: ['千葉県', 'Chiba', '12'],
    },
    {
      code: '13',
      label: 'Tokyo',
      aliases: ['東京都', 'Tokyo', '13'],
    },
    {
      code: '14',
      label: 'Kanagawa',
      aliases: ['神奈川県', 'Kanagawa', '14'],
    },
    {
      code: '15',
      label: 'Niigata',
      aliases: ['新潟県', 'Niigata', '15'],
    },
    {
      code: '16',
      label: 'Toyama',
      aliases: ['富山県', 'Toyama', '16'],
    },
    {
      code: '17',
      label: 'Ishikawa',
      aliases: ['石川県', 'Ishikawa', '17'],
    },
    {
      code: '18',
      label: 'Fukui',
      aliases: ['福井県', 'Fukui', '18'],
    },
    {
      code: '19',
      label: 'Yamanashi',
      aliases: ['山梨県', 'Yamanashi', '19'],
    },
    {
      code: '20',
      label: 'Nagano',
      aliases: ['長野県', 'Nagano', '20'],
    },
    {
      code: '21',
      label: 'Gifu',
      aliases: ['岐阜県', 'Gifu', '21'],
    },
    {
      code: '22',
      label: 'Shizuoka',
      aliases: ['静岡県', 'Shizuoka', '22'],
    },
    {
      code: '23',
      label: 'Aichi',
      aliases: ['愛知県', 'Aichi', '23'],
    },
    {
      code: '24',
      label: 'Mie',
      aliases: ['三重県', 'Mie', '24'],
    },
    {
      code: '25',
      label: 'Shiga',
      aliases: ['滋賀県', 'Shiga', '25'],
    },
    {
      code: '26',
      label: 'Kyoto',
      aliases: ['京都府', 'Kyoto', '26'],
    },
    {
      code: '27',
      label: 'Osaka',
      aliases: ['大阪府', 'Osaka', '27'],
    },
    {
      code: '28',
      label: 'Hyogo',
      aliases: ['兵庫県', 'Hyogo', '28'],
    },
    {
      code: '29',
      label: 'Nara',
      aliases: ['奈良県', 'Nara', '29'],
    },
    {
      code: '30',
      label: 'Wakayama',
      aliases: ['和歌山県', 'Wakayama', '30'],
    },
    {
      code: '31',
      label: 'Tottori',
      aliases: ['鳥取県', 'Tottori', '31'],
    },
    {
      code: '32',
      label: 'Shimane',
      aliases: ['島根県', 'Shimane', '32'],
    },
    {
      code: '33',
      label: 'Okayama',
      aliases: ['岡山県', 'Okayama', '33'],
    },
    {
      code: '34',
      label: 'Hiroshima',
      aliases: ['広島県', 'Hiroshima', '34'],
    },
    {
      code: '35',
      label: 'Yamaguchi',
      aliases: ['山口県', 'Yamaguchi', '35'],
    },
    {
      code: '36',
      label: 'Tokushima',
      aliases: ['徳島県', 'Tokushima', '36'],
    },
    {
      code: '37',
      label: 'Kagawa',
      aliases: ['香川県', 'Kagawa', '37'],
    },
    {
      code: '38',
      label: 'Ehime',
      aliases: ['愛媛県', 'Ehime', '38'],
    },
    {
      code: '39',
      label: 'Kochi',
      aliases: ['高知県', 'Kochi', '39'],
    },
    {
      code: '40',
      label: 'Fukuoka',
      aliases: ['福岡県', 'Fukuoka', '40'],
    },
    {
      code: '41',
      label: 'Saga',
      aliases: ['佐賀県', 'Saga', '41'],
    },
    {
      code: '42',
      label: 'Nagasaki',
      aliases: ['長崎県', 'Nagasaki', '42'],
    },
    {
      code: '43',
      label: 'Kumamoto',
      aliases: ['熊本県', 'Kumamoto', '43'],
    },
    {
      code: '44',
      label: 'Oita',
      aliases: ['大分県', 'Oita', '44'],
    },
    {
      code: '45',
      label: 'Miyazaki',
      aliases: ['宮崎県', 'Miyazaki', '45'],
    },
    {
      code: '46',
      label: 'Kagoshima',
      aliases: ['鹿児島県', 'Kagoshima', '46'],
    },
    {
      code: '47',
      label: 'Okinawa',
      aliases: ['沖縄県', 'Okinawa', '47'],
    },
  ],
  KN: [
    {
      code: 'N',
      label: 'Nevis',
      aliases: ['Nevis', 'N'],
    },
    {
      code: 'K',
      label: 'St. Kitts',
      aliases: ['St. Kitts', 'K'],
    },
  ],
  KP: [
    {
      code: '07',
      label: 'Kangwon',
      aliases: ['강원도', 'Kangwon', '07'],
    },
    {
      code: '15',
      label: 'Kaesong',
      aliases: ['개성시', 'Kaesong', '15'],
    },
    {
      code: '14',
      label: 'Nampo',
      aliases: ['남포시', 'Nampo', '14'],
    },
    {
      code: '13',
      label: 'Rason',
      aliases: ['라선 특별시', 'Rason', '13'],
    },
    {
      code: '10',
      label: 'Ryanggang',
      aliases: ['량강도', 'Ryanggang', '10'],
    },
    {
      code: '04',
      label: 'Chagang',
      aliases: ['자강도', 'Chagang', '04'],
    },
    {
      code: '02',
      label: 'South Pyongan',
      aliases: ['평안 남도', 'South Pyongan', '02'],
    },
    {
      code: '03',
      label: 'North Pyongan',
      aliases: ['평안 북도', 'North Pyongan', '03'],
    },
    {
      code: '01',
      label: 'Pyongyang',
      aliases: ['평양 직할시', 'Pyongyang', '01'],
    },
    {
      code: '08',
      label: 'South Hamgyong',
      aliases: ['함경 남도', 'South Hamgyong', '08'],
    },
    {
      code: '09',
      label: 'North Hamgyong',
      aliases: ['함경 북도', 'North Hamgyong', '09'],
    },
    {
      code: '05',
      label: 'South Hwanghae',
      aliases: ['황해남도', 'South Hwanghae', '05'],
    },
    {
      code: '06',
      label: 'North Hwanghae',
      aliases: ['황해북도', 'North Hwanghae', '06'],
    },
  ],
  KR: [
    {
      code: '42',
      label: 'Gangwon-do',
      aliases: ['강원도', 'Gangwon-do', '강원', '42'],
    },
    {
      code: '41',
      label: 'Gyeonggi-do',
      aliases: ['경기도', 'Gyeonggi-do', '경기', '41'],
    },
    {
      code: '48',
      label: 'Gyeongsangnam-do',
      aliases: ['경상남도', 'Gyeongsangnam-do', '경남', '48'],
    },
    {
      code: '47',
      label: 'Gyeongsangbuk-do',
      aliases: ['경상북도', 'Gyeongsangbuk-do', '경북', '47'],
    },
    {
      code: '27',
      label: 'Daegu',
      aliases: ['대구광역시', 'Daegu', '대구', '27'],
    },
    {
      code: '30',
      label: 'Daejeon',
      aliases: ['대전광역시', 'Daejeon', '대전', '30'],
    },
    {
      code: '26',
      label: 'Busan',
      aliases: ['부산광역시', 'Busan', '부산', '26'],
    },
    {
      code: '11',
      label: 'Seoul',
      aliases: ['서울특별시', 'Seoul', '서울', '11'],
    },
    {
      code: '50',
      label: 'Sejong',
      aliases: ['세종특별자치시', 'Sejong', '세종', '50'],
    },
    {
      code: '31',
      label: 'Ulsan',
      aliases: ['울산광역시', 'Ulsan', '울산', '31'],
    },
    {
      code: '28',
      label: 'Incheon',
      aliases: ['인천광역시', 'Incheon', '인천', '28'],
    },
    {
      code: '전남광주통합특별시',
      label: 'Jeonnam-Gwangju',
      aliases: ['전남광주통합특별시', 'Jeonnam-Gwangju', '전남광주'],
    },
    {
      code: '45',
      label: 'Jeollabuk-do',
      aliases: ['전라북도', 'Jeollabuk-do', '전북', '45'],
    },
    {
      code: '49',
      label: 'Jeju-do',
      aliases: ['제주특별자치도', 'Jeju-do', '제주', '49'],
    },
    {
      code: '44',
      label: 'Chungcheongnam-do',
      aliases: ['충청남도', 'Chungcheongnam-do', '충남', '44'],
    },
    {
      code: '43',
      label: 'Chungcheongbuk-do',
      aliases: ['충청북도', 'Chungcheongbuk-do', '충북', '43'],
    },
  ],
  KY: [
    {
      code: 'Cayman Brac',
      label: 'Cayman Brac',
      aliases: ['Cayman Brac'],
    },
    {
      code: 'Grand Cayman',
      label: 'Grand Cayman',
      aliases: ['Grand Cayman'],
    },
    {
      code: 'Little Cayman',
      label: 'Little Cayman',
      aliases: ['Little Cayman'],
    },
  ],
  KZ: [
    {
      code: '10',
      label: 'Abai Region',
      aliases: ['Абай облысы', 'Abai Region', '10'],
    },
    {
      code: '11',
      label: 'Akmola Region',
      aliases: ['Ақмола облысы', 'Akmola Region', '11'],
    },
    {
      code: '15',
      label: 'Aktobe Region',
      aliases: ['Ақтөбе облысы', 'Aktobe Region', '15'],
    },
    {
      code: '75',
      label: 'Almaty',
      aliases: ['Алматы', 'Almaty', '75'],
    },
    {
      code: '19',
      label: 'Almaty Region',
      aliases: ['Алматы облысы', 'Almaty Region', '19'],
    },
    {
      code: '71',
      label: 'Astana',
      aliases: ['Астана', 'Astana', '71'],
    },
    {
      code: '23',
      label: 'Atyrau Region',
      aliases: ['Атырау облысы', 'Atyrau Region', '23'],
    },
    {
      code: '27',
      label: 'West Kazakhstan Region',
      aliases: ['Батыс Қазақстан облысы', 'West Kazakhstan Region', '27'],
    },
    {
      code: '31',
      label: 'Jambyl Region',
      aliases: ['Жамбыл облысы', 'Jambyl Region', '31'],
    },
    {
      code: '33',
      label: 'Jetisu Region',
      aliases: ['Жетісу облысы', 'Jetisu Region', '33'],
    },
    {
      code: '35',
      label: 'Karaganda Region',
      aliases: ['Қарағанды облысы', 'Karaganda Region', '35'],
    },
    {
      code: '39',
      label: 'Kostanay Region',
      aliases: ['Қостанай облысы', 'Kostanay Region', '39'],
    },
    {
      code: '43',
      label: 'Kyzylorda Region',
      aliases: ['Қызылорда облысы', 'Kyzylorda Region', '43'],
    },
    {
      code: '47',
      label: 'Mangystau Region',
      aliases: ['Маңғыстау облысы', 'Mangystau Region', '47'],
    },
    {
      code: '55',
      label: 'Pavlodar Region',
      aliases: ['Павлодар облысы', 'Pavlodar Region', '55'],
    },
    {
      code: '59',
      label: 'North Kazakhstan Region',
      aliases: ['Солтүстік Қазақстан облысы', 'North Kazakhstan Region', '59'],
    },
    {
      code: '61',
      label: 'Turkistan Region',
      aliases: ['Түркістан облысы', 'Turkistan Region', '61'],
    },
    {
      code: '62',
      label: 'Ulytau Region',
      aliases: ['Ұлытау облысы', 'Ulytau Region', '62'],
    },
    {
      code: '63',
      label: 'East Kazakhstan Region',
      aliases: ['Шығыс Қазақстан облысы', 'East Kazakhstan Region', '63'],
    },
    {
      code: '79',
      label: 'Shymkent',
      aliases: ['Шымкент', 'Shymkent', '79'],
    },
  ],
  MN: [
    {
      code: '073',
      label: 'Arkhangai',
      aliases: ['Архангай', 'Arkhangai', '073'],
    },
    {
      code: '071',
      label: 'Bayan-Ölgii',
      aliases: ['Баян-Өлгий', 'Bayan-Ölgii', '071'],
    },
    {
      code: '069',
      label: 'Bayankhongor',
      aliases: ['Баянхонгор', 'Bayankhongor', '069'],
    },
    {
      code: '067',
      label: 'Bulgan',
      aliases: ['Булган', 'Bulgan', '067'],
    },
    {
      code: '065',
      label: 'Govi-Altai',
      aliases: ['Говь-Алтай', 'Govi-Altai', '065'],
    },
    {
      code: '064',
      label: 'Govisümber',
      aliases: ['Говьсүмбэр', 'Govisümber', '064'],
    },
    {
      code: '037',
      label: 'Darkhan-Uul',
      aliases: ['Дархан-Уул', 'Darkhan-Uul', '037'],
    },
    {
      code: '063',
      label: 'Dornogovi',
      aliases: ['Дорноговь', 'Dornogovi', '063'],
    },
    {
      code: '061',
      label: 'Dornod',
      aliases: ['Дорнод', 'Dornod', '061'],
    },
    {
      code: '059',
      label: 'Dundgovi',
      aliases: ['Дундговь', 'Dundgovi', '059'],
    },
    {
      code: '057',
      label: 'Zavkhan',
      aliases: ['Завхан', 'Zavkhan', '057'],
    },
    {
      code: '035',
      label: 'Orkhon',
      aliases: ['Орхон', 'Orkhon', '035'],
    },
    {
      code: '055',
      label: 'Ovorkhangai',
      aliases: ['Өвөрхангай', 'Ovorkhangai', '055'],
    },
    {
      code: '053',
      label: 'Ömnögovi',
      aliases: ['Өмнөговь', 'Ömnögovi', '053'],
    },
    {
      code: '051',
      label: 'Sükhbaatar',
      aliases: ['Сүхбаатар', 'Sükhbaatar', '051'],
    },
    {
      code: '049',
      label: 'Selenge',
      aliases: ['Сэлэнгэ', 'Selenge', '049'],
    },
    {
      code: '047',
      label: 'Töv',
      aliases: ['Төв', 'Töv', '047'],
    },
    {
      code: '046',
      label: 'Uvs',
      aliases: ['Увс', 'Uvs', '046'],
    },
    {
      code: '1',
      label: 'Ulaanbaatar',
      aliases: ['Улаанбаатар', 'Ulaanbaatar', '1'],
    },
    {
      code: '043',
      label: 'Khovd',
      aliases: ['Ховд', 'Khovd', '043'],
    },
    {
      code: '041',
      label: 'Khovsgol',
      aliases: ['Хөвсгөл', 'Khovsgol', '041'],
    },
    {
      code: '039',
      label: 'Khentii',
      aliases: ['Хэнтий', 'Khentii', '039'],
    },
  ],
  MX: [
    {
      code: 'AGU',
      label: 'Aguascalientes',
      aliases: ['Ags.', 'Aguascalientes', 'AGU'],
    },
    {
      code: 'BCN',
      label: 'Baja California',
      aliases: ['B.C.', 'Baja California', 'BCN'],
    },
    {
      code: 'BCS',
      label: 'Baja California Sur',
      aliases: ['B.C.S.', 'Baja California Sur', 'BCS'],
    },
    {
      code: 'CAM',
      label: 'Campeche',
      aliases: ['Camp.', 'Campeche', 'CAM'],
    },
    {
      code: 'CHP',
      label: 'Chiapas',
      aliases: ['Chis.', 'Chiapas', 'CHP'],
    },
    {
      code: 'CHH',
      label: 'Chihuahua',
      aliases: ['Chih.', 'Chihuahua', 'CHH'],
    },
    {
      code: 'CMX',
      label: 'Ciudad de México',
      aliases: ['CDMX', 'Ciudad de México', 'CMX'],
    },
    {
      code: 'COA',
      label: 'Coahuila de Zaragoza',
      aliases: ['Coah.', 'Coahuila de Zaragoza', 'COA'],
    },
    {
      code: 'COL',
      label: 'Colima',
      aliases: ['Col.', 'Colima', 'COL'],
    },
    {
      code: 'DUR',
      label: 'Durango',
      aliases: ['Dgo.', 'Durango', 'DUR'],
    },
    {
      code: 'MEX',
      label: 'Estado de México',
      aliases: ['Méx.', 'Estado de México', 'MEX'],
    },
    {
      code: 'GUA',
      label: 'Guanajuato',
      aliases: ['Gto.', 'Guanajuato', 'GUA'],
    },
    {
      code: 'GRO',
      label: 'Guerrero',
      aliases: ['Gro.', 'Guerrero', 'GRO'],
    },
    {
      code: 'HID',
      label: 'Hidalgo',
      aliases: ['Hgo.', 'Hidalgo', 'HID'],
    },
    {
      code: 'JAL',
      label: 'Jalisco',
      aliases: ['Jal.', 'Jalisco', 'JAL'],
    },
    {
      code: 'MIC',
      label: 'Michoacán',
      aliases: ['Mich.', 'Michoacán', 'MIC'],
    },
    {
      code: 'MOR',
      label: 'Morelos',
      aliases: ['Mor.', 'Morelos', 'MOR'],
    },
    {
      code: 'NAY',
      label: 'Nayarit',
      aliases: ['Nay.', 'Nayarit', 'NAY'],
    },
    {
      code: 'NLE',
      label: 'Nuevo León',
      aliases: ['N.L.', 'Nuevo León', 'NLE'],
    },
    {
      code: 'OAX',
      label: 'Oaxaca',
      aliases: ['Oax.', 'Oaxaca', 'OAX'],
    },
    {
      code: 'PUE',
      label: 'Puebla',
      aliases: ['Pue.', 'Puebla', 'PUE'],
    },
    {
      code: 'QUE',
      label: 'Querétaro',
      aliases: ['Qro.', 'Querétaro', 'QUE'],
    },
    {
      code: 'ROO',
      label: 'Quintana Roo',
      aliases: ['Q.R.', 'Quintana Roo', 'ROO'],
    },
    {
      code: 'SLP',
      label: 'San Luis Potosí',
      aliases: ['S.L.P.', 'San Luis Potosí', 'SLP'],
    },
    {
      code: 'SIN',
      label: 'Sinaloa',
      aliases: ['Sin.', 'Sinaloa', 'SIN'],
    },
    {
      code: 'SON',
      label: 'Sonora',
      aliases: ['Son.', 'Sonora', 'SON'],
    },
    {
      code: 'TAB',
      label: 'Tabasco',
      aliases: ['Tab.', 'Tabasco', 'TAB'],
    },
    {
      code: 'TAM',
      label: 'Tamaulipas',
      aliases: ['Tamps.', 'Tamaulipas', 'TAM'],
    },
    {
      code: 'TLA',
      label: 'Tlaxcala',
      aliases: ['Tlax.', 'Tlaxcala', 'TLA'],
    },
    {
      code: 'VER',
      label: 'Veracruz',
      aliases: ['Ver.', 'Veracruz', 'VER'],
    },
    {
      code: 'YUC',
      label: 'Yucatán',
      aliases: ['Yuc.', 'Yucatán', 'YUC'],
    },
    {
      code: 'ZAC',
      label: 'Zacatecas',
      aliases: ['Zac.', 'Zacatecas', 'ZAC'],
    },
  ],
  MY: [
    {
      code: '01',
      label: 'Johor',
      aliases: ['Johor', '01'],
    },
    {
      code: '02',
      label: 'Kedah',
      aliases: ['Kedah', '02'],
    },
    {
      code: '03',
      label: 'Kelantan',
      aliases: ['Kelantan', '03'],
    },
    {
      code: '14',
      label: 'Kuala Lumpur',
      aliases: ['Kuala Lumpur', '14'],
    },
    {
      code: '15',
      label: 'Labuan',
      aliases: ['Labuan', '15'],
    },
    {
      code: '04',
      label: 'Melaka',
      aliases: ['Melaka', '04'],
    },
    {
      code: '05',
      label: 'Negeri Sembilan',
      aliases: ['Negeri Sembilan', '05'],
    },
    {
      code: '06',
      label: 'Pahang',
      aliases: ['Pahang', '06'],
    },
    {
      code: '08',
      label: 'Perak',
      aliases: ['Perak', '08'],
    },
    {
      code: '09',
      label: 'Perlis',
      aliases: ['Perlis', '09'],
    },
    {
      code: '07',
      label: 'Pulau Pinang',
      aliases: ['Pulau Pinang', '07'],
    },
    {
      code: '16',
      label: 'Putrajaya',
      aliases: ['Putrajaya', '16'],
    },
    {
      code: '12',
      label: 'Sabah',
      aliases: ['Sabah', '12'],
    },
    {
      code: '13',
      label: 'Sarawak',
      aliases: ['Sarawak', '13'],
    },
    {
      code: '10',
      label: 'Selangor',
      aliases: ['Selangor', '10'],
    },
    {
      code: '11',
      label: 'Terengganu',
      aliases: ['Terengganu', '11'],
    },
  ],
  MZ: [
    {
      code: 'P',
      label: 'Cabo Delgado',
      aliases: ['Cabo Delgado', 'P'],
    },
    {
      code: 'MPM',
      label: 'Cidade de Maputo',
      aliases: ['Cidade de Maputo', 'MPM'],
    },
    {
      code: 'G',
      label: 'Gaza',
      aliases: ['Gaza', 'G'],
    },
    {
      code: 'I',
      label: 'Inhambane',
      aliases: ['Inhambane', 'I'],
    },
    {
      code: 'B',
      label: 'Manica',
      aliases: ['Manica', 'B'],
    },
    {
      code: 'L',
      label: 'Maputo',
      aliases: ['Maputo', 'L'],
    },
    {
      code: 'N',
      label: 'Nampula',
      aliases: ['Nampula', 'N'],
    },
    {
      code: 'A',
      label: 'Niassa',
      aliases: ['Niassa', 'A'],
    },
    {
      code: 'S',
      label: 'Sofala',
      aliases: ['Sofala', 'S'],
    },
    {
      code: 'T',
      label: 'Tete',
      aliases: ['Tete', 'T'],
    },
    {
      code: 'Q',
      label: 'Zambezia',
      aliases: ['Zambezia', 'Q'],
    },
  ],
  NG: [
    {
      code: 'AB',
      label: 'Abia',
      aliases: ['Abia', 'AB'],
    },
    {
      code: 'AD',
      label: 'Adamawa',
      aliases: ['Adamawa', 'AD'],
    },
    {
      code: 'AK',
      label: 'Akwa Ibom',
      aliases: ['Akwa Ibom', 'AK'],
    },
    {
      code: 'AN',
      label: 'Anambra',
      aliases: ['Anambra', 'AN'],
    },
    {
      code: 'BA',
      label: 'Bauchi',
      aliases: ['Bauchi', 'BA'],
    },
    {
      code: 'BY',
      label: 'Bayelsa',
      aliases: ['Bayelsa', 'BY'],
    },
    {
      code: 'BE',
      label: 'Benue',
      aliases: ['Benue', 'BE'],
    },
    {
      code: 'BO',
      label: 'Borno',
      aliases: ['Borno', 'BO'],
    },
    {
      code: 'CR',
      label: 'Cross River',
      aliases: ['Cross River', 'CR'],
    },
    {
      code: 'DE',
      label: 'Delta',
      aliases: ['Delta', 'DE'],
    },
    {
      code: 'EB',
      label: 'Ebonyi',
      aliases: ['Ebonyi', 'EB'],
    },
    {
      code: 'ED',
      label: 'Edo',
      aliases: ['Edo', 'ED'],
    },
    {
      code: 'EK',
      label: 'Ekiti',
      aliases: ['Ekiti', 'EK'],
    },
    {
      code: 'EN',
      label: 'Enugu',
      aliases: ['Enugu', 'EN'],
    },
    {
      code: 'FC',
      label: 'Federal Capital Territory',
      aliases: ['Federal Capital Territory', 'FC'],
    },
    {
      code: 'GO',
      label: 'Gombe',
      aliases: ['Gombe', 'GO'],
    },
    {
      code: 'IM',
      label: 'Imo',
      aliases: ['Imo', 'IM'],
    },
    {
      code: 'JI',
      label: 'Jigawa',
      aliases: ['Jigawa', 'JI'],
    },
    {
      code: 'KD',
      label: 'Kaduna',
      aliases: ['Kaduna', 'KD'],
    },
    {
      code: 'KN',
      label: 'Kano',
      aliases: ['Kano', 'KN'],
    },
    {
      code: 'KT',
      label: 'Katsina',
      aliases: ['Katsina', 'KT'],
    },
    {
      code: 'KE',
      label: 'Kebbi',
      aliases: ['Kebbi', 'KE'],
    },
    {
      code: 'KO',
      label: 'Kogi',
      aliases: ['Kogi', 'KO'],
    },
    {
      code: 'KW',
      label: 'Kwara',
      aliases: ['Kwara', 'KW'],
    },
    {
      code: 'LA',
      label: 'Lagos',
      aliases: ['Lagos', 'LA'],
    },
    {
      code: 'NA',
      label: 'Nasarawa',
      aliases: ['Nasarawa', 'NA'],
    },
    {
      code: 'NI',
      label: 'Niger',
      aliases: ['Niger', 'NI'],
    },
    {
      code: 'OG',
      label: 'Ogun State',
      aliases: ['Ogun State', 'OG'],
    },
    {
      code: 'ON',
      label: 'Ondo',
      aliases: ['Ondo', 'ON'],
    },
    {
      code: 'OS',
      label: 'Osun',
      aliases: ['Osun', 'OS'],
    },
    {
      code: 'OY',
      label: 'Oyo',
      aliases: ['Oyo', 'OY'],
    },
    {
      code: 'PL',
      label: 'Plateau',
      aliases: ['Plateau', 'PL'],
    },
    {
      code: 'RI',
      label: 'Rivers',
      aliases: ['Rivers', 'RI'],
    },
    {
      code: 'SO',
      label: 'Sokoto',
      aliases: ['Sokoto', 'SO'],
    },
    {
      code: 'TA',
      label: 'Taraba',
      aliases: ['Taraba', 'TA'],
    },
    {
      code: 'YO',
      label: 'Yobe',
      aliases: ['Yobe', 'YO'],
    },
    {
      code: 'ZA',
      label: 'Zamfara',
      aliases: ['Zamfara', 'ZA'],
    },
  ],
  NI: [
    {
      code: 'BO',
      label: 'Boaco',
      aliases: ['Boaco', 'BO'],
    },
    {
      code: 'CA',
      label: 'Carazo',
      aliases: ['Carazo', 'CA'],
    },
    {
      code: 'CI',
      label: 'Chinandega',
      aliases: ['Chinandega', 'CI'],
    },
    {
      code: 'CO',
      label: 'Chontales',
      aliases: ['Chontales', 'CO'],
    },
    {
      code: 'ES',
      label: 'Estelí',
      aliases: ['Estelí', 'ES'],
    },
    {
      code: 'GR',
      label: 'Granada',
      aliases: ['Granada', 'GR'],
    },
    {
      code: 'JI',
      label: 'Jinotega',
      aliases: ['Jinotega', 'JI'],
    },
    {
      code: 'LE',
      label: 'León',
      aliases: ['León', 'LE'],
    },
    {
      code: 'MD',
      label: 'Madriz',
      aliases: ['Madriz', 'MD'],
    },
    {
      code: 'MN',
      label: 'Managua',
      aliases: ['Managua', 'MN'],
    },
    {
      code: 'MS',
      label: 'Masaya',
      aliases: ['Masaya', 'MS'],
    },
    {
      code: 'MT',
      label: 'Matagalpa',
      aliases: ['Matagalpa', 'MT'],
    },
    {
      code: 'NS',
      label: 'Nueva Segovia',
      aliases: ['Nueva Segovia', 'NS'],
    },
    {
      code: 'AN',
      label: 'Región Autónoma de la Costa Caribe Norte',
      aliases: ['Región Autónoma de la Costa Caribe Norte', 'AN'],
    },
    {
      code: 'AS',
      label: 'Región Autónoma de la Costa Caribe Sur',
      aliases: ['Región Autónoma de la Costa Caribe Sur', 'AS'],
    },
    {
      code: 'SJ',
      label: 'Río San Juan',
      aliases: ['Río San Juan', 'SJ'],
    },
    {
      code: 'RI',
      label: 'Rivas',
      aliases: ['Rivas', 'RI'],
    },
  ],
  NR: [
    {
      code: '01',
      label: 'Aiwo District',
      aliases: ['Aiwo District', '01'],
    },
    {
      code: '02',
      label: 'Anabar District',
      aliases: ['Anabar District', '02'],
    },
    {
      code: '03',
      label: 'Anetan District',
      aliases: ['Anetan District', '03'],
    },
    {
      code: '04',
      label: 'Anibare District',
      aliases: ['Anibare District', '04'],
    },
    {
      code: '05',
      label: 'Baiti District',
      aliases: ['Baiti District', '05'],
    },
    {
      code: '06',
      label: 'Boe District',
      aliases: ['Boe District', '06'],
    },
    {
      code: '07',
      label: 'Buada District',
      aliases: ['Buada District', '07'],
    },
    {
      code: '08',
      label: 'Denigomodu District',
      aliases: ['Denigomodu District', '08'],
    },
    {
      code: '09',
      label: 'Ewa District',
      aliases: ['Ewa District', '09'],
    },
    {
      code: '10',
      label: 'Ijuw District',
      aliases: ['Ijuw District', '10'],
    },
    {
      code: '11',
      label: 'Meneng District',
      aliases: ['Meneng District', '11'],
    },
    {
      code: '12',
      label: 'Nibok District',
      aliases: ['Nibok District', '12'],
    },
    {
      code: '13',
      label: 'Uaboe District',
      aliases: ['Uaboe District', '13'],
    },
    {
      code: '14',
      label: 'Yaren District',
      aliases: ['Yaren District', '14'],
    },
  ],
  PA: [
    {
      code: '1',
      label: 'Bocas del Toro',
      aliases: ['Bocas del Toro', '1'],
    },
    {
      code: '4',
      label: 'Chiriquí',
      aliases: ['Chiriquí', '4'],
    },
    {
      code: '2',
      label: 'Coclé',
      aliases: ['Coclé', '2'],
    },
    {
      code: '3',
      label: 'Colón',
      aliases: ['Colón', '3'],
    },
    {
      code: '5',
      label: 'Darién',
      aliases: ['Darién', '5'],
    },
    {
      code: 'EM',
      label: 'Emberá',
      aliases: ['Emberá', 'EM'],
    },
    {
      code: 'KY',
      label: 'Guna Yala',
      aliases: ['Guna Yala', 'KY'],
    },
    {
      code: '6',
      label: 'Herrera',
      aliases: ['Herrera', '6'],
    },
    {
      code: '7',
      label: 'Los Santos',
      aliases: ['Los Santos', '7'],
    },
    {
      code: 'NT',
      label: 'Naso Tjër Di',
      aliases: ['Naso Tjër Di', 'NT'],
    },
    {
      code: 'NB',
      label: 'Ngäbe-Buglé',
      aliases: ['Ngäbe-Buglé', 'NB'],
    },
    {
      code: '8',
      label: 'Panamá',
      aliases: ['Panamá', '8'],
    },
    {
      code: '10',
      label: 'Panamá Oeste',
      aliases: ['Panamá Oeste', '10'],
    },
    {
      code: '9',
      label: 'Veraguas',
      aliases: ['Veraguas', '9'],
    },
  ],
  PE: [
    {
      code: 'AMA',
      label: 'Amazonas',
      aliases: ['Amazonas', 'AMA'],
    },
    {
      code: 'ANC',
      label: 'Áncash',
      aliases: ['Áncash', 'ANC'],
    },
    {
      code: 'APU',
      label: 'Apurímac',
      aliases: ['Apurímac', 'APU'],
    },
    {
      code: 'ARE',
      label: 'Arequipa',
      aliases: ['Arequipa', 'ARE'],
    },
    {
      code: 'AYA',
      label: 'Ayacucho',
      aliases: ['Ayacucho', 'AYA'],
    },
    {
      code: 'CAJ',
      label: 'Cajamarca',
      aliases: ['Cajamarca', 'CAJ'],
    },
    {
      code: 'CAL',
      label: 'Callao',
      aliases: ['Callao', 'CAL'],
    },
    {
      code: 'CUS',
      label: 'Cuzco',
      aliases: ['Cuzco', 'CUS'],
    },
    {
      code: 'LIM',
      label: 'Gobierno Regional de Lima',
      aliases: ['Gobierno Regional de Lima', 'LIM'],
    },
    {
      code: 'HUV',
      label: 'Huancavelica',
      aliases: ['Huancavelica', 'HUV'],
    },
    {
      code: 'HUC',
      label: 'Huánuco',
      aliases: ['Huánuco', 'HUC'],
    },
    {
      code: 'ICA',
      label: 'Ica',
      aliases: ['Ica', 'ICA'],
    },
    {
      code: 'JUN',
      label: 'Junín',
      aliases: ['Junín', 'JUN'],
    },
    {
      code: 'LAL',
      label: 'La Libertad',
      aliases: ['La Libertad', 'LAL'],
    },
    {
      code: 'LAM',
      label: 'Lambayeque',
      aliases: ['Lambayeque', 'LAM'],
    },
    {
      code: 'LOR',
      label: 'Loreto',
      aliases: ['Loreto', 'LOR'],
    },
    {
      code: 'MDD',
      label: 'Madre de Dios',
      aliases: ['Madre de Dios', 'MDD'],
    },
    {
      code: 'MOQ',
      label: 'Moquegua',
      aliases: ['Moquegua', 'MOQ'],
    },
    {
      code: 'LMA',
      label: 'Municipalidad Metropolitana de Lima',
      aliases: ['Municipalidad Metropolitana de Lima', 'LMA'],
    },
    {
      code: 'PAS',
      label: 'Pasco',
      aliases: ['Pasco', 'PAS'],
    },
    {
      code: 'PIU',
      label: 'Piura',
      aliases: ['Piura', 'PIU'],
    },
    {
      code: 'PUN',
      label: 'Puno',
      aliases: ['Puno', 'PUN'],
    },
    {
      code: 'SAM',
      label: 'San Martín',
      aliases: ['San Martín', 'SAM'],
    },
    {
      code: 'TAC',
      label: 'Tacna',
      aliases: ['Tacna', 'TAC'],
    },
    {
      code: 'TUM',
      label: 'Tumbes',
      aliases: ['Tumbes', 'TUM'],
    },
    {
      code: 'UCA',
      label: 'Ucayali',
      aliases: ['Ucayali', 'UCA'],
    },
  ],
  PG: [
    {
      code: 'NSB',
      label: 'Bougainville',
      aliases: ['Bougainville', 'NSB'],
    },
    {
      code: 'CPM',
      label: 'Central Provins',
      aliases: ['Central Provins', 'CPM'],
    },
    {
      code: 'EPW',
      label: 'Enga Provins',
      aliases: ['Enga Provins', 'EPW'],
    },
    {
      code: 'GPK',
      label: 'Gulf Provins',
      aliases: ['Gulf Provins', 'GPK'],
    },
    {
      code: 'HLA',
      label: 'Hela Provins',
      aliases: ['Hela Provins', 'HLA'],
    },
    {
      code: 'EBR',
      label: 'Is Niu Briten Provins',
      aliases: ['Is Niu Briten Provins', 'EBR'],
    },
    {
      code: 'ESW',
      label: 'Is Sepik Provins',
      aliases: ['Is Sepik Provins', 'ESW'],
    },
    {
      code: 'EHG',
      label: 'Isten Hailans Provins',
      aliases: ['Isten Hailans Provins', 'EHG'],
    },
    {
      code: 'JWK',
      label: 'Jiwaka Provins',
      aliases: ['Jiwaka Provins', 'JWK'],
    },
    {
      code: 'MPM',
      label: 'Madang Provins',
      aliases: ['Madang Provins', 'MPM'],
    },
    {
      code: 'MRL',
      label: 'Manus Provins',
      aliases: ['Manus Provins', 'MRL'],
    },
    {
      code: 'MBA',
      label: 'Milen Be Provins',
      aliases: ['Milen Be Provins', 'MBA'],
    },
    {
      code: 'MPL',
      label: 'Morobe Provins',
      aliases: ['Morobe Provins', 'MPL'],
    },
    {
      code: 'NCD',
      label: 'Nesenel Kapitol Distrik',
      aliases: ['Nesenel Kapitol Distrik', 'NCD'],
    },
    {
      code: 'NIK',
      label: 'Niu Ailan Provins',
      aliases: ['Niu Ailan Provins', 'NIK'],
    },
    {
      code: 'NPP',
      label: 'Oro Provins',
      aliases: ['Oro Provins', 'NPP'],
    },
    {
      code: 'SAN',
      label: 'Sandaun Provins',
      aliases: ['Sandaun Provins', 'SAN'],
    },
    {
      code: 'SHM',
      label: 'Sauten Hailans Provins',
      aliases: ['Sauten Hailans Provins', 'SHM'],
    },
    {
      code: 'CPK',
      label: 'Simbu Provins',
      aliases: ['Simbu Provins', 'CPK'],
    },
    {
      code: 'WBK',
      label: 'Wes Niu Briten Provins',
      aliases: ['Wes Niu Briten Provins', 'WBK'],
    },
    {
      code: 'WHM',
      label: 'Western Hailans Provins',
      aliases: ['Western Hailans Provins', 'WHM'],
    },
    {
      code: 'WPD',
      label: 'Western Provins',
      aliases: ['Western Provins', 'WPD'],
    },
  ],
  PH: [
    {
      code: 'ABR',
      label: 'Abra',
      aliases: ['Abra', 'ABR'],
    },
    {
      code: 'AGN',
      label: 'Agusan del Norte',
      aliases: ['Agusan del Norte', 'AGN'],
    },
    {
      code: 'AGS',
      label: 'Agusan del Sur',
      aliases: ['Agusan del Sur', 'AGS'],
    },
    {
      code: 'AKL',
      label: 'Aklan',
      aliases: ['Aklan', 'AKL'],
    },
    {
      code: 'ALB',
      label: 'Albay',
      aliases: ['Albay', 'ALB'],
    },
    {
      code: 'ANT',
      label: 'Antique',
      aliases: ['Antique', 'ANT'],
    },
    {
      code: 'APA',
      label: 'Apayao',
      aliases: ['Apayao', 'APA'],
    },
    {
      code: 'AUR',
      label: 'Aurora',
      aliases: ['Aurora', 'AUR'],
    },
    {
      code: 'BAS',
      label: 'Basilan',
      aliases: ['Basilan', 'BAS'],
    },
    {
      code: 'BAN',
      label: 'Bataan',
      aliases: ['Bataan', 'BAN'],
    },
    {
      code: 'BTN',
      label: 'Batanes',
      aliases: ['Batanes', 'BTN'],
    },
    {
      code: 'BTG',
      label: 'Batangas',
      aliases: ['Batangas', 'BTG'],
    },
    {
      code: 'BEN',
      label: 'Benguet',
      aliases: ['Benguet', 'BEN'],
    },
    {
      code: 'BIL',
      label: 'Biliran',
      aliases: ['Biliran', 'BIL'],
    },
    {
      code: 'BOH',
      label: 'Bohol',
      aliases: ['Bohol', 'BOH'],
    },
    {
      code: 'BUK',
      label: 'Bukidnon',
      aliases: ['Bukidnon', 'BUK'],
    },
    {
      code: 'BUL',
      label: 'Bulacan',
      aliases: ['Bulacan', 'BUL'],
    },
    {
      code: 'CAG',
      label: 'Cagayan',
      aliases: ['Cagayan', 'CAG'],
    },
    {
      code: 'CAN',
      label: 'Camarines Norte',
      aliases: ['Camarines Norte', 'CAN'],
    },
    {
      code: 'CAS',
      label: 'Camarines Sur',
      aliases: ['Camarines Sur', 'CAS'],
    },
    {
      code: 'CAM',
      label: 'Camiguin',
      aliases: ['Camiguin', 'CAM'],
    },
    {
      code: 'CAP',
      label: 'Capiz',
      aliases: ['Capiz', 'CAP'],
    },
    {
      code: 'CAT',
      label: 'Catanduanes',
      aliases: ['Catanduanes', 'CAT'],
    },
    {
      code: 'CAV',
      label: 'Cavite',
      aliases: ['Cavite', 'CAV'],
    },
    {
      code: 'CEB',
      label: 'Cebu',
      aliases: ['Cebu', 'CEB'],
    },
    {
      code: 'COM',
      label: 'Compostela Valley',
      aliases: ['Compostela Valley', 'COM'],
    },
    {
      code: 'NCO',
      label: 'Cotabato',
      aliases: ['Cotabato', 'NCO'],
    },
    {
      code: 'DAV',
      label: 'Davao del Norte',
      aliases: ['Davao del Norte', 'DAV'],
    },
    {
      code: 'DAS',
      label: 'Davao del Sur',
      aliases: ['Davao del Sur', 'DAS'],
    },
    {
      code: 'DVO',
      label: 'Davao Occidental',
      aliases: ['Davao Occidental', 'DVO'],
    },
    {
      code: 'DAO',
      label: 'Davao Oriental',
      aliases: ['Davao Oriental', 'DAO'],
    },
    {
      code: 'DIN',
      label: 'Dinagat Islands',
      aliases: ['Dinagat Islands', 'DIN'],
    },
    {
      code: 'EAS',
      label: 'Eastern Samar',
      aliases: ['Eastern Samar', 'EAS'],
    },
    {
      code: 'GUI',
      label: 'Guimaras',
      aliases: ['Guimaras', 'GUI'],
    },
    {
      code: 'IFU',
      label: 'Ifugao',
      aliases: ['Ifugao', 'IFU'],
    },
    {
      code: 'ILN',
      label: 'Ilocos Norte',
      aliases: ['Ilocos Norte', 'ILN'],
    },
    {
      code: 'ILS',
      label: 'Ilocos Sur',
      aliases: ['Ilocos Sur', 'ILS'],
    },
    {
      code: 'ILI',
      label: 'Iloilo',
      aliases: ['Iloilo', 'ILI'],
    },
    {
      code: 'ISA',
      label: 'Isabela',
      aliases: ['Isabela', 'ISA'],
    },
    {
      code: 'KAL',
      label: 'Kalinga',
      aliases: ['Kalinga', 'KAL'],
    },
    {
      code: 'LUN',
      label: 'La Union',
      aliases: ['La Union', 'LUN'],
    },
    {
      code: 'LAG',
      label: 'Laguna',
      aliases: ['Laguna', 'LAG'],
    },
    {
      code: 'LAN',
      label: 'Lanao del Norte',
      aliases: ['Lanao del Norte', 'LAN'],
    },
    {
      code: 'LAS',
      label: 'Lanao del Sur',
      aliases: ['Lanao del Sur', 'LAS'],
    },
    {
      code: 'LEY',
      label: 'Leyte',
      aliases: ['Leyte', 'LEY'],
    },
    {
      code: 'MAG',
      label: 'Maguindanao',
      aliases: ['Maguindanao', 'MAG'],
    },
    {
      code: 'MAD',
      label: 'Marinduque',
      aliases: ['Marinduque', 'MAD'],
    },
    {
      code: 'MAS',
      label: 'Masbate',
      aliases: ['Masbate', 'MAS'],
    },
    {
      code: '00',
      label: 'Metro Manila',
      aliases: ['Metro Manila', '00'],
    },
    {
      code: 'MDC',
      label: 'Mindoro Occidental',
      aliases: ['Mindoro Occidental', 'MDC'],
    },
    {
      code: 'MDR',
      label: 'Mindoro Oriental',
      aliases: ['Mindoro Oriental', 'MDR'],
    },
    {
      code: 'MSC',
      label: 'Misamis Occidental',
      aliases: ['Misamis Occidental', 'MSC'],
    },
    {
      code: 'MSR',
      label: 'Misamis Oriental',
      aliases: ['Misamis Oriental', 'MSR'],
    },
    {
      code: 'MOU',
      label: 'Mountain Province',
      aliases: ['Mountain Province', 'MOU'],
    },
    {
      code: 'NEC',
      label: 'Negros Occidental',
      aliases: ['Negros Occidental', 'NEC'],
    },
    {
      code: 'NER',
      label: 'Negros Oriental',
      aliases: ['Negros Oriental', 'NER'],
    },
    {
      code: 'NSA',
      label: 'Northern Samar',
      aliases: ['Northern Samar', 'NSA'],
    },
    {
      code: 'NUE',
      label: 'Nueva Ecija',
      aliases: ['Nueva Ecija', 'NUE'],
    },
    {
      code: 'NUV',
      label: 'Nueva Vizcaya',
      aliases: ['Nueva Vizcaya', 'NUV'],
    },
    {
      code: 'PLW',
      label: 'Palawan',
      aliases: ['Palawan', 'PLW'],
    },
    {
      code: 'PAM',
      label: 'Pampanga',
      aliases: ['Pampanga', 'PAM'],
    },
    {
      code: 'PAN',
      label: 'Pangasinan',
      aliases: ['Pangasinan', 'PAN'],
    },
    {
      code: 'QUE',
      label: 'Quezon Province',
      aliases: ['Quezon Province', 'QUE'],
    },
    {
      code: 'QUI',
      label: 'Quirino',
      aliases: ['Quirino', 'QUI'],
    },
    {
      code: 'RIZ',
      label: 'Rizal',
      aliases: ['Rizal', 'RIZ'],
    },
    {
      code: 'ROM',
      label: 'Romblon',
      aliases: ['Romblon', 'ROM'],
    },
    {
      code: 'WSA',
      label: 'Samar',
      aliases: ['Samar', 'WSA'],
    },
    {
      code: 'SAR',
      label: 'Sarangani',
      aliases: ['Sarangani', 'SAR'],
    },
    {
      code: 'SIG',
      label: 'Siquijor',
      aliases: ['Siquijor', 'SIG'],
    },
    {
      code: 'SOR',
      label: 'Sorsogon',
      aliases: ['Sorsogon', 'SOR'],
    },
    {
      code: 'SCO',
      label: 'South Cotabato',
      aliases: ['South Cotabato', 'SCO'],
    },
    {
      code: 'SLE',
      label: 'Southern Leyte',
      aliases: ['Southern Leyte', 'SLE'],
    },
    {
      code: 'SUK',
      label: 'Sultan Kudarat',
      aliases: ['Sultan Kudarat', 'SUK'],
    },
    {
      code: 'SLU',
      label: 'Sulu',
      aliases: ['Sulu', 'SLU'],
    },
    {
      code: 'SUN',
      label: 'Surigao del Norte',
      aliases: ['Surigao del Norte', 'SUN'],
    },
    {
      code: 'SUR',
      label: 'Surigao del Sur',
      aliases: ['Surigao del Sur', 'SUR'],
    },
    {
      code: 'TAR',
      label: 'Tarlac',
      aliases: ['Tarlac', 'TAR'],
    },
    {
      code: 'TAW',
      label: 'Tawi-Tawi',
      aliases: ['Tawi-Tawi', 'TAW'],
    },
    {
      code: 'ZMB',
      label: 'Zambales',
      aliases: ['Zambales', 'ZMB'],
    },
    {
      code: 'ZAN',
      label: 'Zamboanga del Norte',
      aliases: ['Zamboanga del Norte', 'ZAN'],
    },
    {
      code: 'ZAS',
      label: 'Zamboanga del Sur',
      aliases: ['Zamboanga del Sur', 'ZAS'],
    },
    {
      code: 'ZSI',
      label: 'Zamboanga Sibuguey',
      aliases: ['Zamboanga Sibuguey', 'ZSI'],
    },
  ],
  PW: [
    {
      code: '002',
      label: 'Aimeliik',
      aliases: ['Aimeliik', '002'],
    },
    {
      code: '004',
      label: 'Airai',
      aliases: ['Airai', '004'],
    },
    {
      code: '010',
      label: 'Angaur',
      aliases: ['Angaur', '010'],
    },
    {
      code: '050',
      label: 'Hatohobei',
      aliases: ['Hatohobei', '050'],
    },
    {
      code: '100',
      label: 'Kayangel',
      aliases: ['Kayangel', '100'],
    },
    {
      code: '150',
      label: 'Koror',
      aliases: ['Koror', '150'],
    },
    {
      code: '212',
      label: 'Melekeok',
      aliases: ['Melekeok', '212'],
    },
    {
      code: '214',
      label: 'Ngaraard',
      aliases: ['Ngaraard', '214'],
    },
    {
      code: '218',
      label: 'Ngarchelong',
      aliases: ['Ngarchelong', '218'],
    },
    {
      code: '222',
      label: 'Ngardmau',
      aliases: ['Ngardmau', '222'],
    },
    {
      code: '227',
      label: 'Ngaremlengui',
      aliases: ['Ngaremlengui', '227'],
    },
    {
      code: '224',
      label: 'Ngatpang',
      aliases: ['Ngatpang', '224'],
    },
    {
      code: '226',
      label: 'Ngchesar',
      aliases: ['Ngchesar', '226'],
    },
    {
      code: '228',
      label: 'Ngiwal',
      aliases: ['Ngiwal', '228'],
    },
    {
      code: '350',
      label: 'Peleliu',
      aliases: ['Peleliu', '350'],
    },
    {
      code: '370',
      label: 'Sonsorol',
      aliases: ['Sonsorol', '370'],
    },
  ],
  RO: [
    {
      code: 'AB',
      label: 'Alba',
      aliases: ['Alba', 'AB'],
    },
    {
      code: 'AR',
      label: 'Arad',
      aliases: ['Arad', 'AR'],
    },
    {
      code: 'AG',
      label: 'Argeș',
      aliases: ['Argeș', 'AG'],
    },
    {
      code: 'BC',
      label: 'Bacău',
      aliases: ['Bacău', 'BC'],
    },
    {
      code: 'BH',
      label: 'Bihor',
      aliases: ['Bihor', 'BH'],
    },
    {
      code: 'BN',
      label: 'Bistrița-Năsăud',
      aliases: ['Bistrița-Năsăud', 'BN'],
    },
    {
      code: 'BT',
      label: 'Botoșani',
      aliases: ['Botoșani', 'BT'],
    },
    {
      code: 'BV',
      label: 'Brașov',
      aliases: ['Brașov', 'BV'],
    },
    {
      code: 'BR',
      label: 'Brăila',
      aliases: ['Brăila', 'BR'],
    },
    {
      code: 'B',
      label: 'București',
      aliases: ['București', 'B'],
    },
    {
      code: 'BZ',
      label: 'Buzău',
      aliases: ['Buzău', 'BZ'],
    },
    {
      code: 'CS',
      label: 'Caraș-Severin',
      aliases: ['Caraș-Severin', 'CS'],
    },
    {
      code: 'CL',
      label: 'Călărași',
      aliases: ['Călărași', 'CL'],
    },
    {
      code: 'CJ',
      label: 'Cluj',
      aliases: ['Cluj', 'CJ'],
    },
    {
      code: 'CT',
      label: 'Constanța',
      aliases: ['Constanța', 'CT'],
    },
    {
      code: 'CV',
      label: 'Covasna',
      aliases: ['Covasna', 'CV'],
    },
    {
      code: 'DB',
      label: 'Dâmbovița',
      aliases: ['Dâmbovița', 'DB'],
    },
    {
      code: 'DJ',
      label: 'Dolj',
      aliases: ['Dolj', 'DJ'],
    },
    {
      code: 'GL',
      label: 'Galați',
      aliases: ['Galați', 'GL'],
    },
    {
      code: 'GR',
      label: 'Giurgiu',
      aliases: ['Giurgiu', 'GR'],
    },
    {
      code: 'GJ',
      label: 'Gorj',
      aliases: ['Gorj', 'GJ'],
    },
    {
      code: 'HR',
      label: 'Harghita',
      aliases: ['Harghita', 'HR'],
    },
    {
      code: 'HD',
      label: 'Hunedoara',
      aliases: ['Hunedoara', 'HD'],
    },
    {
      code: 'IL',
      label: 'Ialomița',
      aliases: ['Ialomița', 'IL'],
    },
    {
      code: 'IS',
      label: 'Iași',
      aliases: ['Iași', 'IS'],
    },
    {
      code: 'IF',
      label: 'Ilfov',
      aliases: ['Ilfov', 'IF'],
    },
    {
      code: 'MM',
      label: 'Maramureș',
      aliases: ['Maramureș', 'MM'],
    },
    {
      code: 'MH',
      label: 'Mehedinți',
      aliases: ['Mehedinți', 'MH'],
    },
    {
      code: 'MS',
      label: 'Mureș',
      aliases: ['Mureș', 'MS'],
    },
    {
      code: 'NT',
      label: 'Neamț',
      aliases: ['Neamț', 'NT'],
    },
    {
      code: 'OT',
      label: 'Olt',
      aliases: ['Olt', 'OT'],
    },
    {
      code: 'PH',
      label: 'Prahova',
      aliases: ['Prahova', 'PH'],
    },
    {
      code: 'SM',
      label: 'Satu Mare',
      aliases: ['Satu Mare', 'SM'],
    },
    {
      code: 'SJ',
      label: 'Sălaj',
      aliases: ['Sălaj', 'SJ'],
    },
    {
      code: 'SB',
      label: 'Sibiu',
      aliases: ['Sibiu', 'SB'],
    },
    {
      code: 'SV',
      label: 'Suceava',
      aliases: ['Suceava', 'SV'],
    },
    {
      code: 'TR',
      label: 'Teleorman',
      aliases: ['Teleorman', 'TR'],
    },
    {
      code: 'TM',
      label: 'Timiș',
      aliases: ['Timiș', 'TM'],
    },
    {
      code: 'TL',
      label: 'Tulcea',
      aliases: ['Tulcea', 'TL'],
    },
    {
      code: 'VS',
      label: 'Vaslui',
      aliases: ['Vaslui', 'VS'],
    },
    {
      code: 'VL',
      label: 'Vâlcea',
      aliases: ['Vâlcea', 'VL'],
    },
    {
      code: 'VN',
      label: 'Vrancea',
      aliases: ['Vrancea', 'VN'],
    },
  ],
  RU: [
    {
      code: 'ALT',
      label: 'Altayskiy kray',
      aliases: ['Алтайский край', 'Altayskiy kray', 'ALT'],
    },
    {
      code: 'AMU',
      label: "Amurskaya oblast'",
      aliases: ['Амурская область', "Amurskaya oblast'", 'AMU'],
    },
    {
      code: 'ARK',
      label: "Arkhangelskaya oblast'",
      aliases: ['Архангельская область', "Arkhangelskaya oblast'", 'ARK'],
    },
    {
      code: 'AST',
      label: "Astrakhanskaya oblast'",
      aliases: ['Астраханская область', "Astrakhanskaya oblast'", 'AST'],
    },
    {
      code: 'BEL',
      label: "Belgorodskaya oblast'",
      aliases: ['Белгородская область', "Belgorodskaya oblast'", 'BEL'],
    },
    {
      code: 'BRY',
      label: "Bryanskaya oblast'",
      aliases: ['Брянская область', "Bryanskaya oblast'", 'BRY'],
    },
    {
      code: 'VLA',
      label: "Vladimirskaya oblast'",
      aliases: ['Владимирская область', "Vladimirskaya oblast'", 'VLA'],
    },
    {
      code: 'VGG',
      label: "Volgogradskaya oblast'",
      aliases: ['Волгоградская область', "Volgogradskaya oblast'", 'VGG'],
    },
    {
      code: 'VLG',
      label: "Vologodskaya oblast'",
      aliases: ['Вологодская область', "Vologodskaya oblast'", 'VLG'],
    },
    {
      code: 'VOR',
      label: "Voronezhskaya oblast'",
      aliases: ['Воронежская область', "Voronezhskaya oblast'", 'VOR'],
    },
    {
      code: 'YEV',
      label: "Evreyskaya avtonomnaya oblast'",
      aliases: ['Еврейская автономная область', "Evreyskaya avtonomnaya oblast'", 'YEV'],
    },
    {
      code: 'ZAB',
      label: 'Zabaykalskiy kray',
      aliases: ['Забайкальский край', 'Zabaykalskiy kray', 'ZAB'],
    },
    {
      code: 'IVA',
      label: "Ivanovskaya oblast'",
      aliases: ['Ивановская область', "Ivanovskaya oblast'", 'IVA'],
    },
    {
      code: 'IRK',
      label: "Irkutskaya oblast'",
      aliases: ['Иркутская область', "Irkutskaya oblast'", 'IRK'],
    },
    {
      code: 'KB',
      label: 'Kabardino-Balkarskaya Republits',
      aliases: [
        'Кабардино-Балкарская Республика',
        'Kabardino-Balkarskaya Republits',
        'KB',
      ],
    },
    {
      code: 'KGD',
      label: "Kaliningradskaya oblast'",
      aliases: ['Калининградская область', "Kaliningradskaya oblast'", 'KGD'],
    },
    {
      code: 'KLU',
      label: "Kaluzhskaya oblast'",
      aliases: ['Калужская область', "Kaluzhskaya oblast'", 'KLU'],
    },
    {
      code: 'KAM',
      label: 'Kamchatskiy kray',
      aliases: ['Камчатский край', 'Kamchatskiy kray', 'KAM'],
    },
    {
      code: 'KC',
      label: 'Karachaevo-Cherkesskaya Republits',
      aliases: [
        'Карачаево-Черкесская Республика',
        'Karachaevo-Cherkesskaya Republits',
        'KC',
      ],
    },
    {
      code: 'KEM',
      label: "Kemerovskaya oblast'",
      aliases: ['Кемеровская область', "Kemerovskaya oblast'", 'KEM'],
    },
    {
      code: 'KIR',
      label: "Kirovskaya oblast'",
      aliases: ['Кировская область', "Kirovskaya oblast'", 'KIR'],
    },
    {
      code: 'KOS',
      label: "Kostromskaya oblast'",
      aliases: ['Костромская область', "Kostromskaya oblast'", 'KOS'],
    },
    {
      code: 'KDA',
      label: 'Krasnodarskiy kray',
      aliases: ['Краснодарский край', 'Krasnodarskiy kray', 'KDA'],
    },
    {
      code: 'KYA',
      label: 'Krasnoyarskiy kray',
      aliases: ['Красноярский край', 'Krasnoyarskiy kray', 'KYA'],
    },
    {
      code: 'KGN',
      label: "Kurganskaya oblast'",
      aliases: ['Курганская область', "Kurganskaya oblast'", 'KGN'],
    },
    {
      code: 'KRS',
      label: "Kurskaya oblast'",
      aliases: ['Курская область', "Kurskaya oblast'", 'KRS'],
    },
    {
      code: 'LEN',
      label: "Leningradskaya oblast'",
      aliases: ['Ленинградская область', "Leningradskaya oblast'", 'LEN'],
    },
    {
      code: 'LIP',
      label: "Lipetskaya oblast'",
      aliases: ['Липецкая область', "Lipetskaya oblast'", 'LIP'],
    },
    {
      code: 'MAG',
      label: "Magadanskaya oblast'",
      aliases: ['Магаданская область', "Magadanskaya oblast'", 'MAG'],
    },
    {
      code: 'MOW',
      label: 'Moskva',
      aliases: ['Москва', 'Moskva', 'MOW'],
    },
    {
      code: 'MOS',
      label: "Moskovskaya oblast'",
      aliases: ['Московская область', "Moskovskaya oblast'", 'MOS'],
    },
    {
      code: 'MUR',
      label: "Murmanskaya oblast'",
      aliases: ['Мурманская область', "Murmanskaya oblast'", 'MUR'],
    },
    {
      code: 'NEN',
      label: 'Nenetskiy',
      aliases: ['Ненецкий автономный округ', 'Nenetskiy', 'NEN'],
    },
    {
      code: 'NIZ',
      label: "Nizhegorodskaya oblast'",
      aliases: ['Нижегородская область', "Nizhegorodskaya oblast'", 'NIZ'],
    },
    {
      code: 'NGR',
      label: "Novgorodskaya oblast'",
      aliases: ['Новгородская область', "Novgorodskaya oblast'", 'NGR'],
    },
    {
      code: 'NVS',
      label: "Novosibirskaya oblast'",
      aliases: ['Новосибирская область', "Novosibirskaya oblast'", 'NVS'],
    },
    {
      code: 'OMS',
      label: "Omskaya oblast'",
      aliases: ['Омская область', "Omskaya oblast'", 'OMS'],
    },
    {
      code: 'ORE',
      label: "Orenburgskaya oblast'",
      aliases: ['Оренбургская область', "Orenburgskaya oblast'", 'ORE'],
    },
    {
      code: 'ORL',
      label: "Orlovskaya oblast'",
      aliases: ['Орловская область', "Orlovskaya oblast'", 'ORL'],
    },
    {
      code: 'PNZ',
      label: "Penzenskaya oblast'",
      aliases: ['Пензенская область', "Penzenskaya oblast'", 'PNZ'],
    },
    {
      code: 'PER',
      label: 'Permskiy kray',
      aliases: ['Пермский край', 'Permskiy kray', 'PER'],
    },
    {
      code: 'PRI',
      label: 'Primorskiy kray',
      aliases: ['Приморский край', 'Primorskiy kray', 'PRI'],
    },
    {
      code: 'PSK',
      label: "Pskovskaya oblast'",
      aliases: ['Псковская область', "Pskovskaya oblast'", 'PSK'],
    },
    {
      code: 'AD',
      label: 'Respublika Adygeya',
      aliases: ['Республика Адыгея', 'Respublika Adygeya', 'AD'],
    },
    {
      code: 'AL',
      label: 'Altay Republits',
      aliases: ['Республика Алтай', 'Altay Republits', 'AL'],
    },
    {
      code: 'BA',
      label: 'Bashkortostan Republits',
      aliases: ['Республика Башкортостан', 'Bashkortostan Republits', 'BA'],
    },
    {
      code: 'BU',
      label: 'Buryatiya Republits',
      aliases: ['Республика Бурятия', 'Buryatiya Republits', 'BU'],
    },
    {
      code: 'DA',
      label: 'Dagestan Republits',
      aliases: ['Республика Дагестан', 'Dagestan Republits', 'DA'],
    },
    {
      code: 'IN',
      label: 'Ingushetiya Republits',
      aliases: ['Республика Ингушетия', 'Ingushetiya Republits', 'IN'],
    },
    {
      code: 'KL',
      label: 'Respublika Kalmykiya',
      aliases: ['Республика Калмыкия', 'Respublika Kalmykiya', 'KL'],
    },
    {
      code: 'KR',
      label: 'Kareliya Republits',
      aliases: ['Республика Карелия', 'Kareliya Republits', 'KR'],
    },
    {
      code: 'KO',
      label: 'Komi Republits',
      aliases: ['Республика Коми', 'Komi Republits', 'KO'],
    },
    {
      code: 'Автономна Республіка Крим',
      label: 'Respublika Krym',
      aliases: ['Автономна Республіка Крим', 'Respublika Krym', 'Республика Крым'],
    },
    {
      code: 'ME',
      label: 'Respublika Mariy El',
      aliases: ['Республика Марий Эл', 'Respublika Mariy El', 'ME'],
    },
    {
      code: 'MO',
      label: 'Respublika Mordoviya',
      aliases: ['Республика Мордовия', 'Respublika Mordoviya', 'MO'],
    },
    {
      code: 'SA',
      label: 'Sakha (Yakutiya) Republits',
      aliases: ['Республика Саха (Якутия)', 'Sakha (Yakutiya) Republits', 'SA'],
    },
    {
      code: 'SE',
      label: 'Respublika Severnaya Osetiya-Alaniya',
      aliases: [
        'Республика Северная Осетия-Алания',
        'Respublika Severnaya Osetiya-Alaniya',
        'SE',
      ],
    },
    {
      code: 'TA',
      label: 'Respublika Tatarstan',
      aliases: ['Республика Татарстан', 'Respublika Tatarstan', 'TA'],
    },
    {
      code: 'TY',
      label: 'Tyva Republits',
      aliases: ['Республика Тыва', 'Tyva Republits', 'TY'],
    },
    {
      code: 'UD',
      label: 'Udmurtskaja Respublika',
      aliases: ['Республика Удмуртия', 'Udmurtskaja Respublika', 'UD'],
    },
    {
      code: 'KK',
      label: 'Khakasiya Republits',
      aliases: ['Республика Хакасия', 'Khakasiya Republits', 'KK'],
    },
    {
      code: 'ROS',
      label: "Rostovskaya oblast'",
      aliases: ['Ростовская область', "Rostovskaya oblast'", 'ROS'],
    },
    {
      code: 'RYA',
      label: "Ryazanskaya oblast'",
      aliases: ['Рязанская область', "Ryazanskaya oblast'", 'RYA'],
    },
    {
      code: 'SAM',
      label: "Samarskaya oblast'",
      aliases: ['Самарская область', "Samarskaya oblast'", 'SAM'],
    },
    {
      code: 'SPE',
      label: 'Sankt-Peterburg',
      aliases: ['Санкт-Петербург', 'Sankt-Peterburg', 'SPE'],
    },
    {
      code: 'SAR',
      label: "Saratovskaya oblast'",
      aliases: ['Саратовская область', "Saratovskaya oblast'", 'SAR'],
    },
    {
      code: 'SAK',
      label: "Sakhalinskaya oblast'",
      aliases: ['Сахалинская область', "Sakhalinskaya oblast'", 'SAK'],
    },
    {
      code: 'SVE',
      label: "Sverdlovskaya oblast'",
      aliases: ['Свердловская область', "Sverdlovskaya oblast'", 'SVE'],
    },
    {
      code: 'Севастополь',
      label: "Sevastopol'",
      aliases: ['Севастополь', "Sevastopol'"],
    },
    {
      code: 'SMO',
      label: "Smolenskaya oblast'",
      aliases: ['Смоленская область', "Smolenskaya oblast'", 'SMO'],
    },
    {
      code: 'STA',
      label: 'Stavropolskiy kray',
      aliases: ['Ставропольский край', 'Stavropolskiy kray', 'STA'],
    },
    {
      code: 'TAM',
      label: "Tambovskaya oblast'",
      aliases: ['Тамбовская область', "Tambovskaya oblast'", 'TAM'],
    },
    {
      code: 'TVE',
      label: "Tverskaya oblast'",
      aliases: ['Тверская область', "Tverskaya oblast'", 'TVE'],
    },
    {
      code: 'TOM',
      label: "Tomskaya oblast'",
      aliases: ['Томская область', "Tomskaya oblast'", 'TOM'],
    },
    {
      code: 'TUL',
      label: "Tulskaya oblast'",
      aliases: ['Тульская область', "Tulskaya oblast'", 'TUL'],
    },
    {
      code: 'TYU',
      label: "Tyumenskaya oblast'",
      aliases: ['Тюменская область', "Tyumenskaya oblast'", 'TYU'],
    },
    {
      code: 'ULY',
      label: "Ulyanovskaya oblast'",
      aliases: ['Ульяновская область', "Ulyanovskaya oblast'", 'ULY'],
    },
    {
      code: 'KHA',
      label: 'Khabarovskiy kray',
      aliases: ['Хабаровский край', 'Khabarovskiy kray', 'KHA'],
    },
    {
      code: 'KHM',
      label: 'Khanty-Mansiyskiy avtonomnyy okrug',
      aliases: [
        'Ханты-Мансийский автономный округ',
        'Khanty-Mansiyskiy avtonomnyy okrug',
        'KHM',
      ],
    },
    {
      code: 'CHE',
      label: "Chelyabinskaya oblast'",
      aliases: ['Челябинская область', "Chelyabinskaya oblast'", 'CHE'],
    },
    {
      code: 'CE',
      label: 'Chechenskaya Republits',
      aliases: ['Чеченская Республика', 'Chechenskaya Republits', 'CE'],
    },
    {
      code: 'CU',
      label: 'Chuvashia',
      aliases: ['Чувашская Республика', 'Chuvashia', 'CU'],
    },
    {
      code: 'CHU',
      label: 'Chukotskiy',
      aliases: ['Чукотский автономный округ', 'Chukotskiy', 'CHU'],
    },
    {
      code: 'YAN',
      label: 'Yamalo-Nenetskiy',
      aliases: ['Ямало-Ненецкий автономный округ', 'Yamalo-Nenetskiy', 'YAN'],
    },
    {
      code: 'YAR',
      label: "Yaroslavskaya oblast'",
      aliases: ['Ярославская область', "Yaroslavskaya oblast'", 'YAR'],
    },
  ],
  SO: [
    {
      code: 'AW',
      label: 'Awdal',
      aliases: ['AD', 'Awdal', 'AW'],
    },
    {
      code: 'BK',
      label: 'Bakool',
      aliases: ['BK', 'Bakool'],
    },
    {
      code: 'BN',
      label: 'Banaadir',
      aliases: ['BN', 'Banaadir'],
    },
    {
      code: 'BR',
      label: 'Bari',
      aliases: ['BR', 'Bari'],
    },
    {
      code: 'BY',
      label: 'Bay',
      aliases: ['BY', 'Bay'],
    },
    {
      code: 'GA',
      label: 'Galguduud',
      aliases: ['GG', 'Galguduud', 'GA'],
    },
    {
      code: 'GE',
      label: 'Gedo',
      aliases: ['GD', 'Gedo', 'GE'],
    },
    {
      code: 'HI',
      label: 'Hiiraan',
      aliases: ['HR', 'Hiiraan', 'HI'],
    },
    {
      code: 'JD',
      label: 'Jubbada Dhexe',
      aliases: ['JD', 'Jubbada Dhexe'],
    },
    {
      code: 'JH',
      label: 'Jubbada Hoose',
      aliases: ['JH', 'Jubbada Hoose'],
    },
    {
      code: 'MU',
      label: 'Mudug',
      aliases: ['MD', 'Mudug', 'MU'],
    },
    {
      code: 'NU',
      label: 'Nugaal',
      aliases: ['NG', 'Nugaal', 'NU'],
    },
    {
      code: 'SA',
      label: 'Sanaag',
      aliases: ['SG', 'Sanaag', 'SA'],
    },
    {
      code: 'SD',
      label: 'Shabeellaha Dhexe',
      aliases: ['SD', 'Shabeellaha Dhexe'],
    },
    {
      code: 'SH',
      label: 'Shabeellaha Hoose',
      aliases: ['SH', 'Shabeellaha Hoose'],
    },
    {
      code: 'SO',
      label: 'Sool',
      aliases: ['SL', 'Sool', 'SO'],
    },
    {
      code: 'TO',
      label: 'Togdheer',
      aliases: ['TG', 'Togdheer', 'TO'],
    },
    {
      code: 'WO',
      label: 'Woqooyi Galbeed',
      aliases: ['WG', 'Woqooyi Galbeed', 'WO'],
    },
  ],
  SR: [
    {
      code: 'BR',
      label: 'Brokopondo',
      aliases: ['Brokopondo', 'BR'],
    },
    {
      code: 'CM',
      label: 'Commewijne',
      aliases: ['Commewijne', 'CM'],
    },
    {
      code: 'CR',
      label: 'Coronie',
      aliases: ['Coronie', 'CR'],
    },
    {
      code: 'MA',
      label: 'Marowijne',
      aliases: ['Marowijne', 'MA'],
    },
    {
      code: 'NI',
      label: 'Nickerie',
      aliases: ['Nickerie', 'NI'],
    },
    {
      code: 'PR',
      label: 'Para',
      aliases: ['Para', 'PR'],
    },
    {
      code: 'PM',
      label: 'Paramaribo',
      aliases: ['Paramaribo', 'PM'],
    },
    {
      code: 'SA',
      label: 'Saramacca',
      aliases: ['Saramacca', 'SA'],
    },
    {
      code: 'SI',
      label: 'Sipaliwini',
      aliases: ['Sipaliwini', 'SI'],
    },
    {
      code: 'WA',
      label: 'Wanica',
      aliases: ['Wanica', 'WA'],
    },
  ],
  SV: [
    {
      code: 'AH',
      label: 'Ahuachapán',
      aliases: ['Ahuachapan', 'Ahuachapán', 'AH'],
    },
    {
      code: 'CA',
      label: 'Cabañas',
      aliases: ['Cabanas', 'Cabañas', 'CA'],
    },
    {
      code: 'CH',
      label: 'Chalatenango',
      aliases: ['Calatenango', 'Chalatenango', 'CH'],
    },
    {
      code: 'CU',
      label: 'Cuscatlán',
      aliases: ['Cuscatlan', 'Cuscatlán', 'CU'],
    },
    {
      code: 'LI',
      label: 'La Libertad',
      aliases: ['La Libertad', 'LI'],
    },
    {
      code: 'PA',
      label: 'La Paz',
      aliases: ['La Paz', 'PA'],
    },
    {
      code: 'UN',
      label: 'La Unión',
      aliases: ['La Union', 'La Unión', 'UN'],
    },
    {
      code: 'MO',
      label: 'Morazán',
      aliases: ['Morazan', 'Morazán', 'MO'],
    },
    {
      code: 'SM',
      label: 'San Miguel',
      aliases: ['San Miguel', 'SM'],
    },
    {
      code: 'SS',
      label: 'San Salvador',
      aliases: ['San Salvador', 'SS'],
    },
    {
      code: 'SV',
      label: 'San Vicente',
      aliases: ['San Vicente', 'SV'],
    },
    {
      code: 'SA',
      label: 'Santa Ana',
      aliases: ['Santa Ana', 'SA'],
    },
    {
      code: 'SO',
      label: 'Sonsonate',
      aliases: ['Sonsonate', 'SO'],
    },
    {
      code: 'US',
      label: 'Usulután',
      aliases: ['Usulutan', 'Usulután', 'US'],
    },
  ],
  TH: [
    {
      code: '81',
      label: 'Krabi',
      aliases: ['กระบี่', 'Krabi', '81'],
    },
    {
      code: '10',
      label: 'Bangkok',
      aliases: ['กรุงเทพมหานคร', 'Bangkok', '10'],
    },
    {
      code: '71',
      label: 'Kanchanaburi',
      aliases: ['กาญจนบุรี', 'Kanchanaburi', '71'],
    },
    {
      code: '46',
      label: 'Kalasin',
      aliases: ['กาฬสินธุ์', 'Kalasin', '46'],
    },
    {
      code: '62',
      label: 'Kamphaeng Phet',
      aliases: ['กำแพงเพชร', 'Kamphaeng Phet', '62'],
    },
    {
      code: '40',
      label: 'Khon Kaen',
      aliases: ['ขอนแก่น', 'Khon Kaen', '40'],
    },
    {
      code: '38',
      label: 'Bueng Kan',
      aliases: ['จังหวัด บึงกาฬ', 'Bueng Kan', '38'],
    },
    {
      code: '22',
      label: 'Chanthaburi',
      aliases: ['จันทบุรี', 'Chanthaburi', '22'],
    },
    {
      code: '24',
      label: 'Chachoengsao',
      aliases: ['ฉะเชิงเทรา', 'Chachoengsao', '24'],
    },
    {
      code: '20',
      label: 'Chon Buri',
      aliases: ['ชลบุรี', 'Chon Buri', '20'],
    },
    {
      code: '18',
      label: 'Chai Nat',
      aliases: ['ชัยนาท', 'Chai Nat', '18'],
    },
    {
      code: '36',
      label: 'Chaiyaphum',
      aliases: ['ชัยภูมิ', 'Chaiyaphum', '36'],
    },
    {
      code: '86',
      label: 'Chumpon',
      aliases: ['ชุมพร', 'Chumpon', '86'],
    },
    {
      code: '57',
      label: 'Chiang Rai',
      aliases: ['เชียงราย', 'Chiang Rai', '57'],
    },
    {
      code: '50',
      label: 'Chiang Mai',
      aliases: ['เชียงใหม่', 'Chiang Mai', '50'],
    },
    {
      code: '92',
      label: 'Trang',
      aliases: ['ตรัง', 'Trang', '92'],
    },
    {
      code: '23',
      label: 'Trat',
      aliases: ['ตราด', 'Trat', '23'],
    },
    {
      code: '63',
      label: 'Tak',
      aliases: ['ตาก', 'Tak', '63'],
    },
    {
      code: '26',
      label: 'Nakhon Nayok',
      aliases: ['นครนายก', 'Nakhon Nayok', '26'],
    },
    {
      code: '73',
      label: 'Nakhon Pathom',
      aliases: ['นครปฐม', 'Nakhon Pathom', '73'],
    },
    {
      code: '48',
      label: 'Nakhon Phanom',
      aliases: ['นครพนม', 'Nakhon Phanom', '48'],
    },
    {
      code: '30',
      label: 'Nakhon Ratchasima',
      aliases: ['นครราชสีมา', 'Nakhon Ratchasima', '30'],
    },
    {
      code: '80',
      label: 'Nakhon Si Thammarat',
      aliases: ['นครศรีธรรมราช', 'Nakhon Si Thammarat', '80'],
    },
    {
      code: '60',
      label: 'Nakhon Sawan',
      aliases: ['นครสวรรค์', 'Nakhon Sawan', '60'],
    },
    {
      code: '12',
      label: 'Nonthaburi',
      aliases: ['นนทบุรี', 'Nonthaburi', '12'],
    },
    {
      code: '96',
      label: 'Narathiwat',
      aliases: ['นราธิวาส', 'Narathiwat', '96'],
    },
    {
      code: '55',
      label: 'Nan',
      aliases: ['น่าน', 'Nan', '55'],
    },
    {
      code: '31',
      label: 'Buri Ram',
      aliases: ['บุรีรัมย์', 'Buri Ram', '31'],
    },
    {
      code: '13',
      label: 'Pathum Thani',
      aliases: ['ปทุมธานี', 'Pathum Thani', '13'],
    },
    {
      code: '77',
      label: 'Prachuap Khiri Khan',
      aliases: ['ประจวบคีรีขันธ์', 'Prachuap Khiri Khan', '77'],
    },
    {
      code: '25',
      label: 'Prachin Buri',
      aliases: ['ปราจีนบุรี', 'Prachin Buri', '25'],
    },
    {
      code: '94',
      label: 'Pattani',
      aliases: ['ปัตตานี', 'Pattani', '94'],
    },
    {
      code: '14',
      label: 'Phra Nakhon Si Ayutthaya',
      aliases: ['พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya', '14'],
    },
    {
      code: '56',
      label: 'Phayao',
      aliases: ['พะเยา', 'Phayao', '56'],
    },
    {
      code: '82',
      label: 'Phang Nga',
      aliases: ['พังงา', 'Phang Nga', '82'],
    },
    {
      code: '93',
      label: 'Phattalung',
      aliases: ['พัทลุง', 'Phattalung', '93'],
    },
    {
      code: '66',
      label: 'Phichit',
      aliases: ['พิจิตร', 'Phichit', '66'],
    },
    {
      code: '65',
      label: 'Phitsanulok',
      aliases: ['พิษณุโลก', 'Phitsanulok', '65'],
    },
    {
      code: '76',
      label: 'Phetchaburi',
      aliases: ['เพชรบุรี', 'Phetchaburi', '76'],
    },
    {
      code: '67',
      label: 'Phetchabun',
      aliases: ['เพชรบูรณ์', 'Phetchabun', '67'],
    },
    {
      code: '54',
      label: 'Phrae',
      aliases: ['แพร่', 'Phrae', '54'],
    },
    {
      code: '83',
      label: 'Phuket',
      aliases: ['ภูเก็ต', 'Phuket', '83'],
    },
    {
      code: '44',
      label: 'Maha Sarakham',
      aliases: ['มหาสารคาม', 'Maha Sarakham', '44'],
    },
    {
      code: '49',
      label: 'Mukdahan',
      aliases: ['มุกดาหาร', 'Mukdahan', '49'],
    },
    {
      code: '58',
      label: 'Mae Hong Son',
      aliases: ['แม่ฮ่องสอน', 'Mae Hong Son', '58'],
    },
    {
      code: '35',
      label: 'Yasothon',
      aliases: ['ยโสธร', 'Yasothon', '35'],
    },
    {
      code: '95',
      label: 'Yala',
      aliases: ['ยะลา', 'Yala', '95'],
    },
    {
      code: '45',
      label: 'Roi Et',
      aliases: ['ร้อยเอ็ด', 'Roi Et', '45'],
    },
    {
      code: '85',
      label: 'Ranong',
      aliases: ['ระนอง', 'Ranong', '85'],
    },
    {
      code: '21',
      label: 'Rayong',
      aliases: ['ระยอง', 'Rayong', '21'],
    },
    {
      code: '70',
      label: 'Ratchaburi',
      aliases: ['ราชบุรี', 'Ratchaburi', '70'],
    },
    {
      code: '16',
      label: 'Lop Buri',
      aliases: ['ลพบุรี', 'Lop Buri', '16'],
    },
    {
      code: '52',
      label: 'Lampang',
      aliases: ['ลำปาง', 'Lampang', '52'],
    },
    {
      code: '51',
      label: 'Lamphun',
      aliases: ['ลำพูน', 'Lamphun', '51'],
    },
    {
      code: '42',
      label: 'Loei',
      aliases: ['เลย', 'Loei', '42'],
    },
    {
      code: '33',
      label: 'Si Sa Ket',
      aliases: ['ศรีสะเกษ', 'Si Sa Ket', '33'],
    },
    {
      code: '47',
      label: 'Sakon Nakhon',
      aliases: ['สกลนคร', 'Sakon Nakhon', '47'],
    },
    {
      code: '90',
      label: 'Songkhla',
      aliases: ['สงขลา', 'Songkhla', '90'],
    },
    {
      code: '91',
      label: 'Satun',
      aliases: ['สตูล', 'Satun', '91'],
    },
    {
      code: '11',
      label: 'Samut Prakan',
      aliases: ['สมุทรปราการ', 'Samut Prakan', '11'],
    },
    {
      code: '75',
      label: 'Samut Songkhram',
      aliases: ['สมุทรสงคราม', 'Samut Songkhram', '75'],
    },
    {
      code: '74',
      label: 'Samut Sakhon',
      aliases: ['สมุทรสาคร', 'Samut Sakhon', '74'],
    },
    {
      code: '27',
      label: 'Sa Kaeo',
      aliases: ['สระแก้ว', 'Sa Kaeo', '27'],
    },
    {
      code: '19',
      label: 'Saraburi',
      aliases: ['สระบุรี', 'Saraburi', '19'],
    },
    {
      code: '17',
      label: 'Sing Buri',
      aliases: ['สิงห์บุรี', 'Sing Buri', '17'],
    },
    {
      code: '64',
      label: 'Sukhothai',
      aliases: ['สุโขทัย', 'Sukhothai', '64'],
    },
    {
      code: '72',
      label: 'Suphanburi',
      aliases: ['สุพรรณบุรี', 'Suphanburi', '72'],
    },
    {
      code: '84',
      label: 'Surat Thani',
      aliases: ['สุราษฎร์ธานี', 'Surat Thani', '84'],
    },
    {
      code: '32',
      label: 'Surin',
      aliases: ['สุรินทร์', 'Surin', '32'],
    },
    {
      code: '43',
      label: 'Nong Khai',
      aliases: ['หนองคาย', 'Nong Khai', '43'],
    },
    {
      code: '39',
      label: 'Nong Bua Lam Phu',
      aliases: ['หนองบัวลำภู', 'Nong Bua Lam Phu', '39'],
    },
    {
      code: '15',
      label: 'Ang Thong',
      aliases: ['อ่างทอง', 'Ang Thong', '15'],
    },
    {
      code: '37',
      label: 'Amnat Charoen',
      aliases: ['อำนาจเจริญ', 'Amnat Charoen', '37'],
    },
    {
      code: '41',
      label: 'Udon Thani',
      aliases: ['อุดรธานี', 'Udon Thani', '41'],
    },
    {
      code: '53',
      label: 'Uttaradit',
      aliases: ['อุตรดิตถ์', 'Uttaradit', '53'],
    },
    {
      code: '61',
      label: 'Uthai Thani',
      aliases: ['อุทัยธานี', 'Uthai Thani', '61'],
    },
    {
      code: '34',
      label: 'Ubon Ratchathani',
      aliases: ['อุบลราชธานี', 'Ubon Ratchathani', '34'],
    },
  ],
  TR: [
    {
      code: '01',
      label: 'Adana',
      aliases: ['Adana', '01'],
    },
    {
      code: '02',
      label: 'Adıyaman',
      aliases: ['Adıyaman', '02'],
    },
    {
      code: '03',
      label: 'Afyon',
      aliases: ['Afyon', '03'],
    },
    {
      code: '04',
      label: 'Ağrı',
      aliases: ['Ağrı', '04'],
    },
    {
      code: '68',
      label: 'Aksaray',
      aliases: ['Aksaray', '68'],
    },
    {
      code: '05',
      label: 'Amasya',
      aliases: ['Amasya', '05'],
    },
    {
      code: '06',
      label: 'Ankara',
      aliases: ['Ankara', '06'],
    },
    {
      code: '07',
      label: 'Antalya',
      aliases: ['Antalya', '07'],
    },
    {
      code: '75',
      label: 'Ardahan',
      aliases: ['Ardahan', '75'],
    },
    {
      code: '08',
      label: 'Artvin',
      aliases: ['Artvin', '08'],
    },
    {
      code: '09',
      label: 'Aydın',
      aliases: ['Aydın', '09'],
    },
    {
      code: '10',
      label: 'Balıkesir',
      aliases: ['Balıkesir', '10'],
    },
    {
      code: '74',
      label: 'Bartın',
      aliases: ['Bartın', '74'],
    },
    {
      code: '72',
      label: 'Batman',
      aliases: ['Batman', '72'],
    },
    {
      code: '69',
      label: 'Bayburt',
      aliases: ['Bayburt', '69'],
    },
    {
      code: '11',
      label: 'Bilecik',
      aliases: ['Bilecik', '11'],
    },
    {
      code: '12',
      label: 'Bingöl',
      aliases: ['Bingöl', '12'],
    },
    {
      code: '13',
      label: 'Bitlis',
      aliases: ['Bitlis', '13'],
    },
    {
      code: '14',
      label: 'Bolu',
      aliases: ['Bolu', '14'],
    },
    {
      code: '15',
      label: 'Burdur',
      aliases: ['Burdur', '15'],
    },
    {
      code: '16',
      label: 'Bursa',
      aliases: ['Bursa', '16'],
    },
    {
      code: '17',
      label: 'Çanakkale',
      aliases: ['Çanakkale', '17'],
    },
    {
      code: '18',
      label: 'Çankırı',
      aliases: ['Çankırı', '18'],
    },
    {
      code: '19',
      label: 'Çorum',
      aliases: ['Çorum', '19'],
    },
    {
      code: '20',
      label: 'Denizli',
      aliases: ['Denizli', '20'],
    },
    {
      code: '21',
      label: 'Diyarbakır',
      aliases: ['Diyarbakır', '21'],
    },
    {
      code: '81',
      label: 'Düzce',
      aliases: ['Düzce', '81'],
    },
    {
      code: '22',
      label: 'Edirne',
      aliases: ['Edirne', '22'],
    },
    {
      code: '23',
      label: 'Elazığ',
      aliases: ['Elazığ', '23'],
    },
    {
      code: '24',
      label: 'Erzincan',
      aliases: ['Erzincan', '24'],
    },
    {
      code: '25',
      label: 'Erzurum',
      aliases: ['Erzurum', '25'],
    },
    {
      code: '26',
      label: 'Eskişehir',
      aliases: ['Eskişehir', '26'],
    },
    {
      code: '27',
      label: 'Gaziantep',
      aliases: ['Gaziantep', '27'],
    },
    {
      code: '28',
      label: 'Giresun',
      aliases: ['Giresun', '28'],
    },
    {
      code: '29',
      label: 'Gümüşhane',
      aliases: ['Gümüşhane', '29'],
    },
    {
      code: '30',
      label: 'Hakkari',
      aliases: ['Hakkari', '30'],
    },
    {
      code: '31',
      label: 'Hatay',
      aliases: ['Hatay', '31'],
    },
    {
      code: '76',
      label: 'Iğdır',
      aliases: ['Iğdır', '76'],
    },
    {
      code: '32',
      label: 'Isparta',
      aliases: ['Isparta', '32'],
    },
    {
      code: '34',
      label: 'İstanbul',
      aliases: ['İstanbul', '34'],
    },
    {
      code: '35',
      label: 'İzmir',
      aliases: ['İzmir', '35'],
    },
    {
      code: '46',
      label: 'Kahramanmaraş',
      aliases: ['Kahramanmaraş', '46'],
    },
    {
      code: '78',
      label: 'Karabük',
      aliases: ['Karabük', '78'],
    },
    {
      code: '70',
      label: 'Karaman',
      aliases: ['Karaman', '70'],
    },
    {
      code: '36',
      label: 'Kars',
      aliases: ['Kars', '36'],
    },
    {
      code: '37',
      label: 'Kastamonu',
      aliases: ['Kastamonu', '37'],
    },
    {
      code: '38',
      label: 'Kayseri',
      aliases: ['Kayseri', '38'],
    },
    {
      code: '71',
      label: 'Kırıkkale',
      aliases: ['Kırıkkale', '71'],
    },
    {
      code: '39',
      label: 'Kırklareli',
      aliases: ['Kırklareli', '39'],
    },
    {
      code: '40',
      label: 'Kırşehir',
      aliases: ['Kırşehir', '40'],
    },
    {
      code: '79',
      label: 'Kilis',
      aliases: ['Kilis', '79'],
    },
    {
      code: '41',
      label: 'Kocaeli',
      aliases: ['Kocaeli', '41'],
    },
    {
      code: '42',
      label: 'Konya',
      aliases: ['Konya', '42'],
    },
    {
      code: '43',
      label: 'Kütahya',
      aliases: ['Kütahya', '43'],
    },
    {
      code: '44',
      label: 'Malatya',
      aliases: ['Malatya', '44'],
    },
    {
      code: '45',
      label: 'Manisa',
      aliases: ['Manisa', '45'],
    },
    {
      code: '47',
      label: 'Mardin',
      aliases: ['Mardin', '47'],
    },
    {
      code: '33',
      label: 'Mersin',
      aliases: ['Mersin', '33'],
    },
    {
      code: '48',
      label: 'Muğla',
      aliases: ['Muğla', '48'],
    },
    {
      code: '49',
      label: 'Muş',
      aliases: ['Muş', '49'],
    },
    {
      code: '50',
      label: 'Nevşehir',
      aliases: ['Nevşehir', '50'],
    },
    {
      code: '51',
      label: 'Niğde',
      aliases: ['Niğde', '51'],
    },
    {
      code: '52',
      label: 'Ordu',
      aliases: ['Ordu', '52'],
    },
    {
      code: '80',
      label: 'Osmaniye',
      aliases: ['Osmaniye', '80'],
    },
    {
      code: '53',
      label: 'Rize',
      aliases: ['Rize', '53'],
    },
    {
      code: '54',
      label: 'Sakarya',
      aliases: ['Sakarya', '54'],
    },
    {
      code: '55',
      label: 'Samsun',
      aliases: ['Samsun', '55'],
    },
    {
      code: '56',
      label: 'Siirt',
      aliases: ['Siirt', '56'],
    },
    {
      code: '57',
      label: 'Sinop',
      aliases: ['Sinop', '57'],
    },
    {
      code: '58',
      label: 'Sivas',
      aliases: ['Sivas', '58'],
    },
    {
      code: '63',
      label: 'Şanlıurfa',
      aliases: ['Şanlıurfa', '63'],
    },
    {
      code: '73',
      label: 'Şırnak',
      aliases: ['Şırnak', '73'],
    },
    {
      code: '59',
      label: 'Tekirdağ',
      aliases: ['Tekirdağ', '59'],
    },
    {
      code: '60',
      label: 'Tokat',
      aliases: ['Tokat', '60'],
    },
    {
      code: '61',
      label: 'Trabzon',
      aliases: ['Trabzon', '61'],
    },
    {
      code: '62',
      label: 'Tunceli',
      aliases: ['Tunceli', '62'],
    },
    {
      code: '64',
      label: 'Uşak',
      aliases: ['Uşak', '64'],
    },
    {
      code: '65',
      label: 'Van',
      aliases: ['Van', '65'],
    },
    {
      code: '77',
      label: 'Yalova',
      aliases: ['Yalova', '77'],
    },
    {
      code: '66',
      label: 'Yozgat',
      aliases: ['Yozgat', '66'],
    },
    {
      code: '67',
      label: 'Zonguldak',
      aliases: ['Zonguldak', '67'],
    },
  ],
  TV: [
    {
      code: 'FUN',
      label: 'Funafuti',
      aliases: ['Funafuti', 'FUN'],
    },
    {
      code: 'NMG',
      label: 'Nanumanga',
      aliases: ['Nanumanga', 'NMG'],
    },
    {
      code: 'NMA',
      label: 'Nanumea',
      aliases: ['Nanumea', 'NMA'],
    },
    {
      code: 'Niulakita',
      label: 'Niulakita',
      aliases: ['Niulakita'],
    },
    {
      code: 'NIT',
      label: 'Niutao',
      aliases: ['Niutao', 'NIT'],
    },
    {
      code: 'NUI',
      label: 'Nui',
      aliases: ['Nui', 'NUI'],
    },
    {
      code: 'NKF',
      label: 'Nukufetau',
      aliases: ['Nukufetau', 'NKF'],
    },
    {
      code: 'NKL',
      label: 'Nukulaelae',
      aliases: ['Nukulaelae', 'NKL'],
    },
    {
      code: 'VAI',
      label: 'Vaitupu',
      aliases: ['Vaitupu', 'VAI'],
    },
  ],
  TW: [
    {
      code: 'TXG',
      label: 'Taichung City',
      aliases: ['台中市', 'Taichung City', 'TXG'],
    },
    {
      code: 'TPE',
      label: 'Taipei City',
      aliases: ['台北市', 'Taipei City', 'TPE'],
    },
    {
      code: 'TTT',
      label: 'Taitung County',
      aliases: ['台東縣', 'Taitung County', 'TTT'],
    },
    {
      code: 'TNN',
      label: 'Tainan City',
      aliases: ['台南市', 'Tainan City', 'TNN'],
    },
    {
      code: 'ILA',
      label: 'Yilan County',
      aliases: ['宜蘭縣', 'Yilan County', 'ILA'],
    },
    {
      code: 'HUA',
      label: 'Hualien County',
      aliases: ['花蓮縣', 'Hualien County', 'HUA'],
    },
    {
      code: '金門縣',
      label: 'Kinmen County',
      aliases: ['金門縣', 'Kinmen County'],
    },
    {
      code: 'NAN',
      label: 'Nantou County',
      aliases: ['南投縣', 'Nantou County', 'NAN'],
    },
    {
      code: 'PIF',
      label: 'Pingtung County',
      aliases: ['屏東縣', 'Pingtung County', 'PIF'],
    },
    {
      code: 'MIA',
      label: 'Miaoli County',
      aliases: ['苗栗縣', 'Miaoli County', 'MIA'],
    },
    {
      code: 'TAO',
      label: 'Taoyuan City',
      aliases: ['桃園市', 'Taoyuan City', 'TAO'],
    },
    {
      code: 'KHH',
      label: 'Kaohsiung City',
      aliases: ['高雄市', 'Kaohsiung City', 'KHH'],
    },
    {
      code: 'KEE',
      label: 'Keelung City',
      aliases: ['基隆市', 'Keelung City', 'KEE'],
    },
    {
      code: '連江縣',
      label: 'Lienchiang County',
      aliases: ['連江縣', 'Lienchiang County'],
    },
    {
      code: 'YUN',
      label: 'Yunlin County',
      aliases: ['雲林縣', 'Yunlin County', 'YUN'],
    },
    {
      code: 'NWT',
      label: 'New Taipei City',
      aliases: ['新北市', 'New Taipei City', 'NWT'],
    },
    {
      code: 'HSZ',
      label: 'Hsinchu City',
      aliases: ['新竹市', 'Hsinchu City', 'HSZ'],
    },
    {
      code: 'HSQ',
      label: 'Hsinchu County',
      aliases: ['新竹縣', 'Hsinchu County', 'HSQ'],
    },
    {
      code: 'CYI',
      label: 'Chiayi City',
      aliases: ['嘉義市', 'Chiayi City', 'CYI'],
    },
    {
      code: 'CYQ',
      label: 'Chiayi County',
      aliases: ['嘉義縣', 'Chiayi County', 'CYQ'],
    },
    {
      code: 'CHA',
      label: 'Changhua County',
      aliases: ['彰化縣', 'Changhua County', 'CHA'],
    },
    {
      code: 'PEN',
      label: 'Penghu County',
      aliases: ['澎湖縣', 'Penghu County', 'PEN'],
    },
  ],
  UA: [
    {
      code: '43',
      label: 'Crimea',
      aliases: ['Автономна Республіка Крим', 'Crimea', '43'],
    },
    {
      code: '05',
      label: "Vinnyts'ka oblast",
      aliases: ['Вінницька область', "Vinnyts'ka oblast", '05'],
    },
    {
      code: '07',
      label: "Volyns'ka oblast",
      aliases: ['Волинська область', "Volyns'ka oblast", '07'],
    },
    {
      code: '12',
      label: 'Dnipropetrovsk oblast',
      aliases: ['Дніпропетровська область', 'Dnipropetrovsk oblast', '12'],
    },
    {
      code: '14',
      label: 'Donetsk oblast',
      aliases: ['Донецька область', 'Donetsk oblast', '14'],
    },
    {
      code: '18',
      label: "Zhytomyrs'ka oblast",
      aliases: ['Житомирська область', "Zhytomyrs'ka oblast", '18'],
    },
    {
      code: '21',
      label: "Zakarpats'ka oblast",
      aliases: ['Закарпатська область', "Zakarpats'ka oblast", '21'],
    },
    {
      code: '23',
      label: "Zaporiz'ka oblast",
      aliases: ['Запорізька область', "Zaporiz'ka oblast", '23'],
    },
    {
      code: '26',
      label: "Ivano-Frankivs'ka oblast",
      aliases: ['Івано-Франківська область', "Ivano-Frankivs'ka oblast", '26'],
    },
    {
      code: '30',
      label: 'Kyiv city',
      aliases: ['місто Київ', 'Kyiv city', 'Київ', '30'],
    },
    {
      code: '32',
      label: 'Kiev oblast',
      aliases: ['Київська область', 'Kiev oblast', '32'],
    },
    {
      code: '35',
      label: "Kirovohrads'ka oblast",
      aliases: ['Кіровоградська область', "Kirovohrads'ka oblast", '35'],
    },
    {
      code: '09',
      label: "Luhans'ka oblast",
      aliases: ['Луганська область', "Luhans'ka oblast", '09'],
    },
    {
      code: '46',
      label: 'Lviv oblast',
      aliases: ['Львівська область', 'Lviv oblast', '46'],
    },
    {
      code: '48',
      label: "Mykolaivs'ka oblast",
      aliases: ['Миколаївська область', "Mykolaivs'ka oblast", '48'],
    },
    {
      code: '51',
      label: 'Odessa oblast',
      aliases: ['Одеська область', 'Odessa oblast', '51'],
    },
    {
      code: '53',
      label: "Poltavs'ka oblast",
      aliases: ['Полтавська область', "Poltavs'ka oblast", '53'],
    },
    {
      code: '56',
      label: "Rivnens'ka oblast",
      aliases: ['Рівненська область', "Rivnens'ka oblast", '56'],
    },
    {
      code: '40',
      label: "Sevastopol' city",
      aliases: ['місто Севастополь', "Sevastopol' city", 'Севастополь', '40'],
    },
    {
      code: '59',
      label: "Sums'ka oblast",
      aliases: ['Сумська область', "Sums'ka oblast", '59'],
    },
    {
      code: '61',
      label: "Ternopil's'ka oblast",
      aliases: ['Тернопільська область', "Ternopil's'ka oblast", '61'],
    },
    {
      code: '63',
      label: 'Kharkiv oblast',
      aliases: ['Харківська область', 'Kharkiv oblast', '63'],
    },
    {
      code: '65',
      label: "Khersons'ka oblast",
      aliases: ['Херсонська область', "Khersons'ka oblast", '65'],
    },
    {
      code: '68',
      label: "Khmel'nyts'ka oblast",
      aliases: ['Хмельницька область', "Khmel'nyts'ka oblast", '68'],
    },
    {
      code: '71',
      label: "Cherkas'ka oblast",
      aliases: ['Черкаська область', "Cherkas'ka oblast", '71'],
    },
    {
      code: '77',
      label: "Chernivets'ka oblast",
      aliases: ['Чернівецька область', "Chernivets'ka oblast", '77'],
    },
    {
      code: '74',
      label: "Chernihivs'ka oblast",
      aliases: ['Чернігівська область', "Chernihivs'ka oblast", '74'],
    },
  ],
  US: [
    {
      code: 'AL',
      label: 'Alabama',
      aliases: ['AL', 'Alabama'],
    },
    {
      code: 'AK',
      label: 'Alaska',
      aliases: ['AK', 'Alaska'],
    },
    {
      code: 'AS',
      label: 'American Samoa',
      aliases: ['AS', 'American Samoa'],
    },
    {
      code: 'AZ',
      label: 'Arizona',
      aliases: ['AZ', 'Arizona'],
    },
    {
      code: 'AR',
      label: 'Arkansas',
      aliases: ['AR', 'Arkansas'],
    },
    {
      code: 'AA',
      label: 'Armed Forces (AA)',
      aliases: ['AA', 'Armed Forces (AA)'],
    },
    {
      code: 'AE',
      label: 'Armed Forces (AE)',
      aliases: ['AE', 'Armed Forces (AE)'],
    },
    {
      code: 'AP',
      label: 'Armed Forces (AP)',
      aliases: ['AP', 'Armed Forces (AP)'],
    },
    {
      code: 'CA',
      label: 'California',
      aliases: ['CA', 'California'],
    },
    {
      code: 'CO',
      label: 'Colorado',
      aliases: ['CO', 'Colorado'],
    },
    {
      code: 'CT',
      label: 'Connecticut',
      aliases: ['CT', 'Connecticut'],
    },
    {
      code: 'DE',
      label: 'Delaware',
      aliases: ['DE', 'Delaware'],
    },
    {
      code: 'DC',
      label: 'District of Columbia',
      aliases: ['DC', 'District of Columbia'],
    },
    {
      code: 'FL',
      label: 'Florida',
      aliases: ['FL', 'Florida'],
    },
    {
      code: 'GA',
      label: 'Georgia',
      aliases: ['GA', 'Georgia'],
    },
    {
      code: 'GU',
      label: 'Guam',
      aliases: ['GU', 'Guam'],
    },
    {
      code: 'HI',
      label: 'Hawaii',
      aliases: ['HI', 'Hawaii'],
    },
    {
      code: 'ID',
      label: 'Idaho',
      aliases: ['ID', 'Idaho'],
    },
    {
      code: 'IL',
      label: 'Illinois',
      aliases: ['IL', 'Illinois'],
    },
    {
      code: 'IN',
      label: 'Indiana',
      aliases: ['IN', 'Indiana'],
    },
    {
      code: 'IA',
      label: 'Iowa',
      aliases: ['IA', 'Iowa'],
    },
    {
      code: 'KS',
      label: 'Kansas',
      aliases: ['KS', 'Kansas'],
    },
    {
      code: 'KY',
      label: 'Kentucky',
      aliases: ['KY', 'Kentucky'],
    },
    {
      code: 'LA',
      label: 'Louisiana',
      aliases: ['LA', 'Louisiana'],
    },
    {
      code: 'ME',
      label: 'Maine',
      aliases: ['ME', 'Maine'],
    },
    {
      code: 'MH',
      label: 'Marshall Islands',
      aliases: ['MH', 'Marshall Islands'],
    },
    {
      code: 'MD',
      label: 'Maryland',
      aliases: ['MD', 'Maryland'],
    },
    {
      code: 'MA',
      label: 'Massachusetts',
      aliases: ['MA', 'Massachusetts'],
    },
    {
      code: 'MI',
      label: 'Michigan',
      aliases: ['MI', 'Michigan'],
    },
    {
      code: 'FM',
      label: 'Micronesia',
      aliases: ['FM', 'Micronesia'],
    },
    {
      code: 'MN',
      label: 'Minnesota',
      aliases: ['MN', 'Minnesota'],
    },
    {
      code: 'MS',
      label: 'Mississippi',
      aliases: ['MS', 'Mississippi'],
    },
    {
      code: 'MO',
      label: 'Missouri',
      aliases: ['MO', 'Missouri'],
    },
    {
      code: 'MT',
      label: 'Montana',
      aliases: ['MT', 'Montana'],
    },
    {
      code: 'NE',
      label: 'Nebraska',
      aliases: ['NE', 'Nebraska'],
    },
    {
      code: 'NV',
      label: 'Nevada',
      aliases: ['NV', 'Nevada'],
    },
    {
      code: 'NH',
      label: 'New Hampshire',
      aliases: ['NH', 'New Hampshire'],
    },
    {
      code: 'NJ',
      label: 'New Jersey',
      aliases: ['NJ', 'New Jersey'],
    },
    {
      code: 'NM',
      label: 'New Mexico',
      aliases: ['NM', 'New Mexico'],
    },
    {
      code: 'NY',
      label: 'New York',
      aliases: ['NY', 'New York'],
    },
    {
      code: 'NC',
      label: 'North Carolina',
      aliases: ['NC', 'North Carolina'],
    },
    {
      code: 'ND',
      label: 'North Dakota',
      aliases: ['ND', 'North Dakota'],
    },
    {
      code: 'MP',
      label: 'Northern Mariana Islands',
      aliases: ['MP', 'Northern Mariana Islands'],
    },
    {
      code: 'OH',
      label: 'Ohio',
      aliases: ['OH', 'Ohio'],
    },
    {
      code: 'OK',
      label: 'Oklahoma',
      aliases: ['OK', 'Oklahoma'],
    },
    {
      code: 'OR',
      label: 'Oregon',
      aliases: ['OR', 'Oregon'],
    },
    {
      code: 'PW',
      label: 'Palau',
      aliases: ['PW', 'Palau'],
    },
    {
      code: 'PA',
      label: 'Pennsylvania',
      aliases: ['PA', 'Pennsylvania'],
    },
    {
      code: 'PR',
      label: 'Puerto Rico',
      aliases: ['PR', 'Puerto Rico'],
    },
    {
      code: 'RI',
      label: 'Rhode Island',
      aliases: ['RI', 'Rhode Island'],
    },
    {
      code: 'SC',
      label: 'South Carolina',
      aliases: ['SC', 'South Carolina'],
    },
    {
      code: 'SD',
      label: 'South Dakota',
      aliases: ['SD', 'South Dakota'],
    },
    {
      code: 'TN',
      label: 'Tennessee',
      aliases: ['TN', 'Tennessee'],
    },
    {
      code: 'TX',
      label: 'Texas',
      aliases: ['TX', 'Texas'],
    },
    {
      code: 'UT',
      label: 'Utah',
      aliases: ['UT', 'Utah'],
    },
    {
      code: 'VT',
      label: 'Vermont',
      aliases: ['VT', 'Vermont'],
    },
    {
      code: 'VI',
      label: 'Virgin Islands',
      aliases: ['VI', 'Virgin Islands'],
    },
    {
      code: 'VA',
      label: 'Virginia',
      aliases: ['VA', 'Virginia'],
    },
    {
      code: 'WA',
      label: 'Washington',
      aliases: ['WA', 'Washington'],
    },
    {
      code: 'WV',
      label: 'West Virginia',
      aliases: ['WV', 'West Virginia'],
    },
    {
      code: 'WI',
      label: 'Wisconsin',
      aliases: ['WI', 'Wisconsin'],
    },
    {
      code: 'WY',
      label: 'Wyoming',
      aliases: ['WY', 'Wyoming'],
    },
  ],
  UY: [
    {
      code: 'AR',
      label: 'Artigas',
      aliases: ['Artigas', 'AR'],
    },
    {
      code: 'CA',
      label: 'Canelones',
      aliases: ['Canelones', 'CA'],
    },
    {
      code: 'CL',
      label: 'Cerro Largo',
      aliases: ['Cerro Largo', 'CL'],
    },
    {
      code: 'CO',
      label: 'Colonia',
      aliases: ['Colonia', 'CO'],
    },
    {
      code: 'DU',
      label: 'Durazno',
      aliases: ['Durazno', 'DU'],
    },
    {
      code: 'FS',
      label: 'Flores',
      aliases: ['Flores', 'FS'],
    },
    {
      code: 'FD',
      label: 'Florida',
      aliases: ['Florida', 'FD'],
    },
    {
      code: 'LA',
      label: 'Lavalleja',
      aliases: ['Lavalleja', 'LA'],
    },
    {
      code: 'MA',
      label: 'Maldonado',
      aliases: ['Maldonado', 'MA'],
    },
    {
      code: 'MO',
      label: 'Montevideo',
      aliases: ['Montevideo', 'MO'],
    },
    {
      code: 'PA',
      label: 'Paysandú',
      aliases: ['Paysandú', 'PA'],
    },
    {
      code: 'RN',
      label: 'Río Negro',
      aliases: ['Río Negro', 'RN'],
    },
    {
      code: 'RV',
      label: 'Rivera',
      aliases: ['Rivera', 'RV'],
    },
    {
      code: 'RO',
      label: 'Rocha',
      aliases: ['Rocha', 'RO'],
    },
    {
      code: 'SA',
      label: 'Salto',
      aliases: ['Salto', 'SA'],
    },
    {
      code: 'SJ',
      label: 'San José',
      aliases: ['San José', 'SJ'],
    },
    {
      code: 'SO',
      label: 'Soriano',
      aliases: ['Soriano', 'SO'],
    },
    {
      code: 'TA',
      label: 'Tacuarembó',
      aliases: ['Tacuarembó', 'TA'],
    },
    {
      code: 'TT',
      label: 'Treinta y Tres',
      aliases: ['Treinta y Tres', 'TT'],
    },
  ],
  UZ: [
    {
      code: 'AN',
      label: 'Andijon Viloyati',
      aliases: ['Andijon Viloyati', 'AN'],
    },
    {
      code: 'BU',
      label: 'Buxoro Viloyati',
      aliases: ['Buxoro Viloyati', 'BU'],
    },
    {
      code: 'FA',
      label: "Farg'ona Viloyati",
      aliases: ["Farg'ona Viloyati", 'FA'],
    },
    {
      code: 'JI',
      label: 'Jizzax Viloyati',
      aliases: ['Jizzax Viloyati', 'JI'],
    },
    {
      code: 'NG',
      label: 'Namangan Viloyati',
      aliases: ['Namangan Viloyati', 'NG'],
    },
    {
      code: 'NW',
      label: 'Navoiy Viloyati',
      aliases: ['Navoiy Viloyati', 'NW'],
    },
    {
      code: 'QA',
      label: 'Qashqadaryo Viloyati',
      aliases: ['Qashqadaryo Viloyati', 'QA'],
    },
    {
      code: 'QR',
      label: 'Qoraqalpog’iston Respublikasi',
      aliases: ['Qoraqalpog’iston Respublikasi', 'QR'],
    },
    {
      code: 'SA',
      label: 'Samarqand Viloyati',
      aliases: ['Samarqand Viloyati', 'SA'],
    },
    {
      code: 'SI',
      label: 'Sirdaryo Viloyati',
      aliases: ['Sirdaryo Viloyati', 'SI'],
    },
    {
      code: 'SU',
      label: 'Surxondaryo Viloyati',
      aliases: ['Surxondaryo Viloyati', 'SU'],
    },
    {
      code: 'TK',
      label: 'Toshkent',
      aliases: ['Toshkent', 'TK'],
    },
    {
      code: 'TO',
      label: 'Toshkent Viloyati',
      aliases: ['Toshkent Viloyati', 'TO'],
    },
    {
      code: 'XO',
      label: 'Xorazm Viloyati',
      aliases: ['Xorazm Viloyati', 'XO'],
    },
  ],
  VE: [
    {
      code: 'Z',
      label: 'Amazonas',
      aliases: ['Amazonas', 'Z'],
    },
    {
      code: 'B',
      label: 'Anzoátegui',
      aliases: ['Anzoátegui', 'B'],
    },
    {
      code: 'C',
      label: 'Apure',
      aliases: ['Apure', 'C'],
    },
    {
      code: 'D',
      label: 'Aragua',
      aliases: ['Aragua', 'D'],
    },
    {
      code: 'E',
      label: 'Barinas',
      aliases: ['Barinas', 'E'],
    },
    {
      code: 'F',
      label: 'Bolívar',
      aliases: ['Bolívar', 'F'],
    },
    {
      code: 'G',
      label: 'Carabobo',
      aliases: ['Carabobo', 'G'],
    },
    {
      code: 'H',
      label: 'Cojedes',
      aliases: ['Cojedes', 'H'],
    },
    {
      code: 'Y',
      label: 'Delta Amacuro',
      aliases: ['Delta Amacuro', 'Y'],
    },
    {
      code: 'W',
      label: 'Dependencias Federales',
      aliases: ['Dependencias Federales', 'W'],
    },
    {
      code: 'A',
      label: 'Distrito Federal',
      aliases: ['Distrito Federal', 'A'],
    },
    {
      code: 'I',
      label: 'Falcón',
      aliases: ['Falcón', 'I'],
    },
    {
      code: 'J',
      label: 'Guárico',
      aliases: ['Guárico', 'J'],
    },
    {
      code: 'K',
      label: 'Lara',
      aliases: ['Lara', 'K'],
    },
    {
      code: 'L',
      label: 'Mérida',
      aliases: ['Mérida', 'L'],
    },
    {
      code: 'M',
      label: 'Miranda',
      aliases: ['Miranda', 'M'],
    },
    {
      code: 'N',
      label: 'Monagas',
      aliases: ['Monagas', 'N'],
    },
    {
      code: 'O',
      label: 'Nueva Esparta',
      aliases: ['Nueva Esparta', 'O'],
    },
    {
      code: 'P',
      label: 'Portuguesa',
      aliases: ['Portuguesa', 'P'],
    },
    {
      code: 'R',
      label: 'Sucre',
      aliases: ['Sucre', 'R'],
    },
    {
      code: 'S',
      label: 'Táchira',
      aliases: ['Táchira', 'S'],
    },
    {
      code: 'T',
      label: 'Trujillo',
      aliases: ['Trujillo', 'T'],
    },
    {
      code: 'X',
      label: 'Vargas',
      aliases: ['Vargas', 'X'],
    },
    {
      code: 'U',
      label: 'Yaracuy',
      aliases: ['Yaracuy', 'U'],
    },
    {
      code: 'V',
      label: 'Zulia',
      aliases: ['Zulia', 'V'],
    },
  ],
  VN: [
    {
      code: '44',
      label: 'An Giang Province',
      aliases: ['An Giang', 'An Giang Province', '44'],
    },
    {
      code: '43',
      label: 'Ba Ria-Vung Tau Province',
      aliases: ['Bà Rịa–Vũng Tàu', 'Ba Ria-Vung Tau Province', '43'],
    },
    {
      code: '55',
      label: 'Bac Lieu Province',
      aliases: ['Bạc Liêu', 'Bac Lieu Province', '55'],
    },
    {
      code: '54',
      label: 'Bac Giang Province',
      aliases: ['Bắc Giang', 'Bac Giang Province', '54'],
    },
    {
      code: '53',
      label: 'Bac Kan Province',
      aliases: ['Bắc Kạn', 'Bac Kan Province', '53'],
    },
    {
      code: '56',
      label: 'Bac Ninh City',
      aliases: ['Bắc Ninh', 'Bac Ninh City', '56'],
    },
    {
      code: '50',
      label: 'Ben Tre Province',
      aliases: ['Bến Tre', 'Ben Tre Province', '50'],
    },
    {
      code: '57',
      label: 'Binh Duong Province',
      aliases: ['Bình Dương', 'Binh Duong Province', '57'],
    },
    {
      code: '31',
      label: 'Binh Dinh Province',
      aliases: ['Bình Định', 'Binh Dinh Province', '31'],
    },
    {
      code: '58',
      label: 'Binh Phuoc Province',
      aliases: ['Bình Phước', 'Binh Phuoc Province', '58'],
    },
    {
      code: '40',
      label: 'Binh Thuan Province',
      aliases: ['Bình Thuận', 'Binh Thuan Province', '40'],
    },
    {
      code: '59',
      label: 'Ca Mau Province',
      aliases: ['Cà Mau', 'Ca Mau Province', '59'],
    },
    {
      code: '04',
      label: 'Cao Bang Province',
      aliases: ['Cao Bằng', 'Cao Bang Province', '04'],
    },
    {
      code: 'CT',
      label: 'Can Tho City',
      aliases: ['Cần Thơ', 'Can Tho City', 'CT'],
    },
    {
      code: 'DN',
      label: 'Da Nang City',
      aliases: ['Đà Nẵng', 'Da Nang City', 'DN'],
    },
    {
      code: '33',
      label: 'Dak Lak Province',
      aliases: ['Đắk Lắk', 'Dak Lak Province', '33'],
    },
    {
      code: '72',
      label: 'Dak Nong Province',
      aliases: ['Đăk Nông', 'Dak Nong Province', '72'],
    },
    {
      code: '71',
      label: 'Dien Bien Province',
      aliases: ['Điện Biên', 'Dien Bien Province', '71'],
    },
    {
      code: '39',
      label: 'Dong Nai City',
      aliases: ['Đồng Nai', 'Dong Nai City', '39'],
    },
    {
      code: '45',
      label: 'Dong Thap Province',
      aliases: ['Đồng Tháp', 'Dong Thap Province', '45'],
    },
    {
      code: '30',
      label: 'Gia Lai Province',
      aliases: ['Gia Lai', 'Gia Lai Province', '30'],
    },
    {
      code: '03',
      label: 'Ha Giang Province',
      aliases: ['Hà Giang', 'Ha Giang Province', '03'],
    },
    {
      code: '63',
      label: 'Ha Nam Province',
      aliases: ['Hà Nam', 'Ha Nam Province', '63'],
    },
    {
      code: 'HN',
      label: 'Hanoi City',
      aliases: ['Hà Nội', 'Hanoi City', 'HN'],
    },
    {
      code: '23',
      label: 'Ha Tinh Province',
      aliases: ['Hà Tĩnh', 'Ha Tinh Province', '23'],
    },
    {
      code: '61',
      label: 'Hai Duong Province',
      aliases: ['Hải Dương', 'Hai Duong Province', '61'],
    },
    {
      code: 'HP',
      label: 'Haiphong City',
      aliases: ['Hải Phòng', 'Haiphong City', 'HP'],
    },
    {
      code: '73',
      label: 'Hau Giang Province',
      aliases: ['Hậu Giang', 'Hau Giang Province', '73'],
    },
    {
      code: '14',
      label: 'Hoa Binh Province',
      aliases: ['Hòa Bình', 'Hoa Binh Province', '14'],
    },
    {
      code: '66',
      label: 'Hung Yen Province',
      aliases: ['Hưng Yên', 'Hung Yen Province', '66'],
    },
    {
      code: '34',
      label: 'Khanh Hoa Province',
      aliases: ['Khánh Hòa', 'Khanh Hoa Province', '34'],
    },
    {
      code: '47',
      label: 'Kien Giang Province',
      aliases: ['Kiên Giang', 'Kien Giang Province', '47'],
    },
    {
      code: '28',
      label: 'Kon Tum Province',
      aliases: ['Kon Tum', 'Kon Tum Province', '28'],
    },
    {
      code: '01',
      label: 'Lai Chau Province',
      aliases: ['Lai Châu', 'Lai Chau Province', '01'],
    },
    {
      code: '09',
      label: 'Lang Song Province',
      aliases: ['Lạng Sơn', 'Lang Song Province', '09'],
    },
    {
      code: '02',
      label: 'Lao Cai Province',
      aliases: ['Lào Cai', 'Lao Cai Province', '02'],
    },
    {
      code: '35',
      label: 'Lam Dong Province',
      aliases: ['Lâm Đồng', 'Lam Dong Province', '35'],
    },
    {
      code: '41',
      label: 'Long An Province',
      aliases: ['Long An', 'Long An Province', '41'],
    },
    {
      code: '67',
      label: 'Nam Dinh Province',
      aliases: ['Nam Định', 'Nam Dinh Province', '67'],
    },
    {
      code: '22',
      label: 'Nghe An Province',
      aliases: ['Nghệ An', 'Nghe An Province', '22'],
    },
    {
      code: '18',
      label: 'Ninh Binh Province',
      aliases: ['Ninh Bình', 'Ninh Binh Province', '18'],
    },
    {
      code: '36',
      label: 'Ninh Thuan Province',
      aliases: ['Ninh Thuận', 'Ninh Thuan Province', '36'],
    },
    {
      code: '68',
      label: 'Phu Tho Province',
      aliases: ['Phú Thọ', 'Phu Tho Province', '68'],
    },
    {
      code: '32',
      label: 'Phu Yen Province',
      aliases: ['Phú Yên', 'Phu Yen Province', '32'],
    },
    {
      code: '24',
      label: 'Quang Binh Province',
      aliases: ['Quảng Bình', 'Quang Binh Province', '24'],
    },
    {
      code: '27',
      label: 'Quang Nam Province',
      aliases: ['Quảng Nam', 'Quang Nam Province', '27'],
    },
    {
      code: '29',
      label: 'Quang Ngai Province',
      aliases: ['Quảng Ngãi', 'Quang Ngai Province', '29'],
    },
    {
      code: '13',
      label: 'Quang Ninh Province',
      aliases: ['Quảng Ninh', 'Quang Ninh Province', '13'],
    },
    {
      code: '25',
      label: 'Quang Tri Province',
      aliases: ['Quảng Trị', 'Quang Tri Province', '25'],
    },
    {
      code: '52',
      label: 'Soc Trang Province',
      aliases: ['Sóc Trăng', 'Soc Trang Province', '52'],
    },
    {
      code: '05',
      label: 'Son La Province',
      aliases: ['Sơn La', 'Son La Province', '05'],
    },
    {
      code: '37',
      label: 'Tay Ninh Province',
      aliases: ['Tây Ninh', 'Tay Ninh Province', '37'],
    },
    {
      code: '20',
      label: 'Thai Binh Province',
      aliases: ['Thái Bình', 'Thai Binh Province', '20'],
    },
    {
      code: '69',
      label: 'Thai Nguyen Province',
      aliases: ['Thái Nguyên', 'Thai Nguyen Province', '69'],
    },
    {
      code: '21',
      label: 'Thanh Hoa Province',
      aliases: ['Thanh Hóa', 'Thanh Hoa Province', '21'],
    },
    {
      code: 'SG',
      label: 'Ho Chi Minh City',
      aliases: ['Thành phố Hồ Chí Minh', 'Ho Chi Minh City', 'SG'],
    },
    {
      code: '26',
      label: 'Hue City',
      aliases: ['Thành phố Huế', 'Hue City', '26'],
    },
    {
      code: '46',
      label: 'Tien Giang Province',
      aliases: ['Tiền Giang', 'Tien Giang Province', '46'],
    },
    {
      code: '51',
      label: 'Tra Vinh Province',
      aliases: ['Trà Vinh', 'Tra Vinh Province', '51'],
    },
    {
      code: '07',
      label: 'Tuyen Quang Province',
      aliases: ['Tuyên Quang', 'Tuyen Quang Province', '07'],
    },
    {
      code: '49',
      label: 'Vinh Long Province',
      aliases: ['Vĩnh Long', 'Vinh Long Province', '49'],
    },
    {
      code: '70',
      label: 'Vinh Phuc Province',
      aliases: ['Vĩnh Phúc', 'Vinh Phuc Province', '70'],
    },
    {
      code: '06',
      label: 'Yen Bai Province',
      aliases: ['Yên Bái', 'Yen Bai Province', '06'],
    },
  ],
};

export function getCountryRegions(countryCode: string): readonly CountryRegion[] {
  return COUNTRY_REGIONS[countryCode.toUpperCase()] ?? [];
}

export function findCountryRegion(
  countryCode: string,
  value: string,
): CountryRegion | null {
  const normalize = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const search = normalize(value);
  return (
    getCountryRegions(countryCode).find((region) =>
      region.aliases.some((alias) => normalize(alias) === search),
    ) ?? null
  );
}
