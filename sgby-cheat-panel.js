/* ============================================================
   三国霸业 · 金手指面板  v2.0
   适配版本：2026-09-30 线上版（装备池 29 件 / 主公类型 4 种 / 仓库容量上限）
   用法：打开游戏页面 → Cmd+Option+J → 整段粘贴 → 回车
   所有改动都会按游戏内的预设上限做钳制，不破坏平衡
   ============================================================ */
(function () {
  'use strict';

  if (typeof gameData === 'undefined') {
    console.error('[金手指] 没找到 gameData。请确认：1) 当前在游戏页面上执行；2) Console 左上角的上下文选的是页面主域，不是某个 iframe。');
    return;
  }

  var old = document.getElementById('sgbyCheatPanel');
  if (old) old.remove();

  /* ============ 游戏内预设上限（与源码一致） ============ */
  var CAPS = {
    building: 5,        // BUILDING_CONFIG[*].maxLevel
    tech: 5,            // TECH_DEFS[*].max
    warehouse: 5,       // WAREHOUSE_LEVELS 最高 5 级
    gov: 5,             // MAX_GOV 官府城数量
    militaryOrder: 10   // maxMilitaryOrder 固定 10
  };
  var WAREHOUSE_CAPS = { 1: 600000, 2: 1200000, 3: 2500000, 4: 5000000, 5: 10000000 };
  var MAT_KEYS = ['food', 'stone', 'iron', 'wood'];

  /* ============ 主公类型（LORD_TYPES） ============ */
  var LORD_TYPES = [
    { key: 'yongwu', name: '勇武', desc: '武力偏向，升级时攻击成长最高；威仪：全军攻击 +8%' },
    { key: 'tongyu', name: '统御', desc: '统御偏向，升级时防御成长最高；威仪：全军攻击 +10%' },
    { key: 'zhili', name: '智力', desc: '智力偏向，技能触发率更高；威仪：技能触发 +15%' },
    { key: 'zhengzhi', name: '政治', desc: '政治偏向，升级时带兵更多；威仪：资源产量 +20%' }
  ];

  /* ============ 升级成长（与游戏源码一致）============
     游戏升级时：普通武将 hp+20 / atk+3 / def+1 / speed+1；
     主公再叠加类型成长（勇武 atk+5、统御 def+4、智力 atk+3、政治 hp+3…）。
     g.atk/def 是「累加出来的」，所以只改等级不补成长 → 攻击力还停在初始值。
     这里按 基础值 + (等级-1)×成长 重算，修掉这个坑。 */
  var LORD_GROWTH = {
    yongwu: { hp: 1, atk: 5, def: 1, speed: 1 },
    tongyu: { hp: 2, atk: 2, def: 4, speed: 1 },
    zhili: { hp: 1, atk: 3, def: 2, speed: 2 },
    zhengzhi: { hp: 3, atk: 1, def: 2, speed: 1 }
  };

  /* 武将初始属性（取自游戏池全部 59 名）格式：名称|兵力|攻|防|速 */
  var GEN_BASE_RAW = [
    '小兵甲|60|8|4|6', '小兵乙|65|9|4|6', '山贼头目|80|12|5|7', '黄巾力士|90|11|6|5', '义勇军|70|10|5|8',
    '猎户|65|13|4|10', '农夫|55|7|3|5', '铁匠|75|9|7|4', '书生|50|8|3|9', '猎人|68|12|4|11',
    '山贼|72|11|5|7', '逃兵|60|9|4|8', '衙役|70|10|6|6', '镖师|80|13|6|8', '船夫|65|8|4|9',
    '樵夫|75|11|5|6', '渔夫|60|9|4|7', '屠夫|85|12|6|5', '郎中|55|6|3|8', '说书人|50|7|3|9',
    '舞姬|45|6|2|12', '家丁|70|10|5|6', '门客|65|11|4|8', '驿卒|60|8|4|11', '屯田兵|80|10|6|5',
    '弓箭手|60|14|4|10', '刀盾兵|85|10|8|5', '枪兵|75|12|5|7', '骑兵|80|14|5|12', '鼓手|65|7|4|8',
    '周仓|80|14|7|9', '张角|85|21|6|10', '袁绍|90|14|8|8', '董卓|130|18|12|6', '大乔|70|10|5|12',
    '程普|80|15|6|10', '魏延|100|19|9|10', '黄忠|90|22|7|9', '姜维|95|18|9|11', '夏侯惇|105|18|10|9',
    '孙权|95|16|10|10', '甘宁|95|20|8|14', '太史慈|92|19|8|13', '许褚|130|17|13|6', '典韦|120|19|10|8',
    '吕蒙|95|18|9|11', '陆逊|88|20|7|12', '赵云|105|20|10|14', '马超|110|23|8|16', '庞统|85|24|6|12',
    '张辽|100|21|9|13', '周瑜|90|23|7|13', '貂蝉|75|15|5|16', '关羽|120|25|12|12', '张飞|130|28|8|8',
    '诸葛亮|80|30|5|15', '曹操|115|20|11|12', '吕布|140|32|9|11', '司马懿|90|22|8|11',
    '主公|100|15|8|10'
  ];
  var GEN_BASE = {};
  GEN_BASE_RAW.forEach(function (r) {
    var p = r.split('|');
    GEN_BASE[p[0]] = { hp: +p[1], atk: +p[2], def: +p[3], speed: +p[4] };
  });

  /* 按等级重算某个武将的属性（保持不变则跳过成长） */
  function recalcStats(g, level, mult) {
    level = Math.max(1, Math.floor(level) || 1);
    mult = Number(mult); if (!mult || mult < 1) mult = 1;
    var base = GEN_BASE[g.name] || (g.isLord ? GEN_BASE['主公'] : null);
    if (base) {
      var lg = (g.isLord && gameData.lordType && LORD_GROWTH[gameData.lordType]) ? LORD_GROWTH[gameData.lordType] : { hp: 0, atk: 0, def: 0, speed: 0 };
      var k = level - 1;
      g.hp = base.hp + k * (20 + lg.hp);
      g.atk = Math.round((base.atk + k * (3 + lg.atk)) * mult);
      g.def = base.def + k * (1 + lg.def);
      g.speed = base.speed + k * (1 + lg.speed);
    }
    g.level = level;
    return !!base;
  }

  /* 攻击倍率：以「基础 + 等级成长」为基准放大，幂等（重复点击结果一致）；×1 即按等级还原 */
  function applyAtkMult(mult) {
    mult = Number(mult) || 1;
    var n2 = 0, sample = null;
    gameData.generals.forEach(function (g) {
      if (recalcStats(g, g.level || 1, mult)) { n2++; if (!g.isLord && !sample) sample = g; }
    });
    save();
    refresh();
    commit('全体 ' + n2 + ' 名武将攻击 ×' + mult + (mult === 1 ? '（已按等级还原）' : '') + (sample ? '，例：' + sample.name + ' 攻 ' + sample.atk : ''));
  }

  /* 一键：按当前等级重算所有武将属性（修复历史存档里"等级高但攻击低"的问题） */
  function recalcAllStats() {
    if (!gameData.generals.length) { toast('麾下还没有武将'); return; }
    var fixed = 0, miss = 0, sample = null;
    gameData.generals.forEach(function (g) {
      if (recalcStats(g, g.level || 1)) { fixed++; if (!g.isLord && !sample) sample = g; } else miss++;
    });
    save();
    refresh();
    commit('已按等级重算 ' + fixed + ' 名武将属性' + (sample ? '，例：' + sample.name + ' 攻 ' + sample.atk + ' / 防 ' + sample.def : '') + (miss ? '（' + miss + ' 名未知基础值已跳过）' : ''));
  }

    /* ============ S / SS 武将（与 ELITE_POOL 一致）格式：名称|稀有度|兵力|攻|防|速|技能|效果 ============ */
  var ELITE_RAW = [
    '吕布|SS|140|32|9|11|无双|造成120%伤害，无视敌人防御',
    '诸葛亮|SS|80|30|5|15|火烧赤壁|全体造成120%伤害',
    '张飞|SS|130|28|8|8|咆哮|25%概率眩晕敌人一回合',
    '关羽|SS|120|25|12|12|青龙偃月|30%概率造成150%伤害',
    '司马懿|SS|90|22|8|11|鹰视狼顾|受到攻击时25%概率反弹全部伤害',
    '曹操|SS|115|20|11|12|魏武|全队攻防提升10%',
    '马超|S|110|23|8|16|铁骑|先手攻击，速度优势伤害+30%',
    '周瑜|S|90|23|7|13|火攻|25%概率灼烧敌人，持续掉血',
    '庞统|S|85|24|6|12|连环计|20%概率让敌人无法行动',
    '张辽|S|100|21|9|13|突袭|30%概率连续攻击两次',
    '赵云|S|105|20|10|14|龙胆|闪避率提升20%',
    '貂蝉|S|75|15|5|16|魅惑|20%概率让敌人攻击自己队友'
  ];
  var ELITE = ELITE_RAW.map(function (r) {
    var p = r.split('|');
    return { name: p[0], rarity: p[1], hp: +p[2], atk: +p[3], def: +p[4], speed: +p[5], avatar: 'assets/1-1.bmp', skill: { name: p[6], desc: p[7] } };
  });

    /* ============ 材料道具（useItem 效果表）格式：名称|效果|图标编号 ============ */
  var MAT_RAW = [
    '铜币袋|银两+500|01', '干粮|粮草+500|02', '粮草|粮草+500|02', '中级粮袋|粮草+1000|06 拷贝',
    '中级铁矿袋|铁矿+1000|04', '木材袋|木材+300|05', '矿石袋|石材+300|04', '铁矿袋|铁矿+200|04',
    '铁矿|铁矿+500|04', '铁矿石|铁矿+500|04', '木材|木材+500|05',
    '兵符|任务道具|07', '兵书|任务道具|08', '丹药|任务道具|09'
  ];
  var MAT = MAT_RAW.map(function (r) {
    var p = r.split('|');
    return { name: p[0], note: p[1], icon: 'assets/备用道具 (' + p[2] + ').bmp' };
  });

    /* ============ 装备总表（EQUIP_POOL 29 件）格式：名称|部位|稀有度|攻|防|速|价格 ============ */
  var EQ_RAW = [
    '木棍|weapon|C|3|0|0|60', '粗布衣|armor|C|0|2|0|60', '草鞋|accessory|C|0|0|2|50',
    '石盾|armor|C|0|3|0|80', '短弓|weapon|C|4|0|0|90',
    '铁剑|weapon|B|8|0|0|300', '皮甲|armor|B|0|6|0|300', '硬弓|weapon|B|9|0|0|350',
    '铜盔|armor|B|0|7|0|320', '战靴|accessory|B|0|0|5|280',
    '环首刀|weapon|A|18|0|0|1200', '锁子甲|armor|A|0|14|0|1200', '长弓|weapon|A|20|0|0|1400',
    '铁盔|armor|A|0|15|0|1300', '良驹|accessory|A|0|0|8|1500',
    '青龙偃月刀|weapon|S|35|0|0|6000', '丈八蛇矛|weapon|S|33|0|0|5500', '方天画戟|weapon|S|30|0|0|5000',
    '七星刀|weapon|S|50|0|0|8000', '连环铠|armor|S|0|25|0|6000', '赤兔马|accessory|S|0|0|12|7000',
    '太平要术|accessory|S|10|0|0|4000', '诸葛连弩|weapon|S|28|0|0|4500',
    '倚天剑|weapon|SS|60|0|0|20000', '青釭剑|weapon|SS|55|0|0|18000', '雌雄双股剑|weapon|SS|52|0|0|16000',
    '绝影|accessory|SS|0|0|15|20000', '八卦阵图|accessory|SS|15|20|0|22000', '孙子兵法|accessory|SS|25|0|0|25000'
  ];
  var EQ = EQ_RAW.map(function (r) {
    var p = r.split('|');
    return { name: p[0], slot: p[1], rarity: p[2], atk: +p[3], def: +p[4], speed: +p[5], price: +p[6], icon: 'assets/备用道具 (04).bmp' };
  });

  function eqStat(e) {
    var p = [];
    if (e.atk) p.push('攻+' + e.atk);
    if (e.def) p.push('防+' + e.def);
    if (e.speed) p.push('速+' + e.speed);
    return p.join(' ');
  }

  var RES = [['silver', '银两'], ['food', '粮草'], ['stone', '石材'], ['iron', '铁矿'], ['wood', '木材'], ['reputation', '声望']];
  var TROOPS = [['infantry', '步兵'], ['archer', '弓兵'], ['cavalry', '骑兵'], ['special', '特种兵']];
  var TROOP_NAME = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', special: '特种兵' };

  /* ============ 工具 ============ */
  function n(v) { return (typeof v === 'number' && !isNaN(v)) ? v : 0; }
  function val(id) { var el = document.getElementById(id); return el ? Number(el.value) : 0; }
  function txt(id) { var el = document.getElementById(id); return el ? String(el.value) : ''; }
  function fmt(v) { return (v || 0).toLocaleString(); }
  function toast(m) { try { showToast(m); } catch (e) { } console.log('[金手指]', m); }
  function save() { try { saveGame(); } catch (e) { } }
  function refresh() {
    /* 游戏暴露的全局渲染函数逐个兜底调用，保证任何改动立即反映到界面 */
    ['updateResources', 'renderGenerals', 'renderMapCities', 'renderStages', 'renderInventory',
     'updatePlayerName', 'updatePlayerAvatar', 'renderGovBuildings', 'renderSmithy',
     'renderTavernResult', 'refreshExchange', 'renderBattle',
     'renderWarehouseModal', 'renderTechModal', 'renderClinicModal'
    ].forEach(function (n) {
      try { if (typeof window[n] === 'function') window[n](); } catch (e) { }
    });
  }
  function commit(m) { save(); refresh(); if (m) { toast(m); fb(m); } }
  function cfgMax(k) {
    try { return (BUILDING_CONFIG[k] && BUILDING_CONFIG[k].maxLevel) || CAPS.building; } catch (e) { return CAPS.building; }
  }
  function whCap() {
    var lv = (gameData.warehouse && gameData.warehouse.level) || 1;
    return WAREHOUSE_CAPS[lv] || WAREHOUSE_CAPS[1];
  }
  function matTotal(except) {
    var t = 0;
    MAT_KEYS.forEach(function (k) { if (k !== except) t += (gameData[k] || 0); });
    return t;
  }
  function maxGenerals() {
    var lord = gameData.generals.filter(function (g) { return g.isLord; })[0];
    return 5 + Math.floor(((lord ? lord.level : 1) - 1) / 5);
  }

  /* ============ 资源 ============ */
  function setRes(k, v) {
    v = Math.max(0, Math.floor(v) || 0);
    if (MAT_KEYS.indexOf(k) >= 0) {
      var cap = whCap();
      var room = cap - matTotal(k);
      if (room > 0 && v > room) {
        v = room;
        toast('材料合计受仓库限制（上限 ' + fmt(cap) + '），已截断为 ' + fmt(v));
      } else if (room <= 0 && v > (gameData[k] || 0)) {
        toast('当前材料存量已超出仓库上限 ' + fmt(cap) + '（历史遗留），本次不做限制');
      }
    }
    gameData[k] = v;
    commit(k + ' → ' + fmt(v));
  }

  function fillToCap() {
    var cap = whCap();
    var each = Math.floor(cap / 4);
    var raised = 0;
    MAT_KEYS.forEach(function (k) {
      if ((gameData[k] || 0) < each) { gameData[k] = each; raised++; }
    });
    if ((gameData.silver || 0) < cap) gameData.silver = cap;
    commit(raised
      ? '已按仓库上限补满：四种材料各 ' + fmt(each) + '（已高于上限的项未下调）'
      : '当前各数值都已不低于仓库上限，未做改动');
  }

  function setMilitaryOrder(v) {
    var mx = CAPS.militaryOrder;
    gameData.maxMilitaryOrder = mx;
    v = Math.max(0, Math.min(Math.floor(v) || 0, mx));
    gameData.militaryOrder = v;
    commit('军令 ' + v + '/' + mx);
  }

  /* ============ 主公 ============ */
  function setLordName() {
    var name = txt('ck_lordName').trim();
    if (!name) { toast('请输入名字'); return; }
    if (name.length > 6) { toast('名字最多 6 个字'); return; }
    gameData.lordName = name;
    var lord = gameData.generals.filter(function (g) { return g.isLord; })[0];
    if (lord) lord.name = name;
    commit('改名成功：' + name);
    try { initFaction(); } catch (e) { }
    refresh();
  }

  function setLordType(key) {
    gameData.lordType = key;
    var t = LORD_TYPES.filter(function (x) { return x.key === key; })[0];
    var wrap = document.getElementById('sgbyLordTypes');
    if (wrap) {
      Array.prototype.forEach.call(wrap.children, function (b) {
        if (b.getAttribute('data-key') === key) b.classList.add('on'); else b.classList.remove('on');
      });
    }
    var desc = document.getElementById('sgbyLordDesc');
    if (desc) desc.textContent = t ? (t.name + '：' + t.desc) : '';
    commit('主公类型 → ' + (t ? t.name : key));
    try { if (typeof initLord === 'function') initLord(); } catch (e) { }
    try { if (typeof renderGenerals === 'function') renderGenerals(); } catch (e) { }
  }

  function setLordLevel() {
    var lv = Math.max(1, Math.floor(val('ck_plv')) || 1);
    gameData.playerLevel = lv;
    gameData.lordLevel = lv;
    gameData.lordExp = Math.max(0, Math.floor(val('ck_pexp')) || 0);
    var lord = gameData.generals.filter(function (g) { return g.isLord; })[0];
    if (lord) { recalcStats(lord, lv); lord.exp = gameData.lordExp; }
    commit('主公 Lv.' + lv + '：属性已按成长重算（攻 ' + (lord ? lord.atk : '-') + ' / 防 ' + (lord ? lord.def : '-') + '），武将上限 ' + maxGenerals() + ' 人');
  }

  /* ============ 兵力 ============ */
  function setTroop(k, v) {
    gameData.troops[k] = Math.max(0, Math.floor(v) || 0);
    commit('兵力已更新');
  }

  function recallSilent() {
    var back = 0;
    gameData.generals.forEach(function (g) {
      var tier = g.troopType || 'infantry';
      if (!TROOP_NAME[tier]) tier = 'infantry';
      var old = g.assignedTroops || 0;
      if (old > 0) {
        gameData.troops[tier] = (gameData.troops[tier] || 0) + old;
        g.assignedTroops = 0;
        g.hp = 0;
        back += old;
      }
    });
    return back;
  }

  function recallAllTroops() {
    var back = recallSilent();
    commit(back > 0 ? ('已收回全部兵力 ' + fmt(back) + ' 人') : '当前没有已分配的兵力');
  }

  function autoAssignTroops(mode) {
    if (!gameData.generals.length) { toast('麾下还没有武将'); return; }
    var back = recallSilent();
    var W = { B: 1, A: 2, S: 3, SS: 4 };
    var groups = {};
    gameData.generals.forEach(function (g) {
      var t = g.preferredTroop || 'infantry';
      if (!TROOP_NAME[t]) t = 'infantry';
      g.troopType = t;
      (groups[t] = groups[t] || []).push(g);
    });
    var total = 0, detail = [];
    Object.keys(groups).forEach(function (t) {
      var list = groups[t];
      var stock = gameData.troops[t] || 0;
      if (stock <= 0 || !list.length) return;
      var sum = 0;
      list.forEach(function (g) { sum += (mode === 'weight' ? (W[g.rarity] || 1) : 1); });
      var given = 0;
      list.forEach(function (g, i) {
        var share = (mode === 'weight')
          ? Math.floor(stock * (W[g.rarity] || 1) / sum)
          : Math.floor(stock / list.length);
        if (i === list.length - 1) share = stock - given;
        share = Math.max(0, Math.min(share, stock - given));
        g.assignedTroops = share;
        g.hp = share;
        given += share;
      });
      gameData.troops[t] = stock - given;
      total += given;
      detail.push(TROOP_NAME[t] + ' ' + fmt(given));
    });
    if (!total) { toast('库存里没有空闲兵力，先一键补兵或训练'); return; }
    commit('已配兵 ' + fmt(total) + ' 人（' + detail.join(' / ') + '）' + (back ? '，先收回 ' + fmt(back) : ''));
  }

  /* ============ 城建 / 科技 / 仓库 / 关卡 ============ */
  function maxBuildings() {
    Object.keys(gameData.buildings || {}).forEach(function (k) {
      if (gameData.buildings[k]) gameData.buildings[k].level = cfgMax(k);
    });
    Object.keys(gameData.cityBuildings || {}).forEach(function (cid) {
      var cb = gameData.cityBuildings[cid];
      if (!cb || typeof cb !== 'object') return;
      Object.keys(cb).forEach(function (k) {
        if (cb[k] && typeof cb[k] === 'object' && 'level' in cb[k]) cb[k].level = cfgMax(k);
      });
    });
    commit('全部建筑已拉满 Lv.' + CAPS.building);
  }

  function maxTech() {
    var max = {};
    try { TECH_DEFS.forEach(function (t) { max[t.key] = t.max || CAPS.tech; }); } catch (e) { }
    Object.keys(gameData.techs || {}).forEach(function (k) { gameData.techs[k] = max[k] || CAPS.tech; });
    commit('科技已全部拉满 Lv.' + CAPS.tech);
  }

  function maxWarehouse() {
    gameData.warehouse = { level: CAPS.warehouse };
    commit('仓库已升到 Lv.' + CAPS.warehouse + '，容量上限 ' + fmt(WAREHOUSE_CAPS[CAPS.warehouse]));
  }

  /* ============ 武将 ============ */
  function addGeneral(name, force) {
    var t = null;
    try { t = ELITE_POOL.filter(function (g) { return g.name === name; })[0]; } catch (e) { }
    if (!t) t = ELITE.filter(function (g) { return g.name === name; })[0];
    if (!t) { toast('没找到 ' + name); return; }
    if (gameData.generals.some(function (g) { return g.name === name; })) { toast(name + ' 已在麾下'); return; }
    var cap = maxGenerals();
    if (!force && gameData.generals.length >= cap) {
      var go = confirm('武将已达上限（' + gameData.generals.length + '/' + cap + '）。\n\n游戏规则：主公每升 5 级 +1 个名额。\n可以先用面板把主公等级提上去，或确定要强制加入？');
      if (!go) { toast('已取消（当前 ' + gameData.generals.length + '/' + cap + '）'); return; }
    }
    var base = { B: { wu: 5, tong: 5, zhi: 5, zheng: 5 }, A: { wu: 10, tong: 10, zhi: 10, zheng: 10 }, S: { wu: 16, tong: 16, zhi: 16, zheng: 16 }, SS: { wu: 22, tong: 22, zhi: 22, zheng: 22 } }[t.rarity] || { wu: 5, tong: 5, zhi: 5, zheng: 5 };
    var pt = 'infantry';
    try { pt = inferTroop(t.name) || 'infantry'; } catch (e) { }
    gameData.generals.push({
      id: Date.now() + Math.floor(Math.random() * 10000),
      name: t.name, avatar: t.avatar, level: 1, exp: 0, rarity: t.rarity,
      hp: t.hp, atk: t.atk, def: t.def, speed: t.speed, skill: t.skill,
      equip: { weapon: null, armor: null, accessory: null }, equipment: {},
      preferredTroop: pt, assignedTroops: 0, troopType: null,
      wu: base.wu, tong: base.tong, zhi: base.zhi, zheng: base.zheng, potentialPoints: 0
    });
    save();
    try { initFaction(); } catch (e) { }
    refresh();
    if (!force) toast(t.rarity + ' 级 ' + t.name + ' 已加入麾下');
  }

  function addAllElite(rarity) {
    var got = 0;
    ELITE.filter(function (g) { return g.rarity === rarity; }).forEach(function (g) {
      if (!gameData.generals.some(function (x) { return x.name === g.name; })) { addGeneral(g.name, true); got++; }
    });
    toast(rarity + ' 级武将收集完成，本次新增 ' + got + ' 人');
  }

  function maxGeneralsLevel() {
    var lv = Math.max(1, Math.floor(val('ck_genLv')) || 60);
    var n2 = 0, sample = null;
    gameData.generals.forEach(function (g) {
      if (g.isLord) return;
      recalcStats(g, lv);
      n2++;
      if (!sample) sample = g;
    });
    commit('麾下 ' + n2 + ' 名武将已到 Lv.' + lv + '，属性同步重算' + (sample ? '（例：' + sample.name + ' 攻 ' + sample.atk + ' / 防 ' + sample.def + '）' : '') + '。主公等级请单独设置。');
  }

  var forceRarity = null;
  function hookTavern() {
    if (window.__sgbyTavernHooked || typeof window.tavernInvite !== 'function') return;
    window.__sgbyTavernHooked = true;
    var orig = window.tavernInvite;
    window.tavernInvite = function (tier) {
      var before = gameData.silver;
      gameData.silver = Math.max(before, 99999999);
      try { orig.call(this, tier); } catch (e) { }
      gameData.silver = before;
      if (forceRarity) {
        var pool = [];
        try { pool = ELITE_POOL.filter(function (e) { return e.rarity === forceRarity; }); } catch (e) { }
        if (!pool.length) pool = ELITE.filter(function (e) { return e.rarity === forceRarity; });
        var fill = [];
        try { fill = ELITE_POOL.filter(function (e) { return e.rarity === 'A'; }); } catch (e) { }
        var list = pool.slice(0, 10), i = 0;
        while (list.length < 10 && fill.length) { list.push(fill[i % fill.length]); i++; }
        pendingRecruits.length = 0;
        list.slice(0, 10).forEach(function (e) { pendingRecruits.push(Object.assign({}, e, { _recruited: false })); });
        gameData.pendingRecruits = pendingRecruits.slice();
        commit('外挂生效：本次必出 ' + forceRarity + ' 级');
        try { renderTavernResult(); } catch (e) { }
        toast('酒馆已刷新为 ' + forceRarity + ' 级阵容');
      } else {
        save();
        try { updateResources(); } catch (e) { }
      }
    };
    toast('酒馆外挂已装载');
  }

  function setForce(r) {
    hookTavern();
    forceRarity = r;
    var el = document.getElementById('ck_forceLabel');
    if (el) { el.textContent = r ? ('必出 ' + r) : '已关闭'; el.style.color = r ? '#d4a017' : ''; }
    toast('酒馆外挂：' + (r ? '必出 ' + r + '（银两已免单）' : '已关闭'));
  }

  function pityNow() {
    gameData.tavernPity = 99;
    gameData.tavernPity2 = 99;
    gameData.tavernPity3 = 99;
    commit('保底计数已设为 99，下一次招募必触发保底');
  }

  function pushToTavern(name) {
    var t = null;
    try { t = ELITE_POOL.filter(function (g) { return g.name === name; })[0]; } catch (e) { }
    if (!t) t = ELITE.filter(function (g) { return g.name === name; })[0];
    if (!t) { toast('没找到 ' + name); return; }
    pendingRecruits.length = 0;
    pendingRecruits.push(Object.assign({}, t, { _recruited: false }));
    gameData.pendingRecruits = pendingRecruits.slice();
    save();
    try { openTavernModal(); } catch (e) { toast('已塞进酒馆，请手动打开酒馆'); }
    try { renderTavernResult(); } catch (e) { }
    toast(name + ' 已在酒馆候着，点「招募」即可');
  }

  /* ============ 道具 / 装备 ============ */
  function findMat(name) {
    if (!gameData.inventory) gameData.inventory = [];
    return gameData.inventory.filter(function (i) { return i.type === 'material' && i.name === name; })[0];
  }

  function addMaterial(name, count) {
    var def = MAT.filter(function (m) { return m.name === name; })[0];
    if (!def) { toast('没找到道具 ' + name); return; }
    count = Math.max(1, Math.floor(count) || 1);
    var it = findMat(name);
    if (it) { it.count = (it.count || 0) + count; }
    else {
      gameData.inventory.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: def.name, icon: def.icon, count: count, type: 'material'
      });
    }
    commit(name + ' +' + fmt(count));
  }

  function addAllMaterials(count) {
    count = Math.max(1, Math.floor(count) || 999);
    MAT.forEach(function (def) {
      var it = findMat(def.name);
      if (it) { it.count = (it.count || 0) + count; }
      else {
        gameData.inventory.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: def.name, icon: def.icon, count: count, type: 'material'
        });
      }
    });
    commit('全部材料 +' + fmt(count));
  }

  function addEquip(idx) {
    var e = EQ[idx];
    if (!e) { toast('请选择装备'); return; }
    if (!gameData.inventory) gameData.inventory = [];
    gameData.inventory.push({
      name: e.name, icon: e.icon || 'assets/备用道具 (04).bmp',
      type: 'equip', slot: e.slot, type2: e.slot,
      atk: e.atk || 0, def: e.def || 0, speed: e.speed || 0,
      rarity: e.rarity, price: e.price || 100
    });
    commit('获得 [' + e.rarity + '] ' + e.name + ' ' + eqStat(e));
  }

  function addEquipByRarity(rarity) {
    if (!gameData.inventory) gameData.inventory = [];
    var got = 0;
    EQ.forEach(function (e) {
      if (e.rarity !== rarity) return;
      gameData.inventory.push({
        name: e.name, icon: e.icon || 'assets/备用道具 (04).bmp',
        type: 'equip', slot: e.slot, type2: e.slot,
        atk: e.atk || 0, def: e.def || 0, speed: e.speed || 0,
        rarity: e.rarity, price: e.price || 100
      });
      got++;
    });
    commit(rarity + ' 级装备已全部入库（' + got + ' 件）');
  }

  function bestOf(slot) {
    var best = null, bs = -1;
    EQ.forEach(function (e) {
      if (e.slot !== slot) return;
      var s = (e.atk || 0) + (e.def || 0) + (e.speed || 0);
      if (s > bs) { bs = s; best = e; }
    });
    return best;
  }

  function mkEqObj(e, slot) {
    if (!e) return null;
    return { name: e.name, rarity: e.rarity, atk: e.atk || 0, def: e.def || 0, speed: e.speed || 0, slot: slot };
  }

  function equipBestForAll() {
    if (!gameData.generals.length) { toast('麾下还没有武将'); return; }
    var w = bestOf('weapon'), a = bestOf('armor'), c = bestOf('accessory');
    gameData.generals.forEach(function (g) {
      g.equipment = { weapon: mkEqObj(w, 'weapon'), armor: mkEqObj(a, 'armor'), accessory: mkEqObj(c, 'accessory') };
      g.equip = { weapon: mkEqObj(w, 'weapon'), armor: mkEqObj(a, 'armor'), accessory: mkEqObj(c, 'accessory') };
    });
    commit('全队 ' + gameData.generals.length + ' 人已穿最强：' + w.name + ' / ' + a.name + ' / ' + c.name);
  }

  var forceSmithy = null;
  function hookSmithy() {
    if (window.__sgbySmithyHooked || typeof window.refreshSmithy !== 'function') return;
    window.__sgbySmithyHooked = true;
    var orig = window.refreshSmithy;
    window.refreshSmithy = function (tier) {
      var before = gameData.silver;
      gameData.silver = Math.max(before, 99999999);
      try { orig.call(this, tier); } catch (e) { }
      gameData.silver = before;
      if (forceSmithy) {
        try {
          var pool = EQ.filter(function (e) { return e.rarity === forceSmithy; });
          var fill = EQ.filter(function (e) { return e.rarity === 'S'; });
          var list = pool.slice(0, 5), i = 0;
          while (list.length < 5 && fill.length) { list.push(fill[i % fill.length]); i++; }
          smithyEquips.length = 0;
          list.slice(0, 5).forEach(function (e) {
            smithyEquips.push({
              id: 'x' + Date.now() + Math.floor(Math.random() * 1000),
              name: e.name, icon: e.icon, slot: e.slot, type: e.slot, rarity: e.rarity,
              atk: e.atk || 0, def: e.def || 0, speed: e.speed || 0,
              price: e.price || 100, sold: false
            });
          });
          gameData.smithyEquips = smithyEquips.slice();
          save();
          try { renderSmithy(); } catch (e) { }
          toast('铁匠铺已换成 ' + forceSmithy + ' 装备（锻造费免单）');
        } catch (e) { toast('铁匠铺替换失败：' + e.message); }
      } else {
        save();
        try { updateResources(); } catch (e) { }
      }
    };
    if (!window.__sgbyBuyHooked && typeof window.buyEquip === 'function') {
      window.__sgbyBuyHooked = true;
      var ob = window.buyEquip;
      window.buyEquip = function (idx) {
        var before = gameData.silver;
        if (forceSmithy) gameData.silver = Math.max(before, 99999999);
        try { ob.call(this, idx); } catch (e) { }
        if (forceSmithy) gameData.silver = before;
      };
    }
    toast('铁匠铺外挂已装载');
  }

  function setForceSmithy(r) {
    hookSmithy();
    forceSmithy = r;
    var el = document.getElementById('ck_smithyLabel');
    if (el) { el.textContent = r ? ('必出 ' + r) : '已关闭'; el.style.color = r ? '#d4a017' : ''; }
    toast('铁匠铺外挂：' + (r ? '必出 ' + r + '，锻造费 + 购买费全免' : '已关闭'));
  }

  function exportSave() {
    var s = JSON.stringify(gameData);
    console.log('===== 存档 JSON（复制走即可备份）=====');
    console.log(s);
    try { navigator.clipboard.writeText(s); toast('存档已复制到剪贴板'); }
    catch (e) { toast('复制失败，请从 Console 里手动复制上面那段'); }
  }

  function importSave() {
    var s = prompt('粘贴存档 JSON：');
    if (!s) return;
    try {
      var o = JSON.parse(s);
      Object.keys(o).forEach(function (k) { gameData[k] = o[k]; });
      save();
      toast('导入成功，正在刷新');
      setTimeout(function () { location.reload(); }, 400);
    } catch (e) { toast('JSON 解析失败，导入取消'); }
  }

  function resetSave() {
    if (!confirm('确定清档重来？所有进度会清空！')) return;
    var _s = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k !== 'sgby_save') return _s.apply(this, arguments); };
    localStorage.removeItem('sgby_save');
    location.reload();
  }

