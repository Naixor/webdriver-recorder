# WebdriverRecorder
通过鼠标操作的录制以及expect的选择，来生成webdriver前端自动化case

## Extension
浏览器插件部分，负责：
+ 鼠标操作的录制
+ expect方式的选择
+ 生成自动化脚本

## Server
客户端部分
+ 监听8765端口，接收来自插件的脚本传输（请注意端口是否已经被占用的情况）
+ 开启代理（https需要自己生成并确认下证书）
+ 是否是手机代理模式