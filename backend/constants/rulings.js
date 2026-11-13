/**
 * 算法口径真源。
 *
 * 命理几乎每一步都有流派分歧：选错不会抛异常，只会安静给出另一门派的盘。
 * 本文件是**全部选定口径的唯一机器可读清单**——代码常量、测试、OpenAPI、
 * SKILL.md 都必须与这里一致；冲突时以本文件 + 实现代码为准，文档只是摘要。
 *
 * 规则：
 * 1. 有分歧的排盘规则必须在这里有一条，并写明「选定 / 另一派会怎样」。
 * 2. 数值阈值（权重、阈值、倍数）在这里给出，实现从这里读，禁止魔法数分叉。
 * 3. 断语层（庙旺、奇门格局命名等）明确标 `implemented: false`，不是漏做。
 * 4. 换派只改本文件 + 对应 service 中读该值的一处，并改 rulings_lock 测试。
 */

/** 贯穿全部能力的边界：结构归引擎，断语归调用方。 */
export const ENGINE_BOUNDARY = {
  key: 'structure-only',
  cn: '结构归引擎，断语归调用方',
  note:
    '盘怎么排（三传、安星、排局、游年）有唯一正确答案；盘怎么解各家分歧大，' +
    '引擎只把原料给全，不下「吉/凶」类断语。',
};

/**
 * 跨术数共用的时间口径。
 * 八字 / 紫微 / 奇门 / 六壬 / 八宅 都吃同一套节气与子时规则。
 */
export const SHARED_RULINGS = {
  /**
   * 与 lateZiDayRollover 并存、不矛盾：八字保留晚子不换日，时家六壬/奇门按子初换日。
   * 两者是不同术数的既定口径，不是同一条规则的两种实现——别为了「统一」把任一边改掉。
   */
  ziChuDayRollover: {
    key: 'zi-chu-day-change',
    cn: '子初换日（时家）',
    note: '23:00–24:00 与次日 0 点同属一个子时，日干支按次日取；夜子仍算当日派会给出不同日课/局。',
    alternative: '夜子归当日',
    source: 'utils/civilDate.js resolveDayForHour',
  },
  lateZiDayRollover: {
    key: 'late-zi-no-day-change',
    cn: '晚子时不换日',
    note: '23:00–00:00 日柱仍属当日，时柱按次日日干起；子正换日派会给出不同日柱。',
    alternative: '子正换日（本引擎无开关）',
    source: 'lunar-javascript EightChar',
  },
  solarTermPrecision: {
    key: 'solar-term-to-minute',
    cn: '节气交节精确到分',
    note: '年月柱、月将、奇门定局、八宅定年都以交节时刻为界，不是按「整天」切。',
    alternative: '只比到日（交节当天会错边）',
  },
  trueSolarTimeDefault: {
    key: 'true-solar-time-when-location',
    cn: '给齐出生地与时区时默认用真太阳时排盘',
    note: '传 trueSolarTime: false 可退回钟表时间；无地点或无时区则不校正且不报错。',
    alternative: '一律钟表时间',
  },
};