/* ============ 主题（同时作用于面板与游戏页面） ============ */
var THEMES = [
  { key: 'gold', name: '鎏金（默认）', dot: '#c9a227' },
  { key: 'dark', name: '深色', dot: '#3c3c3c' }
];

/* 游戏页面配色（暖棕底 + 金色） → 主题配色。dark = 黑白灰（代码编辑器风）。gold 不替换（原样还原） */
var GAME_TINT = {
  dark: {
    '#1a1410': '#1e1e1e', '#2a2015': '#252526', '#3a2f1f': '#2d2d2d',
    '#2a1f14': '#202020', '#352818': '#2a2a2a', '#5a4a2a': '#3c3c3c',
    '#8b4513': '#3c3c3c', '#b8a070': '#8a8a8a', '#e8dcc8': '#d4d4d4',
    '#c9a227': '#d4d4d4', '#f0d78c': '#f0f0f0', '#8b6914': '#6a6a6a',
    '#a07d1c': '#5a5a5a', '#ffd700': '#ffffff',
    '200,162,39': '212,212,212', '200, 162, 39': '212, 212, 212',
    '240,215,140': '240,240,240', '240, 215, 140': '240, 240, 240',
    '139,105,20': '106,106,106', '139, 105, 20': '106, 106, 106'
  }
};

