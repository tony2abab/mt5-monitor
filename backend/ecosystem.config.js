module.exports = {
  apps: [{
    name: 'mt5-monitor-backend',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      DB_PATH: 'C:/MT5_Monitor/data/monitor.db',
      ENABLE_AUTH: 'true',
      API_KEY: 'secret_key_2025_9093942525abcdxyz_',
      HEARTBEAT_TIMEOUT_SECONDS: 420,  // 7 分鐘（MT4/MT5 每 5 分鐘發送心跳）
      // 交易時段配置（CFD平台時間：冬令GMT+2，夏令GMT+3）
      TRADING_HOURS_ENABLED: 'true',           // 啟用交易時段限制
      TRADING_TIMEZONE: 'Europe/Athens',        // CFD平台時間 (冬令GMT+2, 夏令GMT+3)
      TRADING_DAYS_START: '1',                 // 週一
      TRADING_DAYS_END: '5',                   // 週五
      TRADING_HOURS_START: '01:30',            // 開始時間
      TRADING_HOURS_END: '23:30',              // 結束時間
      CORS_ORIGIN: '*',
      RATE_LIMIT_PER_MIN: 60,
      // Web 登入保護設定
      WEB_LOGIN_ENABLED: 'true',                 // 啟用 Web 登入保護
      WEB_PASSWORD: 'tt24423789',    // Web 登入密碼
      // 定時上報時間設定（CFD平台時間，cron 格式）
      REPORT_TIME_1: '45 23 * * *',  // 23:45
      REPORT_TIME_2: '0 10 * * *',   // 10:00
      // Telegram 通知設定
      TELEGRAM_BOT_TOKEN: '6492162382:AAEKsQWDUXc7cJw0pS1z_lqsHZ6HIFLpjpw',
      TELEGRAM_CHAT_ID: '1942176657',
      NOTIFY_OFFLINE: 'true',           // 節點離線時發送 TG 通知
      NOTIFY_ON_RECOVERY: 'true'        // 節點恢復上線時發送 TG 通知
    }
  }]
};