/** 八字：藏干加权 / 月令 / 旺衰 / 用神。 */
export const BAZI_RULINGS = {
  module: 'bazi',
  cn: '八字',
  sharedKeys: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
  hiddenStemWeights: {
    key: 'normalized-0.6-0.3-0.1',
    cn: '藏干权重本气0.6/中气0.3/余气0.1，逐支归一到1',
    primary: 0.6,
    middle: 0.3,
    residual: 0.1,
    dualPrimary: 0.7,
    dualMiddle: 0.3,
    singlePrimary: 1.0,
    note: '另有 100:70:30 不归一等派；切换只改 constants/ganzhi.js 的 HIDDEN_STEMS。',
    alternative: '100:70:30 不归一',
  },
  monthBranchMultiplier: {
    key: 'month-branch-x2',
    cn: '月令当权：仅月支藏干 ×2',
    value: 2,
    note: '月干不加倍。加倍后四柱加权总分恒为 9。',
    alternative: '月支不加倍（旺衰线整体挪动）',
  },
  strengthThresholds: {
    key: 'ally-ratio-55-45',
    cn: '同党占比 >55% 身强、<45% 身弱、其间中和',
    strongAbove: 0.55,
    weakBelow: 0.45,
    allyDefinition: '比劫+印（同我、生我）',
    alternative: '得令通根为主、不看占比阈值',
  },
  usefulGod: {
    key: 'fuyi-only',
    cn: 'usefulGod 字段取扶抑法',
    note: '身强用克泄耗，身弱用生扶；中和局 favorable 给空数组，主答案看并列的 tiaohou 字段。',
    alternative: '病药 / 通关（未实现）',
    implemented: true,
    notImplemented: ['bingyao', 'tongguan'],
  },
  tiaohou: {
    key: 'qiongtong-quick-table',
    cn: '调候用神取《穷通宝鉴》通行速查表，与扶抑并列给出',
    note:
      '首位主用、其余辅用，并标该干是否已透于四柱天干或藏于四支。' +
      '各刊本互有出入，换所宗版本只改 constants/geju.js 的 TIAOHOU 表，取用规则不动。',
    alternative: '以扶抑为唯一主线，或按别本调候表',
    implemented: true,
  },
  monthlyStructure: {
    key: 'ziping-yueling',
    cn: '取格从月令，《子平真诠》一派',
    note:
      '本气透干则以透干论，不透取中气余气之透者，皆不透以本气论；「透」只算年月时三干。' +
      '建禄羊刃先于透干规则判（月令即我，无可透之神）。facts 一节是无分歧的结构事实。',
    alternative: '以强弱定格、以格局用神反推等派 —— 可照 facts 自行重推',
    implemented: true,
  },
  specialPattern: {
    key: 'rootless-follow-and-commanded-dominant',
    cn: '从格看「四支全无同党通根且同党占比 <20%」，专旺格看「月令本气即日主且同党占比 ≥80%」',
    followWeakBelow: 0.2,
    dominantAtLeast: 0.8,
    note:
      '两条都取硬判据，不取「差不多」：无根是从格的硬条件 —— 有一点根就不是从格，' +
      '而是身弱用印，两者用神**恰好相反**。<20% 这条阈值等价于「天干也不见印比」' +
      '（日主自身即占 1/9≈11.1%，再透一个印比就到 22.2%），即只认真从、不认假从。' +
      '专旺同理要求得令，只得地不算。facts 一节是无分歧的结构事实，换派照它自行重推。',
    alternative: '真从/假从分立、从势格、见印比即破格等更细的分派',
    implemented: true,
  },
  mingGongMonth: {
    key: 'jieqi-month',
    cn: '命宫身宫的月支取节气月（月柱月支），不按中气分月',
    note: '与紫微命宫、现代主流网盘一致；《三命通会》一系「过中气作下月」是另一派。',
    alternative: '过中气作下月（三命通会）',
  },
  shenshaYangren: {
    key: 'yangren-yang-stems-only',
    cn: '羊刃只对阳干判定（神煞与格局同此一条）',
    note:
      '《子平真诠》「禄前一位，惟五阳有之，故为阳刃」。阴干羊刃各家不一，本模块不予判定。' +
      '格局层同守此条：阴干月令见劫财判**月劫格**，不判羊刃格 —— ' +
      '此前格局层对阴干也判羊刃，与本条及 shensha.js 的 YANGREN（只列五阳干）自相矛盾。',
    alternative: '阴干亦立刃（乙刃在寅或在辰，各家不一）',
  },
};

