/**
 * 紫微斗数星曜与安星规则。
 *
 * 这里的每一条偏移量都是安星口诀的直接编码，不是拟合出来的近似。安星链条是：
 *   命宫 → 命宫干支 → 纳音 → 五行局 → 紫微 → 天府 → 十四主星 → 六吉六煞
 * 五行局是整条链的根，它错则整盘皆错，所以 getFiveElementBureau 走的是
 * ganzhi.service 里那份与 lunar-javascript 逐条对过的纳音表。
 */

export const ZIWEI_BRANCH_ORDER = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
];

/** 正月建寅：农历月份序号（正月为 1）到月支的映射。 */
export const ZIWEI_MONTH_BRANCH_ORDER = [
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
  '丑',
];

/**
 * 十二宫，按传统枚举次序（命、兄弟、夫妻、子女、财帛、疾厄、迁移、仆役、官禄、田宅、福德、父母）。
 *
 * **这个次序是「逆布」的次序，不是地支下标递增的次序**：自命宫起逆行安宫，
 * 即兄弟宫在命宫的**前一位地支**（命宫在寅则兄弟宫在丑、父母宫在卯），
 * 落到实现上是 `mingIndex - offset`，见 ziwei.service.js 的 buildPalaces。
 *
 * 判据（不依赖盘面画法，内部即可自洽）：斗数通行口径是「阳男阴女大限顺行，
 * 第二大限走**父母宫**；阴男阳女大限逆行，第二大限走**兄弟宫**」。
 * 大限顺行就是地支下标递增（getMajorPeriodDirection 返回 +1），
 * 故 mingIndex+1 必须是父母宫 —— 若照本数组顺着加，那一格会变成兄弟宫，
 * 与大限那条规则直接冲突。此前正是加着排的，除命宫与迁移宫外十宫全部错位
 * （兄弟↔父母、夫妻↔福德、子女↔田宅、财帛↔官禄、疾厄↔仆役 两两互换）。
 */
export const ZIWEI_PALACES = [
  { key: 'ming', name: 'Ming', cn: '命宫' },
  { key: 'brothers', name: 'Brothers', cn: '兄弟' },
  { key: 'spouse', name: 'Spouse', cn: '夫妻' },
  { key: 'children', name: 'Children', cn: '子女' },
  { key: 'wealth', name: 'Wealth', cn: '财帛' },
  { key: 'health', name: 'Health', cn: '疾厄' },
  { key: 'travel', name: 'Travel', cn: '迁移' },
  { key: 'friends', name: 'Friends', cn: '仆役' },
  { key: 'career', name: 'Career', cn: '官禄' },
  { key: 'property', name: 'Property', cn: '田宅' },
  { key: 'mental', name: 'Mental', cn: '福德' },
  { key: 'parents', name: 'Parents', cn: '父母' },
];

export const ZIWEI_MAJOR_STARS = {
  ziwei: { key: 'ziwei', name: 'Zi Wei', cn: '紫微' },
  tianji: { key: 'tianji', name: 'Tian Ji', cn: '天机' },
  taiyang: { key: 'taiyang', name: 'Tai Yang', cn: '太阳' },
  wuqu: { key: 'wuqu', name: 'Wu Qu', cn: '武曲' },
  tiantong: { key: 'tiantong', name: 'Tian Tong', cn: '天同' },
  lianzhen: { key: 'lianzhen', name: 'Lian Zhen', cn: '廉贞' },
  tianfu: { key: 'tianfu', name: 'Tian Fu', cn: '天府' },
  taiyin: { key: 'taiyin', name: 'Tai Yin', cn: '太阴' },
  tanlang: { key: 'tanlang', name: 'Tan Lang', cn: '贪狼' },
  jumen: { key: 'jumen', name: 'Ju Men', cn: '巨门' },
  tianxiang: { key: 'tianxiang', name: 'Tian Xiang', cn: '天相' },
  tianliang: { key: 'tianliang', name: 'Tian Liang', cn: '天梁' },
  qisha: { key: 'qisha', name: 'Qi Sha', cn: '七杀' },
  pojun: { key: 'pojun', name: 'Po Jun', cn: '破军' },
};