var STYLE_ID = 'sgbyCheatStyle';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  var css = [
    '#sgbyCheatPanel{position:fixed;right:8px;bottom:72px;width:min(334px,92vw);max-height:74vh;overflow-y:auto;z-index:2147483000;',
    'background:var(--sg-bg);color:var(--sg-tx);border:1px solid var(--sg-line);border-radius:10px;',
    'font:12px/1.5 -apple-system,PingFang SC,sans-serif;box-shadow:0 6px 24px var(--sg-shadow);-webkit-overflow-scrolling:touch}',
    '#sgbyCheatPanel{--sg-bg:#1a1410;--sg-head:#2a2015;--sg-line:#c9a227;--sg-tx:#e8dcc8;--sg-sub:#b8a888;',
    '--sg-inp:#2a2015;--sg-inpLine:#6b5a33;--sg-btn:#3a2d1a;--sg-btnTx:#f0d78c;--sg-pri:#c9a227;--sg-priTx:#1a1410;',
    '--sg-dim:#8a8a8a;--sg-shadow:rgba(0,0,0,.5);--sg-toastTx:#1a1410}',
    '#sgbyCheatPanel[data-theme="mint"]{--sg-bg:#0f1c16;--sg-head:#16271e;--sg-line:#1fa970;--sg-tx:#dff3e8;--sg-sub:#8fb5a4;',
    '--sg-inp:#16271e;--sg-inpLine:#2c5744;--sg-btn:#1b3328;--sg-btnTx:#7fe0b6;--sg-pri:#1fa970;--sg-priTx:#04150d;',
    '--sg-dim:#7f9a8d;--sg-shadow:rgba(0,0,0,.5);--sg-toastTx:#04150d}',
    '#sgbyCheatPanel[data-theme="sky"]{--sg-bg:#0d1a21;--sg-head:#14262f;--sg-line:#1cb9e6;--sg-tx:#ddf1f9;--sg-sub:#8aadb9;',
    '--sg-inp:#14262f;--sg-inpLine:#28505f;--sg-btn:#172f3a;--sg-btnTx:#8fe4f7;--sg-pri:#1cb9e6;--sg-priTx:#04161d;',
    '--sg-dim:#7d97a2;--sg-shadow:rgba(0,0,0,.5);--sg-toastTx:#04161d}',
    '#sgbyCheatPanel[data-theme="lavender"]{--sg-bg:#171426;--sg-head:#211c33;--sg-line:#7a68da;--sg-tx:#e8e3fa;--sg-sub:#a49bc4;',
    '--sg-inp:#211c33;--sg-inpLine:#413766;--sg-btn:#282142;--sg-btnTx:#c3b8f2;--sg-pri:#7a68da;--sg-priTx:#ffffff;',
    '--sg-dim:#8e88a8;--sg-shadow:rgba(0,0,0,.5);--sg-toastTx:#ffffff}',
    '#sgbyCheatPanel[data-theme="dark"]{--sg-bg:#1e1e1e;--sg-head:#252526;--sg-line:#3c3c3c;--sg-tx:#d4d4d4;--sg-sub:#9a9a9a;',
    '--sg-inp:#252526;--sg-inpLine:#3c3c3c;--sg-btn:#2d2d2d;--sg-btnTx:#e0e0e0;--sg-pri:#d4d4d4;--sg-priTx:#1e1e1e;',
    '--sg-dim:#8a8a8a;--sg-shadow:rgba(0,0,0,.65);--sg-toastTx:#1e1e1e;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '#sgbyCheatPanel.mini{width:48px;height:48px;max-height:48px;border-radius:50%;overflow:hidden;border-color:var(--sg-pri);background:var(--sg-pri)}',
    '#sgbyCheatPanel.mini .sg-head,#sgbyCheatPanel.mini .sg-body{display:none}',
    '#sgbyCheatPanel.mini .sg-ball{display:flex}',
    '#sgbyCheatPanel .sg-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--sg-head);border-bottom:1px solid var(--sg-line);border-radius:9px 9px 0 0;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}',
    '#sgbyCheatPanel .sg-title{color:var(--sg-pri);font-size:13px;font-weight:bold}',
    '#sgbyCheatPanel .sg-hint{color:var(--sg-dim);font-weight:normal;font-size:10px;margin-left:5px}',
    '#sgbyCheatPanel .sg-body{padding:0 12px 14px}',
    '#sgbyCheatPanel .sg-sec{margin:10px 0 4px;color:var(--sg-pri);font-size:12px;border-bottom:1px solid var(--sg-head);padding-bottom:3px}',
    '#sgbyCheatPanel .sg-row{display:flex;align-items:center;justify-content:space-between;margin:4px 0;gap:6px}',
    '#sgbyCheatPanel .sg-row>span:first-child{color:var(--sg-sub);white-space:nowrap}',
    '#sgbyCheatPanel .sg-inp,#sgbyCheatPanel .sg-sel{background:var(--sg-inp);color:var(--sg-tx);border:1px solid var(--sg-inpLine);border-radius:4px;padding:3px 6px;font-size:12px;width:96px;outline:none}',
    '#sgbyCheatPanel .sg-sel{padding:3px 4px}',
    '#sgbyCheatPanel .sg-btn{background:var(--sg-btn);color:var(--sg-btnTx);border:1px solid var(--sg-inpLine);border-radius:4px;padding:3px 9px;font-size:12px;cursor:pointer;margin-left:5px;white-space:nowrap}',
    '#sgbyCheatPanel .sg-pri{background:var(--sg-pri);color:var(--sg-priTx);border-color:var(--sg-pri);font-weight:bold}',
    '#sgbyCheatPanel .sg-danger{background:#8b2f2f;color:#fff;border-color:#8b2f2f}',
    '#sgbyCheatPanel .sg-tip{color:var(--sg-dim);font-size:11px;margin-top:4px;line-height:1.5}',
    '#sgbyCheatPanel .sg-group{display:flex;gap:4px;margin:6px 0;flex-wrap:wrap}',
    '#sgbyCheatPanel .sg-tg{flex:1;min-width:56px;padding:5px 0;font-size:12px;cursor:pointer;border-radius:4px;border:1px solid var(--sg-inpLine);background:var(--sg-btn);color:var(--sg-btnTx)}',
    '#sgbyCheatPanel .sg-tg.on{background:var(--sg-pri);color:var(--sg-priTx);border-color:var(--sg-pri);font-weight:bold}',
    '#sgbyCheatPanel .sg-ball{display:none;width:100%;height:100%;background:transparent;border:none;color:var(--sg-priTx);cursor:pointer;align-items:center;justify-content:center;touch-action:none;padding:0}',
    '#sgbyCheatPanel .sg-toast{margin:0;padding:0 10px;max-height:0;overflow:hidden;border-radius:6px;background:var(--sg-pri);color:var(--sg-toastTx);font-size:12px;opacity:0;transform:translateY(-6px);transition:max-height .22s ease,margin .22s ease,padding .22s ease,opacity .18s,transform .18s}',
    '#sgbyCheatPanel .sg-toast.on{max-height:80px;margin:8px 0 2px;padding:7px 10px;opacity:1;transform:translateY(0)}',
    '#sgbyCheatPanel .sg-theme{display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap}',
    '#sgbyCheatPanel .sg-sw{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;box-shadow:0 1px 4px rgba(0,0,0,.25),inset 0 0 0 1px rgba(255,255,255,.28)}',
    '#sgbyCheatPanel .sg-sw.on{border-color:var(--sg-tx)}'
  ].join('');
  var st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
}