/** 紫微斗数。 */
export const ZIWEI_RULINGS = {
  module: 'ziwei',
  cn: '紫微斗数',
  sharedKeys: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
  leapMonth: {
    key: 'leap-to-base-month',
    cn: '闰月归本月',
    note: 'lunar-javascript 负数月取绝对值；闰二月与二月同月支、同命身宫。',
    alternative: '闰月后半月归下月',
  },
  fiveElementBureau: {
    key: 'ming-nayin-bureau',
    cn: '命宫干支纳音定五行局',
    note: '水二木三金四土五火六；是安星链的根。',
  },
  palaceOrder: {
    key: 'counter-clockwise-from-ming',
    cn: '十二宫自命宫起逆布：兄弟在命宫前一位、父母在命宫后一位',
    note:
      '判据与 majorPeriod 同一条 —— 阳男阴女大限顺行（地支下标递增），第二大限走父母宫；' +
      '阴男阳女逆行，第二大限走兄弟宫。两条必须同时成立，故宫序只能逆布。' +
      '顺布会让除命宫、迁移宫外的十宫两两互换（兄弟↔父母、夫妻↔福德、子女↔田宅、' +
      '财帛↔官禄、疾厄↔仆役），星曜落宫仍是对的，错的只有宫名那一层 —— 不报错，只错断。',
    alternative: '无 —— 顺布与大限口径直接冲突',
    implemented: true,
  },
  majorPeriod: {
    key: 'yang-male-forward',
    cn: '大限阳男阴女顺行、阴男阳女逆行',
    note: '阴阳看年干；起限岁数=五行局数（虚岁）。第二大限阳男阴女走父母宫、阴男阳女走兄弟宫。',
  },
  sihua: {
    key: 'year-stem-sihua',
    cn: '本命四化取年干',
  },
  sihuaVariants: {
    key: 'quanji-line-geng-yang-wu-yin-tong',
    cn: '取《全集》一系：戊科右弼、壬科左辅、庚取「阳武阴同」',
    note:
      '左辅右弼化科与否是分派的分水岭：本模块从《全集》一系（左辅右弼入四化），' +
      '故戊科右弼与壬科左辅成对，不可一半一派。庚干分歧最大 —— ' +
      '「阳武阴同」（陆斌兆所传，也是当前最通行、多数排盘软件所用）、' +
      '「阳武府同」（中州派王亭之，该派左辅右弼一律不化科，戊科改取太阳）、' +
      '「阳武同相」（天同化科、天相化忌）三说并存，本模块取通行的「阳武阴同」。' +
      '壬干化忌**恒为武曲**，没有任何一派取破军；化科从不取天机（天机化科属丁干）——' +
      '此前那两格是硬错，不是流派选择。表在 constants/ziwei.js 的 ZIWEI_SIHUA_BY_STEM。',
    alternative: '中州派（左辅右弼不化科：戊科太阳、庚科天府）/ 北派河洛（庚科天同、天相化忌）',
    implemented: true,
  },
  palaceSihua: {
    key: 'palace-stem-sihua-fly',
    cn: '宫干四化：每宫以本宫天干起四化，落到星所在之宫',
    note:
      '化落本宫为自化，落他宫为飞化（本宫飞化入彼宫）。星未上盘者 toPalaceIndex 为 null。' +
      '大限四化取该大限所在宫的宫干，与本命四化（年干）、流年四化（流年干）三层各起各的。',
    alternative: '只论本命与流年四化，不论宫干飞化（河洛派/三合派的分野）',
    implemented: true,
  },
  brightness: {
    key: 'not-implemented',
    cn: '庙旺利陷不实现',
    implemented: false,
    note: '属断语层，各家表不同；需要由调用方叠加。',
  },
  jieshen: {
    key: 'year-jieshen-only',
    cn: '解神只取年解（戌宫起子年逆行）',
    note: '表在 constants/ziwei.js 的 ZIWEI_MINOR_B_STARS。',
    alternative: '另有月系解神，落宫不同；需要由调用方叠加',
  },
  godsDirection: {
    key: 'changsheng-boshi-by-yin-yang',
    cn: '长生十二神、博士十二神按年干阴阳分男女顺逆；岁前、将前一律顺行',
    note: '顺逆判据与大限同一条（yang-male-forward）。',
    alternative: '四组混用同一套顺逆会让后两组整体错位',
  },
};

/** 六爻纳甲。 */
export const LIUYAO_RULINGS = {
  module: 'liuyao',
  cn: '六爻纳甲',
  /**
   * 起卦日干支按**子初换日**（23 点起入次日），与六壬奇门同属时家口径 —— 路由一直这么做，
   * 此前这里却挂着八字的「晚子不换日」，school 字段与盘面自相矛盾。
   */
  sharedKeys: ['ziChuDayRollover', 'solarTermPrecision'],
  role: {
    key: 'assemble-not-cast',
    cn: '装卦不是起卦',
    note: '六爻由调用方给定（lines），引擎只负责纳甲装卦。',
  },
  palaceDerivation: {
    key: 'seven-rule-derivation',
    cn: '八宫由七条推衍规则算出，不查 64 行表',
  },
  changedLineSixRelative: {
    key: 'ben-gong-as-self',
    cn: '变爻六亲仍以本卦之宫为我',
    note: '不按之卦宫重排——纳甲筮法定例。',
    alternative: '按之卦宫重排六亲',
  },
  najia: {
    key: 'jingfang-najia',
    cn: '京房纳甲',
  },
  advanceRetreat: {
    key: 'eight-fixed-pairs',
    cn: '进退神按八组固定支对判，不由「同五行下一位」推导',
    note:
      '亥→子、寅→卯、巳→午、申→酉、丑→辰、辰→未、未→戌、戌→丑为进，反向为退。' +
      '水只有两支、土有四支，按「同五行下一位」推导会把水支组两个方向都判成进神。',
  },
  trigramShift: {
    key: 'requires-moving-line',
    cn: '内外卦伏吟返吟只在该卦有爻在动时判',
    note: '静卦的三支必然与自己相同 —— 那不是伏吟，那是它没动。',
  },
  seasonalState: {
    key: 'month-branch-wang-xiang',
    cn: '爻的旺相休囚死只按月建（月令）判，不按日辰',
    note:
      '月建管一月之权，四时旺衰是它的事；日辰管一日之令，作用是生克冲合，不另立旺衰档。' +
      '两者混判会让同一爻出现两个互相矛盾的旺衰。与奇门共用 getSeasonalState。',
    alternative: '另有把日辰也折成旺衰档、或按十二长生取旺衰的派',
    implemented: true,
  },
};

