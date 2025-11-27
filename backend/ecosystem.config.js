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
      API_KEY: 'your-secret-api-key-here',
      HEARTBEAT_TIMEOUT_SECONDS: 300,
      // 交易時段配置（倫敦時間）
      TRADING_HOURS_ENABLED: 'true',           // 啟用交易時段限制
      TRADING_TIMEZONE: 'Europe/London',       // 倫敦時間
      TRADING_DAYS_START: '1',                 // 週一
      TRADING_DAYS_END: '5',                   // 週五
      TRADING_HOURS_START: '01:30',            // 開始時間
      TRADING_HOURS_END: '23:30',              // 結束時間
      CORS_ORIGIN: '*',
      RATE_LIMIT_PER_MIN: 60,
      // 定時上報時間設定（倫敦時間，cron 格式）
      REPORT_TIME_1: '45 23 * * *',  // 23:45
      REPORT_TIME_2: '0 10 * * *',   // 10:00
      // Telegram 通知設定（可選）
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: ''
    }
  }]
};
