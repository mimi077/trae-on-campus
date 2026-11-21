export const CATEGORIES = ["数码", "书籍", "文具", "生活用品", "运动器材", "其他"] as const;
export type Category = (typeof CATEGORIES)[number];

export const ITEM_STATUSES = ["ON_SALE", "SOLD_OUT", "EXPIRED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const STATUS_LABEL: Record<ItemStatus, string> = {
  ON_SALE: "在售",
  SOLD_OUT: "已下架",
  EXPIRED: "已到期",
};

/** 闲置上架有效期：超过 14 天自动标记失效，提醒卖家重新上架或删除 */
export const ITEM_EXPIRE_DAYS = 14;
export const ITEM_EXPIRE_MS = ITEM_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

/** 一键流转标签：发布时多选，卡片与详情直接展示 */
export const DEAL_TAGS = ["急出", "可小刀", "只自提", "可换物"] as const;
export type DealTag = (typeof DEAL_TAGS)[number];

export const DEAL_TAG_HINT: Record<DealTag, string> = {
  急出: "希望尽快出手，优先回复",
  可小刀: "价格有商量空间",
  只自提: "仅在宿舍/教学楼当面自提",
  可换物: "支持以物换物，可换书或配件",
};

/** 校园场景标签：发布时可多选，广场可筛选 */
export const SCENE_TAGS = ["开学刚需", "期末清仓", "考研教材", "实验室器材"] as const;
export type SceneTag = (typeof SCENE_TAGS)[number];

export const BARGAIN_MODES = ["FREE_BARGAIN", "SILENT_BID"] as const;
export type BargainMode = (typeof BARGAIN_MODES)[number];

export const BARGAIN_LABEL: Record<BargainMode, string> = {
  FREE_BARGAIN: "自由议价",
  SILENT_BID: "静默出价",
};

export const BID_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const BID_STATUS_LABEL: Record<BidStatus, string> = {
  PENDING: "待处理",
  ACCEPTED: "已接受",
  REJECTED: "已拒绝",
};

export const REPORT_STATUSES = ["PENDING", "RESOLVED", "REJECTED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: "待处理",
  RESOLVED: "已处理",
  REJECTED: "已驳回",
};

export const WISH_VALID_DAYS = [7, 14] as const;
export type WishValidDays = (typeof WISH_VALID_DAYS)[number];

/** 失物招领：LOST=寻物启事（丢了东西） / FOUND=失物招领（捡到东西） */
export const LOST_FOUND_KINDS = ["LOST", "FOUND"] as const;
export type LostFoundKind = (typeof LOST_FOUND_KINDS)[number];

export const LOST_FOUND_KIND_LABEL: Record<LostFoundKind, string> = {
  LOST: "寻物启事",
  FOUND: "失物招领",
};

export const LOST_FOUND_KIND_HINT: Record<LostFoundKind, string> = {
  LOST: "我丢了东西，希望大家帮我留意",
  FOUND: "我捡到了东西，等待失主认领",
};

export const LOST_FOUND_CATEGORIES = [
  "证件卡片",
  "数码电子",
  "钥匙",
  "书籍文具",
  "衣物饰品",
  "生活用品",
  "其他",
] as const;
export type LostFoundCategory = (typeof LOST_FOUND_CATEGORIES)[number];

export const LOST_FOUND_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CLOSED"] as const;
export type LostFoundStatus = (typeof LOST_FOUND_STATUSES)[number];

export const LOST_FOUND_STATUS_LABEL: Record<LostFoundStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  CLOSED: "已结束",
};

/** 带「全部」选项的筛选枚举，供 zod 与前端 Tab 共用 */
export const LOST_FOUND_KIND_FILTERS = ["ALL", ...LOST_FOUND_KINDS] as const;
export const LOST_FOUND_CATEGORY_FILTERS = ["ALL", ...LOST_FOUND_CATEGORIES] as const;
export const LOST_FOUND_STATUS_FILTERS = ["ALL", ...LOST_FOUND_STATUSES] as const;

/** 失物招领图片分类图标映射（复用 ItemImage 时传入 category） */
export const LOST_FOUND_ICON_CATEGORY: Record<string, string> = {
  证件卡片: "文具",
  数码电子: "数码",
  钥匙: "其他",
  书籍文具: "书籍",
  衣物饰品: "生活用品",
  生活用品: "生活用品",
  其他: "其他",
};

/** ============ 活动事务域（V7 合并新增） ============ */