/** 大六壬。 */
export const LIUREN_RULINGS = {
  module: 'liuren',
  cn: '大六壬',
  sharedKeys: ['solarTermPrecision', 'ziChuDayRollover'],
  monthGeneral: {
    key: 'mid-qi-change',
    cn: '月将取月建六合，以中气换将',
    note: '正月建寅→亥将登明；雨水后换亥将。用节换将会差近半月。',
    alternative: '以节换将',
  },
  shehai: {
    key: 'clockwise-home-tally-by-type',
    cn: '涉害顺行归家；下贼上数受克、上克下数所克',
    note:
      '《六壬大全》：「涉害行来本家止，路逢多克为用取。孟深仲浅季当休，复等柔辰刚日宜。」' +
      '自天盘支所乘的地盘位顺行至本家（行来本家止），沿途计克（路逢多克为用取）；' +
      '深浅相等先取临四孟地盘位者（见机）、次取临四仲者（察微）—— 看的是所临之位不是候选支自身；' +
      '孟仲皆不能决即「复等」，' +
      '刚日（阳日）取干上神、柔日（阴日）取支上神，课体报**复等课**，不再挂见机/察微之名。' +
      '只数所历地盘之支，不另计寄宫之干 —— 原文未及，故不擅补。',
    alternative: '直取孟仲季（不归家）/ 兼计所历宫位寄宫天干',
    direction: 'clockwise',
  },
  maoxing: {
    key: 'yang-looks-up-yin-looks-down',
    cn: '昴星阳仰阴俯：阳日取地盘酉上之天盘神，阴日取天盘酉所压之地盘支',
    note:
      '《六壬大全》：「无遥无克昴星穷，阳仰阴俯酉位中。刚日先辰而后日，柔日先日而后辰。」' +
      '阳日虎视转蓬（中传支上神、末传干上神），阴日冬蛇掩目（中传干上神、末传支上神）。',
    alternative: '两向取反的一派，初传完全不同',
    implemented: true,
  },
  noble: {
    key: 'geng-with-jia-wu',
    cn: '天乙贵人「庚」归甲戊庚一组（昼丑夜未），辛独取午寅',
    note: '口诀里庚在首末两句都出现，是这张表唯一的分歧处；与紫微魁钺表取同一派。',
    alternative: '「庚辛逢虎马」派：庚归午寅',
  },
  transmissionOrder: {
    key: 'nine-gates-order',
    cn: '取传次第：贼克→比用→涉害→八专→遥克→别责/昴星',
    note: '八专不取遥克，故必须在遥克之前；伏吟/返吟先行。',
  },
  fuyin: {
    key: 'fuyin-ziren-zixin',
    cn: '伏吟有克依贼克，无克阳日自任（干上神）、阴日自信（支上神）',
    note:
      '天地盘重合时二三四课上下同支必无克，一课是日干对寄宫支：乙木克辰土、丑土克癸水，' +
      '故乙癸两日伏吟有克，依贼克取初传。中末传递取其刑；自刑则颠倒日辰改取另一上神，' +
      '中传再自刑则末传取冲。',
    alternative: '无 —— 《六壬大全》「伏吟有克还为用，无克刚干柔取辰」各家一致',
  },
  firstCourse: {
    key: 'first-course-day-stem',
    cn: '第一课以日干为下神，寄宫只用于取上神；判克以日干五行论',
    note:
      '干阳课是「日干与干上神」：乙日干上神未，乙木克未土为下贼上；寄宫辰只是乙在地盘上的落脚处。' +
      '乙丁戊辛癸五干寄宫五行与本干不同，此前按寄宫地支五行判克，这五种日干的第一课克应整层错。' +
      '外部例课（丁丑日子时申将）：正解元首课初传巳，旧算法排成涉害课初传卯。',
    alternative: '无 —— 四课以日干为下各家一致，寄宫从不参与判克',
    implemented: true,
  },
  transmissionRelative: {
    key: 'day-stem-as-self',
    cn: '三传与四课上神的六亲以日干为我',
    note: '六爻以本宫五行为我（见 liuyao 的 ben-gong-as-self），两者判据不同，不要互相代入。',
    alternative: '无 —— 此条是为与六爻对照而立',
  },
};