/* 判断节点是否属于金手指面板（面板自身不参与游戏换肤） */
function inCheatPanel(el) {
  if (!el) return false;
  if (el.id === 'sgbyCheatPanel') return true;
  return !!(el.closest && el.closest('#sgbyCheatPanel'));
}

/* 按映射替换一段文本里的所有配色 */
function tintText(txt, map, counter) {
  if (!txt || !map) return txt;
  var out = txt;
  Object.keys(map).forEach(function (from) {
    if (out.indexOf(from) < 0) return;
    out = out.split(from).join(map[from]);
    if (counter) counter.n++;
  });
  return out;
}

/* 替换单个元素的内联 style（原值留档，可还原） */
function tintOne(el, map) {
  if (!el || el.nodeType !== 1 || inCheatPanel(el) || !el.getAttribute) return;
  var orig = el.getAttribute('data-sgby-iorig');
  if (orig === null) { orig = el.getAttribute('style') || ''; try { el.setAttribute('data-sgby-iorig', orig); } catch (e) { } }
  var out = map ? tintText(orig, map) : orig;
  if (out !== (el.getAttribute('style') || '')) { try { el.setAttribute('style', out); } catch (e) { } }
}

/* 替换节点自身 + 子孙的内联 style（游戏动态创建的元素也能跟上） */
function tintTree(el, map) {
  if (!el || el.nodeType !== 1 || inCheatPanel(el)) return;
  tintOne(el, map);
  if (el.querySelectorAll) Array.prototype.forEach.call(el.querySelectorAll('[style]'), function (n) { tintOne(n, map); });
}