export const ZIWEI_MINOR_STARS = {
  wenchang: { key: 'wenchang', name: 'Wen Chang', cn: '文昌' },
  wenqu: { key: 'wenqu', name: 'Wen Qu', cn: '文曲' },
  zuofu: { key: 'zuofu', name: 'Zuo Fu', cn: '左辅' },
  youbi: { key: 'youbi', name: 'You Bi', cn: '右弼' },
  tiankui: { key: 'tiankui', name: 'Tian Kui', cn: '天魁' },
  tianyue: { key: 'tianyue', name: 'Tian Yue', cn: '天钺' },
  lucun: { key: 'lucun', name: 'Lu Cun', cn: '禄存' },
  tianma: { key: 'tianma', name: 'Tian Ma', cn: '天马' },
};

export const ZIWEI_MALEFIC_STARS = {
  qingyang: { key: 'qingyang', name: 'Qing Yang', cn: '擎羊' },
  tuoluo: { key: 'tuoluo', name: 'Tuo Luo', cn: '陀罗' },
  huoxing: { key: 'huoxing', name: 'Huo Xing', cn: '火星' },
  lingxing: { key: 'lingxing', name: 'Ling Xing', cn: '铃星' },
  dikong: { key: 'dikong', name: 'Di Kong', cn: '地空' },
  dijie: { key: 'dijie', name: 'Di Jie', cn: '地劫' },
};

/**
 * 紫微系六星，自紫微所在宫**逆行**安放。
 * 口诀：紫微天机逆行旁，隔一阳武天同当，又隔二位廉贞地。
 */
export const ZIWEI_GROUP_OFFSETS = [
  { key: 'ziwei', offset: 0 },
  { key: 'tianji', offset: -1 },
  { key: 'taiyang', offset: -3 },
  { key: 'wuqu', offset: -4 },
  { key: 'tiantong', offset: -5 },
  { key: 'lianzhen', offset: -8 },
];

/**
 * 天府系八星，自天府所在宫**顺行**安放。
 * 破军独隔三位（+10），不是紧接七杀的 +7。
 */
export const TIANFU_GROUP_OFFSETS = [
  { key: 'tianfu', offset: 0 },
  { key: 'taiyin', offset: 1 },
  { key: 'tanlang', offset: 2 },
  { key: 'jumen', offset: 3 },
  { key: 'tianxiang', offset: 4 },
  { key: 'tianliang', offset: 5 },
  { key: 'qisha', offset: 6 },
  { key: 'pojun', offset: 10 },
];

/**
 * 五虎遁：由年干定寅宫天干，其余各宫顺排。命宫天干靠它推出，进而取纳音定五行局。
 */
export const YEAR_STEM_TO_YIN_PALACE_STEM = {
  甲: '丙',
  己: '丙',
  乙: '戊',
  庚: '戊',
  丙: '庚',
  辛: '庚',
  丁: '壬',
  壬: '壬',
  戊: '甲',
  癸: '甲',
};

/**
 * 天魁天钺，由年干定。
 * 口诀：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，庚辛逢马虎。
 * 「庚」在首句与末句都出现，此处从通行取法归入甲戊庚一组，辛独取午寅。
 */
export const KUIYUE_BY_YEAR_STEM = {
  甲: { kui: '丑', yue: '未' },
  戊: { kui: '丑', yue: '未' },
  庚: { kui: '丑', yue: '未' },
  乙: { kui: '子', yue: '申' },
  己: { kui: '子', yue: '申' },
  丙: { kui: '亥', yue: '酉' },
  丁: { kui: '亥', yue: '酉' },
  辛: { kui: '午', yue: '寅' },
  壬: { kui: '卯', yue: '巳' },
  癸: { kui: '卯', yue: '巳' },
};