/** 奇门遁甲。 */
export const QIMEN_RULINGS = {
  module: 'qimen',
  cn: '奇门遁甲',
  sharedKeys: ['solarTermPrecision', 'ziChuDayRollover'],
  bureau: {
    key: 'chaibu',
    cn: '拆补法定局：自占日向前取最近的甲己符头，按符头地支定上中下元，不置闰',
    note:
      '子午卯酉为上元符头、寅申巳亥为中元、辰戌丑未为下元。' +
      '**一个节气内三元出现非「上→中→下」的次序是拆补法的正常形态，不是错**：' +
      '符头十五日一周而交节日逐年漂移，两者对不齐 —— 交节后头一段那个元不足五日叫「拆」，' +
      '本节气末尾余下的两三日补回被拆掉的那一元叫「补」，实际排出「残中—下—上—补中」' +
      '一类形态。古籍例证：夏至节内先用三天多中元阴三局、再五天下元阴六局、' +
      '再五天上元阴九局、最后补用中元阴三局两天多，与本表夏至 [9,3,6] 一致。' +
      '按距交节日数定元既不是拆补也不是置闰，曾据「次序错乱」误改过一次，已改回。',
    alternative: '置闰法（同样用符头定元，但把符头配到它所领起的节气，超神满九日置闰局）/ 茅山法',
    implemented: true,
  },
  plate: {
    key: 'zhuanpan',
    cn: '转盘法排天盘九星八门八神',
    alternative: '飞盘法',
  },
  centerPalace: {
    key: 'center-lodge-kun',
    cn: '中五宫寄坤二；八门八神不入中宫',
    note:
      '天禽寄坤二随天芮。旬首遁仪落中五宫时**值符星为天禽**（寄坤二行事），不是坤二的天芮 ——' +
      '值符星取的是遁仪本宫之星，寄宫只影响它在哪一格行事。',
  },
  zhishiFlight: {
    key: 'zhishi-luoshu-order',
    cn: '值使门自值符宫按九宫数序阳顺阴逆飞到时辰旬序，落中五寄坤二',
    note:
      '「值使顺逆遁宫去」：甲子时在值符宫，之后按一二三四五六七八九（阳遁）或九八七六五四三二一（阴遁）' +
      '逐时辰一宫；旬首遁仪落中五则自五起数。九星随值符在八宫环上转（转盘法），值使门却是按宫数飞的，' +
      '两者不是同一条规则。此前把值使也放到八宫环上转，阳遁一局乙丑时落艮八而非坤二，' +
      '一旬十个时辰只有甲子、丙寅两个巧合相同。八门整体随值使门在八宫环上转这一步不变。',
    alternative: '无 —— 转盘派通行教材值使按九宫数序飞、中五寄坤二，各家一致',
    implemented: true,
  },
  eightGods: {
    key: 'modern-baihu-xuanwu',
    cn: '八神第五第六位取白虎、玄武（现代通行简化派）',
    note: '古法阳遁用勾陈、朱雀，阴遁才用白虎、玄武；顺逆布的算法两派相同，只有名目不同。',
    alternative: '古法：阳遁勾陈、朱雀',
  },
  stemTomb: {
    key: 'wuxing-tomb-treasury',
    cn: '十干入墓按五行墓库：木墓坤二、火土墓乾六、金墓艮八、水墓巽四',
    note: '表在 constants/qimen.js 的 STEM_TOMB_PALACE，换派只改那张表。',
    alternative: '阴干各自逆行取墓（如乙墓戌），落宫不同',
  },
  gatePo: {
    key: 'gate-controls-palace',
    cn: '门迫＝门克宫；反向的宫克门为门制（isGateZhi）',
    note:
      '逐门核对的门迫清单：伤门/杜门（木）落艮八、坤二（土）；开门/惊门（金）落震三、巽四（木）；' +
      '休门（水）落离九（火）；景门（火）落乾六、兑七（金）；生门/死门（土）落坎一（水）。' +
      '此前取的是反向，并把「开门落离九宫」当经典例证 —— 开门属金、离九属火，' +
      '那是宫克门即门制，不是门迫。',
    alternative: '无 —— 八门门迫清单各家一致，方向不是流派问题',
    implemented: true,
  },
  seasonalState: {
    key: 'month-branch-wang-xiang',
    cn: '八门九星的旺相休囚死按月令（节气月支）五行判',
    note:
      '与月令同类者旺、月令所生者相、生月令者休、克月令者囚、月令所克者死。' +
      '判据无流派分歧，与六爻共用 ganzhi.service 的 getSeasonalState。',
    alternative: '按节气三候细分旺相，或按四立前十八日归土旺',
    implemented: true,
  },
  patterns: {
    key: 'not-implemented',
    cn: '格局命名不实现',
    implemented: false,
    note:
      '青龙返首、飞鸟跌穴等属断语层。但格局所依据的关系量（门迫、入墓、击刑、旬空、' +
      '驿马、干支与星门宫的生克）一律给出 —— 那些是客观事实，不是吉凶判断。',
  },
};