var gameObserver = null;
function watchGame(map) {
  if (gameObserver) { gameObserver.disconnect(); gameObserver = null; }
  if (!map || !window.MutationObserver || !document.body) return;
  gameObserver = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var an = muts[i].addedNodes;
      for (var j = 0; j < an.length; j++) tintTree(an[j], map);
    }
  });
  try { gameObserver.observe(document.body, { childList: true, subtree: true }); } catch (e) { }
}

/* 把游戏页面的暖棕底 + 金色系整体换成主题色（改写 <style> 与内联 style，一键还原） */
function applyGameTheme(key) {
  var map = GAME_TINT[key];
  var counter = { n: 0 };
  var styles = document.querySelectorAll('style');
  Array.prototype.forEach.call(styles, function (st) {
    if (st.id === STYLE_ID) return;
    if (st.getAttribute('data-sgby-orig') === null) st.setAttribute('data-sgby-orig', st.textContent);
    var orig = st.getAttribute('data-sgby-orig');
    if (!orig) return;
    var out = map ? tintText(orig, map, counter) : orig;
    if (out !== st.textContent) st.textContent = out;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[style]'), function (el) { tintOne(el, map); });
  watchGame(map);
  return counter.n;
}

function applyTheme(key) {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p) return;
  p.setAttribute('data-theme', key);
  var wrap = document.getElementById('sgbyThemes');
  if (wrap) {
    Array.prototype.forEach.call(wrap.children, function (b) {
      if (b.getAttribute && b.getAttribute('data-key') === key) b.classList.add('on');
      else if (b.classList) b.classList.remove('on');
    });
    var lb = document.getElementById('sgbyThemeName');
    var t = THEMES.filter(function (x) { return x.key === key; })[0];
    if (lb && t) lb.textContent = t.name;
  }
  applyGameTheme(key);
  try { localStorage.setItem('sgby_theme', key); } catch (e) { }
}

/* ============ 操作反馈（面板内显示，移动端也看得见） ============ */
var fbTimer = null;
function fb(msg) {
  var el = document.getElementById('sgbyFb');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  if (fbTimer) clearTimeout(fbTimer);
  fbTimer = setTimeout(function () { el.classList.remove('on'); }, 2600);
}

/* ============ 位置 / 拖动 / 小球 ============ */
/* 位置存储键（v2：改默认贴右，旧键作废以清掉历史左侧位置） */
var POS_KEY = 'sgby_panel_pos_v2';

function savePos() {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p) return;
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({
      left: p.style.left || '', top: p.style.top || '',
      right: p.style.right || '', bottom: p.style.bottom || ''
    }));
  } catch (e) { }
}