export const ACTIVITY_TYPES = [
  "LECTURE",
  "COMPETITION",
  "VOLUNTEER",
  "CLUB",
  "CAREER",
  "SPORTS",
  "OTHER",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  LECTURE: "讲座分享",
  COMPETITION: "竞赛比赛",
  VOLUNTEER: "志愿服务",
  CLUB: "社团活动",
  CAREER: "就业宣讲",
  SPORTS: "文体活动",
  OTHER: "其他活动",
};

export const ACTIVITY_SOURCES = ["OFFICIAL", "SCHOOL", "COLLEGE", "CLUB"] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const ACTIVITY_SOURCE_LABEL: Record<ActivitySource, string> = {
  OFFICIAL: "官方活动",
  SCHOOL: "校级活动",
  COLLEGE: "院系活动",
  CLUB: "社团活动",
};

export const ACTIVITY_TAGS = ["CREDIT", "HOURS", "PRIZE", "AUDIT", "MEAL"] as const;
export type ActivityTag = (typeof ACTIVITY_TAGS)[number];

export const ACTIVITY_TAG_LABEL: Record<ActivityTag, string> = {
  CREDIT: "可加学分",
  HOURS: "志愿时长",
  PRIZE: "有奖品",
  AUDIT: "需报名审核",
  MEAL: "提供餐饮",
};

export const ACTIVITY_MODES = ["INTERNAL", "EXTERNAL", "BOTH"] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

export const ACTIVITY_MODE_LABEL: Record<ActivityMode, string> = {
  INTERNAL: "站内报名",
  EXTERNAL: "外链报名",
  BOTH: "站内 + 外链",
};

export const ACTIVITY_STATUSES = [
  "PENDING",
  "PUBLISHED",
  "ONGOING",
  "ENDED",
  "CANCELLED",
  "REJECTED",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  PENDING: "待审核",
  PUBLISHED: "报名中",
  ONGOING: "进行中",
  ENDED: "已结束",
  CANCELLED: "已取消",
  REJECTED: "已驳回",
};

export const ACTIVITY_STATUS_FILTERS = ["ALL", ...ACTIVITY_STATUSES] as const;
export const ACTIVITY_TYPE_FILTERS = ["ALL", ...ACTIVITY_TYPES] as const;
export const ACTIVITY_SOURCE_FILTERS = ["ALL", ...ACTIVITY_SOURCES] as const;
export const ACTIVITY_TAG_FILTERS = ["ALL", ...ACTIVITY_TAGS] as const;

/** 时间维度筛选：全部 / 今天 / 本周 / 即将截止 */
export const ACTIVITY_TIME_FILTERS = ["ALL", "TODAY", "WEEK", "CLOSING"] as const;
export type ActivityTimeFilter = (typeof ACTIVITY_TIME_FILTERS)[number];

export const ACTIVITY_TIME_LABEL: Record<ActivityTimeFilter, string> = {
  ALL: "全部",
  TODAY: "今天",
  WEEK: "本周",
  CLOSING: "即将截止",
};

export const ACTIVITY_PAGE_SIZE = 10;

/** 报名状态：活动取消时联动 CANCELLED；需审核的活动报名先进入 PENDING */
export const REGISTRATION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已报名",
  REJECTED: "未通过",
  CANCELLED: "已取消",
};

/** 活动开始前多少小时允许取消报名 */
export const REGISTRATION_CANCEL_HOURS = 2;
/** 同一学生最多同时持有的有效报名数 */
export const REGISTRATION_MAX_ACTIVE = 20;

/** 教师 / 管理员统一视为管理端角色 */
export function isStaffRole(role: string | undefined | null) {
  return role === "ADMIN" || role === "TEACHER";
}

/** ============ V7.1 身份认证 / 行政通知 / 热门活动 ============ */

export const AUTH_STATUSES = ["UNAUTH", "AUTHED"] as const;
export type AuthStatus = (typeof AUTH_STATUSES)[number];

export const AUTH_STATUS_LABEL: Record<AuthStatus, string> = {
  UNAUTH: "未认证",
  AUTHED: "已认证",
};

/** 首页热门活动池上限（PRD：最多 8 条） */
export const HOT_ACTIVITY_MAX = 8;
/** 首页失物快报 / 推荐 / 通知条数上限 */
export const HOME_LOST_FOUND_TAKE = 5;
export const HOME_RECOMMEND_TAKE = 6;
export const HOME_NOTICE_TAKE = 4;
export const NOTICE_PAGE_SIZE = 10;