/** 八宅。 */
export const BAZHAI_RULINGS = {
  module: 'bazhai',
  cn: '八宅',
  /** 本模块吃共用时间口径的哪些键（避免无关 shared 噪音）。 */
  sharedKeys: ['solarTermPrecision'],
  lifeTrigramYear: {
    key: 'lichun-year',
    cn: '八宅定年以立春为界',
    alternative: '以元旦为界',
  },
  younian: {
    key: 'flip-sequence',
    cn: '游年由变爻序列推出，不查 8×8 表',
    sequence: [3, 2, 1, 2, 3, 2, 1, 2],
  },
  houseTrigram: {
    key: 'sitting-mountain-trigram',
    cn: '宅卦由坐山归卦，二十四山（各15°）归到八卦（各45°）',
    note:
      '坐山收卦名 / 二十四山 / 方位名 /「子山午向」四种写法；认不出标 unresolved 不猜。' +
      '兼向（骑两山交界）不在八宅讨论范围 —— 那是玄空的事。',
    alternative: '以门定宅、以高大方定宅等派',
  },
};

/** 择吉历注。 */
export const ALMANAC_RULINGS = {
  module: 'almanac',
  cn: '择吉',
  /** 历注按日给出、无时刻可比，故不挂「交节精确到分」——那一条对择吉名不副实。 */
  sharedKeys: [],
  dayGranularity: {
    key: 'lichun-day-inclusive',
    cn: '历注按日：立春当日整日归新年，年柱与方位煞同一判法',
    note:
      '择吉输入只有年月日，交节时刻无从比较。年柱（getYearInGanZhiByLiChun）与方位煞的立春年' +
      '都按「立春当日即新年」判，同一响应里不会出现太岁按新年、紫白按旧年的两套年。' +
      '要到分的立春判定用八宅（给 birthHour）或八字。',
    alternative: '按交节时刻：立春当天交节前的时刻仍属旧年（需要时刻输入，择吉没有）',
    implemented: true,
  },
  almanacSource: {
    key: 'lunar-javascript-almanac',
    cn: '历注（论日/论时两层）委托 lunar-javascript，本引擎只组结构',
    note: '建除、值宿、宜忌、吉神凶煞、彭祖等不自造表；论方那一层是本引擎自算的，见下两条。',
  },
  directionsYear: {
    key: 'lichun-year-directions',
    cn: '方位煞（太岁、岁破、三煞、紫白）以立春为界，与年柱同界',
    note: '正月初一到立春之间，方位煞仍属上一年。',
    alternative: '春节换年（立春～春节窗口会给出上一年的方位煞）',
  },
  nineStar: {
    key: 'computed-center-star',
    cn: '流年紫白入中星按公式算，不查表',
    note:
      '下元自 1984 甲子七赤入中起逐年退一：7 − ((年 − 1984) mod 9)。' +
      '手抄的流年紫白表极易整体错位一年，且错了不报错。',
    alternative: '查表（对标的一个公开项目整表错位一年）',
  },
};

/** 姓名五格。 */
export const NAME_RULINGS = {
  module: 'name',
  cn: '姓名五格',
  sharedKeys: [],
  nameStrokes: {
    key: 'caller-provides-strokes',
    cn: '笔画由调用方提供',
    note: '引擎不内置康熙/简体字典。',
  },
  nameGrids: {
    key: 'wuge-standard',
    cn: '单姓天格+1、单名地格+1、人格取姓末+名首，外格=天+地−人',
    note:
      '复姓天格取两字之和（不加一）、双名地格取两字之和（不加一）；总格为全部笔画之和；' +
      '外格 = 天格 + 地格 − 人格（单姓单名恒为 2，单姓双名 = 名末+1，复姓单名 = 姓首+1，复姓双名 = 姓首+名末）。',
    alternative: '旧式外格 total − human + 1（单姓单名与复姓双名会偏一档）',
  },
};

