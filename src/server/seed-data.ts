import type { BargainMode, Category, ItemStatus } from "@/lib/constants";

const image = (prompt: string) =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=landscape_4_3`;

export type SeedUser = {
  id: string;
  name: string;
  campus: string;
  role: "USER" | "ADMIN" | "TEACHER";
  studentNo: string;
  /** 仅用于演示环境：seed 时写入 scrypt 哈希，不落明文 */
  password: string;
  email: string;
  college: string;
  major: string;
  grade: string;
  className?: string | null;
  authStatus?: "UNAUTH" | "AUTHED";
  bio: string;
  avatarColor: string;
};

export type SeedItem = {
  id: string;
  title: string;
  category: Category;
  price: number;
  description: string;
  imageUrl: string;
  status: ItemStatus;
  userId: string;
  minutesAgo: number;
  sceneTags: string[];
  isGift?: boolean;
  bargainMode?: BargainMode;
  isbn?: string;
};

export type SeedFavorite = { userId: string; itemId: string; minutesAgo: number };

export type SeedWish = {
  id: string;
  userId: string;
  title: string;
  category: Category;
  expectPrice: number;
  description: string;
  /** 正数表示未来过期，负数表示已过期 */
  daysUntilExpire: number;
  isActive?: boolean;
  minutesAgo: number;
};

export type SeedBid = {
  id: string;
  itemId: string;
  userId: string;
  price: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  minutesAgo: number;
};

export type SeedGiftApproval = { giftItemId: string; userId: string; minutesAgo: number };

export type SeedMessage = {
  fromUserId: string;
  toUserId: string;
  content: string;
  relatedItemId?: string;
  relatedWishId?: string;
  minutesAgo: number;
};

export type SeedReport = {
  reporterUserId: string;
  targetItemId?: string;
  targetWishId?: string;
  reason: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  minutesAgo: number;
};

export type SeedLostFound = {
  id: string;
  kind: "LOST" | "FOUND";
  title: string;
  category: string;
  location: string;
  /** 物品丢失 / 捡到的时间，相对当前的小时数 */
  hoursAgo: number;
  description: string;
  imageUrl?: string;
  contact?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string;
  userId: string;
  minutesAgo: number;
};

export type SeedLostFoundMessage = {
  recordId: string;
  userId: string;
  content: string;
  minutesAgo: number;
};

/** 演示账号：学号 + 密码登录，普通用户与管理员在测试期可同时登录 */
export const SEED_USERS: SeedUser[] = [
  {
    id: "u_lin",
    name: "林小夏",
    campus: "数学与统计学院 · 大三",
    role: "USER",
    studentNo: "2023010101",
    password: "campus123",
    email: "linxiaoxia@campus.edu.cn",
    college: "数学与统计学院",
    major: "数学与应用数学",
    grade: "大三",
    className: "师范1234班",
    authStatus: "AUTHED",
    bio: "喜欢把用不上的东西交给需要的人，也常年在找二手教材。",
    avatarColor: "mint",
  },
  {
    id: "u_chen",
    name: "陈子昂",
    campus: "机械工程学院 · 大二",
    role: "USER",
    studentNo: "2023010102",
    password: "campus123",
    email: "chenziang@campus.edu.cn",
    college: "机械工程学院",
    major: "机械设计制造及其自动化",
    grade: "大二",
    className: "机械2301班",
    authStatus: "AUTHED",
    bio: "宿舍清仓专业户，台灯和球拍都在这边出。",
    avatarColor: "peach",
  },
  {
    id: "u_wang",
    name: "王一诺",
    campus: "外国语学院 · 大一",
    role: "USER",
    studentNo: "2023010103",
    password: "campus123",
    email: "wangyinuo@campus.edu.cn",
    college: "外国语学院",
    major: "英语",
    grade: "大一",
    bio: "刚开始整理宿舍，出一些数码和闲置书本。",
    avatarColor: "sky",
  },
  {
    id: "u_teacher",
    name: "周明远",
    campus: "学生事务中心 · 活动事务处",
    role: "TEACHER",
    studentNo: "T2023001",
    password: "teacher123",
    email: "zhoumingyuan@campus.edu.cn",
    college: "学生事务中心",
    major: "活动事务管理",
    grade: "教职工",
    bio: "负责校园活动审核与场地协调，欢迎同学提交活动申请。",
    avatarColor: "sand",
  },
  {
    id: "u_admin",
    name: "平台管理员",
    campus: "学生事务中心",
    role: "ADMIN",
    studentNo: "90000001",
    password: "admin123",
    email: "admin@campus.edu.cn",
    college: "学生事务中心",
    major: "校园服务",
    grade: "教职工",
    bio: "负责举报处理与平台审计，维护校园交易的信任环境。",
    avatarColor: "lilac",
  },
];

/** 演示数据：校园闲置场景，含在售/已下架、善意赠予、静默出价多种状态 */
export const SEED_ITEMS: SeedItem[] = [
  {
    id: "seed_ipad_air",
    title: "iPad Air 5 64G 深空灰",
    category: "数码",
    price: 2350,
    description: "去年买的，一直贴膜带壳使用，屏幕无划痕，电池健康 93%，附原装充电头。",
    imageUrl: image("used iPad Air tablet with grey case on a light wooden desk, soft daylight, minimal product photo"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 35,
    sceneTags: ["开学刚需"],
  },
  {
    id: "seed_math_book",
    title: "高等数学 同济第七版 上下册",
    category: "书籍",
    price: 25,
    description: "上册有少量铅笔笔记，可擦除；下册几乎全新。期末周急出。",
    imageUrl: image("two stack of chinese calculus textbooks on a library table, natural light, clean photo"),
    status: "ON_SALE",
    userId: "u_chen",
    minutesAgo: 92,
    sceneTags: ["期末清仓", "考研教材"],
    isbn: "9787040396638",
  },
  {
    id: "seed_keychron",
    title: "Keychron K2 机械键盘 茶轴",
    category: "数码",
    price: 260,
    description: "宿舍换了静音键盘，这把闲置。键帽无油光，蓝牙/有线双模正常，支持静默出价。",
    imageUrl: image("compact mechanical keyboard with beige keycaps on a tidy dorm desk, warm light"),
    status: "ON_SALE",
    userId: "u_wang",
    minutesAgo: 150,
    sceneTags: ["期末清仓"],
    bargainMode: "SILENT_BID",
  },
  {
    id: "seed_bed_curtain",
    title: "宿舍床帘 遮光款 上铺适用",
    category: "生活用品",
    price: 45,
    description: "毕业季转手，遮光效果好，含支架，已清洗消毒。",
    imageUrl: image("dormitory bunk bed with light blue privacy curtain, morning sunlight through window"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 210,
    sceneTags: ["开学刚需"],
  },
  {
    id: "seed_basketball",
    title: "斯伯丁 7 号篮球 室外款",
    category: "运动器材",
    price: 80,
    description: "打了半个学期，气足手感好，表面有正常磨损，不影响使用。",
    imageUrl: image("orange basketball on an outdoor court floor, late afternoon sunlight"),
    status: "ON_SALE",
    userId: "u_chen",
    minutesAgo: 260,
    sceneTags: ["开学刚需"],
  },
  {
    id: "seed_kaoyan_english",
    title: "考研英语真题 黄皮书 全套",
    category: "书籍",
    price: 30,
    description: "已上岸，真题含答案解析，笔记完整，适合 26 考研。",
    imageUrl: image("stack of english exam prep books with yellow covers on a study desk, soft light"),
    status: "SOLD_OUT",
    userId: "u_wang",
    minutesAgo: 340,
    sceneTags: ["考研教材"],
  },
  {
    id: "seed_desk_lamp",
    title: "护眼台灯 LED 三档调光",
    category: "生活用品",
    price: 35,
    description: "三档色温，USB 供电，宿舍书桌正好。灯泡无损坏。",
    imageUrl: image("white led desk lamp on a study desk beside notebooks, evening warm light"),
    status: "ON_SALE",
    userId: "u_chen",
    minutesAgo: 420,
    sceneTags: ["开学刚需"],
  },
  {
    id: "seed_instax",
    title: "富士拍立得 mini 11",
    category: "数码",
    price: 320,
    description: "毕业照拍完就闲置了，含相机包与剩余相纸 6 张。",
    imageUrl: image("instant film camera in pastel color on a wooden table with polaroid photos, soft natural light"),
    status: "SOLD_OUT",
    userId: "u_wang",
    minutesAgo: 500,
    sceneTags: ["期末清仓"],
  },
  {
    id: "seed_pencil_set",
    title: "素描铅笔套装 12 支装",
    category: "文具",
    price: 18,
    description: "画完课程作业剩余，未削封条完整，送橡皮与纸擦笔。",
    imageUrl: image("set of graphite sketching pencils arranged on white paper, top view, clean product photo"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 610,
    sceneTags: ["开学刚需"],
  },
  {
    id: "seed_badminton",
    title: "尤尼克斯羽毛球拍 双拍装",
    category: "运动器材",
    price: 150,
    description: "含拍套，磅数已拉好，适合入门。拍框无磕碰。",
    imageUrl: image("two badminton rackets with covers leaning against a gym wall, bright indoor light"),
    status: "ON_SALE",
    userId: "u_chen",
    minutesAgo: 720,
    sceneTags: ["实验室器材"],
  },
  {
    id: "seed_thermos",
    title: "保温杯 500ml 白色",
    category: "生活用品",
    price: 20,
    description: "保温 6 小时以上，杯身有轻微使用痕迹，内胆干净。",
    imageUrl: image("white stainless steel thermos bottle on a desk beside a laptop, soft daylight"),
    status: "ON_SALE",
    userId: "u_wang",
    minutesAgo: 840,
    sceneTags: [],
  },
  {
    id: "seed_linear_algebra",
    title: "线性代数 教材 + 习题册",
    category: "书籍",
    price: 12,
    description: "两本一起出，习题册写过前两章，其余空白。",
    imageUrl: image("linear algebra textbook and workbook on a desk with a pencil, natural light"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 960,
    sceneTags: ["考研教材"],
    isbn: "9787040396614",
  },
  {
    id: "seed_gift_lamp",
    title: "闲置护眼台灯 免费赠予",
    category: "生活用品",
    price: 0,
    description: "换了新的台灯，这只还能正常使用，送给需要的同学，自取。",
    imageUrl: image("warm desk lamp on a dormitory desk with books, cozy evening light"),
    status: "ON_SALE",
    userId: "u_chen",
    minutesAgo: 130,
    sceneTags: ["开学刚需"],
    isGift: true,
  },
  {
    id: "seed_gift_books",
    title: "考研政治全套资料 赠予",
    category: "书籍",
    price: 0,
    description: "已上岸，全套政治资料免费送给学弟学妹，笔记完整。",
    imageUrl: image("stack of political science study books on a desk, soft daylight"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 280,
    sceneTags: ["考研教材"],
    isGift: true,
  },
  {
    id: "seed_monitor",
    title: "24 寸显示器 静默出价",
    category: "数码",
    price: 600,
    description: "毕业清仓，支持静默出价，价高者得，校内自提。",
    imageUrl: image("computer monitor on a dormitory desk beside a laptop, soft evening light"),
    status: "ON_SALE",
    userId: "u_wang",
    minutesAgo: 190,
    sceneTags: ["期末清仓"],
    bargainMode: "SILENT_BID",
  },
  {
    id: "seed_switch_games",
    title: "Switch 游戏卡带 3 张",
    category: "数码",
    price: 210,
    description: "塞尔达、马车 8、动森，卡带成色好，静默出价转让。",
    imageUrl: image("three nintendo switch game cartridges on a wooden desk, clean top view"),
    status: "ON_SALE",
    userId: "u_lin",
    minutesAgo: 460,
    sceneTags: ["期末清仓"],
    bargainMode: "SILENT_BID",
  },
];

/** 演示收藏：包含「已收藏但商品已下架」的时序场景 */
export const SEED_FAVORITES: SeedFavorite[] = [
  { userId: "u_lin", itemId: "seed_keychron", minutesAgo: 120 },
  { userId: "u_lin", itemId: "seed_badminton", minutesAgo: 60 },
  { userId: "u_chen", itemId: "seed_ipad_air", minutesAgo: 80 },
  { userId: "u_wang", itemId: "seed_pencil_set", minutesAgo: 200 },
  { userId: "u_wang", itemId: "seed_kaoyan_english", minutesAgo: 300 },
  { userId: "u_chen", itemId: "seed_monitor", minutesAgo: 40 },
];

/** 演示意向收藏：匿名关注度统计，卖家只能看到数字 */
export const SEED_INTENT_FAVORITES: SeedFavorite[] = [
  { userId: "u_chen", itemId: "seed_ipad_air", minutesAgo: 70 },
  { userId: "u_wang", itemId: "seed_ipad_air", minutesAgo: 30 },
  { userId: "u_lin", itemId: "seed_monitor", minutesAgo: 55 },
  { userId: "u_chen", itemId: "seed_gift_lamp", minutesAgo: 25 },
];

/** 演示求购心愿：含有效与已过期两种状态 */
export const SEED_WISHES: SeedWish[] = [
  {
    id: "wish_politics",
    userId: "u_lin",
    title: "求购考研政治全套资料",
    category: "书籍",
    expectPrice: 60,
    description: "想要肖秀荣全套，笔记完整优先，可以校内自提。",
    daysUntilExpire: 10,
    minutesAgo: 90,
  },
  {
    id: "wish_bike",
    userId: "u_chen",
    title: "求购二手通勤自行车",
    category: "运动器材",
    expectPrice: 300,
    description: "能骑就行，车闸正常，最好带车锁。",
    daysUntilExpire: 5,
    minutesAgo: 200,
  },
  {
    id: "wish_monitor",
    userId: "u_wang",
    title: "求购 24 寸显示器",
    category: "数码",
    expectPrice: 500,
    description: "宿舍用，1080P 即可，接口正常。",
    daysUntilExpire: -2,
    minutesAgo: 3200,
  },
  {
    id: "wish_lab_folder",
    userId: "u_admin",
    title: "求购实验报告文件夹",
    category: "文具",
    expectPrice: 15,
    description: "A4 透明文件夹，二手的也可以。",
    daysUntilExpire: 14,
    minutesAgo: 260,
  },
];

/** 演示出价：已接受 / 待处理 / 已拒绝 三种状态 */
export const SEED_BIDS: SeedBid[] = [
  {
    id: "bid_keychron_lin",
    itemId: "seed_keychron",
    userId: "u_lin",
    price: 240,
    status: "ACCEPTED",
    minutesAgo: 100,
  },
  {
    id: "bid_monitor_chen",
    itemId: "seed_monitor",
    userId: "u_chen",
    price: 550,
    status: "PENDING",
    minutesAgo: 45,
  },
  {
    id: "bid_switch_chen",
    itemId: "seed_switch_games",
    userId: "u_chen",
    price: 180,
    status: "REJECTED",
    minutesAgo: 150,
  },
];

/** 演示善意认可 */
export const SEED_GIFT_APPROVALS: SeedGiftApproval[] = [
  { giftItemId: "seed_gift_lamp", userId: "u_lin", minutesAgo: 50 },
  { giftItemId: "seed_gift_lamp", userId: "u_wang", minutesAgo: 20 },
  { giftItemId: "seed_gift_books", userId: "u_chen", minutesAgo: 90 },
];

/** 演示聊天会话：静默出价已接受后可对话；心愿来源会话 */
export const SEED_MESSAGES: SeedMessage[] = [
  {
    fromUserId: "u_lin",
    toUserId: "u_wang",
    relatedItemId: "seed_keychron",
    content: "你好，键盘的出价你接受了，什么时候方便交易？",
    minutesAgo: 80,
  },
  {
    fromUserId: "u_wang",
    toUserId: "u_lin",
    relatedItemId: "seed_keychron",
    content: "明天下午三点在图书馆门口可以吗？",
    minutesAgo: 70,
  },
  {
    fromUserId: "u_lin",
    toUserId: "u_wang",
    relatedItemId: "seed_keychron",
    content: "可以的，到时候联系。",
    minutesAgo: 60,
  },
  {
    fromUserId: "u_chen",
    toUserId: "u_lin",
    relatedWishId: "wish_politics",
    content: "我这边有一套肖秀荣，笔记比较全，方便看看吗？",
    minutesAgo: 30,
  },
];

/** 演示举报：待处理队列 */
export const SEED_REPORTS: SeedReport[] = [
  {
    reporterUserId: "u_chen",
    targetItemId: "seed_switch_games",
    reason: "卡带描述与实物不符，联系后卖家不肯提供实拍图。",
    status: "PENDING",
    minutesAgo: 25,
  },
  {
    reporterUserId: "u_wang",
    targetWishId: "wish_bike",
    reason: "求购信息疑似广告引流，非本校学生。",
    status: "PENDING",
    minutesAgo: 15,
  },
];

/** 演示失物招领：覆盖已通过、待审核、已驳回三种审核状态 */
export const SEED_LOST_FOUND: SeedLostFound[] = [
  {
    id: "lf_campus_card",
    kind: "FOUND",
    title: "捡到一张校园卡，姓名王同学",
    category: "证件卡片",
    location: "第一食堂二楼 3 号窗口",
    hoursAgo: 3,
    description: "中午打饭时在窗口台面上捡到的，卡面有些磨损，已经交给二楼值班阿姨保管。",
    imageUrl: image("a student campus id card lying on a cafeteria table, soft indoor daylight, shallow depth of field"),
    contact: "微信：chen_ziang（也可直接到食堂二楼值班台领取）",
    status: "APPROVED",
    userId: "u_chen",
    minutesAgo: 150,
  },
  {
    id: "lf_blue_bottle",
    kind: "LOST",
    title: "丢失蓝色保温杯 杯身有猫咪贴纸",
    category: "生活用品",
    location: "图书馆三楼自习区靠窗座位",
    hoursAgo: 26,
    description: "昨天下午在图书馆自习后忘记带走，杯盖是磨砂白，杯身贴了一只橘猫贴纸，里面还有半杯水。",
    contact: "QQ：1029384756，找到请一定联系我，谢谢！",
    status: "APPROVED",
    userId: "u_lin",
    minutesAgo: 1200,
  },
  {
    id: "lf_airpods",
    kind: "FOUND",
    title: "捡到 AirPods 充电盒（无耳机）",
    category: "数码电子",
    location: "体育馆二楼羽毛球场地边",
    hoursAgo: 7,
    description: "白色充电盒，背面有一道细划痕，已放到体育馆前台失物箱，凭解锁或配对记录认领。",
    imageUrl: image("white wireless earbuds charging case on a gym floor court, bright indoor lighting, minimal photo"),
    status: "APPROVED",
    userId: "u_wang",
    minutesAgo: 480,
  },
  {
    id: "lf_dorm_key",
    kind: "LOST",
    title: "丢了一串宿舍钥匙，挂着绿色门禁卡",
    category: "钥匙",
    location: "6 号宿舍楼一层洗衣房",
    hoursAgo: 49,
    description: "一串三把钥匙加一个绿色门禁卡套，可能落在洗衣机上或走廊长椅。捡到的同学请联系我，必有感谢。",
    contact: "电话：138****6621",
    status: "APPROVED",
    userId: "u_lin",
    minutesAgo: 2600,
  },
  {
    id: "lf_id_card_pending",
    kind: "FOUND",
    title: "教学楼 B203 捡到一张身份证",
    category: "证件卡片",
    location: "教学楼 B203 教室最后一排",
    hoursAgo: 1,
    description: "下课后在桌肚里发现，为避免泄露隐私暂不公开姓名，请失主私信描述姓名后领取。",
    status: "PENDING",
    userId: "u_wang",
    minutesAgo: 55,
  },
  {
    id: "lf_umbrella_rejected",
    kind: "LOST",
    title: "丢了一把黑色雨伞",
    category: "其他",
    location: "校园内",
    hoursAgo: 72,
    description: "就是一把普通的黑色雨伞，不记得落在哪里了。",
    status: "REJECTED",
    reviewNote: "信息过于笼统，请补充雨伞品牌、明显特征与丢失范围后重新发布。",
    userId: "u_chen",
    minutesAgo: 4000,
  },
];

/** 演示失物招领留言：失主与拾获者通过留言确认物品，不公开手机号等隐私 */
export const SEED_LOST_FOUND_MESSAGES: SeedLostFoundMessage[] = [
  {
    recordId: "lf_campus_card",
    userId: "u_lin",
    content: "同学你好，这张卡可能是我室友的，请问卡面姓名是「王」开头吗？",
    minutesAgo: 120,
  },
  {
    recordId: "lf_campus_card",
    userId: "u_chen",
    content: "是的，姓名是王同学，我已经交给二楼值班阿姨了，让他带学生证去领就行。",
    minutesAgo: 110,
  },
  {
    recordId: "lf_airpods",
    userId: "u_lin",
    content: "请问充电盒背面那道划痕是在右下角吗？我的好像是这个。",
    minutesAgo: 200,
  },
];

/** ============ 活动事务域（V7 合并新增） ============ */

export type SeedActivity = {
  id: string;
  title: string;
  type: string;
  source: string;
  organizer: string;
  /** 相对当前的分钟数：正数表示未来，负数表示过去 */
  startInMinutes: number;
  durationMinutes: number;
  /** 报名截止相对当前分钟数 */
  deadlineInMinutes: number;
  /** V8：作品提交截止相对当前分钟数；为空回落到活动结束 */
  submissionDeadlineInMinutes?: number;
  /** V8：无限名额 */
  isUnlimited?: boolean;
  /** V8：是否开启作品展示专区 */
  showcaseEnabled?: boolean;
  location: string;
  capacity: number;
  registrationMode: "INTERNAL" | "EXTERNAL" | "BOTH";
  externalUrl?: string;
  summary: string;
  description?: string;
  coverUrl?: string;
  tags: string[];
  creditPoints?: number;
  publisherContact?: string;
  qqGroup?: string;
  targetCollege?: string[];
  targetGrade?: string[];
  targetMajor?: string[];
  targetClass?: string[];
  status: "PENDING" | "PUBLISHED" | "ONGOING" | "ENDED" | "CANCELLED" | "REJECTED";
  reviewNote?: string;
  createdBy: string;
  minutesAgo: number;
};

export type SeedRegistration = {
  activityId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  minutesAgo: number;
};

export type SeedActivityMessage = {
  activityId: string;
  userId: string;
  content: string;
  minutesAgo: number;
};

/** 演示活动：覆盖官方 / 校级 / 院系 / 社团、站内 / 外链、已结束与待审核 */
export const SEED_ACTIVITIES: SeedActivity[] = [
  {
    id: "act_ai_lecture",
    title: "AI 时代的学习方式：从工具到方法",
    type: "LECTURE",
    source: "OFFICIAL",
    organizer: "学生事务中心",
    startInMinutes: 2880,
    durationMinutes: 120,
    deadlineInMinutes: 1440,
    location: "图书馆报告厅 A101",
    capacity: 200,
    registrationMode: "INTERNAL",
    summary: "面向全校的公开讲座，聊聊大模型如何改变学习与写作，现场可提问。",
    description:
      "主讲人：计算机学院 李教授。\n\n内容提纲：\n1. 大模型能做什么、不能做什么\n2. 如何用 AI 辅助阅读与写作而不失去独立思考\n3. 学术诚信边界与常见误区\n4. 现场答疑\n\n参与可计入第二课堂学分。",
    coverUrl: image("modern university lecture hall with warm lighting, students seated, projection screen, clean minimal photography"),
    tags: ["CREDIT"],
    creditPoints: 0.5,
    publisherContact: "学生事务中心 李老师 · 010-6234 8801",
    qqGroup: "789123456",
    targetCollege: [],
    targetGrade: [],
    status: "PUBLISHED",
    createdBy: "u_teacher",
    minutesAgo: 4320,
  },
  {
    id: "act_volunteer_park",
    title: "周末社区公园清洁志愿服务",
    type: "VOLUNTEER",
    source: "OFFICIAL",
    organizer: "青年志愿者协会",
    startInMinutes: 7200,
    durationMinutes: 240,
    deadlineInMinutes: 5760,
    location: "东门集合 · 校车统一前往",
    capacity: 30,
    registrationMode: "INTERNAL",
    summary: "清理公园步道垃圾、整理共享单车，提供手套与垃圾袋，记录志愿时长。",
    description:
      "集合时间：上午 8:30 东门校车点。\n着装要求：运动鞋、长裤。\n服务内容：步道清洁、单车归位、文明引导。\n\n活动结束后统一录入志愿时长 4 小时。",
    coverUrl: image("volunteers cleaning a city park in morning light, wearing vests, green trees, documentary style photo"),
    tags: ["HOURS"],
    creditPoints: 1,
    publisherContact: "青年志愿者协会 · 王同学 138-0000-1234",
    qqGroup: "612345789",
    targetCollege: [],
    targetGrade: [],
    status: "PUBLISHED",
    createdBy: "u_teacher",
    minutesAgo: 3600,
  },
  {
    id: "act_photo_club",
    title: "校园秋日人像摄影外拍（社团内部）",
    type: "CLUB",
    source: "CLUB",
    organizer: "摄影协会",
    startInMinutes: 4320,
    durationMinutes: 180,
    deadlineInMinutes: 2880,
    location: "老校区银杏大道",
    capacity: 40,
    registrationMode: "INTERNAL",
    summary: "摄影协会秋季外拍，提供模特与基础器材，需报名审核后加入群聊。",
    description:
      "活动流程：14:00 集合讲解 → 14:30 分组拍摄 → 16:30 作品互评。\n\n报名后请等待社团负责人审核，通过后会拉入活动群。自带相机优先，手机也可参与。",
    coverUrl: image("autumn ginkgo avenue on campus, golden leaves, students taking photos, soft afternoon light"),
    tags: ["AUDIT"],
    status: "PUBLISHED",
    createdBy: "u_chen",
    minutesAgo: 2000,
  },
  {
    id: "act_programming_contest",
    title: "校园程序设计新生赛",
    type: "COMPETITION",
    source: "SCHOOL",
    organizer: "教务处 · 计算机学院",
    startInMinutes: 14400,
    durationMinutes: 300,
    deadlineInMinutes: 12960,
    location: "实验楼 B 座机房 301-305",
    capacity: 100,
    isUnlimited: true,
    submissionDeadlineInMinutes: 1200,
    showcaseEnabled: true,
    registrationMode: "INTERNAL",
    summary: "面向全校新生的编程入门赛，个人赛制，设一二三等奖与参与证书。",
    description:
      "比赛时长 5 小时，支持 C / C++ / Java / Python。\n赛题难度以基础语法与简单算法为主，欢迎零基础同学体验。\n\n请自带学生证，机房统一提供环境。",
    coverUrl: image("university computer lab with rows of monitors, students coding, cool blue screen light, clean photo"),
    tags: ["PRIZE"],
    status: "PUBLISHED",
    createdBy: "u_teacher",
    minutesAgo: 5000,
  },
  {
    id: "act_career_talk",
    title: "互联网行业求职分享会（计算机学院专场）",
    type: "CAREER",
    source: "COLLEGE",
    organizer: "计算机学院就业指导中心",
    startInMinutes: 10080,
    durationMinutes: 150,
    deadlineInMinutes: 8640,
    location: "教学楼 C201",
    capacity: 150,
    registrationMode: "INTERNAL",
    summary: "校友回归分享简历准备、实习投递与面试经验，现场可修改简历。",
    description:
      "分享嘉宾：2018 级校友，现就职于头部互联网公司。\n\n环节：行业趋势 30 分钟 → 简历与面试 60 分钟 → 自由交流 60 分钟。\n建议携带纸质简历。",
    coverUrl: image("university career talk event, speaker on stage, students listening in auditorium, warm indoor light"),
    tags: ["CREDIT"],
    creditPoints: 0.3,
    publisherContact: "计算机学院就业指导中心 · 张老师",
    qqGroup: "523456789",
    targetCollege: ["计算机学院", "数学与统计学院"],
    targetGrade: [],
    status: "PUBLISHED",
    createdBy: "u_teacher",
    minutesAgo: 6000,
  },
  {
    id: "act_ended_library",
    title: "图书馆数据库检索培训（已结束）",
    type: "LECTURE",
    source: "OFFICIAL",
    organizer: "图书馆信息部",
    startInMinutes: -4320,
    durationMinutes: 120,
    deadlineInMinutes: -5760,
    location: "图书馆电子阅览室 204",
    capacity: 80,
    registrationMode: "INTERNAL",
    summary: "讲解知网、Web of Science 检索技巧与文献管理工具使用。",
    description: "已结束的活动，用于演示活动归档与历史报名记录。",
    tags: ["CREDIT"],
    status: "ENDED",
    createdBy: "u_teacher",
    minutesAgo: 10000,
  },
  {
    id: "act_pending_guitar",
    title: "吉他社秋季招新弹唱会",
    type: "CLUB",
    source: "CLUB",
    organizer: "吉他社",
    startInMinutes: 5760,
    durationMinutes: 120,
    deadlineInMinutes: 4320,
    location: "学生活动中心小剧场",
    capacity: 50,
    registrationMode: "INTERNAL",
    summary: "社团招新弹唱会，现场有设备体验与老成员表演，提供简单茶点。",
    description: "待审核示例：社团提交后需由活动事务处老师审核，通过后才会公开展示。",
    tags: ["MEAL"],
    status: "PENDING",
    createdBy: "u_chen",
    minutesAgo: 300,
  },
  {
    id: "act_external_innovation",
    title: "全国大学生创新创业大赛校内选拔（外链报名）",
    type: "COMPETITION",
    source: "SCHOOL",
    organizer: "创新创业学院",
    startInMinutes: 21600,
    durationMinutes: 480,
    deadlineInMinutes: 20160,
    location: "创新创业孵化基地",
    capacity: 100,
    registrationMode: "EXTERNAL",
    externalUrl: "https://example.edu.cn/innovation-competition",
    summary: "校内选拔赛，报名与材料提交均在主办方系统完成，平台仅做信息展示。",
    description:
      "本活动采用外链报名，点击「前往主办方报名」后将在新标签页打开主办方系统。\n平台不代管报名结果，名额与审核以主办方为准。",
    tags: ["PRIZE"],
    status: "PUBLISHED",
    createdBy: "u_admin",
    minutesAgo: 7000,
  },
];

/** 演示报名：覆盖已报名、需审核待处理两种状态 */
export const SEED_REGISTRATIONS: SeedRegistration[] = [
  { activityId: "act_ai_lecture", userId: "u_lin", status: "APPROVED", minutesAgo: 3000 },
  { activityId: "act_ai_lecture", userId: "u_chen", status: "APPROVED", minutesAgo: 2600 },
  { activityId: "act_ai_lecture", userId: "u_wang", status: "APPROVED", minutesAgo: 1800 },
  { activityId: "act_volunteer_park", userId: "u_lin", status: "APPROVED", minutesAgo: 2400 },
  { activityId: "act_volunteer_park", userId: "u_wang", status: "APPROVED", minutesAgo: 1500 },
  { activityId: "act_photo_club", userId: "u_chen", status: "PENDING", minutesAgo: 900 },
  { activityId: "act_photo_club", userId: "u_wang", status: "PENDING", minutesAgo: 700 },
  { activityId: "act_programming_contest", userId: "u_wang", status: "APPROVED", minutesAgo: 3200 },
  { activityId: "act_programming_contest", userId: "u_chen", status: "APPROVED", minutesAgo: 2800 },
  { activityId: "act_programming_contest", userId: "u_lin", status: "APPROVED", minutesAgo: 2600 },
  { activityId: "act_career_talk", userId: "u_chen", status: "APPROVED", minutesAgo: 2100 },
  { activityId: "act_ended_library", userId: "u_lin", status: "APPROVED", minutesAgo: 9000 },
];

/** 演示活动留言：公开答疑 */
export const SEED_ACTIVITY_MESSAGES: SeedActivityMessage[] = [
  {
    activityId: "act_ai_lecture",
    userId: "u_lin",
    content: "请问需要提前签到吗？报告厅会不会坐满？",
    minutesAgo: 700,
  },
  {
    activityId: "act_ai_lecture",
    userId: "u_teacher",
    content: "提前 10 分钟到场即可，门口有签到二维码；座位先到先得，建议早点来。",
    minutesAgo: 650,
  },
  {
    activityId: "act_volunteer_park",
    userId: "u_wang",
    content: "志愿时长是活动结束后统一录入吗？",
    minutesAgo: 400,
  },
];

/** V7.1 行政通知：全员通知 + 学院 / 年级 / 专业 / 班级定向通知 */
export type SeedNotice = {
  id: string;
  title: string;
  content: string;
  dept: string;
  targetCollege?: string | null;
  targetGrade?: string | null;
  targetMajor?: string | null;
  targetClass?: string | null;
  createdBy: string;
  minutesAgo: number;
};

export const SEED_NOTICES: SeedNotice[] = [
  {
    id: "notice_bike_safety",
    title: "校园电动车安全骑行与充电提醒",
    content:
      "近期校内电动车数量增加，请同学们在指定区域充电，禁止在宿舍楼道停放或飞线充电。骑行时减速慢行，夜间开启车灯。",
    dept: "保卫处",
    createdBy: "u_admin",
    minutesAgo: 300,
  },
  {
    id: "notice_class_training",
    title: "师范1234班本周教学技能训练安排",
    content:
      "本周四下午 14:00 在教师教育实训中心 302 进行教学技能训练，请同学们提前准备 10 分钟微课教案，签到计入师范生技能考核。",
    dept: "数学与统计学院",
    targetCollege: "数学与统计学院",
    targetGrade: "大三",
    targetMajor: "数学与应用数学",
    targetClass: "师范1234班",
    createdBy: "u_admin",
    minutesAgo: 120,
  },
  {
    id: "notice_cs_job_fair",
    title: "计算机学院专场招聘会报名提醒",
    content:
      "下周三 9:00-16:00 在体育馆举办计算机类专场招聘会，共 42 家企业参会，请提前在就业系统预约入场时段并携带学生证。",
    dept: "计算机学院",
    targetCollege: "计算机学院",
    createdBy: "u_admin",
    minutesAgo: 600,
  },
  {
    id: "notice_library_repair",
    title: "图书馆电子阅览室设备检修通知",
    content:
      "本周日 8:00-12:00 电子阅览室 204 进行设备检修，期间暂停使用，自习区正常开放，请合理安排学习计划。",
    dept: "图书馆",
    createdBy: "u_teacher",
    minutesAgo: 2000,
  },
];

/** V7.1 首页热门活动池：内部活动 + 外部链接活动 */
export type SeedHotActivity = {
  sortOrder: number;
  isExternal?: boolean;
  externalUrl?: string;
  activityId?: string;
  title: string;
  coverUrl?: string;
  minutesAgo: number;
};

export const SEED_HOT_ACTIVITIES: SeedHotActivity[] = [
  { sortOrder: 1, activityId: "act_ai_lecture", title: "AI 时代的学习方式", minutesAgo: 5000 },
  {
    sortOrder: 2,
    isExternal: true,
    externalUrl: "https://trae.hunao.xin/",
    title: "Trae 校园黑客松 · 校外活动",
    coverUrl: image("creative hackathon event poster, students coding in a bright modern space, mint green accent, clean design"),
    minutesAgo: 4000,
  },
  { sortOrder: 3, activityId: "act_volunteer_park", title: "周末社区公园清洁志愿服务", minutesAgo: 3000 },
  { sortOrder: 4, activityId: "act_career_talk", title: "互联网行业求职分享会", minutesAgo: 2000 },
];


/** ============ V8 作品展示专区演示数据 ============ */

export type SeedWorkCategory = {
  id: string;
  activityId: string;
  name: string;
  sortOrder: number;
};

export const SEED_WORK_CATEGORIES: SeedWorkCategory[] = [
  { id: "wc_prog_creative", activityId: "act_programming_contest", name: "创意设计", sortOrder: 1 },
  { id: "wc_prog_tech", activityId: "act_programming_contest", name: "技术实现", sortOrder: 2 },
  { id: "wc_prog_value", activityId: "act_programming_contest", name: "社会价值", sortOrder: 3 },
];

export type SeedWork = {
  id: string;
  activityId: string;
  categoryId: string;
  createdBy: string;
  authorName: string;
  title: string;
  description: string;
  workUrl?: string;
  coverUrl?: string;
  media: { type: "IMAGE" | "VIDEO" | "FILE"; url: string; name?: string }[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  featured?: boolean;
  pinned?: boolean;
  sortOrder?: number;
  minutesAgo: number;
};

export const SEED_WORKS: SeedWork[] = [
  {
    id: "work_book_map",
    activityId: "act_programming_contest",
    categoryId: "wc_prog_creative",
    createdBy: "u_chen",
    authorName: "陈子昂 · 机械工程学院 2023 级",
    title: "校园二手书漂流地图",
    description:
      "<p><strong>作品简介：</strong>把宿舍楼、教学楼与图书馆的二手书流转点标注在一张可交互地图上，同学扫码即可查看当前位置可交换的书目。</p><ul><li>支持按学院与课程筛选</li><li>扫码登记后自动生成漂流记录</li><li>移动端优先，首屏 1.2 秒内完成渲染</li></ul><p>作品采用 <em>Next.js + SQLite</em> 实现，代码与演示视频见下方资源。</p>",
    workUrl: "https://example.edu.cn/works/book-map",
    coverUrl: image("interactive campus map on a laptop screen with book icons, clean minimal UI, mint green accent"),
    media: [
      {
        type: "IMAGE",
        url: image("students exchanging used books at a campus book corner, warm daylight, documentary photo"),
        name: "线下漂流点实拍",
      },
      {
        type: "FILE",
        url: "https://example.edu.cn/files/book-map-design.pdf",
        name: "产品设计说明.pdf",
      },
    ],
    status: "APPROVED",
    featured: true,
    pinned: true,
    sortOrder: 0,
    minutesAgo: 900,
  },
  {
    id: "work_course_helper",
    activityId: "act_programming_contest",
    categoryId: "wc_prog_tech",
    createdBy: "u_wang",
    authorName: "王一诺 · 外国语学院 2023 级",
    title: "新生选课助手：三分钟生成个人课表",
    description:
      "<p>面向新生的选课辅助工具：输入专业与兴趣方向，自动生成不冲突的课表草案，并给出通识课搭配建议。</p><ol><li>课程冲突检测</li><li>按空教室推荐自习位置</li><li>一键导出 ICS 日历</li></ol><p>演示站点：<a href=\"https://example.edu.cn/works/course-helper\">course-helper.demo</a></p>",
    workUrl: "https://example.edu.cn/works/course-helper",
    coverUrl: image("university course timetable dashboard on a tablet, pastel colors, clean interface design"),
    media: [
      {
        type: "VIDEO",
        url: "https://example.edu.cn/files/course-helper-demo.mp4",
        name: "3 分钟功能演示",
      },
    ],
    status: "APPROVED",
    featured: true,
    sortOrder: 1,
    minutesAgo: 600,
  },
];