/** 学生班级示例：认证页可手填，此处仅作为候选提示 */
export const CLASS_OPTIONS = [
  "师范1234班",
  "师范1235班",
  "计算机2301班",
  "计算机2302班",
  "英语2301班",
  "会计2301班",
] as const;


/** 头像配色（个人中心可切换） */export const AVATAR_KEYS = ["mint", "peach", "sky", "lilac", "sand", "rose"] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const AVATAR_OPTIONS: {
  key: AvatarKey;
  label: string;
  className: string;
}[] = [
  { key: "mint", label: "薄荷", className: "from-[#43CBAC] to-[#0E8F74]" },
  { key: "peach", label: "蜜桃", className: "from-[#FFC9A6] to-[#FF9160]" },
  { key: "sky", label: "晴空", className: "from-[#9DD9F3] to-[#4F9FC9]" },
  { key: "lilac", label: "丁香", className: "from-[#CDBDF7] to-[#8B72D9]" },
  { key: "sand", label: "暖沙", className: "from-[#F2D9B0] to-[#C99A5B]" },
  { key: "rose", label: "蔷薇", className: "from-[#FFC2CE] to-[#E86B8A]" },
];

export function avatarClassOf(key: string | null | undefined) {
  return AVATAR_OPTIONS.find((option) => option.key === key)?.className ?? AVATAR_OPTIONS[0].className;
}

export const COLLEGES = [
  "计算机学院",
  "机械工程学院",
  "外国语学院",
  "经济管理学院",
  "数学与统计学院",
  "物理与电子学院",
  "文学与新闻传播学院",
  "学生事务中心",
] as const;

export const GRADES = ["大一", "大二", "大三", "大四", "研一", "研二", "研三", "教职工"] as const;

/** 测试期演示账号：登录页可一键填入 */
export const DEMO_ACCOUNTS = {
  user: { label: "普通用户", name: "林小夏", studentNo: "2023010101", password: "campus123" },
  teacher: { label: "教师 / 活动管理员", name: "周明远", studentNo: "T2023001", password: "teacher123" },
  admin: { label: "管理员", name: "平台管理员", studentNo: "90000001", password: "admin123" },
} as const;

export const SIDEBAR_STORAGE_KEY = "campus-market:sidebar-collapsed";

export const PAGE_SIZE = 8;
export const GENERAL_PAGE_SIZE = 10;

export function isAdminRole(role: string | undefined | null) {
  return role === "ADMIN";
}

/** ============ V8 作品展示专区 / 系统通知 / 截止提醒 ============ */

export const WORK_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

export const WORK_STATUS_FILTERS = ["ALL", ...WORK_STATUSES] as const;

/** 单个竞赛最多维护 12 个作品分类 */
export const WORK_CATEGORY_MAX = 12;
/** 单个作品最多 9 个多媒体资源 */
export const WORK_MEDIA_MAX = 9;
/** 作品展示页每页数量 */
export const WORK_PAGE_SIZE = 12;

export const WORK_MEDIA_TYPES = ["IMAGE", "VIDEO", "FILE"] as const;
export type WorkMediaType = (typeof WORK_MEDIA_TYPES)[number];

export const WORK_MEDIA_TYPE_LABEL: Record<WorkMediaType, string> = {
  IMAGE: "图片",
  VIDEO: "视频",
  FILE: "附件",
};

/** 新建作品专区时可选的一键初始化分类 */
export const DEFAULT_WORK_CATEGORIES = ["创意设计", "技术实现", "社会价值", "现场展示"] as const;

export const NOTIFICATION_TYPES = ["REMINDER", "REVIEW", "RECEIPT", "SYSTEM"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  REMINDER: "截止提醒",
  REVIEW: "审核通知",
  RECEIPT: "提交回执",
  SYSTEM: "系统消息",
};

/** 提醒阶段文案（与 src/lib/rules/reminder.ts 的阶段 key 一一对应） */
export const REMINDER_STAGE_LABEL: Record<string, string> = {
  D7: "截止前 7 天",
  D3: "截止前 3 天",
  D1: "截止前 1 天",
  H2: "截止前 2 小时",
};

/** 全局提交提醒弹窗：同一用户单天最多 3 次 */
export const SUBMISSION_POPUP_DAILY_LIMIT = 3;
export const SUBMISSION_POPUP_STORAGE_KEY = "campus-hub:v8:deadline-popup";