/** 周易（梅花易数起卦）。 */
export const ICHING_RULINGS = {
  module: 'iching',
  cn: '周易起卦',
  sharedKeys: ['lateZiDayRollover'],
  method: {
    key: 'meihua',
    cn: '梅花易数',
    note: '先天数乾1兑2离3震4巽5坎6艮7坤8。',
  },
  timeCast: {
    key: 'year-zhi-lunar-month-day-hour-zhi',
    cn: '时间起卦用年支序数+农历月日+时支序数',
    note:
      '分钟不入卦；动爻唯一（年支数+农历月+农历日+时支数之和除六）。' +
      '年支以**农历正月初一**为界（取 lunar 年支），立春后春节前仍用旧年支。',
    alternative: '公历年整数入卦 / 取分入卡（错误旧实现）/ 年支以立春为界',
  },
  numberCast: {
    key: 'first-upper-second-lower-sum-mod6',
    cn: '三数起卦：一数除八取上卦、二数除八取下卦、三数之和除六取动爻',
    note: '余零取满数（8 或 6）。输入须为正整数。',
    alternative: '第三数单独除六取动爻',
    implemented: true,
  },
  leapMonth: {
    key: 'leap-to-base-month',
    cn: '闰月归本月（与紫微同）',
  },
  scripture: {
    key: 'wikisource-zh-hans',
    cn: '卦辞、爻辞、大象传照录维基文库《周易》，取其 zh-hans 简体转换',
    note:
      '经文是**原始文献**，与择吉照录通书条目同一性质 —— 属于引擎该给的原料，不是断语。' +
      '由 scripts/fetch-zhouyi.mjs 抓取生成 data/zhouyiText.js，可重跑复现；' +
      '不凭记忆录入 —— 384 条爻辞靠印象写，错了不会报错。' +
      '乾有用九、坤有用六，故爻辞共 386 条。' +
      '「这一爻对你这件事意味着什么」仍不给。',
    alternative: '换底本（如通行本、帛书本、竹简本）只改抓取脚本的页名与解析规则',
    implemented: true,
  },
};

/** 合盘。 */
export const SYNASTRY_RULINGS = {
  module: 'synastry',
  cn: '合盘',
  sharedKeys: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
  focus: {
    key: 'spouse-palace-ganzhi',
    cn: '以日支（夫妻宫）干支关系为主，非五行粗比',
  },
  score: {
    key: 'weighted-relations',
    cn: 'score 由客观关系加权折算，不是断语',
    note: '权重见 synastry.service WEIGHTS；insights 只陈述关系事实。',
  },
};

/** 塔罗。 */
export const TAROT_RULINGS = {
  module: 'tarot',
  cn: '塔罗',
  sharedKeys: [],
  randomness: {
    key: 'not-reproducible',
    cn: '默认抽牌随机、不可复现（给了 seed 才确定，见下条）',
    note:
      '不给 seed 时走 Math.random，不得作幂等重试或回归基准。' +
      '给 seed 后同一 seed + 同一牌阵必得同一副牌与同一组正逆，可用于回归比对。',
  },
  seed: {
    key: 'fnv1a-mulberry32',
    cn: 'seed 用 FNV-1a 哈希成 32 位整数后喂 mulberry32',
    note:
      '算法钉死在实现里，不随 Node 版本或平台变 —— 否则「可复现」只在一台机器上成立。' +
      'seed 收字符串或整数，回显在响应的 seed 字段；洗牌与正逆共用同一条随机流，' +
      '故牌阵张数不同的两次抽牌即使同 seed 也不共享前几张。',
    implemented: true,
  },
  reversalRate: {
    key: 'reversal-0.5',
    cn: '默认逆位概率 0.5（正逆等权）',
    value: 0.5,
    note: '可传 reversalRate 覆盖；0.3 旧默认无出处已废。',
  },
  spreads: {
    key: 'named-spreads-with-aliases',
    cn: '牌阵：SingleCard / ThreeCard / CelticCross，别名归一后回显真实名',
    note:
      '未知牌阵回退 SingleCard，并在响应里标 fallback，避免静默当成三张阵。' +
      '位置的 label 是机器契约（英文枚举），labelCn / meaningCn 是给人看的中文。',
  },
  cardMetadata: {
    key: 'derived-from-card-name',
    cn: '大小阿卡纳、花色、序位、花色元素由 id 与牌名推出，不逐张手写',
    note:
      '大小之别以 id 为准（0–21 为大阿卡纳）—— 靠 `X of Y` 的正则会把命运之轮判成小牌；' +
      '花色与序位再从小阿卡纳牌名解析，解析不出直接抛错，不发出没有花色的牌。' +
      '花色元素按韦特系：权杖火、圣杯水、宝剑风、星币土。',
    implemented: true,
  },
};

