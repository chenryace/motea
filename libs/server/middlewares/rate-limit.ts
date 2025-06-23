/**
 * API 限流中间件
 * 根据部署环境智能调整限流策略
 * 保护 Vercel 和 Docker 部署免受恶意攻击
 */

import rateLimit from 'express-rate-limit';
import { ApiRequest, ApiResponse, ApiNext } from '../connect';
import { createLogger } from '../debugging';

const logger = createLogger('rate-limit');

// 🎯 环境检测
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
const isDocker = !!(process.env.DOCKER || process.env.HOSTNAME === '0.0.0.0');

/**
 * 根据部署环境获取限流配置
 */
function getRateLimitConfig(type: 'auth' | 'notes' | 'read' | 'general') {
    const baseConfig = {
        // 使用内存存储，适合单实例部署
        // 如果需要多实例，可以考虑 Redis 存储
        standardHeaders: true, // 返回标准的 `RateLimit-*` 头部
        legacyHeaders: false,  // 禁用 `X-RateLimit-*` 头部
        
        // 自定义错误响应
        handler: (req: any, res: any) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                path: req.url,
                method: req.method,
            });

            res.status(429).json({
                name: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later.',
                status: 429,
            });
        },
        
        // 跳过成功的请求计数（可选）
        skipSuccessfulRequests: false,
        
        // 跳过失败的请求计数（可选）
        skipFailedRequests: false,
    };

    // 🔧 根据环境和操作类型调整限制
    switch (type) {
        case 'auth':
            // 认证相关：最严格限制
            return {
                ...baseConfig,
                windowMs: 15 * 60 * 1000, // 15分钟窗口
                max: isServerless ? 5 : isDocker ? 10 : 8, // Vercel 更严格
                message: 'Too many authentication attempts, please try again in 15 minutes.',
            };
            
        case 'notes':
            // 笔记操作：中等限制
            return {
                ...baseConfig,
                windowMs: 1 * 60 * 1000, // 1分钟窗口
                max: isServerless ? 20 : isDocker ? 50 : 30,
                message: 'Too many note operations, please slow down.',
            };
            
        case 'read':
            // 读取操作：宽松限制
            return {
                ...baseConfig,
                windowMs: 1 * 60 * 1000, // 1分钟窗口
                max: isServerless ? 100 : isDocker ? 200 : 150,
                message: 'Too many read requests, please slow down.',
            };
            
        case 'general':
        default:
            // 通用限制：平衡配置
            return {
                ...baseConfig,
                windowMs: 1 * 60 * 1000, // 1分钟窗口
                max: isServerless ? 60 : isDocker ? 120 : 90,
                message: 'Too many requests, please slow down.',
            };
    }
}

// 🛡️ 创建不同类型的限流器
export const authRateLimit = rateLimit(getRateLimitConfig('auth'));
export const notesRateLimit = rateLimit(getRateLimitConfig('notes'));
export const readRateLimit = rateLimit(getRateLimitConfig('read'));
export const generalRateLimit = rateLimit(getRateLimitConfig('general'));

/**
 * 智能限流中间件
 * 根据请求路径自动选择合适的限流策略
 */
export function smartRateLimit(req: ApiRequest, res: ApiResponse, next: ApiNext) {
    const path = req.url || '';
    const method = req.method || 'GET';
    
    // 🔍 根据路径和方法选择限流策略
    if (path.includes('/api/auth') || path.includes('/api/login')) {
        // 认证相关
        return authRateLimit(req, res, next);
    } else if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        // 写操作
        return notesRateLimit(req, res, next);
    } else if (method === 'GET') {
        // 读操作
        return readRateLimit(req, res, next);
    } else {
        // 其他操作
        return generalRateLimit(req, res, next);
    }
}

/**
 * 创建自定义限流器
 */
export function createCustomRateLimit(options: {
    windowMs: number;
    max: number;
    message?: string;
}) {
    return rateLimit({
        ...getRateLimitConfig('general'),
        ...options,
    });
}

// 📊 记录限流配置
logger.info('Rate limiting configured', {
    environment: isServerless ? 'serverless' : isDocker ? 'docker' : 'traditional',
    authLimit: getRateLimitConfig('auth').max,
    notesLimit: getRateLimitConfig('notes').max,
    readLimit: getRateLimitConfig('read').max,
    generalLimit: getRateLimitConfig('general').max,
});

export default smartRateLimit;