/** 禄存由年干定；擎羊在禄存前一位、陀罗在后一位。 */
export const LUCUN_BY_YEAR_STEM = {
  甲: '寅',
  乙: '卯',
  丙: '巳',
  戊: '巳',
  丁: '午',
  己: '午',
  庚: '申',
  辛: '酉',
  壬: '亥',
  癸: '子',
};

/**
 * 火星铃星起点，由年支三合组决定，再自起点顺行数至生时。
 * 口诀：寅午戌人丑卯方，申子辰人寅戌扬，巳酉丑人卯戌位，亥卯未人酉戌房。
 */
export const HUOLING_START_BY_YEAR_GROUP = [
  { branches: ['寅', '午', '戌'], huo: '丑', ling: '卯' },
  { branches: ['申', '子', '辰'], huo: '寅', ling: '戌' },
  { branches: ['巳', '酉', '丑'], huo: '卯', ling: '戌' },
  { branches: ['亥', '卯', '未'], huo: '酉', ling: '戌' },
];

/** 天马（驿马）由年支三合组定，恒落四生地寅申巳亥。 */
export const TIANMA_BY_YEAR_GROUP = [
  { branches: ['申', '子', '辰'], branch: '寅' },
  { branches: ['寅', '午', '戌'], branch: '申' },
  { branches: ['巳', '酉', '丑'], branch: '亥' },
  { branches: ['亥', '卯', '未'], branch: '巳' },
];

/**
 * 小限起宫，由年支三合组定，男顺女逆，一岁一宫。
 * 口诀：寅午戌人辰上起，申子辰人自戌出，巳酉丑人未宫始，亥卯未人丑上行。
 */
export const XIAOXIAN_START_BY_YEAR_GROUP = [
  { branches: ['寅', '午', '戌'], branch: '辰' },
  { branches: ['申', '子', '辰'], branch: '戌' },
  { branches: ['巳', '酉', '丑'], branch: '未' },
  { branches: ['亥', '卯', '未'], branch: '丑' },
];

/** 阳干，用于定大限顺逆（阳男阴女顺行，阴男阳女逆行）。 */
export const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

/**
 * 十干四化。口诀（本模块所宗）：
 *   甲廉破武阳、乙机梁紫阴、丙同机昌廉、丁阴同机巨、戊贪阴右机、
 *   己武贪梁曲、庚阳武阴同、辛巨阳曲昌、壬梁紫左武、癸破巨阴贪。
 *
 * 三处有流派分歧，本模块选定如下（换派只改这张表 + rulings 的 sihuaVariants 一条）：
 * - **戊干化科取右弼**（另有取太阳一派）
 * - **庚干取「阳武阴同」**（另有取天府化科的《全书》一派，及天同化科／太阴化忌一派）
 * - **壬干化科取左辅**（另有取天府的《全书》一派）—— 戊右弼与壬左辅是同一套表的一对，
 *   取右弼就该取左辅，不要一半一派
 *
 * 壬干化忌**恒为武曲**，没有任何一派取破军；壬干化科亦从无天机（天机化科属丁干）。
 * 此前这两格写作 ke: 天机 / ji: 破军，是两处硬错，不是流派选择：
 * 壬年生人（1982/1992/2002/2012/2022…）的本命四化与凡壬干之宫的宫干四化全部受影响。
 */
export const ZIWEI_SIHUA_BY_STEM = {
  甲: { lu: 'lianzhen', quan: 'pojun', ke: 'wuqu', ji: 'taiyang' },
  乙: { lu: 'tianji', quan: 'tianliang', ke: 'ziwei', ji: 'taiyin' },
  丙: { lu: 'tiantong', quan: 'tianji', ke: 'wenchang', ji: 'lianzhen' },
  丁: { lu: 'taiyin', quan: 'tiantong', ke: 'tianji', ji: 'jumen' },
  戊: { lu: 'tanlang', quan: 'taiyin', ke: 'youbi', ji: 'tianji' },
  己: { lu: 'wuqu', quan: 'tanlang', ke: 'tianliang', ji: 'wenqu' },
  庚: { lu: 'taiyang', quan: 'wuqu', ke: 'taiyin', ji: 'tiantong' },
  辛: { lu: 'jumen', quan: 'taiyang', ke: 'wenqu', ji: 'wenchang' },
  壬: { lu: 'tianliang', quan: 'ziwei', ke: 'zuofu', ji: 'wuqu' },
  癸: { lu: 'pojun', quan: 'jumen', ke: 'taiyin', ji: 'tanlang' },
};