/** 西洋星座资料 / 运势。 */
export const ZODIAC_RULINGS = {
  module: 'zodiac',
  cn: '西洋星座',
  sharedKeys: [],
  content: {
    key: 'static-sign-content',
    cn: '星座基础信息为静态内容表，非精密推运',
  },
  horoscope: {
    key: 'engine-local-date-window',
    cn: '运势区间按引擎本地「今天」切日/周/月，跨天可变',
    note: '带 horoscope 时不可当 deterministic 回归基准。',
  },
};

/** 上升星座。 */
export const RISING_RULINGS = {
  module: 'rising',
  cn: '上升星座',
  sharedKeys: [],
  model: {
    key: 'simplified-gmst-obliquity',
    cn: '简化 GMST + 黄赤交角模型，非 Swiss Ephemeris 级星历',
    note: '结果可复现，但与专业星历软件可能有分位差；勿逐分强比对。',
  },
  input: {
    key: 'lat-lon-tz-required',
    cn: '必须给出生时刻、经纬度、时区偏移',
  },
};

/** 流日。 */
export const DAILY_RULINGS = {
  module: 'daily',
  cn: '流日',
  sharedKeys: ['lateZiDayRollover'],
  dateSource: {
    key: 'engine-today-only',
    cn: '日柱恒取引擎当日，无日期参数',
    note: 'not-reproducible；要可复现历注用 almanac --date。',
  },
  personalization: {
    key: 'optional-birth-ganzhi-score',
    cn: '给全出生信息则结合本命干支关系计分，否则只回日柱',
  },
};

/** 全部模块口径索引，便于枚举与测试。一能力一键，不混装。 */
export const ALL_MODULE_RULINGS = {
  bazi: BAZI_RULINGS,
  ziwei: ZIWEI_RULINGS,
  liuyao: LIUYAO_RULINGS,
  liuren: LIUREN_RULINGS,
  qimen: QIMEN_RULINGS,
  bazhai: BAZHAI_RULINGS,
  almanac: ALMANAC_RULINGS,
  name: NAME_RULINGS,
  iching: ICHING_RULINGS,
  synastry: SYNASTRY_RULINGS,
  tarot: TAROT_RULINGS,
  zodiac: ZODIAC_RULINGS,
  rising: RISING_RULINGS,
  daily: DAILY_RULINGS,
};

/** 所有对外计算能力都应在响应里带 school 的模块键。 */
export const CAPABILITY_SCHOOL_MODULES = Object.keys(ALL_MODULE_RULINGS);

/** 口径包上的元字段，不进 school.rulings。 */
const PACK_META = new Set(['module', 'cn', 'sharedKeys']);

const SHARED_KEY_MAP = {
  lateZiDayRollover: 'lateZi',
  ziChuDayRollover: 'ziChu',
  solarTermPrecision: 'solarTerm',
  trueSolarTimeDefault: 'trueSolarTime',
};

/**
 * 给排盘响应挂上的精简 school 字段。
 * 只带本能力相关的 shared + rulings，不把无关共用口径塞给塔罗/姓名等。
 */
export const schoolPayload = (moduleKey) => {
  const mod = ALL_MODULE_RULINGS[moduleKey];
  if (!mod) return null;

  const rulings = {};
  Object.entries(mod).forEach(([name, entry]) => {
    if (PACK_META.has(name) || !entry || typeof entry !== 'object' || !entry.key) return;
    rulings[name] = {
      key: entry.key,
      cn: entry.cn,
      ...(entry.implemented === false ? { implemented: false } : {}),
      ...(entry.value !== undefined ? { value: entry.value } : {}),
      ...(entry.strongAbove !== undefined
        ? { strongAbove: entry.strongAbove, weakBelow: entry.weakBelow }
        : {}),
      ...(entry.primary !== undefined
        ? { primary: entry.primary, middle: entry.middle, residual: entry.residual }
        : {}),
      ...(entry.direction ? { direction: entry.direction } : {}),
    };
  });

  const shared = {};
  (mod.sharedKeys || []).forEach((sk) => {
    const short = SHARED_KEY_MAP[sk];
    if (short && SHARED_RULINGS[sk]) shared[short] = SHARED_RULINGS[sk].key;
  });

  return {
    module: mod.module,
    cn: mod.cn,
    boundary: ENGINE_BOUNDARY.key,
    ...(Object.keys(shared).length ? { shared } : {}),
    rulings,
  };
};

/** 给任意排盘结果挂上 school 字段（null 原样返回）。 */
export const withSchool = (moduleKey, result) => {
  if (result == null) return result;
  const school = schoolPayload(moduleKey);
  if (!school) return result;
  return { ...result, school };
};
