import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // nodemailer 依赖 Node 内置模块，交给运行时加载，避免被 webpack 打包
  serverExternalPackages: ["nodemailer"],
  // 父目录也存在 lockfile，显式锁定本项目的追踪根目录，避免 standalone 结构错位
  outputFileTracingRoot: __dirname,
  // Prisma 引擎在 standalone 模式下需要被显式追踪，否则运行时会丢二进制文件
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/nodemailer/**/*",
    ],
  },
};

export default nextConfig;