export const ZIWEI_SIHUA_TYPES = {
  lu: { key: 'lu', cn: '化禄', name: 'Wealth' },
  quan: { key: 'quan', cn: '化权', name: 'Power' },
  ke: { key: 'ke', cn: '化科', name: 'Fame' },
  ji: { key: 'ji', cn: '化忌', name: 'Adversity' },
};

/**
 * 命主星：按**命宫地支**取。斗数以命主论先天禀赋，与身主并称。
 * 子贪丑巨寅存卯曲辰廉巳武午破未武申廉酉曲戌存亥巨。
 */
export const MINGZHU_BY_MING_BRANCH = {
  子: '贪狼',
  丑: '巨门',
  寅: '禄存',
  卯: '文曲',
  辰: '廉贞',
  巳: '武曲',
  午: '破军',
  未: '武曲',
  申: '廉贞',
  酉: '文曲',
  戌: '禄存',
  亥: '巨门',
};

/** 身主星：按**生年地支**取，与命宫无关。 */
export const SHENZHU_BY_YEAR_BRANCH = {
  子: '火星',
  丑: '天相',
  寅: '天梁',
  卯: '天同',
  辰: '文昌',
  巳: '天机',
  午: '火星',
  未: '天相',
  申: '天梁',
  酉: '天同',
  戌: '文昌',
  亥: '天机',
};

/**
 * 乙级星。安星规则各写在 basis 里，一星一条，改流派只改那一条。
 *
 * `from` 是起宫地支，`step` 是自起宫走多少步，`dir` 为 1 顺行、-1 逆行。
 * step 的取值来源：`month`（农历月序，正月为 1）、`day`（农历日）、
 * `hour`（时支序，子为 0）、`yearBranch`（年支序，子为 0）。
 */
export const ZIWEI_MINOR_B_STARS = [
  { key: 'hongluan', cn: '红鸾', from: '卯', dir: -1, step: 'yearBranch', basis: '卯宫起子年逆行' },
  { key: 'tianxi', cn: '天喜', from: '酉', dir: -1, step: 'yearBranch', basis: '红鸾对宫' },
  { key: 'tianxing', cn: '天刑', from: '酉', dir: 1, step: 'monthFrom1', basis: '酉宫起正月顺行' },
  { key: 'tianyao', cn: '天姚', from: '丑', dir: 1, step: 'monthFrom1', basis: '丑宫起正月顺行' },
  { key: 'tianku', cn: '天哭', from: '午', dir: -1, step: 'yearBranch', basis: '午宫起子年逆行' },
  { key: 'tianxu', cn: '天虚', from: '午', dir: 1, step: 'yearBranch', basis: '午宫起子年顺行' },
  { key: 'taifu', cn: '台辅', from: '午', dir: 1, step: 'hour', basis: '午宫起子时顺行' },
  { key: 'fenggao', cn: '封诰', from: '寅', dir: 1, step: 'hour', basis: '寅宫起子时顺行' },
  { key: 'longchi', cn: '龙池', from: '辰', dir: 1, step: 'yearBranch', basis: '辰宫起子年顺行' },
  { key: 'fengge', cn: '凤阁', from: '戌', dir: -1, step: 'yearBranch', basis: '戌宫起子年逆行' },
  {
    key: 'jieshen',
    cn: '解神',
    from: '戌',
    dir: -1,
    step: 'yearBranch',
    basis: '年解：戌宫起子年逆行（另有月系解神，本引擎不取）',
  },
];

