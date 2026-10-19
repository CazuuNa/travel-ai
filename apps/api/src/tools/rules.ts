import type { z } from 'zod';
import { toolSchemas } from '@travel/shared';
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function estimateBudget(p: z.infer<typeof toolSchemas.budget>) {
  const rooms = Math.ceil(p.people / 2);
  const items = {
    hotel: round(p.dailyHotel * (p.days - 1) * rooms),
    food: round(p.dailyFood * p.days * p.people),
    transport: round(p.dailyTransport * p.days * p.people),
    tickets: round(p.tickets * p.people),
  };
  const subtotal = round(Object.values(items).reduce((a, b) => a + b, 0));
  const reserve = round((subtotal * p.reservePercent) / 100);
  return {
    ...p,
    rooms,
    nights: p.days - 1,
    items,
    subtotal,
    reserve,
    total: round(subtotal + reserve),
    perPerson: round((subtotal + reserve) / p.people),
    assumptions:
      '酒店按每间每晚、2人一间；餐饮和市内交通按每人每天；门票按每人全程；不含往返大交通。',
  };
}
export function packingList(p: z.infer<typeof toolSchemas.packing>) {
  return {
    destination: p.destination,
    categories: [
      {
        name: '证件与支付',
        items: [
          '身份证或护照',
          '签证及入境材料（按目的地确认）',
          '银行卡和少量现金',
          '保险及紧急联系人副本',
        ],
      },
      {
        name: '衣物',
        items: [
          `换洗衣物 ${Math.min(p.days, 7)} 套（按洗衣安排调整）`,
          '舒适步行鞋',
          ...(/冷|凉|雪/.test(p.weather) ? ['保暖外套'] : ['轻薄外套']),
          ...(/雨|雪/.test(p.weather) ? ['雨伞或防水外套'] : []),
        ],
      },
      {
        name: '日常用品',
        items: [
          '洗漱用品',
          '充电器和转换插头',
          '个人常用药（核对入境规定）',
          '水杯与防晒用品',
          ...(p.withChildren ? ['儿童衣物与个人用品', '儿童证件'] : []),
          ...(/徒步|登山/.test(p.activities) ? ['离线地图', '户外防护装备'] : []),
        ],
      },
    ],
  };
}
/** Conservative routing data, not immigration-policy claims. */
export function visaGuide(p: z.infer<typeof toolSchemas.visa>) {
  const japan = /日本|Japan/i.test(p.destination);
  const china = /中国|China|CN/i.test(p.nationality);
  return {
    ...p,
    coverage: japan && china ? '官方查询指引' : '未覆盖此组合',
    policyVerifiedAt: null,
    conclusion: '本工具未收录经核验的签证政策结论，请核对目的地使领馆和移民部门。',
    checklist: [
      '确认护照有效期与空白页要求',
      '确认国籍、旅行目的和停留期限对应的签证类别',
      '核对材料、办理时间及过境规定',
    ],
    officialUrl: japan
      ? 'https://www.mofa.go.jp/j_info/visit/visa/index.html'
      : 'https://www.iatatravelcentre.com/',
    note: '不以模型推断替代官方入境规定；查询指引不代表免签或获签保证。',
  };
}