function loadPos() {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p) return;
  /* 每次打开一律贴右下，不再恢复历史位置（避免旧档把面板带到左边） */
  p.style.left = 'auto';
  p.style.top = 'auto';
  p.style.right = '8px';
  p.style.bottom = '72px';
}

/* 展开时把面板整体拉回可视区（小球贴边→展开会溢出屏幕） */
function clampPanelPos() {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p || p.classList.contains('mini')) return;
  var r = p.getBoundingClientRect();
  var iface = window.innerWidth, ih = window.innerHeight;
  var nl = Math.max(8, Math.min(r.left, Math.max(8, iface - r.width - 8)));
  var nt = Math.max(8, Math.min(r.top, Math.max(8, ih - r.height - 8)));
  if (Math.abs(nl - r.left) > 0.5 || Math.abs(nt - r.top) > 0.5) {
    p.style.right = 'auto';
    p.style.bottom = 'auto';
    p.style.left = nl + 'px';
    p.style.top = nt + 'px';
    savePos();
  }
}

/* 收起成小球时贴到屏幕边缘：
   默认（未被拖动过）一律贴右边；只有用户手动拖过（内联 left）才按就近边吸附 */
function snapBall() {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p || !p.classList.contains('mini')) return;
  var r = p.getBoundingClientRect();
  var s = 48;
  var vh = window.innerHeight || document.documentElement.clientHeight || 0;
  var il = p.style.left, ir = p.style.right;
  var inlineL = !!il && il !== 'auto', inlineR = !!ir && ir !== 'auto';
  var side;
  if (inlineL && !inlineR) {
    /* 拖动过：按当前视觉位置就近吸附 */
    var vw = document.documentElement.clientWidth || window.innerWidth || 360;
    side = (r.left + r.width / 2 < vw / 2) ? 'left' : 'right';
  } else {
    /* 默认 / 贴右状态 → 固定贴右 */
    side = 'right';
  }
  if (side === 'left') { p.style.left = '8px'; p.style.right = 'auto'; }
  else { p.style.right = '8px'; p.style.left = 'auto'; }
  p.style.top = Math.round(Math.max(8, Math.min(r.top, Math.max(8, vh - s - 8)))) + 'px';
  p.style.bottom = 'auto';
  savePos();
}

function resetPos() {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p) return;
  p.style.left = 'auto';
  p.style.top = 'auto';
  p.style.right = '8px';
  p.style.bottom = '72px';
  try { localStorage.removeItem(POS_KEY); } catch (e) { }
  try { localStorage.removeItem('sgby_panel_' + 'pos'); } catch (e) { }
  fb('面板已回到右下角（贴右）');
}

function setMini(v) {
  var p = document.getElementById('sgbyCheatPanel');
  if (!p) return;
  if (v) {
    p.classList.add('mini');
    stopSync();
    snapBall();
  } else {
    p.classList.remove('mini');
    syncValues(false);
    startSync();
    setTimeout(clampPanelPos, 0);
  }
}

var suppressClick = false;
function makeDraggable() {
  var el = document.getElementById('sgbyCheatPanel');
  var head = document.getElementById('sgbyHead');
  var ball = document.getElementById('sgbyBall');
  if (!el || !head) return;
  var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, moved = false;

  function start(e) {
    if (e.target.closest && e.target.closest('[data-act="fold"],[data-act="close"]')) return;
    var pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    var r = el.getBoundingClientRect();
    dragging = true; moved = false;
    sx = pt.clientX; sy = pt.clientY; ox = r.left; oy = r.top;
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
  }
  function move(e) {
    if (!dragging) return;
    var pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    if (Math.abs(pt.clientX - sx) > 6 || Math.abs(pt.clientY - sy) > 6) moved = true;
    if (!moved) return;
    var x = Math.max(0, Math.min(ox + (pt.clientX - sx), window.innerWidth - el.offsetWidth));
    var y = Math.max(0, Math.min(oy + (pt.clientY - sy), window.innerHeight - el.offsetHeight));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    if (e.cancelable) e.preventDefault();
  }
  function end() {
    if (!dragging) return;
    dragging = false;
    if (moved) { savePos(); suppressClick = true; setTimeout(function () { suppressClick = false; }, 350); }
  }

  head.addEventListener('mousedown', start);
  head.addEventListener('touchstart', start, { passive: true });
  if (ball) {
    ball.addEventListener('mousedown', start);
    ball.addEventListener('touchstart', start, { passive: true });
  }
  document.addEventListener('mousemove', move, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
}

/* ============ 实时同步 ============ */
var syncTimer = null;
var dirty = {};

function syncValues(force) {
  if (!document.getElementById('sgbyCheatPanel')) { stopSync(); return; }
  var active = document.activeElement;
  var m = {};
  RES.forEach(function (r) { m['ck_' + r[0]] = n(gameData[r[0]]); });
  TROOPS.forEach(function (t) { m['ck_t_' + t[0]] = n((gameData.troops || {})[t[0]]); });
  m['ck_mo'] = n(gameData.militaryOrder);
  m['ck_plv'] = n(gameData.playerLevel);
  m['ck_pexp'] = n(gameData.lordExp);

  Object.keys(m).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!force && (el === active || dirty[id])) return;
    var v = String(m[id]);
    if (el.value !== v) el.value = v;
  });

  var tip = document.getElementById('ck_whTip');
  if (tip) {
    var lv = n((gameData.warehouse || {}).level) || 1;
    tip.textContent = '粮/石/铁/木 合计受仓库限制：当前仓库 Lv.' + lv +
      ' · 上限 ' + fmt(whCap()) + '（当前合计 ' + fmt(matTotal()) + '）；银两、声望不受限';
  }
}