/**
 * 依附于他星的乙级星：起宫不是固定地支，而是另一颗星所落之宫。
 * `anchor` 是所依附之星的 key。
 */
export const ZIWEI_ANCHORED_B_STARS = [
  {
    key: 'santai',
    cn: '三台',
    anchor: 'zuofu',
    dir: 1,
    step: 'dayFrom1',
    basis: '左辅宫起初一顺行至生日',
  },
  {
    key: 'bazuo',
    cn: '八座',
    anchor: 'youbi',
    dir: -1,
    step: 'dayFrom1',
    basis: '右弼宫起初一逆行至生日',
  },
  {
    key: 'enguang',
    cn: '恩光',
    anchor: 'wenchang',
    dir: 1,
    step: 'dayFrom2',
    basis: '文昌宫起初一顺行至生日再退一宫',
  },
  {
    key: 'tiangui',
    cn: '天贵',
    anchor: 'wenqu',
    dir: 1,
    step: 'dayFrom2',
    basis: '文曲宫起初一顺行至生日再退一宫',
  },
];

/** 天巫：按生月循环，正月巳、二月申、三月寅、四月亥，四月一轮。 */
export const TIANWU_BY_MONTH = ['巳', '申', '寅', '亥'];

/** 阴煞：按生月循环，正月寅、二月子、三月戌、四月申、五月午、六月辰，六月一轮。 */
export const YINSHA_BY_MONTH = ['寅', '子', '戌', '申', '午', '辰'];

/** 破碎：按年支三合组取。子午卯酉在巳，寅申巳亥在酉，辰戌丑未在丑。 */
export const POSUI_BY_YEAR_GROUP = [
  { branches: ['子', '午', '卯', '酉'], branch: '巳' },
  { branches: ['寅', '申', '巳', '亥'], branch: '酉' },
  { branches: ['辰', '戌', '丑', '未'], branch: '丑' },
];

/**
 * 长生十二神。自五行局所定之长生宫起，阳男阴女顺行、阴男阳女逆行。
 * 阴阳看年干，与大限顺逆同一判据。
 */
export const CHANGSHENG_TWELVE = [
  '长生',
  '沐浴',
  '冠带',
  '临官',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '绝',
  '胎',
  '养',
];

/** 各局长生所在之宫。水二局与土五局同在申。 */
export const CHANGSHENG_START_BY_BUREAU = { 2: '申', 3: '亥', 4: '巳', 5: '申', 6: '寅' };

/** 博士十二神。自禄存所落之宫起，顺逆同长生十二神。 */
export const BOSHI_TWELVE = [
  '博士',
  '力士',
  '青龙',
  '小耗',
  '将军',
  '奏书',
  '飞廉',
  '喜神',
  '病符',
  '大耗',
  '伏兵',
  '官府',
];

/** 岁前十二神。自年支之宫起岁建，一律顺行（不分男女阴阳）。 */
export const SUIQIAN_TWELVE = [
  '岁建',
  '晦气',
  '丧门',
  '贯索',
  '官符',
  '小耗',
  '大耗',
  '龙德',
  '白虎',
  '天德',
  '吊客',
  '病符',
];

/** 将前十二神。自年支三合局之中神宫起将星，一律顺行。 */
export const JIANGQIAN_TWELVE = [
  '将星',
  '攀鞍',
  '岁驿',
  '息神',
  '华盖',
  '劫煞',
  '灾煞',
  '天煞',
  '指背',
  '咸池',
  '月煞',
  '亡神',
];

/** 将星所在：年支三合局的中神（子午卯酉）之宫。 */
export const JIANGXING_BY_YEAR_GROUP = [
  { branches: ['申', '子', '辰'], branch: '子' },
  { branches: ['寅', '午', '戌'], branch: '午' },
  { branches: ['亥', '卯', '未'], branch: '卯' },
  { branches: ['巳', '酉', '丑'], branch: '酉' },
];
