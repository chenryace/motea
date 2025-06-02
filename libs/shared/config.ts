/**
 * 应用配置管理
 * 统一管理环境变量和默认值
 */

export interface AppConfig {
    preloadNotesCount: number;
    platform: 'vercel' | 'docker' | 'unknown';
    isDevelopment: boolean;
}

/**
 * 获取预加载笔记数量
 * 支持环境变量配置，带有智能默认值
 */
export function getPreloadNotesCount(): number {
    // 1. 优先使用环境变量
    const envValue = process.env.PRELOAD_NOTES_COUNT;
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
            console.log(`📊 使用环境变量配置: 预加载 ${parsed} 个笔记`);
            return Math.min(parsed, 100); // 最大限制100个，防止配置错误
        }
    }

    // 2. 根据平台提供智能默认值
    const platform = detectPlatform();
    const defaults = {
        vercel: 5,      // Vercel 保守策略
        docker: 15,     // Docker 自建中等策略
        unknown: 10     // 未知平台保守策略
    };

    const defaultCount = defaults[platform];
    console.log(`📊 使用 ${platform} 平台默认配置: 预加载 ${defaultCount} 个笔记`);
    return defaultCount;
}

/**
 * 检测部署平台
 */
export function detectPlatform(): AppConfig['platform'] {
    // 服务端检测
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.VERCEL) {
            return 'vercel';
        }
        if (process.env.DOCKER_ENV || process.env.KUBERNETES_SERVICE_HOST) {
            return 'docker';
        }
    }

    // 客户端检测 (仅在浏览器环境)
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
            return 'vercel';
        }
        if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            return 'docker';
        }
    }

    return 'unknown';
}

/**
 * 获取完整应用配置
 */
export function getAppConfig(): AppConfig {
    return {
        preloadNotesCount: getPreloadNotesCount(),
        platform: detectPlatform(),
        isDevelopment: process.env.NODE_ENV === 'development',
    };
}

/**
 * 获取平台特定的性能建议
 */
export function getPerformanceRecommendations(platform: AppConfig['platform']) {
    const recommendations = {
        vercel: {
            preloadCount: '3-10',
            reason: '单并发限制，建议保守加载',
            strategy: 'conservative'
        },
        docker: {
            preloadCount: '10-30',
            reason: '自建环境，根据服务器性能调整',
            strategy: 'balanced'
        },
        unknown: {
            preloadCount: '5-15',
            reason: '未知环境，建议保守配置',
            strategy: 'conservative'
        }
    };

    return recommendations[platform];
}

/**
 * 验证配置是否合理
 */
export function validateConfig(config: AppConfig): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // 检查预加载数量是否合理
    const recommendations = getPerformanceRecommendations(config.platform);
    const [min, max] = recommendations.preloadCount.split('-').map(n => parseInt(n));
    
    if (config.preloadNotesCount < min) {
        warnings.push(`预加载数量 ${config.preloadNotesCount} 可能过少，建议 ${recommendations.preloadCount}`);
    }
    
    if (config.preloadNotesCount > max) {
        warnings.push(`预加载数量 ${config.preloadNotesCount} 可能过多，建议 ${recommendations.preloadCount}`);
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}