function startSync() {
  stopSync();
  syncTimer = setInterval(function () { syncValues(false); }, 2000);
}
function stopSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

/* ============ 界面 ============ */
function sec(t) {
  return '<div class="sg-sec">' + t + '</div>';
}
function row(label, ctrl) {
  return '<div class="sg-row"><span>' + label + '</span><span>' + ctrl + '</span></div>';
}
function btn(act, key, text, pri) {
  return '<button class="sg-btn' + (pri ? ' sg-pri' : '') + '" data-act="' + act + '"' +
    (key !== null && key !== undefined ? ' data-key="' + key + '"' : '') + '>' + text + '</button>';
}

/* ============ 道具 / 装备获取途径（读自游戏源码） ============ */
var STAGE_DROPS = { '太平要术': 3, '方天画戟': 5, '青釭剑': 8, '连环铠': 9, '的卢马': 11, '七星刀': 12, '诸葛连弩': 13, '倚天剑': 14, '孙子兵法': 15 };
var MAT_INIT = { '铜币袋': 5, '干粮': 3, '中级铁矿袋': 10, '木材袋': 8, '中级粮袋': 15, '兵符': 1, '兵书': 2, '丹药': 4 };
function matAcq(name) {
  if (MAT_INIT[name]) return '开局自带 ×' + MAT_INIT[name] + '；游戏内无其他产出，用一次少一次（金手指可补）';
  return '游戏内无获取途径（只存在于使用效果表，正常玩法拿不到）';
}
function eqAcq(name) {
  var st = STAGE_DROPS[name];
  return (st ? '第 ' + st + ' 关通关后 20% 稀有掉落；' : '') +
    '铁匠铺刷新购买（一档 500 两 / 二档 3000 / 三档 10000，档位越高越容易出高级）';
}

var curLord = LORD_TYPES.filter(function (t) { return t.key === gameData.lordType; })[0];
var curTheme = 'gold';
try { curTheme = localStorage.getItem('sgby_theme') || 'gold'; } catch (e) { }
if (!THEMES.filter(function (t) { return t.key === curTheme; })[0]) curTheme = 'gold';
var curThemeName = (THEMES.filter(function (t) { return t.key === curTheme; })[0] || THEMES[0]).name;

injectStyle();

var html = '<div id="sgbyCheatPanel" data-theme="' + curTheme + '">' +
  '<div class="sg-head" id="sgbyHead">' +
  '<b class="sg-title">三国霸业 · 金手指<span class="sg-hint">⠿ 可拖动</span></b>' +
  '<span>' + btn('fold', null, '收起') + btn('close', null, '×') + '</span></div>' +
  '<button class="sg-ball" id="sgbyBall" data-act="unfold" title="展开金手指">' +
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' +
  '</svg></button>' +
  '<div class="sg-body" id="sgbyCheatBody">' +
  '<div class="sg-toast" id="sgbyFb"></div>';

html += sec('主题（同时换游戏配色）');
html += '<div class="sg-theme" id="sgbyThemes">' +
  THEMES.map(function (t) {
    return '<button class="sg-sw' + (t.key === curTheme ? ' on' : '') + '" data-act="theme" data-key="' + t.key +
      '" title="' + t.name + '" style="background:' + t.dot + '"></button>';
  }).join('') +
  '<span class="sg-tip" style="margin:0;">当前：<b id="sgbyThemeName">' + curThemeName + '</b></span></div>';
html += '<div class="sg-tip">点色块会连游戏页面的背景与金色一起换掉；选「鎏金」还原原始配色</div>';

html += sec('资源');
RES.forEach(function (r) {
  html += row(r[1], '<input class="sg-inp" id="ck_' + r[0] + '" type="number" value="' + n(gameData[r[0]]) + '">' +
    btn('setres', r[0], '设为'));
});
html += '<div class="sg-group">' + btn('fillcap', null, '按仓库上限补满', true) + btn('readres', null, '立即同步') + '</div>';
html += '<div class="sg-tip" id="ck_whTip">粮/石/铁/木 合计受仓库限制：当前仓库 Lv.' +
  (n((gameData.warehouse || {}).level) || 1) + ' · 上限 ' + fmt(whCap()) + '（当前合计 ' + fmt(matTotal()) + '）</div>';

html += sec('军令');
html += row('当前 / 上限', '<input class="sg-inp" id="ck_mo" type="number" value="' + n(gameData.militaryOrder) + '" style="width:52px;">' +
  '<span class="sg-tip" style="margin:0;">/ ' + CAPS.militaryOrder + '</span>' + btn('setmo', null, '设为'));

html += sec('主公');
html += row('姓名', '<input class="sg-inp" id="ck_lordName" type="text" value="' + (gameData.lordName || '') + '" maxlength="6">' +
  btn('setname', null, '改名'));
html += '<div class="sg-tip" style="margin:6px 0 2px;">类型</div>';
html += '<div class="sg-group" id="sgbyLordTypes">' +
  LORD_TYPES.map(function (t) {
    return '<button class="sg-tg' + (gameData.lordType === t.key ? ' on' : '') + '" data-act="lordtype" data-key="' + t.key + '" title="' + t.desc + '">' + t.name + '</button>';
  }).join('') + '</div>';
html += '<div class="sg-tip" id="sgbyLordDesc">' +
  (curLord ? (curLord.name + '：' + curLord.desc) : '尚未选择主公类型（游戏开局会让你选）') + '</div>';
html += row('等级 / 经验', '<input class="sg-inp" id="ck_plv" type="number" value="' + n(gameData.playerLevel) + '" style="width:52px;">' +
  '<span class="sg-tip" style="margin:0;">/</span><input class="sg-inp" id="ck_pexp" type="number" value="' + n(gameData.lordExp) + '" style="width:62px;">' +
  btn('setlord', null, '设为'));
html += '<div class="sg-tip">等级无硬上限；武将名额上限当前 ' + maxGenerals() + ' 人</div>';

html += sec('兵力');
TROOPS.forEach(function (t) {
  html += row(t[1], '<input class="sg-inp" id="ck_t_' + t[0] + '" type="number" value="' + n((gameData.troops || {})[t[0]]) + '">' +
    btn('settroop', t[0], '设为'));
});
html += '<div class="sg-group">' + btn('alltroop', null, '全部 99999') + btn('heal', null, '伤兵清零') + '</div>';
html += '<div class="sg-group">' + btn('autoassign', 'avg', '自动配兵·平均', true) +
  btn('autoassign', 'weight', '按稀有度加权', true) + btn('recall', null, '全部收回') + '</div>';

html += sec('城建 / 科技 / 仓库 / 关卡');
html += '<div class="sg-group">' + btn('maxbuild', null, '建筑满级 Lv.5', true) +
  btn('maxtech', null, '科技满级 Lv.5', true) + btn('maxwh', null, '仓库满级 Lv.5', true) + '</div>';
html += '<div class="sg-group">' + btn('unlockstage', null, '关卡全解锁') + btn('clearstage', null, '关卡全通关') + '</div>';

html += sec('武将');
html += row('指定武将', '<select class="sg-sel" id="ck_gen" style="width:118px;">' +
  ELITE.map(function (g) { return '<option value="' + g.name + '">' + g.rarity + ' · ' + g.name + '</option>'; }).join('') +
  '</select>' + btn('addgen', null, '加入麾下', true));
html += '<div class="sg-group">' + btn('addall', 'S', '收藏全部 S') + btn('addall', 'SS', '收藏全部 SS') + btn('totavern', null, '塞进酒馆') + '</div>';
html += '<div class="sg-tip">酒馆外挂：<b id="ck_forceLabel">已关闭</b></div>';
html += '<div class="sg-group">' + btn('force', 'S', '必出 S', true) + btn('force', 'SS', '必出 SS', true) + btn('force', '', '关闭') + '</div>';
html += '<div class="sg-group">' + btn('pity', null, '下次触发保底') +
  '<input class="sg-inp" id="ck_genLv" type="number" value="60" style="width:52px;margin-left:5px;">' + btn('maxgen', null, '武将满级') + '</div>';
html += '<div class="sg-group">' + btn('recalcgen', null, '按等级重算属性（修复伤害）', true) + '</div>';
html += '<div class="sg-tip">若改过等级后战斗伤害只有 1 点，点上面这个按钮补齐攻/防/速成长即可。</div>';
html += '<div class="sg-tip" style="margin:8px 0 2px;">兵力不参与伤害：伤害 =（攻击 − 敌方防御）× 0.6；且主公等级越高敌人越强（难度系数 1 + (主公等级−1)×3%）。</div>';
html += '<div class="sg-group">' +
  '<span class="sg-tip" style="margin:0 5px 0 0;">攻击倍率</span>' +
  btn('boost', '1', '还原') + btn('boost', '5', '×5') + btn('boost', '20', '×20', true) + '</div>';

html += sec('道具 / 装备');
html += row('材料', '<select class="sg-sel" id="ck_mat" style="width:130px;">' +
  MAT.map(function (m) { return '<option value="' + m.name + '">' + m.name + '（' + m.note + '）</option>'; }).join('') +
  '</select>' + btn('addmat', null, '获取', true));
html += '<div class="sg-tip" id="ck_acqMat"></div>';
html += row('数量', '<input class="sg-inp" id="ck_matCount" type="number" value="999" style="width:60px;">' + btn('allmat', null, '全部材料补齐'));
html += row('装备', '<select class="sg-sel" id="ck_eq" style="width:174px;">' +
  EQ.map(function (e, i) { return '<option value="' + i + '">[' + e.rarity + '] ' + e.name + ' ' + eqStat(e) + '</option>'; }).join('') +
  '</select>' + btn('addeq', null, '获得', true));
html += '<div class="sg-tip" id="ck_acqEq"></div>';
html += '<div class="sg-group">' + btn('addeqrare', 'S', 'S 装全收') + btn('addeqrare', 'SS', 'SS 装全收') +
  btn('bestequip', null, '全员穿最强', true) + '</div>';
html += '<div class="sg-tip">铁匠铺外挂：<b id="ck_smithyLabel">已关闭</b></div>';
html += '<div class="sg-group">' + btn('smithy', 'SS', '必出 SS', true) + btn('smithy', 'S', '必出 S', true) + btn('smithy', '', '关闭') + '</div>';
html += '<div class="sg-tip">关卡 20% 稀有掉落（每次通关都有概率）：第3关 太平要术 · 第5关 方天画戟 · 第8关 青釭剑 · 第9关 连环铠 · 第11关 的卢马 · 第12关 七星刀 · 第13关 诸葛连弩 · 第14关 倚天剑 · 第15关 孙子兵法</div>';

html += sec('存档');
html += '<div class="sg-group">' + btn('export', null, '导出备份') + btn('import', null, '导入') +
  '<button class="sg-btn sg-danger" data-act="reset">清档</button>' + btn('resetpos', null, '重置位置') + '</div>';

html += '<div class="sg-tip" style="margin-top:10px;">拖动标题栏或小球可移动 · 收起后变小圆球贴边 · 主题会记住，面板每次打开默认贴右下</div>';
html += '</div></div>';

document.body.insertAdjacentHTML('beforeend', html);

var panel = document.getElementById('sgbyCheatPanel');

Array.prototype.forEach.call(panel.querySelectorAll('input'), function (el) {
  el.addEventListener('input', function () { if (el.id) dirty[el.id] = 1; });
});

var selMat = document.getElementById('ck_mat');
var selEq = document.getElementById('ck_eq');
function updAcq() {
  var mt = document.getElementById('ck_acqMat'), et = document.getElementById('ck_acqEq');
  if (mt && selMat) mt.textContent = '获取：' + matAcq(selMat.value);
  if (et && selEq) { var e = EQ[Number(selEq.value)]; et.textContent = '获取：' + (e ? eqAcq(e.name) : ''); }
}
if (selMat) selMat.addEventListener('change', updAcq);
if (selEq) selEq.addEventListener('change', updAcq);
updAcq();

panel.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!b) return;
  var act = b.getAttribute('data-act');
  var key = b.getAttribute('data-key');

  if (suppressClick && act === 'unfold') { suppressClick = false; return; }
  Object.keys(dirty).forEach(function (k) { delete dirty[k]; });

  if (act === 'close') { stopSync(); panel.remove(); return; }
  if (act === 'fold') { setMini(true); return; }
  if (act === 'unfold') { setMini(false); return; }
  if (act === 'theme') {
    applyTheme(key);
    var tn = (THEMES.filter(function (t) { return t.key === key; })[0] || THEMES[0]).name;
    fb('主题已切换：' + tn + (key === 'gold' ? '（游戏恢复原始配色）' : '（游戏配色已同步）'));
    return;
  }
  if (act === 'resetpos') { resetPos(); return; }
  if (act === 'setres') { setRes(key, val('ck_' + key)); return; }
  if (act === 'fillcap') { fillToCap(); return; }
  if (act === 'readres') { syncValues(true); fb('已同步为游戏当前值'); return; }
  if (act === 'setmo') { setMilitaryOrder(val('ck_mo')); return; }
  if (act === 'setname') { setLordName(); return; }
  if (act === 'lordtype') { setLordType(key); return; }
  if (act === 'setlord') { setLordLevel(); return; }
  if (act === 'settroop') { setTroop(key, val('ck_t_' + key)); return; }
  if (act === 'alltroop') { TROOPS.forEach(function (t) { gameData.troops[t[0]] = 99999; }); commit('兵力已补到 99999'); return; }
  if (act === 'heal') { TROOPS.forEach(function (t) { gameData.wounded[t[0]] = 0; }); commit('伤兵已清零'); return; }
  if (act === 'autoassign') { autoAssignTroops(key || 'avg'); return; }
  if (act === 'recall') { recallAllTroops(); return; }
  if (act === 'maxbuild') { maxBuildings(); return; }
  if (act === 'maxtech') { maxTech(); return; }
  if (act === 'maxwh') { maxWarehouse(); return; }
  if (act === 'unlockstage') { (gameData.stages || []).forEach(function (s) { s.unlocked = true; }); commit('关卡已全解锁'); return; }
  if (act === 'clearstage') { (gameData.stages || []).forEach(function (s) { s.unlocked = true; s.cleared = true; }); commit('关卡已全通关'); return; }
  if (act === 'addgen') { addGeneral(txt('ck_gen')); return; }
  if (act === 'addall') { addAllElite(key); return; }
  if (act === 'totavern') { pushToTavern(txt('ck_gen')); return; }
  if (act === 'force') { setForce(key || null); return; }
  if (act === 'pity') { pityNow(); return; }
  if (act === 'maxgen') { maxGeneralsLevel(); return; }
  if (act === 'recalcgen') { recalcAllStats(); return; }
  if (act === 'boost') { applyAtkMult(key); return; }
  if (act === 'addmat') { addMaterial(txt('ck_mat'), val('ck_matCount')); return; }
  if (act === 'allmat') { addAllMaterials(val('ck_matCount')); return; }
  if (act === 'addeq') { addEquip(Number(txt('ck_eq'))); return; }
  if (act === 'addeqrare') { addEquipByRarity(key); return; }
  if (act === 'bestequip') { equipBestForAll(); return; }
  if (act === 'smithy') { setForceSmithy(key || null); return; }
  if (act === 'export') { exportSave(); return; }
  if (act === 'import') { importSave(); return; }
  if (act === 'reset') { resetSave(); return; }
});

loadPos();
clampPanelPos();
makeDraggable();
startSync();
syncValues(false);

/* 恢复上次主题（会一并把游戏配色换回去） */
if (curTheme !== 'gold') {
  applyGameTheme(curTheme);
  fb('已恢复上次主题：' + curThemeName);
} else {
  fb('金手指已就位：右下角 · 可拖动 · 收起变小圆球');
}

window.addEventListener('resize', function () {
  setTimeout(function () { clampPanelPos(); snapBall(); }, 60);
});
toast('金手指已就位（右下角，可拖动）');
console.log('%c三国霸业 · 金手指 v2 已加载（游戏换肤 / 拖动 / 小球）', 'color:#c9a227;font-size:14px;font-weight:bold');
})();
